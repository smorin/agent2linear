import { Command } from 'commander';
import { getAllWorkflowStates } from '../../lib/linear-client.js';
import { addAlias, listAliases } from '../../lib/aliases.js';
import { getConfig } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function syncWorkflowStateAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync workflow state aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Only sync states for specific team')
    .action(async (options) => {
      try {
        // Determine scope
        const dryRun = !options.global && !options.project;
        const scope = options.global ? 'global' : options.project ? 'project' : undefined;

        // Get team ID
        let teamId = options.team;
        if (teamId) {
          teamId = resolveAlias('team', teamId);
        } else {
          const config = getConfig();
          teamId = config.defaultTeam;
        }

        console.log('🔍 Fetching workflow states...');
        const states = await getAllWorkflowStates(teamId);
        console.log(`   Found ${states.length} workflow states`);
        console.log('');

        // Get existing aliases
        const existingAliases = listAliases('workflow-state') as Record<string, string>;

        // Generate alias preview
        const aliasesToCreate: Array<{ slug: string; id: string; name: string; conflict: boolean }> = [];

        for (const state of states) {
          const slug = generateSlug(state.name);
          const conflict = existingAliases[slug] && existingAliases[slug] !== state.id;

          aliasesToCreate.push({
            slug,
            id: state.id,
            name: state.name,
            conflict,
          });
        }

        // Display preview
        if (dryRun || options.dryRun) {
          console.log('📋 Preview: The following aliases would be created');
          console.log('   (specify --global or --project to create):');
        } else {
          console.log('📋 Creating aliases:');
        }
        console.log('');

        for (const alias of aliasesToCreate) {
          const status = alias.conflict ? (options.force ? '⚠️  OVERWRITE' : '❌ CONFLICT') : '✓';
          console.log(`   ${status} ${alias.slug.padEnd(30)} → ${alias.id} (${alias.name})`);
        }

        // Check for conflicts
        const conflicts = aliasesToCreate.filter(a => a.conflict);
        if (conflicts.length > 0 && !options.force) {
          console.log('');
          console.log(`⚠️  ${conflicts.length} conflict(s) detected`);
          console.log('   Use --force to overwrite existing aliases');
        }

        if (dryRun) {
          console.log('');
          console.log('💡 To create these aliases:');
          console.log('   --global: Save to global config (~/.config/linear-create/aliases.json)');
          console.log('   --project: Save to project config (.linear-create/aliases.json)');
          return;
        }

        if (options.dryRun) {
          return;
        }

        // Create aliases
        console.log('');
        console.log('🚀 Creating aliases...');

        let created = 0;
        let skipped = 0;

        for (const alias of aliasesToCreate) {
          if (alias.conflict && !options.force) {
            skipped++;
            continue;
          }

          try {
            await addAlias('workflow-state', alias.slug, alias.id, scope!, { skipValidation: true });
            created++;
          } catch (error) {
            // Alias might already exist with same ID
            if (error instanceof Error && error.message.includes('already points to')) {
              // This is fine, skip it
              continue;
            }
            console.error(`   ❌ Failed to create alias ${alias.slug}:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }

        console.log('');
        console.log(`✅ Created ${created} workflow state aliases (${scope})`);
        if (skipped > 0) {
          console.log(`   Skipped ${skipped} due to conflicts (use --force to overwrite)`);
        }
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
