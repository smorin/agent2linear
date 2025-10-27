import { Command } from 'commander';
import { getAllMembers } from '../../lib/linear-client.js';
import { syncAliasesCore, type SyncAliasesOptions } from '../../lib/sync-aliases.js';
import { resolveAlias } from '../../lib/aliases.js';
import { getConfig } from '../../lib/config.js';

/**
 * Extended options for member sync (includes team filtering)
 */
export interface SyncMemberAliasesOptions extends SyncAliasesOptions {
  team?: string;
  orgWide?: boolean;
}

/**
 * Core function to sync member aliases (can be called from multiple places)
 */
export async function syncMemberAliasesCore(options: SyncMemberAliasesOptions): Promise<void> {
  // Determine team filter
  let teamId: string | undefined;
  if (options.team) {
    teamId = resolveAlias('team', options.team);
  } else if (!options.orgWide) {
    // Check if there's a default team, but don't use it - default to org-wide
    const config = getConfig();
    if (config.defaultTeam && !options.orgWide) {
      // We still default to org-wide unless --team is explicitly specified
      teamId = undefined;
    }
  }

  const members = await getAllMembers({ teamId });
  const scopeLabel = teamId ? 'team members' : 'organization members';

  await syncAliasesCore({
    entityType: 'member',
    entityTypeName: 'member',
    entityTypeNamePlural: scopeLabel,
    entities: members,
    formatEntityDisplay: (member) => `${member.name} <${member.email}>`,
    options,
    detectDuplicates: true, // Members can have duplicate names
  });

  // Add filter hint if in dry-run mode
  if ((!options.global && !options.project) || options.dryRun) {
    if (!teamId) {
      console.log('');
      console.log('💡 Filter options:');
      console.log('   --team <id>: Sync only members of a specific team');
      console.log('   --org-wide: Sync all organization members (default)');
    }
  }
}

/**
 * Register the sync-aliases command for members
 */
export function syncMemberAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Create aliases for members/users')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Only sync members for specific team')
    .option('--org-wide', 'Sync all organization members (default)')
    .addHelpText('after', `
Examples:
  $ linear-create members sync-aliases                  # Preview all org members
  $ linear-create users sync-aliases --global           # Create global aliases for all org members
  $ linear-create members sync-aliases --project        # Create project-local aliases
  $ linear-create members sync-aliases --team team_xyz  # Sync only specific team members
  $ linear-create members sync-aliases --dry-run        # Preview changes
  $ linear-create users sync-aliases --force            # Force override existing

This command will create aliases for members in your workspace,
using the member name converted to lowercase with hyphens (e.g., "John Doe" → "john-doe").

Note: Members with duplicate names will be skipped to avoid conflicts.
`)
    .action(async (options) => {
      await syncMemberAliasesCore(options);
    });
}
