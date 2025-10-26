import { Command } from 'commander';
import { getAllIssueLabels } from '../../lib/linear-client.js';
import { addAlias, listAliases } from '../../lib/aliases.js';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export function syncIssueLabelAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync issue label aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .option('-t, --team <id>', 'Only sync labels for specific team')
    .action(async (options) => {
      try {
        const dryRun = !options.global && !options.project;
        const scope = options.global ? 'global' : options.project ? 'project' : undefined;

        console.log('🔍 Fetching issue labels...');
        const labels = await getAllIssueLabels(options.team);
        console.log(`   Found ${labels.length} labels`);
        console.log('');

        const existingAliases = listAliases('issue-label') as Record<string, string>;
        const aliasesToCreate: Array<{ slug: string; id: string; name: string; conflict: boolean }> = [];

        for (const label of labels) {
          const slug = generateSlug(label.name);
          const conflict = existingAliases[slug] && existingAliases[slug] !== label.id;
          aliasesToCreate.push({ slug, id: label.id, name: label.name, conflict });
        }

        console.log(dryRun ? '📋 Preview: The following aliases would be created' : '📋 Creating aliases:');
        console.log('');

        for (const alias of aliasesToCreate) {
          const status = alias.conflict ? (options.force ? '⚠️  OVERWRITE' : '❌ CONFLICT') : '✓';
          console.log(`   ${status} ${alias.slug.padEnd(30)} → ${alias.id} (${alias.name})`);
        }

        if (dryRun) {
          console.log('');
          console.log('💡 Use --global or --project to create aliases');
          return;
        }

        if (options.dryRun) return;

        console.log('');
        console.log('🚀 Creating aliases...');

        let created = 0;
        for (const alias of aliasesToCreate) {
          if (alias.conflict && !options.force) continue;
          try {
            await addAlias('issue-label', alias.slug, alias.id, scope!, { skipValidation: true });
            created++;
          } catch (error) {
            // Skip if already exists with same ID
          }
        }

        console.log(`✅ Created ${created} issue label aliases (${scope})`);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
