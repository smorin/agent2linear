import { Command } from 'commander';
import { getWorkflowStateById, updateWorkflowState } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';

export function updateWorkflowStateCommand(program: Command) {
  program
    .command('update <id>')
    .description('Update a workflow state')
    .option('--name <name>', 'New name')
    .option('--type <type>', 'New type (triage|backlog|unstarted|started|completed|canceled)')
    .option('--color <hex>', 'New color (hex code)')
    .option('--description <text>', 'New description')
    .option('--position <number>', 'New position')
    .action(async (id: string, options) => {
      try {
        // Check if any update field is provided
        if (!options.name && !options.type && !options.color && !options.description && !options.position) {
          console.error('❌ Error: At least one field to update is required');
          console.log('');
          console.log('Available options: --name, --type, --color, --description, --position');
          process.exit(1);
        }

        // Resolve alias
        const resolvedId = resolveAlias('workflow-state', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        // Fetch current state
        console.log('🔍 Fetching current workflow state...');
        const currentState = await getWorkflowStateById(resolvedId);

        if (!currentState) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('workflow state', id, 'workflow-states list'));
          process.exit(1);
        }

        // Validate inputs
        const { validateAndNormalizeColor, validateEnumValue } = await import('../../lib/validators.js');

        if (options.type) {
          const validTypes = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'];
          const typeResult = validateEnumValue(options.type, validTypes, 'type');
          if (!typeResult.valid) {
            console.error(`❌ Error: ${typeResult.error}`);
            process.exit(1);
          }
        }

        if (options.color) {
          const colorResult = validateAndNormalizeColor(options.color);
          if (!colorResult.valid) {
            console.error(`❌ Error: ${colorResult.error}`);
            process.exit(1);
          }
        }

        // Build update input
        const updateInput: { name?: string; type?: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'; color?: string; description?: string; position?: number } = {};
        if (options.name) updateInput.name = options.name;
        if (options.type) updateInput.type = options.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
        if (options.color) {
          const colorResult = validateAndNormalizeColor(options.color);
          updateInput.color = colorResult.value!;
        }
        if (options.description !== undefined) updateInput.description = options.description;
        if (options.position !== undefined) {
          const position = parseInt(options.position, 10);
          if (isNaN(position)) {
            console.error('❌ Position must be a valid number');
            process.exit(1);
          }
          updateInput.position = position;
        }

        console.log('📝 Updating workflow state...');

        const updatedState = await updateWorkflowState(resolvedId, updateInput);

        console.log('');
        console.log('✅ Workflow state updated successfully!');
        console.log('');
        console.log('Changes:');
        if (options.name) console.log(`   Name: ${currentState.name} → ${updatedState.name}`);
        if (options.type) console.log(`   Type: ${currentState.type} → ${updatedState.type}`);
        if (options.color) console.log(`   Color: ${currentState.color} → ${updatedState.color}`);
        if (options.position !== undefined) console.log(`   Position: ${currentState.position} → ${updatedState.position}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
