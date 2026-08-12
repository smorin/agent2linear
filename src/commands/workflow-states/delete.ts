import { Command } from 'commander';
import * as readline from 'readline';

import { resolveAlias } from '../../lib/aliases.js';
import { CliError, isAuthenticationError } from '../../lib/cli-error.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import { deleteWorkflowState,getWorkflowStateById } from '../../lib/linear-client.js';

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

export function deleteWorkflowStateCommand(program: Command) {
  program
    .command('delete <id>')
    .description('Delete a workflow state')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options) => {
      try {
        if (!options.yes) requireInteractiveInput('workflow-states delete');

        // Resolve alias
        const resolvedId = resolveAlias('workflow-state', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        // Fetch workflow state
        console.log('🔍 Fetching workflow state...');
        const state = await getWorkflowStateById(resolvedId);

        if (!state) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('workflow state', id, 'workflow-states list'));
          process.exit(1);
        }

        // Confirm deletion
        if (!options.yes) {
          console.log('');
          console.log(`⚠️  You are about to delete workflow state: ${state.name}`);
          console.log(`   ID: ${state.id}`);
          console.log(`   Type: ${state.type}`);
          console.log('');
          console.log('⚠️  Warning: This action cannot be undone.');
          console.log('   Issues using this state may need to be reassigned.');
          console.log('');

          const confirmed = await confirm('Are you sure you want to delete this workflow state?');

          if (!confirmed) {
            console.log('');
            console.log('❌ Deletion cancelled');
            process.exit(0);
          }
        }

        console.log('');
        console.log('🗑️  Deleting workflow state...');

        const success = await deleteWorkflowState(resolvedId);

        if (success) {
          console.log('');
          console.log(`✅ Workflow state deleted: ${state.name}`);
          console.log('');
        } else {
          console.error('❌ Failed to delete workflow state');
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof CliError) throw error;
        if (isAuthenticationError(error)) throw error;
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
