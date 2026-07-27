import { Command } from 'commander';

import { listMembers } from './list.js';
import { syncMemberAliases } from './sync-aliases.js';

export function registerMembersCommands(cli: Command): void {
  const members = cli
    .command('members')
    .alias('users')
    .description('Manage Linear members/users');

  members
    .command('list')
    .alias('ls')
    .description('List members in your organization or team')
    .option('-I, --interactive', 'Use interactive mode for browsing')
    .option('-w, --web', 'Open Linear members page in browser')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .option('--team <id>', 'Filter by team (uses default team if not specified)')
    .option('--org-wide', 'List all organization members (ignore team filter)')
    .option('--name <search>', 'Filter by name')
    .option('--email <search>', 'Filter by email')
    .option('--active', 'Show only active members')
    .option('--inactive', 'Show only inactive members')
    .option('--admin', 'Show only admin users')
    .option('--columns <fields>', 'Comma-separated list of columns to display (e.g., "id,name,email")')
    .addHelpText('after', `
Examples:
  $ agent2linear members list                    # List default team members
  $ agent2linear users ls                        # Same as 'list' (alias)
  $ agent2linear members list --org-wide         # List all organization members
  $ agent2linear members list --team team_abc123 # List specific team members
  $ agent2linear members list --name John        # Filter by name
  $ agent2linear members list --email @acme.com  # Filter by email domain
  $ agent2linear members list --active           # Show only active members
  $ agent2linear members list --admin            # Show only admins
  $ agent2linear members list --interactive      # Browse interactively
  $ agent2linear members list --web              # Open in browser
  $ agent2linear members list --format json      # Output as JSON
  $ agent2linear members list --format tsv       # Output as TSV
  $ agent2linear members list -f tsv | cut -f1   # Get just member IDs

Note: By default, uses your configured default team. Use --org-wide to see all members.
  $ agent2linear config set defaultTeam team_xxx  # Set default team
`)
    .action(async (options) => {
      await listMembers(options);
    });

  syncMemberAliases(members);
}
