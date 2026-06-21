import { getGlobalConfigPath, getProjectConfigPath } from '../../lib/config.js';
import { formatListJSON } from '../../lib/output.js';
import { loadProfiles } from '../../lib/profiles.js';

interface ListProfileOptions {
  format?: 'tsv' | 'json';
}

/**
 * List registered profiles with their workspace + defaults. Offline (no API call).
 */
export function listProfileCommand(options: ListProfileOptions = {}): void {
  try {
    const profiles = loadProfiles();
    const names = Object.keys(profiles).sort();

    if (options.format === 'json') {
      console.log(formatListJSON(names.map((name) => ({ name, ...profiles[name] }))));
      return;
    }

    if (names.length === 0) {
      console.log('No profiles registered.');
      console.log('');
      console.log('Define one at:');
      console.log(`  Global:  ${getGlobalConfigPath()}`);
      console.log(`  Project: ${getProjectConfigPath()}`);
      console.log('');
      console.log('💡 Tip: "agent2linear profile add <name> --workspace <ws> --default-team <team>"');
      return;
    }

    if (options.format === 'tsv') {
      console.log('name\tworkspace\tdefaultTeam\tdefaultInitiative\texcluded');
      for (const name of names) {
        const p = profiles[name];
        console.log(
          `${name}\t${p.workspace ?? ''}\t${p.defaultTeam ?? ''}\t${p.defaultInitiative ?? ''}\t${p.linear === false ? 'yes' : ''}`
        );
      }
      return;
    }

    console.log(`Profiles (${names.length}):`);
    for (const name of names) {
      const p = profiles[name];
      const parts: string[] = [];
      if (p.workspace) parts.push(`workspace: ${p.workspace}`);
      if (p.defaultTeam) parts.push(`team: ${p.defaultTeam}`);
      if (p.defaultInitiative) parts.push(`initiative: ${p.defaultInitiative}`);
      if (p.linear === false) parts.push('excluded');
      const suffix = parts.length > 0 ? ` - ${parts.join(', ')}` : '';
      console.log(`  ${name}${suffix}`);
    }
    console.log('');
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
