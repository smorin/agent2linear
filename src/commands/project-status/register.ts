import { Command } from 'commander';

import { listProjectStatuses } from './list.js';
import { syncProjectStatusAliases } from './sync-aliases.js';
import { viewProjectStatus } from './view.js';

export function registerProjectStatusCommands(cli: Command): void {
  const projectStatus = cli
    .command('project-status')
    .alias('pstatus')
    .description('Manage Linear project statuses')
    .action(() => {
      projectStatus.help();
    });

  projectStatus
    .command('list')
    .alias('ls')
    .description('List all project statuses')
    .option('-I, --interactive', 'Use interactive mode for browsing')
    .option('-w, --web', 'Open Linear project settings in browser')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear project-status list              # Print list to stdout (formatted)
  $ agent2linear pstatus ls                       # Same as 'list' (alias)
  $ agent2linear project-status list --interactive # Browse interactively
  $ agent2linear project-status list --web        # Open in browser
  $ agent2linear project-status list --format json # Output as JSON
  $ agent2linear project-status list --format tsv  # Output as TSV
  $ agent2linear pstatus list -f tsv | cut -f1    # Get just status IDs
`)
    .action(async (options) => {
      await listProjectStatuses(options);
    });

  projectStatus
    .command('view <name-or-id>')
    .description('View details of a specific project status')
    .option('-w, --web', 'Open project settings in browser instead of displaying in terminal')
    .addHelpText('after', `
Examples:
  $ agent2linear project-status view "In Progress"
  $ agent2linear pstatus view status_abc123
  $ agent2linear project-status view planned --web
  $ agent2linear pstatus view active-status --web  # Using alias
`)
    .action(async (nameOrId: string, options) => {
      await viewProjectStatus(nameOrId, options);
    });

  projectStatus
    .command('sync-aliases')
    .description('Create aliases for all org project statuses')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .option('--dry-run', 'Preview changes without applying them')
    .option('--force', 'Override existing aliases')
    .addHelpText('after', `
Examples:
  $ agent2linear project-status sync-aliases           # Create global aliases
  $ agent2linear pstatus sync-aliases --project        # Create project-local aliases
  $ agent2linear project-status sync-aliases --dry-run # Preview changes
  $ agent2linear pstatus sync-aliases --force          # Force override existing

This command will create aliases for all project statuses in your workspace,
using the status name converted to lowercase with hyphens (e.g., "In Progress" → "in-progress").
`)
    .action(async (options) => {
      await syncProjectStatusAliases(options);
    });
}
