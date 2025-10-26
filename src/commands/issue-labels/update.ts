import { Command } from 'commander';
import { getIssueLabelById, updateIssueLabel } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { isValidHexColor, normalizeHexColor } from '../../lib/colors.js';

export function updateIssueLabelCommand(program: Command) {
  program
    .command('update <id>')
    .description('Update an issue label')
    .option('--name <name>', 'New name')
    .option('--color <hex>', 'New color (hex code)')
    .option('--description <text>', 'New description')
    .action(async (id: string, options) => {
      try {
        if (!options.name && !options.color && !options.description) {
          console.error('❌ Error: At least one field to update is required');
          process.exit(1);
        }

        const resolvedId = resolveAlias('issue-label', id);
        const currentLabel = await getIssueLabelById(resolvedId);
        if (!currentLabel) {
          console.error(`❌ Issue label not found: ${id}`);
          process.exit(1);
        }

        if (options.color && !isValidHexColor(options.color)) {
          console.error(`❌ Error: Invalid color format: ${options.color}`);
          process.exit(1);
        }

        const updateInput: any = {};
        if (options.name) updateInput.name = options.name;
        if (options.color) updateInput.color = normalizeHexColor(options.color);
        if (options.description !== undefined) updateInput.description = options.description;

        console.log('📝 Updating issue label...');
        const updatedLabel = await updateIssueLabel(resolvedId, updateInput);

        console.log('');
        console.log('✅ Issue label updated successfully!');
        if (options.name) console.log(`   Name: ${currentLabel.name} → ${updatedLabel.name}`);
        if (options.color) console.log(`   Color: ${currentLabel.color} → ${updatedLabel.color}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
