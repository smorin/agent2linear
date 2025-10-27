import { Command } from 'commander';
import { getWorkflowStateById, updateWorkflowState } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { isValidHexColor, normalizeHexColor } from '../../lib/colors.js';

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
          console.error(`❌ Workflow state not found: ${id}`);
          process.exit(1);
        }

        // Validate inputs
        if (options.type) {
          const validTypes = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'];
          if (!validTypes.includes(options.type)) {
            console.error(`❌ Error: Invalid type: ${options.type}`);
            console.log(`Type must be one of: ${validTypes.join(', ')}`);
            process.exit(1);
          }
        }

        if (options.color && !isValidHexColor(options.color)) {
          console.error(`❌ Error: Invalid color format: ${options.color}`);
          console.log('Color must be a valid hex code (e.g., #5E6AD2 or 5E6AD2)');
          process.exit(1);
        }

        // Build update input
        const updateInput: { name?: string; type?: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'; color?: string; description?: string; position?: number } = {};
        if (options.name) updateInput.name = options.name;
        if (options.type) updateInput.type = options.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
        if (options.color) updateInput.color = normalizeHexColor(options.color);
        if (options.description !== undefined) updateInput.description = options.description;
        if (options.position !== undefined) updateInput.position = parseInt(options.position, 10);

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
