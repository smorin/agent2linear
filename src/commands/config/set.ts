import { isValidConfigKey, setConfigValue, type ConfigKey } from '../../lib/config.js';
import {
  validateApiKey,
  validateInitiativeExists,
  validateTeamExists,
} from '../../lib/linear-client.js';

interface SetConfigOptions {
  global?: boolean;
  project?: boolean;
}

export async function setConfig(key: string, value: string, options: SetConfigOptions) {
  // Validate key
  if (!isValidConfigKey(key)) {
    console.error(`❌ Invalid configuration key: ${key}`);
    console.error(
      `Valid keys are: apiKey, defaultInitiative, defaultTeam`
    );
    process.exit(1);
  }

  // Determine scope (default to global)
  const scope: 'global' | 'project' = options.project ? 'project' : 'global';

  // Validate value based on key type
  console.log(`🔍 Validating ${key}...`);

  try {
    if (key === 'apiKey') {
      // Validate API key format
      if (!value.startsWith('lin_api_')) {
        console.error('❌ Invalid API key format. API keys should start with "lin_api_"');
        process.exit(1);
      }

      // Validate API key by testing connection
      console.log('   Testing API connection...');
      const isValid = await validateApiKey(value);
      if (!isValid) {
        console.error('❌ API key validation failed. The key is invalid or cannot connect to Linear.');
        process.exit(1);
      }
      console.log('   ✓ API key is valid');
    } else if (key === 'defaultInitiative') {
      // Validate initiative exists
      const result = await validateInitiativeExists(value);
      if (!result.valid) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Initiative found: ${result.name}`);
    } else if (key === 'defaultTeam') {
      // Validate team exists
      const result = await validateTeamExists(value);
      if (!result.valid) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Team found: ${result.name}`);
    }

    // Save configuration
    setConfigValue(key as ConfigKey, value, scope);

    // Success message
    const scopeLabel = scope === 'global' ? 'global' : 'project';
    const keyLabel =
      key === 'apiKey'
        ? 'API Key'
        : key === 'defaultInitiative'
          ? 'Default Initiative'
          : 'Default Team';

    console.log(`\n✅ ${keyLabel} saved to ${scopeLabel} config`);

    if (key === 'apiKey') {
      console.log(`   Use 'linear-create config show' to view your configuration`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
