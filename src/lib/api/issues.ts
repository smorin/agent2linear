import type {
  IssueCreateInput,
  IssueListFilters,
  IssueListItem,
  IssueUpdateInput,
  IssueViewData,
} from '../types.js';
import { getLinearClient, LinearClientError } from './client.js';

/**
 * Create a comment on an issue
 */
export async function createIssueComment(
  issueId: string,
  body: string
): Promise<{ id: string; body: string }> {
  try {
    const client = getLinearClient();
    const result = await client.createComment({ issueId, body });
    const comment = await result.comment;
    if (!comment) {
      throw new Error('Comment creation returned no comment');
    }
    return { id: comment.id, body: comment.body };
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new LinearClientError(
      `Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new issue (M15.1)
 * @param input - Issue creation data
 * @returns Created issue details
 */
export async function createIssue(input: IssueCreateInput): Promise<{
  id: string;
  identifier: string;
  title: string;
  url: string;
}> {
  try {
    const client = getLinearClient();

    // Create the issue with all provided fields
    const issue = await client.createIssue({
      title: input.title,
      teamId: input.teamId,
      description: input.description,
      descriptionData: input.descriptionData,
      priority: input.priority,
      estimate: input.estimate,
      stateId: input.stateId,
      assigneeId: input.assigneeId,
      subscriberIds: input.subscriberIds,
      projectId: input.projectId,
      cycleId: input.cycleId,
      parentId: input.parentId,
      labelIds: input.labelIds,
      dueDate: input.dueDate,
      templateId: input.templateId,
    });

    const createdIssue = await issue.issue;

    if (!createdIssue) {
      throw new Error('Issue creation failed - no issue returned');
    }

    return {
      id: createdIssue.id,
      identifier: createdIssue.identifier,
      title: createdIssue.title,
      url: createdIssue.url,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update an existing issue (M15.1)
 * @param issueId - Issue UUID
 * @param input - Issue update data
 * @returns Updated issue details
 */
export async function updateIssue(issueId: string, input: IssueUpdateInput): Promise<{
  id: string;
  identifier: string;
  title: string;
  url: string;
}> {
  try {
    const client = getLinearClient();

    // Update the issue with all provided fields
    const issue = await client.updateIssue(issueId, {
      title: input.title,
      description: input.description,
      descriptionData: input.descriptionData,
      priority: input.priority,
      estimate: input.estimate,
      stateId: input.stateId,
      assigneeId: input.assigneeId,
      subscriberIds: input.subscriberIds,
      teamId: input.teamId,
      projectId: input.projectId,
      cycleId: input.cycleId,
      parentId: input.parentId,
      labelIds: input.labelIds,
      dueDate: input.dueDate,
      trashed: input.trashed,
    });

    const updatedIssue = await issue.issue;

    if (!updatedIssue) {
      throw new Error('Issue update failed - no issue returned');
    }

    return {
      id: updatedIssue.id,
      identifier: updatedIssue.identifier,
      title: updatedIssue.title,
      url: updatedIssue.url,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get issue by UUID (M15.1)
 * @param issueId - Issue UUID
 * @returns Issue details or null if not found
 */
export async function getIssueById(issueId: string): Promise<{
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
} | null> {
  try {
    const client = getLinearClient();
    const issue = await client.issue(issueId);

    if (!issue) {
      return null;
    }

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || undefined,
      url: issue.url,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get issue by identifier (ENG-123 format) (M15.1)
 * @param identifier - Issue identifier (e.g., "ENG-123")
 * @returns Issue details or null if not found
 */
export async function getIssueByIdentifier(identifier: string): Promise<{
  id: string;
  identifier: string;
  title: string;
  url: string;
} | null> {
  try {
    // Use the issue resolver to convert identifier to UUID
    const { resolveIssueId } = await import('../issue-resolver.js');
    const issueId = await resolveIssueId(identifier);

    if (!issueId) {
      return null;
    }

    return await getIssueById(issueId);
  } catch (error) {
    return null;
  }
}

/**
 * Get all issues with comprehensive filtering and pagination (M15.5)
 *
 * PERFORMANCE CRITICAL: This function uses a custom GraphQL query to fetch
 * ALL issue data and relations in a SINGLE request to avoid N+1 query patterns.
 *
 * Pattern follows getAllProjects() optimization from M20/M21.
 *
 * @param filters - Optional filters for issues
 * @returns Array of issues with all display data
 */
export async function getAllIssues(filters?: IssueListFilters): Promise<IssueListItem[]> {
  try {
    const client = getLinearClient();
    const startTime = Date.now();

    // Track API call if tracking is enabled
    const { isTracking, logCall } = await import('../api-call-tracker.js');
    const tracking = isTracking();

    // ========================================
    // BUILD GRAPHQL FILTER
    // ========================================
    interface GraphQLDateFilter { gte?: string; lte?: string }
    const graphqlFilter: Record<string, unknown> & { createdAt?: GraphQLDateFilter; updatedAt?: GraphQLDateFilter } = {};

    if (filters?.teamId) {
      graphqlFilter.team = { id: { eq: filters.teamId } };
    }

    if (filters?.assigneeId) {
      graphqlFilter.assignee = { id: { eq: filters.assigneeId } };
    }

    if (filters?.projectId) {
      graphqlFilter.project = { id: { eq: filters.projectId } };
    }

    if (filters?.initiativeId) {
      graphqlFilter.initiative = { id: { eq: filters.initiativeId } };
    }

    if (filters?.stateId) {
      graphqlFilter.state = { id: { eq: filters.stateId } };
    }

    if (filters?.priority !== undefined) {
      graphqlFilter.priority = { eq: filters.priority };
    }

    if (filters?.parentId) {
      graphqlFilter.parent = { id: { eq: filters.parentId } };
    }

    if (filters?.cycleId) {
      graphqlFilter.cycle = { id: { eq: filters.cycleId } };
    }

    if (filters?.hasParent !== undefined) {
      graphqlFilter.parent = filters.hasParent ? { null: false } : { null: true };
    }

    if (filters?.labelIds && filters.labelIds.length > 0) {
      // Issues with ALL of these labels
      graphqlFilter.labels = { some: { id: { in: filters.labelIds } } };
    }

    if (filters?.search) {
      graphqlFilter.searchableContent = { contains: filters.search };
    }

    // Date range filters
    if (filters?.createdAfter || filters?.createdBefore) {
      graphqlFilter.createdAt = {};
      if (filters.createdAfter) graphqlFilter.createdAt.gte = new Date(filters.createdAfter).toISOString();
      if (filters.createdBefore) graphqlFilter.createdAt.lte = new Date(filters.createdBefore).toISOString();
    }

    if (filters?.updatedAfter || filters?.updatedBefore) {
      graphqlFilter.updatedAt = {};
      if (filters.updatedAfter) graphqlFilter.updatedAt.gte = new Date(filters.updatedAfter).toISOString();
      if (filters.updatedBefore) graphqlFilter.updatedAt.lte = new Date(filters.updatedBefore).toISOString();
    }

    // Handle status filters
    if (filters?.includeCompleted === false) {
      graphqlFilter.completedAt = { null: true };
    }

    if (filters?.includeCanceled === false) {
      graphqlFilter.canceledAt = { null: true };
    }

    if (filters?.includeArchived === false) {
      graphqlFilter.archivedAt = { null: true };
    }

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Issue filters:', JSON.stringify(graphqlFilter, null, 2));
    }

    // ========================================
    // PAGINATION SETUP (M15.5 Phase 1)
    // ========================================
    const pageSize = filters?.fetchAll ? 250 : Math.min(filters?.limit || 50, 250);
    const fetchAll = filters?.fetchAll || false;
    const targetLimit = filters?.limit || 50;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Pagination:', { pageSize, fetchAll, targetLimit });
    }

    // ========================================
    // CUSTOM GRAPHQL QUERY - ALL RELATIONS UPFRONT
    // ========================================
    const issuesQuery = `
      query GetIssues($filter: IssueFilter, $first: Int, $after: String) {
        issues(filter: $filter, first: $first, after: $after) {
          nodes {
            id
            identifier
            title
            description
            priority
            estimate
            dueDate
            createdAt
            updatedAt
            completedAt
            canceledAt
            archivedAt
            url

            assignee {
              id
              name
              email
            }

            team {
              id
              key
              name
            }

            state {
              id
              name
              type
            }

            project {
              id
              name
            }

            cycle {
              id
              name
              number
            }

            labels {
              nodes {
                id
                name
                color
              }
            }

            parent {
              id
              identifier
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // ========================================
    // PAGINATION LOOP (M15.5 Phase 1)
    // ========================================
    interface RawIssue {
      id: string;
      identifier: string;
      title: string;
      description?: string;
      priority?: number;
      estimate?: number;
      dueDate?: string;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
      canceledAt?: string;
      archivedAt?: string;
      url: string;
      assignee?: { id: string; name: string; email: string };
      team?: { id: string; key: string; name: string };
      state?: { id: string; name: string; type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' };
      project?: { id: string; name: string };
      cycle?: { id: string; name: string; number: number };
      labels?: { nodes: Array<{ id: string; name: string; color?: string }> };
      parent?: { id: string; identifier: string; title: string };
    }

    let rawIssues: RawIssue[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage && (fetchAll || rawIssues.length < targetLimit)) {
      pageCount++;

      const variables = {
        filter: Object.keys(graphqlFilter).length > 0 ? graphqlFilter : null,
        first: pageSize,
        after: cursor
      };

      const response = await client.client.rawRequest(issuesQuery, variables) as { data?: { issues?: { nodes?: RawIssue[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string } } } };

      // Track API call if tracking enabled
      if (tracking) {
        logCall('IssueList', 'query', 'main', Date.now() - startTime, variables);
      }

      const nodes = response.data?.issues?.nodes || [];
      const pageInfo = response.data?.issues?.pageInfo;

      rawIssues.push(...nodes);

      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Page ${pageCount}: fetched ${nodes.length} issues (total: ${rawIssues.length}, hasNextPage: ${hasNextPage})`);
      }

      // If not fetching all, stop when we have enough
      if (!fetchAll && rawIssues.length >= targetLimit) {
        break;
      }
    }

    // ========================================
    // TRUNCATION (M15.5 Phase 1)
    // ========================================
    if (!fetchAll && rawIssues.length > targetLimit) {
      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Truncating from ${rawIssues.length} to ${targetLimit} issues`);
      }
      rawIssues = rawIssues.slice(0, targetLimit);
    }

    // ========================================
    // SORTING (M15.5 Phase 3)
    // ========================================
    if (filters?.sortField && filters?.sortOrder) {
      const sortField = filters.sortField;
      const sortOrder = filters.sortOrder;
      const ascending = sortOrder === 'asc';

      rawIssues.sort((a: RawIssue, b: RawIssue) => {
        let aVal: number;
        let bVal: number;

        switch (sortField) {
          case 'priority':
            aVal = a.priority !== undefined && a.priority !== null ? a.priority : 999;
            bVal = b.priority !== undefined && b.priority !== null ? b.priority : 999;
            break;
          case 'created':
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
          case 'updated':
            aVal = new Date(a.updatedAt).getTime();
            bVal = new Date(b.updatedAt).getTime();
            break;
          case 'due':
            aVal = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            bVal = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            break;
          default:
            return 0;
        }

        // Apply sort order
        if (ascending) {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Sorted ${rawIssues.length} issues by ${sortField} ${sortOrder}`);
      }
    }

    // ========================================
    // BUILD FINAL ISSUE LIST
    // ========================================
    const issueList: IssueListItem[] = rawIssues.map((issue: RawIssue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || undefined,
      priority: issue.priority !== undefined ? issue.priority : undefined,
      estimate: issue.estimate || undefined,
      dueDate: issue.dueDate || undefined,

      assignee: issue.assignee ? {
        id: issue.assignee.id,
        name: issue.assignee.name,
        email: issue.assignee.email
      } : undefined,

      team: issue.team ? {
        id: issue.team.id,
        key: issue.team.key,
        name: issue.team.name
      } : undefined,

      state: issue.state ? {
        id: issue.state.id,
        name: issue.state.name,
        type: issue.state.type
      } : undefined,

      project: issue.project ? {
        id: issue.project.id,
        name: issue.project.name
      } : undefined,

      cycle: issue.cycle ? {
        id: issue.cycle.id,
        name: issue.cycle.name,
        number: issue.cycle.number
      } : undefined,

      labels: (issue.labels?.nodes || []).map((label: { id: string; name: string; color?: string }) => ({
        id: label.id,
        name: label.name,
        color: label.color || undefined
      })),

      parent: issue.parent ? {
        id: issue.parent.id,
        identifier: issue.parent.identifier,
        title: issue.parent.title
      } : undefined,

      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      completedAt: issue.completedAt || undefined,
      canceledAt: issue.canceledAt || undefined,
      archivedAt: issue.archivedAt || undefined,
      url: issue.url
    }));

    return issueList;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to get issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get issues assigned to the current user (M15.1)
 * Helper function for default list behavior
 * @returns Array of issues assigned to current user
 */
export async function getCurrentUserIssues(): Promise<Array<{
  id: string;
  identifier: string;
  title: string;
  priority?: number;
  url: string;
}>> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return await getAllIssues({
      assigneeId: viewer.id,
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to get current user issues: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get full issue details for display (M15.2)
 * Returns comprehensive issue data including relationships, metadata, and dates
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (11+ API calls -> 1 call)
 * Fetches all relationships upfront instead of lazy loading via SDK
 *
 * @param issueId - Issue UUID
 * @returns Full issue data or null if not found
 */
export async function getFullIssueById(issueId: string): Promise<IssueViewData | null> {
  try {
    const client = getLinearClient();

    // ========================================
    // CUSTOM GRAPHQL QUERY - ALL RELATIONS UPFRONT
    // ========================================
    const issueQuery = `
      query GetFullIssue($issueId: String!) {
        issue(id: $issueId) {
          id
          identifier
          title
          description
          url
          priority
          estimate
          dueDate
          createdAt
          updatedAt
          completedAt
          canceledAt
          archivedAt

          state {
            id
            name
            type
            color
          }

          team {
            id
            key
            name
          }

          assignee {
            id
            name
            email
          }

          project {
            id
            name
          }

          cycle {
            id
            name
            number
          }

          parent {
            id
            identifier
            title
          }

          children {
            nodes {
              id
              identifier
              title
              state {
                id
                name
              }
            }
          }

          labels {
            nodes {
              id
              name
              color
            }
          }

          subscribers {
            nodes {
              id
              name
              email
            }
          }

          creator {
            id
            name
            email
          }
        }
      }
    `;

    interface RawFullIssue {
      id: string;
      identifier: string;
      title: string;
      description?: string;
      url: string;
      priority?: number;
      estimate?: number;
      dueDate?: string;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
      canceledAt?: string;
      archivedAt?: string;
      state?: { id: string; name: string; type: string; color: string };
      team?: { id: string; key: string; name: string };
      assignee?: { id: string; name: string; email: string };
      project?: { id: string; name: string };
      cycle?: { id: string; name: string; number: number };
      parent?: { id: string; identifier: string; title: string };
      children: { nodes: Array<{ id: string; identifier: string; title: string; state?: { id: string; name: string } }> };
      labels: { nodes: Array<{ id: string; name: string; color: string }> };
      subscribers: { nodes: Array<{ id: string; name: string; email: string }> };
      creator?: { id: string; name: string; email: string };
    }

    const response = await client.client.rawRequest(issueQuery, { issueId }) as { data?: { issue?: RawFullIssue } };
    const issueData = response.data?.issue;

    if (!issueData) {
      return null;
    }

    // Map GraphQL response to IssueViewData (no awaits needed - all data already fetched!)
    return {
      // Core identification
      id: issueData.id,
      identifier: issueData.identifier,
      title: issueData.title,
      url: issueData.url,

      // Content
      description: issueData.description || undefined,

      // Workflow
      state: issueData.state
        ? {
            id: issueData.state.id,
            name: issueData.state.name,
            type: issueData.state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
            color: issueData.state.color,
          }
        : { id: '', name: 'Unknown', type: 'backlog' as const, color: '#95a2b3' },
      priority: issueData.priority,
      estimate: issueData.estimate || undefined,

      // Assignment
      assignee: issueData.assignee
        ? {
            id: issueData.assignee.id,
            name: issueData.assignee.name,
            email: issueData.assignee.email,
          }
        : undefined,
      subscribers: issueData.subscribers.nodes.map((sub: { id: string; name: string; email: string }) => ({
        id: sub.id,
        name: sub.name,
        email: sub.email,
      })),

      // Organization
      team: issueData.team
        ? {
            id: issueData.team.id,
            key: issueData.team.key,
            name: issueData.team.name,
          }
        : { id: '', key: '', name: 'Unknown' },
      project: issueData.project
        ? {
            id: issueData.project.id,
            name: issueData.project.name,
          }
        : undefined,
      cycle: issueData.cycle
        ? {
            id: issueData.cycle.id,
            name: issueData.cycle.name || `Cycle #${issueData.cycle.number}`,
            number: issueData.cycle.number,
          }
        : undefined,
      parent: issueData.parent
        ? {
            id: issueData.parent.id,
            identifier: issueData.parent.identifier,
            title: issueData.parent.title,
          }
        : undefined,
      children: issueData.children.nodes.map((child: { id: string; identifier: string; title: string; state?: { id: string; name: string } }) => ({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        state: child.state?.name || 'Unknown',
      })),
      labels: issueData.labels.nodes.map((label: { id: string; name: string; color: string }) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),

      // Dates
      createdAt: issueData.createdAt,
      updatedAt: issueData.updatedAt,
      completedAt: issueData.completedAt,
      canceledAt: issueData.canceledAt,
      dueDate: issueData.dueDate,
      archivedAt: issueData.archivedAt,

      // Creator
      creator: issueData.creator
        ? {
            id: issueData.creator.id,
            name: issueData.creator.name,
            email: issueData.creator.email,
          }
        : { id: '', name: 'Unknown', email: '' },
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get issue comments (M15.2)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (2 + N API calls -> 1 call)
 * Fetches all comment users upfront instead of lazy loading via SDK
 *
 * @param issueId - Issue UUID
 * @returns Array of comments
 */
export async function getIssueComments(issueId: string): Promise<
  Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>
> {
  try {
    const client = getLinearClient();

    // Custom GraphQL query - fetch comments with user data in one request
    const commentsQuery = `
      query GetIssueComments($issueId: String!) {
        issue(id: $issueId) {
          id
          comments {
            nodes {
              id
              body
              createdAt
              updatedAt
              user {
                id
                name
                email
              }
            }
          }
        }
      }
    `;

    interface RawComment {
      id: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      user?: { id: string; name: string; email: string };
    }

    const response = await client.client.rawRequest(commentsQuery, { issueId }) as { data?: { issue?: { id: string; comments?: { nodes: RawComment[] } } } };
    const issueData = response.data?.issue;

    if (!issueData || !issueData.comments) {
      return [];
    }

    return issueData.comments.nodes.map((comment: RawComment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user
        ? {
            id: comment.user.id,
            name: comment.user.name,
            email: comment.user.email,
          }
        : { id: '', name: 'Unknown', email: '' },
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Get issue history (M15.2)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (2 + 7N API calls -> 1 call)
 * Fetches all history relationships upfront instead of lazy loading via SDK
 *
 * @param issueId - Issue UUID
 * @returns Array of history entries
 */
export async function getIssueHistory(issueId: string): Promise<
  Array<{
    id: string;
    createdAt: string;
    actor?: {
      id: string;
      name: string;
      email: string;
    };
    fromState?: string;
    toState?: string;
    fromAssignee?: string;
    toAssignee?: string;
    addedLabels?: string[];
    removedLabels?: string[];
  }>
> {
  try {
    const client = getLinearClient();

    // Custom GraphQL query - fetch history with all relationships in one request
    const historyQuery = `
      query GetIssueHistory($issueId: String!) {
        issue(id: $issueId) {
          id
          history {
            nodes {
              id
              createdAt
              actor {
                id
                name
                email
              }
              fromState {
                id
                name
              }
              toState {
                id
                name
              }
              fromAssignee {
                id
                name
              }
              toAssignee {
                id
                name
              }
              addedLabels {
                id
                name
              }
              removedLabels {
                id
                name
              }
            }
          }
        }
      }
    `;

    interface RawHistoryEntry {
      id: string;
      createdAt: string;
      actor?: { id: string; name: string; email: string };
      fromState?: { id: string; name: string };
      toState?: { id: string; name: string };
      fromAssignee?: { id: string; name: string };
      toAssignee?: { id: string; name: string };
      addedLabels?: Array<{ id: string; name: string }>;
      removedLabels?: Array<{ id: string; name: string }>;
    }

    const response = await client.client.rawRequest(historyQuery, { issueId }) as { data?: { issue?: { id: string; history?: { nodes: RawHistoryEntry[] } } } };
    const issueData = response.data?.issue;

    if (!issueData || !issueData.history) {
      return [];
    }

    return issueData.history.nodes.map((entry: RawHistoryEntry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            name: entry.actor.name,
            email: entry.actor.email,
          }
        : undefined,
      fromState: entry.fromState?.name,
      toState: entry.toState?.name,
      fromAssignee: entry.fromAssignee?.name,
      toAssignee: entry.toAssignee?.name,
      addedLabels: entry.addedLabels ? entry.addedLabels.map((l: { id: string; name: string }) => l.name) : undefined,
      removedLabels: entry.removedLabels ? entry.removedLabels.map((l: { id: string; name: string }) => l.name) : undefined,
    }));
  } catch (error) {
    return [];
  }
}
