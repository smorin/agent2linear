const realFetch = globalThis.fetch;

function json(data) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (!url.startsWith('http')) return realFetch(input, init);
  if (url !== 'https://api.linear.app/graphql') {
    throw new Error(`unexpected network request: ${url}`);
  }

  const body = JSON.parse(String(init.body));
  const query = String(body.query ?? '');

  if (query.includes('query GetIssues')) {
    return json({
      issues: {
        edges: [
          {
            cursor: 'issue-cursor',
            node: {
              id: 'issue\r1',
              identifier: 'ENG\t101',
              title: 'Title\rrow',
              description: 'first\tsecond\rthird\nfourth',
              priority: 2,
              estimate: null,
              dueDate: '2026-08-01\r',
              createdAt: '2026-07-26T00:00:00.000Z',
              updatedAt: '2026-07-26T00:00:00.000Z',
              completedAt: null,
              canceledAt: null,
              archivedAt: null,
              url: 'https://linear.app/issue\n/ENG-101',
              assignee: { id: 'user-1', name: 'User\rName', email: 'user\t@example.com' },
              team: { id: 'team-1', key: 'E\rNG', name: 'Engineering' },
              state: { id: 'state-1', name: 'In\nProgress', type: 'started' },
              project: null,
              cycle: null,
              labels: { nodes: [] },
              parent: null,
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: 'issue-cursor' },
      },
    });
  }

  if (query.includes('query GetMinimalProjects')) {
    return json({
      projects: {
        edges: [
          {
            cursor: 'project-cursor',
            node: {
              id: 'project\r1',
              name: 'Project\tone',
              description: 'first\tsecond\rthird\nfourth',
              content: null,
              icon: null,
              color: null,
              state: 'fallback\nstate',
              priority: 2,
              startDate: null,
              targetDate: null,
              completedAt: null,
              url: 'https://linear.app/project\n/project-1',
              createdAt: '2026-07-26T00:00:00.000Z',
              updatedAt: '2026-07-26T00:00:00.000Z',
              teams: { nodes: [{ id: 'team-1', key: 'PLT', name: 'Platform\nTeam' }] },
              lead: { id: 'user-1', name: 'Lead\tName', email: 'lead@example.com' },
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: 'project-cursor' },
      },
    });
  }

  throw new Error('unexpected Linear GraphQL operation in M36 TSV fixture');
};
