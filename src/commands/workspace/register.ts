import { Command } from 'commander';

import { addWorkspaceCommand } from './add.js';
import { currentWorkspaceCommand } from './current.js';
import { listWorkspaceCommand } from './list.js';
import { removeWorkspaceCommand } from './remove.js';

export function registerWorkspaceCommands(cli: Command): void {
  const workspace = cli
    .command('workspace')
    .alias('ws')
    .description('Manage named Linear workspaces (API keys/secrets)');

  workspace
    .command('add <name>')
    .description('Register a named workspace with its Linear API key')
    .option('-g, --global', 'Save to global secrets registry (default)')
    .option('-p, --project', 'Save to project secrets registry (gitignored)')
    .addHelpText('after', `
The API key is provided via the program-level --api-key-file option:

Examples:
  $ agent2linear workspace add acme --api-key-file ./linear.key
  $ echo "lin_api_xxxxxxxx" | agent2linear workspace add acme --api-key-file -
  $ agent2linear workspace add acme --api-key-file - --project   # gitignored project secrets

Notes:
  - Global secrets land in workspaces.json (mode 0600).
  - Project secrets land in .agent2linear/workspaces.local.json and a .gitignore
    entry is added automatically so the key is never committed.
`)
    .action(async (name: string, options) => {
      await addWorkspaceCommand(name, options);
    });

  workspace
    .command('list')
    .alias('ls')
    .description('List registered workspaces with masked keys (offline)')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear workspace list
  $ agent2linear ws ls --format json
`)
    .action(async (options?: { format?: 'tsv' | 'json' }) => {
      await listWorkspaceCommand(options || {});
    });

  workspace
    .command('remove <name>')
    .alias('rm')
    .description('Remove a registered workspace')
    .option('-g, --global', 'Remove from global secrets registry (default)')
    .option('-p, --project', 'Remove from project secrets registry')
    .addHelpText('after', `
Examples:
  $ agent2linear workspace remove acme
  $ agent2linear ws rm acme --project
`)
    .action((name: string, options) => {
      removeWorkspaceCommand(name, options);
    });

  workspace
    .command('current')
    .description('Show the resolved active workspace + source (offline, no API call)')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `
Examples:
  $ agent2linear workspace current
  $ agent2linear --workspace acme workspace current
  $ agent2linear ws current --json

Shows which workspace would be used for this invocation and how it was selected,
without contacting Linear.
`)
    .action((options) => {
      currentWorkspaceCommand(options);
    });
}
