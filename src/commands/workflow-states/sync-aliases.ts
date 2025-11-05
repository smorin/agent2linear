import { Command } from 'commander';
import { getAllWorkflowStates } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';
import { getConfig } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';

/**
 * Extended options for workflow-state sync (includes team filtering)
 */
export interface SyncWorkflowStateAliasesOptions extends SyncAliasesOptions {
  team?: string;
}

/**
 * Core function to sync workflow state aliases (can be called from multiple places)
 */
export async function syncWorkflowStateAliasesCore(options: SyncWorkflowStateAliasesOptions): Promise<void> {
  // Get team ID
  let teamId = options.team;
  if (teamId) {
    teamId = resolveAlias('team', teamId);
  } else {
    const config = getConfig();
    teamId = config.defaultTeam;
  }

  const states = await getAllWorkflowStates(teamId);

  await syncAliasesCore({
    entityType: 'workflow-state',
    entityTypeName: 'workflow state',
    entityTypeNamePlural: 'workflow states',
    entities: states,
    options,
  });
}

/**
 * Register the sync-aliases command for workflow states
 */
export function syncWorkflowStateAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync workflow state aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Only sync states for specific team')
    .option('--no-auto-suffix', 'Disable auto-numbering for duplicate slugs (skip duplicates instead)')
    .action(async (options) => {
      await syncWorkflowStateAliasesCore(options);
    });
}
