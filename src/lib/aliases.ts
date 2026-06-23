import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  getCycleById,
  getIssueLabelById,
  getMemberById,
  getProjectById,
  getProjectLabelById,
  getProjectStatusById,
  getTemplateById,
  getWorkflowStateById,
  validateInitiativeExists,
  validateTeamExists,
} from './linear-client.js';
import { getInvocationContext } from './invocation-context.js';
import type { AliasEntityType, Aliases, AliasLocation,ResolvedAliases } from './types.js';
import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';

/** All alias entity types, paired with their `Aliases` map key (for the override overlay). */
const ALIAS_ENTITY_TYPES: readonly AliasEntityType[] = [
  'initiative',
  'team',
  'project',
  'project-status',
  'issue-template',
  'project-template',
  'member',
  'issue-label',
  'project-label',
  'workflow-state',
  'cycle',
];

const ALIASES_FILENAME = 'aliases.json';

function globalAliasesFile(): string {
  return join(userConfigDir(), ALIASES_FILENAME);
}

/** Project aliases file for reading (walk-up), or null if none exists. */
function projectAliasesReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, ALIASES_FILENAME) : null;
}

/** Project aliases file for writing (discovered dir, else cwd/.agent2linear). */
function projectAliasesWriteFile(): string {
  return join(projectConfigWriteDir(), ALIASES_FILENAME);
}

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
    members: {},
    issueLabels: {},
    projectLabels: {},
    workflowStates: {},
    cycles: {}, // M15.1: Cycle aliases
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
      members: parsed.members || {},
      issueLabels: parsed.issueLabels || {},
      projectLabels: parsed.projectLabels || {},
      workflowStates: parsed.workflowStates || {},
      cycles: parsed.cycles || {}, // M15.1: Cycle aliases
    };
  } catch (error) {
    // Only warn if file exists (not just missing)
    if (existsSync(path)) {
      console.warn('⚠️  Warning: Could not read aliases file:', path);
      console.warn('   ', error instanceof Error ? error.message : 'Unknown error');
      console.warn('   Continuing with empty aliases. File will be recreated on next write.\n');
    }
    return getEmptyAliases();
  }
}

/**
 * Write aliases to a JSON file
 */
function writeAliasesFile(path: string, aliases: Aliases): void {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(aliases, null, 2), 'utf-8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to write aliases file ${path}: ${msg}`);
  }
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
  if (normalized === 'member' || normalized === 'members' || normalized === 'user' || normalized === 'users') {
    return 'member';
  }
  if (normalized === 'issue-label' || normalized === 'issue-labels' || normalized === 'issuelabel' || normalized === 'issuelabels') {
    return 'issue-label';
  }
  if (normalized === 'project-label' || normalized === 'project-labels' || normalized === 'projectlabel' || normalized === 'projectlabels') {
    return 'project-label';
  }
  if (normalized === 'workflow-state' || normalized === 'workflow-states' || normalized === 'workflowstate' || normalized === 'workflowstates') {
    return 'workflow-state';
  }
  if (normalized === 'cycle' || normalized === 'cycles') {
    return 'cycle';
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
  if (type === 'member') return 'members';
  if (type === 'issue-label') return 'issueLabels';
  if (type === 'project-label') return 'projectLabels';
  if (type === 'workflow-state') return 'workflowStates';
  if (type === 'cycle') return 'cycles';
  throw new Error(`Unknown alias entity type: ${type}`);
}

/**
 * Load aliases with priority: project > global
 */
export function loadAliases(): ResolvedAliases {
  const globalAliases = readAliasesFile(globalAliasesFile());
  const projectReadFile = projectAliasesReadFile();
  const projectAliases = projectReadFile ? readAliasesFile(projectReadFile) : getEmptyAliases();

  // Track locations
  const locations: ResolvedAliases['locations'] = {
    initiative: {},
    team: {},
    project: {},
    'project-status': {},
    'issue-template': {},
    'project-template': {},
    member: {},
    'issue-label': {},
    'project-label': {},
    'workflow-state': {},
    cycle: {}, // M15.1: Cycle aliases
  };

  // Merge and track locations for initiatives
  const initiatives = { ...globalAliases.initiatives };
  Object.keys(globalAliases.initiatives).forEach((alias) => {
    locations.initiative[alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.initiatives).forEach((alias) => {
    initiatives[alias] = projectAliases.initiatives[alias];
    locations.initiative[alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for teams
  const teams = { ...globalAliases.teams };
  Object.keys(globalAliases.teams).forEach((alias) => {
    locations.team[alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.teams).forEach((alias) => {
    teams[alias] = projectAliases.teams[alias];
    locations.team[alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for projects
  const projects = { ...globalAliases.projects };
  Object.keys(globalAliases.projects).forEach((alias) => {
    locations.project[alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.projects).forEach((alias) => {
    projects[alias] = projectAliases.projects[alias];
    locations.project[alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for project statuses
  const projectStatuses = { ...globalAliases.projectStatuses };
  Object.keys(globalAliases.projectStatuses).forEach((alias) => {
    locations['project-status'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.projectStatuses).forEach((alias) => {
    projectStatuses[alias] = projectAliases.projectStatuses[alias];
    locations['project-status'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for issue templates
  const issueTemplates = { ...globalAliases.issueTemplates };
  Object.keys(globalAliases.issueTemplates).forEach((alias) => {
    locations['issue-template'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.issueTemplates).forEach((alias) => {
    issueTemplates[alias] = projectAliases.issueTemplates[alias];
    locations['issue-template'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for project templates
  const projectTemplates = { ...globalAliases.projectTemplates };
  Object.keys(globalAliases.projectTemplates).forEach((alias) => {
    locations['project-template'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.projectTemplates).forEach((alias) => {
    projectTemplates[alias] = projectAliases.projectTemplates[alias];
    locations['project-template'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for members
  const members = { ...globalAliases.members };
  Object.keys(globalAliases.members).forEach((alias) => {
    locations.member[alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.members).forEach((alias) => {
    members[alias] = projectAliases.members[alias];
    locations.member[alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for issue labels
  const issueLabels = { ...globalAliases.issueLabels };
  Object.keys(globalAliases.issueLabels).forEach((alias) => {
    locations['issue-label'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.issueLabels).forEach((alias) => {
    issueLabels[alias] = projectAliases.issueLabels[alias];
    locations['issue-label'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for project labels
  const projectLabels = { ...globalAliases.projectLabels };
  Object.keys(globalAliases.projectLabels).forEach((alias) => {
    locations['project-label'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.projectLabels).forEach((alias) => {
    projectLabels[alias] = projectAliases.projectLabels[alias];
    locations['project-label'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for workflow states
  const workflowStates = { ...globalAliases.workflowStates };
  Object.keys(globalAliases.workflowStates).forEach((alias) => {
    locations['workflow-state'][alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.workflowStates).forEach((alias) => {
    workflowStates[alias] = projectAliases.workflowStates[alias];
    locations['workflow-state'][alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  // Merge and track locations for cycles (M15.1)
  const cycles = { ...globalAliases.cycles };
  Object.keys(globalAliases.cycles).forEach((alias) => {
    locations.cycle[alias] = { type: 'global', path: globalAliasesFile() };
  });
  Object.keys(projectAliases.cycles).forEach((alias) => {
    cycles[alias] = projectAliases.cycles[alias];
    locations.cycle[alias] = { type: 'project', path: projectReadFile ?? projectAliasesWriteFile() };
  });

  const resolved: ResolvedAliases = {
    initiatives,
    teams,
    projects,
    projectStatuses,
    issueTemplates,
    projectTemplates,
    members,
    issueLabels,
    projectLabels,
    workflowStates,
    cycles, // M15.1: Cycle aliases
    locations,
  };

  // M29 (U6): overlay the per-rule alias overrides resolved for the current context
  // at HIGHEST precedence (override > project > global), labeled `'override'`. With no
  // overlay stashed, this is a no-op and behavior is identical to today.
  applyOverrideAliases(resolved);
  return resolved;
}

/** Overlay `getInvocationContext().overrideAliases` onto a resolved alias set in place. */
function applyOverrideAliases(resolved: ResolvedAliases): void {
  const overrideAliases = getInvocationContext().overrideAliases;
  if (!overrideAliases) {
    return;
  }
  for (const type of ALIAS_ENTITY_TYPES) {
    const overrides = overrideAliases[getAliasesKey(type)];
    if (!overrides) {
      continue;
    }
    for (const [alias, id] of Object.entries(overrides)) {
      resolved[getAliasesKey(type)][alias] = id;
      resolved.locations[type][alias] = { type: 'override' };
    }
  }
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
      case 'member':
        return lowerInput.startsWith('user_');
      case 'issue-label':
      case 'project-label':
        return lowerInput.startsWith('label_');
      case 'workflow-state':
        return lowerInput.startsWith('state_') || lowerInput.startsWith('workflow_');
      case 'cycle':
        return lowerInput.startsWith('cycle_');
      default:
        return true; // Accept any prefix format for unknown types
    }
  }

  return false;
}

/**
 * Resolve an alias to a Linear ID transparently
 *
 * Resolution priority:
 * 1. If input looks like a Linear ID → return as-is (fast path, no lookup)
 * 2. If input matches an alias → return mapped ID (local file lookup)
 * 3. Otherwise → return input unchanged (will fail validation downstream)
 *
 * This function is synchronous and performs only local lookups.
 * It does NOT validate that the ID exists in Linear.
 *
 * @param type - Entity type to resolve (e.g., 'team', 'initiative', 'project')
 * @param input - User input (alias, ID, or name)
 * @returns Resolved Linear ID or original input
 *
 * @example
 * ```typescript
 * // Alias resolution
 * resolveAlias('team', 'backend')  // Returns 'team_abc123' if alias exists
 *
 * // ID passthrough
 * resolveAlias('team', 'team_abc123')  // Returns 'team_abc123' (no lookup)
 *
 * // Unknown input (returns as-is)
 * resolveAlias('team', 'nonexistent')  // Returns 'nonexistent' (fails later)
 * ```
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
      case 'member': {
        const member = await getMemberById(id);
        if (!member) {
          return { valid: false, error: `Member with ID "${id}" not found` };
        }
        return { valid: true, name: member.name };
      }
      case 'issue-label': {
        const label = await getIssueLabelById(id);
        if (!label) {
          return { valid: false, error: `Issue label with ID "${id}" not found` };
        }
        return { valid: true, name: label.name };
      }
      case 'project-label': {
        const label = await getProjectLabelById(id);
        if (!label) {
          return { valid: false, error: `Project label with ID "${id}" not found` };
        }
        return { valid: true, name: label.name };
      }
      case 'workflow-state': {
        const state = await getWorkflowStateById(id);
        if (!state) {
          return { valid: false, error: `Workflow state with ID "${id}" not found` };
        }
        return { valid: true, name: state.name };
      }
      case 'cycle': {
        const cycle = await getCycleById(id);
        if (!cycle) {
          return { valid: false, error: `Cycle with ID "${id}" not found` };
        }
        return { valid: true, name: cycle.name };
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
  // Validate alias format (no spaces, not empty)
  if (!alias || alias.trim() === '') {
    return { success: false, error: 'Alias cannot be empty' };
  }
  if (alias.includes(' ')) {
    return { success: false, error: 'Alias cannot contain spaces' };
  }

  // Validate entity exists via API (unless skipped)
  // Note: We rely on API validation rather than client-side format checks
  // because Linear ID formats can vary (UUIDs, prefixes, etc.)
  let validationName: string | undefined;
  if (!options.skipValidation) {
    const validation = await validateEntity(type, id);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    validationName = validation.name;
  }

  // Load existing aliases from the target scope
  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
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

  return { success: true, entityName: validationName };
}

/**
 * Remove an alias
 */
export function removeAlias(
  type: AliasEntityType,
  alias: string,
  scope: 'global' | 'project' = 'global'
): { success: boolean; error?: string; id?: string } {
  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
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

  // Check members
  for (const [alias, id] of Object.entries(aliases.members)) {
    total++;
    const validation = await validateEntity('member', id);
    if (!validation.valid) {
      broken.push({
        type: 'member',
        alias,
        id,
        location: aliases.locations.member[alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check issue labels
  for (const [alias, id] of Object.entries(aliases.issueLabels)) {
    total++;
    const validation = await validateEntity('issue-label', id);
    if (!validation.valid) {
      broken.push({
        type: 'issue-label',
        alias,
        id,
        location: aliases.locations['issue-label'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check project labels
  for (const [alias, id] of Object.entries(aliases.projectLabels)) {
    total++;
    const validation = await validateEntity('project-label', id);
    if (!validation.valid) {
      broken.push({
        type: 'project-label',
        alias,
        id,
        location: aliases.locations['project-label'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check workflow states
  for (const [alias, id] of Object.entries(aliases.workflowStates)) {
    total++;
    const validation = await validateEntity('workflow-state', id);
    if (!validation.valid) {
      broken.push({
        type: 'workflow-state',
        alias,
        id,
        location: aliases.locations['workflow-state'][alias],
        error: validation.error || 'Unknown error',
      });
    }
  }

  // Check cycles
  for (const [alias, id] of Object.entries(aliases.cycles)) {
    total++;
    const validation = await validateEntity('cycle', id);
    if (!validation.valid) {
      broken.push({
        type: 'cycle',
        alias,
        id,
        location: aliases.locations['cycle'][alias],
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
  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
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
  let validationName: string | undefined;
  if (!options.skipValidation) {
    const validation = await validateEntity(type, newId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    validationName = validation.name;
  }

  // Update the alias
  existingAliases[key][alias] = newId;
  writeAliasesFile(filePath, existingAliases);

  return { success: true, entityName: validationName, oldId };
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

  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
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
  return globalAliasesFile();
}

/**
 * Get project aliases file path
 */
export function getProjectAliasesPath(): string {
  return projectAliasesReadFile() ?? projectAliasesWriteFile();
}

/**
 * Check if global aliases file exists
 */
export function hasGlobalAliases(): boolean {
  return existsSync(globalAliasesFile());
}

/**
 * Check if project aliases file exists
 */
export function hasProjectAliases(): boolean {
  const f = projectAliasesReadFile();
  return f !== null && existsSync(f);
}

/**
 * Get all aliases that point to a given ID (reverse lookup)
 * @param type - The entity type to search
 * @param id - The Linear ID to find aliases for
 * @returns Array of alias names (without @ prefix) that point to this ID
 */
export function getAliasesForId(type: AliasEntityType, id: string): string[] {
  const aliases = loadAliases();
  const key = getAliasesKey(type);
  const aliasMap = aliases[key];

  const matchingAliases: string[] = [];
  for (const [alias, aliasId] of Object.entries(aliasMap)) {
    if (aliasId === id) {
      matchingAliases.push(alias);
    }
  }

  return matchingAliases;
}

/**
 * Clear all aliases of a specific type from a given scope
 */
export function clearAliases(
  type: AliasEntityType,
  scope: 'global' | 'project' = 'global',
  options: { preview?: boolean } = {}
): { success: boolean; error?: string; count: number; aliases?: string[] } {
  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
  const existingAliases = readAliasesFile(filePath);
  const key = getAliasesKey(type);

  // Get list of aliases to be cleared
  const aliasesToClear = Object.keys(existingAliases[key]);
  const count = aliasesToClear.length;

  // Preview mode - just return what would be cleared
  if (options.preview) {
    return { success: true, count, aliases: aliasesToClear };
  }

  // Clear the aliases
  existingAliases[key] = {};
  writeAliasesFile(filePath, existingAliases);

  return { success: true, count, aliases: aliasesToClear };
}

/**
 * Calculate Levenshtein distance between two strings (M15.1)
 * Used for fuzzy matching and "did you mean" suggestions
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find aliases similar to the input string (M15.1)
 * Uses Levenshtein distance and substring matching for fuzzy search
 *
 * @param input - The input string to match against
 * @param aliases - Array of available alias names
 * @param maxDistance - Maximum Levenshtein distance for matches (default: 2)
 * @returns Array of similar aliases, sorted by similarity
 */
export function findSimilarAliases(
  input: string,
  aliases: string[],
  maxDistance: number = 2
): string[] {
  const normalizedInput = input.toLowerCase();
  const matches: Array<{ alias: string; distance: number }> = [];

  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase();

    // Exact match (shouldn't happen in error case, but check anyway)
    if (normalizedAlias === normalizedInput) {
      matches.push({ alias, distance: 0 });
      continue;
    }

    // Substring match (e.g., "back" matches "backend")
    if (normalizedAlias.includes(normalizedInput) || normalizedInput.includes(normalizedAlias)) {
      matches.push({ alias, distance: 0.5 }); // Prioritize substring matches
      continue;
    }

    // Levenshtein distance match
    const distance = levenshteinDistance(normalizedInput, normalizedAlias);
    if (distance <= maxDistance) {
      matches.push({ alias, distance });
    }
  }

  // Sort by distance (closest first)
  matches.sort((a, b) => a.distance - b.distance);

  // Return just the alias names
  return matches.map(m => m.alias);
}

/**
 * Get a list of all aliases for a given entity type (M15.1)
 * @param type - Entity type
 * @returns Array of alias names
 */
export function getAliasesForType(type: AliasEntityType): string[] {
  const aliases = loadAliases();
  const key = getAliasesKey(type);
  return Object.keys(aliases[key]);
}

/**
 * Format error message with "did you mean" suggestions (M15.1)
 *
 * @param type - Entity type
 * @param input - The input that wasn't found
 * @param maxSuggestions - Maximum number of suggestions to show (default: 3)
 * @returns Formatted error message with suggestions
 *
 * @example
 * ```typescript
 * const error = getAliasSuggestionError('team', 'backen');
 * console.error(error);
 * // Output:
 * // Alias 'backen' not found for type 'team'.
 * // Did you mean: backend, frontend, mobile?
 * // Use "agent2linear alias list team" to see all team aliases.
 * ```
 */
export function getAliasSuggestionError(
  type: AliasEntityType,
  input: string,
  maxSuggestions: number = 3
): string {
  const allAliases = getAliasesForType(type);

  if (allAliases.length === 0) {
    return (
      `Alias '${input}' not found for type '${type}'.\n` +
      `No ${type} aliases have been created yet.\n` +
      `Use "agent2linear alias add ${type} <alias> <id>" to create one.`
    );
  }

  const similarAliases = findSimilarAliases(input, allAliases);

  let message = `Alias '${input}' not found for type '${type}'.`;

  if (similarAliases.length > 0) {
    const suggestions = similarAliases.slice(0, maxSuggestions).join(', ');
    message += `\n\nDid you mean: ${suggestions}?`;
  }

  message += `\n\nUse "agent2linear alias list ${type}" to see all ${type} aliases.`;

  return message;
}

/**
 * Export for testing and advanced usage
 */
export { getAliasesKey,normalizeEntityType };
