import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { CliError, isAuthenticationError, UsageError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import { createWorkflowState } from '../../lib/linear-client.js';

export function createWorkflowStateCommand(program: Command) {
  program
    .command('create')
    .description('Create a new workflow state')
    .option('-n, --name <name>', 'Workflow state name (required)')
    .option('-t, --team <id>', 'Team ID (required, or use defaultTeam from config)')
    .option('--type <type>', 'State type (triage|backlog|unstarted|started|completed|canceled)', 'unstarted')
    .option('-c, --color <hex>', 'Color (hex code)', '#5E6AD2')
    .option('-d, --description <text>', 'Description')
    .option('--position <number>', 'Position in workflow', '0')
    .action(async (options) => {
      try {
        // Validate required fields
        if (!options.name) {
          throw new UsageError('--name is required');
        }

        // Get team ID
        let teamId = options.team;
        if (!teamId) {
          const config = getConfig();
          teamId = config.defaultTeam;
        }

        if (!teamId) {
          throw new UsageError(
            'Team is required; pass --team <id|alias> or configure defaultTeam'
          );
        }

        // Resolve team alias
        teamId = resolveAlias('team', teamId);

        // Validate color
        const { validateAndNormalizeColor, validateEnumValue } = await import('../../lib/validators.js');
        const colorResult = validateAndNormalizeColor(options.color);
        if (!colorResult.valid) {
          console.error(`❌ Error: ${colorResult.error}`);
          process.exit(1);
        }
        const color = colorResult.value!;

        // Validate type
        const validTypes = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'];
        const typeResult = validateEnumValue(options.type, validTypes, 'type');
        if (!typeResult.valid) {
          console.error(`❌ Error: ${typeResult.error}`);
          process.exit(1);
        }

        console.log('🚀 Creating workflow state...');

        const state = await createWorkflowState({
          name: options.name,
          teamId,
          type: options.type,
          color,
          description: options.description,
          position: (() => {
            const pos = parseInt(options.position, 10);
            if (isNaN(pos)) {
              console.error('❌ Position must be a valid number');
              process.exit(1);
            }
            return pos;
          })(),
        });

        console.log('');
        console.log('✅ Workflow state created successfully!');
        console.log(`   Name: ${state.name}`);
        console.log(`   ID: ${state.id}`);
        console.log(`   Type: ${state.type}`);
        console.log(`   Color: ${state.color}`);
        console.log(`   Position: ${state.position}`);
        console.log('');
      } catch (error) {
        if (error instanceof CliError) throw error;
        if (isAuthenticationError(error)) throw error;
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
