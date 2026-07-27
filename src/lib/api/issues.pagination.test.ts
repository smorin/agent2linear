import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureDiagnostics, resetDiagnostics } from '../logger.js';
import { PaginationInputError, PaginationRuntimeError } from '../pagination.js';
import { getLinearClient } from './client.js';
import { getAllIssues, getIssueListPage } from './issues.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

type RawRequest = ReturnType<typeof vi.fn>;

function rawIssue(
  id: string,
  identifier: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    identifier,
    title: `Issue ${identifier}`,
    description: `${identifier} description`,
    priority: 2,
    estimate: 3,
    dueDate: '2026-08-01',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    completedAt: null,
    canceledAt: null,
    archivedAt: null,
    url: `https://linear.app/issue/${identifier}`,
    assignee: { id: 'user-1', name: 'User', email: 'user@example.com' },
    team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
    state: { id: 'state-1', name: 'In Progress', type: 'started' },
    project: { id: 'project-1', name: 'Project' },
    cycle: { id: 'cycle-1', name: 'Cycle', number: 7 },
    labels: { nodes: [{ id: 'label-1', name: 'Label', color: '#abcdef' }] },
    parent: { id: 'parent-1', identifier: 'ENG-1', title: 'Parent' },
    ...overrides,
  };
}

function issuePage(
  edges: Array<{ cursor: string; node: Record<string, unknown> }>,
  hasNextPage: boolean,
  endCursor: string | null
): Record<string, unknown> {
  return {
    data: {
      issues: {
        edges,
        pageInfo: { hasNextPage, endCursor },
      },
    },
  };
}

function mockClient(rawRequest: RawRequest): void {
  vi.mocked(getLinearClient).mockReturnValue({
    client: { rawRequest },
  } as unknown as ReturnType<typeof getLinearClient>);
}

afterEach(() => {
  resetDiagnostics();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('getIssueListPage', () => {
  it('emits only allowlisted level-two request/page metadata', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    configureDiagnostics({ verbosity: 2 });
    const rawRequest = vi.fn().mockResolvedValue({
      ...issuePage([], false, null),
      headers: new Headers({ 'x-request-id': 'req-success' }),
      status: 207,
    });
    mockClient(rawRequest);

    await getIssueListPage(
      { search: 'private-filter-value' },
      { after: 'private-cursor-value', limit: 1 }
    );

    const rendered = stderr.mock.calls.flat().join(' ');
    expect(rendered).toContain('[request] method=POST');
    expect(rendered).toContain('status=207');
    expect(rendered).toContain('requestId=req-success');
    expect(rendered).toContain('pageCount=1');
    expect(rendered).not.toContain('private-filter-value');
    expect(rendered).not.toContain('private-cursor-value');
  });

  it('emits allowlisted request metadata when transport rejects', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    configureDiagnostics({ verbosity: 2 });
    const failure = Object.assign(new Error('private-provider-message'), {
      status: 503,
      raw: {
        response: {
          headers: new Headers({ 'x-request-id': 'req-failure' }),
          status: 503,
        },
      },
      query: 'private-query-value',
      variables: { secret: 'private-variable-value' },
    });
    const rawRequest = vi.fn().mockRejectedValue(failure);
    mockClient(rawRequest);

    await expect(
      getIssueListPage({ search: 'private-filter-value' }, { after: 'private-cursor-value' })
    ).rejects.toThrow();

    const rendered = stderr.mock.calls.flat().join(' ');
    expect(rendered).toContain('status=503');
    expect(rendered).toContain('requestId=req-failure');
    expect(rendered).not.toContain('private-provider-message');
    expect(rendered).not.toContain('private-query-value');
    expect(rendered).not.toContain('private-variable-value');
    expect(rendered).not.toContain('private-filter-value');
    expect(rendered).not.toContain('private-cursor-value');
  });

  it('[CPH-API-ISSUE-ADAPTER] uses edges, preserves filters and raw after, and maps relations', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValue(
        issuePage([{ cursor: 'edge-1', node: rawIssue('issue-1', 'ENG-101') }], false, null)
      );
    mockClient(rawRequest);

    const after = ' raw cursor /+=🙂 ';
    const result = await getIssueListPage(
      {
        teamId: 'team-1',
        assigneeId: 'user-1',
        projectId: 'project-1',
        initiativeId: 'initiative-1',
        stateId: 'state-1',
        priority: 2,
        parentId: 'parent-1',
        cycleId: 'cycle-1',
        hasParent: true,
        labelIds: ['label-1'],
        search: 'reconnect',
        createdAfter: '2026-01-01',
        createdBefore: '2026-12-31',
        updatedAfter: '2026-02-01',
        updatedBefore: '2026-11-30',
        includeCompleted: false,
        includeCanceled: false,
        includeArchived: false,
        sortField: 'priority',
        sortOrder: 'desc',
      },
      { limit: 2, after }
    );

    const [query, variables] = rawRequest.mock.calls[0];
    expect(query).toMatch(/query GetIssues\([^)]*\$sort:\s*\[IssueSortInput!\]/);
    expect(query).toMatch(/issues\([^)]*sort:\s*\$sort/);
    expect(query).toMatch(/edges\s*\{\s*cursor\s*node\s*\{/);
    expect(variables).toEqual({
      filter: {
        team: { id: { eq: 'team-1' } },
        assignee: { id: { eq: 'user-1' } },
        project: { id: { eq: 'project-1' } },
        initiative: { id: { eq: 'initiative-1' } },
        state: { id: { eq: 'state-1' } },
        priority: { eq: 2 },
        parent: { null: false },
        cycle: { id: { eq: 'cycle-1' } },
        labels: { some: { id: { in: ['label-1'] } } },
        searchableContent: { contains: 'reconnect' },
        createdAt: {
          gte: '2026-01-01T00:00:00.000Z',
          lte: '2026-12-31T00:00:00.000Z',
        },
        updatedAt: {
          gte: '2026-02-01T00:00:00.000Z',
          lte: '2026-11-30T00:00:00.000Z',
        },
        completedAt: { null: true },
        canceledAt: { null: true },
        archivedAt: { null: true },
      },
      first: 2,
      after,
      sort: [{ priority: { order: 'Descending', noPriorityFirst: true } }],
    });
    expect(result.orderBy).toEqual({ field: 'priority', direction: 'desc' });
    expect(result.items[0]).toMatchObject({
      id: 'issue-1',
      identifier: 'ENG-101',
      assignee: { id: 'user-1', name: 'User', email: 'user@example.com' },
      team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
      state: { id: 'state-1', name: 'In Progress', type: 'started' },
      project: { id: 'project-1', name: 'Project' },
      cycle: { id: 'cycle-1', name: 'Cycle', number: 7 },
      labels: [{ id: 'label-1', name: 'Label', color: '#abcdef' }],
      parent: { id: 'parent-1', identifier: 'ENG-1', title: 'Parent' },
    });
    expect(result.pageInfo).toEqual({
      returnedCount: 1,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    });
  });

  it.each([
    ['priority', 'asc', { priority: { order: 'Ascending', noPriorityFirst: false } }],
    ['priority', 'desc', { priority: { order: 'Descending', noPriorityFirst: true } }],
    ['created', 'asc', { createdAt: { order: 'Ascending' } }],
    ['created', 'desc', { createdAt: { order: 'Descending' } }],
    ['updated', 'asc', { updatedAt: { order: 'Ascending' } }],
    ['updated', 'desc', { updatedAt: { order: 'Descending' } }],
    ['due', 'asc', { dueDate: { order: 'Ascending', nulls: 'last' } }],
    ['due', 'desc', { dueDate: { order: 'Descending', nulls: 'first' } }],
  ] as const)(
    '[CPH-PAG-ISSUE-ORDER] maps %s %s to Linear sort input',
    async (sortField, sortOrder, expectedSort) => {
      const rawRequest = vi.fn().mockResolvedValue(issuePage([], false, null));
      mockClient(rawRequest);

      const result = await getIssueListPage({ sortField, sortOrder });

      expect(rawRequest.mock.calls[0][1].sort).toEqual([expectedSort]);
      expect(result.orderBy).toEqual({ field: sortField, direction: sortOrder });
    }
  );

  it('[CPH-PAG-ISSUE-ORDER] declares provider-default ordering when no explicit sort is requested', async () => {
    const rawRequest = vi.fn().mockResolvedValue(issuePage([], false, null));
    mockClient(rawRequest);

    const result = await getIssueListPage();

    expect(rawRequest.mock.calls[0][1].sort).toBeNull();
    expect(result.orderBy).toEqual({ field: 'provider-default', direction: null });
  });

  it('[CPH-PAG-ISSUE-ORDER] preserves Linear edge order without client-side resorting', async () => {
    const rawRequest = vi.fn().mockResolvedValue(
      issuePage(
        [
          { cursor: 'edge-1', node: rawIssue('issue-1', 'ENG-1', { priority: 1 }) },
          { cursor: 'edge-2', node: rawIssue('issue-2', 'ENG-2', { priority: 4 }) },
        ],
        false,
        null
      )
    );
    mockClient(rawRequest);

    const result = await getIssueListPage({ sortField: 'priority', sortOrder: 'desc' });

    expect(result.items.map(issue => issue.id)).toEqual(['issue-1', 'issue-2']);
  });

  it('[CPH-API-ISSUE-ADAPTER] preserves the fetch-all array wrapper', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        issuePage([{ cursor: 'edge-1', node: rawIssue('issue-1', 'ENG-1') }], true, 'edge-1')
      )
      .mockResolvedValueOnce(
        issuePage([{ cursor: 'edge-2', node: rawIssue('issue-2', 'ENG-2') }], false, null)
      );
    mockClient(rawRequest);

    const result = await getAllIssues({ fetchAll: true, limit: 1 });

    expect(result.map(issue => issue.id)).toEqual(['issue-1', 'issue-2']);
    expect(rawRequest.mock.calls.map(([, variables]) => variables)).toMatchObject([
      { first: 250, after: null },
      { first: 250, after: 'edge-1' },
    ]);
  });

  it('[CPH-PAG-MISSING-END][CPH-API-ISSUE-ADAPTER] preserves typed malformed-page failures', async () => {
    const rawRequest = vi.fn().mockResolvedValue({
      data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    });
    mockClient(rawRequest);

    const failure = getIssueListPage({}, { limit: 2 });

    await expect(failure).rejects.toBeInstanceOf(PaginationRuntimeError);
    await expect(failure).rejects.toMatchObject({ code: 'invalid_page', exitCode: 1 });
  });

  it('[CPH-PAG-REPEATED][CPH-API-ISSUE-ADAPTER] preserves typed repeated-cursor failures', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(issuePage([], true, 'same-cursor'))
      .mockResolvedValueOnce(issuePage([], true, 'same-cursor'));
    mockClient(rawRequest);

    const failure = getIssueListPage({}, { fetchAll: true });

    await expect(failure).rejects.toBeInstanceOf(PaginationRuntimeError);
    await expect(failure).rejects.toMatchObject({ code: 'repeated_cursor', exitCode: 1 });
  });

  it('[CPH-PAG-CURSOR-RAW] preserves typed empty-cursor input failures before transport', async () => {
    const rawRequest = vi.fn();
    mockClient(rawRequest);

    const failure = getIssueListPage({}, { after: '' });

    await expect(failure).rejects.toBeInstanceOf(PaginationInputError);
    await expect(failure).rejects.toMatchObject({ code: 'empty_cursor', exitCode: 2 });
    expect(rawRequest).not.toHaveBeenCalled();
  });
});
