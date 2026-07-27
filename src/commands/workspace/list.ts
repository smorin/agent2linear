import { maskApiKey } from '../../lib/config.js';
import { formatListJSON } from '../../lib/output.js';
import {
  getGlobalWorkspacesPath,
  getProjectWorkspacesPath,
  loadWorkspaces,
} from '../../lib/workspaces.js';

interface ListWorkspaceOptions {
  format?: 'tsv' | 'json';
}

/**
 * List registered workspaces with masked keys. Offline (no API calls).
 */
export async function listWorkspaceCommand(options: ListWorkspaceOptions = {}) {
  try {
    const workspaces = loadWorkspaces();
    const names = Object.keys(workspaces).sort();

    if (names.length === 0) {
      if (options.format === 'json') {
        console.log(formatListJSON([]));
        return;
      }
      if (options.format === 'tsv') {
        console.log('name\tapiKey');
        return;
      }
      console.log('No workspaces registered.');
      console.log('');
      console.log('Register one at:');
      console.log(`  Global:  ${getGlobalWorkspacesPath()}`);
      console.log(`  Project: ${getProjectWorkspacesPath()}`);
      console.log('');
      console.log(
        '💡 Tip: "agent2linear workspace add <name> --api-key-file -" reads the key from stdin'
      );
      return;
    }

    if (options.format === 'json') {
      const jsonData = names.map((name) => ({
        name,
        apiKey: maskApiKey(workspaces[name].apiKey),
      }));
      console.log(formatListJSON(jsonData));
      return;
    }

    if (options.format === 'tsv') {
      console.log('name\tapiKey');
      for (const name of names) {
        console.log(`${name}\t${maskApiKey(workspaces[name].apiKey)}`);
      }
      return;
    }

    console.log(`Workspaces (${names.length}):`);
    for (const name of names) {
      console.log(`  ${name.padEnd(20)} - ${maskApiKey(workspaces[name].apiKey)}`);
    }
    console.log('');
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
