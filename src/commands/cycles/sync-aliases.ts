import { getAllCycles } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Core function to sync cycle aliases
 */
export async function syncCycleAliasesCore(options: SyncAliasesOptions): Promise<void> {
  const cycles = await getAllCycles();

  await syncAliasesCore({
    entityType: 'cycle',
    entityTypeName: 'cycle',
    entityTypeNamePlural: 'cycles',
    entities: cycles,
    formatEntityDisplay: (cycle) => `${cycle.name} (#${cycle.number})`,
    options,
  });
}
