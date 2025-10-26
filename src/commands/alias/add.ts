import { addAlias, normalizeEntityType } from '../../lib/aliases.js';
import { showSuccess, showError, showInfo } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface AddAliasOptions {
  global?: boolean;
  project?: boolean;
  skipValidation?: boolean;
}

export async function addAliasCommand(
  type: string,
  alias: string,
  id: string,
  options: AddAliasOptions = {}
) {
  // Normalize the type
  const normalizedType = normalizeEntityType(type);
  if (!normalizedType) {
    showError(`Invalid entity type: "${type}"`, 'Valid types: initiative, team, project');
    process.exit(1);
  }

  // Determine scope
  const { scope, label: scopeLabel } = getScopeInfo(options);

  console.log(`🔍 Adding alias "${alias}" for ${normalizedType}...`);

  if (!options.skipValidation) {
    console.log(`   Validating ${normalizedType} ID: ${id}...`);
  }

  try {
    const result = await addAlias(normalizedType, alias, id, scope, {
      skipValidation: options.skipValidation,
    });

    if (!result.success) {
      showError(result.error ?? 'Unknown error');
      process.exit(1);
    }

    const details: Record<string, string> = {
      'Alias': alias,
      [`${normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)} ID`]: id
    };

    if (result.entityName) {
      details['Name'] = result.entityName;
    }

    details['Scope'] = scopeLabel;

    showSuccess('Alias added successfully!', details);
    showInfo(`Use this alias in place of the ${normalizedType} ID in any command`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
