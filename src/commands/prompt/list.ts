import { formatListJSON } from '../../lib/output.js';
import { getGlobalPromptsPath, getProjectPromptsPath, loadPrompts } from '../../lib/prompts.js';

interface ListOptions {
  format?: 'tsv' | 'json';
}

/**
 * `prompt list` — list available prompt names grouped by source (global +
 * project, project overwrites by name). `--format json|tsv` for machine output.
 */
export async function listPrompts(options: ListOptions = {}): Promise<void> {
  try {
    const prompts = loadPrompts();
    const names = Object.keys(prompts).sort();

    if (names.length === 0) {
      console.log('No prompts found.');
      console.log('');
      console.log('Author prompts at:');
      console.log(`  Global:  ${getGlobalPromptsPath()}`);
      const projectPath = getProjectPromptsPath();
      if (projectPath) {
        console.log(`  Project: ${projectPath}`);
      }
      console.log('');
      return;
    }

    if (options.format === 'json') {
      const jsonData = names.map(name => {
        const { entry, source } = prompts[name];
        return {
          name,
          description: entry.description || '',
          source,
        };
      });
      console.log(formatListJSON(jsonData));
    } else if (options.format === 'tsv') {
      console.log('name\tdescription\tsource');
      for (const name of names) {
        const { entry, source } = prompts[name];
        const description = entry.description || '';
        console.log(`${name}\t${description}\t${source}`);
      }
    } else {
      const globalNames = names.filter(name => prompts[name].source === 'global');
      const projectNames = names.filter(name => prompts[name].source === 'project');

      if (globalNames.length > 0) {
        console.log(`Global Prompts (${globalNames.length}):`);
        for (const name of globalNames) {
          const description = prompts[name].entry.description || '';
          console.log(`  ${name.padEnd(20)}${description ? ' - ' + description : ''}`);
        }
        console.log('');
      }

      if (projectNames.length > 0) {
        console.log(`Project Prompts (${projectNames.length}):`);
        for (const name of projectNames) {
          const description = prompts[name].entry.description || '';
          console.log(`  ${name.padEnd(20)}${description ? ' - ' + description : ''}`);
        }
        console.log('');
      }

      console.log('💡 Tip: Use "agent2linear config set defaultPrompt <name>" to save a default');
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
