import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsageError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import type { CursorHistoryResult } from '../../lib/cursor-history-adapter.js';
import type { IssueListPageResult } from '../../lib/linear-client.js';
import { logger } from '../../lib/logger.js';
import { workspaceCacheKey } from '../../lib/xdg-paths.js';
import {
  type IssueListRunnerDependencies,
  registerIssueListCommand,
  runIssueList,
} from './list.js';

vi.mock('../../lib/aliases.js', () => ({
  resolveAlias: vi.fn((_type: string, value: string) => `resolved:${value}`),
}));

vi.mock('../../lib/config.js', () => ({
  getConfig: vi.fn(() => ({})),
}));

interface Harness {
  dependencies: IssueListRunnerDependencies;
  getIssueListPage: ReturnType<typeof vi.fn>;
  recordCursorContinuation: ReturnType<typeof vi.fn>;
  stderr: string[];
  stdout: string[];
}

function issue(id = 'issue-1', identifier = 'ENG-101') {
  return {
    id,
    identifier,
    title: `Issue ${identifier}`,
    description: `${identifier} description`,
    priority: 2,
    estimate: 3,
    dueDate: '2026-08-01',
    assignee: { id: 'user-1', name: 'User', email: 'user@example.com' },
    team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
    state: { id: 'state-1', name: 'In Progress', type: 'started' as const },
    labels: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    url: `https://linear.app/issue/${identifier}`,
  };
}

function page(overrides: Partial<IssueListPageResult> = {}): IssueListPageResult {
  return {
    items: [issue()],
    pageInfo: {
      returnedCount: 1,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    },
    orderBy: { field: 'priority', direction: 'desc' },
    ...overrides,
  };
}

function harness(result: IssueListPageResult = page()): Harness {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const getIssueListPage = vi.fn().mockResolvedValue(result);
  const recordCursorContinuation = vi.fn().mockResolvedValue({
    status: 'recorded',
    entryId: '5f9cbcef-7b15-4df8-901d-491a2b55ee6f',
  } satisfies CursorHistoryResult);

  return {
    dependencies: {
      getIssueListPage,
      recordCursorContinuation,
      resolveActiveWorkspace: vi.fn(() => ({
        key: 'lin_api_secret',
        name: 'ConceptM',
        source: 'project' as const,
      })),
      openInBrowser: vi.fn().mockResolvedValue(undefined),
      stdout: value => stdout.push(value),
      stderr: value => stderr.push(value),
    },
    getIssueListPage,
    recordCursorContinuation,
    stdout,
    stderr,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('issue list pagination parser', () => {
  it('[CPH-CMD-ISSUE-PAGINATION-USAGE] registers canonical pagination and output flags only', () => {
    const program = new Command();
    registerIssueListCommand(program);

    const help = program.commands[0].helpInformation();

    expect(help).toContain('-l, --limit <number>');
    expect(help).toContain('-a, --all');
    expect(help).toContain('--after <cursor>');
    expect(help).toContain('--no-cursor-history');
    expect(help).toContain('-o, --output <table|json|tsv>');
    expect(help).toContain('--json');
    expect(help).not.toContain('--format');
  });

  it.each(['-f', '--format'])(
    '[CPH-OPT-ISSUE-REJECT-FORMAT] rejects removed legacy option %s before action side effects',
    async legacyOption => {
      const program = new Command();
      program.exitOverride();
      program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
      registerIssueListCommand(program);

      await expect(
        program.parseAsync(['list', legacyOption, 'json'], { from: 'user' })
      ).rejects.toMatchObject({
        code: 'usage',
        exitCode: 2,
        message:
          'Legacy -f/--format has been removed; use -o/--output <table|json|tsv>',
      });
      expect(getConfig).not.toHaveBeenCalled();
    }
  );
});

describe('runIssueList validation order', () => {
  it.each(['0', '-1', '251', '1.5', '12abc', '+1'])(
    '[CPH-PAG-LIMIT-PARSE] rejects limit %s before filters, API, or history',
    async limit => {
      const test = harness();

      await expect(
        runIssueList({ allAssignees: true, limit }, test.dependencies)
      ).rejects.toBeInstanceOf(UsageError);
      expect(getConfig).not.toHaveBeenCalled();
      expect(test.getIssueListPage).not.toHaveBeenCalled();
      expect(test.recordCursorContinuation).not.toHaveBeenCalled();
    }
  );

  it('[CPH-PAG-AFTER-EMPTY] rejects an empty raw cursor before filters, API, or history', async () => {
    const test = harness();

    await expect(
      runIssueList({ allAssignees: true, after: '' }, test.dependencies)
    ).rejects.toBeInstanceOf(UsageError);
    expect(getConfig).not.toHaveBeenCalled();
    expect(test.getIssueListPage).not.toHaveBeenCalled();
    expect(test.recordCursorContinuation).not.toHaveBeenCalled();
  });

  it('[CPH-RULE-ISSUE-JSON] rejects JSON/table conflict before filters, API, or history', async () => {
    const test = harness();

    await expect(
      runIssueList({ allAssignees: true, json: true, output: 'table' }, test.dependencies)
    ).rejects.toBeInstanceOf(UsageError);
    expect(getConfig).not.toHaveBeenCalled();
    expect(test.getIssueListPage).not.toHaveBeenCalled();
    expect(test.recordCursorContinuation).not.toHaveBeenCalled();
  });
});

describe('runIssueList pagination and output', () => {
  it('[CPH-PAG-RAW-FIDELITY][CPH-HIS-SAFE-COMMAND] passes raw after and records sanitized effective context', async () => {
    vi.mocked(getConfig).mockReturnValue({ defaultTeam: undefined } as never);
    const emittedCursor = "next'cursor /🙂 ";
    const test = harness(
      page({
        pageInfo: {
          returnedCount: 1,
          hasNextPage: true,
          endCursor: emittedCursor,
          fetchedAll: false,
        },
        orderBy: { field: 'due', direction: 'asc' },
      })
    );
    const after = ' raw cursor /+=🙂 ';

    await runIssueList(
      {
        allAssignees: true,
        team: 'core team',
        priority: '1',
        label: ['bug'],
        search: "can't reconnect",
        sort: 'due',
        order: 'asc',
        limit: '25',
        after,
        output: 'table',
      },
      test.dependencies
    );

    expect(test.getIssueListPage).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'resolved:core team',
        priority: 1,
        labelIds: ['resolved:bug'],
        search: "can't reconnect",
        sortField: 'due',
        sortOrder: 'asc',
      }),
      { limit: 25, after, fetchAll: false }
    );
    const recordInput = test.recordCursorContinuation.mock.calls[0][0];
    expect(recordInput).toMatchObject({
      disabled: false,
      entry: {
        workspace: {
          key: workspaceCacheKey('lin_api_secret'),
          id: null,
          name: 'ConceptM',
        },
        commandPath: 'issue list',
        resource: 'issue',
        target: null,
        orderBy: 'due:asc',
        limit: 25,
      },
    });
    expect(recordInput.entry.commands.sourceCommand).toContain(`--after '${after}'`);
    expect(recordInput.entry.commands.nextCommand).toContain(`--after 'next'"'"'cursor /🙂 '`);
    expect(recordInput.entry.commands.nextCommand).toContain("--search 'can'\"'\"'t reconnect'");
    expect(recordInput.entry.commands.nextCommand).toContain("--output 'table'");
    expect(recordInput.entry.commands.nextCommand).not.toContain('lin_api_secret');
    expect(test.stdout.join('')).toContain(recordInput.entry.commands.nextCommand);
    expect(test.stdout.join('')).toContain(recordInput.entry.commands.allRemainingCommand);
    expect(test.stdout.join('')).toContain('Cursor history: 5f9cbcef-7b15-4df8-901d-491a2b55ee6f');
  });

  it('[CPH-OPT-ISSUE-JSON] makes --json and --output json byte-equivalent envelopes', async () => {
    const shorthand = harness();
    const canonical = harness();

    await runIssueList({ allAssignees: true, json: true }, shorthand.dependencies);
    await runIssueList({ allAssignees: true, output: 'json' }, canonical.dependencies);

    expect(shorthand.stdout.join('')).toBe(canonical.stdout.join(''));
    expect(JSON.parse(shorthand.stdout.join(''))).toEqual({
      issues: [issue()],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: false,
        endCursor: null,
        fetchedAll: true,
      },
      cursorHistory: { status: 'not_applicable', entryId: null },
    });
  });

  it('[CPH-OUT-JSON-ENVELOPE] applies --columns inside the issues envelope', async () => {
    const test = harness();

    await runIssueList(
      { allAssignees: true, output: 'json', columns: 'identifier,title' },
      test.dependencies
    );

    expect(JSON.parse(test.stdout.join(''))).toMatchObject({
      issues: [{ identifier: 'ENG-101', title: 'Issue ENG-101' }],
      pageInfo: { returnedCount: 1 },
      cursorHistory: { status: 'not_applicable', entryId: null },
    });
  });

  it('[CPH-RULE-ISSUE-NOHISTORY-AFTER] emits continuation but skips history access', async () => {
    const test = harness(
      page({
        pageInfo: {
          returnedCount: 1,
          hasNextPage: true,
          endCursor: 'next-cursor',
          fetchedAll: false,
        },
      })
    );

    await runIssueList(
      {
        allAssignees: true,
        after: 'old-cursor',
        cursorHistory: false,
      },
      test.dependencies
    );

    expect(test.recordCursorContinuation).not.toHaveBeenCalled();
    expect(test.stdout.join('')).toContain("--after 'next-cursor'");
    expect(test.stdout.join('')).toContain('--no-cursor-history');
    expect(test.stdout.join('')).toContain('Cursor history: disabled');
  });

  it('[CPH-PAG-ALL-LIMIT][CPH-RULE-ISSUE-ALL-LIMIT][CPH-RULE-ISSUE-NOHISTORY-ALL] lets --all win, debugs the override, and never records at exhaustion', async () => {
    const test = harness();
    const debug = vi.spyOn(logger, 'debug');

    await runIssueList(
      {
        allAssignees: true,
        all: true,
        limit: '1',
        cursorHistory: false,
      },
      test.dependencies
    );

    expect(test.getIssueListPage).toHaveBeenCalledWith(expect.any(Object), {
      limit: 1,
      after: undefined,
      fetchAll: true,
    });
    expect(debug).toHaveBeenCalledWith('--all ignores --limit and fetches every remaining issue');
    expect(test.recordCursorContinuation).not.toHaveBeenCalled();
  });

  it('[CPH-OUT-TSV-CLEAN] keeps TSV row-only and sends truncated guidance to stderr', async () => {
    const test = harness(
      page({
        pageInfo: {
          returnedCount: 1,
          hasNextPage: true,
          endCursor: 'next-cursor',
          fetchedAll: false,
        },
      })
    );

    await runIssueList({ allAssignees: true, output: 'tsv' }, test.dependencies);

    expect(test.stdout.join('')).toContain('identifier\ttitle\tstate');
    expect(test.stdout.join('')).not.toContain('Next page:');
    expect(test.stdout.join('')).not.toContain('next-cursor');
    expect(test.stderr.join('')).toContain('--output json');
    expect(test.stderr.join('')).toContain('cursor-history');
  });

  it('[RLS-OUT-ISSUE-LIST-TSV] replaces every tab, CR, and LF in standard and custom TSV cells', async () => {
    const dirty = issue('issue\r1', 'ENG\t101');
    dirty.title = 'Title\rrow';
    dirty.state.name = 'In\nProgress';
    dirty.assignee.email = 'user\t@example.com';
    dirty.assignee.name = 'User\rName';
    dirty.team.key = 'E\rNG';
    dirty.url = 'https://linear.app/issue\n/ENG-101';
    dirty.description = 'first\tsecond\rthird\nfourth';
    dirty.dueDate = '2026-08-01\r';

    const standard = harness(page({ items: [dirty] }));
    await runIssueList(
      { allAssignees: true, output: 'tsv', descFull: true },
      standard.dependencies
    );
    expect(standard.stdout.join('')).toBe(
      'identifier\ttitle\tstate\tpriority\tassignee\tteam\turl\tdescription\n' +
        'ENG 101\tTitle row\tIn Progress\t2\tuser @example.com\tE NG\thttps://linear.app/issue /ENG-101\tfirst second third fourth\n'
    );

    const custom = harness(page({ items: [dirty] }));
    await runIssueList(
      {
        allAssignees: true,
        output: 'tsv',
        columns: 'id,identifier,title,state,assignee,team,url,description,dueDate',
      },
      custom.dependencies
    );
    expect(custom.stdout.join('')).toBe(
      'id\tidentifier\ttitle\tstate\tassignee\tteam\turl\tdescription\tdueDate\n' +
        'issue 1\tENG 101\tTitle row\tIn Progress\tUser Name\tE NG\thttps://linear.app/issue /ENG-101\tfirst second third fourth\t2026-08-01 \n'
    );
  });

  it('[CPH-HIS-WRITE-FAILURE] warns but returns a valid JSON result when recording fails', async () => {
    const test = harness(
      page({
        pageInfo: {
          returnedCount: 1,
          hasNextPage: true,
          endCursor: 'next-cursor',
          fetchedAll: false,
        },
      })
    );
    test.recordCursorContinuation.mockResolvedValue({
      status: 'failed',
      entryId: null,
      error: new Error('disk full'),
    } satisfies CursorHistoryResult);

    await expect(
      runIssueList({ allAssignees: true, output: 'json' }, test.dependencies)
    ).resolves.toBeUndefined();

    expect(JSON.parse(test.stdout.join('')).cursorHistory).toEqual({
      status: 'failed',
      entryId: null,
    });
    expect(test.stderr.join('')).toContain('warning: failed to record cursor history');
    expect(test.stderr.join('')).toContain('disk full');
  });

  it('[CPH-HIS-NO-RECORD-COMPLETE] never calls history recording for an exhausted result', async () => {
    const test = harness();

    await runIssueList({ allAssignees: true }, test.dependencies);

    expect(test.recordCursorContinuation).not.toHaveBeenCalled();
  });
});
