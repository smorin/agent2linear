import { describe, expect, it, vi } from 'vitest';

import type { IssueLabel, ProjectLabel, WorkspaceResolution } from '../../lib/types.js';
import {
  type LabelRunnerDependencies,
  runLabelCreate,
  runLabelDelete,
  runLabelLifecycle,
  runLabelList,
  runLabelUpdate,
  runLabelView,
} from './runner.js';

const workspace: WorkspaceResolution = {
  key: 'conceptm',
  name: 'ConceptM',
  source: 'flag',
};

const issueLabel: IssueLabel = {
  id: 'issue-label-1',
  name: 'Issue label',
  color: '#5E6AD2',
  description: 'Issue description',
  teamId: 'team-1',
  retiredAt: null,
  archivedAt: null,
};

const projectLabel: ProjectLabel = {
  id: 'project-label-1',
  name: 'Project label',
  color: '#123456',
  description: 'Project description',
  retiredAt: null,
  archivedAt: null,
};

function dependencies() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const deps: LabelRunnerDependencies = {
    resolveAlias: vi.fn((_type, id) => id),
    getById: vi.fn(async kind => (kind === 'issue' ? issueLabel : projectLabel)),
    create: vi.fn(async kind => (kind === 'issue' ? issueLabel : projectLabel)),
    update: vi.fn(async kind => (kind === 'issue' ? issueLabel : projectLabel)),
    delete: vi.fn(async () => true),
    lifecycle: vi.fn(async (kind, operation) => ({
      ...(kind === 'issue' ? issueLabel : projectLabel),
      retiredAt: operation === 'retire' ? '2026-07-24T00:00:00.000Z' : null,
    })),
    list: vi.fn(async kind => ({
      items: [kind === 'issue' ? issueLabel : projectLabel],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: false,
        endCursor: null,
        fetchedAll: true,
      },
    })),
    guardMutation: vi.fn(async () => workspace),
    resolveWorkspace: vi.fn(() => workspace),
    confirmDestructive: vi.fn(async () => undefined),
    recordHistory: vi.fn(async () => ({ status: 'not_applicable' as const, entryId: null })),
    writeStdout: value => stdout.push(value),
    writeStderr: value => stderr.push(value),
    writeDebug: vi.fn(),
  };
  return { deps, stdout, stderr };
}

describe('M33 label mutation runners', () => {
  it('[LPL-OPT-IL-CREATE-NAME][LPL-OPT-IL-CREATE-OUTPUT] validates before mutation', async () => {
    const { deps } = dependencies();

    await expect(
      runLabelCreate('issue', { name: '   ', color: '#5E6AD2' }, deps)
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    await expect(
      runLabelCreate(
        'issue',
        {
          name: 'x',
          color: '#5E6AD2',
          output: 'yaml',
          outputSource: 'explicit',
        },
        deps
      )
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });

    expect(deps.guardMutation).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('[LPL-OPT-IL-CREATE-DRYRUN][LPL-OPT-IL-CREATE-JSON] emits a mutation-free JSON plan', async () => {
    const { deps, stdout } = dependencies();

    await runLabelCreate(
      'issue',
      {
        name: 'New label',
        color: 'abcdef',
        team: 'eng',
        dryRun: true,
        json: true,
      },
      deps
    );

    expect(deps.resolveAlias).toHaveBeenCalledWith('team', 'eng');
    expect(deps.guardMutation).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      dryRun: true,
      operation: 'create',
      workspace: { name: 'ConceptM' },
      label: { type: 'issue', name: 'New label', color: '#ABCDEF', teamId: 'eng' },
    });
  });

  it('[LPL-OPT-PL-UPDATE-DESCRIPTION][LPL-ARG-PL-UPDATE-ID] preserves an explicit empty description', async () => {
    const { deps } = dependencies();

    await runLabelUpdate('project', 'alias', { description: '', yes: true }, deps);

    expect(deps.resolveAlias).toHaveBeenCalledWith('project-label', 'alias');
    expect(deps.update).toHaveBeenCalledWith('project', 'alias', { description: '' });
  });

  it('[LPL-OPT-IL-DELETE-YES][LPL-SAFE-DELETE-CONFIRM] stops cleanly when destructive confirmation is declined', async () => {
    const { deps, stdout } = dependencies();
    vi.mocked(deps.confirmDestructive).mockResolvedValue({ confirmed: false });

    await runLabelDelete('issue', 'issue-label-1', {}, deps);

    expect(deps.delete).not.toHaveBeenCalled();
    expect(stdout.join('')).toContain('cancelled');
  });

  it('[LPL-OUT-JSON-DELETE][LPL-API-DELETE-SUCCESS] rejects a false delete payload', async () => {
    const { deps } = dependencies();
    vi.mocked(deps.delete).mockResolvedValue(false);

    await expect(
      runLabelDelete('project', 'project-label-1', { yes: true, json: true }, deps)
    ).rejects.toMatchObject({ code: 'runtime', exitCode: 1 });
  });

  it.each([
    ['issue', 'retire'],
    ['issue', 'restore'],
    ['project', 'retire'],
    ['project', 'restore'],
  ] as const)(
    '[LPL-CMD-IL-RETIRE][LPL-CMD-IL-RESTORE][LPL-CMD-PL-RETIRE][LPL-CMD-PL-RESTORE] routes %s %s',
    async (kind, operation) => {
      const { deps } = dependencies();

      await runLabelLifecycle(kind, operation, kind + '-label-1', { yes: true }, deps);

      expect(deps.lifecycle).toHaveBeenCalledWith(kind, operation, kind + '-label-1');
      if (operation === 'retire') {
        expect(deps.confirmDestructive).toHaveBeenCalledOnce();
      } else {
        expect(deps.confirmDestructive).not.toHaveBeenCalled();
      }
    }
  );
});

describe('M33 label list and view runners', () => {
  it('[LPL-RULE-IL-LIMIT-PARSE][LPL-RULE-PL-LIMIT-MAX] rejects invalid bounds before API access', async () => {
    const { deps } = dependencies();

    await expect(runLabelList('issue', { limit: '1.5' }, deps)).rejects.toMatchObject({
      code: 'usage',
      exitCode: 2,
    });
    await expect(runLabelList('project', { limit: '251' }, deps)).rejects.toMatchObject({
      code: 'usage',
      exitCode: 2,
    });
    expect(deps.list).not.toHaveBeenCalled();
  });

  it('[LPL-OPT-IL-LIST-AFTER][LPL-OPT-IL-LIST-ALL][LPL-OPT-IL-LIST-INCLUDERETIRED] preserves raw cursor and scope', async () => {
    const { deps } = dependencies();

    await runLabelList(
      'issue',
      {
        team: 'eng',
        color: 'abcdef',
        limit: '25',
        after: ' raw cursor ',
        all: true,
        includeRetired: true,
        cursorHistory: false,
        format: 'json',
      },
      deps
    );

    expect(deps.list).toHaveBeenCalledWith(
      'issue',
      {
        teamId: 'eng',
        color: '#ABCDEF',
        includeRetired: true,
      },
      { limit: 25, after: ' raw cursor ', fetchAll: true }
    );
    expect(deps.recordHistory).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
  });

  it('[LPL-OPT-IL-LIST-WORKSPACE] rejects team and workspace together before transport', async () => {
    const { deps } = dependencies();

    await expect(
      runLabelList('issue', { team: 'eng', workspace: true }, deps)
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    expect(deps.list).not.toHaveBeenCalled();
  });

  it('[LPL-OUT-PAGE-MACHINE][LPL-OUT-LIST-RETIREDAT][LPL-OUT-LIST-ARCHIVEDAT] emits a JSON envelope', async () => {
    const { deps, stdout } = dependencies();
    vi.mocked(deps.list).mockResolvedValue({
      items: [
        {
          ...projectLabel,
          retiredAt: '2026-07-01T00:00:00.000Z',
          archivedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: true,
        endCursor: 'next raw',
        fetchedAll: false,
      },
    });
    vi.mocked(deps.recordHistory).mockResolvedValue({
      status: 'recorded',
      entryId: 'history-1',
    });

    await runLabelList('project', { format: 'json' }, deps);

    const result = JSON.parse(stdout.join(''));
    expect(result).toMatchObject({
      labels: [
        {
          retiredAt: '2026-07-01T00:00:00.000Z',
          archivedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      pageInfo: { endCursor: 'next raw', hasNextPage: true },
      cursorHistory: { status: 'recorded', entryId: 'history-1' },
    });
  });

  it('[LPL-OUT-PAGE-HINT] human output exposes copyable next/all commands and history ID', async () => {
    const { deps, stdout } = dependencies();
    vi.mocked(deps.list).mockResolvedValue({
      items: [issueLabel],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: true,
        endCursor: 'next raw',
        fetchedAll: false,
      },
    });
    vi.mocked(deps.recordHistory).mockResolvedValue({
      status: 'recorded',
      entryId: 'history-1',
    });

    await runLabelList('issue', { limit: '1' }, deps);

    expect(stdout.join('')).toContain("a2l issue-labels list --limit '1' --after 'next raw'");
    expect(stdout.join('')).toContain("a2l issue-labels list --after 'next raw' --all");
    expect(stdout.join('')).toContain('history-1');
  });

  it('[LPL-OPT-PL-LIST-FORMAT][LPL-OUT-PAGE-MACHINE] keeps TSV row-only', async () => {
    const { deps, stdout } = dependencies();

    await runLabelList('project', { format: 'tsv' }, deps);

    expect(stdout.join('')).toContain('id\tname\tcolor');
    expect(stdout.join('')).not.toContain('Next page');
    expect(stdout.join('')).not.toContain('cursorHistory');
  });

  it('[LPL-CMD-IL-VIEW][LPL-CMD-PL-VIEW] views active or retired labels by alias', async () => {
    const { deps, stdout } = dependencies();

    await runLabelView('project', 'retired-alias', deps);

    expect(deps.resolveAlias).toHaveBeenCalledWith('project-label', 'retired-alias');
    expect(stdout.join('')).toContain('Project label');
  });
});
