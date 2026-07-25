import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLinearClient } from './client.js';
import {
  getIssueLabelListPage,
  getProjectLabelListPage,
  restoreIssueLabel,
  restoreProjectLabel,
  retireIssueLabel,
  retireProjectLabel,
} from './labels.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

function rawLabel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: 'Label ' + id,
    color: '#5E6AD2',
    description: null,
    retiredAt: null,
    archivedAt: null,
    team: null,
    ...overrides,
  };
}

function page(
  resource: 'issueLabels' | 'projectLabels',
  nodes: Array<Record<string, unknown>>,
  hasNextPage: boolean,
  endCursor: string | null
) {
  return {
    data: {
      [resource]: {
        edges: nodes.map((node, index) => ({ cursor: 'edge-' + String(node.id ?? index), node })),
        pageInfo: { hasNextPage, endCursor },
      },
    },
  };
}

function mockClient(overrides: Record<string, unknown>) {
  vi.mocked(getLinearClient).mockReturnValue(
    overrides as unknown as ReturnType<typeof getLinearClient>
  );
}

afterEach(() => vi.clearAllMocks());

describe('M33 label pagination API', () => {
  it('[LPL-API-ISSUE-PAGE][LPL-API-FIELDS] selects edges and preserves retiredAt/archivedAt independently', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValue(
        page(
          'issueLabels',
          [
            rawLabel('a', { retiredAt: '2026-07-01T00:00:00.000Z' }),
            rawLabel('b', { archivedAt: '2026-07-02T00:00:00.000Z', team: { id: 'team-1' } }),
          ],
          false,
          null
        )
      );
    mockClient({ client: { rawRequest } });

    const result = await getIssueLabelListPage(
      { teamId: 'team-1', includeRetired: true },
      { limit: 2 }
    );

    expect(result.items).toEqual([
      expect.objectContaining({ id: 'a', retiredAt: '2026-07-01T00:00:00.000Z', archivedAt: null }),
      expect.objectContaining({
        id: 'b',
        retiredAt: null,
        archivedAt: '2026-07-02T00:00:00.000Z',
        teamId: 'team-1',
      }),
    ]);
    const [query, variables] = rawRequest.mock.calls[0];
    expect(query).toContain('issueLabels(');
    expect(query).toMatch(/edges\s*\{\s*cursor\s*node\s*\{/);
    expect(query).toContain('retiredAt');
    expect(query).toContain('archivedAt');
    expect(variables).toMatchObject({ first: 2, after: null, includeArchived: false });
  });

  it('[LPL-API-ACTIVE-FILTER][LPL-API-PAGE-CURSOR] fills a bounded active result across pages using the last examined edge', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          'issueLabels',
          [rawLabel('retired', { retiredAt: '2026-07-01T00:00:00.000Z' })],
          true,
          'backend-1'
        )
      )
      .mockResolvedValueOnce(page('issueLabels', [rawLabel('active')], true, 'backend-2'));
    mockClient({ client: { rawRequest } });

    const result = await getIssueLabelListPage({}, { limit: 1 });

    expect(result.items.map(label => label.id)).toEqual(['active']);
    expect(result.pageInfo).toMatchObject({ hasNextPage: true, endCursor: 'edge-active' });
    expect(rawRequest.mock.calls.map(([, variables]) => variables.after)).toEqual([
      null,
      'backend-1',
    ]);
  });

  it('[LPL-API-PROJECT-PAGE][LPL-API-PROJECT-CATALOG] uses one top-level catalog connection for bounded and all traversal', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(page('projectLabels', [rawLabel('applied')], true, 'p1'))
      .mockResolvedValueOnce(page('projectLabels', [rawLabel('unused')], false, null));
    mockClient({ client: { rawRequest } });

    const result = await getProjectLabelListPage({ includeRetired: true }, { fetchAll: true });

    expect(result.items.map(label => label.id)).toEqual(['applied', 'unused']);
    expect(rawRequest.mock.calls).toHaveLength(2);
    for (const [query, variables] of rawRequest.mock.calls) {
      expect(query).toContain('projectLabels(');
      expect(query).not.toContain('organization');
      expect(query).not.toContain('lastAppliedAt');
      expect(variables.includeArchived).toBe(false);
    }
  });

  it('[LPL-API-COLOR-FILTER] fills the requested color bound without reordering matches', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        page('projectLabels', [rawLabel('skip', { color: '#000000' })], true, 'p1')
      )
      .mockResolvedValueOnce(
        page('projectLabels', [rawLabel('match', { color: '#ABCDEF' })], false, null)
      );
    mockClient({ client: { rawRequest } });

    const result = await getProjectLabelListPage({ color: '#abcdef' }, { limit: 1 });
    expect(result.items.map(label => label.id)).toEqual(['match']);
  });
});

describe('M33 label lifecycle API', () => {
  it.each([
    ['issue retire', retireIssueLabel, 'issueLabelRetire', 'issueLabels'],
    ['issue restore', restoreIssueLabel, 'issueLabelRestore', 'issueLabels'],
    ['project retire', retireProjectLabel, 'projectLabelRetire', 'projectLabels'],
    ['project restore', restoreProjectLabel, 'projectLabelRestore', 'projectLabels'],
  ] as const)(
    '[LPL-API-LIFECYCLE] %s uses the pinned SDK mutation and raw post-read',
    async (_name, operation, method, resource) => {
      const mutation = vi.fn().mockResolvedValue({ success: true });
      const singularResource = resource === 'issueLabels' ? 'issueLabel' : 'projectLabel';
      const rawRequest = vi.fn().mockResolvedValue({
        data: { [singularResource]: rawLabel('label-1') },
      });
      mockClient({ [method]: mutation, client: { rawRequest } });

      const result = await operation('label-1');

      expect(mutation).toHaveBeenCalledWith('label-1');
      expect(result.id).toBe('label-1');
      expect(rawRequest).toHaveBeenCalledOnce();
    }
  );
});
