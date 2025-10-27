import { getAllProjectStatuses } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';

/**
 * Core function to sync project status aliases (can be called from multiple places)
 */
export async function syncProjectStatusAliases(options: SyncAliasesOptions = {}): Promise<void> {
  const statuses = await getAllProjectStatuses();

  await syncAliasesCore({
    entityType: 'project-status',
    entityTypeName: 'project status',
    entityTypeNamePlural: 'project statuses',
    entities: statuses,
    options,
  });
}
