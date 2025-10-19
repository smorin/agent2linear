import { validateInitiativeExists } from '../../lib/linear-client.js';
import { setConfigValue } from '../../lib/config.js';

interface SetInitiativeOptions {
  global?: boolean;
  project?: boolean;
}

export async function setInitiative(initiativeId: string, options: SetInitiativeOptions = {}) {
  console.log(`🔍 Validating initiative ID: ${initiativeId}...`);

  try {
    // Validate initiative exists
    const result = await validateInitiativeExists(initiativeId);

    if (!result.valid) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }

    console.log(`   ✓ Initiative found: ${result.name}`);

    // Determine scope
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';
    const scopeLabel = scope === 'global' ? 'global' : 'project';

    // Save to config
    setConfigValue('defaultInitiative', initiativeId, scope);

    console.log(`\n✅ Default initiative set to: ${result.name}`);
    console.log(`   Saved to ${scopeLabel} config`);
    console.log(`   Initiative ID: ${initiativeId}`);
    console.log(`\n💡 Use 'linear-create config show' to view your configuration\n`);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
