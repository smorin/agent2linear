import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaginationRuntimeError } from '../pagination.js';
import { getLinearClient } from './client.js';
import {
  getAllProjects,
  getProjectListPage,
  PROJECT_LIST_ORDER,
  PROJECT_LIST_PAGE_SIZE,
} from './projects.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

type RawRequest = ReturnType<typeof vi.fn>;

function rawProject(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    name,
    description: `${name} description`,
    content: `${name} content`,
    icon: 'icon',
    color: '#123456',
    state: 'started',
    priority: 2,
    startDate: '2026-07-01',
    targetDate: '2026-08-01',
    completedAt: null,
    url: `https://linear.app/project/${id}`,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    teams: { nodes: [{ id: 'team-1', name: 'Team', key: 'T' }] },
    lead: { id: 'lead-1', name: 'Lead', email: 'lead@example.com' },
    ...overrides,
  };
}

function projectPage(
  edges: Array<{ cursor: string; node: Record<string, unknown> }>,
  hasNextPage: boolean,
  endCursor: string | null
): Record<string, unknown> {
  return {
    data: {
      projects: {
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
  vi.clearAllMocks();
});

describe('getProjectListPage', () => {
  it('[CPH-API-PROJECT-ADAPTER][CPH-PAG-PROJECT-ORDER] uses edges, exact ordering, filters, and raw after', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        projectPage(
          [
            {
              cursor: 'edge-1',
              node: rawProject('project-1', 'Project one', {
                relations: {
                  nodes: [
                    {
                      id: 'relation-1',
                      type: 'dependency',
                      anchorType: 'end',
                      relatedAnchorType: 'start',
                      project: { id: 'project-1' },
                      relatedProject: { id: 'project-2' },
                    },
                  ],
                },
              }),
            },
          ],
          false,
          null
        )
      )
      .mockResolvedValueOnce({
        data: {
          project0: {
            id: 'project-1',
            labels: { nodes: [{ id: 'label-1', name: 'Label', color: '#abcdef' }] },
            members: {
              nodes: [{ id: 'member-1', name: 'Member', email: 'member@example.com' }],
            },
          },
        },
      });
    mockClient(rawRequest);

    const after = ' raw cursor /+=🙂 ';
    const result = await getProjectListPage(
      {
        teamId: 'team-1',
        initiativeId: 'initiative-1',
        statusId: 'status-1',
        priority: 2,
        leadId: 'lead-1',
        memberIds: ['member-1'],
        labelIds: ['label-1'],
        startDateAfter: '2026-01-01',
        startDateBefore: '2026-12-31',
        targetDateAfter: '2026-02-01',
        targetDateBefore: '2026-11-30',
        search: '  Project  ',
        includeDependencies: true,
      },
      { limit: 2, after }
    );

    expect(PROJECT_LIST_ORDER).toBe('updatedAt:desc');
    const [query, variables] = rawRequest.mock.calls[0];
    expect(query).toMatch(
      /projects\([\s\S]*sort:\s*\[\{\s*updatedAt:\s*\{\s*order:\s*Descending\s*\}\s*\}\]/
    );
    expect(query).toMatch(/edges\s*\{\s*cursor\s*node\s*\{/);
    expect(query).toContain('relations {');
    expect(variables).toEqual({
      filter: {
        accessibleTeams: { some: { id: { eq: 'team-1' } } },
        initiatives: { some: { id: { eq: 'initiative-1' } } },
        status: { id: { eq: 'status-1' } },
        priority: { eq: 2 },
        lead: { id: { eq: 'lead-1' } },
        members: { some: { id: { in: ['member-1'] } } },
        labels: { some: { id: { in: ['label-1'] } } },
        startDate: { gte: '2026-01-01', lte: '2026-12-31' },
        targetDate: { gte: '2026-02-01', lte: '2026-11-30' },
        or: [
          { name: { containsIgnoreCase: 'Project' } },
          { slugId: { containsIgnoreCase: 'Project' } },
          { searchableContent: { contains: 'Project' } },
        ],
      },
      includeArchived: false,
      first: 2,
      after,
    });
    expect(result.items[0]).toMatchObject({
      id: 'project-1',
      name: 'Project one',
      team: { id: 'team-1', name: 'Team', key: 'T' },
      lead: { id: 'lead-1', name: 'Lead', email: 'lead@example.com' },
      labels: [{ id: 'label-1', name: 'Label', color: '#abcdef' }],
      members: [{ id: 'member-1', name: 'Member', email: 'member@example.com' }],
      dependsOnCount: 1,
      blocksCount: 0,
    });
    expect(result.pageInfo).toEqual({
      returnedCount: 1,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    });
  });

  it('[CPH-API-PAGE-FILTER][CPH-PAG-LAST-EXAMINED] confirms a later match while preserving the returned cursor', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        projectPage(
          [
            { cursor: 'edge-1', node: rawProject('project-1', 'skip one') },
            { cursor: 'edge-2', node: rawProject('project-2', 'match one') },
          ],
          true,
          'edge-2'
        )
      )
      .mockResolvedValueOnce(
        projectPage(
          [
            { cursor: 'edge-3', node: rawProject('project-3', 'match two') },
            { cursor: 'edge-4', node: rawProject('project-4', 'match three') },
          ],
          false,
          null
        )
      );
    mockClient(rawRequest);
    const matches = vi.fn((project: { name: string }) => project.name.startsWith('match'));

    const result = await getProjectListPage({}, { limit: 2 }, matches);

    expect(result.items.map(project => project.id)).toEqual(['project-2', 'project-3']);
    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: true,
      endCursor: 'edge-3',
      fetchedAll: false,
    });
    expect(matches).toHaveBeenCalledTimes(4);
    expect(rawRequest.mock.calls.map(([, variables]) => variables.after)).toEqual([null, 'edge-2']);
  });

  it('[CPH-API-PROJECT-ADAPTER] preserves the fetch-all array wrapper', async () => {
    const rawRequest = vi
      .fn()
      .mockResolvedValueOnce(
        projectPage(
          [{ cursor: 'edge-1', node: rawProject('project-1', 'Project one') }],
          true,
          'edge-1'
        )
      )
      .mockResolvedValueOnce(
        projectPage(
          [{ cursor: 'edge-2', node: rawProject('project-2', 'Project two') }],
          false,
          null
        )
      );
    mockClient(rawRequest);

    const result = await getAllProjects({ fetchAll: true, limit: 1 });

    expect(result.map(project => project.id)).toEqual(['project-1', 'project-2']);
    expect(PROJECT_LIST_PAGE_SIZE).toBe(50);
    expect(rawRequest.mock.calls.map(([, variables]) => variables)).toMatchObject([
      { first: 50, after: null },
      { first: 50, after: 'edge-1' },
    ]);
  });

  it('[CPH-PAG-MISSING-END][CPH-API-PROJECT-ADAPTER] preserves typed malformed-page failures', async () => {
    const rawRequest = vi.fn().mockResolvedValue({
      data: { projects: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    });
    mockClient(rawRequest);

    const failure = getProjectListPage({}, { limit: 2 });

    await expect(failure).rejects.toBeInstanceOf(PaginationRuntimeError);
    await expect(failure).rejects.toMatchObject({ code: 'invalid_page', exitCode: 1 });
  });
});
