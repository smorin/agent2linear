import { getLinearClient, LinearClientError } from './client.js';

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
    const { getEntityCache } = await import('../entity-cache.js');
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
    const { getEntityCache } = await import('../entity-cache.js');
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
    const { getEntityCache } = await import('../entity-cache.js');
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
