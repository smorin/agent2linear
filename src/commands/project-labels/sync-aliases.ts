import { Command } from 'commander';
import { getAllProjectLabels } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Core function to sync project label aliases (can be called from multiple places)
 */
export async function syncProjectLabelAliasesCore(options: SyncAliasesOptions): Promise<void> {
  const labels = await getAllProjectLabels();

  await syncAliasesCore({
    entityType: 'project-label',
    entityTypeName: 'project label',
    entityTypeNamePlural: 'project labels',
    entities: labels,
    options,
  });
}

/**
 * Register the sync-aliases command for project labels
 */
export function syncProjectLabelAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync project label aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('--no-auto-suffix', 'Disable auto-numbering for duplicate slugs (skip duplicates instead)')
    .action(async (options) => {
      await syncProjectLabelAliasesCore(options);
    });
}
