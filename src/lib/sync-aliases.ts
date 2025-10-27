import { addAlias, listAliases } from './aliases.js';
import type { AliasEntityType } from './types.js';

/**
 * Generate a slug from a name (lowercase with hyphens)
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Options for syncing aliases
 */
export interface SyncAliasesOptions {
  global?: boolean;
  project?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Entity that can have aliases synced
 */
export interface SyncableEntity {
  id: string;
  name: string;
}

/**
 * Configuration for syncing aliases for a specific entity type
 */
export interface SyncAliasesConfig<T extends SyncableEntity> {
  /** The entity type for alias resolution (e.g., 'team', 'initiative') */
  entityType: AliasEntityType;

  /** Human-readable entity type name for display (e.g., 'team', 'initiative') */
  entityTypeName: string;

  /** Plural form for display (e.g., 'teams', 'initiatives') */
  entityTypeNamePlural: string;

  /** The entities to create aliases for */
  entities: T[];

  /** Optional function to format entity display (defaults to just name) */
  formatEntityDisplay?: (entity: T) => string;

  /** Options from command line */
  options: SyncAliasesOptions;

  /** Additional context for duplicate handling (optional) */
  detectDuplicates?: boolean;

  /** Custom slug generator (optional, defaults to generateSlug) */
  generateSlug?: (name: string) => string;
}

/**
 * Alias to be created
 */
interface AliasToCreate {
  slug: string;
  id: string;
  displayName: string;
  conflict: boolean;
  duplicate?: boolean;
}

/**
 * Core function to sync aliases for any entity type
 * This eliminates code duplication across all sync-aliases commands
 */
export async function syncAliasesCore<T extends SyncableEntity>(
  config: SyncAliasesConfig<T>
): Promise<void> {
  const {
    entityType,
    entityTypeName,
    entityTypeNamePlural,
    entities,
    formatEntityDisplay,
    options,
    detectDuplicates = false,
    generateSlug: customSlugGenerator,
  } = config;

  const slugGenerator = customSlugGenerator || generateSlug;

  try {
    // Determine scope
    const dryRun = !options.global && !options.project;
    const scope = options.global ? 'global' : options.project ? 'project' : undefined;

    console.log(`🔍 Fetching ${entityTypeNamePlural}...`);
    console.log(`   Found ${entities.length} ${entityTypeNamePlural}`);
    console.log('');

    // Get existing aliases
    const existingAliases = listAliases(entityType) as Record<string, string>;

    // Track slugs for duplicate detection
    const slugMap = new Map<string, T[]>();

    if (detectDuplicates) {
      for (const entity of entities) {
        const slug = slugGenerator(entity.name);
        if (!slugMap.has(slug)) {
          slugMap.set(slug, []);
        }
        slugMap.get(slug)!.push(entity);
      }
    }

    // Generate alias preview
    const aliasesToCreate: AliasToCreate[] = [];

    for (const entity of entities) {
      const slug = slugGenerator(entity.name);

      // Skip entities with empty slugs (names with only special characters)
      if (!slug) {
        console.warn(`   ⚠️  Skipping "${entity.name}" - name contains only special characters`);
        continue;
      }

      const conflict = !!(existingAliases[slug] && existingAliases[slug] !== entity.id);
      const duplicate = detectDuplicates && (slugMap.get(slug)?.length || 0) > 1;
      const displayName = formatEntityDisplay ? formatEntityDisplay(entity) : entity.name;

      aliasesToCreate.push({
        slug,
        id: entity.id,
        displayName,
        conflict,
        duplicate,
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
      let status = '✓';
      if (alias.duplicate) {
        status = '⚠️  DUPLICATE';
      } else if (alias.conflict) {
        status = options.force ? '⚠️  OVERWRITE' : '❌ CONFLICT';
      }
      console.log(`   ${status} ${alias.slug.padEnd(30)} → ${alias.id} (${alias.displayName})`);
    }

    // Check for issues
    const conflicts = aliasesToCreate.filter(a => a.conflict && !a.duplicate);
    const duplicates = aliasesToCreate.filter(a => a.duplicate);

    if (duplicates.length > 0) {
      console.log('');
      console.log(`⚠️  ${duplicates.length} duplicate name(s) detected - these will be skipped`);
      console.log('   (multiple entities would map to the same alias)');
    }

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
    let failed = 0;

    for (const alias of aliasesToCreate) {
      // Skip duplicates
      if (alias.duplicate) {
        skipped++;
        continue;
      }

      // Skip conflicts unless --force
      if (alias.conflict && !options.force) {
        skipped++;
        continue;
      }

      try {
        await addAlias(entityType, alias.slug, alias.id, scope!, { skipValidation: true as boolean });
        created++;
      } catch (error) {
        // Alias might already exist with same ID
        if (error instanceof Error && error.message.includes('already points to')) {
          // This is fine, skip it
          continue;
        }
        console.error(`   ❌ Failed to create alias ${alias.slug}:`, error instanceof Error ? error.message : 'Unknown error');
        failed++;
      }
    }

    console.log('');
    if (failed > 0) {
      console.log(`⚠️  Created ${created} ${entityTypeName} aliases with ${failed} failures (${scope})`);
    } else {
      console.log(`✅ Created ${created} ${entityTypeName} aliases (${scope})`);
    }
    if (skipped > 0) {
      const reason = duplicates.length > 0 ? 'conflicts or duplicates' : 'conflicts (use --force to overwrite)';
      console.log(`   Skipped ${skipped} due to ${reason}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
