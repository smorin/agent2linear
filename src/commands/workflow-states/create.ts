import { Command } from 'commander';
import { createWorkflowState } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { getConfig } from '../../lib/config.js';
import { isValidHexColor, normalizeHexColor } from '../../lib/colors.js';

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
          console.log('Usage: linear-create workflow-states create --name "In Review" --team team_abc123');
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
          console.log(`     $ linear-create workflow-states create --name "${options.name}" --team team_abc123`);
          console.log('');
          console.log('  2. Set a default team:');
          console.log('     $ linear-create teams select');
          console.log('     $ linear-create config set defaultTeam team_abc123');
          console.log('');
          process.exit(1);
        }

        // Resolve team alias
        teamId = resolveAlias('team', teamId);

        // Validate color
        if (!isValidHexColor(options.color)) {
          console.error(`❌ Error: Invalid color format: ${options.color}`);
          console.log('Color must be a valid hex code (e.g., #5E6AD2 or 5E6AD2)');
          process.exit(1);
        }

        const color = normalizeHexColor(options.color);

        // Validate type
        const validTypes = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'];
        if (!validTypes.includes(options.type)) {
          console.error(`❌ Error: Invalid type: ${options.type}`);
          console.log(`Type must be one of: ${validTypes.join(', ')}`);
          process.exit(1);
        }

        console.log('🚀 Creating workflow state...');

        const state = await createWorkflowState({
          name: options.name,
          teamId,
          type: options.type,
          color,
          description: options.description,
          position: parseInt(options.position, 10),
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
