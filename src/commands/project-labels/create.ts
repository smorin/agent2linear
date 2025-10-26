import { Command } from 'commander';
import { createProjectLabel } from '../../lib/linear-client.js';
import { isValidHexColor, normalizeHexColor } from '../../lib/colors.js';

export function createProjectLabelCommand(program: Command) {
  program
    .command('create')
    .description('Create a new project label')
    .option('-n, --name <name>', 'Label name (required)')
    .option('-c, --color <hex>', 'Color (hex code)', '#5E6AD2')
    .option('-d, --description <text>', 'Description')
    .action(async (options) => {
      try {
        if (!options.name) {
          console.error('❌ Error: --name is required');
          process.exit(1);
        }

        if (!isValidHexColor(options.color)) {
          console.error(`❌ Error: Invalid color format: ${options.color}`);
          process.exit(1);
        }

        const label = await createProjectLabel({
          name: options.name,
          color: normalizeHexColor(options.color),
          description: options.description,
        });

        console.log('✅ Project label created successfully!');
        console.log(`   Name: ${label.name}`);
        console.log(`   ID: ${label.id}`);
        console.log(`   Color: ${label.color}`);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
