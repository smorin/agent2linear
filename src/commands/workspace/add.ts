import { maskApiKey } from '../../lib/config.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import { showError, showSuccess } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';
import { loadWorkspaces, saveWorkspace } from '../../lib/workspaces.js';

interface AddWorkspaceOptions {
  global?: boolean;
  project?: boolean;
}

/**
 * Register a named workspace (name -> { apiKey }) in the secrets registry.
 *
 * The API key comes from the program-level `--api-key` option (the root option
 * shadows any same-named subcommand option, and the CLI preAction hook already
 * resolved `--api-key -` from stdin into the invocation context). Global scope
 * writes workspaces.json; project scope writes the gitignored workspaces.local.json.
 */
export async function addWorkspaceCommand(name: string, options: AddWorkspaceOptions = {}) {
  try {
    const workspaceName = name?.trim();
    if (!workspaceName) {
      showError('Workspace name cannot be empty');
      process.exit(1);
    }
    if (/\s/.test(workspaceName)) {
      showError('Workspace name cannot contain whitespace');
      process.exit(1);
    }

    const apiKey = getInvocationContext().apiKey;
    if (apiKey === undefined || apiKey.trim() === '') {
      showError('An API key is required', 'Pass --api-key <key> or --api-key - to read from stdin');
      process.exit(1);
    }
    const key = apiKey.trim();

    const { scope, label: scopeLabel } = getScopeInfo(options);

    const existing = loadWorkspaces();
    const isUpdate = workspaceName in existing;

    saveWorkspace(scope, workspaceName, { apiKey: key });

    showSuccess(isUpdate ? 'Workspace updated successfully!' : 'Workspace added successfully!', {
      Workspace: workspaceName,
      Scope: scopeLabel,
      'API Key': maskApiKey(key),
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
