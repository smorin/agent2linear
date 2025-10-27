/**
 * Unified in-memory entity cache for linear-create CLI
 *
 * This module provides session-scoped caching for frequently accessed entities
 * (teams, initiatives, members, templates, labels) to reduce API calls.
 *
 * Cache Strategy:
 * - In-memory storage using Map (fast lookups)
 * - Session-scoped (cleared when command exits)
 * - TTL-based expiration (configurable, default 60 minutes)
 * - Lazy loading (fetch on first access)
 * - Automatic cache population via batch fetcher
 */

import { getConfig } from './config.js';
import {
  getAllTeams,
  getAllInitiatives,
  getAllMembers,
  getAllTemplates,
  Team,
  Initiative,
  Member,
  Template
} from './linear-client.js';
import { IssueLabel, ProjectLabel } from './types.js';
import {
  getCachedTeams,
  saveTeamsCache,
  getCachedInitiatives,
  saveInitiativesCache,
  getCachedMembers,
  saveMembersCache,
  getCachedTemplates,
  saveTemplatesCache,
} from './status-cache.js';

/**
 * Cached entity with timestamp
 */
interface CachedEntity<T> {
  data: T[];
  timestamp: number;
}

/**
 * Entity type for cache operations
 */
export type CacheableEntityType = 'teams' | 'initiatives' | 'members' | 'templates' | 'issue-labels' | 'project-labels';

/**
 * Unified entity cache class
 *
 * Provides in-memory caching for all entity types with TTL support.
 * Singleton pattern ensures single cache instance per session.
 */
export class EntityCache {
  private teams?: CachedEntity<Team>;
  private initiatives?: CachedEntity<Initiative>;
  private members?: CachedEntity<Member>;
  private templates?: CachedEntity<Template>;
  private issueLabels?: CachedEntity<IssueLabel>;
  private projectLabels?: CachedEntity<ProjectLabel>;

  /**
   * Get cache TTL in milliseconds from config
   */
  private getCacheTTL(): number {
    const config = getConfig();
    // Use entityCacheMinTTL if available, otherwise fall back to projectCacheMinTTL
    const minutes = config.entityCacheMinTTL || config.projectCacheMinTTL || 60; // Default: 60 minutes
    return minutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Check if entity cache is enabled in config
   */
  private isCacheEnabled(): boolean {
    const config = getConfig();
    // Default to true if not configured
    return config.enableEntityCache !== false && config.enableSessionCache !== false;
  }

  /**
   * Check if cached entity is still valid (not expired)
   */
  private isValid<T>(cached: CachedEntity<T> | undefined): boolean {
    if (!cached || !cached.data || cached.data.length === 0) {
      return false;
    }

    const now = Date.now();
    const ttl = this.getCacheTTL();

    return (now - cached.timestamp) < ttl;
  }

  /**
   * Get teams from cache or fetch from API
   *
   * @returns Array of teams
   */
  async getTeams(): Promise<Team[]> {
    const config = getConfig();

    // Check session cache first (in-memory)
    if (this.isCacheEnabled() && this.isValid(this.teams)) {
      return this.teams!.data;
    }

    // Check persistent cache (file-based) if enabled
    if (config.enablePersistentCache !== false) {
      try {
        const persistentTeams = await getCachedTeams();
        if (persistentTeams && persistentTeams.length > 0) {
          // Populate session cache from persistent cache
          const teams = persistentTeams.map(({ timestamp: _ts, ...team }) => team as Team);
          if (this.isCacheEnabled()) {
            this.teams = {
              data: teams,
              timestamp: persistentTeams[0].timestamp
            };
          }
          return teams;
        }
      } catch {
        // Ignore persistent cache errors, fall through to API fetch
      }
    }

    // Cache miss - fetch from API
    const teams = await getAllTeams();

    // Save to both session and persistent cache if enabled
    if (this.isCacheEnabled()) {
      const timestamp = Date.now();
      this.teams = {
        data: teams,
        timestamp
      };

      // Save to persistent cache if enabled
      if (config.enablePersistentCache !== false) {
        try {
          const cacheEntries = teams.map(team => ({ ...team, timestamp }));
          saveTeamsCache(cacheEntries);
        } catch {
          // Ignore persistent cache save errors
        }
      }
    }

    return teams;
  }

  /**
   * Get initiatives from cache or fetch from API
   *
   * @returns Array of initiatives
   */
  async getInitiatives(): Promise<Initiative[]> {
    const config = getConfig();

    // Check session cache first (in-memory)
    if (this.isCacheEnabled() && this.isValid(this.initiatives)) {
      return this.initiatives!.data;
    }

    // Check persistent cache (file-based) if enabled
    if (config.enablePersistentCache !== false) {
      try {
        const persistentInitiatives = await getCachedInitiatives();
        if (persistentInitiatives && persistentInitiatives.length > 0) {
          // Populate session cache from persistent cache
          const initiatives = persistentInitiatives.map(({ timestamp: _ts, ...initiative }) => initiative as Initiative);
          if (this.isCacheEnabled()) {
            this.initiatives = {
              data: initiatives,
              timestamp: persistentInitiatives[0].timestamp
            };
          }
          return initiatives;
        }
      } catch {
        // Ignore persistent cache errors, fall through to API fetch
      }
    }

    // Cache miss - fetch from API
    const initiatives = await getAllInitiatives();

    // Save to both session and persistent cache if enabled
    if (this.isCacheEnabled()) {
      const timestamp = Date.now();
      this.initiatives = {
        data: initiatives,
        timestamp
      };

      // Save to persistent cache if enabled
      if (config.enablePersistentCache !== false) {
        try {
          const cacheEntries = initiatives.map(initiative => ({ ...initiative, timestamp }));
          saveInitiativesCache(cacheEntries);
        } catch {
          // Ignore persistent cache save errors
        }
      }
    }

    return initiatives;
  }

  /**
   * Get members from cache or fetch from API
   *
   * @param options - Optional filter options (teamId, activeOnly, etc.)
   * @returns Array of members
   *
   * Note: If teamId filter is provided, cache is bypassed and API is called directly.
   * This is because Linear API returns different member sets for team.members() vs client.users(),
   * and Member type doesn't include teamIds for client-side filtering.
   */
  async getMembers(options?: { teamId?: string }): Promise<Member[]> {
    const config = getConfig();

    // If team filter is specified, bypass cache and call API directly
    // This is necessary because Linear's team.members() returns different data than client.users()
    if (options?.teamId) {
      return await getAllMembers(options);
    }

    // Check session cache first (in-memory) - only for unfiltered requests
    if (this.isCacheEnabled() && this.isValid(this.members)) {
      return this.members!.data;
    }

    // Check persistent cache (file-based) if enabled
    if (config.enablePersistentCache !== false) {
      try {
        const persistentMembers = await getCachedMembers();
        if (persistentMembers && persistentMembers.length > 0) {
          // Populate session cache from persistent cache
          const members = persistentMembers.map(({ timestamp: _ts, ...member }) => member as Member);
          if (this.isCacheEnabled()) {
            this.members = {
              data: members,
              timestamp: persistentMembers[0].timestamp
            };
          }
          return members;
        }
      } catch {
        // Ignore persistent cache errors, fall through to API fetch
      }
    }

    // Cache miss - fetch ALL members from API (no filters)
    const members = await getAllMembers();

    // Save to both session and persistent cache if enabled
    if (this.isCacheEnabled()) {
      const timestamp = Date.now();
      this.members = {
        data: members,
        timestamp
      };

      // Save to persistent cache if enabled
      if (config.enablePersistentCache !== false) {
        try {
          const cacheEntries = members.map(member => ({ ...member, timestamp }));
          saveMembersCache(cacheEntries);
        } catch {
          // Ignore persistent cache save errors
        }
      }
    }

    return members;
  }

  /**
   * Get templates from cache or fetch from API
   *
   * @returns Array of templates
   */
  async getTemplates(): Promise<Template[]> {
    const config = getConfig();

    // Check session cache first (in-memory)
    if (this.isCacheEnabled() && this.isValid(this.templates)) {
      return this.templates!.data;
    }

    // Check persistent cache (file-based) if enabled
    if (config.enablePersistentCache !== false) {
      try {
        const persistentTemplates = await getCachedTemplates();
        if (persistentTemplates && persistentTemplates.length > 0) {
          // Populate session cache from persistent cache
          const templates = persistentTemplates.map(({ timestamp: _ts, ...template }) => template as Template);
          if (this.isCacheEnabled()) {
            this.templates = {
              data: templates,
              timestamp: persistentTemplates[0].timestamp
            };
          }
          return templates;
        }
      } catch {
        // Ignore persistent cache errors, fall through to API fetch
      }
    }

    // Cache miss - fetch from API
    const templates = await getAllTemplates();

    // Save to both session and persistent cache if enabled
    if (this.isCacheEnabled()) {
      const timestamp = Date.now();
      this.templates = {
        data: templates,
        timestamp
      };

      // Save to persistent cache if enabled
      if (config.enablePersistentCache !== false) {
        try {
          const cacheEntries = templates.map(template => ({ ...template, timestamp }));
          saveTemplatesCache(cacheEntries);
        } catch {
          // Ignore persistent cache save errors
        }
      }
    }

    return templates;
  }

  /**
   * Find team by ID
   *
   * @param id - Team ID
   * @returns Team or null if not found
   */
  async findTeamById(id: string): Promise<Team | null> {
    const teams = await this.getTeams();
    return teams.find(t => t.id === id) || null;
  }

  /**
   * Find team by name
   *
   * @param name - Team name (case-sensitive)
   * @returns Team or null if not found
   */
  async findTeamByName(name: string): Promise<Team | null> {
    const teams = await this.getTeams();
    return teams.find(t => t.name === name) || null;
  }

  /**
   * Find team by key
   *
   * @param key - Team key (e.g., "ENG")
   * @returns Team or null if not found
   */
  async findTeamByKey(key: string): Promise<Team | null> {
    const teams = await this.getTeams();
    return teams.find(t => t.key === key) || null;
  }

  /**
   * Find initiative by ID
   *
   * @param id - Initiative ID
   * @returns Initiative or null if not found
   */
  async findInitiativeById(id: string): Promise<Initiative | null> {
    const initiatives = await this.getInitiatives();
    return initiatives.find(i => i.id === id) || null;
  }

  /**
   * Find initiative by name
   *
   * @param name - Initiative name (case-sensitive)
   * @returns Initiative or null if not found
   */
  async findInitiativeByName(name: string): Promise<Initiative | null> {
    const initiatives = await this.getInitiatives();
    return initiatives.find(i => i.name === name) || null;
  }

  /**
   * Find member by ID
   *
   * @param id - Member ID
   * @returns Member or null if not found
   */
  async findMemberById(id: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find(m => m.id === id) || null;
  }

  /**
   * Find member by email
   *
   * @param email - Member email (case-insensitive)
   * @returns Member or null if not found
   */
  async findMemberByEmail(email: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find(m => m.email.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Find member by name
   *
   * @param name - Member name or display name (case-insensitive)
   * @returns Member or null if not found
   */
  async findMemberByName(name: string): Promise<Member | null> {
    const members = await this.getMembers();
    const lowerName = name.toLowerCase();
    return members.find(m =>
      m.name.toLowerCase() === lowerName ||
      (m.displayName && m.displayName.toLowerCase() === lowerName)
    ) || null;
  }

  /**
   * Find template by ID
   *
   * @param id - Template ID
   * @returns Template or null if not found
   */
  async findTemplateById(id: string): Promise<Template | null> {
    const templates = await this.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Find template by name and type
   *
   * @param name - Template name (case-sensitive)
   * @param type - Template type ('issue' or 'project')
   * @returns Template or null if not found
   */
  async findTemplateByName(name: string, type: 'issue' | 'project'): Promise<Template | null> {
    const templates = await this.getTemplates();
    return templates.find(t => t.name === name && t.type === type) || null;
  }

  /**
   * Clear all cached entities
   *
   * Use this when you want to force a fresh fetch on next access.
   */
  clear(): void {
    this.teams = undefined;
    this.initiatives = undefined;
    this.members = undefined;
    this.templates = undefined;
    this.issueLabels = undefined;
    this.projectLabels = undefined;
  }

  /**
   * Clear specific entity type from cache
   *
   * @param type - Entity type to clear
   */
  clearEntity(type: CacheableEntityType): void {
    switch (type) {
      case 'teams':
        this.teams = undefined;
        break;
      case 'initiatives':
        this.initiatives = undefined;
        break;
      case 'members':
        this.members = undefined;
        break;
      case 'templates':
        this.templates = undefined;
        break;
      case 'issue-labels':
        this.issueLabels = undefined;
        break;
      case 'project-labels':
        this.projectLabels = undefined;
        break;
    }
  }

  /**
   * Invalidate expired cache entries
   *
   * Checks all cached entities and clears those that have expired.
   * This is called automatically on access, but can be called manually.
   */
  invalidateIfExpired(): void {
    if (!this.isValid(this.teams)) {
      this.teams = undefined;
    }
    if (!this.isValid(this.initiatives)) {
      this.initiatives = undefined;
    }
    if (!this.isValid(this.members)) {
      this.members = undefined;
    }
    if (!this.isValid(this.templates)) {
      this.templates = undefined;
    }
    if (!this.isValid(this.issueLabels)) {
      this.issueLabels = undefined;
    }
    if (!this.isValid(this.projectLabels)) {
      this.projectLabels = undefined;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache hit/miss info
   */
  getStats(): {
    teams: { cached: boolean; count: number; age?: number };
    initiatives: { cached: boolean; count: number; age?: number };
    members: { cached: boolean; count: number; age?: number };
    templates: { cached: boolean; count: number; age?: number };
  } {
    const now = Date.now();

    return {
      teams: {
        cached: this.isValid(this.teams),
        count: this.teams?.data.length || 0,
        age: this.teams ? now - this.teams.timestamp : undefined
      },
      initiatives: {
        cached: this.isValid(this.initiatives),
        count: this.initiatives?.data.length || 0,
        age: this.initiatives ? now - this.initiatives.timestamp : undefined
      },
      members: {
        cached: this.isValid(this.members),
        count: this.members?.data.length || 0,
        age: this.members ? now - this.members.timestamp : undefined
      },
      templates: {
        cached: this.isValid(this.templates),
        count: this.templates?.data.length || 0,
        age: this.templates ? now - this.templates.timestamp : undefined
      }
    };
  }
}

/**
 * Singleton instance of EntityCache
 */
let cacheInstance: EntityCache | null = null;

/**
 * Get the singleton EntityCache instance
 *
 * @returns EntityCache instance
 *
 * @example
 * ```typescript
 * const cache = getEntityCache();
 * const teams = await cache.getTeams();
 * const team = await cache.findTeamById("team_abc123");
 * ```
 */
export function getEntityCache(): EntityCache {
  if (!cacheInstance) {
    cacheInstance = new EntityCache();
  }
  return cacheInstance;
}

/**
 * Clear the singleton cache instance
 *
 * Use this for testing or when you need a fresh cache.
 */
export function clearGlobalCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}
