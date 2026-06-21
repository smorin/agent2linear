/**
 * Profile store + scope extraction (Phase 2).
 *
 * Profiles live in committable config (config.json) under the `profiles` key,
 * merged global-then-project (project overriding global), mirroring aliases.ts.
 * `getProfileScope(name)` returns ONLY the profile's recognized Config defaults
 * (the non-config meta keys workspace/match/linear/apiKeyEnv/envFile are stripped),
 * so it can be spread into the getConfig() merge between global and project.
 *
 * IMPORTANT: this module reads RAW config files (via readGlobalConfig /
 * readProjectConfig) and MUST NOT call getConfig() — getConfig() depends on the
 * profile scope, so calling it here would recurse infinitely.
 */

import {
  readConfigForScope,
  readGlobalConfig,
  readProjectConfig,
  writeConfigForScope,
} from './config.js';
import type { Scope } from './scope.js';
import type { Config, Profile } from './types.js';

/** Profile meta keys that are NOT config defaults — stripped from the merge scope. */
const PROFILE_META_KEYS = ['workspace', 'match', 'linear', 'apiKeyEnv', 'envFile'] as const;

/**
 * Load all profiles, merging global config.json `profiles` with the project
 * config.json `profiles` (project overriding global by name).
 */
export function loadProfiles(): Record<string, Profile> {
  const globalProfiles = readGlobalConfig().profiles ?? {};
  const projectProfiles = readProjectConfig().profiles ?? {};
  return {
    ...globalProfiles,
    ...projectProfiles,
  };
}

/**
 * Return a profile's recognized Config defaults as a Partial<Config> ready to be
 * spread into the merge. Returns `{}` (never undefined) when `name` is undefined
 * or unknown — this is the byte-identical invariant the no-profile merge relies on.
 */
export function getProfileScope(name: string | undefined): Partial<Config> {
  if (!name) {
    return {};
  }
  const profile = loadProfiles()[name];
  if (!profile) {
    return {};
  }
  const scope: Partial<Config> = {};
  for (const [key, value] of Object.entries(profile)) {
    if ((PROFILE_META_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    (scope as Record<string, unknown>)[key] = value;
  }
  return scope;
}

/**
 * Create or overwrite a profile in the given scope's config.json.
 */
export function saveProfile(scope: Scope, name: string, profile: Profile): void {
  const config = readConfigForScope(scope);
  config.profiles = { ...(config.profiles ?? {}), [name]: profile };
  writeConfigForScope(scope, config);
}

/**
 * Remove a profile from the given scope's config.json. Returns false if absent.
 */
export function removeProfile(scope: Scope, name: string): boolean {
  const config = readConfigForScope(scope);
  if (!config.profiles || !(name in config.profiles)) {
    return false;
  }
  delete config.profiles[name];
  writeConfigForScope(scope, config);
  return true;
}
