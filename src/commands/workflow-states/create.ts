import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
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
          console.error('❌ Error: --name is required');
          console.log('');
          console.log('Usage: agent2linear workflow-states create --name "In Review" --team team_abc123');
          process.exit(1);
        }

        // Get team ID
        let teamId = options.team;
        if (!teamId) {
          const config = getConfig();
          teamId = config.defaultTeam;
        }

        if (!teamId) {
          console.error('❌ Error: Team is required');
          console.log('');
          console.log('Please specify a team using one of these options:');
          console.log('  1. Use --team flag:');
          console.log(`     $ agent2linear workflow-states create --name "${options.name}" --team team_abc123`);
          console.log('');
          console.log('  2. Set a default team:');
          console.log('     $ agent2linear teams select');
          console.log('     $ agent2linear config set defaultTeam team_abc123');
          console.log('');
          process.exit(1);
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
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
