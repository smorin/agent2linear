import { isAuthenticationError } from '../cli-error.js';
import { getLinearClient, LinearClientError } from './client.js';

/**
 * Get all cycles, optionally filtered by team
 */
export async function getAllCycles(teamId?: string): Promise<Array<{
  id: string;
  name: string;
  number: number;
  startsAt?: string;
  endsAt?: string;
  teamId?: string;
  teamName?: string;
}>> {
  try {
    const client = getLinearClient();
    let cycles;
    if (teamId) {
      const team = await client.team(teamId);
      cycles = await team.cycles();
    } else {
      cycles = await client.cycles();
    }

    const results = [];
    for (const cycle of cycles.nodes) {
      const team = await cycle.team;
      results.push({
        id: cycle.id,
        name: cycle.name || `Cycle ${cycle.number}`,
        number: cycle.number,
        startsAt: cycle.startsAt instanceof Date ? cycle.startsAt.toISOString().split('T')[0] : undefined,
        endsAt: cycle.endsAt instanceof Date ? cycle.endsAt.toISOString().split('T')[0] : undefined,
        teamId: team?.id,
        teamName: team?.name,
      });
    }
    return results;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new LinearClientError(
      `Failed to fetch cycles: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
    if (isAuthenticationError(error)) throw error;
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
    if (isAuthenticationError(error)) throw error;
    return null;
  }
}
