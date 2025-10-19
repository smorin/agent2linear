import { Command, Option, Argument } from 'commander';
import { listConfig } from './commands/config/list.js';
import { getConfigValue } from './commands/config/get.js';
import { setConfig } from './commands/config/set.js';
import { unsetConfig } from './commands/config/unset.js';
import { editConfig } from './commands/config/edit.js';
import { listInitiatives } from './commands/initiatives/list.js';
import { viewInitiative } from './commands/initiatives/view.js';
import { selectInitiative } from './commands/initiatives/select.js';
import { setInitiative } from './commands/initiatives/set.js';
import { createProjectCommand } from './commands/project/create.js';
import { viewProject } from './commands/project/view.js';
import { listTeams } from './commands/teams/list.js';
import { selectTeam } from './commands/teams/select.js';
import { addAliasCommand } from './commands/alias/add.js';
import { listAliasCommand } from './commands/alias/list.js';
import { removeAliasCommand } from './commands/alias/remove.js';
import { getAliasCommand } from './commands/alias/get.js';
import { editAlias } from './commands/alias/edit.js';
import { listTemplates } from './commands/templates/list.js';
import { viewTemplate } from './commands/templates/view.js';

const cli = new Command();

cli
  .name('linear-create')
  .description('Command-line tool for creating Linear issues and projects')
  .version('0.7.0')
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
  .option('--template <id>', 'Template ID to use for project creation (format: template_xxx)')
  .addHelpText('after', `
Examples:
  $ linear-create project create --title "My Project" --state started
  $ linear-create proj new --title "Quick Project"  # Same as 'create' (alias)
  $ linear-create project create --title "Q1 Goals" --initiative init_abc123 --team team_xyz789
  $ linear-create project create --title "API Project" --template template_abc123 --team team_xyz789
  $ linear-create project create --interactive   # Interactive mode
  $ linear-create project create --web           # Open in browser

Note: Set a default template with:
  $ linear-create config set defaultProjectTemplate template_abc123
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

// Alias commands
const alias = cli
  .command('alias')
  .description('Manage aliases for initiatives, teams, projects, and templates')
  .action(() => {
    alias.help();
  });

alias
  .command('add')
  .addArgument(
    new Argument('<type>', 'Entity type')
      .choices(['initiative', 'team', 'project', 'initiatives', 'teams', 'projects', 'issue-template', 'issue-templates', 'project-template', 'project-templates'])
  )
  .addArgument(new Argument('<alias>', 'Alias name (no spaces)'))
  .addArgument(new Argument('<id>', 'Linear ID (e.g., init_xxx, team_xxx, proj_xxx, template_xxx)'))
  .description('Add a new alias')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .option('--skip-validation', 'Skip entity validation (faster)')
  .addHelpText('after', `
Examples:
  $ linear-create alias add initiative backend init_abc123xyz
  $ linear-create alias add team frontend team_def456uvw --project
  $ linear-create alias add project api proj_ghi789rst
  $ linear-create alias add issue-template bug-report template_abc123
  $ linear-create alias add project-template sprint-template template_xyz789
`)
  .action(async (type: string, alias: string, id: string, options) => {
    await addAliasCommand(type, alias, id, options);
  });

alias
  .command('list [type]')
  .alias('ls')
  .description('List all aliases or aliases for a specific type')
  .option('--validate', 'Validate that aliases point to existing entities')
  .addHelpText('after', `
Examples:
  $ linear-create alias list                    # List all aliases
  $ linear-create alias ls                      # Same as 'list' (alias)
  $ linear-create alias list initiatives        # List only initiative aliases
  $ linear-create alias list issue-templates    # List only issue template aliases
  $ linear-create alias list project-templates  # List only project template aliases
  $ linear-create alias list --validate         # Validate all aliases
`)
  .action(async (type?: string, options?: { validate?: boolean }) => {
    await listAliasCommand(type, options);
  });

alias
  .command('remove')
  .alias('rm')
  .addArgument(
    new Argument('<type>', 'Entity type')
      .choices(['initiative', 'team', 'project', 'initiatives', 'teams', 'projects', 'issue-template', 'issue-templates', 'project-template', 'project-templates'])
  )
  .addArgument(new Argument('<alias>', 'Alias name to remove'))
  .description('Remove an alias')
  .option('-g, --global', 'Remove from global config (default)')
  .option('-p, --project', 'Remove from project config')
  .addHelpText('after', `
Examples:
  $ linear-create alias remove initiative backend
  $ linear-create alias rm team frontend --project
  $ linear-create alias remove issue-template bug-report
  $ linear-create alias rm project-template sprint-template
`)
  .action((type: string, alias: string, options) => {
    removeAliasCommand(type, alias, options);
  });

alias
  .command('get')
  .addArgument(
    new Argument('<type>', 'Entity type')
      .choices(['initiative', 'team', 'project', 'initiatives', 'teams', 'projects', 'issue-template', 'issue-templates', 'project-template', 'project-templates'])
  )
  .addArgument(new Argument('<alias>', 'Alias name'))
  .description('Get the ID for an alias')
  .addHelpText('after', `
Examples:
  $ linear-create alias get initiative backend
  $ linear-create alias get team frontend
  $ linear-create alias get issue-template bug-report
  $ linear-create alias get project-template sprint-template
`)
  .action((type: string, alias: string) => {
    getAliasCommand(type, alias);
  });

alias
  .command('edit')
  .description('Interactively edit aliases')
  .option('-g, --global', 'Edit global aliases')
  .option('-p, --project', 'Edit project aliases')
  .addHelpText('after', `
Examples:
  $ linear-create alias edit           # Interactive mode
  $ linear-create alias edit --global  # Edit global aliases
  $ linear-create alias edit --project # Edit project aliases

Note: For non-interactive editing, use 'alias remove' and 'alias add' commands.
`)
  .action(async (options) => {
    await editAlias(options);
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

// Templates commands
const templates = cli
  .command('templates')
  .alias('tmpl')
  .description('Manage Linear templates')
  .action(() => {
    templates.help();
  });

templates
  .command('list [type]')
  .alias('ls')
  .description('List all templates or filter by type (issue/project)')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear templates page in browser')
  .addHelpText('after', `
Examples:
  $ linear-create templates list              # List all templates
  $ linear-create tmpl ls                      # Same as 'list' (alias)
  $ linear-create templates list issues        # List only issue templates
  $ linear-create templates list projects      # List only project templates
  $ linear-create templates list --interactive # Browse interactively
  $ linear-create templates list --web         # Open in browser
`)
  .action(async (type?: string, options?: { interactive?: boolean; web?: boolean }) => {
    await listTemplates(type, options || {});
  });

templates
  .command('view <id>')
  .description('View details of a specific template')
  .addHelpText('after', `
Examples:
  $ linear-create templates view template_abc123
  $ linear-create tmpl view template_xyz789
`)
  .action(async (id: string) => {
    await viewTemplate(id);
  });

// Config commands
const config = cli
  .command('config')
  .alias('cfg')
  .description('Manage configuration settings for linear-create')
  .addHelpText('before', `
Current respected settings:
- \`apiKey\`: Linear API authentication key (get yours at linear.app/settings/api)
- \`defaultInitiative\`: Default initiative ID for project creation (format: init_xxx)
- \`defaultTeam\`: Default team ID for project creation (format: team_xxx)
- \`defaultIssueTemplate\`: Default template ID for issue creation (format: template_xxx)
- \`defaultProjectTemplate\`: Default template ID for project creation (format: template_xxx)

Configuration files:
- Global:  ~/.config/linear-create/config.json
- Project: .linear-create/config.json
- Priority: environment > project > global (for apiKey)
            project > global (for other settings)
`)
  .addHelpText('after', `
Related Commands:
  $ linear-create initiatives select   # Interactive initiative picker
  $ linear-create teams select         # Interactive team picker

Learn More:
  Get your Linear API key at: https://linear.app/settings/api
`)
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
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate'])
  )
  .description('Get a single configuration value')
  .addHelpText('after', `
Examples:
  $ linear-create config get apiKey
  $ linear-create cfg get defaultInitiative
  $ linear-create cfg get defaultProjectTemplate
`)
  .action(async (key: string) => {
    await getConfigValue(key as any);
  });

config
  .command('set')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate'])
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
  $ linear-create config set defaultProjectTemplate template_abc123
`)
  .action(async (key: string, value: string, options) => {
    await setConfig(key, value, options);
  });

config
  .command('unset')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate'])
  )
  .description('Remove a configuration value')
  .option('-g, --global', 'Remove from global config (default)')
  .option('-p, --project', 'Remove from project config')
  .addHelpText('after', `
Examples:
  $ linear-create config unset apiKey --global
  $ linear-create config unset defaultTeam --project
  $ linear-create config unset defaultProjectTemplate
`)
  .action(async (key: string, options) => {
    await unsetConfig(key, options);
  });

config
  .command('edit')
  .description('Edit configuration interactively')
  .option('-g, --global', 'Edit global config (skip scope prompt)')
  .option('-p, --project', 'Edit project config (skip scope prompt)')
  .option('--key <key>', 'Configuration key to edit (non-interactive)')
  .option('--value <value>', 'Configuration value (requires --key, non-interactive)')
  .addHelpText('after', `
Examples:
  $ linear-create config edit                      # Interactive multi-value editing
  $ linear-create config edit --global             # Edit global config interactively
  $ linear-create config edit --key apiKey --value lin_api_xxx  # Non-interactive single value
  $ linear-create cfg edit                         # Same as 'config edit' (alias)
`)
  .action(async (options) => {
    await editConfig(options);
  });

export { cli };
