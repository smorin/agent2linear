import { showError, showSuccess } from '../../lib/output.js';
import { removeProfile } from '../../lib/profiles.js';
import { getScopeInfo } from '../../lib/scope.js';

interface RemoveProfileOptions {
  global?: boolean;
  project?: boolean;
}

/**
 * Remove a named profile from the given scope's config.json.
 */
export function removeProfileCommand(name: string, options: RemoveProfileOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    const removed = removeProfile(scope, name);
    if (!removed) {
      showError(
        `Profile "${name}" not found in ${scopeLabel} config`,
        'Use "agent2linear profile list" to see registered profiles'
      );
      process.exit(1);
    }

    showSuccess('Profile removed successfully!', { Profile: name, Scope: scopeLabel });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
