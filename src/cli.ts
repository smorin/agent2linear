import { Command } from 'commander';

import { registerAliasCommands } from './commands/alias/register.js';
import { registerCacheCommands } from './commands/cache/register.js';
import { registerColorsCommands } from './commands/colors/register.js';
import { registerConfigCommands } from './commands/config/register.js';
import { registerCyclesCommands } from './commands/cycles/register.js';
import { doctorCommand } from './commands/doctor.js';
import { registerIconsCommands } from './commands/icons/register.js';
// Per-entity command registrations
import { registerInitiativesCommands } from './commands/initiatives/register.js';
import { registerIssueCommands } from './commands/issue/register.js';
import { registerIssueLabelsCommands } from './commands/issue-labels/register.js';
import { registerMembersCommands } from './commands/members/register.js';
import { registerMilestoneTemplatesCommands } from './commands/milestone-templates/register.js';
import { registerProjectCommands } from './commands/project/register.js';
import { registerProjectLabelsCommands } from './commands/project-labels/register.js';
import { registerProjectStatusCommands } from './commands/project-status/register.js';
import { setup } from './commands/setup.js';
import { registerTeamsCommands } from './commands/teams/register.js';
import { registerTemplatesCommands } from './commands/templates/register.js';
import { whoamiCommand } from './commands/whoami.js';
import { registerWorkflowStatesCommands } from './commands/workflow-states/register.js';
import { setLogLevel } from './lib/logger.js';
import { setNoColor } from './lib/output.js';

const cli = new Command();

cli
  .name('agent2linear')
  .description('Command-line tool for creating Linear issues and projects. Designed for AI agents and automation.')
  .version('0.24.1')
  .option('-q, --quiet', 'Suppress progress messages (errors still shown)')
  .option('-v, --verbose', 'Show debug output')
  .option('--no-color', 'Disable emojis and colored output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.quiet) setLogLevel('quiet');
    if (opts.verbose) setLogLevel('verbose');
    if (opts.color === false) setNoColor(true);
  })
  .action(() => {
    cli.help();
  });

// Register all entity command groups
registerInitiativesCommands(cli);
registerProjectCommands(cli);
registerTeamsCommands(cli);
registerMembersCommands(cli);
registerProjectStatusCommands(cli);
registerAliasCommands(cli);
registerMilestoneTemplatesCommands(cli);
registerTemplatesCommands(cli);
registerConfigCommands(cli);
registerWorkflowStatesCommands(cli);
registerIssueLabelsCommands(cli);
registerProjectLabelsCommands(cli);
registerIconsCommands(cli);
registerColorsCommands(cli);
registerCacheCommands(cli);
registerIssueCommands(cli);
registerCyclesCommands(cli);

// Stub command groups (future releases)
const issues = cli
  .command('issues')
  .alias('iss')
  .description('Manage Linear issues [Coming Soon]')
  .action(() => {
    issues.help();
  });

issues
  .command('create')
  .alias('new')
  .description('Create a new issue [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

issues
  .command('list')
  .alias('ls')
  .description('List issues [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

const milestones = cli
  .command('milestones')
  .alias('mile')
  .description('Manage project milestones [Coming Soon]')
  .action(() => {
    milestones.help();
  });

milestones
  .command('list')
  .alias('ls')
  .description('List milestones [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

const labels = cli
  .command('labels')
  .alias('lbl')
  .description('Manage issue labels [Coming Soon]')
  .action(() => {
    labels.help();
  });

labels
  .command('list')
  .alias('ls')
  .description('List labels [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

// Top-level commands
cli
  .command('whoami')
  .description('Display authenticated user info')
  .addHelpText('after', `
Examples:
  $ agent2linear whoami    # Show your name, email, organization, and API key

Displays the identity associated with your configured Linear API key.
`)
  .action(async () => {
    await whoamiCommand();
  });

cli
  .command('doctor')
  .description('Run diagnostic checks on your agent2linear environment')
  .addHelpText('after', `
Examples:
  $ agent2linear doctor    # Run all diagnostic checks

Checks:
  • API key configuration
  • API connectivity
  • Default team/initiative settings
  • Cache health
  • Alias counts
`)
  .action(async () => {
    await doctorCommand();
  });

cli
  .command('setup')
  .description('Interactive first-time setup wizard')
  .addHelpText('after', `
Examples:
  $ agent2linear setup    # Run interactive setup wizard

This command will guide you through:
  • Setting up your Linear API key
  • Selecting your default team
  • Configuring optional defaults
  • Learning about key commands
`)
  .action(async () => {
    await setup();
  });

export { cli };
