import { Command, Option, Argument } from 'commander';
import { listConfig } from './commands/config/list.js';
import { getConfigValue } from './commands/config/get.js';
import { setConfig } from './commands/config/set.js';
import { unsetConfig } from './commands/config/unset.js';
import { listInitiatives } from './commands/initiatives/list.js';
import { viewInitiative } from './commands/initiatives/view.js';
import { selectInitiative } from './commands/initiatives/select.js';
import { setInitiative } from './commands/initiatives/set.js';
import { createProjectCommand } from './commands/project/create.js';
import { viewProject } from './commands/project/view.js';
import { listTeams } from './commands/teams/list.js';
import { selectTeam } from './commands/teams/select.js';

const cli = new Command();

cli
  .name('linear-create')
  .description('Command-line tool for creating Linear issues and projects')
  .version('0.5.1')
  .action(() => {
    cli.help();
  });

// Initiatives commands
const initiatives = cli
  .command('initiatives')
  .alias('init')
  .description('Manage Linear initiatives')
  .action(() => {
    initiatives.help();
  });

initiatives
  .command('list')
  .alias('ls')
  .description('List all initiatives')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear in browser to view initiatives')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives list              # Print list to stdout
  $ linear-create init ls                        # Same as 'list' (alias)
  $ linear-create initiatives list --interactive # Browse interactively
  $ linear-create initiatives list --web         # Open in browser
`)
  .action(async (options) => {
    await listInitiatives(options);
  });

initiatives
  .command('view <id>')
  .description('View details of a specific initiative (format: init_xxx)')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives view init_abc123
  $ linear-create init view init_abc123
`)
  .action(async (id: string) => {
    await viewInitiative(id);
  });

initiatives
  .command('select')
  .description('Select a default initiative interactively')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .option('--id <id>', 'Initiative ID (non-interactive mode)')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives select                # Interactive selection
  $ linear-create initiatives select --project      # Save to project config
  $ linear-create initiatives select --id init_abc123  # Non-interactive
`)
  .action(async (options) => {
    await selectInitiative(options);
  });

initiatives
  .command('set <id>')
  .description('Set default initiative by ID (format: init_xxx)')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives set init_abc123
  $ linear-create initiatives set init_xyz789 --project
`)
  .action(async (id: string, options) => {
    await setInitiative(id, options);
  });

// Project commands
const project = cli
  .command('project')
  .alias('proj')
  .description('Manage Linear projects')
  .action(() => {
    project.help();
  });

project
  .command('create')
  .alias('new')
  .description('Create a new project')
  .option('-I, --interactive', 'Use interactive mode')
  .option('-w, --web', 'Open Linear in browser to create project')
  .option('-t, --title <title>', 'Project title (minimum 3 characters)')
  .option('-d, --description <description>', 'Project description')
  .addOption(
    new Option('-s, --state <state>', 'Project state')
      .choices(['planned', 'started', 'paused', 'completed', 'canceled'])
      .default('planned')
  )
  .option('-i, --initiative <id>', 'Initiative ID to link project to (format: init_xxx)')
  .option('--team <id>', 'Team ID to assign project to (format: team_xxx)')
  .addHelpText('after', `
Examples:
  $ linear-create project create --title "My Project" --state started
  $ linear-create proj new --title "Quick Project"  # Same as 'create' (alias)
  $ linear-create project create --title "Q1 Goals" --initiative init_abc123 --team team_xyz789
  $ linear-create project create --interactive   # Interactive mode
  $ linear-create project create --web           # Open in browser
`)
  .action(async options => {
    await createProjectCommand(options);
  });

project
  .command('view <id>')
  .description('View details of a specific project')
  .addHelpText('after', `
Examples:
  $ linear-create project view PRJ-123
  $ linear-create proj view PRJ-456
`)
  .action(async (id: string) => {
    await viewProject(id);
  });

// Issues commands (stub - coming in v0.5.0)
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

// Teams commands
const teams = cli
  .command('teams')
  .alias('team')
  .description('Manage Linear teams')
  .action(() => {
    teams.help();
  });

teams
  .command('list')
  .alias('ls')
  .description('List all teams')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear in browser to view teams')
  .addHelpText('after', `
Examples:
  $ linear-create teams list              # Print list to stdout
  $ linear-create team ls                 # Same as 'list' (alias)
  $ linear-create teams list --interactive # Browse interactively
  $ linear-create teams list --web        # Open in browser
`)
  .action(async (options) => {
    await listTeams(options);
  });

teams
  .command('select')
  .description('Select a default team interactively')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .option('--id <id>', 'Team ID (non-interactive mode)')
  .addHelpText('after', `
Examples:
  $ linear-create teams select                # Interactive selection
  $ linear-create teams select --project      # Save to project config
  $ linear-create teams select --id team_abc123  # Non-interactive
`)
  .action(async (options) => {
    await selectTeam(options);
  });

// Milestones commands (stub - future release)
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

// Labels commands (stub - future release)
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

// Config commands
const config = cli
  .command('config')
  .alias('cfg')
  .description('Manage configuration')
  .action(() => {
    config.help();
  });

config
  .command('list')
  .alias('show')
  .description('List all configuration values')
  .addHelpText('after', `
Examples:
  $ linear-create config list  # Display all config values and sources
  $ linear-create cfg show     # Same as 'list' (alias for backward compatibility)
`)
  .action(async () => {
    await listConfig();
  });

config
  .command('get')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam'])
  )
  .description('Get a single configuration value')
  .addHelpText('after', `
Examples:
  $ linear-create config get apiKey
  $ linear-create cfg get defaultInitiative
`)
  .action(async (key: string) => {
    await getConfigValue(key as 'apiKey' | 'defaultInitiative' | 'defaultTeam');
  });

config
  .command('set')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam'])
  )
  .addArgument(new Argument('<value>', 'Configuration value'))
  .description('Set a configuration value')
  .option('-g, --global', 'Set in global config (default)')
  .option('-p, --project', 'Set in project config')
  .addHelpText('after', `
Examples:
  $ linear-create config set apiKey lin_api_xxx...
  $ linear-create config set defaultInitiative init_abc123 --global
  $ linear-create config set defaultTeam team_xyz789 --project
`)
  .action(async (key: string, value: string, options) => {
    await setConfig(key, value, options);
  });

config
  .command('unset')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam'])
  )
  .description('Remove a configuration value')
  .option('-g, --global', 'Remove from global config (default)')
  .option('-p, --project', 'Remove from project config')
  .addHelpText('after', `
Examples:
  $ linear-create config unset apiKey --global
  $ linear-create config unset defaultTeam --project
`)
  .action(async (key: string, options) => {
    await unsetConfig(key, options);
  });

export { cli };
