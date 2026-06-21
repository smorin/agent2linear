import { maskApiKey } from '../../lib/config.js';
import { showError } from '../../lib/output.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';

interface CurrentWorkspaceOptions {
  json?: boolean;
}

/**
 * Print the RESOLVED active workspace + selection source + masked key, offline
 * (no API call), mirroring `config get`. Honors the program-level --workspace /
 * --api-key selectors via the invocation context the preAction hook stashed.
 */
export function currentWorkspaceCommand(options: CurrentWorkspaceOptions = {}) {
  try {
    const resolution = resolveActiveWorkspace();
    const hasKey = resolution.key !== '';

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            name: resolution.name ?? null,
            source: resolution.source,
            apiKey: hasKey ? maskApiKey(resolution.key) : null,
          },
          null,
          2
        )
      );
      return;
    }

    const nameLabel = resolution.name ?? (resolution.source === 'flag' ? '(ad-hoc via --api-key)' : '(default)');
    console.log(`Workspace: ${nameLabel}`);
    console.log(`Source:    ${resolution.source}`);
    console.log(`API Key:   ${hasKey ? maskApiKey(resolution.key) : '(not set)'}`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
