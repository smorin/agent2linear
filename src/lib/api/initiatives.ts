import { isAuthenticationError } from '../cli-error.js';
import { getLinearClient, LinearClientError } from './client.js';

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
 * Validate initiative ID exists and return its details
 */
export async function validateInitiativeExists(
  initiativeId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    // Use entity cache instead of direct API call
    const { getEntityCache } = await import('../entity-cache.js');
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
    if (isAuthenticationError(error)) throw error;
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
