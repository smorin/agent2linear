import { Command } from 'commander';
import { showConfig } from './commands/config/show.js';
import { setConfig } from './commands/config/set.js';
import { unsetConfig } from './commands/config/unset.js';
import { listInitiatives } from './commands/initiatives/list.js';
import { setInitiative } from './commands/initiatives/set.js';
import { createProjectCommand } from './commands/project/create.js';

const cli = new Command();

cli
  .name('linear-create')
  .description('Command-line tool for creating Linear issues and projects')
  .version('0.4.0');

// Initiatives commands
const initiatives = cli.command('initiatives').description('Manage Linear initiatives');

initiatives
  .command('list')
  .description('List all initiatives and select a default (interactive)')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .action(async (options) => {
    await listInitiatives(options);
  });

initiatives
  .command('set <id>')
  .description('Set default initiative by ID')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .action(async (id: string, options) => {
    await setInitiative(id, options);
  });

// Project commands
const project = cli.command('project').description('Manage Linear projects');

project
  .command('create')
  .description('Create a new project')
  .option('-t, --title <title>', 'Project title')
  .option('-d, --description <description>', 'Project description')
  .option('-s, --state <state>', 'Project state (planned, started, paused, completed, canceled)')
  .option('-i, --initiative <id>', 'Initiative ID to link project to')
  .option('--team <id>', 'Team ID to assign project to')
  .option('--no-interactive', 'Disable interactive mode')
  .action(async options => {
    await createProjectCommand(options);
  });

// Config commands
const config = cli
  .command('config')
  .description('Manage configuration')
  .action(() => {
    config.help();
  });

config
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    await showConfig();
  });

config
  .command('set <key> <value>')
  .description('Set a configuration value (apiKey, defaultInitiative, defaultTeam)')
  .option('-g, --global', 'Set in global config (default)')
  .option('-p, --project', 'Set in project config')
  .action(async (key: string, value: string, options) => {
    await setConfig(key, value, options);
  });

config
  .command('unset <key>')
  .description('Remove a configuration value (apiKey, defaultInitiative, defaultTeam)')
  .option('-g, --global', 'Remove from global config (default)')
  .option('-p, --project', 'Remove from project config')
  .action(async (key: string, options) => {
    await unsetConfig(key, options);
  });

export { cli };
