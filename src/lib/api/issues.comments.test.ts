import { describe, expect, it, vi } from 'vitest';

import { getIssueCommentSummary } from './issues.js';

function rawComment(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-' + index,
    url: null,
    body: 'body ' + index,
    createdAt: '2026-07-24T18:32:04.000Z',
    updatedAt: '2026-07-24T18:32:04.000Z',
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

describe('issue view comment summary', () => {
  it('CMT-VIEW-LIMIT/JSON-SHAPE fetches an explicit 50 and preserves the embedded shape', async () => {
    const nodes = Array.from({ length: 50 }, (_, index) => rawComment(index + 1));
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: {
        issue: {
          comments: {
            edges: nodes.map(node => ({ cursor: 'cursor-' + node.id, node })),
            pageInfo: { hasNextPage: true, endCursor: 'cursor-comment-50' },
          },
        },
      },
    }));
    const result = await getIssueCommentSummary('issue-1', { rawRequest });
    expect(rawRequest).toHaveBeenCalledTimes(1);
    expect(rawRequest.mock.calls[0][1]).toEqual({
      targetId: 'issue-1',
      first: 50,
      after: null,
    });
    expect(result.comments).toHaveLength(50);
    expect(result.comments[0]).toEqual({
      id: 'comment-1',
      body: 'body 1',
      createdAt: '2026-07-24T18:32:04.000Z',
      updatedAt: '2026-07-24T18:32:04.000Z',
      user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    });
    expect(result.pageInfo).toMatchObject({
      hasNextPage: true,
      endCursor: 'cursor-comment-50',
      fetchedAll: false,
    });
  });

  it('CMT-VIEW-HUMAN-SHAPE maps non-user creators into the legacy display user', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => ({
      data: {
        issue: {
          comments: {
            edges: [{
              cursor: 'cursor-1',
              node: rawComment(1, {
                user: null,
                botActor: {
                  id: 'bot-1',
                  name: 'Linear Bot',
                  type: 'integration',
                  subType: null,
                  userDisplayName: null,
                  avatarUrl: null,
                },
              }),
            }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    }));
    const result = await getIssueCommentSummary('issue-1', { rawRequest });
    expect(result.comments[0].user.name).toBe('Linear Bot');
  });

  it('CMT-VIEW-ERROR propagates fetch failures instead of returning a false empty list', async () => {
    const rawRequest = vi.fn(async (_query: string, _variables: Record<string, unknown>) => {
      throw new Error('Linear unavailable');
    });
    await expect(getIssueCommentSummary('issue-1', { rawRequest })).rejects.toThrow(
      'Linear unavailable'
    );
  });
});
