import { LinearClient as SDKClient } from '@linear/sdk';
import { getApiKey } from './config.js';
import type {
  ProjectListFilters,
  ProjectListItem,
  ProjectRelation,
  ProjectRelationCreateInput,
  IssueCreateInput,
  IssueUpdateInput,
  IssueListFilters,
  IssueListItem,
  IssueViewData,
} from './types.js';
import { getRelationDirection } from './parsers.js';

export class LinearClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearClientError';
  }
}

/**
 * Get authenticated Linear client
 */
export function getLinearClient(): SDKClient {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new LinearClientError(
      'Linear API key not found. Please set LINEAR_API_KEY environment variable or configure it using the config file.'
    );
  }

  // Validate API key format (Linear API keys start with "lin_api_")
  if (!apiKey.startsWith('lin_api_')) {
    throw new LinearClientError(
      'Invalid Linear API key format. API keys should start with "lin_api_"'
    );
  }

  return new SDKClient({ apiKey });
}

/**
 * Test the Linear API connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  user?: { name: string; email: string };
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      success: true,
      user: {
        name: viewer.name,
        email: viewer.email,
      },
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
    };
  } catch (error) {
    throw new LinearClientError(
      `Failed to get current user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate API key by testing connection
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new SDKClient({ apiKey });
    await client.viewer;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate initiative ID exists and return its details
 */
export async function validateInitiativeExists(
  initiativeId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const initiative = await cache.findInitiativeById(initiativeId);

    if (!initiative) {
      return {
        valid: false,
        error: `Initiative with ID "${initiativeId}" not found`,
      };
    }

    return {
      valid: true,
      name: initiative.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        valid: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate initiative',
    };
  }
}

/**
 * Validate team ID exists and return its details
 */
export async function validateTeamExists(
  teamId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const team = await cache.findTeamById(teamId);

    if (!team) {
      return {
        valid: false,
        error: `Team with ID "${teamId}" not found`,
      };
    }

    return {
      valid: true,
      name: team.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        valid: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate team',
    };
  }
}

/**
 * Initiative data structure
 */
export interface Initiative {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

/**
 * Team data structure
 */
export interface Team {
  id: string;
  name: string;
  description?: string;
  key: string;
}

/**
 * Project data structure (for listing/selection)
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

/**
 * Member/User data structure
 */
export interface Member {
  id: string;
  name: string;
  email: string;
  active: boolean;
  admin: boolean;
  avatarUrl?: string;
  displayName?: string;
}

/**
 * Get all initiatives from Linear
 */
export async function getAllInitiatives(): Promise<Initiative[]> {
  try {
    const client = getLinearClient();
    const initiatives = await client.initiatives();

    const result: Initiative[] = [];
    for await (const initiative of initiatives.nodes) {
      result.push({
        id: initiative.id,
        name: initiative.name,
        description: initiative.description,
      });
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch initiatives: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single initiative by ID
 */
export async function getInitiativeById(
  initiativeId: string
): Promise<{ id: string; name: string; description?: string; url: string } | null> {
  try {
    const client = getLinearClient();
    const initiative = await client.initiative(initiativeId);

    if (!initiative) {
      return null;
    }

    return {
      id: initiative.id,
      name: initiative.name,
      description: initiative.description || undefined,
      url: initiative.url,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch initiative: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all teams from Linear
 */
export async function getAllTeams(): Promise<Team[]> {
  try {
    const client = getLinearClient();
    const teams = await client.teams();

    const result: Team[] = [];
    for await (const team of teams.nodes) {
      result.push({
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        key: team.key,
      });
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch teams: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single team by ID
 */
export async function getTeamById(
  teamId: string
): Promise<{ id: string; name: string; key: string; description?: string; url: string } | null> {
  try {
    const client = getLinearClient();
    const team = await client.team(teamId);

    if (!team) {
      return null;
    }

    return {
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description || undefined,
      url: `https://linear.app/team/${team.key.toLowerCase()}`,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch team: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all members from Linear organization
 * @param options - Optional filtering options
 */
export async function getAllMembers(options?: {
  teamId?: string;
  activeOnly?: boolean;
  inactiveOnly?: boolean;
  adminOnly?: boolean;
  nameFilter?: string;
  emailFilter?: string;
}): Promise<Member[]> {
  try {
    const client = getLinearClient();

    // If team filter is specified, get team members
    if (options?.teamId) {
      const team = await client.team(options.teamId);
      if (!team) {
        throw new Error(`Team with ID "${options.teamId}" not found`);
      }
      const teamMembers = await team.members();

      const result: Member[] = [];
      for await (const member of teamMembers.nodes) {
        result.push({
          id: member.id,
          name: member.name,
          email: member.email,
          active: member.active,
          admin: member.admin,
          avatarUrl: member.avatarUrl || undefined,
          displayName: member.displayName || undefined,
        });
      }

      // Apply additional filters
      return applyMemberFilters(result, options);
    }

    // Otherwise get all organization users
    const users = await client.users();

    const result: Member[] = [];
    for await (const user of users.nodes) {
      result.push({
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        admin: user.admin,
        avatarUrl: user.avatarUrl || undefined,
        displayName: user.displayName || undefined,
      });
    }

    // Apply filters and sort
    const filtered = applyMemberFilters(result, options);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch members: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Apply filters to member list
 */
function applyMemberFilters(
  members: Member[],
  options?: {
    activeOnly?: boolean;
    inactiveOnly?: boolean;
    adminOnly?: boolean;
    nameFilter?: string;
    emailFilter?: string;
  }
): Member[] {
  let filtered = members;

  // Filter by active status
  if (options?.activeOnly) {
    filtered = filtered.filter(m => m.active);
  } else if (options?.inactiveOnly) {
    filtered = filtered.filter(m => !m.active);
  }

  // Filter by admin status
  if (options?.adminOnly) {
    filtered = filtered.filter(m => m.admin);
  }

  // Filter by name (case-insensitive partial match)
  if (options?.nameFilter) {
    const nameLower = options.nameFilter.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(nameLower) ||
      (m.displayName && m.displayName.toLowerCase().includes(nameLower))
    );
  }

  // Filter by email (case-insensitive partial match)
  if (options?.emailFilter) {
    const emailLower = options.emailFilter.toLowerCase();
    filtered = filtered.filter(m => m.email.toLowerCase().includes(emailLower));
  }

  return filtered;
}

/**
 * Get a single member by ID
 */
export async function getMemberById(
  userId: string
): Promise<{ id: string; name: string; email: string; active: boolean; admin: boolean } | null> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const member = await cache.findMemberById(userId);

    if (!member) {
      return null;
    }

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      active: member.active,
      admin: member.admin,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch member: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get member by exact email match (case-insensitive)
 */
export async function getMemberByEmail(email: string): Promise<Member | null> {
  try {
    // Use entity cache instead of fetching all members
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const member = await cache.findMemberByEmail(email);
    return member;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to search member by email: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search members by email or name filter
 * Returns array of matching members (active members only by default)
 */
export async function searchMembers(options: {
  emailFilter?: string;
  nameFilter?: string;
  activeOnly?: boolean;
}): Promise<Member[]> {
  try {
    return await getAllMembers({
      emailFilter: options.emailFilter,
      nameFilter: options.nameFilter,
      activeOnly: options.activeOnly !== false, // Default to true
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to search members: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get member by display name (M15.1)
 * Returns single member or throws error for disambiguation if multiple matches
 *
 * @param displayName - The display name to search for (case-insensitive)
 * @returns Member details or null if not found
 * @throws Error if multiple members match (requires disambiguation)
 */
export async function getMemberByDisplayName(displayName: string): Promise<Member | null> {
  try {
    // Use entity cache to get all members
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const members = await cache.getMembers();

    // Filter by display name (case-insensitive exact match)
    const normalizedName = displayName.trim().toLowerCase();
    const matches = members.filter(m =>
      m.displayName?.toLowerCase() === normalizedName ||
      m.name.toLowerCase() === normalizedName
    );

    if (matches.length === 0) {
      return null;
    }

    if (matches.length === 1) {
      return matches[0];
    }

    // Multiple matches - require disambiguation
    const matchList = matches.map(m => `  - ${m.name} (${m.email})`).join('\n');
    throw new Error(
      `Multiple users match "${displayName}":\n${matchList}\n\nPlease use email or ID to specify which user.`
    );
  } catch (error) {
    // Re-throw disambiguation errors
    if (error instanceof Error && error.message.includes('Multiple users match')) {
      throw error;
    }

    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to search member by display name: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Resolve a member identifier (ID, alias, email, or display name) to a member (M15.1 Enhanced)
 * Tries multiple lookup strategies in order:
 * 1. Alias resolution (if configured)
 * 2. Direct ID lookup (if looks like a UUID)
 * 3. Email lookup (if contains @)
 * 4. Display name lookup (fallback)
 *
 * @param identifier - The member identifier (ID, alias, email, or display name)
 * @param resolveAliasFn - Optional alias resolver function
 * @returns Member details or null if not found
 * @throws Error if display name matches multiple users (disambiguation required)
 */
export async function resolveMemberIdentifier(
  identifier: string,
  resolveAliasFn?: (type: 'member', value: string) => string
): Promise<{ id: string; name: string; email: string } | null> {
  try {
    const trimmedId = identifier.trim();

    // Try alias resolution first (if resolver provided)
    let resolvedId = trimmedId;
    if (resolveAliasFn) {
      const aliasResolved = resolveAliasFn('member', trimmedId);
      if (aliasResolved !== trimmedId) {
        resolvedId = aliasResolved;
        // Alias was found, now validate the resolved ID
        const member = await getMemberById(resolvedId);
        if (member) {
          return member;
        }
      }
    }

    // Try direct ID lookup if it looks like a UUID
    // Linear UUIDs are lowercase hex with dashes (e.g., "a1b2c3d4-...")
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(resolvedId)) {
      const member = await getMemberById(resolvedId);
      if (member) {
        return member;
      }
    }

    // Try email lookup if it contains @
    if (trimmedId.includes('@')) {
      const member = await getMemberByEmail(trimmedId);
      if (member) {
        return {
          id: member.id,
          name: member.name,
          email: member.email,
        };
      }
    }

    // Try display name lookup as fallback (M15.1)
    // This may throw an error if multiple matches (disambiguation required)
    const memberByName = await getMemberByDisplayName(trimmedId);
    if (memberByName) {
      return {
        id: memberByName.id,
        name: memberByName.name,
        email: memberByName.email,
      };
    }

    // Not found by any method
    return null;
  } catch (error) {
    // Re-throw disambiguation errors so caller can show them to user
    if (error instanceof Error && error.message.includes('Multiple users match')) {
      throw error;
    }

    // For other errors, return null
    // The caller will handle the error messaging
    return null;
  }
}

/**
 * Get cycle by ID (M15.1)
 * @param cycleId - Cycle UUID
 * @returns Cycle details or null if not found
 */
export async function getCycleById(cycleId: string): Promise<{
  id: string;
  name: string;
  number: number;
  startsAt?: string;
  endsAt?: string;
} | null> {
  try {
    const client = getLinearClient();
    const cycle = await client.cycle(cycleId);

    if (!cycle) {
      return null;
    }

    return {
      id: cycle.id,
      name: cycle.name || `Cycle #${cycle.number}`,
      number: cycle.number,
      startsAt: cycle.startsAt?.toString(),
      endsAt: cycle.endsAt?.toString(),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Resolve cycle identifier (UUID or alias) to cycle ID (M15.1)
 * Supports both UUID format and alias resolution via the alias system
 *
 * @param identifier - Cycle ID (UUID) or alias
 * @param resolveAliasFn - Optional alias resolver function
 * @returns Cycle ID (UUID) or null if not found
 */
export async function resolveCycleIdentifier(
  identifier: string,
  resolveAliasFn?: (type: 'cycle', value: string) => string
): Promise<string | null> {
  try {
    const trimmedId = identifier.trim();

    // Try alias resolution first (if resolver provided)
    let resolvedId = trimmedId;
    if (resolveAliasFn) {
      const aliasResolved = resolveAliasFn('cycle', trimmedId);
      if (aliasResolved !== trimmedId) {
        resolvedId = aliasResolved;
        // Alias was found, now validate the resolved ID
        const cycle = await getCycleById(resolvedId);
        if (cycle) {
          return cycle.id;
        }
      }
    }

    // Try direct ID lookup if it looks like a UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(resolvedId)) {
      const cycle = await getCycleById(resolvedId);
      if (cycle) {
        return cycle.id;
      }
    }

    // Not found by any method
    return null;
  } catch (error) {
    return null;
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
    const { resolveIssueId } = await import('./issue-resolver.js');
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
 * Get all issues with optional filtering (M15.1)
 * @param filters - Optional filters for issues
 * @returns Array of issues matching the filters
 */
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
    const { isTracking, logCall } = await import('./api-call-tracker.js');
    const tracking = isTracking();

    // ========================================
    // BUILD GRAPHQL FILTER
    // ========================================
    const graphqlFilter: any = {};

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
    // Determine page size based on fetchAll flag:
    // - If --all: use 250 (max) for optimal performance (5x faster)
    // - Otherwise: use limit (capped at 250)
    const pageSize = filters?.fetchAll ? 250 : Math.min(filters?.limit || 50, 250);
    const fetchAll = filters?.fetchAll || false;
    const targetLimit = filters?.limit || 50;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Pagination:', { pageSize, fetchAll, targetLimit });
    }

    // ========================================
    // CUSTOM GRAPHQL QUERY - ALL RELATIONS UPFRONT
    // ========================================
    // This query fetches ALL display data in ONE request to avoid N+1 patterns.
    // Includes: assignee, team, state, project, cycle, labels, parent
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
    // Fetch pages until:
    // - No more pages (hasNextPage = false), OR
    // - Reached target limit (if not fetchAll)
    let rawIssues: any[] = [];
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await client.client.rawRequest(issuesQuery, variables);

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
    // If not fetching all pages, truncate to target limit
    if (!fetchAll && rawIssues.length > targetLimit) {
      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Truncating from ${rawIssues.length} to ${targetLimit} issues`);
      }
      rawIssues = rawIssues.slice(0, targetLimit);
    }

    // ========================================
    // SORTING (M15.5 Phase 3)
    // ========================================
    // Client-side sorting after fetch (negligible performance impact for <1000 issues)
    // Future enhancement: Use Linear's GraphQL orderBy if/when syntax is confirmed
    if (filters?.sortField && filters?.sortOrder) {
      const sortField = filters.sortField;
      const sortOrder = filters.sortOrder;
      const ascending = sortOrder === 'asc';

      rawIssues.sort((a: any, b: any) => {
        let aVal: any;
        let bVal: any;

        switch (sortField) {
          case 'priority':
            // Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
            // For desc: Urgent (1) before Low (4)
            // For asc: Low (4) before Urgent (1)
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
            // Issues without due dates go to the end
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
    // All data already fetched in single query, just map to final format
    const issueList: IssueListItem[] = rawIssues.map((issue: any) => ({
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

      labels: (issue.labels?.nodes || []).map((label: any) => ({
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
 * Uses custom GraphQL query to avoid N+1 pattern (11+ API calls → 1 call)
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
    // This query fetches ALL display data in ONE request to avoid N+1 patterns.
    // Includes: state, team, assignee, project, cycle, parent, creator
    // Collections: children (with states!), labels, subscribers
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

    const response: any = await client.client.rawRequest(issueQuery, { issueId });
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
      subscribers: issueData.subscribers.nodes.map((sub: any) => ({
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
      children: issueData.children.nodes.map((child: any) => ({
        id: child.id,
        identifier: child.identifier,
        title: child.title,
        state: child.state?.name || 'Unknown',
      })),
      labels: issueData.labels.nodes.map((label: any) => ({
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
 * Uses custom GraphQL query to avoid N+1 pattern (2 + N API calls → 1 call)
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

    const response: any = await client.client.rawRequest(commentsQuery, { issueId });
    const issueData = response.data?.issue;

    if (!issueData || !issueData.comments) {
      return [];
    }

    return issueData.comments.nodes.map((comment: any) => ({
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
 * Uses custom GraphQL query to avoid N+1 pattern (2 + 7N API calls → 1 call)
 * Fetches all history relationships upfront instead of lazy loading via SDK
 * Previous: 7 awaits per entry (actor, fromState, toState, fromAssignee, toAssignee, addedLabels, removedLabels)
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

    const response: any = await client.client.rawRequest(historyQuery, { issueId });
    const issueData = response.data?.issue;

    if (!issueData || !issueData.history) {
      return [];
    }

    return issueData.history.nodes.map((entry: any) => ({
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
      addedLabels: entry.addedLabels ? entry.addedLabels.map((l: any) => l.name) : undefined,
      removedLabels: entry.removedLabels ? entry.removedLabels.map((l: any) => l.name) : undefined,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Get all projects from Linear with comprehensive filtering (M20)
 * @param filters - Optional filters to apply (team, initiative, status, priority, lead, members, labels, dates, search)
 */
/**
 * Get all projects with optional filtering
 *
 * Performance Optimization (M21 Extended):
 * - Conditional fetching: Only fetch labels/members if used for filtering
 * - Two-query approach: Minimal query + optional batch query for labels/members
 * - In-code join to combine results
 * - API call reduction:
 *   - No filters: 1 call (was 1+N)
 *   - With label/member filters: 2 calls (was 1+N)
 *   - Overall: 92-98% reduction in API calls
 *
 * @param filters - Optional filters for projects
 * @returns Array of project list items
 */
export async function getAllProjects(filters?: ProjectListFilters): Promise<ProjectListItem[]> {
  try {
    const client = getLinearClient();

    // Build GraphQL filter object
    const graphqlFilter: any = {};

    if (filters?.teamId) {
      graphqlFilter.accessibleTeams = { some: { id: { eq: filters.teamId } } };
    }

    if (filters?.initiativeId) {
      graphqlFilter.initiatives = { some: { id: { eq: filters.initiativeId } } };
    }

    if (filters?.statusId) {
      graphqlFilter.status = { id: { eq: filters.statusId } };
    }

    if (filters?.priority !== undefined) {
      graphqlFilter.priority = { eq: filters.priority };
    }

    if (filters?.leadId) {
      graphqlFilter.lead = { id: { eq: filters.leadId } };
    }

    if (filters?.memberIds && filters.memberIds.length > 0) {
      graphqlFilter.members = { some: { id: { in: filters.memberIds } } };
    }

    if (filters?.labelIds && filters.labelIds.length > 0) {
      graphqlFilter.labels = { some: { id: { in: filters.labelIds } } };
    }

    // Date range filters
    if (filters?.startDateAfter || filters?.startDateBefore) {
      graphqlFilter.startDate = {};
      if (filters.startDateAfter) {
        graphqlFilter.startDate.gte = filters.startDateAfter;
      }
      if (filters.startDateBefore) {
        graphqlFilter.startDate.lte = filters.startDateBefore;
      }
    }

    if (filters?.targetDateAfter || filters?.targetDateBefore) {
      graphqlFilter.targetDate = {};
      if (filters.targetDateAfter) {
        graphqlFilter.targetDate.gte = filters.targetDateAfter;
      }
      if (filters.targetDateBefore) {
        graphqlFilter.targetDate.lte = filters.targetDateBefore;
      }
    }

    // Text search (search in name, description, content)
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm.length > 0) {
        graphqlFilter.or = [
          { name: { containsIgnoreCase: searchTerm } },
          { slugId: { containsIgnoreCase: searchTerm } },
          { searchableContent: { contains: searchTerm } }
        ];
      }
    }

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Project filter:', JSON.stringify(graphqlFilter, null, 2));
    }

    // Determine what data needs to be fetched based on filters
    // CURRENT: Only fetch labels/members if they're used in FILTERS
    // FUTURE ENHANCEMENT: Also conditionally fetch based on OUTPUT format
    //   - If output doesn't need members/labels, skip Query 2 entirely
    //   - Would require passing output format context to this function
    const needsLabels = !!filters?.labelIds && filters.labelIds.length > 0;
    const needsMembers = !!filters?.memberIds && filters.memberIds.length > 0;
    const needsDependencies = !!filters?.includeDependencies; // M23
    const needsAdditionalData = needsLabels || needsMembers;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Conditional fetch:', { needsLabels, needsMembers, needsAdditionalData });
    }

    // ========================================
    // PAGINATION SETUP (M21.1)
    // ========================================
    // Determine page size based on fetchAll flag:
    // - If --all: use 250 (max) for optimal performance (5x faster)
    // - Otherwise: use limit (capped at 250)
    const pageSize = filters?.fetchAll ? 250 : Math.min(filters?.limit || 50, 250);
    const fetchAll = filters?.fetchAll || false;
    const targetLimit = filters?.limit || 50;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Pagination:', { pageSize, fetchAll, targetLimit });
    }

    // QUERY 1: Minimal - Always fetch core project data (projects, teams, leads)
    // M23: Conditionally include relations if dependencies are requested
    const relationsFragment = needsDependencies ? `
            relations {
              nodes {
                id
                type
                anchorType
                relatedAnchorType
                project { id }
                relatedProject { id }
              }
            }` : '';

    const minimalQuery = `
      query GetMinimalProjects($filter: ProjectFilter, $includeArchived: Boolean, $first: Int, $after: String) {
        projects(filter: $filter, includeArchived: $includeArchived, first: $first, after: $after) {
          nodes {
            id
            name
            description
            content
            icon
            color
            state
            priority
            startDate
            targetDate
            completedAt
            url
            createdAt
            updatedAt

            teams {
              nodes {
                id
                name
                key
              }
            }

            lead {
              id
              name
              email
            }
${relationsFragment}
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // ========================================
    // PAGINATION LOOP (M21.1)
    // ========================================
    // Fetch pages until:
    // - No more pages (hasNextPage = false), OR
    // - Reached target limit (if not fetchAll)
    let rawProjects: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage && (fetchAll || rawProjects.length < targetLimit)) {
      pageCount++;

      const variables = {
        filter: Object.keys(graphqlFilter).length > 0 ? graphqlFilter : null,
        includeArchived: false,
        first: pageSize,
        after: cursor
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const minimalResponse: any = await client.client.rawRequest(minimalQuery, variables);

      const nodes = minimalResponse.data?.projects?.nodes || [];
      const pageInfo = minimalResponse.data?.projects?.pageInfo;

      rawProjects.push(...nodes);

      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Page ${pageCount}: fetched ${nodes.length} projects (total: ${rawProjects.length}, hasNextPage: ${hasNextPage})`);
      }

      // If not fetching all, stop when we have enough
      if (!fetchAll && rawProjects.length >= targetLimit) {
        break;
      }
    }

    // ========================================
    // QUERY 2: CONDITIONAL - Batch fetch labels+members IF filters use them
    // ========================================
    // This query only runs if:
    //   - filters.labelIds is set (filtering by labels), OR
    //   - filters.memberIds is set (filtering by members)
    //
    // Strategy:
    //   1. Build a single batch GraphQL query for ALL projects
    //   2. Fetch both labels AND members in ONE API call (not N calls)
    //   3. Store results in Maps keyed by project ID
    //   4. Perform in-code join when building final project list
    //
    // Result: If no label/member filters → 1 API call total (was 1+N)
    //         If label/member filters → 2 API calls total (was 1+N)
    //
    // FUTURE ENHANCEMENT: Also check if output format needs labels/members
    //   - e.g., if --format=table doesn't show members column, skip fetching
    //   - Would save Query 2 even more often
    // ========================================
    const labelsMap: Map<string, any[]> = new Map();
    const membersMap: Map<string, any[]> = new Map();

    if (needsAdditionalData && rawProjects.length > 0) {
      const projectIds = rawProjects.map((p: any) => p.id);

      // Build batch query for all projects
      // Note: We fetch both labels AND members in ONE query to minimize API calls
      const batchQuery = `
        query GetProjectsLabelsAndMembers($ids: [String!]!) {
          ${projectIds.map((id: string, index: number) => `
            project${index}: project(id: "${id}") {
              id
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              members {
                nodes {
                  id
                  name
                  email
                }
              }
            }
          `).join('\n')}
        }
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchResponse: any = await client.client.rawRequest(batchQuery, {});

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error('[agent2linear] Batch query fetched labels+members for', projectIds.length, 'projects');
      }

      // Parse batch response and build maps for in-code join
      projectIds.forEach((projectId: string, index: number) => {
        const projectData = batchResponse.data?.[`project${index}`];
        if (projectData) {
          labelsMap.set(projectId, projectData.labels?.nodes || []);
          membersMap.set(projectId, projectData.members?.nodes || []);
        }
      });
    }

    // ========================================
    // IN-CODE JOIN: Merge Query 1 (projects) + Query 2 (labels/members)
    // ========================================
    // TRUNCATION (M21.1)
    // ========================================
    // If not fetching all pages, truncate to target limit
    if (!fetchAll && rawProjects.length > targetLimit) {
      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Truncating from ${rawProjects.length} to ${targetLimit} projects`);
      }
      rawProjects = rawProjects.slice(0, targetLimit);
    }

    // ========================================
    // BUILD FINAL PROJECT LIST (IN-CODE JOIN)
    // ========================================
    // Build final project list by joining data from both queries
    const projectList: ProjectListItem[] = rawProjects.map((project: any) => {
      const labels = labelsMap.get(project.id) || [];
      const members = membersMap.get(project.id) || [];

      // M23: Calculate dependency counts if relations were fetched
      let dependsOnCount: number | undefined = undefined;
      let blocksCount: number | undefined = undefined;

      if (needsDependencies) {
        // Initialize to 0 when fetching dependencies
        dependsOnCount = 0;
        blocksCount = 0;

        // Count relations if present
        if (project.relations?.nodes) {
          const relations = project.relations.nodes;

          dependsOnCount = relations.filter((rel: any) => {
            try {
              return getRelationDirection(rel, project.id) === 'depends-on';
            } catch {
              return false;
            }
          }).length;

          blocksCount = relations.filter((rel: any) => {
            try {
              return getRelationDirection(rel, project.id) === 'blocks';
            } catch {
              return false;
            }
          }).length;
        }
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        content: project.content || undefined,
        icon: project.icon || undefined,
        color: project.color || undefined,
        state: project.state,
        priority: project.priority !== undefined ? project.priority : undefined,

        status: undefined, // Project status is not available in Linear SDK v27+

        lead: project.lead ? {
          id: project.lead.id,
          name: project.lead.name,
          email: project.lead.email
        } : undefined,

        team: project.teams?.nodes?.[0] ? {
          id: project.teams.nodes[0].id,
          name: project.teams.nodes[0].name,
          key: project.teams.nodes[0].key
        } : undefined,

        initiative: undefined, // Initiative relationship needs to be fetched differently

        labels: labels.map((label: any) => ({
          id: label.id,
          name: label.name,
          color: label.color || undefined
        })),

        members: members.map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email
        })),

        startDate: project.startDate || undefined,
        targetDate: project.targetDate || undefined,
        completedAt: project.completedAt || undefined,

        url: project.url,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,

        // M23: Include dependency counts if fetched
        dependsOnCount,
        blocksCount
      };
    });

    return projectList;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project creation input
 */
export interface ProjectCreateInput {
  name: string;
  description?: string;
  initiativeId?: string;
  teamId?: string;
  templateId?: string;
  // Additional Linear SDK fields
  statusId?: string;
  content?: string;
  icon?: string;
  color?: string;
  leadId?: string;
  labelIds?: string[];
  convertedFromIssueId?: string;
  startDate?: string;
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDate?: string;
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  priority?: number;
  memberIds?: string[];
}

/**
 * Project result with metadata
 */
export interface ProjectResult {
  id: string;
  name: string;
  url: string;
  state: string;
  initiative?: {
    id: string;
    name: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

/**
 * Check if a project with the given name already exists (legacy - returns boolean)
 */
export async function getProjectByName(name: string): Promise<boolean> {
  try {
    const project = await findProjectByName(name);
    return project !== null;
  } catch (error) {
    // If we can't check, allow creation to proceed
    return false;
  }
}

/**
 * Find a project by its exact name and return full project details
 */
export async function findProjectByName(name: string): Promise<ProjectResult | null> {
  try {
    const client = getLinearClient();
    const projects = await client.projects({
      filter: {
        name: { eq: name },
      },
    });

    const projectsList = await projects.nodes;
    if (projectsList.length === 0) {
      return null;
    }

    const project = projectsList[0];

    // Fetch initiative details if linked
    let initiative;
    try {
      const projectInitiatives = await project.initiatives();
      const initiativesList = await projectInitiatives.nodes;
      if (initiativesList && initiativesList.length > 0) {
        const firstInitiative = initiativesList[0];
        initiative = {
          id: firstInitiative.id,
          name: firstInitiative.name,
        };
      }
    } catch {
      // Initiative fetch failed or not linked
    }

    // Fetch team details if set
    let team;
    try {
      const teams = await project.teams();
      const teamsList = await teams.nodes;
      if (teamsList && teamsList.length > 0) {
        const firstTeam = teamsList[0];
        team = {
          id: firstTeam.id,
          name: firstTeam.name,
        };
      }
    } catch {
      // Team fetch failed
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create a new project in Linear
 */
export async function createProject(input: ProjectCreateInput): Promise<ProjectResult> {
  try {
    const client = getLinearClient();

    // Prepare the creation input
    const createInput = {
      name: input.name,
      description: input.description,
      ...(input.teamId && { teamIds: [input.teamId] }),
      ...(input.templateId && { lastAppliedTemplateId: input.templateId }),
      // Additional optional fields
      ...(input.statusId && { statusId: input.statusId }),
      ...(input.content && { content: input.content }),
      ...(input.icon && { icon: input.icon }),
      ...(input.color && { color: input.color }),
      ...(input.leadId && { leadId: input.leadId }),
      ...(input.labelIds && input.labelIds.length > 0 && { labelIds: input.labelIds }),
      ...(input.convertedFromIssueId && { convertedFromIssueId: input.convertedFromIssueId }),
      ...(input.startDate && { startDate: input.startDate }),
      ...(input.startDateResolution && { startDateResolution: input.startDateResolution }),
      ...(input.targetDate && { targetDate: input.targetDate }),
      ...(input.targetDateResolution && { targetDateResolution: input.targetDateResolution }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.memberIds && input.memberIds.length > 0 && { memberIds: input.memberIds }),
    } as const;

    // Debug: log what we're sending to the API
    if (process.env.DEBUG) {
      console.log('DEBUG: createInput =', JSON.stringify(createInput, null, 2));
    }

    // Create the project
    const projectPayload = await client.createProject(createInput as Parameters<typeof client.createProject>[0]);

    const project = await projectPayload.project;

    if (!project) {
      throw new Error('Failed to create project: No project returned from API');
    }

    // Debug: Check if template was applied
    if (process.env.DEBUG && input.templateId) {
      try {
        const lastAppliedTemplate = await (project as { lastAppliedTemplate?: { id: string; name: string } }).lastAppliedTemplate;
        if (lastAppliedTemplate) {
          console.log(`DEBUG: Template applied - ID: ${lastAppliedTemplate.id}, Name: ${lastAppliedTemplate.name}`);
        } else {
          console.log('DEBUG: No template was applied to the project');
        }
      } catch (err) {
        console.log('DEBUG: Could not check lastAppliedTemplate:', err instanceof Error ? err.message : err);
      }
    }

    // Link project to initiative if specified
    let initiative;
    if (input.initiativeId) {
      try {
        // First fetch initiative details
        const initiativeData = await client.initiative(input.initiativeId);
        initiative = {
          id: initiativeData.id,
          name: initiativeData.name,
        };

        // Link project to initiative using initiativeToProjectCreate
        await client.createInitiativeToProject({
          initiativeId: input.initiativeId,
          projectId: project.id,
        });

        if (process.env.DEBUG) {
          console.log(`DEBUG: Successfully linked project ${project.id} to initiative ${input.initiativeId}`);
        }
      } catch (err) {
        // Initiative link failed - log in debug mode
        if (process.env.DEBUG) {
          console.log('DEBUG: Failed to link initiative:', err);
        }
        // Don't throw - project was still created successfully
      }
    }

    // Fetch team details if set
    let team;
    if (input.teamId) {
      try {
        const teamData = await client.team(input.teamId);
        team = {
          id: teamData.id,
          name: teamData.name,
        };
      } catch {
        // Team fetch failed
      }
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project Update Input
 */
export interface ProjectUpdateInput {
  statusId?: string;
  name?: string;
  description?: string;
  content?: string;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  // M15 Phase 1: Visual & Ownership Fields
  color?: string;
  icon?: string;
  leadId?: string;
  // M15 Phase 2: Collaboration & Organization Fields
  memberIds?: string[];
  labelIds?: string[];
  // M15 Phase 3: Date Resolutions
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
}

/**
 * Update an existing project
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdateInput
): Promise<ProjectResult> {
  try {
    const client = getLinearClient();

    // Prepare the update input
    const updateInput: Partial<{
      statusId: string;
      name: string;
      description: string;
      content: string;
      priority: number;
      startDate: string;
      targetDate: string;
      color: string;
      icon: string;
      leadId: string;
      memberIds: string[];
      labelIds: string[];
      startDateResolution: 'month' | 'quarter' | 'halfYear' | 'year';
      targetDateResolution: 'month' | 'quarter' | 'halfYear' | 'year';
    }> = {};

    if (updates.statusId !== undefined) {
      updateInput.statusId = updates.statusId;
    }
    if (updates.name !== undefined) {
      updateInput.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateInput.description = updates.description;
    }
    if (updates.content !== undefined) {
      updateInput.content = updates.content;
    }
    if (updates.priority !== undefined) {
      updateInput.priority = updates.priority;
    }
    if (updates.startDate !== undefined) {
      updateInput.startDate = updates.startDate;
    }
    if (updates.targetDate !== undefined) {
      updateInput.targetDate = updates.targetDate;
    }
    // M15 Phase 1: Visual & Ownership Fields
    if (updates.color !== undefined) {
      updateInput.color = updates.color;
    }
    if (updates.icon !== undefined) {
      updateInput.icon = updates.icon;
    }
    if (updates.leadId !== undefined) {
      updateInput.leadId = updates.leadId;
    }
    // M15 Phase 2: Collaboration & Organization Fields
    if (updates.memberIds !== undefined) {
      updateInput.memberIds = updates.memberIds;
    }
    if (updates.labelIds !== undefined) {
      updateInput.labelIds = updates.labelIds;
    }
    // M15 Phase 3: Date Resolutions
    if (updates.startDateResolution !== undefined) {
      updateInput.startDateResolution = updates.startDateResolution;
    }
    if (updates.targetDateResolution !== undefined) {
      updateInput.targetDateResolution = updates.targetDateResolution;
    }

    // Update the project
    const projectPayload = await client.updateProject(projectId, updateInput as Parameters<typeof client.updateProject>[1]);
    const project = await projectPayload.project;

    if (!project) {
      throw new Error('Failed to update project: No project returned from API');
    }

    // Fetch initiative details if linked
    let initiative;
    try {
      const projectInitiatives = await project.initiatives();
      const initiativesList = await projectInitiatives.nodes;
      if (initiativesList && initiativesList.length > 0) {
        const firstInitiative = initiativesList[0];
        initiative = {
          id: firstInitiative.id,
          name: firstInitiative.name,
        };
      }
    } catch {
      // Initiative fetch failed or not linked
    }

    // Fetch team details if set
    let team;
    try {
      const teams = await project.teams();
      const teamsList = await teams.nodes;
      if (teamsList && teamsList.length > 0) {
        const firstTeam = teamsList[0];
        team = {
          id: firstTeam.id,
          name: firstTeam.name,
        };
      }
    } catch {
      // Team fetch failed
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project by ID
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (3 API calls → 1 call)
 * Fetches project with initiatives and teams upfront instead of lazy loading via SDK
 */
export async function getProjectById(
  projectId: string
): Promise<ProjectResult | null> {
  try {
    const client = getLinearClient();

    // Custom GraphQL query - fetch project with initiatives and teams in one request
    const projectQuery = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          url
          state

          initiatives {
            nodes {
              id
              name
            }
          }

          teams {
            nodes {
              id
              name
            }
          }
        }
      }
    `;

    const response: any = await client.client.rawRequest(projectQuery, { projectId });
    const project = response.data?.project;

    if (!project) {
      return null;
    }

    // Get first initiative if exists
    const initiative = project.initiatives?.nodes?.[0]
      ? {
          id: project.initiatives.nodes[0].id,
          name: project.initiatives.nodes[0].name,
        }
      : undefined;

    // Get first team if exists
    const team = project.teams?.nodes?.[0]
      ? {
          id: project.teams.nodes[0].id,
          name: project.teams.nodes[0].name,
        }
      : undefined;

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get project milestones and issues for validation
 */
export async function getProjectDetails(projectId: string): Promise<{
  project: ProjectResult;
  lastAppliedTemplate?: { id: string; name: string };
  milestones: Array<{ id: string; name: string }>;
  issues: Array<{ id: string; identifier: string; title: string }>;
} | null> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      return null;
    }

    // Get basic project info
    const projectResult = await getProjectById(projectId);
    if (!projectResult) {
      return null;
    }

    // Get last applied template
    let lastAppliedTemplate;
    try {
      const template = await (project as { lastAppliedTemplate?: { id: string; name: string } }).lastAppliedTemplate;
      if (template) {
        lastAppliedTemplate = {
          id: template.id,
          name: template.name,
        };
      }
    } catch {
      // Template not available
    }

    // Get milestones
    const milestones: Array<{ id: string; name: string }> = [];
    try {
      const projectMilestones = await project.projectMilestones();
      const milestonesList = await projectMilestones.nodes;
      for (const milestone of milestonesList) {
        milestones.push({
          id: milestone.id,
          name: milestone.name,
        });
      }
    } catch {
      // Milestones not available
    }

    // Get issues
    const issues: Array<{ id: string; identifier: string; title: string }> = [];
    try {
      const projectIssues = await project.issues();
      const issuesList = await projectIssues.nodes;
      for (const issue of issuesList) {
        issues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
        });
      }
    } catch {
      // Issues not available
    }

    return {
      project: projectResult,
      lastAppliedTemplate,
      milestones,
      issues,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project details: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get full project details with all relationships (OPTIMIZED)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (~10 API calls → 1 call)
 * Fetches all project data upfront instead of lazy loading via SDK
 *
 * @param projectId - Project UUID
 * @returns Complete project details or null if not found
 */
export async function getFullProjectDetails(projectId: string): Promise<{
  project: ProjectResult;
  lastAppliedTemplate?: { id: string; name: string };
  milestones: Array<{ id: string; name: string }>;
  issues: Array<{ id: string; identifier: string; title: string }>;
} | null> {
  try {
    const client = getLinearClient();

    // ========================================
    // CUSTOM GRAPHQL QUERY - ALL RELATIONS UPFRONT
    // ========================================
    // This query fetches ALL project data in ONE request to avoid N+1 patterns.
    // Includes: basic info, initiatives, teams, template, milestones, issues
    const projectQuery = `
      query GetFullProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          url
          state

          initiatives {
            nodes {
              id
              name
            }
          }

          teams {
            nodes {
              id
              name
            }
          }

          lastAppliedTemplate {
            id
            name
          }

          projectMilestones {
            nodes {
              id
              name
            }
          }

          issues {
            nodes {
              id
              identifier
              title
            }
          }
        }
      }
    `;

    const response: any = await client.client.rawRequest(projectQuery, { projectId });
    const projectData = response.data?.project;

    if (!projectData) {
      return null;
    }

    // Map GraphQL response to ProjectResult and related data (no awaits needed!)
    const initiative = projectData.initiatives?.nodes?.[0]
      ? {
          id: projectData.initiatives.nodes[0].id,
          name: projectData.initiatives.nodes[0].name,
        }
      : undefined;

    const team = projectData.teams?.nodes?.[0]
      ? {
          id: projectData.teams.nodes[0].id,
          name: projectData.teams.nodes[0].name,
        }
      : undefined;

    const lastAppliedTemplate = projectData.lastAppliedTemplate
      ? {
          id: projectData.lastAppliedTemplate.id,
          name: projectData.lastAppliedTemplate.name,
        }
      : undefined;

    const milestones = (projectData.projectMilestones?.nodes || []).map((milestone: any) => ({
      id: milestone.id,
      name: milestone.name,
    }));

    const issues = (projectData.issues?.nodes || []).map((issue: any) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
    }));

    return {
      project: {
        id: projectData.id,
        name: projectData.name,
        url: projectData.url,
        state: projectData.state,
        initiative,
        team,
      },
      lastAppliedTemplate,
      milestones,
      issues,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project details: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Template data structure (from types.ts)
 */
export interface Template {
  id: string;
  name: string;
  type: 'issue' | 'project';
  description?: string;
}

/**
 * Get all templates from Linear
 */
export async function getAllTemplates(typeFilter?: 'issue' | 'project'): Promise<Template[]> {
  try {
    const client = getLinearClient();
    const result: Template[] = [];

    // Fetch all templates from Linear
    // Linear uses a single Template type with a 'type' field to distinguish between issue and project templates
    try {
      // client.templates returns LinearFetch<Template[]> which is Promise<Template[]>
      const templates = await client.templates;

      for (const template of templates) {
        // Determine template type based on the 'type' field from Linear
        // Linear uses different type values, but we normalize to 'issue' or 'project'
        let templateType: 'issue' | 'project';

        if (template.type.toLowerCase().includes('project')) {
          templateType = 'project';
        } else {
          // Default to issue template (most common case)
          templateType = 'issue';
        }

        // Apply filter if specified
        if (typeFilter && templateType !== typeFilter) {
          continue;
        }

        result.push({
          id: template.id,
          name: template.name,
          type: templateType,
          description: template.description || undefined,
        });
      }
    } catch (err) {
      // Templates may not be available - log the error for debugging
      if (process.env.DEBUG) {
        console.error('Error fetching templates:', err);
      }
      throw err; // Re-throw to let caller know there was an error
    }

    // Sort by type then name
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  templateId: string
): Promise<{ id: string; name: string; type: 'issue' | 'project'; description?: string } | null> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('./entity-cache.js');
    const cache = getEntityCache();
    const template = await cache.findTemplateById(templateId);

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      type: template.type,
      description: template.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project Status types
 */
export interface ProjectStatus {
  id: string;
  name: string;
  type: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  color: string;
  description?: string;
  position: number;
}

/**
 * Get all project statuses from the organization
 */
export async function getAllProjectStatuses(): Promise<ProjectStatus[]> {
  try {
    const client = getLinearClient();
    const organization = await client.organization;
    const statuses = await organization.projectStatuses;

    return statuses.map((status: { id: string; name: string; type: string; color: string; description?: string; position: number }) => ({
      id: status.id,
      name: status.name,
      type: status.type as 'planned' | 'started' | 'paused' | 'completed' | 'canceled',
      color: status.color,
      description: status.description || undefined,
      position: status.position,
    }));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project statuses: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project status by ID
 */
export async function getProjectStatusById(statusId: string): Promise<ProjectStatus | null> {
  try {
    const client = getLinearClient();
    const status = await client.projectStatus(statusId);

    if (!status) {
      return null;
    }

    return {
      id: status.id,
      name: status.name,
      type: status.type as 'planned' | 'started' | 'paused' | 'completed' | 'canceled',
      color: status.color,
      description: status.description || undefined,
      position: status.position,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Milestone-related types
 */
export interface ProjectMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
}

export interface MilestoneCreateInput {
  name: string;
  description?: string;
  targetDate?: Date;
}

/**
 * Validate that a project exists
 */
export async function validateProjectExists(
  projectId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      return {
        valid: false,
        error: `Project with ID "${projectId}" not found`,
      };
    }

    return {
      valid: true,
      name: project.name,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate project: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Create a project milestone
 */
export async function createProjectMilestone(
  projectId: string,
  input: MilestoneCreateInput
): Promise<{ id: string; name: string }> {
  try {
    const client = getLinearClient();

    // Format target date if provided
    const targetDate = input.targetDate ? input.targetDate.toISOString() : undefined;

    const payload = await client.createProjectMilestone({
      projectId,
      name: input.name,
      description: input.description,
      targetDate,
    });

    const milestone = await payload.projectMilestone;
    if (!milestone) {
      throw new Error('Failed to create milestone: No milestone returned from API');
    }

    return {
      id: milestone.id,
      name: milestone.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create milestone: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all milestones for a project
 */
export async function getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const milestones = await project.projectMilestones();
    const result: ProjectMilestone[] = [];

    for (const milestone of milestones.nodes) {
      result.push({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description || undefined,
        targetDate: milestone.targetDate || undefined,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project milestones: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Workflow State (Issue Status) API Methods
 */

export interface WorkflowStateCreateInput {
  name: string;
  teamId: string;
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  description?: string;
  position?: number;
}

export interface WorkflowStateUpdateInput {
  name?: string;
  type?: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color?: string;
  description?: string;
  position?: number;
}

/**
 * Get all workflow states for a team (or all teams)
 */
/**
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern when fetching all workflow states
 * Previous: 1 + N API calls (1 for teams + N for states per team)
 * Optimized: 1 API call with nested states data
 */
export async function getAllWorkflowStates(teamId?: string): Promise<import('./types.js').WorkflowState[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').WorkflowState[] = [];

    if (teamId) {
      // Get workflow states for a specific team (already efficient - 2 calls)
      const team = await client.team(teamId);
      if (!team) {
        throw new Error(`Team not found: ${teamId}`);
      }

      const states = await team.states();
      for (const state of states.nodes) {
        result.push({
          id: state.id,
          name: state.name,
          type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
          color: state.color,
          description: state.description || undefined,
          position: state.position,
          teamId: team.id,
        });
      }
    } else {
      // Get workflow states for all teams - OPTIMIZED with custom GraphQL
      const statesQuery = `
        query GetAllWorkflowStates {
          teams {
            nodes {
              id
              states {
                nodes {
                  id
                  name
                  type
                  color
                  description
                  position
                }
              }
            }
          }
        }
      `;

      const response: any = await client.client.rawRequest(statesQuery);
      const teamsData = response.data?.teams?.nodes || [];

      for (const team of teamsData) {
        for (const state of team.states.nodes) {
          result.push({
            id: state.id,
            name: state.name,
            type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
            color: state.color,
            description: state.description || undefined,
            position: state.position,
            teamId: team.id,
          });
        }
      }
    }

    // Sort by team, then position
    return result.sort((a, b) => {
      if (a.teamId !== b.teamId) {
        return a.teamId.localeCompare(b.teamId);
      }
      return a.position - b.position;
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch workflow states: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single workflow state by ID
 */
export async function getWorkflowStateById(id: string): Promise<import('./types.js').WorkflowState | null> {
  try {
    const client = getLinearClient();
    const state = await client.workflowState(id);

    if (!state) {
      return null;
    }

    const team = await state.team;

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: team?.id || '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new workflow state
 */
export async function createWorkflowState(input: WorkflowStateCreateInput): Promise<import('./types.js').WorkflowState> {
  try {
    const client = getLinearClient();

    const payload = await client.createWorkflowState({
      name: input.name,
      teamId: input.teamId,
      type: input.type,
      color: input.color,
      description: input.description,
      position: input.position,
    });

    const state = await payload.workflowState;
    if (!state) {
      throw new Error('Failed to create workflow state: No state returned from API');
    }

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: input.teamId,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a workflow state
 */
export async function updateWorkflowState(id: string, input: WorkflowStateUpdateInput): Promise<import('./types.js').WorkflowState> {
  try {
    const client = getLinearClient();

    const payload = await client.updateWorkflowState(id, {
      name: input.name,
      color: input.color,
      description: input.description,
      position: input.position,
    });

    const state = await payload.workflowState;
    if (!state) {
      throw new Error('Failed to update workflow state: No state returned from API');
    }

    const team = await state.team;

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: team?.id || '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a workflow state (archives it in Linear)
 */
export async function deleteWorkflowState(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.archiveWorkflowState(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Issue Label API Methods
 */

export interface IssueLabelCreateInput {
  name: string;
  color: string;
  description?: string;
  teamId?: string; // undefined for workspace-level labels
}

export interface IssueLabelUpdateInput {
  name?: string;
  color?: string;
  description?: string;
}

/**
 * Get all issue labels (workspace-level and/or team-level)
 */
/**
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern when fetching all labels
 * Previous: 1 + N API calls (1 for labels + N for teams)
 * Optimized: 1 API call with nested team data
 */
export async function getAllIssueLabels(teamId?: string): Promise<import('./types.js').IssueLabel[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').IssueLabel[] = [];

    if (teamId) {
      // Get labels for a specific team (already efficient - 2 calls)
      const team = await client.team(teamId);
      if (!team) {
        throw new Error(`Team not found: ${teamId}`);
      }

      const labels = await team.labels();
      for (const label of labels.nodes) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
          teamId: team.id,
        });
      }
    } else {
      // Get all labels (workspace + all teams) - OPTIMIZED with custom GraphQL
      const labelsQuery = `
        query GetAllIssueLabels {
          issueLabels {
            nodes {
              id
              name
              color
              description
              team {
                id
              }
            }
          }
        }
      `;

      const response: any = await client.client.rawRequest(labelsQuery);
      const labelsData = response.data?.issueLabels?.nodes || [];

      for (const label of labelsData) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
          teamId: label.team?.id,
        });
      }
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch issue labels: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single issue label by ID
 */
export async function getIssueLabelById(id: string): Promise<import('./types.js').IssueLabel | null> {
  try {
    const client = getLinearClient();
    const label = await client.issueLabel(id);

    if (!label) {
      return null;
    }

    const team = await label.team;

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: team?.id,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new issue label
 */
export async function createIssueLabel(input: IssueLabelCreateInput): Promise<import('./types.js').IssueLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.createIssueLabel({
      name: input.name,
      color: input.color,
      description: input.description,
      teamId: input.teamId,
    });

    const label = await payload.issueLabel;
    if (!label) {
      throw new Error('Failed to create issue label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: input.teamId,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update an issue label
 */
export async function updateIssueLabel(id: string, input: IssueLabelUpdateInput): Promise<import('./types.js').IssueLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.updateIssueLabel(id, {
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.issueLabel;
    if (!label) {
      throw new Error('Failed to update issue label: No label returned from API');
    }

    const team = await label.team;

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: team?.id,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete an issue label
 */
export async function deleteIssueLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteIssueLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project Label API Methods
 */

export interface ProjectLabelCreateInput {
  name: string;
  color: string;
  description?: string;
}

export interface ProjectLabelUpdateInput {
  name?: string;
  color?: string;
  description?: string;
}

/**
 * Get all project labels (workspace-level only)
 * @param includeAll - If true, fetches ALL labels including ones never applied to projects
 */
export async function getAllProjectLabels(includeAll?: boolean): Promise<import('./types.js').ProjectLabel[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').ProjectLabel[] = [];

    if (includeAll) {
      // Use raw GraphQL query to fetch ALL project labels including unused ones
      const query = `
        query GetAllProjectLabels {
          organization {
            projectLabels {
              nodes {
                id
                name
                color
                description
                lastAppliedAt
              }
            }
          }
        }
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await client.client.rawRequest(query);

      if (process.env.DEBUG) {
        console.log(`DEBUG: Raw GraphQL response:`, JSON.stringify(response.data, null, 2));
      }

      const labels = response.data?.organization?.projectLabels?.nodes || [];

      for (const label of labels) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
        });
      }

      if (process.env.DEBUG) {
        console.log(`DEBUG: Fetched ${result.length} labels via raw GraphQL query`);
      }
    } else {
      // Default: use SDK method which may only return labels that have been applied
      const labels = await client.projectLabels();

      for (const label of labels.nodes) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
        });
      }

      if (process.env.DEBUG) {
        console.log(`DEBUG: Fetched ${result.length} labels from client.projectLabels()`);
      }
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project labels: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project label by ID
 */
export async function getProjectLabelById(id: string): Promise<import('./types.js').ProjectLabel | null> {
  try {
    const client = getLinearClient();
    const label = await client.projectLabel(id);

    if (!label) {
      return null;
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new project label
 */
export async function createProjectLabel(input: ProjectLabelCreateInput): Promise<import('./types.js').ProjectLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.createProjectLabel({
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.projectLabel;
    if (!label) {
      throw new Error('Failed to create project label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a project label
 */
export async function updateProjectLabel(id: string, input: ProjectLabelUpdateInput): Promise<import('./types.js').ProjectLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.updateProjectLabel(id, {
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.projectLabel;
    if (!label) {
      throw new Error('Failed to update project label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a project label
 */
export async function deleteProjectLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteProjectLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * External Link API Methods
 */

export interface ExternalLink {
  id: string;
  url: string;
  label: string;
  sortOrder: number;
  creatorId: string;
}

export interface ExternalLinkCreateInput {
  url: string;
  label: string;
  projectId?: string;
  initiativeId?: string;
  sortOrder?: number;
}

/**
 * Create an external link for a project or initiative
 */
export async function createExternalLink(input: ExternalLinkCreateInput): Promise<ExternalLink> {
  try {
    const client = getLinearClient();

    const payload = await client.createEntityExternalLink({
      url: input.url,
      label: input.label,
      projectId: input.projectId,
      initiativeId: input.initiativeId,
      sortOrder: input.sortOrder,
    });

    const link = await payload.entityExternalLink;
    if (!link) {
      throw new Error('Failed to create external link: No link returned from API');
    }

    const creator = await link.creator;

    return {
      id: link.id,
      url: link.url,
      label: link.label,
      sortOrder: link.sortOrder,
      creatorId: creator?.id ?? '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create external link: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all external links for a project
 */
export async function getProjectExternalLinks(projectId: string): Promise<ExternalLink[]> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const links = await project.externalLinks();
    const result: ExternalLink[] = [];

    for (const link of links.nodes) {
      const creator = await link.creator;
      result.push({
        id: link.id,
        url: link.url,
        label: link.label,
        sortOrder: link.sortOrder,
        creatorId: creator?.id ?? '',
      });
    }

    // Sort by sort order
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch external links: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete an external link
 */
export async function deleteExternalLink(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const result = await client.deleteEntityExternalLink(id);
    return result.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete external link: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * M23: Project Dependency Management
 *
 * Create a project relation (dependency)
 * Note: Linear API uses type: "dependency" with anchor-based semantics
 * - anchorType: which part of source project ("start" or "end")
 * - relatedAnchorType: which part of target project ("start" or "end")
 */
export async function createProjectRelation(
  client: SDKClient,
  input: ProjectRelationCreateInput
): Promise<ProjectRelation> {
  try {
    // GraphQL mutation with inline fragment for ProjectRelation fields
    const mutation = `
      mutation CreateProjectRelation($input: ProjectRelationCreateInput!) {
        projectRelationCreate(input: $input) {
          success
          projectRelation {
            id
            type
            anchorType
            relatedAnchorType
            createdAt
            updatedAt
            project {
              id
              name
            }
            relatedProject {
              id
              name
            }
          }
        }
      }
    `;

    const result = await client.client.rawRequest(mutation, {
      input: {
        type: 'dependency', // Always "dependency" (only valid value)
        projectId: input.projectId,
        relatedProjectId: input.relatedProjectId,
        anchorType: input.anchorType,
        relatedAnchorType: input.relatedAnchorType,
      },
    });

    const data = result.data as {
      projectRelationCreate: {
        success: boolean;
        projectRelation: ProjectRelation;
      };
    };

    if (!data.projectRelationCreate.success) {
      throw new Error('Failed to create project relation');
    }

    return data.projectRelationCreate.projectRelation;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project relation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a project relation by ID
 */
export async function deleteProjectRelation(
  client: SDKClient,
  relationId: string
): Promise<boolean> {
  try {
    const mutation = `
      mutation DeleteProjectRelation($id: String!) {
        projectRelationDelete(id: $id) {
          success
        }
      }
    `;

    const result = await client.client.rawRequest(mutation, {
      id: relationId,
    });

    const data = result.data as {
      projectRelationDelete: {
        success: boolean;
      };
    };

    return data.projectRelationDelete.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete project relation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch all project relations for a given project
 * Returns both "depends on" and "blocks" relations
 */
export async function getProjectRelations(
  client: SDKClient,
  projectId: string
): Promise<ProjectRelation[]> {
  try {
    // Query to fetch project relations using the .relations() method
    const query = `
      query GetProjectRelations($projectId: String!) {
        project(id: $projectId) {
          id
          name
          relations {
            nodes {
              id
              type
              anchorType
              relatedAnchorType
              createdAt
              updatedAt
              project {
                id
                name
              }
              relatedProject {
                id
                name
              }
            }
          }
        }
      }
    `;

    const result = await client.client.rawRequest(query, {
      projectId,
    });

    const data = result.data as {
      project: {
        id: string;
        name: string;
        relations: {
          nodes: ProjectRelation[];
        };
      };
    };

    return data.project.relations.nodes;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project relations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
