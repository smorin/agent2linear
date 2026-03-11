import { resolveAlias } from '../../lib/aliases.js';
import { setConfigValue } from '../../lib/config.js';
import { validateInitiativeExists } from '../../lib/linear-client.js';
import { showError, showInfo,showResolvedAlias, showSuccess, showValidated, showValidating } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface SetInitiativeOptions {
  global?: boolean;
  project?: boolean;
}

export async function setInitiative(initiativeId: string, options: SetInitiativeOptions = {}) {
  // Resolve alias to ID if needed
  const resolvedId = resolveAlias('initiative', initiativeId);
  if (resolvedId !== initiativeId) {
    showResolvedAlias(initiativeId, resolvedId);
  }

  showValidating('initiative', resolvedId);

  try {
    // Validate initiative exists
    const result = await validateInitiativeExists(resolvedId);

    if (!result.valid) {
      showError(result.error ?? 'Initiative validation failed');
      process.exit(1);
    }

    showValidated('initiative', result.name ?? 'Unknown');

    // Determine scope
    const { scope, label: scopeLabel } = getScopeInfo(options);

    // Save to config
    setConfigValue('defaultInitiative', resolvedId, scope);

    showSuccess(`Default initiative set to: ${result.name ?? 'Unknown'}`, {
      'Saved to': `${scopeLabel} config`,
      'Initiative ID': resolvedId
    });

    showInfo(`Use 'agent2linear config show' to view your configuration`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
