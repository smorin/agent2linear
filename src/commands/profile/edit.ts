import { readConfigForScope } from '../../lib/config.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import { showError, showSuccess } from '../../lib/output.js';
import { saveProfile } from '../../lib/profiles.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { Profile } from '../../lib/types.js';

interface EditProfileOptions {
  defaultTeam?: string;
  defaultInitiative?: string;
  global?: boolean;
  project?: boolean;
}

/**
 * Modify an existing profile, merging the provided fields and preserving the rest.
 *
 * Flag-based (non-interactive) — the distinguishing semantic vs. `profile add` is
 * the merge: unspecified fields are kept. Offline; the profile must already exist
 * in the chosen scope's config.json. The target workspace comes from the
 * program-level `--workspace` global (via the invocation context).
 */
export function editProfileCommand(name: string, options: EditProfileOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);
    const workspace = getInvocationContext().workspace;

    const existing = readConfigForScope(scope).profiles?.[name];
    if (!existing) {
      showError(
        `Profile "${name}" not found in ${scopeLabel} config`,
        'Use "agent2linear profile add" to create it, or "profile list" to see existing profiles'
      );
      process.exit(1);
    }

    const updated: Profile = { ...existing };
    if (workspace !== undefined) updated.workspace = workspace;
    if (options.defaultTeam !== undefined) updated.defaultTeam = options.defaultTeam;
    if (options.defaultInitiative !== undefined) updated.defaultInitiative = options.defaultInitiative;

    saveProfile(scope, name, updated);

    const details: Record<string, string> = { Profile: name, Scope: scopeLabel };
    if (updated.workspace) details.Workspace = updated.workspace;
    if (updated.defaultTeam) details['Default Team'] = updated.defaultTeam;
    if (updated.defaultInitiative) details['Default Initiative'] = updated.defaultInitiative;

    showSuccess('Profile updated successfully!', details);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
