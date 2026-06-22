import { readConfigForScope } from '../../../lib/config.js';
import { normalizeRemoteOwner } from '../../../lib/git-remote.js';
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
    const rawOwner = options.gitRemoteOwner;
    if (!rawOwner) {
      showError('--git-remote-owner <owner> is required');
      process.exit(1);
    }
    // Normalize the same way `profile match add` stored it (accept a bare owner OR
    // a full repo URL) so an equivalent input form can always remove the rule.
    const owner = normalizeRemoteOwner(rawOwner);
    if (!owner) {
      showError(
        `Invalid git remote owner: "${rawOwner}"`,
        'Pass a bare owner (e.g. "acme-co") or a full repo URL to extract it from.'
      );
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(`Profile "${name}" not found in ${scopeLabel} config`);
      process.exit(1);
    }

    const owners = profile.match?.gitRemoteOwner ?? [];
    const target = owner.toLowerCase();
    if (!owners.some((o) => o.toLowerCase() === target)) {
      showError(`Owner "${owner}" is not a match rule on profile "${name}"`);
      process.exit(1);
    }

    profile.match = {
      ...profile.match,
      gitRemoteOwner: owners.filter((o) => o.toLowerCase() !== target),
    };
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
