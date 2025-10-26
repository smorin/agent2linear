import { Command } from 'commander';
import { getAllProjectLabels } from '../../lib/linear-client.js';
import { addAlias, listAliases } from '../../lib/aliases.js';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export function syncProjectLabelAliases(program: Command) {
  program
    .command('sync-aliases')
    .description('Sync project label aliases')
    .option('-g, --global', 'Create aliases in global config')
    .option('-p, --project', 'Create aliases in project config')
    .option('--dry-run', 'Preview aliases without creating them')
    .option('-f, --force', 'Overwrite existing aliases')
    .action(async (options) => {
      try {
        const dryRun = !options.global && !options.project;
        const scope = options.global ? 'global' : 'project';

        console.log('🔍 Fetching project labels...');
        const labels = await getAllProjectLabels();
        console.log(`   Found ${labels.length} labels`);
        console.log('');

        const existingAliases = listAliases('project-label') as Record<string, string>;
        const aliasesToCreate = labels.map(l => ({
          slug: generateSlug(l.name),
          id: l.id,
          name: l.name,
          conflict: existingAliases[generateSlug(l.name)] && existingAliases[generateSlug(l.name)] !== l.id
        }));

        console.log(dryRun ? '📋 Preview:' : '📋 Creating aliases:');
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
        let created = 0;
        for (const alias of aliasesToCreate) {
          if (alias.conflict && !options.force) continue;
          try {
            await addAlias('project-label', alias.slug, alias.id, scope, { skipValidation: true });
            created++;
          } catch (error) {
            // Skip if already exists
          }
        }

        console.log(`✅ Created ${created} project label aliases (${scope})`);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
