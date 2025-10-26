import {
  listAliases,
  normalizeEntityType,
  validateAllAliases,
  hasGlobalAliases,
  hasProjectAliases,
  getGlobalAliasesPath,
  getProjectAliasesPath,
} from '../../lib/aliases.js';
import { getApiKey } from '../../lib/config.js';
import {
  validateInitiativeExists,
  validateTeamExists,
  getProjectById,
} from '../../lib/linear-client.js';
import type { AliasEntityType, ResolvedAliases } from '../../lib/types.js';

interface ListAliasOptions {
  validate?: boolean;
}

/**
 * Validate an entity and return its name
 */
async function getEntityName(
  type: AliasEntityType,
  id: string
): Promise<{ name?: string; error?: string }> {
  try {
    switch (type) {
      case 'initiative': {
        const result = await validateInitiativeExists(id);
        if (result.valid && result.name) {
          return { name: result.name };
        }
        return { error: 'not found' };
      }
      case 'team': {
        const result = await validateTeamExists(id);
        if (result.valid && result.name) {
          return { name: result.name };
        }
        return { error: 'not found' };
      }
      case 'project': {
        const project = await getProjectById(id);
        if (project && project.name) {
          return { name: project.name };
        }
        return { error: 'not found' };
      }
      default:
        return { error: 'unknown type' };
    }
  } catch (error) {
    return { error: 'validation failed' };
  }
}

export async function listAliasCommand(type?: string, options: ListAliasOptions = {}) {
  // Normalize type if provided
  let normalizedType: AliasEntityType | undefined;
  if (type) {
    normalizedType = normalizeEntityType(type) || undefined;
    if (!normalizedType) {
      console.error(`❌ Invalid entity type: "${type}"`);
      console.error('   Valid types: initiative, team, project');
      process.exit(1);
    }
  }

  try {
    // If validation requested, run validation and return
    if (options.validate) {
      console.log('🔍 Validating all aliases...\n');
      const validation = await validateAllAliases();

      if (validation.broken.length === 0) {
        console.log(`✅ All ${validation.total} aliases are valid!\n`);
      } else {
        console.log(`⚠️  Found ${validation.broken.length} broken alias(es):\n`);
        for (const broken of validation.broken) {
          console.log(`  ${broken.type}: "${broken.alias}" → ${broken.id}`);
          console.log(`    Error: ${broken.error}`);
          console.log(`    Location: ${broken.location.type}`);
          console.log('');
        }
        console.log(
          `💡 Use 'linear-create alias remove <type> <alias>' to remove broken aliases\n`
        );
      }
      return;
    }

    // Check if API key is available for name resolution
    const apiKey = getApiKey();
    const canValidate = !!apiKey;

    // Display header
    console.log('\n📋 Linear Create Aliases\n');

    // Show alias file paths
    console.log('Alias Files:');
    console.log(
      `  Global:  ${getGlobalAliasesPath()} ${hasGlobalAliases() ? '✓' : '(not found)'}`
    );
    console.log(
      `  Project: ${getProjectAliasesPath()} ${hasProjectAliases() ? '✓' : '(not found)'}`
    );
    console.log();

    // Load aliases
    const aliases = listAliases(normalizedType);

    // Check if any aliases exist
    if (!hasGlobalAliases() && !hasProjectAliases()) {
      console.log('No aliases configured yet.\n');
      console.log('💡 Add an alias with:');
      console.log('   linear-create alias add <type> <alias> <id>\n');
      return;
    }

    // Display aliases
    if (normalizedType) {
      // Display single type
      await displayTypeAliases(
        normalizedType,
        aliases as Record<string, string>,
        canValidate
      );
    } else {
      // Display all types
      await displayAllAliases(aliases as ResolvedAliases, canValidate);
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Display aliases for a single type
 */
async function displayTypeAliases(
  type: AliasEntityType,
  typeAliases: Record<string, string>,
  canValidate: boolean
) {
  const count = Object.keys(typeAliases).length;

  if (count === 0) {
    console.log(`No ${type} aliases configured.\n`);
    return;
  }

  console.log(
    `${type.charAt(0).toUpperCase() + type.slice(1)} Aliases (${count}):\n`
  );

  // Load full aliases to get locations
  const fullAliases = listAliases() as ResolvedAliases;
  const locations = fullAliases.locations[type];

  for (const [alias, id] of Object.entries(typeAliases)) {
    const location = locations[alias];
    const sourceLabel = location?.type === 'project' ? 'project' : 'global';

    console.log(`  ${alias} → ${id}`);

    // Get entity name if possible
    if (canValidate) {
      const entityInfo = await getEntityName(type, id);
      if (entityInfo.name) {
        console.log(`    ${entityInfo.name} (${id}) (from ${sourceLabel})`);
      } else {
        console.log(`    ${id} (${entityInfo.error || 'not found'}) (from ${sourceLabel})`);
      }
    } else {
      console.log(
        `    ${id} (cannot validate - API key not configured) (from ${sourceLabel})`
      );
    }
  }

  console.log('');
}

/**
 * Display all alias types
 */
async function displayAllAliases(fullAliases: ResolvedAliases, canValidate: boolean) {
  let totalCount = 0;

  // Initiatives
  const initiativeCount = Object.keys(fullAliases.initiatives).length;
  if (initiativeCount > 0) {
    console.log(`Initiative Aliases (${initiativeCount}):\n`);
    for (const [alias, id] of Object.entries(fullAliases.initiatives)) {
      const location = fullAliases.locations.initiative[alias];
      const sourceLabel = location?.type === 'project' ? 'project' : 'global';

      console.log(`  ${alias} → ${id}`);

      if (canValidate) {
        const entityInfo = await getEntityName('initiative', id);
        if (entityInfo.name) {
          console.log(`    ${entityInfo.name} (${id}) (from ${sourceLabel})`);
        } else {
          console.log(
            `    ${id} (${entityInfo.error || 'not found'}) (from ${sourceLabel})`
          );
        }
      } else {
        console.log(
          `    ${id} (cannot validate - API key not configured) (from ${sourceLabel})`
        );
      }
    }
    console.log('');
    totalCount += initiativeCount;
  }

  // Teams
  const teamCount = Object.keys(fullAliases.teams).length;
  if (teamCount > 0) {
    console.log(`Team Aliases (${teamCount}):\n`);
    for (const [alias, id] of Object.entries(fullAliases.teams)) {
      const location = fullAliases.locations.team[alias];
      const sourceLabel = location?.type === 'project' ? 'project' : 'global';

      console.log(`  ${alias} → ${id}`);

      if (canValidate) {
        const entityInfo = await getEntityName('team', id);
        if (entityInfo.name) {
          console.log(`    ${entityInfo.name} (${id}) (from ${sourceLabel})`);
        } else {
          console.log(
            `    ${id} (${entityInfo.error || 'not found'}) (from ${sourceLabel})`
          );
        }
      } else {
        console.log(
          `    ${id} (cannot validate - API key not configured) (from ${sourceLabel})`
        );
      }
    }
    console.log('');
    totalCount += teamCount;
  }

  // Projects
  const projectCount = Object.keys(fullAliases.projects).length;
  if (projectCount > 0) {
    console.log(`Project Aliases (${projectCount}):\n`);
    for (const [alias, id] of Object.entries(fullAliases.projects)) {
      const location = fullAliases.locations.project[alias];
      const sourceLabel = location?.type === 'project' ? 'project' : 'global';

      console.log(`  ${alias} → ${id}`);

      if (canValidate) {
        const entityInfo = await getEntityName('project', id);
        if (entityInfo.name) {
          console.log(`    ${entityInfo.name} (${id}) (from ${sourceLabel})`);
        } else {
          console.log(
            `    ${id} (${entityInfo.error || 'not found'}) (from ${sourceLabel})`
          );
        }
      } else {
        console.log(
          `    ${id} (cannot validate - API key not configured) (from ${sourceLabel})`
        );
      }
    }
    console.log('');
    totalCount += projectCount;
  }

  if (totalCount === 0) {
    console.log('No aliases configured yet.\n');
    console.log('💡 Add an alias with:');
    console.log('   linear-create alias add <type> <alias> <id>\n');
  } else {
    console.log(`Total: ${totalCount} alias(es)\n`);
    if (!canValidate) {
      console.log('💡 Configure LINEAR_API_KEY to see entity names\n');
    }
  }
}
