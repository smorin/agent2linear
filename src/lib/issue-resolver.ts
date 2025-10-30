/**
 * Issue Resolver (M15.1)
 * Resolves issue identifiers (ENG-123 format) or UUIDs to Linear issue IDs
 */

import { getLinearClient } from './linear-client.js';

/**
 * Result from resolving an issue identifier
 */
export interface IssueResolveResult {
  issueId: string;
  issue?: any; // Linear Issue object
  resolvedBy: 'uuid' | 'identifier';
  originalInput: string;
}

/**
 * Cache for resolved identifiers (in-memory, session-scoped)
 */
const identifierCache = new Map<string, string>();

/**
 * Check if input looks like a UUID
 * Format: 8-4-4-4-12 hex characters
 */
function looksLikeUUID(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

/**
 * Check if input looks like an issue identifier
 * Format: TEAM-123 (team key + dash + number)
 * Case insensitive: ENG-123, eng-123, Eng-123 all valid
 */
function looksLikeIdentifier(input: string): boolean {
  const identifierRegex = /^[A-Z]+-\d+$/i;
  return identifierRegex.test(input);
}

/**
 * Normalize identifier to uppercase for consistency
 * ENG-123, eng-123, Eng-123 → ENG-123
 */
function normalizeIdentifier(identifier: string): string {
  return identifier.toUpperCase();
}

/**
 * Resolve issue identifier to UUID via Linear API
 * @param identifier - Issue identifier in ENG-123 format (case insensitive)
 * @returns Issue ID (UUID) or null if not found
 */
async function resolveIdentifierToUUID(identifier: string): Promise<string | null> {
  const normalized = normalizeIdentifier(identifier);

  // Check cache first
  if (identifierCache.has(normalized)) {
    return identifierCache.get(normalized)!;
  }

  try {
    const client = getLinearClient();

    // Parse identifier into team key and number
    // Example: ENG-123 → team key "ENG", number 123
    const match = normalized.match(/^([A-Z]+)-(\d+)$/);
    if (!match) {
      return null;
    }

    const teamKey = match[1];
    const numberStr = match[2];
    const issueNumber = parseInt(numberStr, 10);

    // Query Linear API for issues by team key and number
    // We query directly by team key and issue number without fetching the team first
    const teams = await client.teams({
      filter: {
        key: {
          eq: teamKey,
        },
      },
    });

    if (teams.nodes.length === 0) {
      // Team not found
      return null;
    }

    // Now query issues for this team with the specific number
    const issues = await client.issues({
      filter: {
        team: {
          key: {
            eq: teamKey,
          },
        },
        number: {
          eq: issueNumber,
        },
      },
    });

    if (issues.nodes.length > 0) {
      const issue = issues.nodes[0];

      // Cache the resolution
      identifierCache.set(normalized, issue.id);

      return issue.id;
    }

    return null;
  } catch (error) {
    // If API call fails, return null (resolver will handle error messaging)
    return null;
  }
}

/**
 * Smart issue resolver with format detection:
 * 1. Check if input is UUID format → fetch by UUID
 * 2. Check if input is identifier format (ENG-123) → resolve to UUID, then fetch
 * 3. If neither format matches → return error
 *
 * @param input - Issue identifier (ENG-123) or UUID
 * @returns ResolveResult with issue details, or null if not found/invalid format
 */
export async function resolveIssueIdentifier(
  input: string
): Promise<IssueResolveResult | null> {
  const trimmedInput = input.trim();

  // Validate input is not empty
  if (!trimmedInput) {
    return null;
  }

  // Case 1: UUID format
  if (looksLikeUUID(trimmedInput)) {
    const issue = await fetchIssueByUUID(trimmedInput);
    if (issue) {
      return {
        issueId: trimmedInput,
        issue,
        resolvedBy: 'uuid',
        originalInput: input,
      };
    }
    // UUID format but not found
    return null;
  }

  // Case 2: Identifier format (ENG-123)
  if (looksLikeIdentifier(trimmedInput)) {
    const uuid = await resolveIdentifierToUUID(trimmedInput);
    if (uuid) {
      const issue = await fetchIssueByUUID(uuid);
      if (issue) {
        return {
          issueId: uuid,
          issue,
          resolvedBy: 'identifier',
          originalInput: input,
        };
      }
    }
    // Identifier format but not found
    return null;
  }

  // Case 3: Invalid format (not UUID, not identifier)
  return null;
}

/**
 * Simpler version that just returns the UUID
 * Useful when you just need the ID without full issue details
 *
 * @param input - Issue identifier (ENG-123) or UUID
 * @returns Issue UUID or null if not found/invalid
 */
export async function resolveIssueId(input: string): Promise<string | null> {
  const result = await resolveIssueIdentifier(input);
  return result ? result.issueId : null;
}

/**
 * Validate issue identifier format without making API calls
 * Useful for early validation before attempting resolution
 *
 * @param input - String to validate
 * @returns Object with validation result and error message
 */
export function validateIssueIdentifierFormat(input: string): {
  valid: boolean;
  format?: 'uuid' | 'identifier';
  error?: string;
} {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      valid: false,
      error: 'Issue identifier cannot be empty',
    };
  }

  if (looksLikeUUID(trimmedInput)) {
    return {
      valid: true,
      format: 'uuid',
    };
  }

  if (looksLikeIdentifier(trimmedInput)) {
    return {
      valid: true,
      format: 'identifier',
    };
  }

  // Invalid format - provide helpful error
  return {
    valid: false,
    error: `Invalid issue identifier format: "${trimmedInput}". Expected UUID or identifier format (e.g., ENG-123)`,
  };
}

/**
 * Clear the identifier cache
 * Useful for testing or when you need to force fresh lookups
 */
export function clearIssueCache(): void {
  identifierCache.clear();
}
