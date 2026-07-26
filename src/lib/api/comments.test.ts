import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, RuntimeError } from '../cli-error.js';
import {
  type CommentTargetRef,
  createComment,
  listComments,
  validateReplyTarget,
} from './comments.js';

const issueTarget: CommentTargetRef = { type: 'issue', id: 'issue-1' };
const projectTarget: CommentTargetRef = { type: 'project', id: 'project-1' };

function rawComment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    url: 'https://linear.app/comment/' + id,
    body: 'body ' + id,
    createdAt: '2026-07-24T12:00:00.000Z',
    updatedAt: '2026-07-24T12:00:01.000Z',
    editedAt: null,
    resolvedAt: null,
    parentId: null,
    quotedText: null,
    user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    botActor: null,
    externalUser: null,
    ...overrides,
  };
}

function page(resource: 'issue' | 'project', ids: string[], hasNextPage: boolean, endCursor: string | null) {
  const comments = {
    edges: ids.map(id => ({ cursor: 'cursor-' + id, node: rawComment(id) })),
    pageInfo: { hasNextPage, endCursor },
  };
  return {
    data: resource === 'issue'
      ? { issue: { id: 'issue-1', comments } }
      : { comments },
  };
}

describe('comment raw GraphQL API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('CMT-API-ISSUE-QUERY maps a bounded raw edge page and preserves returned order', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => page('issue', ['a', 'b'], true, 'cursor-b'));
    const result = await listComments(issueTarget, { limit: 2 }, { rawRequest });
    expect(result.items.map(item => item.id)).toEqual(['a', 'b']);
    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: true,
      endCursor: 'cursor-b',
      fetchedAll: false,
    });
    const [query, variables] = rawRequest.mock.calls[0];
    expect(query).toContain('issue(id: $targetId)');
    expect(query).toContain('comments(first: $first, after: $after, orderBy: createdAt)');
    expect(variables).toEqual({ targetId: 'issue-1', first: 2, after: null });
  });

  it('CMT-API-PROJECT-QUERY and CMT-PAG-ALL-PAGESIZE traverse project comments at 250', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(page('project', ['a'], true, 'cursor-a'))
      .mockResolvedValueOnce(page('project', ['b'], false, null));
    const result = await listComments(projectTarget, { fetchAll: true }, { rawRequest });
    expect(result.items.map(item => item.id)).toEqual(['a', 'b']);
    expect(rawRequest.mock.calls.map(call => call[1])).toEqual([
      { targetId: 'project-1', first: 250, after: null },
      { targetId: 'project-1', first: 250, after: 'cursor-a' },
    ]);
    expect(rawRequest.mock.calls[0][0]).toContain(
      '{ project: { id: { eq: $targetId } } }'
    );
    expect(rawRequest.mock.calls[0][0]).toContain(
      '{ projectUpdate: { null: true } }'
    );
    expect(rawRequest.mock.calls[0][0]).not.toContain('project(id: $targetId)');
  });

  it('CMT-API-COMMENT-MODEL preserves nullable creator/thread/timestamp fields', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: {
        issue: {
          comments: {
            edges: [{
              cursor: 'c',
              node: rawComment('a', {
                user: null,
                botActor: { id: 'bot-1', name: 'Linear Bot', type: 'integration' },
                externalUser: { id: 'ext-1', name: 'External', displayName: 'External', email: null },
                editedAt: '2026-07-24T13:00:00.000Z',
                parentId: 'parent-1',
              }),
            }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    }));
    const result = await listComments(issueTarget, { limit: 1 }, { rawRequest });
    expect(result.items[0]).toMatchObject({
      user: null,
      botActor: { id: 'bot-1', name: 'Linear Bot' },
      externalUser: { id: 'ext-1', name: 'External' },
      parentId: 'parent-1',
    });
  });

  it('CMT-API-ISSUE-CREATE sends issueId only and returns the shared fragment', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: { commentCreate: { success: true, comment: rawComment('created') } },
    }));
    const result = await createComment(issueTarget, { body: 'hello' }, { rawRequest });
    expect(result.id).toBe('created');
    const [query, variables] = rawRequest.mock.calls[0];
    expect(query).toContain('commentCreate');
    expect(variables).toEqual({ input: { body: 'hello', issueId: 'issue-1' } });
    expect(JSON.stringify(variables)).not.toContain('projectId');
    expect(query).not.toContain('projectUpdateId');
  });

  it('CMT-API-PROJECT-CREATE sends projectId and never projectUpdateId', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: { commentCreate: { success: true, comment: rawComment('created') } },
    }));
    await createComment(projectTarget, { body: 'hello' }, { rawRequest });
    const [query, variables] = rawRequest.mock.calls[0];
    expect(variables).toEqual({ input: { body: 'hello', projectId: 'project-1' } });
    expect(JSON.stringify(variables)).not.toContain('projectUpdateId');
    expect(query).not.toContain('projectUpdateId');
  });

  it('CMT-API-REPLY-VALIDATION proves a parent belongs to the same issue or project', async () => {
    const issueRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: { comment: { id: 'parent', issueId: 'issue-1', projectId: null, projectUpdateId: null } },
    }));
    await expect(validateReplyTarget(issueTarget, 'parent', { rawRequest: issueRequest })).resolves.toBeUndefined();

    const projectRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: { comment: { id: 'parent', issueId: null, projectId: 'project-1', projectUpdateId: null } },
    }));
    await expect(validateReplyTarget(projectTarget, 'parent', { rawRequest: projectRequest })).resolves.toBeUndefined();
  });

  it('CMT-ARG-REPLY-NOTFOUND and CMT-ARG-REPLY-WRONGTARGET normalize parent failures', async () => {
    const missing = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({ data: { comment: null } }));
    await expect(validateReplyTarget(issueTarget, 'gone', { rawRequest: missing })).rejects.toBeInstanceOf(
      NotFoundError
    );

    const wrong = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: { comment: { id: 'other', issueId: 'issue-2', projectId: null, projectUpdateId: null } },
    }));
    await expect(validateReplyTarget(issueTarget, 'other', { rawRequest: wrong })).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  it('[PR17-R4] rejects a project-update comment as a direct project reply target', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: {
        comment: {
          id: 'update-comment',
          issueId: null,
          projectId: 'project-1',
          projectUpdateId: 'project-update-1',
        },
      },
    }));

    await expect(
      validateReplyTarget(projectTarget, 'update-comment', { rawRequest })
    ).rejects.toMatchObject({ code: 'conflict', exitCode: 5 });
  });

  it('CMT-API-CREATE-SUCCESS requires success=true and a returned comment', async () => {
    for (const payload of [
      { success: false, comment: rawComment('x') },
      { success: true, comment: null },
      null,
    ]) {
      const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({ data: { commentCreate: payload } }));
      await expect(createComment(issueTarget, { body: 'x' }, { rawRequest })).rejects.toBeInstanceOf(
        RuntimeError
      );
    }
  });

  it('CMT-API-NO-SWALLOW propagates query failures rather than returning empty', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => {
      throw new Error('network failed');
    });
    await expect(listComments(issueTarget, { limit: 1 }, { rawRequest })).rejects.toThrow(
      'network failed'
    );
  });
});
