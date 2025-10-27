import { Command } from 'commander';
import { getAllIssueLabels } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Extended options for issue-label sync (includes team filtering)
 */
export interface SyncIssueLabelAliasesOptions extends SyncAliasesOptions {
  team?: string;
}

/**
 * Core function to sync issue label aliases (can be called from multiple places)
 */
export async function syncIssueLabelAliasesCore(options: SyncIssueLabelAliasesOptions): Promise<void> {
  const labels = await getAllIssueLabels(options.team);

  await syncAliasesCore({
    entityType: 'issue-label',
    entityTypeName: 'issue label',
    entityTypeNamePlural: 'issue labels',
    entities: labels,
    options,
  });
}

/**
 * Register the sync-aliases command for issue labels
 */
export function syncIssueLabelAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync issue label aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Only sync labels for specific team')
    .action(async (options) => {
      await syncIssueLabelAliasesCore(options);
    });
}
