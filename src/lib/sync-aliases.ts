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
  noAutoSuffix?: boolean;
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
  collision?: boolean; // True if this slug was generated from a collision (has numeric suffix)
  originalSlug?: string; // The base slug before suffix was added (for collision reporting)
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

    // Track slugs for collision detection and auto-suffix assignment
    const slugCounter = new Map<string, number>();
    const aliasesToCreate: AliasToCreate[] = [];

    for (const entity of entities) {
      const baseSlug = slugGenerator(entity.name);

      // Skip entities with empty slugs (names with only special characters)
      if (!baseSlug) {
        console.warn(`   ⚠️  Skipping "${entity.name}" - name contains only special characters`);
        continue;
      }

      const displayName = formatEntityDisplay ? formatEntityDisplay(entity) : entity.name;

      // Handle collision with auto-suffix (unless --no-auto-suffix is set)
      const count = slugCounter.get(baseSlug) || 0;
      slugCounter.set(baseSlug, count + 1);

      let finalSlug = baseSlug;
      let collision = false;

      // If this is a collision and auto-suffix is enabled
      if (count > 0 && !options.noAutoSuffix) {
        finalSlug = `${baseSlug}-${count + 1}`;
        collision = true;
      } else if (count > 0 && options.noAutoSuffix) {
        // With --no-auto-suffix, skip all duplicates (old behavior)
        console.warn(`   ⚠️  Skipping "${entity.name}" - duplicate slug "${baseSlug}" (use without --no-auto-suffix to enable auto-numbering)`);
        continue;
      }

      const conflict = !!(existingAliases[finalSlug] && existingAliases[finalSlug] !== entity.id);

      aliasesToCreate.push({
        slug: finalSlug,
        id: entity.id,
        displayName,
        conflict,
        collision,
        originalSlug: collision ? baseSlug : undefined,
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
      if (alias.collision) {
        status = '⚠️  COLLISION';
      } else if (alias.conflict) {
        status = options.force ? '⚠️  OVERWRITE' : '❌ CONFLICT';
      }
      console.log(`   ${status} ${alias.slug.padEnd(30)} → ${alias.id} (${alias.displayName})`);
    }

    // Check for issues
    const conflicts = aliasesToCreate.filter(a => a.conflict);
    const collisions = aliasesToCreate.filter(a => a.collision);

    if (collisions.length > 0) {
      console.log('');
      console.log(`⚠️  ${collisions.length} collision(s) detected - auto-numbered to avoid duplicates:`);
      for (const alias of collisions) {
        console.log(`   "${alias.displayName}" → ${alias.slug} (${alias.originalSlug} was taken)`);
      }
    }

    if (conflicts.length > 0 && !options.force) {
      console.log('');
      console.log(`⚠️  ${conflicts.length} conflict(s) detected`);
      console.log('   Use --force to overwrite existing aliases');
    }

    if (dryRun) {
      console.log('');
      console.log('💡 To create these aliases:');
      console.log('   --global: Save to global config (~/.config/agent2linear/aliases.json)');
      console.log('   --project: Save to project config (.agent2linear/aliases.json)');
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
      // Skip conflicts unless --force
      if (alias.conflict && !options.force) {
        skipped++;
        continue;
      }

      try {
        const result = await addAlias(entityType, alias.slug, alias.id, scope!, { skipValidation: true as boolean });
        if (result.success) {
          created++;
        } else {
          if (result.error?.includes('already points to')) {
            continue;
          }
          console.error(`   ❌ Failed to create alias ${alias.slug}: ${result.error}`);
          failed++;
        }
      } catch (error) {
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
      console.log(`   Skipped ${skipped} due to conflicts (use --force to overwrite)`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
