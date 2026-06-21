import { showError, showSuccess } from '../../lib/output.js';
import { loadProfiles, saveProfile } from '../../lib/profiles.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { Profile } from '../../lib/types.js';

interface AddProfileOptions {
  workspace?: string;
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
 */
export function addProfileCommand(name: string, options: AddProfileOptions = {}): void {
  try {
    if (!name || name.trim() === '') {
      showError('Profile name cannot be empty');
      process.exit(1);
    }
    if (name.includes(' ')) {
      showError('Profile name cannot contain spaces');
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);

    const profile: Profile = {};
    if (options.workspace) profile.workspace = options.workspace;
    if (options.defaultTeam) profile.defaultTeam = options.defaultTeam;
    if (options.defaultInitiative) profile.defaultInitiative = options.defaultInitiative;

    const isUpdate = name in loadProfiles();
    saveProfile(scope, name, profile);

    const details: Record<string, string> = { Profile: name, Scope: scopeLabel };
    if (profile.workspace) details.Workspace = profile.workspace;
    if (profile.defaultTeam) details['Default Team'] = profile.defaultTeam;
    if (profile.defaultInitiative) details['Default Initiative'] = profile.defaultInitiative;

    showSuccess(isUpdate ? 'Profile updated successfully!' : 'Profile added successfully!', details);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
