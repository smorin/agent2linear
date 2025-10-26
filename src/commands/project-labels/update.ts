import { Command } from 'commander';
import { getProjectLabelById, updateProjectLabel } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { isValidHexColor, normalizeHexColor } from '../../lib/colors.js';

export function updateProjectLabelCommand(program: Command) {
  program
    .command('update <id>')
    .description('Update a project label')
    .option('--name <name>', 'New name')
    .option('--color <hex>', 'New color (hex code)')
    .option('--description <text>', 'New description')
    .action(async (id: string, options) => {
      try {
        if (!options.name && !options.color && !options.description) {
          console.error('❌ Error: At least one field to update is required');
          process.exit(1);
        }

        const resolvedId = resolveAlias('project-label', id);
        const currentLabel = await getProjectLabelById(resolvedId);
        if (!currentLabel) {
          console.error('❌ Project label not found');
          process.exit(1);
        }

        if (options.color && !isValidHexColor(options.color)) {
          console.error('❌ Invalid color format');
          process.exit(1);
        }

        const updateInput: any = {};
        if (options.name) updateInput.name = options.name;
        if (options.color) updateInput.color = normalizeHexColor(options.color);
        if (options.description !== undefined) updateInput.description = options.description;

        await updateProjectLabel(resolvedId, updateInput);
        console.log('✅ Project label updated successfully!');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
