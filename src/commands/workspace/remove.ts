import { showError, showSuccess } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';
import { removeWorkspace } from '../../lib/workspaces.js';

interface RemoveWorkspaceOptions {
  global?: boolean;
  project?: boolean;
}

/**
 * Remove a registered workspace from the secrets registry.
 */
export function removeWorkspaceCommand(name: string, options: RemoveWorkspaceOptions = {}) {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    const removed = removeWorkspace(scope, name);
    if (!removed) {
      showError(
        `Workspace "${name}" not found in ${scopeLabel} registry`,
        'Use "agent2linear workspace list" to see registered workspaces'
      );
      process.exit(1);
    }

    showSuccess('Workspace removed successfully!', {
      Workspace: name,
      Scope: scopeLabel,
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
