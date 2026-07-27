import { AuthError, CliError, UsageError } from '../../lib/cli-error.js';
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
 * The API key comes from the program-level `--api-key-file` option, and the CLI
 * preAction hook already resolved the file or stdin into the invocation context. Global scope
 * writes workspaces.json; project scope writes the gitignored workspaces.local.json.
 */
export async function addWorkspaceCommand(name: string, options: AddWorkspaceOptions = {}) {
  try {
    const workspaceName = name?.trim();
    if (!workspaceName) {
      throw new UsageError('Workspace name cannot be empty');
    }
    if (/\s/.test(workspaceName)) {
      throw new UsageError('Workspace name cannot contain whitespace');
    }

    const apiKey = getInvocationContext().apiKey;
    if (apiKey === undefined || apiKey.trim() === '') {
      throw new AuthError(
        'An API key is required; pass --api-key-file <path> or --api-key-file - to read from stdin'
      );
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
    if (error instanceof CliError) throw error;
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
