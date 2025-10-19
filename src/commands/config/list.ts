import {
  getConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  hasGlobalConfig,
  hasProjectConfig,
  maskApiKey,
} from '../../lib/config.js';

export async function listConfig() {
  const config = getConfig();

  console.log('\n📋 Linear Create Configuration\n');

  // Show config file paths
  console.log('Configuration Files:');
  console.log(
    `  Global:  ${getGlobalConfigPath()} ${hasGlobalConfig() ? '✓' : '(not found)'}`
  );
  console.log(
    `  Project: ${getProjectConfigPath()} ${hasProjectConfig() ? '✓' : '(not found)'}`
  );
  console.log();

  // Show API Key
  console.log('API Key:');
  if (config.apiKey) {
    const source = config.locations.apiKey;
    const sourceLabel =
      source.type === 'env'
        ? 'environment variable'
        : source.type === 'project'
          ? 'project config'
          : 'global config';
    console.log(`  ${maskApiKey(config.apiKey)} (from ${sourceLabel})`);
  } else {
    console.log('  Not configured');
    console.log('  💡 Set LINEAR_API_KEY environment variable or add to config file');
  }
  console.log();

  // Show Default Initiative
  console.log('Default Initiative:');
  if (config.defaultInitiative) {
    const source = config.locations.defaultInitiative;
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';
    console.log(`  ${config.defaultInitiative} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "linear-create initiatives list" to select one');
  }
  console.log();

  // Show Default Team
  console.log('Default Team:');
  if (config.defaultTeam) {
    const source = config.locations.defaultTeam;
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';
    console.log(`  ${config.defaultTeam} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
  }
  console.log();
}
