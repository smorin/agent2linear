import { formatListJSON } from '../../lib/output.js';
import { getGlobalPromptsPath, getProjectPromptsPath, loadPrompts } from '../../lib/prompts.js';

interface ListOptions {
  format?: 'tsv' | 'json';
  /** Include each prompt's description in the human output (no effect on json/tsv). */
  descriptions?: boolean;
  /** Filter to prompts whose NAME contains this substring (case-insensitive). */
  partial?: string;
}

/**
 * `prompt list [partial]` — list available prompt names grouped by source (global +
 * project, project overwrites by name). Default human output is NAMES ONLY; pass
 * `--descriptions` to include each prompt's description. `--format json|tsv` always
 * emits the complete record (name, description, source). An optional `[partial]`
 * filters to prompt names that contain the substring (case-insensitive); the filter
 * applies to every format.
 */
export async function listPrompts(options: ListOptions = {}): Promise<void> {
  try {
    const prompts = loadPrompts();
    const partial = options.partial?.toLowerCase();
    const names = Object.keys(prompts)
      .filter(name => (partial ? name.toLowerCase().includes(partial) : true))
      .sort();

    if (names.length === 0) {
      if (options.format === 'json') {
        console.log(formatListJSON([]));
        return;
      }
      if (options.format === 'tsv') {
        console.log('name\tdescription\tsource');
        return;
      }
      if (options.partial) {
        console.log(`No prompts match "${options.partial}".`);
        console.log('');
        return;
      }
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

      const renderName = (name: string): string => {
        if (!options.descriptions) {
          return `  ${name}`;
        }
        const description = prompts[name].entry.description || '';
        return `  ${name.padEnd(20)}${description ? ' - ' + description : ''}`;
      };

      if (globalNames.length > 0) {
        console.log(`Global Prompts (${globalNames.length}):`);
        for (const name of globalNames) {
          console.log(renderName(name));
        }
        console.log('');
      }

      if (projectNames.length > 0) {
        console.log(`Project Prompts (${projectNames.length}):`);
        for (const name of projectNames) {
          console.log(renderName(name));
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
