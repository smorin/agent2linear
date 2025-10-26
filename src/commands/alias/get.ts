import { getAlias, normalizeEntityType } from '../../lib/aliases.js';

export function getAliasCommand(type: string, alias: string) {
  // Normalize the type
  const normalizedType = normalizeEntityType(type);
  if (!normalizedType) {
    console.error(`❌ Invalid entity type: "${type}"`);
    console.error('   Valid types: initiative, team, project');
    process.exit(1);
  }

  try {
    const result = getAlias(normalizedType, alias);

    if (!result.found) {
      console.error(`❌ Alias "${alias}" not found for ${normalizedType}`);
      console.log(`\n💡 Use 'linear-create alias list ${normalizedType}' to see available aliases\n`);
      process.exit(1);
    }

    console.log(`\nAlias: ${alias}`);
    console.log(`ID: ${result.id}`);
    console.log(`Type: ${normalizedType}`);
    if (result.location) {
      console.log(`Location: ${result.location.type}`);
    }
    console.log('');
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
