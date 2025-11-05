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
    .option('--no-auto-suffix', 'Disable auto-numbering for duplicate slugs (skip duplicates instead)')
    .addHelpText('after', `
Examples:
  $ agent2linear initiatives sync-aliases           # Preview aliases
  $ agent2linear init sync-aliases --global         # Create global aliases
  $ agent2linear initiatives sync-aliases --project # Create project-local aliases
  $ agent2linear initiatives sync-aliases --dry-run # Preview changes
  $ agent2linear init sync-aliases --force          # Force override existing

This command will create aliases for all initiatives in your workspace,
using the initiative name converted to lowercase with hyphens (e.g., "Backend API" → "backend-api").

When multiple initiatives have names that slug to the same alias (e.g., "Design System" and "Design‑System"),
auto-numbering is applied: the first gets "design-system", subsequent ones get "design-system-2", "design-system-3", etc.
Use --no-auto-suffix to disable this and skip duplicates instead.
`)
    .action(async (options) => {
      await syncInitiativeAliasesCore(options);
    });
}
