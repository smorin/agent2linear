import { getAllProjectStatuses } from '../../lib/linear-client.js';
import { addAlias } from '../../lib/aliases.js';
import { showError, showSuccess } from '../../lib/output.js';

interface SyncOptions {
  global?: boolean;
  project?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Sync project status aliases - creates aliases for all org project statuses
 */
export async function syncProjectStatusAliases(options: SyncOptions = {}) {
  try {
    // Determine scope
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';

    console.log(`🔄 Fetching all project statuses from Linear...\n`);
    const statuses = await getAllProjectStatuses();

    if (statuses.length === 0) {
      console.log('No project statuses found in your Linear workspace.');
      return;
    }

    console.log(`Found ${statuses.length} project status${statuses.length === 1 ? '' : 'es'}\n`);

    if (options.dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }

    const results = {
      created: [] as string[],
      skipped: [] as string[],
      errors: [] as { alias: string; error: string }[],
    };

    // Create aliases for each status
    for (const status of statuses) {
      // Generate alias from status name (lowercase, replace spaces with hyphens)
      const alias = status.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      if (options.dryRun) {
        console.log(`Would create: ${alias} → ${status.id} (${status.name})`);
        results.created.push(alias);
        continue;
      }

      // Try to add the alias
      const result = await addAlias('project-status', alias, status.id, scope, {
        skipValidation: true, // We already have the valid status from API
      });

      if (result.success) {
        console.log(`✓ Created alias: ${alias} → ${status.id} (${status.name})`);
        results.created.push(alias);
      } else {
        // Check if error is "already exists"
        if (result.error?.includes('already')) {
          if (options.force) {
            // Force mode: we would need to remove and re-add, but for now just skip
            console.log(`  Skipped: ${alias} (already exists, use --force to override)`);
            results.skipped.push(alias);
          } else {
            console.log(`  Skipped: ${alias} (already exists)`);
            results.skipped.push(alias);
          }
        } else {
          console.log(`✗ Failed to create ${alias}: ${result.error}`);
          results.errors.push({ alias, error: result.error || 'Unknown error' });
        }
      }
    }

    // Summary
    console.log('\n' + '─'.repeat(60));
    console.log('Summary:');
    console.log(`  Created: ${results.created.length}`);
    console.log(`  Skipped: ${results.skipped.length}`);
    console.log(`  Errors: ${results.errors.length}`);
    console.log('─'.repeat(60));

    if (options.dryRun) {
      console.log(`\n💡 Run without --dry-run to apply these changes`);
    } else if (results.created.length > 0) {
      showSuccess(
        `Successfully synced ${results.created.length} project status alias${results.created.length === 1 ? '' : 'es'}`,
        {
          Scope: scope,
          Location:
            scope === 'global'
              ? '~/.config/linear-create/aliases.json'
              : './.linear-create/aliases.json',
        }
      );
    }

    if (results.errors.length > 0) {
      console.log(`\n⚠️  Some aliases failed to sync. Please review the errors above.`);
      process.exit(1);
    }
  } catch (error) {
    showError(
      'Failed to sync project status aliases',
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(1);
  }
}
