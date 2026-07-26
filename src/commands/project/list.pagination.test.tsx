import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsageError } from '../../lib/cli-error.js';
import { logger } from '../../lib/logger.js';
import type { ProjectListItem } from '../../lib/types.js';
import { listProjectsCommand } from './list.js';

const mocks = vi.hoisted(() => ({
  getAllProjects: vi.fn(),
  getConfig: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjectListPage: vi.fn(),
  recordCursorContinuation: vi.fn(),
  render: vi.fn(),
  resolveActiveWorkspace: vi.fn(),
  resolveAlias: vi.fn(),
  showError: vi.fn(),
  workspaceCacheKey: vi.fn(),
}));

vi.mock('../../lib/aliases.js', () => ({ resolveAlias: mocks.resolveAlias }));
vi.mock('../../lib/config.js', () => ({ getConfig: mocks.getConfig }));
vi.mock('../../lib/entity-cache.js', () => ({
  getEntityCache: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock('../../lib/linear-client.js', () => ({
  getAllProjects: mocks.getAllProjects,
  getProjectListPage: mocks.getProjectListPage,
  PROJECT_LIST_ORDER: 'updatedAt:desc',
}));
vi.mock('../../lib/output.js', () => ({
  filterColumns: (rows: Array<Record<string, unknown>>, columns: string[]) =>
    rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]]))),
  formatContentPreview: (value: string, length = 80) => value.slice(0, length),
  showError: mocks.showError,
}));
vi.mock('../../lib/workspace-resolver.js', () => ({
  resolveActiveWorkspace: mocks.resolveActiveWorkspace,
}));
vi.mock('../../lib/xdg-paths.js', () => ({
  workspaceCacheKey: mocks.workspaceCacheKey,
}));
vi.mock('../../lib/cursor-history-adapter.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cursor-history-adapter.js')>(
    '../../lib/cursor-history-adapter.js'
  );
  return {
    ...actual,
    recordCursorContinuation: mocks.recordCursorContinuation,
  };
});
vi.mock('ink', () => ({ Box: 'box', Text: 'text', render: mocks.render }));

let stdout: string[];
let stderr: string[];

function project(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'project-1',
    name: 'Project one',
    state: 'started',
    labels: [],
    members: [],
    url: 'https://linear.app/project/project-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    ...overrides,
  };
}

function page(items: ProjectListItem[] = [project()], cursor: string | null = null) {
  return {
    items,
    pageInfo: {
      returnedCount: items.length,
      hasNextPage: cursor !== null,
      endCursor: cursor,
      fetchedAll: cursor === null,
    },
  };
}

function program(): Command {
  const root = new Command();
  root.name('agent2linear').exitOverride();
  const projectCommand = root.command('project');
  listProjectsCommand(projectCommand);
  return root;
}

function output(): string {
  return stdout.join('\n');
}

function errorOutput(): string {
  return stderr.join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  stdout = [];
  stderr = [];
  vi.spyOn(console, 'log').mockImplementation(value => {
    stdout.push(String(value));
  });
  vi.spyOn(console, 'error').mockImplementation(value => {
    stderr.push(String(value));
  });
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`unexpected process.exit(${String(code)})`);
  });

  mocks.getConfig.mockReturnValue({});
  mocks.getCurrentUser.mockResolvedValue({ id: 'viewer-1' });
  mocks.resolveAlias.mockImplementation((type: string, value: string) => `${type}:${value}`);
  mocks.getProjectListPage.mockResolvedValue(page());
  mocks.getAllProjects.mockResolvedValue([project()]);
  mocks.resolveActiveWorkspace.mockReturnValue({
    key: 'lin_api_secret',
    name: 'ConceptM',
    source: 'auto-detect',
  });
  mocks.workspaceCacheKey.mockReturnValue('safe-workspace-hash');
  mocks.recordCursorContinuation.mockImplementation(async input => {
    if (input.disabled) return { status: 'disabled', entryId: null };
    if (!input.pageInfo.hasNextPage) return { status: 'not_applicable', entryId: null };
    return {
      status: 'recorded',
      entryId: '00000000-0000-4000-8000-000000000001',
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('project list M34 adoption', () => {
  it('[CPH-OPT-PROJECT-LEAD][CPH-OPT-PROJECT-LIMIT] preserves -l for lead and keeps limit long-only', async () => {
    const cli = program();
    const list = cli.commands[0].commands.find(command => command.name() === 'list');
    expect(list).toBeDefined();
    let listHelp = '';
    list?.configureOutput({
      writeOut: value => {
        listHelp += value;
      },
    });
    list?.outputHelp();
    expect(listHelp).toContain('-l, --lead <id>');
    expect(listHelp).toMatch(/\n\s+--limit <number>/);
    expect(listHelp).not.toContain('-l, --limit');
    expect(listHelp).toContain('-a, --all');
    expect(listHelp).toContain('Pagination:');
    expect(listHelp).toContain("--after '<raw-linear-cursor>'");
    expect(listHelp).toContain('--no-cursor-history');

    await cli.parseAsync(
      [
        'project',
        'list',
        '-l',
        'alice',
        '--all-teams',
        '--all-initiatives',
        '--limit',
        '1',
        '--json',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );

    expect(mocks.getProjectListPage).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'member:alice' }),
      { limit: 1, after: undefined, fetchAll: false },
      undefined
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('[CPH-OPT-PROJECT-LIMIT-PARSE][CPH-OPT-PROJECT-LIMIT-MAX][CPH-CMD-PROJECT-PAGINATION-USAGE] rejects invalid limits as usage before resolution or I/O', async () => {
    for (const value of ['1.5', '12abc', '251', '0', '-1']) {
      await expect(
        program().parseAsync(['project', 'list', '--limit', value], { from: 'user' })
      ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    }
    expect(mocks.getConfig).not.toHaveBeenCalled();
    expect(mocks.resolveAlias).not.toHaveBeenCalled();
    expect(mocks.getProjectListPage).not.toHaveBeenCalled();
    expect(mocks.recordCursorContinuation).not.toHaveBeenCalled();
  });

  it('[CPH-PAG-AFTER-EMPTY][CPH-CMD-PROJECT-PAGINATION-USAGE] rejects an empty raw cursor as usage before resolution or I/O', async () => {
    await expect(
      program().parseAsync(['project', 'list', '--after', ''], { from: 'user' })
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    expect(mocks.getConfig).not.toHaveBeenCalled();
    expect(mocks.getProjectListPage).not.toHaveBeenCalled();
    expect(mocks.recordCursorContinuation).not.toHaveBeenCalled();
  });

  it('[CPH-OPT-PROJECT-AFTER][CPH-API-PAGE-FILTER] passes raw after and the dependency predicate to the API', async () => {
    const after = ' raw cursor /+=🙂 ';
    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--limit',
        '2',
        '--after',
        after,
        '--has-dependencies',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );

    const [filters, pageInput, matches] = mocks.getProjectListPage.mock.calls[0];
    expect(filters).toMatchObject({ includeDependencies: true });
    expect(pageInput).toEqual({ limit: 2, after, fetchAll: false });
    expect(matches(project({ dependsOnCount: 1 }))).toBe(true);
    expect(matches(project({ dependsOnCount: 0, blocksCount: 0 }))).toBe(false);
  });

  it('[CPH-OPT-PROJECT-JSON][CPH-RULE-PROJECT-JSON] accepts JSON equivalence and rejects conflicts before I/O', async () => {
    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--json',
        '--output',
        'json',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );
    expect(() => JSON.parse(output())).not.toThrow();

    mocks.getProjectListPage.mockClear();
    mocks.getConfig.mockClear();
    await expect(
      program().parseAsync(['project', 'list', '--json', '--output', 'table'], { from: 'user' })
    ).rejects.toBeInstanceOf(UsageError);
    expect(mocks.getConfig).not.toHaveBeenCalled();
    expect(mocks.getProjectListPage).not.toHaveBeenCalled();

    await expect(
      program().parseAsync(['project', 'list', '--format', 'json'], { from: 'user' })
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
  });

  it('[CPH-OUT-PAGE-JSON][CPH-HIS-WORKSPACE] emits the envelope and records only a safe workspace hash', async () => {
    const cursor = "raw cursor's";
    mocks.getProjectListPage.mockResolvedValue(page([project()], cursor));

    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--after',
        'old raw cursor',
        '--json',
      ],
      { from: 'user' }
    );

    expect(JSON.parse(output())).toEqual({
      projects: [project()],
      pageInfo: page([project()], cursor).pageInfo,
      cursorHistory: {
        status: 'recorded',
        entryId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(mocks.workspaceCacheKey).toHaveBeenCalledWith('lin_api_secret');
    const historyInput = mocks.recordCursorContinuation.mock.calls[0][0];
    expect(historyInput.entry.workspace).toEqual({
      key: 'safe-workspace-hash',
      id: null,
      name: 'ConceptM',
    });
    expect(JSON.stringify(historyInput.entry)).not.toContain('lin_api_secret');
    expect(historyInput.entry.orderBy).toBe('updatedAt:desc');
    expect(historyInput.entry.commands.nextCommand).toContain("--after 'raw cursor'\"'\"'s'");
  });

  it('[CPH-OPT-PROJECT-NOHISTORY][CPH-OUT-PAGE-HUMAN] prints copyable next/all commands without persisting history', async () => {
    const cursor = "next cursor's";
    mocks.getProjectListPage.mockResolvedValue(page([project()], cursor));

    await program().parseAsync(
      ['project', 'list', '--all-leads', '--all-teams', '--all-initiatives', '--no-cursor-history'],
      { from: 'user' }
    );

    expect(output()).toContain('Next page:');
    expect(output()).toContain("--after 'next cursor'\"'\"'s'");
    expect(output()).toContain('All remaining:');
    expect(output()).toContain('Cursor history: disabled');
    expect(mocks.recordCursorContinuation).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true })
    );
    expect(mocks.resolveActiveWorkspace).not.toHaveBeenCalled();
    expect(mocks.workspaceCacheKey).not.toHaveBeenCalled();
  });

  it('[CPH-PAG-ALL-LIMIT][CPH-RULE-PROJECT-ALL-LIMIT][CPH-RULE-PROJECT-NOHISTORY-ALL] lets --all win, debugs the override, and never records at exhaustion', async () => {
    const debug = vi.spyOn(logger, 'debug');

    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--all',
        '--limit',
        '1',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );

    expect(mocks.getProjectListPage).toHaveBeenCalledWith(
      expect.any(Object),
      { limit: 1, after: undefined, fetchAll: true },
      undefined
    );
    expect(debug).toHaveBeenCalledWith('--all ignores --limit and fetches every remaining project');
    expect(mocks.recordCursorContinuation).not.toHaveBeenCalled();
  });

  it('[CPH-OUT-TSV][CPH-OUT-DIAGNOSTICS] keeps TSV tabular and sends truncation diagnostics to stderr', async () => {
    mocks.getProjectListPage.mockResolvedValue(page([project()], 'raw-tsv-cursor'));

    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--output',
        'tsv',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );

    expect(output().split('\n')[0]).toMatch(/^ID\tTitle\tStatus\tTeam\tLead/);
    expect(output()).not.toContain('Next page:');
    expect(output()).not.toContain('Total:');
    expect(errorOutput()).toContain('raw-tsv-cursor');
  });

  it('[CPH-RULE-PROJECT-INTERACTIVE] renders the already-fetched normalized page without refetching', async () => {
    await program().parseAsync(
      [
        'project',
        'list',
        '--all-leads',
        '--all-teams',
        '--all-initiatives',
        '--interactive',
        '--no-cursor-history',
      ],
      { from: 'user' }
    );

    expect(mocks.getProjectListPage).toHaveBeenCalledOnce();
    expect(mocks.getAllProjects).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.render.mock.calls[0][0].props.projects).toEqual([project()]);
  });

  it('[CPH-HIS-WRITE-FAILURE] treats history persistence failure as a nonfatal diagnostic', async () => {
    mocks.getProjectListPage.mockResolvedValue(page([project()], 'next'));
    mocks.recordCursorContinuation.mockResolvedValue({
      status: 'failed',
      entryId: null,
      error: new Error('disk full'),
    });

    await expect(
      program().parseAsync(['project', 'list', '--all-leads', '--all-teams', '--all-initiatives'], {
        from: 'user',
      })
    ).resolves.toBeDefined();
    expect(output()).toContain('Project one');
    expect(errorOutput()).toContain('disk full');
  });

  it('[CPH-HIS-WRITE-FAILURE] treats safe workspace-context failure as nonfatal', async () => {
    mocks.getProjectListPage.mockResolvedValue(page([project()], 'next'));
    mocks.resolveActiveWorkspace.mockImplementation(() => {
      throw new Error('workspace unavailable');
    });

    await expect(
      program().parseAsync(['project', 'list', '--all-leads', '--all-teams', '--all-initiatives'], {
        from: 'user',
      })
    ).resolves.toBeDefined();
    expect(output()).toContain('Project one');
    expect(errorOutput()).toContain('workspace unavailable');
    expect(mocks.recordCursorContinuation).not.toHaveBeenCalled();
  });
});
