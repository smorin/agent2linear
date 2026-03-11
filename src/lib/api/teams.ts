import { getLinearClient, LinearClientError } from './client.js';

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
 * Validate team ID exists and return its details
 */
export async function validateTeamExists(
  teamId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('../entity-cache.js');
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
