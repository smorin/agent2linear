import { Command } from 'commander';
import { listTeams } from './list.js';
import { selectTeam } from './select.js';
import { setTeam } from './set.js';
import { viewTeam } from './view.js';
import { syncTeamAliases } from './sync-aliases.js';

export function registerTeamsCommands(cli: Command): void {
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
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear teams list              # Print list to stdout (formatted)
  $ agent2linear team ls                 # Same as 'list' (alias)
  $ agent2linear teams list --interactive # Browse interactively
  $ agent2linear teams list --web        # Open in browser
  $ agent2linear teams list --format json # Output as JSON
  $ agent2linear teams list --format tsv  # Output as TSV
  $ agent2linear team list -f tsv | cut -f1  # Get just team IDs
`)
    .action(async (options) => {
      await listTeams(options);
    });

  teams
    .command('select')
    .description('Interactively select a default team')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
Examples:
  $ agent2linear teams select                # Interactive selection
  $ agent2linear teams select --project      # Save to project config
`)
    .action(async (options) => {
      await selectTeam(options);
    });

  teams
    .command('set <id>')
    .description('Set default team by ID (non-interactive)')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
Examples:
  $ agent2linear teams set team_abc123
  $ agent2linear teams set eng              # Using alias
  $ agent2linear teams set team_abc123 --project
`)
    .action(async (id: string, options) => {
      await setTeam(id, options);
    });

  teams
    .command('view <id>')
    .description('View details of a specific team')
    .option('-w, --web', 'Open team in browser instead of displaying in terminal')
    .addHelpText('after', `
Examples:
  $ agent2linear teams view team_abc123
  $ agent2linear team view team_abc123
  $ agent2linear teams view team_abc123 --web
  $ agent2linear team view eng --web
`)
    .action(async (id: string, options) => {
      await viewTeam(id, options);
    });

  syncTeamAliases(teams);
}
