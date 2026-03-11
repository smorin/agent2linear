import { Command } from 'commander';
import * as readline from 'readline';

import { resolveAlias } from '../../lib/aliases.js';
import { deleteIssueLabel,getIssueLabelById } from '../../lib/linear-client.js';

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function deleteIssueLabelCommand(program: Command) {
  program
    .command('delete <id>')
    .description('Delete an issue label')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options) => {
      try {
        const resolvedId = resolveAlias('issue-label', id);
        const label = await getIssueLabelById(resolvedId);

        if (!label) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('issue label', id, 'issue-labels list'));
          process.exit(1);
        }

        if (!options.yes) {
          console.log('');
          console.log(`⚠️  You are about to delete label: ${label.name}`);
          console.log('   This action cannot be undone.');
          console.log('');

          const confirmed = await confirm('Are you sure?');
          if (!confirmed) {
            console.log('❌ Deletion cancelled');
            process.exit(0);
          }
        }

        console.log('🗑️  Deleting label...');
        const success = await deleteIssueLabel(resolvedId);

        if (success) {
          console.log(`✅ Label deleted: ${label.name}`);
        } else {
          console.error('❌ Failed to delete label');
          process.exit(1);
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
