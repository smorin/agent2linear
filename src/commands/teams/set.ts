import { validateTeamExists } from '../../lib/linear-client.js';
import { setConfigValue } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';
import { showResolvedAlias, showValidating, showValidated, showSuccess, showError, showInfo } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface SetTeamOptions {
  global?: boolean;
  project?: boolean;
}

export async function setTeam(teamId: string, options: SetTeamOptions = {}) {
  // Resolve alias to ID if needed
  const resolvedId = resolveAlias('team', teamId);
  if (resolvedId !== teamId) {
    showResolvedAlias(teamId, resolvedId);
  }

  showValidating('team', resolvedId);

  try {
    // Validate team exists
    const result = await validateTeamExists(resolvedId);

    if (!result.valid) {
      showError(result.error ?? 'Team validation failed');
      process.exit(1);
    }

    showValidated('team', result.name ?? 'Unknown');

    // Determine scope
    const { scope, label: scopeLabel } = getScopeInfo(options);

    // Save to config
    setConfigValue('defaultTeam', resolvedId, scope);

    showSuccess(`Default team set to: ${result.name ?? 'Unknown'}`, {
      'Saved to': `${scopeLabel} config`,
      'Team ID': resolvedId
    });

    showInfo(`Use 'linear-create config show' to view your configuration`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
