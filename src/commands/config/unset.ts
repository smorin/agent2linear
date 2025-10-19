import {
  isValidConfigKey,
  unsetConfigValue,
  hasGlobalConfig,
  hasProjectConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  type ConfigKey,
} from '../../lib/config.js';

interface UnsetConfigOptions {
  global?: boolean;
  project?: boolean;
}

export async function unsetConfig(key: string, options: UnsetConfigOptions) {
  // Validate key
  if (!isValidConfigKey(key)) {
    console.error(`❌ Invalid configuration key: ${key}`);
    console.error(`Valid keys are: apiKey, defaultInitiative, defaultTeam`);
    process.exit(1);
  }

  // Determine scope (default to global)
  const scope: 'global' | 'project' = options.project ? 'project' : 'global';

  // Check if config file exists
  const configExists = scope === 'global' ? hasGlobalConfig() : hasProjectConfig();
  if (!configExists) {
    const configPath = scope === 'global' ? getGlobalConfigPath() : getProjectConfigPath();
    console.error(`❌ No ${scope} configuration file found at: ${configPath}`);
    process.exit(1);
  }

  try {
    // Remove the configuration value
    unsetConfigValue(key as ConfigKey, scope);

    // Success message
    const scopeLabel = scope === 'global' ? 'global' : 'project';
    const keyLabel =
      key === 'apiKey'
        ? 'API Key'
        : key === 'defaultInitiative'
          ? 'Default Initiative'
          : 'Default Team';

    console.log(`✅ ${keyLabel} removed from ${scopeLabel} config`);
    console.log(`   Use 'linear-create config show' to view your configuration`);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
