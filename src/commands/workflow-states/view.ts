import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';
import { getWorkflowStateById } from '../../lib/linear-client.js';

export function viewWorkflowState(program: Command) {
  program
    .command('view <id>')
    .description('View workflow state details')
    .action(async (id: string) => {
      try {
        // Resolve alias
        const resolvedId = resolveAlias('workflow-state', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        // Fetch workflow state
        const state = await getWorkflowStateById(resolvedId);

        if (!state) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('workflow state', id, 'workflow-states list'));
          process.exit(1);
        }

        // Display details
        console.log('');
        console.log(`📋 Workflow State: ${state.name}`);
        console.log(`   ID: ${state.id}`);
        console.log(`   Type: ${state.type}`);
        console.log(`   Color: ${state.color} ${formatColorPreview(state.color)}`);
        console.log(`   Position: ${state.position}`);
        console.log(`   Team: ${state.teamId}`);
        if (state.description) {
          console.log(`   Description: ${state.description}`);
        }
        console.log('');
        console.log('💡 Use this workflow state:');
        console.log(`   In issues: --state ${state.name}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
