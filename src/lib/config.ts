import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, ResolvedConfig } from './types.js';

const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'linear-create');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_DIR = '.linear-create';
const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, 'config.json');

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
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get configuration with priority: project > global > env
 */
export function getConfig(): ResolvedConfig {
  const envConfig: Partial<Config> = {};
  const globalConfig = readConfigFile(GLOBAL_CONFIG_FILE);
  const projectConfig = readConfigFile(PROJECT_CONFIG_FILE);

  // Read from environment
  if (process.env.LINEAR_API_KEY) {
    envConfig.apiKey = process.env.LINEAR_API_KEY;
  }

  // Determine locations for each config value
  const locations: ResolvedConfig['locations'] = {
    apiKey: { type: 'none' },
    defaultInitiative: { type: 'none' },
    defaultTeam: { type: 'none' },
    defaultIssueTemplate: { type: 'none' },
    defaultProjectTemplate: { type: 'none' },
    defaultMilestoneTemplate: { type: 'none' },
    projectCacheMinTTL: { type: 'none' },
    defaultAutoAssignLead: { type: 'none' },
  };

  // API Key location (env has highest priority for security)
  if (envConfig.apiKey) {
    locations.apiKey = { type: 'env' };
  } else if (projectConfig.apiKey) {
    locations.apiKey = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.apiKey) {
    locations.apiKey = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Initiative location
  if (projectConfig.defaultInitiative) {
    locations.defaultInitiative = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultInitiative) {
    locations.defaultInitiative = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Team location
  if (projectConfig.defaultTeam) {
    locations.defaultTeam = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultTeam) {
    locations.defaultTeam = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Issue Template location
  if (projectConfig.defaultIssueTemplate) {
    locations.defaultIssueTemplate = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultIssueTemplate) {
    locations.defaultIssueTemplate = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Project Template location
  if (projectConfig.defaultProjectTemplate) {
    locations.defaultProjectTemplate = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultProjectTemplate) {
    locations.defaultProjectTemplate = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Milestone Template location
  if (projectConfig.defaultMilestoneTemplate) {
    locations.defaultMilestoneTemplate = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultMilestoneTemplate) {
    locations.defaultMilestoneTemplate = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Project Cache Min TTL location
  if (projectConfig.projectCacheMinTTL) {
    locations.projectCacheMinTTL = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.projectCacheMinTTL) {
    locations.projectCacheMinTTL = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Default Auto Assign Lead location
  if (projectConfig.defaultAutoAssignLead !== undefined) {
    locations.defaultAutoAssignLead = { type: 'project', path: PROJECT_CONFIG_FILE };
  } else if (globalConfig.defaultAutoAssignLead !== undefined) {
    locations.defaultAutoAssignLead = { type: 'global', path: GLOBAL_CONFIG_FILE };
  }

  // Merge configs with priority: project > global for most settings, but env > all for API key
  const merged = {
    ...globalConfig,
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
 * Get API key from config or environment
 */
export function getApiKey(): string | undefined {
  const config = getConfig();
  return config.apiKey;
}

/**
 * Set default initiative
 */
export function setDefaultInitiative(
  initiativeId: string,
  scope: 'global' | 'project' = 'global'
): void {
  const configFile = scope === 'global' ? GLOBAL_CONFIG_FILE : PROJECT_CONFIG_FILE;
  const existingConfig = readConfigFile(configFile);

  existingConfig.defaultInitiative = initiativeId;
  writeConfigFile(configFile, existingConfig);
}

/**
 * Get global config file path
 */
export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

/**
 * Get project config file path
 */
export function getProjectConfigPath(): string {
  return PROJECT_CONFIG_FILE;
}

/**
 * Check if global config exists
 */
export function hasGlobalConfig(): boolean {
  return existsSync(GLOBAL_CONFIG_FILE);
}

/**
 * Check if project config exists
 */
export function hasProjectConfig(): boolean {
  return existsSync(PROJECT_CONFIG_FILE);
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
const VALID_CONFIG_KEYS = ['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL', 'defaultAutoAssignLead'] as const;
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
  const configFile = scope === 'global' ? GLOBAL_CONFIG_FILE : PROJECT_CONFIG_FILE;
  const existingConfig = readConfigFile(configFile);

  // Validate projectCacheMinTTL
  if (key === 'projectCacheMinTTL') {
    const ttl = parseInt(value, 10);
    if (isNaN(ttl)) {
      throw new Error('projectCacheMinTTL must be a number');
    }
    if (ttl < 1) {
      throw new Error('projectCacheMinTTL must be at least 1 minute');
    }
    if (ttl > 1440) {
      throw new Error('projectCacheMinTTL must not exceed 1440 minutes (24 hours)');
    }
    existingConfig[key] = ttl;
  } else if (key === 'defaultAutoAssignLead') {
    // Parse boolean value
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
      existingConfig[key] = true;
    } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
      existingConfig[key] = false;
    } else {
      throw new Error('defaultAutoAssignLead must be true or false');
    }
  } else {
    existingConfig[key] = value;
  }

  writeConfigFile(configFile, existingConfig);
}

/**
 * Unset (remove) a configuration value
 */
export function unsetConfigValue(key: ConfigKey, scope: 'global' | 'project' = 'global'): void {
  const configFile = scope === 'global' ? GLOBAL_CONFIG_FILE : PROJECT_CONFIG_FILE;
  const existingConfig = readConfigFile(configFile);

  delete existingConfig[key];
  writeConfigFile(configFile, existingConfig);
}
