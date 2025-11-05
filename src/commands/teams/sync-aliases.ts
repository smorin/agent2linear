import { Command } from 'commander';
import { getAllTeams } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Core function to sync team aliases (can be called from multiple places)
 */
export async function syncTeamAliasesCore(options: SyncAliasesOptions): Promise<void> {
  const teams = await getAllTeams();

  await syncAliasesCore({
    entityType: 'team',
    entityTypeName: 'team',
    entityTypeNamePlural: 'teams',
    entities: teams,
    formatEntityDisplay: (team) => `${team.name} [${team.key}]`,
    options,
  });
}

/**
 * Register the sync-aliases command for teams
 */
export function syncTeamAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Create aliases for all teams')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('--no-auto-suffix', 'Disable auto-numbering for duplicate slugs (skip duplicates instead)')
    .addHelpText('after', `
Examples:
  $ agent2linear teams sync-aliases           # Preview aliases
  $ agent2linear team sync-aliases --global   # Create global aliases
  $ agent2linear teams sync-aliases --project # Create project-local aliases
  $ agent2linear teams sync-aliases --dry-run # Preview changes
  $ agent2linear team sync-aliases --force    # Force override existing

This command will create aliases for all teams in your workspace,
using the team name converted to lowercase with hyphens (e.g., "Engineering Team" → "engineering-team").

When multiple teams have names that slug to the same alias, auto-numbering is applied.
Use --no-auto-suffix to disable this and skip duplicates instead.
`)
    .action(async (options) => {
      await syncTeamAliasesCore(options);
    });
}
