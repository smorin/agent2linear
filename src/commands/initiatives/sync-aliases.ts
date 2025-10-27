import { Command } from 'commander';
import { getAllInitiatives } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Core function to sync initiative aliases (can be called from multiple places)
 */
export async function syncInitiativeAliasesCore(options: SyncAliasesOptions): Promise<void> {
  const initiatives = await getAllInitiatives();

  await syncAliasesCore({
    entityType: 'initiative',
    entityTypeName: 'initiative',
    entityTypeNamePlural: 'initiatives',
    entities: initiatives,
    options,
  });
}

/**
 * Register the sync-aliases command for initiatives
 */
export function syncInitiativeAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Create aliases for all initiatives')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .addHelpText('after', `
Examples:
  $ linear-create initiatives sync-aliases           # Preview aliases
  $ linear-create init sync-aliases --global         # Create global aliases
  $ linear-create initiatives sync-aliases --project # Create project-local aliases
  $ linear-create initiatives sync-aliases --dry-run # Preview changes
  $ linear-create init sync-aliases --force          # Force override existing

This command will create aliases for all initiatives in your workspace,
using the initiative name converted to lowercase with hyphens (e.g., "Backend API" → "backend-api").
`)
    .action(async (options) => {
      await syncInitiativeAliasesCore(options);
    });
}
