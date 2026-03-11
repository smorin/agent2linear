import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { getProjectLabelById, updateProjectLabel } from '../../lib/linear-client.js';

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
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('project label', id, 'project-labels list'));
          process.exit(1);
        }

        const { validateAndNormalizeColor } = await import('../../lib/validators.js');
        if (options.color) {
          const colorResult = validateAndNormalizeColor(options.color);
          if (!colorResult.valid) {
            console.error(`❌ Error: ${colorResult.error}`);
            process.exit(1);
          }
        }

        const updateInput: { name?: string; color?: string; description?: string } = {};
        if (options.name) updateInput.name = options.name;
        if (options.color) {
          const colorResult = validateAndNormalizeColor(options.color);
          updateInput.color = colorResult.value!;
        }
        if (options.description !== undefined) updateInput.description = options.description;

        await updateProjectLabel(resolvedId, updateInput);
        console.log('✅ Project label updated successfully!');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
