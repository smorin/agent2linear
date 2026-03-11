/**
 * Batch fetching utilities for agent2linear CLI
 *
 * This module provides batch API call strategies to populate the entity cache
 * with multiple entities in parallel, significantly reducing API call overhead.
 *
 * Strategy:
 * - Fetch multiple entities in parallel using Promise.all
 * - Populate entity cache automatically
 * - Error handling for individual fetch failures (don't fail entire batch)
 * - Prewarm functions for common operations (create, update)
 */

import { getConfig } from './config.js';
import { getEntityCache } from './entity-cache.js';
import { Initiative, Member, Team, Template } from './linear-client.js';

/**
 * Batch fetch options
 */
export interface BatchFetchOptions {
  teams?: boolean;
  initiatives?: boolean;
  members?: boolean | { teamId?: string };
  templates?: boolean;
  statuses?: boolean; // Project statuses (already cached separately)
  labels?: boolean | { type: 'issue' | 'project' };
}

/**
 * Batch fetch result
 */
export interface BatchFetchResult {
  teams?: Team[];
  initiatives?: Initiative[];
  members?: Member[];
  templates?: Template[];
  errors?: string[];
}

/**
 * Batch fetch multiple entities in parallel
 *
 * Fetches requested entities concurrently and populates the entity cache.
 * Individual fetch failures don't fail the entire batch - errors are collected
 * and returned.
 *
 * @param options - Which entities to fetch
 * @returns Object with fetched entities and any errors
 *
 * @example
 * ```typescript
 * const result = await batchFetchEntities({
 *   teams: true,
 *   initiatives: true,
 *   members: true
 * });
 *
 * console.log(`Fetched ${result.teams?.length} teams`);
 * if (result.errors?.length) {
 *   console.error('Some fetches failed:', result.errors);
 * }
 * ```
 */
export async function batchFetchEntities(
  options: BatchFetchOptions
): Promise<BatchFetchResult> {
  const config = getConfig();
  const cache = getEntityCache();
  const errors: string[] = [];
  const promises: Promise<void>[] = [];

  const result: BatchFetchResult = {};

  // If batch fetching is disabled, fetch sequentially instead
  const isBatchEnabled = config.enableBatchFetching !== false;

  // Build array of fetch promises
  if (options.teams) {
    promises.push(
      cache.getTeams()
        .then(teams => {
          result.teams = teams;
        })
        .catch(error => {
          errors.push(`Failed to fetch teams: ${error instanceof Error ? error.message : 'Unknown error'}`);
        })
    );
  }

  if (options.initiatives) {
    promises.push(
      cache.getInitiatives()
        .then(initiatives => {
          result.initiatives = initiatives;
        })
        .catch(error => {
          errors.push(`Failed to fetch initiatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
        })
    );
  }

  if (options.members) {
    const memberOptions = typeof options.members === 'object' ? options.members : undefined;
    promises.push(
      cache.getMembers(memberOptions)
        .then(members => {
          result.members = members;
        })
        .catch(error => {
          errors.push(`Failed to fetch members: ${error instanceof Error ? error.message : 'Unknown error'}`);
        })
    );
  }

  if (options.templates) {
    promises.push(
      cache.getTemplates()
        .then(templates => {
          result.templates = templates;
        })
        .catch(error => {
          errors.push(`Failed to fetch templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
        })
    );
  }

  // Fetch all in parallel or sequentially based on config
  if (isBatchEnabled) {
    await Promise.all(promises);
  } else {
    // Sequential fetching when batch is disabled
    for (const promise of promises) {
      await promise;
    }
  }

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Prewarm cache for project creation
 *
 * Fetches all entities typically needed for project creation in parallel:
 * - Teams (for --team validation)
 * - Initiatives (for --initiative validation)
 * - Templates (for --template validation)
 * - Members (for --lead and --members validation)
 *
 * This reduces subsequent validation API calls to near-zero.
 *
 * @returns Batch fetch result
 *
 * @example
 * ```typescript
 * // At start of project create command
 * console.log('🔄 Loading workspace data...');
 * await prewarmProjectCreation();
 * // Now all validation lookups use cache (0 API calls)
 * ```
 */
export async function prewarmProjectCreation(): Promise<BatchFetchResult> {
  return batchFetchEntities({
    teams: true,
    initiatives: true,
    templates: true,
    members: true
    // Note: Statuses are already cached by status-cache.ts
  });
}

/**
 * Prewarm cache for project update
 *
 * Lighter version of prewarmProjectCreation that only fetches entities
 * commonly used in updates. Skips templates and initiatives since they
 * cannot be changed after project creation.
 *
 * @returns Batch fetch result
 *
 * @example
 * ```typescript
 * // At start of project update command
 * if (options.status || options.team || options.members) {
 *   console.log('🔄 Loading workspace data...');
 *   await prewarmProjectUpdate();
 * }
 * ```
 */
export async function prewarmProjectUpdate(): Promise<BatchFetchResult> {
  return batchFetchEntities({
    teams: true,
    members: true
    // Statuses already cached, templates/initiatives not updatable
  });
}

/**
 * Prewarm cache for specific entity types
 *
 * Allows selective cache warming for specific operations.
 *
 * @param entityTypes - Array of entity types to prewarm
 * @returns Batch fetch result
 *
 * @example
 * ```typescript
 * // Prewarm only teams and members
 * await prewarmEntities(['teams', 'members']);
 * ```
 */
export async function prewarmEntities(
  entityTypes: Array<'teams' | 'initiatives' | 'members' | 'templates'>
): Promise<BatchFetchResult> {
  const options: BatchFetchOptions = {};

  for (const type of entityTypes) {
    switch (type) {
      case 'teams':
        options.teams = true;
        break;
      case 'initiatives':
        options.initiatives = true;
        break;
      case 'members':
        options.members = true;
        break;
      case 'templates':
        options.templates = true;
        break;
    }
  }

  return batchFetchEntities(options);
}

/**
 * Clear and repopulate cache
 *
 * Useful when you know entities have changed and want fresh data.
 *
 * @param options - Which entities to refetch
 * @returns Batch fetch result
 *
 * @example
 * ```typescript
 * // After creating a new team, refresh the teams cache
 * await refreshCache({ teams: true });
 * ```
 */
export async function refreshCache(
  options: BatchFetchOptions
): Promise<BatchFetchResult> {
  const cache = getEntityCache();

  // Clear requested entities
  if (options.teams) cache.clearEntity('teams');
  if (options.initiatives) cache.clearEntity('initiatives');
  if (options.members) cache.clearEntity('members');
  if (options.templates) cache.clearEntity('templates');

  // Refetch
  return batchFetchEntities(options);
}

/**
 * Check cache status without fetching
 *
 * Returns information about what's currently cached without triggering API calls.
 *
 * @returns Cache statistics
 *
 * @example
 * ```typescript
 * const stats = getCacheStatus();
 * console.log(`Teams cached: ${stats.teams.cached} (${stats.teams.count} items)`);
 * ```
 */
export function getCacheStatus(): {
  teams: { cached: boolean; count: number; age?: number };
  initiatives: { cached: boolean; count: number; age?: number };
  members: { cached: boolean; count: number; age?: number };
  templates: { cached: boolean; count: number; age?: number };
} {
  const cache = getEntityCache();
  return cache.getStats();
}
