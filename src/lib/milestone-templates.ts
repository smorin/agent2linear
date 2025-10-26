import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { MilestoneTemplates, MilestoneTemplate, MilestoneDefinition } from './types.js';

const GLOBAL_TEMPLATES_DIR = join(homedir(), '.config', 'linear-create');
const GLOBAL_TEMPLATES_FILE = join(GLOBAL_TEMPLATES_DIR, 'milestone-templates.json');
const PROJECT_TEMPLATES_DIR = '.linear-create';
const PROJECT_TEMPLATES_FILE = join(PROJECT_TEMPLATES_DIR, 'milestone-templates.json');

/**
 * Read milestone templates from a JSON file
 */
function readTemplatesFile(path: string): MilestoneTemplates | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content) as MilestoneTemplates;
    return data;
  } catch (error) {
    console.warn(`Warning: Failed to parse milestone templates from ${path}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Load milestone templates from both global and project locations
 * Project templates override global templates by name
 */
export function loadMilestoneTemplates(): { [name: string]: { template: MilestoneTemplate; source: 'global' | 'project' } } {
  const result: { [name: string]: { template: MilestoneTemplate; source: 'global' | 'project' } } = {};

  // Load global templates first
  const globalTemplates = readTemplatesFile(GLOBAL_TEMPLATES_FILE);
  if (globalTemplates?.templates) {
    for (const [name, template] of Object.entries(globalTemplates.templates)) {
      result[name] = { template, source: 'global' };
    }
  }

  // Load project templates (override global)
  const projectTemplates = readTemplatesFile(PROJECT_TEMPLATES_FILE);
  if (projectTemplates?.templates) {
    for (const [name, template] of Object.entries(projectTemplates.templates)) {
      result[name] = { template, source: 'project' };
    }
  }

  return result;
}

/**
 * Get a specific milestone template by name
 */
export function getMilestoneTemplate(name: string): { template: MilestoneTemplate; source: 'global' | 'project' } | null {
  const templates = loadMilestoneTemplates();
  return templates[name] || null;
}

/**
 * List all available milestone template names
 */
export function listMilestoneTemplateNames(): string[] {
  const templates = loadMilestoneTemplates();
  return Object.keys(templates).sort();
}

/**
 * Validate a milestone template structure
 */
export function validateMilestoneTemplate(template: MilestoneTemplate): { valid: boolean; error?: string } {
  if (!template.name || typeof template.name !== 'string') {
    return { valid: false, error: 'Template must have a name' };
  }

  if (!template.milestones || !Array.isArray(template.milestones)) {
    return { valid: false, error: 'Template must have a milestones array' };
  }

  if (template.milestones.length === 0) {
    return { valid: false, error: 'Template must have at least one milestone' };
  }

  for (let i = 0; i < template.milestones.length; i++) {
    const milestone = template.milestones[i];
    if (!milestone.name || typeof milestone.name !== 'string') {
      return { valid: false, error: `Milestone ${i + 1} must have a name` };
    }
  }

  return { valid: true };
}

/**
 * Parse a date offset string (e.g., "+7d", "+2w", "+1m") to a Date object
 * Supports: d (days), w (weeks), m (months)
 * Returns null if the string is not a relative date format
 */
export function parseDateOffset(offset: string, baseDate: Date = new Date()): Date | null {
  // If it's already an ISO date, parse it
  if (offset.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(offset);
  }

  // Parse relative date format: +7d, +2w, +1m
  const match = offset.match(/^([+-]?)(\d+)([dwm])$/i);
  if (!match) {
    return null;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const amount = parseInt(match[2], 10);
  const unit = match[3].toLowerCase();

  const result = new Date(baseDate);

  switch (unit) {
    case 'd': // days
      result.setDate(result.getDate() + sign * amount);
      break;
    case 'w': // weeks
      result.setDate(result.getDate() + sign * amount * 7);
      break;
    case 'm': // months
      result.setMonth(result.getMonth() + sign * amount);
      break;
    default:
      return null;
  }

  return result;
}

/**
 * Format a milestone definition with resolved dates
 */
export function resolveMilestoneDates(
  milestone: MilestoneDefinition,
  baseDate: Date = new Date()
): { name: string; description?: string; targetDate?: Date } {
  let resolvedDate: Date | undefined;

  if (milestone.targetDate) {
    const parsed = parseDateOffset(milestone.targetDate, baseDate);
    if (parsed) {
      resolvedDate = parsed;
    }
  }

  return {
    name: milestone.name,
    description: milestone.description,
    targetDate: resolvedDate,
  };
}

/**
 * Get the path to the global templates file
 */
export function getGlobalTemplatesPath(): string {
  return GLOBAL_TEMPLATES_FILE;
}

/**
 * Get the path to the project templates file
 */
export function getProjectTemplatesPath(): string {
  return PROJECT_TEMPLATES_FILE;
}

/**
 * Check if global templates file exists
 */
export function hasGlobalTemplates(): boolean {
  return existsSync(GLOBAL_TEMPLATES_FILE);
}

/**
 * Check if project templates file exists
 */
export function hasProjectTemplates(): boolean {
  return existsSync(PROJECT_TEMPLATES_FILE);
}

/**
 * Write milestone templates to a JSON file with auto-create directories
 */
function writeTemplatesFile(path: string, templates: MilestoneTemplates): void {
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(templates, null, 2), 'utf-8');
}

/**
 * Create a new milestone template
 * @param name - Template identifier (key in templates object)
 * @param template - Template data
 * @param scope - 'global' or 'project'
 * @returns Success status and error message if failed
 */
export function createMilestoneTemplate(
  name: string,
  template: MilestoneTemplate,
  scope: 'global' | 'project'
): { success: boolean; error?: string } {
  // Validate template structure
  const validation = validateMilestoneTemplate(template);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Determine file path
  const filePath = scope === 'global' ? GLOBAL_TEMPLATES_FILE : PROJECT_TEMPLATES_FILE;

  // Load existing templates
  const existing = readTemplatesFile(filePath) || { templates: {} };

  // Check if template already exists
  if (existing.templates[name]) {
    return { success: false, error: `Template "${name}" already exists in ${scope} scope` };
  }

  // Add new template
  existing.templates[name] = template;

  // Write back to file
  try {
    writeTemplatesFile(filePath, existing);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update an existing milestone template
 * @param name - Template identifier
 * @param template - Updated template data
 * @param scope - 'global' or 'project'
 * @returns Success status and error message if failed
 */
export function updateMilestoneTemplate(
  name: string,
  template: MilestoneTemplate,
  scope: 'global' | 'project'
): { success: boolean; error?: string } {
  // Validate template structure
  const validation = validateMilestoneTemplate(template);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Determine file path
  const filePath = scope === 'global' ? GLOBAL_TEMPLATES_FILE : PROJECT_TEMPLATES_FILE;

  // Load existing templates
  const existing = readTemplatesFile(filePath);
  if (!existing || !existing.templates[name]) {
    return { success: false, error: `Template "${name}" not found in ${scope} scope` };
  }

  // Update template
  existing.templates[name] = template;

  // Write back to file
  try {
    writeTemplatesFile(filePath, existing);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Remove a milestone template
 * @param name - Template identifier to remove
 * @param scope - 'global' or 'project'
 * @returns Success status and error message if failed
 */
export function removeMilestoneTemplate(
  name: string,
  scope: 'global' | 'project'
): { success: boolean; error?: string } {
  // Determine file path
  const filePath = scope === 'global' ? GLOBAL_TEMPLATES_FILE : PROJECT_TEMPLATES_FILE;

  // Load existing templates
  const existing = readTemplatesFile(filePath);
  if (!existing || !existing.templates[name]) {
    return { success: false, error: `Template "${name}" not found in ${scope} scope` };
  }

  // Remove template
  delete existing.templates[name];

  // Write back to file
  try {
    writeTemplatesFile(filePath, existing);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
