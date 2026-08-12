import { readConfigForScope } from '../../lib/config.js';
import { showError, showSuccess } from '../../lib/output.js';
import { saveProfile } from '../../lib/profiles.js';
import { getScopeInfo } from '../../lib/scope.js';

interface ExcludeProfileOptions {
  global?: boolean;
  project?: boolean;
}

/**
 * Mark a profile as off-limits (`linear: false`) so resolution refuses to act on
 * it — unless forced by an explicit --workspace/--api-key-file (offline).
 */
export function excludeProfileCommand(name: string, options: ExcludeProfileOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(
        `Profile "${name}" not found in ${scopeLabel} config`,
        'Create it first with "agent2linear profile add"'
      );
      process.exit(1);
    }

    profile.linear = false;
    saveProfile(scope, name, profile);

    showSuccess('Profile excluded from Linear!', {
      Profile: name,
      Scope: scopeLabel,
      Note: 'Commands will refuse to use this profile unless forced with --workspace/--api-key-file',
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
