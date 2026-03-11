import { Command } from 'commander';
import * as readline from 'readline';

import { resolveAlias } from '../../lib/aliases.js';
import { deleteProjectLabel,getProjectLabelById } from '../../lib/linear-client.js';

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function deleteProjectLabelCommand(program: Command) {
  program
    .command('delete <id>')
    .description('Delete a project label')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options) => {
      try {
        const resolvedId = resolveAlias('project-label', id);
        const label = await getProjectLabelById(resolvedId);

        if (!label) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('project label', id, 'project-labels list'));
          process.exit(1);
        }

        if (!options.yes) {
          const confirmed = await confirm(`Delete label ${label.name}?`);
          if (!confirmed) {
            console.log('❌ Deletion cancelled');
            process.exit(0);
          }
        }

        await deleteProjectLabel(resolvedId);
        console.log(`✅ Label deleted: ${label.name}`);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
