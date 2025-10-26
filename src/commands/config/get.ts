import { getConfig, maskApiKey, type ConfigKey } from '../../lib/config.js';

export async function getConfigValue(key: ConfigKey) {
  try {
    const config = getConfig();
    const value = config[key];
    const location = config.locations[key];

    if (!value) {
      console.log(`${key}: (not set)`);
      return;
    }

    // Format the location string
    let locationStr = '';
    if (location.type === 'env') {
      locationStr = ' (from environment)';
    } else if (location.type === 'project') {
      locationStr = ' (from project config)';
    } else if (location.type === 'global') {
      locationStr = ' (from global config)';
    }

    // Mask API key for security
    const displayValue = key === 'apiKey' ? maskApiKey(String(value)) : String(value);

    console.log(`${key}: ${displayValue}${locationStr}`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
