import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Aliases, AliasEntityType, ResolvedAliases, AliasLocation } from './types.js';
import {
  validateInitiativeExists,
  validateTeamExists,
  getProjectById,
  getProjectStatusById,
  getTemplateById,
} from './linear-client.js';

const GLOBAL_ALIASES_DIR = join(homedir(), '.config', 'linear-create');
const GLOBAL_ALIASES_FILE = join(GLOBAL_ALIASES_DIR, 'aliases.json');
const PROJECT_ALIASES_DIR = '.linear-create';
const PROJECT_ALIASES_FILE = join(PROJECT_ALIASES_DIR, 'aliases.json');

/**
 * Default empty aliases structure
 */
function getEmptyAliases(): Aliases {
  return {
    initiatives: {},
    teams: {},
    projects: {},
    projectStatuses: {},
    issueTemplates: {},
    projectTemplates: {},
  };
}

/**
 * Read aliases from a JSON file safely
 */
function readAliasesFile(path: string): Aliases {
  try {
    if (!existsSync(path)) {
      return getEmptyAliases();
    }
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);

    // Ensure all required keys exist
    return {
      initiatives: parsed.initiatives || {},
      teams: parsed.teams || {},
      projects: parsed.projects || {},
      projectStatuses: parsed.projectStatuses || {},
      issueTemplates: parsed.issueTemplates || {},
      projectTemplates: parsed.projectTemplates || {},
    };
  } catch {
    return getEmptyAliases();
  }
}

/**
 * Write aliases to a JSON file
 */
function writeAliasesFile(path: string, aliases: Aliases): void {
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(aliases, null, 2), 'utf-8');
}

/**
 * Get the correct entity type key from singular or plural form
 */
function normalizeEntityType(type: string): AliasEntityType | null {
  const normalized = type.toLowerCase();
  if (normalized === 'initiative' || normalized === 'initiatives') {
    return 'initiative';
  }
  if (normalized === 'team' || normalized === 'teams') {
    return 'team';
  }
  if (normalized === 'project' || normalized === 'projects') {
    return 'project';
  }
  if (normalized === 'project-status' || normalized === 'project-statuses' || normalized === 'projectstatus' || normalized === 'projectstatuses') {
    return 'project-status';
  }
  if (normalized === 'issue-template' || normalized === 'issue-templates' || normalized === 'issuetemplate' || normalized === 'issuetemplates') {
    return 'issue-template';
  }
  if (normalized === 'project-template' || normalized === 'project-templates' || normalized === 'projecttemplate' || normalized === 'projecttemplates') {
    return 'project-template';
  }
  return null;
}

/**
 * Get the key for the aliases object based on entity type
 */
function getAliasesKey(type: AliasEntityType): keyof Aliases {
  if (type === 'initiative') return 'initiatives';
  if (type === 'team') return 'teams';
  if (type === 'project') return 'projects';
  if (type === 'project-status') return 'projectStatuses';
  if (type === 'issue-template') return 'issueTemplates';
  if (type === 'project-template') return 'projectTemplates';
  return 'projects'; // fallback
}

/**
 * Load aliases with priority: project > global
 */
export function loadAliases(): ResolvedAliases {
  const globalAliases = readAliasesFile(GLOBAL_ALIASES_FILE);
  const projectAliases = readAliasesFile(PROJECT_ALIASES_FILE);

  // Track locations
  const locations: ResolvedAliases['locations'] = {
    initiative: {},
    team: {},
    project: {},
    'project-status': {},
    'issue-template': {},
    'project-template': {},
  };

  // Merge and track locations for initiatives
  const initiatives = { ...globalAliases.initiatives };
  Object.keys(globalAliases.initiatives).forEach((alias) => {
    locations.initiative[alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.initiatives).forEach((alias) => {
    initiatives[alias] = projectAliases.initiatives[alias];
    locations.initiative[alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  // Merge and track locations for teams
  const teams = { ...globalAliases.teams };
  Object.keys(globalAliases.teams).forEach((alias) => {
    locations.team[alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.teams).forEach((alias) => {
    teams[alias] = projectAliases.teams[alias];
    locations.team[alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  // Merge and track locations for projects
  const projects = { ...globalAliases.projects };
  Object.keys(globalAliases.projects).forEach((alias) => {
    locations.project[alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.projects).forEach((alias) => {
    projects[alias] = projectAliases.projects[alias];
    locations.project[alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  // Merge and track locations for project statuses
  const projectStatuses = { ...globalAliases.projectStatuses };
  Object.keys(globalAliases.projectStatuses).forEach((alias) => {
    locations['project-status'][alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.projectStatuses).forEach((alias) => {
    projectStatuses[alias] = projectAliases.projectStatuses[alias];
    locations['project-status'][alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  // Merge and track locations for issue templates
  const issueTemplates = { ...globalAliases.issueTemplates };
  Object.keys(globalAliases.issueTemplates).forEach((alias) => {
    locations['issue-template'][alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.issueTemplates).forEach((alias) => {
    issueTemplates[alias] = projectAliases.issueTemplates[alias];
    locations['issue-template'][alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  // Merge and track locations for project templates
  const projectTemplates = { ...globalAliases.projectTemplates };
  Object.keys(globalAliases.projectTemplates).forEach((alias) => {
    locations['project-template'][alias] = { type: 'global', path: GLOBAL_ALIASES_FILE };
  });
  Object.keys(projectAliases.projectTemplates).forEach((alias) => {
    projectTemplates[alias] = projectAliases.projectTemplates[alias];
    locations['project-template'][alias] = { type: 'project', path: PROJECT_ALIASES_FILE };
  });

  return {
    initiatives,
    teams,
    projects,
    projectStatuses,
    issueTemplates,
    projectTemplates,
    locations,
  };
}

/**
 * Check if input looks like a Linear ID
 * Accepts both UUID format and prefix format (init_, team_, proj_, etc.)
 */
function looksLikeLinearId(input: string, type: AliasEntityType): boolean {
  // UUID format (common for teams and some other entities)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  if (isUuid) {
    return true;
  }

  // Prefix format (init_, team_, proj_, etc.)
  const lowerInput = input.toLowerCase();
  const isPrefixFormat = /^[a-z]+_[a-z0-9]+$/i.test(input);

  if (isPrefixFormat) {
    // For type-specific validation, check the prefix matches
    switch (type) {
      case 'initiative':
        return lowerInput.startsWith('init_');
      case 'team':
        return lowerInput.startsWith('team_');
      case 'project':
        return lowerInput.startsWith('proj_');
      case 'project-status':
        return lowerInput.startsWith('status_');
      case 'issue-template':
      case 'project-template':
        return lowerInput.startsWith('template_');
      default:
        return true; // Accept any prefix format for unknown types
    }
  }

  return false;
}

/**
 * Resolve an alias to a Linear ID transparently
 * If input is already an ID, return it as-is
 * If input is an alias, return the mapped ID
 * If neither, return the input (will fail downstream)
 */
export function resolveAlias(type: AliasEntityType, input: string): string {
  // If it looks like a Linear ID, return as-is
  if (looksLikeLinearId(input, type)) {
    return input;
  }

  // Try to resolve as alias
  const aliases = loadAliases();
  const key = getAliasesKey(type);
  const resolved = aliases[key][input];

  // Return resolved ID or original input
  return resolved || input;
}

/**
 * Validate that an entity exists in Linear
 */
async function validateEntity(
  type: AliasEntityType,
  id: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    switch (type) {
      case 'initiative':
        return await validateInitiativeExists(id);
      case 'team':
        return await validateTeamExists(id);
      case 'project': {
        const project = await getProjectById(id);
        if (!project) {
          return { valid: false, error: `Project with ID "${id}" not found` };
        }
        return { valid: true, name: project.name };
      }
      case 'project-status': {
        const status = await getProjectStatusById(id);
        if (!status) {
          return { valid: false, error: `Project status with ID "${id}" not found` };
        }
        return { valid: true, name: status.name };
      }
      case 'issue-template':
      case 'project-template': {
        const template = await getTemplateById(id);
        if (!template) {
          return { valid: false, error: `Template with ID "${id}" not found` };
        }
        // Validate that the template type matches the alias type
        const expectedType = type === 'issue-template' ? 'issue' : 'project';
        if (template.type !== expectedType) {
          return {
            valid: false,
            error: `Template "${id}" is a ${template.type} template, but you're trying to create an alias for ${expectedType} templates`
          };
        }
        return { valid: true, name: template.name };
      }
      default:
        return { valid: false, error: 'Invalid entity type' };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Add a new alias
 */
export async function addAlias(
  type: AliasEntityType,
  alias: string,
  id: string,
  scope: 'global' | 'project' = 'global',
  options: { skipValidation?: boolean } = {}
): Promise<{ success: boolean; error?: string; entityName?: string }> {
  // Validate alias format (no spaces, lowercase recommended)
  if (alias.includes(' ')) {
    return { success: false, error: 'Alias cannot contain spaces' };
  }

  // Validate entity exists via API (unless skipped)
  // Note: We rely on API validation rather than client-side format checks
  // because Linear ID formats can vary (UUIDs, prefixes, etc.)
  if (!options.skipValidation) {
    const validation = await validateEntity(type, id);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
  }

  // Load existing aliases from the target scope
  const filePath = scope === 'global' ? GLOBAL_ALIASES_FILE : PROJECT_ALIASES_FILE;
  const existingAliases = readAliasesFile(filePath);
  const key = getAliasesKey(type);

  // Check if alias already exists
  if (existingAliases[key][alias]) {
    const existingId = existingAliases[key][alias];
    if (existingId === id) {
      return {
        success: false,
        error: `Alias "${alias}" already points to this ${type}`,
      };
    }
    return {
      success: false,
      error: `Alias "${alias}" already exists for ${type} (use 'alias remove' first to update)`,
    };
  }

  // Add the alias
  existingAliases[key][alias] = id;
  writeAliasesFile(filePath, existingAliases);

  // Get entity name for confirmation
  let entityName: string | undefined;
  if (!options.skipValidation) {
    const validation = await validateEntity(type, id);
    entityName = validation.name;
  }

  return { success: true, entityName };
}

/**
 * Remove an alias
 */
export function removeAlias(
  type: AliasEntityType,
  alias: string,
  scope: 'global' | 'project' = 'global'
): { success: boolean; error?: string; id?: string } {
  const filePath = scope === 'global' ? GLOBAL_ALIASES_FILE : PROJECT_ALIASES_FILE;
  const existingAliases = readAliasesFile(filePath);
  const key = getAliasesKey(type);

  if (!existingAliases[key][alias]) {
    return {
      success: false,
      error: `Alias "${alias}" not found in ${scope} aliases for ${type}`,
    };
  }

  const id = existingAliases[key][alias];
  delete existingAliases[key][alias];
  writeAliasesFile(filePath, existingAliases);

  return { success: true, id };
}

/**
 * Get the ID for an alias
 */
export function getAlias(
  type: AliasEntityType,
  alias: string
): { found: boolean; id?: string; location?: AliasLocation } {
  const resolved = loadAliases();
  const key = getAliasesKey(type);
  const id = resolved[key][alias];

  if (!id) {
    return { found: false };
  }

  const location = resolved.locations[type][alias];
  return { found: true, id, location };
}

/**
 * List all aliases or aliases for a specific type
 */
export function listAliases(type?: AliasEntityType): ResolvedAliases | Aliases[keyof Aliases] {
  const aliases = loadAliases();

  if (!type) {
    return aliases;
  }

  const key = getAliasesKey(type);
  return aliases[key];
}

/**
 * Validate all aliases and return broken ones
 */
export async function validateAllAliases(): Promise<{
  broken: Array<{
    type: AliasEntityType;
    alias: string;
    id: string;
    location: AliasLocation;
    error: string;
  }>;
  total: number;
}> {
  const aliases = loadAliases();
  const broken: Array<{
    type: AliasEntityType;
    alias: string;
    id: string;
    location: AliasLocation;
    error: string;
  }> = [];

  let total = 0;

  // Check initiatives
  for (const [alias, id] of Object.entries(aliases.initiatives)) {
    total++;
    const validation = await validateEntity('initiative', id);
    if (!validation.valid) {
      broken.push({
        type: 'initiative',
        alias,
        id,
        location: aliases.locations.initiative[alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check teams
  for (const [alias, id] of Object.entries(aliases.teams)) {
    total++;
    const validation = await validateEntity('team', id);
    if (!validation.valid) {
      broken.push({
        type: 'team',
        alias,
        id,
        location: aliases.locations.team[alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check projects
  for (const [alias, id] of Object.entries(aliases.projects)) {
    total++;
    const validation = await validateEntity('project', id);
    if (!validation.valid) {
      broken.push({
        type: 'project',
        alias,
        id,
        location: aliases.locations.project[alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check project statuses
  for (const [alias, id] of Object.entries(aliases.projectStatuses)) {
    total++;
    const validation = await validateEntity('project-status', id);
    if (!validation.valid) {
      broken.push({
        type: 'project-status',
        alias,
        id,
        location: aliases.locations['project-status'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check issue templates
  for (const [alias, id] of Object.entries(aliases.issueTemplates)) {
    total++;
    const validation = await validateEntity('issue-template', id);
    if (!validation.valid) {
      broken.push({
        type: 'issue-template',
        alias,
        id,
        location: aliases.locations['issue-template'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check project templates
  for (const [alias, id] of Object.entries(aliases.projectTemplates)) {
    total++;
    const validation = await validateEntity('project-template', id);
    if (!validation.valid) {
      broken.push({
        type: 'project-template',
        alias,
        id,
        location: aliases.locations['project-template'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  return { broken, total };
}

/**
 * Update an alias to point to a different ID
 */
export async function updateAliasId(
  type: AliasEntityType,
  alias: string,
  newId: string,
  scope: 'global' | 'project' = 'global',
  options: { skipValidation?: boolean } = {}
): Promise<{ success: boolean; error?: string; entityName?: string; oldId?: string }> {
  // Get the current ID
  const filePath = scope === 'global' ? GLOBAL_ALIASES_FILE : PROJECT_ALIASES_FILE;
  const existingAliases = readAliasesFile(filePath);
  const key = getAliasesKey(type);

  if (!existingAliases[key][alias]) {
    return {
      success: false,
      error: `Alias "${alias}" not found in ${scope} aliases for ${type}`,
    };
  }

  const oldId = existingAliases[key][alias];

  // Validate new ID exists via API (unless skipped)
  if (!options.skipValidation) {
    const validation = await validateEntity(type, newId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
  }

  // Update the alias
  existingAliases[key][alias] = newId;
  writeAliasesFile(filePath, existingAliases);

  // Get entity name for confirmation
  let entityName: string | undefined;
  if (!options.skipValidation) {
    const validation = await validateEntity(type, newId);
    entityName = validation.name;
  }

  return { success: true, entityName, oldId };
}

/**
 * Rename an alias (change the alias name while keeping the same ID)
 */
export function renameAlias(
  type: AliasEntityType,
  oldAlias: string,
  newAlias: string,
  scope: 'global' | 'project' = 'global'
): { success: boolean; error?: string; id?: string } {
  // Validate new alias format (no spaces)
  if (newAlias.includes(' ')) {
    return { success: false, error: 'Alias cannot contain spaces' };
  }

  const filePath = scope === 'global' ? GLOBAL_ALIASES_FILE : PROJECT_ALIASES_FILE;
  const existingAliases = readAliasesFile(filePath);
  const key = getAliasesKey(type);

  // Check if old alias exists
  if (!existingAliases[key][oldAlias]) {
    return {
      success: false,
      error: `Alias "${oldAlias}" not found in ${scope} aliases for ${type}`,
    };
  }

  // Check if new alias already exists
  if (existingAliases[key][newAlias]) {
    return {
      success: false,
      error: `Alias "${newAlias}" already exists for ${type}`,
    };
  }

  // Get the ID
  const id = existingAliases[key][oldAlias];

  // Remove old alias and add new one
  delete existingAliases[key][oldAlias];
  existingAliases[key][newAlias] = id;
  writeAliasesFile(filePath, existingAliases);

  return { success: true, id };
}

/**
 * Get global aliases file path
 */
export function getGlobalAliasesPath(): string {
  return GLOBAL_ALIASES_FILE;
}

/**
 * Get project aliases file path
 */
export function getProjectAliasesPath(): string {
  return PROJECT_ALIASES_FILE;
}

/**
 * Check if global aliases file exists
 */
export function hasGlobalAliases(): boolean {
  return existsSync(GLOBAL_ALIASES_FILE);
}

/**
 * Check if project aliases file exists
 */
export function hasProjectAliases(): boolean {
  return existsSync(PROJECT_ALIASES_FILE);
}

/**
 * Export for testing and advanced usage
 */
export { normalizeEntityType, getAliasesKey };
