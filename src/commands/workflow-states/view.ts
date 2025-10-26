import { Command } from 'commander';
import { getWorkflowStateById } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';

export function viewWorkflowState(program: Command) {
  program
    .command('view <id>')
    .description('View workflow state details')
    .option('-w, --web', 'Open workflow state in browser')
    .action(async (id: string, options) => {
      try {
        // Resolve alias
        const resolvedId = resolveAlias('workflow-state', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        // Fetch workflow state
        const state = await getWorkflowStateById(resolvedId);

        if (!state) {
          console.error(`❌ Workflow state not found: ${id}`);
          process.exit(1);
        }

        if (options.web) {
          const open = await import('open');
          await open.default(`https://linear.app/settings/workflow`);
          return;
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
