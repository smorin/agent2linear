import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getApiKey, getConfig } from './config.js';
import {
  getAllInitiatives,
  getAllIssueLabels,
  getAllMembers,
  getAllProjectLabels,
  getAllProjectStatuses,
  getAllTeams,
  getAllTemplates,
  getAllWorkflowStates,
  type Initiative,
  type Member,
  type Team,
  type Template
} from './linear-client.js';
import type {
  IssueLabel,
  ProjectLabel,
  WorkflowState} from './types.js';
import { cleanupLegacyProjectCaches, workspaceCacheDir } from './xdg-paths.js';

const CACHE_FILENAME = 'cache.json';
let legacyCleaned = false;

function cacheDir(): string {
  return workspaceCacheDir(getApiKey());
}

function cacheFile(): string {
  return join(cacheDir(), CACHE_FILENAME);
}

function ensureLegacyCleaned(): void {
  if (legacyCleaned) return;
  legacyCleaned = true;
  cleanupLegacyProjectCaches();
}

export interface ProjectStatusCacheEntry {
  id: string;
  name: string;
  type: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  color: string;
  position: number;
  timestamp: number;
}

export interface TeamCacheEntry extends Team {
  timestamp: number;
}

export interface InitiativeCacheEntry extends Initiative {
  timestamp: number;
}

export interface MemberCacheEntry extends Member {
  timestamp: number;
}

export interface TemplateCacheEntry extends Template {
  timestamp: number;
}

export interface WorkflowStateCacheEntry extends WorkflowState {
  timestamp: number;
}

export interface IssueLabelCacheEntry extends IssueLabel {
  timestamp: number;
}

export interface ProjectLabelCacheEntry extends ProjectLabel {
  timestamp: number;
}

interface Cache {
  projectStatuses?: ProjectStatusCacheEntry[];
  teams?: TeamCacheEntry[];
  initiatives?: InitiativeCacheEntry[];
  members?: MemberCacheEntry[];
  templates?: TemplateCacheEntry[];
  workflowStates?: WorkflowStateCacheEntry[];
  issueLabels?: IssueLabelCacheEntry[];
  projectLabels?: ProjectLabelCacheEntry[];
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
  ensureLegacyCleaned();
  try {
    const file = cacheFile();
    if (!existsSync(file)) {
      return {};
    }
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Write cache to file
 */
function writeCache(cache: Cache): void {
  ensureLegacyCleaned();
  try {
    const dir = cacheDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(dir, CACHE_FILENAME), JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Check if cache is valid (not expired)
 */
function isCacheValid<T extends { timestamp: number }>(entries: T[]): boolean {
  if (!entries || entries.length === 0) {
    return false;
  }

  const config = getConfig();

  // Check if persistent cache is disabled
  if (config.enablePersistentCache === false) {
    return false;
  }

  const now = Date.now();
  const ttl = getCacheTTL();

  // Check if any entry is expired
  // All entries have the same timestamp (set when cache is refreshed)
  return entries.every(entry => (now - entry.timestamp) < ttl);
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

// ============================================================================
// Teams Cache
// ============================================================================

/**
 * Load teams from cache
 */
export function loadTeamsCache(): TeamCacheEntry[] {
  const cache = readCache();
  return cache.teams || [];
}

/**
 * Save teams to cache
 */
export function saveTeamsCache(teams: TeamCacheEntry[]): void {
  const cache = readCache();
  cache.teams = teams;
  writeCache(cache);
}

/**
 * Refresh teams cache from API
 */
export async function refreshTeamsCache(): Promise<TeamCacheEntry[]> {
  try {
    const teams = await getAllTeams();
    const timestamp = Date.now();

    const cacheEntries: TeamCacheEntry[] = teams.map(team => ({
      ...team,
      timestamp,
    }));

    saveTeamsCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh teams cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get teams (from cache or refresh if expired)
 */
export async function getCachedTeams(): Promise<TeamCacheEntry[]> {
  const cached = loadTeamsCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshTeamsCache();
}

/**
 * Clear teams cache
 */
export function clearTeamsCache(): void {
  const cache = readCache();
  delete cache.teams;
  writeCache(cache);
}

// ============================================================================
// Initiatives Cache
// ============================================================================

/**
 * Load initiatives from cache
 */
export function loadInitiativesCache(): InitiativeCacheEntry[] {
  const cache = readCache();
  return cache.initiatives || [];
}

/**
 * Save initiatives to cache
 */
export function saveInitiativesCache(initiatives: InitiativeCacheEntry[]): void {
  const cache = readCache();
  cache.initiatives = initiatives;
  writeCache(cache);
}

/**
 * Refresh initiatives cache from API
 */
export async function refreshInitiativesCache(): Promise<InitiativeCacheEntry[]> {
  try {
    const initiatives = await getAllInitiatives();
    const timestamp = Date.now();

    const cacheEntries: InitiativeCacheEntry[] = initiatives.map(initiative => ({
      ...initiative,
      timestamp,
    }));

    saveInitiativesCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh initiatives cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get initiatives (from cache or refresh if expired)
 */
export async function getCachedInitiatives(): Promise<InitiativeCacheEntry[]> {
  const cached = loadInitiativesCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshInitiativesCache();
}

/**
 * Clear initiatives cache
 */
export function clearInitiativesCache(): void {
  const cache = readCache();
  delete cache.initiatives;
  writeCache(cache);
}

// ============================================================================
// Members Cache
// ============================================================================

/**
 * Load members from cache
 */
export function loadMembersCache(): MemberCacheEntry[] {
  const cache = readCache();
  return cache.members || [];
}

/**
 * Save members to cache
 */
export function saveMembersCache(members: MemberCacheEntry[]): void {
  const cache = readCache();
  cache.members = members;
  writeCache(cache);
}

/**
 * Refresh members cache from API
 */
export async function refreshMembersCache(): Promise<MemberCacheEntry[]> {
  try {
    const members = await getAllMembers();
    const timestamp = Date.now();

    const cacheEntries: MemberCacheEntry[] = members.map(member => ({
      ...member,
      timestamp,
    }));

    saveMembersCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh members cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get members (from cache or refresh if expired)
 */
export async function getCachedMembers(): Promise<MemberCacheEntry[]> {
  const cached = loadMembersCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshMembersCache();
}

/**
 * Clear members cache
 */
export function clearMembersCache(): void {
  const cache = readCache();
  delete cache.members;
  writeCache(cache);
}

// ============================================================================
// Templates Cache
// ============================================================================

/**
 * Load templates from cache
 */
export function loadTemplatesCache(): TemplateCacheEntry[] {
  const cache = readCache();
  return cache.templates || [];
}

/**
 * Save templates to cache
 */
export function saveTemplatesCache(templates: TemplateCacheEntry[]): void {
  const cache = readCache();
  cache.templates = templates;
  writeCache(cache);
}

/**
 * Refresh templates cache from API
 */
export async function refreshTemplatesCache(): Promise<TemplateCacheEntry[]> {
  try {
    const templates = await getAllTemplates();
    const timestamp = Date.now();

    const cacheEntries: TemplateCacheEntry[] = templates.map(template => ({
      ...template,
      timestamp,
    }));

    saveTemplatesCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh templates cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get templates (from cache or refresh if expired)
 */
export async function getCachedTemplates(): Promise<TemplateCacheEntry[]> {
  const cached = loadTemplatesCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshTemplatesCache();
}

/**
 * Clear templates cache
 */
export function clearTemplatesCache(): void {
  const cache = readCache();
  delete cache.templates;
  writeCache(cache);
}

// ============================================================================
// Workflow States Cache
// ============================================================================

/**
 * Load workflow states from cache
 */
export function loadWorkflowStatesCache(): WorkflowStateCacheEntry[] {
  const cache = readCache();
  return cache.workflowStates || [];
}

/**
 * Save workflow states to cache
 */
export function saveWorkflowStatesCache(workflowStates: WorkflowStateCacheEntry[]): void {
  const cache = readCache();
  cache.workflowStates = workflowStates;
  writeCache(cache);
}

/**
 * Refresh workflow states cache from API
 */
export async function refreshWorkflowStatesCache(teamId?: string): Promise<WorkflowStateCacheEntry[]> {
  try {
    const workflowStates = await getAllWorkflowStates(teamId);
    const timestamp = Date.now();

    const cacheEntries: WorkflowStateCacheEntry[] = workflowStates.map(state => ({
      ...state,
      timestamp,
    }));

    saveWorkflowStatesCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh workflow states cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get workflow states (from cache or refresh if expired)
 */
export async function getCachedWorkflowStates(teamId?: string): Promise<WorkflowStateCacheEntry[]> {
  const cached = loadWorkflowStatesCache();

  // If team filter is provided, always fetch from API (don't use cache for filtered results)
  if (teamId) {
    const workflowStates = await getAllWorkflowStates(teamId);
    const timestamp = Date.now();
    return workflowStates.map(state => ({
      ...state,
      timestamp,
    }));
  }

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshWorkflowStatesCache();
}

/**
 * Clear workflow states cache
 */
export function clearWorkflowStatesCache(): void {
  const cache = readCache();
  delete cache.workflowStates;
  writeCache(cache);
}

/**
 * Resolve workflow state by name or ID
 * Returns the workflow state ID if found
 */
export async function resolveWorkflowStateId(input: string, teamId?: string): Promise<string | null> {
  // Check if it looks like a workflow state ID
  if (input.startsWith('workflowState_') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)) {
    return input;
  }

  // Try to find by name in cache
  const workflowStates = await getCachedWorkflowStates(teamId);
  const found = workflowStates.find(s => s.name.toLowerCase() === input.toLowerCase());

  return found ? found.id : null;
}

// ============================================================================
// Issue Labels Cache
// ============================================================================

/**
 * Load issue labels from cache
 */
export function loadIssueLabelsCache(): IssueLabelCacheEntry[] {
  const cache = readCache();
  return cache.issueLabels || [];
}

/**
 * Save issue labels to cache
 */
export function saveIssueLabelsCache(issueLabels: IssueLabelCacheEntry[]): void {
  const cache = readCache();
  cache.issueLabels = issueLabels;
  writeCache(cache);
}

/**
 * Refresh issue labels cache from API
 */
export async function refreshIssueLabelsCache(teamId?: string): Promise<IssueLabelCacheEntry[]> {
  try {
    const issueLabels = await getAllIssueLabels(teamId);
    const timestamp = Date.now();

    const cacheEntries: IssueLabelCacheEntry[] = issueLabels.map(label => ({
      ...label,
      timestamp,
    }));

    saveIssueLabelsCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh issue labels cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get issue labels (from cache or refresh if expired)
 */
export async function getCachedIssueLabels(teamId?: string): Promise<IssueLabelCacheEntry[]> {
  const cached = loadIssueLabelsCache();

  // If team filter is provided, always fetch from API (don't use cache for filtered results)
  if (teamId) {
    const issueLabels = await getAllIssueLabels(teamId);
    const timestamp = Date.now();
    return issueLabels.map(label => ({
      ...label,
      timestamp,
    }));
  }

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshIssueLabelsCache();
}

/**
 * Clear issue labels cache
 */
export function clearIssueLabelsCache(): void {
  const cache = readCache();
  delete cache.issueLabels;
  writeCache(cache);
}

// ============================================================================
// Project Labels Cache
// ============================================================================

/**
 * Load project labels from cache
 */
export function loadProjectLabelsCache(): ProjectLabelCacheEntry[] {
  const cache = readCache();
  return cache.projectLabels || [];
}

/**
 * Save project labels to cache
 */
export function saveProjectLabelsCache(projectLabels: ProjectLabelCacheEntry[]): void {
  const cache = readCache();
  cache.projectLabels = projectLabels;
  writeCache(cache);
}

/**
 * Refresh project labels cache from API
 */
export async function refreshProjectLabelsCache(): Promise<ProjectLabelCacheEntry[]> {
  try {
    const projectLabels = await getAllProjectLabels();
    const timestamp = Date.now();

    const cacheEntries: ProjectLabelCacheEntry[] = projectLabels.map(label => ({
      ...label,
      timestamp,
    }));

    saveProjectLabelsCache(cacheEntries);
    return cacheEntries;
  } catch (error) {
    throw new Error(`Failed to refresh project labels cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get project labels (from cache or refresh if expired)
 */
export async function getCachedProjectLabels(): Promise<ProjectLabelCacheEntry[]> {
  const cached = loadProjectLabelsCache();

  if (isCacheValid(cached)) {
    return cached;
  }

  // Cache expired or empty, refresh
  return await refreshProjectLabelsCache();
}

/**
 * Clear project labels cache
 */
export function clearProjectLabelsCache(): void {
  const cache = readCache();
  delete cache.projectLabels;
  writeCache(cache);
}

// ============================================================================
// Clear All Cache
// ============================================================================

/**
 * Clear all entity caches (persistent file cache)
 */
export function clearAllCache(): void {
  const cache = readCache();
  delete cache.projectStatuses;
  delete cache.teams;
  delete cache.initiatives;
  delete cache.members;
  delete cache.templates;
  delete cache.workflowStates;
  delete cache.issueLabels;
  delete cache.projectLabels;
  writeCache(cache);
}
