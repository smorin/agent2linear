import { readConfigForScope } from '../../lib/config.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import { showError, showSuccess } from '../../lib/output.js';
import { saveProfile } from '../../lib/profiles.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { Profile } from '../../lib/types.js';

interface AddProfileOptions {
  defaultTeam?: string;
  defaultInitiative?: string;
  global?: boolean;
  project?: boolean;
}

/**
 * Create (or overwrite) a named profile in committable config.json.
 *
 * Offline: values are stored as given and validated at use time by the command
 * that consumes them — `profile add` never contacts Linear, so it stays safe for
 * scripting and offline tests. A profile points at a workspace by NAME (the key
 * lives in the secrets registry), keeping config commit-safe.
 *
 * The target workspace comes from the PROGRAM-LEVEL `--workspace` global (which
 * shadows any same-named subcommand option), read via the invocation context —
 * mirroring how `workspace add` reads the global `--api-key`.
 */
export function addProfileCommand(name: string, options: AddProfileOptions = {}): void {
  try {
    const profileName = name?.trim();
    if (!profileName) {
      showError('Profile name cannot be empty');
      process.exit(1);
    }
    if (/\s/.test(profileName)) {
      showError('Profile name cannot contain whitespace');
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const workspace = getInvocationContext().workspace;

    const profile: Profile = {};
    if (workspace) profile.workspace = workspace;
    if (options.defaultTeam) profile.defaultTeam = options.defaultTeam;
    if (options.defaultInitiative) profile.defaultInitiative = options.defaultInitiative;

    // Detect create-vs-update against the TARGET scope only — loadProfiles() merges
    // global+project, which would mislabel a create as an update (and vice versa)
    // when the same name exists in the other scope.
    const isUpdate = Boolean(readConfigForScope(scope).profiles?.[profileName]);
    saveProfile(scope, profileName, profile);

    const details: Record<string, string> = { Profile: profileName, Scope: scopeLabel };
    if (profile.workspace) details.Workspace = profile.workspace;
    if (profile.defaultTeam) details['Default Team'] = profile.defaultTeam;
    if (profile.defaultInitiative) details['Default Initiative'] = profile.defaultInitiative;

    showSuccess(isUpdate ? 'Profile updated successfully!' : 'Profile added successfully!', details);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
