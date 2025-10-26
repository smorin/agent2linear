import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getConfig } from './config.js';
import { getAllProjectStatuses } from './linear-client.js';

const CACHE_DIR = '.linear-create';
const CACHE_FILE = join(CACHE_DIR, 'cache.json');

export interface ProjectStatusCacheEntry {
  id: string;
  name: string;
  type: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  color: string;
  position: number;
  timestamp: number;
}

interface Cache {
  projectStatuses?: ProjectStatusCacheEntry[];
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
 * Read cache from file
 */
function readCache(): Cache {
  try {
    if (!existsSync(CACHE_FILE)) {
      return {};
    }
    const content = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write cache to file
 */
function writeCache(cache: Cache): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Check if cache is valid (not expired)
 */
function isCacheValid(statuses: ProjectStatusCacheEntry[]): boolean {
  if (!statuses || statuses.length === 0) {
    return false;
  }

  const now = Date.now();
  const ttl = getCacheTTL();

  // Check if any entry is expired
  // All entries have the same timestamp (set when cache is refreshed)
  return statuses.every(entry => (now - entry.timestamp) < ttl);
}

/**
 * Load project statuses from cache
 */
export function loadStatusCache(): ProjectStatusCacheEntry[] {
  const cache = readCache();
  return cache.projectStatuses || [];
}

/**
 * Save project statuses to cache
 */
export function saveStatusCache(statuses: ProjectStatusCacheEntry[]): void {
  const cache = readCache();
  cache.projectStatuses = statuses;
  writeCache(cache);
}

/**
 * Find status by ID
 */
export function findStatusById(id: string): ProjectStatusCacheEntry | null {
  const statuses = loadStatusCache();
  return statuses.find(s => s.id === id) || null;
}

/**
 * Find status by name (case-insensitive)
 */
export function findStatusByName(name: string): ProjectStatusCacheEntry | null {
  const statuses = loadStatusCache();
  const lowerName = name.toLowerCase();
  return statuses.find(s => s.name.toLowerCase() === lowerName) || null;
}

/**
 * Refresh cache from API
 */
export async function refreshStatusCache(): Promise<ProjectStatusCacheEntry[]> {
  try {
    const statuses = await getAllProjectStatuses();
    const timestamp = Date.now();

    const cacheEntries: ProjectStatusCacheEntry[] = statuses.map(status => ({
      id: status.id,
      name: status.name,
      type: status.type,
      color: status.color,
      position: status.position,
      timestamp,
    }));

    saveStatusCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh status cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get project statuses (from cache or refresh if expired)
 */
export async function getProjectStatuses(): Promise<ProjectStatusCacheEntry[]> {
  const cached = loadStatusCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshStatusCache();
}

/**
 * Clear all status cache
 */
export function clearStatusCache(): void {
  const cache = readCache();
  delete cache.projectStatuses;
  writeCache(cache);
}

/**
 * Resolve project status by name or ID
 * Returns the status ID if found
 */
export async function resolveProjectStatusId(input: string): Promise<string | null> {
  // Check if it looks like a status ID
  if (input.startsWith('status_') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    return input;
  }

  // Try to find by name in cache
  const statuses = await getProjectStatuses();
  const found = statuses.find(s => s.name.toLowerCase() === input.toLowerCase());

  return found ? found.id : null;
}
