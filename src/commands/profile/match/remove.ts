import { readConfigForScope } from '../../../lib/config.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { saveProfile } from '../../../lib/profiles.js';
import { getScopeInfo } from '../../../lib/scope.js';

interface MatchRemoveOptions {
  gitRemoteOwner?: string;
  global?: boolean;
  project?: boolean;
}

/**
 * Remove a git-remote-owner match rule from a profile (offline).
 */
export function profileMatchRemoveCommand(name: string, options: MatchRemoveOptions = {}): void {
  try {
    const owner = options.gitRemoteOwner;
    if (!owner) {
      showError('--git-remote-owner <owner> is required');
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(`Profile "${name}" not found in ${scopeLabel} config`);
      process.exit(1);
    }

    const owners = profile.match?.gitRemoteOwner ?? [];
    if (!owners.includes(owner)) {
      showError(`Owner "${owner}" is not a match rule on profile "${name}"`);
      process.exit(1);
    }

    profile.match = { ...profile.match, gitRemoteOwner: owners.filter((o) => o !== owner) };
    saveProfile(scope, name, profile);

    showSuccess('Match rule removed!', {
      Profile: name,
      Scope: scopeLabel,
      Removed: owner,
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
