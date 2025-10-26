import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveAlias } from './aliases.js';
import { findProjectByName, getProjectById } from './linear-client.js';
import { getConfig } from './config.js';
import type { ProjectResult } from './linear-client.js';

const PROJECT_CACHE_DIR = '.linear-create';
const PROJECT_CACHE_FILE = join(PROJECT_CACHE_DIR, 'project-cache.json');

interface CacheEntry {
  projectId: string;
  projectName: string;
  timestamp: number;
}

interface ProjectCache {
  byName: { [name: string]: CacheEntry };
  byId: { [id: string]: CacheEntry };
}

/**
 * Read project cache from file
 */
function readCache(): ProjectCache {
  try {
    if (!existsSync(PROJECT_CACHE_FILE)) {
      return { byName: {}, byId: {} };
    }
    const content = readFileSync(PROJECT_CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { byName: {}, byId: {} };
  }
}

/**
 * Write project cache to file
 */
function writeCache(cache: ProjectCache): void {
  try {
    if (!existsSync(PROJECT_CACHE_DIR)) {
      mkdirSync(PROJECT_CACHE_DIR, { recursive: true });
    }
    writeFileSync(PROJECT_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Get cache TTL in milliseconds from config
 */
function getCacheTTL(): number {
  const config = getConfig();
  const minutes = config.projectCacheMinTTL || 60; // Default: 60 minutes
  return minutes * 60 * 1000; // Convert to milliseconds
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  const now = Date.now();
  const ttl = getCacheTTL();
  return (now - entry.timestamp) < ttl;
}

/**
 * Add project to cache
 */
function addToCache(project: ProjectResult): void {
  const cache = readCache();
  const entry: CacheEntry = {
    projectId: project.id,
    projectName: project.name,
    timestamp: Date.now(),
  };

  cache.byName[project.name.toLowerCase()] = entry;
  cache.byId[project.id] = entry;

  writeCache(cache);
}

/**
 * Get project ID from cache by name
 */
function getFromCacheByName(name: string): string | null {
  const cache = readCache();
  const entry = cache.byName[name.toLowerCase()];

  if (entry && isCacheValid(entry)) {
    return entry.projectId;
  }

  return null;
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const cache = readCache();

  // Filter out expired entries
  const validByName: { [name: string]: CacheEntry } = {};
  const validById: { [id: string]: CacheEntry } = {};

  for (const [name, entry] of Object.entries(cache.byName)) {
    if (isCacheValid(entry)) {
      validByName[name] = entry;
    }
  }

  for (const [id, entry] of Object.entries(cache.byId)) {
    if (isCacheValid(entry)) {
      validById[id] = entry;
    }
  }

  writeCache({ byName: validByName, byId: validById });
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  writeCache({ byName: {}, byId: {} });
}

/**
 * Check if input looks like a Linear project ID
 */
function looksLikeProjectId(input: string): boolean {
  // UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  if (isUuid) {
    return true;
  }

  // proj_ prefix format
  const lowerInput = input.toLowerCase();
  return lowerInput.startsWith('proj_');
}

export interface ResolveOptions {
  /** Skip cache and always lookup from API */
  skipCache?: boolean;
  /** Create an alias automatically if project is found by name */
  autoAlias?: boolean;
  /** Alias name to use (defaults to lowercase project name) */
  aliasName?: string;
  /** Scope for auto-created alias */
  aliasScope?: 'global' | 'project';
}

export interface ResolveResult {
  /** The resolved project ID */
  projectId: string;
  /** Full project details (if fetched) */
  project?: ProjectResult;
  /** How the project was resolved */
  resolvedBy: 'id' | 'alias' | 'name' | 'cache';
  /** Original input value */
  originalInput: string;
  /** If an alias was used, the alias name */
  usedAlias?: string;
  /** If auto-alias was created */
  createdAlias?: {
    alias: string;
    scope: 'global' | 'project';
  };
}

/**
 * Smart project resolver with fallback chain:
 * 1. Check if input is already a valid project ID → use it
 * 2. Try to resolve as alias → get ID
 * 3. Check cache by name → get ID
 * 4. Search by name via API → get ID and project details
 * 5. If nothing works, return error
 */
export async function resolveProject(
  input: string,
  options: ResolveOptions = {}
): Promise<ResolveResult | null> {
  const originalInput = input.trim();

  // Step 1: Check if it's already a project ID
  if (looksLikeProjectId(originalInput)) {
    const project = await getProjectById(originalInput);
    if (project) {
      // Add to cache
      if (!options.skipCache) {
        addToCache(project);
      }
      return {
        projectId: originalInput,
        project,
        resolvedBy: 'id',
        originalInput,
      };
    }
    // ID format but not found - continue to other methods
  }

  // Step 2: Try to resolve as alias
  const resolvedFromAlias = resolveAlias('project', originalInput);
  if (resolvedFromAlias !== originalInput) {
    // Alias was resolved
    const project = await getProjectById(resolvedFromAlias);
    if (project) {
      // Add to cache
      if (!options.skipCache) {
        addToCache(project);
      }
      return {
        projectId: resolvedFromAlias,
        project,
        resolvedBy: 'alias',
        originalInput,
        usedAlias: originalInput,
      };
    }
  }

  // Step 3: Check cache by name (if not skipped)
  if (!options.skipCache) {
    const cachedId = getFromCacheByName(originalInput);
    if (cachedId) {
      const project = await getProjectById(cachedId);
      if (project) {
        return {
          projectId: cachedId,
          project,
          resolvedBy: 'cache',
          originalInput,
        };
      }
    }
  }

  // Step 4: Search by name via API
  const projectByName = await findProjectByName(originalInput);
  if (projectByName) {
    // Add to cache
    if (!options.skipCache) {
      addToCache(projectByName);
    }

    const result: ResolveResult = {
      projectId: projectByName.id,
      project: projectByName,
      resolvedBy: 'name',
      originalInput,
    };

    // Auto-alias if requested
    if (options.autoAlias) {
      const { addAlias } = await import('./aliases.js');
      const aliasName = options.aliasName || originalInput.toLowerCase().replace(/\s+/g, '-');
      const scope = options.aliasScope || 'project';

      const aliasResult = await addAlias('project', aliasName, projectByName.id, scope, {
        skipValidation: true, // We already validated by finding the project
      });

      if (aliasResult.success) {
        result.createdAlias = {
          alias: aliasName,
          scope,
        };
      }
    }

    return result;
  }

  // Step 5: Nothing worked
  return null;
}

/**
 * Resolve project and return just the ID (simpler interface)
 */
export async function resolveProjectId(
  input: string,
  options: ResolveOptions = {}
): Promise<string | null> {
  const result = await resolveProject(input, options);
  return result ? result.projectId : null;
}
