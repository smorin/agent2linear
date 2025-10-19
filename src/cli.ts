import { Command } from 'commander';

const cli = new Command();

cli
  .name('linear-create')
  .description('Command-line tool for creating Linear issues and projects')
  .version('0.1.0');

// Initiatives commands
const initiatives = cli.command('initiatives').description('Manage Linear initiatives');

initiatives
  .command('list')
  .description('List all initiatives and select a default (interactive)')
  .action(() => {
    console.log('Initiatives list command - Coming soon in M03');
  });

initiatives
  .command('set <id>')
  .description('Set default initiative by ID')
  .action((id: string) => {
    console.log(`Set default initiative: ${id} - Coming soon in M03`);
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
  .option('--no-interactive', 'Disable interactive mode')
  .action(options => {
    console.log('Project create command - Coming soon in M04');
    console.log('Options:', options);
  });

// Config commands
const config = cli.command('config').description('Manage configuration');

config
  .command('show')
  .description('Show current configuration')
  .action(() => {
    console.log('Config show command - Coming soon in M02');
  });

export { cli };
