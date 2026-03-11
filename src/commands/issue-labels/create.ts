import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { createIssueLabel } from '../../lib/linear-client.js';

export function createIssueLabelCommand(program: Command) {
  program
    .command('create')
    .description('Create a new issue label')
    .option('-n, --name <name>', 'Label name (required)')
    .option('-c, --color <hex>', 'Color (hex code)', '#5E6AD2')
    .option('-d, --description <text>', 'Description')
    .option('-t, --team <id>', 'Team ID (omit for workspace-level label)')
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
        const color = colorResult.value!;
        let teamId = options.team;
        if (teamId) {
          teamId = resolveAlias('team', teamId);
        }

        console.log('🚀 Creating issue label...');

        const label = await createIssueLabel({
          name: options.name,
          color,
          description: options.description,
          teamId,
        });

        console.log('');
        console.log('✅ Issue label created successfully!');
        console.log(`   Name: ${label.name}`);
        console.log(`   ID: ${label.id}`);
        console.log(`   Color: ${label.color}`);
        console.log(`   Scope: ${label.teamId ? 'Team' : 'Workspace'}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
