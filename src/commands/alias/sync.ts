import { Command, Argument } from 'commander';
import { normalizeEntityType } from '../../lib/aliases.js';
import { syncInitiativeAliasesCore } from '../initiatives/sync-aliases.js';
import { syncTeamAliasesCore } from '../teams/sync-aliases.js';
import { syncMemberAliasesCore, type SyncMemberAliasesOptions } from '../members/sync-aliases.js';
import { syncWorkflowStateAliasesCore, type SyncWorkflowStateAliasesOptions } from '../workflow-states/sync-aliases.js';
import { syncIssueLabelAliasesCore, type SyncIssueLabelAliasesOptions } from '../issue-labels/sync-aliases.js';
import { syncProjectLabelAliasesCore } from '../project-labels/sync-aliases.js';
import { syncProjectStatusAliases } from '../project-status/sync-aliases.js';

/**
 * Register the centralized sync command for aliases
 */
export function aliasSyncCommand(program: Command) {
  program
    .command('sync')
    .addArgument(
      new Argument('<type>', 'Entity type to sync aliases for')
        .choices([
          'initiative', 'initiatives',
          'team', 'teams',
          'member', 'members', 'user', 'users',
          'workflow-state', 'workflow-states',
          'issue-label', 'issue-labels',
          'project-label', 'project-labels',
          'project-status', 'project-statuses'
        ])
    )
    .description('Sync aliases for a specific entity type')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Filter by team (for members, workflow-states, issue-labels only)')
    .option('--org-wide', 'All organization members (for members only)')
    .addHelpText('after', `
Examples:
  # Initiatives
  $ linear-create alias sync initiative           # Preview initiative aliases
  $ linear-create alias sync initiatives --global  # Create global aliases

  # Teams
  $ linear-create alias sync team --global         # Create global team aliases
  $ linear-create alias sync teams --project       # Create project-local aliases

  # Members/Users
  $ linear-create alias sync member --global            # All org members
  $ linear-create alias sync user --team team_xyz       # Specific team members
  $ linear-create alias sync members --org-wide --global

  # Workflow States
  $ linear-create alias sync workflow-state --global    # Default team states
  $ linear-create alias sync workflow-states --team team_abc

  # Issue Labels
  $ linear-create alias sync issue-label --global       # All issue labels
  $ linear-create alias sync issue-labels --team team_xyz

  # Project Labels
  $ linear-create alias sync project-label --global     # All project labels

  # Project Statuses
  $ linear-create alias sync project-status --global    # All project statuses

Common options:
  --dry-run: Preview without creating
  --force:   Override existing aliases
  --global:  Save to ~/.config/linear-create/aliases.json (default)
  --project: Save to .linear-create/aliases.json

This is equivalent to running entity-specific sync-aliases commands:
  linear-create alias sync team           = linear-create teams sync-aliases
  linear-create alias sync initiative     = linear-create initiatives sync-aliases
  linear-create alias sync member         = linear-create members sync-aliases
`)
    .action(async (type: string, options) => {
      const normalizedType = normalizeEntityType(type);

      if (!normalizedType) {
        console.error(`❌ Invalid entity type: ${type}`);
        process.exit(1);
      }

      // Route to appropriate sync function based on entity type
      try {
        switch (normalizedType) {
          case 'initiative':
            await syncInitiativeAliasesCore(options);
            break;

          case 'team':
            await syncTeamAliasesCore(options);
            break;

          case 'member':
            await syncMemberAliasesCore(options as SyncMemberAliasesOptions);
            break;

          case 'workflow-state':
            await syncWorkflowStateAliasesCore(options as SyncWorkflowStateAliasesOptions);
            break;

          case 'issue-label':
            await syncIssueLabelAliasesCore(options as SyncIssueLabelAliasesOptions);
            break;

          case 'project-label':
            await syncProjectLabelAliasesCore(options);
            break;

          case 'project-status':
            await syncProjectStatusAliases(options);
            break;

          // These types are not currently supported for syncing
          case 'project':
          case 'issue-template':
          case 'project-template':
            console.error(`❌ Syncing aliases for ${normalizedType} is not currently supported.`);
            console.error(`   Aliases for these entities should be created manually.`);
            process.exit(1);
            break;

          default:
            console.error(`❌ Unsupported entity type for syncing: ${normalizedType}`);
            process.exit(1);
        }
      } catch (error) {
        console.error('❌ Sync failed:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
