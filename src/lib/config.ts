import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { getProfileScope } from './profiles.js';
import type { Scope } from './scope.js';
import type { Config, ConfigLocation, ResolvedConfig } from './types.js';
import { resolveActiveProfile, resolveActiveWorkspace } from './workspace-resolver.js';
import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';

const CONFIG_FILENAME = 'config.json';

function globalConfigFile(): string {
  return join(userConfigDir(), CONFIG_FILENAME);
}

/** Project config file for reading (walk-up discovery), or null if none exists. */
function projectConfigReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, CONFIG_FILENAME) : null;
}

/** Project config file for writing (discovered dir, else cwd/.agent2linear). */
function projectConfigWriteFile(): string {
  return join(projectConfigWriteDir(), CONFIG_FILENAME);
}

/**
 * Read JSON config file safely
 */
function readConfigFile(path: string): Partial<Config> {
  try {
    if (!existsSync(path)) {
      return {};
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write JSON config file
 */
function writeConfigFile(path: string, config: Partial<Config>): void {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to write config file ${path}: ${msg}`);
  }
}

/**
 * Read the RAW global config.json (no merge, no profile scope, no env).
 *
 * Exposed for the workspace resolver and profile store, which must read config
 * WITHOUT calling getConfig() — getConfig() now depends on the resolved profile,
 * so any getConfig() call from the resolution path would recurse infinitely.
 */
export function readGlobalConfig(): Partial<Config> {
  return readConfigFile(globalConfigFile());
}

/** Read the RAW nearest project config.json (walk-up discovery; {} if none). */
export function readProjectConfig(): Partial<Config> {
  const f = projectConfigReadFile();
  return f ? readConfigFile(f) : {};
}

/** Read the RAW config.json for a scope's write target (read-modify-write helper). */
export function readConfigForScope(scope: Scope): Partial<Config> {
  const file = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
  return readConfigFile(file);
}

/** Write the RAW config.json for a scope's write target. */
export function writeConfigForScope(scope: Scope, config: Partial<Config>): void {
  const file = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
  writeConfigFile(file, config);
}

/**
 * Get configuration with priority: project > profile > global > env
 */
export function getConfig(): ResolvedConfig {
  const envConfig: Partial<Config> = {};
  const globalConfig = readConfigFile(globalConfigFile());
  const projectReadFile = projectConfigReadFile();
  const projectConfig = projectReadFile ? readConfigFile(projectReadFile) : {};

  // Profile scope: the active profile's recognized Config defaults, slotted into
  // the merge between global and project. `getProfileScope(undefined)` returns {}
  // so the no-profile path stays byte-identical to {...global, ...project}.
  // `resolveActiveProfile()` reads raw config only — it must never call getConfig().
  const profileScope = getProfileScope(resolveActiveProfile());

  // Read from environment
  if (process.env.LINEAR_API_KEY) {
    envConfig.apiKey = process.env.LINEAR_API_KEY;
  }

  // Determine locations for each config value
  const locations: ResolvedConfig['locations'] = {
    apiKey: { type: 'none' },
    defaultInitiative: { type: 'none' },
    defaultTeam: { type: 'none' },
    defaultProject: { type: 'none' }, // M15.1: Default project for issues
    defaultIssueTemplate: { type: 'none' },
    defaultProjectTemplate: { type: 'none' },
    defaultMilestoneTemplate: { type: 'none' },
    projectCacheMinTTL: { type: 'none' },
    defaultAutoAssignLead: { type: 'none' },
    entityCacheMinTTL: { type: 'none' },
    enableEntityCache: { type: 'none' },
    enablePersistentCache: { type: 'none' },
    enableSessionCache: { type: 'none' },
    enableBatchFetching: { type: 'none' },
    prewarmCacheOnCreate: { type: 'none' },
    defaultProfile: { type: 'none' },
    noMatchPolicy: { type: 'none' },
    confirmAutoDetectedWrites: { type: 'none' },
  };

  // Default Profile location (global-only setting)
  if (globalConfig.defaultProfile) {
    locations.defaultProfile = { type: 'global', path: globalConfigFile() };
  }

  // No-Match Policy location
  if (projectConfig.noMatchPolicy) {
    locations.noMatchPolicy = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.noMatchPolicy) {
    locations.noMatchPolicy = { type: 'global', path: globalConfigFile() };
  }

  // Confirm Auto-Detected Writes location
  if (projectConfig.confirmAutoDetectedWrites !== undefined) {
    locations.confirmAutoDetectedWrites = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.confirmAutoDetectedWrites !== undefined) {
    locations.confirmAutoDetectedWrites = { type: 'global', path: globalConfigFile() };
  }

  // API Key location (env has highest priority for security)
  if (envConfig.apiKey) {
    locations.apiKey = { type: 'env' };
  } else if (projectConfig.apiKey) {
    locations.apiKey = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.apiKey) {
    locations.apiKey = { type: 'global', path: globalConfigFile() };
  }

  // Default Initiative location
  if (projectConfig.defaultInitiative) {
    locations.defaultInitiative = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultInitiative) {
    locations.defaultInitiative = { type: 'global', path: globalConfigFile() };
  }

  // Default Team location
  if (projectConfig.defaultTeam) {
    locations.defaultTeam = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultTeam) {
    locations.defaultTeam = { type: 'global', path: globalConfigFile() };
  }

  // Default Project location (M15.1)
  if (projectConfig.defaultProject) {
    locations.defaultProject = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultProject) {
    locations.defaultProject = { type: 'global', path: globalConfigFile() };
  }

  // Default Issue Template location
  if (projectConfig.defaultIssueTemplate) {
    locations.defaultIssueTemplate = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultIssueTemplate) {
    locations.defaultIssueTemplate = { type: 'global', path: globalConfigFile() };
  }

  // Default Project Template location
  if (projectConfig.defaultProjectTemplate) {
    locations.defaultProjectTemplate = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultProjectTemplate) {
    locations.defaultProjectTemplate = { type: 'global', path: globalConfigFile() };
  }

  // Default Milestone Template location
  if (projectConfig.defaultMilestoneTemplate) {
    locations.defaultMilestoneTemplate = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultMilestoneTemplate) {
    locations.defaultMilestoneTemplate = { type: 'global', path: globalConfigFile() };
  }

  // Project Cache Min TTL location
  if (projectConfig.projectCacheMinTTL) {
    locations.projectCacheMinTTL = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.projectCacheMinTTL) {
    locations.projectCacheMinTTL = { type: 'global', path: globalConfigFile() };
  }

  // Default Auto Assign Lead location
  if (projectConfig.defaultAutoAssignLead !== undefined) {
    locations.defaultAutoAssignLead = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.defaultAutoAssignLead !== undefined) {
    locations.defaultAutoAssignLead = { type: 'global', path: globalConfigFile() };
  }

  // Entity Cache Min TTL location
  if (projectConfig.entityCacheMinTTL) {
    locations.entityCacheMinTTL = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.entityCacheMinTTL) {
    locations.entityCacheMinTTL = { type: 'global', path: globalConfigFile() };
  }

  // Enable Entity Cache location
  if (projectConfig.enableEntityCache !== undefined) {
    locations.enableEntityCache = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.enableEntityCache !== undefined) {
    locations.enableEntityCache = { type: 'global', path: globalConfigFile() };
  }

  // Enable Persistent Cache location
  if (projectConfig.enablePersistentCache !== undefined) {
    locations.enablePersistentCache = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.enablePersistentCache !== undefined) {
    locations.enablePersistentCache = { type: 'global', path: globalConfigFile() };
  }

  // Enable Session Cache location
  if (projectConfig.enableSessionCache !== undefined) {
    locations.enableSessionCache = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.enableSessionCache !== undefined) {
    locations.enableSessionCache = { type: 'global', path: globalConfigFile() };
  }

  // Enable Batch Fetching location
  if (projectConfig.enableBatchFetching !== undefined) {
    locations.enableBatchFetching = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.enableBatchFetching !== undefined) {
    locations.enableBatchFetching = { type: 'global', path: globalConfigFile() };
  }

  // Prewarm Cache On Create location
  if (projectConfig.prewarmCacheOnCreate !== undefined) {
    locations.prewarmCacheOnCreate = { type: 'project', path: projectReadFile ?? projectConfigWriteFile() };
  } else if (globalConfig.prewarmCacheOnCreate !== undefined) {
    locations.prewarmCacheOnCreate = { type: 'global', path: globalConfigFile() };
  }

  // Profile-source labeling: a key supplied by the profile scope (and NOT
  // overridden by the project) is labeled `profile`. Precedence is
  // project > profile > global, so this overrides a `global` label set above but
  // never a `project` one.
  for (const key of Object.keys(profileScope)) {
    if (key in projectConfig) {
      continue;
    }
    if (key in locations) {
      (locations as Record<string, ConfigLocation>)[key] = { type: 'profile' };
    }
  }

  // Merge configs with priority: project > profile > global, but env > all for API key
  const merged = {
    ...globalConfig,
    ...profileScope,
    ...projectConfig,
  };

  // API key from env takes precedence
  if (envConfig.apiKey) {
    merged.apiKey = envConfig.apiKey;
  }

  return {
    ...merged,
    locations,
  };
}

/**
 * Get API key from the resolved active workspace.
 *
 * Routes through the workspace resolver chokepoint so multi-workspace selection
 * (--workspace / --api-key, secrets registry) funnels through one place. With no
 * workspaces/profiles configured and no explicit selection, this returns exactly
 * today's value (env LINEAR_API_KEY, else config-file apiKey) — byte-identical.
 */
export function getApiKey(): string | undefined {
  const resolution = resolveActiveWorkspace();
  // Refuse to guess: the no-match gate / exclusion (Phase 3) or the ambiguity
  // guard (Phase 4) denied resolution.
  if (resolution.denied) {
    throw new Error(`${resolution.denied.reason} ${resolution.denied.hint}`);
  }
  // resolveActiveWorkspace() already sourced the key WITH full profile context
  // (named env var / env-file / secrets). Reuse it — re-sourcing here would drop
  // the profile and miss apiKeyEnv/envFile.
  return resolution.key || undefined;
}

/**
 * Set default initiative
 */
export function setDefaultInitiative(
  initiativeId: string,
  scope: 'global' | 'project' = 'global'
): void {
  const configFile = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
  const existingConfig = readConfigFile(configFile);

  existingConfig.defaultInitiative = initiativeId;
  writeConfigFile(configFile, existingConfig);
}

/**
 * Get global config file path
 */
export function getGlobalConfigPath(): string {
  return globalConfigFile();
}

/**
 * Get project config file path
 */
export function getProjectConfigPath(): string {
  return projectConfigReadFile() ?? projectConfigWriteFile();
}

/**
 * Check if global config exists
 */
export function hasGlobalConfig(): boolean {
  return existsSync(globalConfigFile());
}

/**
 * Check if project config exists
 */
export function hasProjectConfig(): boolean {
  const f = projectConfigReadFile();
  return f !== null && existsSync(f);
}

/**
 * Mask API key for display (show first 4 and last 3 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 7) {
    return '***';
  }
  return `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 3)}`;
}

/**
 * Valid configuration keys
 */
const VALID_CONFIG_KEYS = [
  'apiKey',
  'defaultInitiative',
  'defaultTeam',
  'defaultProject', // M15.1: Default project for issue creation
  'defaultIssueTemplate',
  'defaultProjectTemplate',
  'defaultMilestoneTemplate',
  'projectCacheMinTTL',
  'defaultAutoAssignLead',
  'entityCacheMinTTL',
  'enableEntityCache',
  'enablePersistentCache',
  'enableSessionCache',
  'enableBatchFetching',
  'prewarmCacheOnCreate',
  'defaultProfile', // M28: persisted default profile
  'noMatchPolicy', // M28: no-match behavior (deny|default|match-only)
  'confirmAutoDetectedWrites' // M28: confirm writes to an auto-detected workspace
] as const;
export type ConfigKey = (typeof VALID_CONFIG_KEYS)[number];

/**
 * Check if a key is a valid configuration key
 */
export function isValidConfigKey(key: string): key is ConfigKey {
  return VALID_CONFIG_KEYS.includes(key as ConfigKey);
}

/**
 * Set a configuration value
 */
export function setConfigValue(
  key: ConfigKey,
  value: string,
  scope: 'global' | 'project' = 'global'
): void {
  const configFile = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
  const existingConfig = readConfigFile(configFile);

  // Validate projectCacheMinTTL
  if (key === 'projectCacheMinTTL' || key === 'entityCacheMinTTL') {
    const ttl = parseInt(value, 10);
    if (isNaN(ttl)) {
      throw new Error(`${key} must be a number`);
    }
    if (ttl < 1) {
      throw new Error(`${key} must be at least 1 minute`);
    }
    if (ttl > 1440) {
      throw new Error(`${key} must not exceed 1440 minutes (24 hours)`);
    }
    existingConfig[key] = ttl;
  } else if (
    key === 'defaultAutoAssignLead' ||
    key === 'enableEntityCache' ||
    key === 'enablePersistentCache' ||
    key === 'enableSessionCache' ||
    key === 'enableBatchFetching' ||
    key === 'prewarmCacheOnCreate' ||
    key === 'confirmAutoDetectedWrites'
  ) {
    // Parse boolean value
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
      existingConfig[key] = true;
    } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
      existingConfig[key] = false;
    } else {
      throw new Error(`${key} must be true or false`);
    }
  } else if (key === 'noMatchPolicy') {
    if (value !== 'deny' && value !== 'default' && value !== 'match-only') {
      throw new Error('noMatchPolicy must be one of: deny, default, match-only');
    }
    existingConfig[key] = value;
  } else {
    existingConfig[key] = value;
  }

  writeConfigFile(configFile, existingConfig);
}

/**
 * Unset (remove) a configuration value
 */
export function unsetConfigValue(key: ConfigKey, scope: 'global' | 'project' = 'global'): void {
  const configFile = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
  const existingConfig = readConfigFile(configFile);

  delete existingConfig[key];
  writeConfigFile(configFile, existingConfig);
}
