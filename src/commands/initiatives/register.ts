import { Command } from 'commander';

import { listInitiatives } from './list.js';
import { selectInitiative } from './select.js';
import { setInitiative } from './set.js';
import { syncInitiativeAliases } from './sync-aliases.js';
import { viewInitiative } from './view.js';

export function registerInitiativesCommands(cli: Command): void {
  const initiatives = cli
    .command('initiatives')
    .alias('init')
    .description('Manage Linear initiatives');

  initiatives
    .command('list')
    .alias('ls')
    .description('List all initiatives')
    .option('-I, --interactive', 'Use interactive mode for browsing')
    .option('-w, --web', 'Open Linear in browser to view initiatives')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear initiatives list              # Print list to stdout (default TSV)
  $ agent2linear init ls                        # Same as 'list' (alias)
  $ agent2linear initiatives list --interactive # Browse interactively
  $ agent2linear initiatives list --web         # Open in browser
  $ agent2linear initiatives list --format json # Output as JSON
  $ agent2linear initiatives list --format tsv  # Output as TSV (explicit)
  $ agent2linear init list -f json | jq '.[0]'  # Pipe to jq
`)
    .action(async (options) => {
      await listInitiatives(options);
    });

  initiatives
    .command('view [id]')
    .description('View details of a specific initiative (format: init_xxx)')
    .option('-I, --interactive', 'Use interactive mode to select initiative')
    .option('-w, --web', 'Open initiative in browser instead of displaying in terminal')
    .addHelpText('after', `
Examples:
  $ agent2linear initiatives view init_abc123
  $ agent2linear init view init_abc123
  $ agent2linear initiatives view init_abc123 --web
  $ agent2linear init view myalias --web
  $ agent2linear init view --interactive        # Select from list
  $ agent2linear init view -I                   # Select and view in terminal
  $ agent2linear init view -I --web             # Select and open in browser
`)
    .action(async (id: string | undefined, options) => {
      await viewInitiative(id, options);
    });

  initiatives
    .command('select')
    .description('Interactively select a default initiative')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
Examples:
  $ agent2linear initiatives select                # Interactive selection
  $ agent2linear initiatives select --project      # Save to project config
`)
    .action(async (options) => {
      await selectInitiative(options);
    });

  initiatives
    .command('set <id>')
    .description('Set default initiative by ID (non-interactive)')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
Examples:
  $ agent2linear initiatives set init_abc123
  $ agent2linear initiatives set backend        # Using alias
  $ agent2linear initiatives set init_xyz789 --project
`)
    .action(async (id: string, options) => {
      await setInitiative(id, options);
    });

  syncInitiativeAliases(initiatives);
}
