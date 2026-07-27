import { Command } from 'commander';

import { listCyclesCommand } from './list.js';
import { syncCycleAliasesCore } from './sync-aliases.js';
import { viewCycleCommand } from './view.js';

export function registerCyclesCommands(cli: Command): void {
  const cycles = cli
    .command('cycles')
    .alias('cycle')
    .description('Manage Linear cycles (sprints)');

  cycles
    .command('list')
    .alias('ls')
    .description('List cycles')
    .option('--team <id|alias>', 'Filter by team')
    .option('-f, --format <type>', 'Output format: json, tsv')
    .addHelpText('after', `
Examples:
  $ agent2linear cycles list                    # List cycles for default team
  $ agent2linear cycles list --team backend     # List cycles for specific team
  $ agent2linear cycles list --format json      # JSON output
`)
    .action(async (options) => {
      await listCyclesCommand(options);
    });

  cycles
    .command('view <id>')
    .description('View cycle details')
    .option('--json', 'Output as JSON')
    .addHelpText('after', `
Examples:
  $ agent2linear cycles view cycle_abc123
  $ agent2linear cycles view sprint-1          # Using alias
  $ agent2linear cycles view sprint-1 --json   # JSON output
`)
    .action(async (id, options) => {
      await viewCycleCommand(id, options);
    });

  cycles
    .command('sync-aliases')
    .description('Create aliases for all cycles')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('--no-auto-suffix', 'Disable auto-numbering for duplicate slugs')
    .addHelpText('after', `
Examples:
  $ agent2linear cycles sync-aliases --global    # Create global aliases
  $ agent2linear cycles sync-aliases --dry-run   # Preview changes
`)
    .action(async (options) => {
      await syncCycleAliasesCore(options);
    });
}
