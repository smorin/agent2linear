import { readConfigForScope } from '../../../lib/config.js';
import { normalizeRemoteOwner } from '../../../lib/git-remote.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { saveProfile } from '../../../lib/profiles.js';
import { getScopeInfo } from '../../../lib/scope.js';

interface MatchAddOptions {
  gitRemoteOwner?: string[];
  global?: boolean;
  project?: boolean;
}

/**
 * Add git-remote-owner match rules to a profile (offline). Owners are merged into
 * the profile's `match.gitRemoteOwner` set; the repo's `origin` owner is matched
 * against these for auto-detection.
 */
export function profileMatchAddCommand(name: string, options: MatchAddOptions = {}): void {
  try {
    const owners = options.gitRemoteOwner ?? [];
    if (owners.length === 0) {
      showError('At least one --git-remote-owner is required');
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(
        `Profile "${name}" not found in ${scopeLabel} config`,
        'Create it first with "agent2linear profile add"'
      );
      process.exit(1);
    }

    // Accept a bare owner OR a full repo URL (extract the owner); reject malformed
    // input so a bad value never gets stored where it can never match.
    const normalized: string[] = [];
    for (const raw of owners) {
      const owner = normalizeRemoteOwner(raw);
      if (!owner) {
        showError(
          `Invalid git remote owner: "${raw}"`,
          'Pass a bare owner (e.g. "acme-co") or a full repo URL to extract it from (e.g. "git@github.com:acme-co/repo.git").'
        );
        process.exit(1);
      }
      normalized.push(owner);
    }

    const merged = Array.from(new Set([...(profile.match?.gitRemoteOwner ?? []), ...normalized]));
    profile.match = { ...profile.match, gitRemoteOwner: merged };
    saveProfile(scope, name, profile);

    showSuccess('Match rule added!', {
      Profile: name,
      Scope: scopeLabel,
      'Git remote owners': merged.join(', '),
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
