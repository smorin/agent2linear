import { Command } from 'commander';

import { createProjectLabel } from '../../lib/linear-client.js';

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

        const { validateAndNormalizeColor } = await import('../../lib/validators.js');
        const colorResult = validateAndNormalizeColor(options.color);
        if (!colorResult.valid) {
          console.error(`❌ Error: ${colorResult.error}`);
          process.exit(1);
        }

        const label = await createProjectLabel({
          name: options.name,
          color: colorResult.value!,
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
