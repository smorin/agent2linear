import { normalizeEntityType,removeAlias } from '../../lib/aliases.js';
import { getScopeInfo } from '../../lib/scope.js';

interface RemoveAliasOptions {
  global?: boolean;
  project?: boolean;
}

export function removeAliasCommand(
  type: string,
  alias: string,
  options: RemoveAliasOptions = {}
) {
  // Normalize the type
  const normalizedType = normalizeEntityType(type);
  if (!normalizedType) {
    console.error(`❌ Invalid entity type: "${type}"`);
    console.error('   Valid types: initiative, team, project');
    process.exit(1);
  }

  // Determine scope
  const { scope, label: scopeLabel } = getScopeInfo(options);

  console.log(`🗑️  Removing alias "${alias}" from ${scopeLabel} ${normalizedType} aliases...`);

  try {
    const result = removeAlias(normalizedType, alias, scope);

    if (!result.success) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }

    console.log(`\n✅ Alias removed successfully!`);
    console.log(`   Alias: ${alias}`);
    console.log(`   ID was: ${result.id}`);
    console.log(`   Scope: ${scopeLabel}\n`);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
