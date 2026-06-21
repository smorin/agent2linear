import { Command } from 'commander';

import { addProfileCommand } from './add.js';
import { editProfileCommand } from './edit.js';
import { listProfileCommand } from './list.js';
import { removeProfileCommand } from './remove.js';

export function registerProfileCommands(cli: Command): void {
  const profile = cli
    .command('profile')
    .alias('prof')
    .description('Manage profiles (workspace + defaults + detection rules)')
    .action(() => {
      profile.help();
    });

  profile
    .command('add <name>')
    .description('Create a profile pointing at a workspace, with optional defaults')
    .option('--workspace <name>', 'Workspace this profile points at (by name)')
    .option('--default-team <id|alias>', 'Default team for this profile')
    .option('--default-initiative <id|alias>', 'Default initiative for this profile')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile add acme --workspace acme --default-team backend
  $ agent2linear profile add personal --workspace personal --global

A profile points at a workspace by NAME; the key lives in the secrets registry
(workspace add), so config.json stays safe to commit. Set a persisted default
with "agent2linear config set defaultProfile <name>".
`)
    .action((name: string, options) => {
      addProfileCommand(name, options);
    });

  profile
    .command('list')
    .alias('ls')
    .description('List registered profiles with workspace + defaults (offline)')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear profile list
  $ agent2linear prof ls --format json
`)
    .action((options?: { format?: 'tsv' | 'json' }) => {
      listProfileCommand(options || {});
    });

  profile
    .command('edit <name>')
    .description('Modify an existing profile (merges the given fields)')
    .option('--workspace <name>', 'Change the workspace this profile points at')
    .option('--default-team <id|alias>', 'Change the default team')
    .option('--default-initiative <id|alias>', 'Change the default initiative')
    .option('-g, --global', 'Edit global config (default)')
    .option('-p, --project', 'Edit project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile edit acme --default-team frontend
  $ agent2linear profile edit acme --workspace acme-prod --project

Only the fields you pass are changed; the rest of the profile is preserved.
`)
    .action((name: string, options) => {
      editProfileCommand(name, options);
    });

  profile
    .command('remove <name>')
    .alias('rm')
    .description('Remove a profile')
    .option('-g, --global', 'Remove from global config (default)')
    .option('-p, --project', 'Remove from project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile remove acme
  $ agent2linear prof rm acme --project
`)
    .action((name: string, options) => {
      removeProfileCommand(name, options);
    });
}
