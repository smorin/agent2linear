import { type ConfigKey,getConfig, maskApiKey } from '../../lib/config.js';
import { resolveActiveProfile } from '../../lib/workspace-resolver.js';

export async function getConfigValue(key: ConfigKey, dir?: string) {
  try {
    // M29: an optional positional [dir] override-resolves the key for that context
    // (sugar for the global -C/--cwd); undefined falls back to -C / cwd as before.
    const config = getConfig(dir);
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
    } else if (location.type === 'override') {
      // M31: name the winning rule by its label (`ruleId`), else `#<ruleIndex>`.
      const selector = location.ruleId ?? (location.ruleIndex !== undefined ? `#${location.ruleIndex}` : undefined);
      const scopeWord = location.scope === 'project' ? 'repo' : 'global';
      locationStr = selector
        ? ` (from ${scopeWord} override ${selector})`
        : ` (from ${scopeWord} override)`;
    } else if (location.type === 'project') {
      locationStr = ' (from project config)';
    } else if (location.type === 'profile') {
      const profileName = resolveActiveProfile();
      locationStr = profileName ? ` (from profile '${profileName}')` : ' (from profile)';
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
