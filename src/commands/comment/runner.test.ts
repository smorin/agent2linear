import { describe, expect, it, vi } from 'vitest';

import type { LinearComment } from '../../lib/api/comments.js';
import { UsageError } from '../../lib/cli-error.js';
import type { CursorHistoryResult } from '../../lib/cursor-history-adapter.js';
import type { WorkspaceResolution } from '../../lib/types.js';
import { type CommentRunnerDependencies,runCommentAdd, runCommentList } from './runner.js';
import type { ResolvedCommentTarget } from './targets.js';

const workspace: WorkspaceResolution = {
  key: 'lin_api_secret',
  name: 'conceptm',
  source: 'auto-detect',
};

const issueTarget: ResolvedCommentTarget = {
  type: 'issue',
  id: 'issue-1',
  identifier: 'ENG-123',
  title: 'Reconnect safely',
  resolvedBy: 'identifier',
  originalInput: 'ENG-123',
};

const projectTarget: ResolvedCommentTarget = {
  type: 'project',
  id: 'project-1',
  name: 'Backend migration',
  resolvedBy: 'name',
  originalInput: 'Backend migration',
};

function comment(id = 'comment-1'): LinearComment {
  return {
    id,
    url: 'https://linear.app/comment/' + id,
    body: 'hello',
    createdAt: '2026-07-24T18:32:04.000Z',
    updatedAt: '2026-07-24T18:32:04.000Z',
    editedAt: null,
    resolvedAt: null,
    parentId: null,
    quotedText: null,
    user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    botActor: null,
    externalUser: null,
  };
}

function harness(target: ResolvedCommentTarget = issueTarget) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const dependencies: CommentRunnerDependencies = {
    resolveTarget: vi.fn(async () => target),
    readBody: vi.fn(async options => options.body ?? 'body from input'),
    validateReply: vi.fn(async () => undefined),
    create: vi.fn(async () => comment()),
    list: vi.fn(async () => ({
      items: [comment()],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: false,
        endCursor: null,
        fetchedAll: true,
      },
    })),
    guardMutation: vi.fn(async () => workspace),
    resolveWorkspace: vi.fn(() => workspace),
    recordHistory: vi.fn(async input => ({
      status: input.disabled ? 'disabled' : 'not_applicable',
      entryId: null,
    } as CursorHistoryResult)),
    writeStdout: value => stdout.push(value),
    writeStderr: value => stderr.push(value),
    writeDebug: vi.fn(),
    stdinReservedForApiKey: () => false,
  };
  return { dependencies, stdout, stderr };
}

describe('comment add runner', () => {
  it.each([
    ['issue', issueTarget],
    ['project', projectTarget],
  ] as const)('CMT-TST-%s-ADD validates then guards immediately before one mutation', async (kind, target) => {
    const h = harness(target);
    const events: string[] = [];
    vi.mocked(h.dependencies.resolveTarget).mockImplementation(async () => {
      events.push('target');
      return target;
    });
    vi.mocked(h.dependencies.readBody).mockImplementation(async () => {
      events.push('body');
      return 'exact body';
    });
    vi.mocked(h.dependencies.validateReply).mockImplementation(async () => {
      events.push('reply');
    });
    vi.mocked(h.dependencies.guardMutation).mockImplementation(async () => {
      events.push('guard');
      return workspace;
    });
    vi.mocked(h.dependencies.create).mockImplementation(async (_target, options) => {
      events.push('create');
      expect(options).toEqual({
        body: 'exact body',
        parentId: 'parent-1',
        replyTargetValidated: true,
      });
      return comment();
    });

    await runCommentAdd(kind, target.originalInput, {
      body: 'exact body',
      replyTo: 'parent-1',
      yes: true,
      input: false,
    }, h.dependencies);

    expect(events).toEqual(['body', 'target', 'reply', 'guard', 'create']);
    expect(h.dependencies.guardMutation).toHaveBeenCalledWith({
      json: false,
      yes: true,
      noInput: true,
    });
    expect(h.dependencies.create).toHaveBeenCalledTimes(1);
    expect(h.stdout.join('')).toContain('Comment added to');
  });

  it('CMT-OPT-IA-OUTPUT/JSON rejects conflicts before input, target, guard, or mutation', async () => {
    const h = harness();
    await expect(runCommentAdd('issue', 'ENG-123', {
      output: 'table',
      outputSource: 'explicit',
      json: true,
      body: 'hello',
    }, h.dependencies)).rejects.toBeInstanceOf(UsageError);
    expect(h.dependencies.readBody).not.toHaveBeenCalled();
    expect(h.dependencies.resolveTarget).not.toHaveBeenCalled();
    expect(h.dependencies.guardMutation).not.toHaveBeenCalled();
    expect(h.dependencies.create).not.toHaveBeenCalled();
    expect(h.stdout).toEqual([]);
  });

  it('CMT-SAF-IA-DRYRUN validates a reply and emits JSON without guard or mutation', async () => {
    const h = harness();
    await runCommentAdd('issue', 'ENG-123', {
      body: '  exact markdown\n',
      replyTo: 'parent-1',
      dryRun: true,
      json: true,
    }, h.dependencies);
    expect(h.dependencies.validateReply).toHaveBeenCalledWith(
      { type: 'issue', id: 'issue-1' },
      'parent-1'
    );
    expect(h.dependencies.guardMutation).not.toHaveBeenCalled();
    expect(h.dependencies.create).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout.join(''))).toEqual({
      dryRun: true,
      workspace: { name: 'conceptm', source: 'auto-detect' },
      target: {
        type: 'issue', id: 'issue-1', identifier: 'ENG-123', title: 'Reconnect safely',
      },
      comment: { body: '  exact markdown\n', parentId: 'parent-1' },
      validation: { targetResolved: true, serverMutation: false },
    });
  });

  it('CMT-SAF-NO-BLIND-RETRY/CMT-OUT-NO-PARTIAL emits nothing when mutation fails', async () => {
    const h = harness();
    vi.mocked(h.dependencies.create).mockRejectedValue(new Error('network uncertain'));
    await expect(runCommentAdd('issue', 'ENG-123', { body: 'hello' }, h.dependencies))
      .rejects.toThrow('network uncertain');
    expect(h.dependencies.create).toHaveBeenCalledTimes(1);
    expect(h.stdout).toEqual([]);
  });
});

describe('comment list runner', () => {
  it.each([
    ['issue', issueTarget],
    ['project', projectTarget],
  ] as const)('CMT-TST-%s-LIST passes raw pagination and never invokes the mutation guard', async (kind, target) => {
    const h = harness(target);
    await runCommentList(kind, target.originalInput, {
      limit: '25',
      limitSource: 'explicit',
      after: ' raw cursor ',
      all: true,
      json: true,
      cursorHistory: false,
    }, h.dependencies);

    expect(h.dependencies.list).toHaveBeenCalledWith(
      { type: kind, id: target.id },
      { limit: 25, after: ' raw cursor ', fetchAll: true }
    );
    expect(h.dependencies.guardMutation).not.toHaveBeenCalled();
    expect(h.dependencies.writeDebug).toHaveBeenCalledWith(
      '--limit is ignored when --all is present; requests use pages of 250'
    );
    expect(h.dependencies.recordHistory).toHaveBeenCalledWith(expect.objectContaining({
      disabled: true,
      entry: expect.objectContaining({
        commandPath: `${kind} comment list`,
        resource: `${kind}-comment`,
        target: { id: target.id, label: kind === 'issue' ? 'ENG-123' : 'Backend migration' },
        orderBy: 'createdAt',
        limit: 25,
      }),
    }));
    expect(JSON.parse(h.stdout.join(''))).toMatchObject({
      target: { type: kind, id: target.id },
      cursorHistory: { status: 'disabled', entryId: null },
    });
  });

  it('CMT-PAG-TRUNCATED/CMT-PAG-HISTORY-RECORD emits and records raw continuation commands', async () => {
    const h = harness();
    vi.mocked(h.dependencies.list).mockResolvedValue({
      items: [comment()],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: true,
        endCursor: "next'cursor",
        fetchedAll: false,
      },
    });
    vi.mocked(h.dependencies.recordHistory).mockResolvedValue({
      status: 'recorded',
      entryId: 'history-1',
    });

    await runCommentList('issue', 'ENG-123', { limit: '1' }, h.dependencies);
    const record = vi.mocked(h.dependencies.recordHistory).mock.calls[0][0];
    expect(record.entry.commands.nextCommand).toContain("--after 'next'\"'\"'cursor'");
    expect(h.stdout.join('')).toContain('Cursor history: history-1');
    expect(h.stdout.join('')).toContain(record.entry.commands.nextCommand);
  });

  it('CMT-PAG-HISTORY-FAILED warns on stderr and still emits the remote JSON result', async () => {
    const h = harness();
    vi.mocked(h.dependencies.list).mockResolvedValue({
      items: [comment()],
      pageInfo: {
        returnedCount: 1,
        hasNextPage: true,
        endCursor: 'cursor-1',
        fetchedAll: false,
      },
    });
    vi.mocked(h.dependencies.recordHistory).mockResolvedValue({
      status: 'failed',
      entryId: null,
      error: new Error('disk full'),
    });
    await runCommentList('issue', 'ENG-123', { json: true }, h.dependencies);
    expect(JSON.parse(h.stdout.join('')).cursorHistory).toEqual({
      status: 'failed', entryId: null,
    });
    expect(h.stderr.join('')).toContain('cursor history');
    expect(h.stderr.join('')).not.toContain('lin_api_secret');
  });

  it('CMT-OPT-IL-LIMIT/AFTER rejects invalid pagination before target or API calls', async () => {
    for (const options of [{ limit: '0' }, { limit: '251' }, { limit: '1.5' }, { after: '' }]) {
      const h = harness();
      await expect(runCommentList('issue', 'ENG-123', options, h.dependencies))
        .rejects.toMatchObject({ exitCode: 2 });
      expect(h.dependencies.resolveTarget).not.toHaveBeenCalled();
      expect(h.dependencies.list).not.toHaveBeenCalled();
      expect(h.stdout).toEqual([]);
    }
  });

  it('CMT-OUT-NO-PARTIAL emits nothing when a page traversal rejects', async () => {
    const h = harness();
    vi.mocked(h.dependencies.list).mockRejectedValue(new Error('page two failed'));
    await expect(runCommentList('issue', 'ENG-123', { all: true }, h.dependencies))
      .rejects.toThrow('page two failed');
    expect(h.stdout).toEqual([]);
  });
});
