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
import { parseRemoteOwner, readGitOriginUrl } from './git-remote.js';
import type { Scope } from './scope.js';
import type { Config, Profile } from './types.js';

/**
 * Profile keys that are NOT config defaults — stripped from the merge scope.
 *
 * Beyond the meta keys (workspace/match/linear/apiKeyEnv/envFile), this also
 * strips `apiKey`/`profiles`/`profile`: a hand-edited `profiles.<name>.apiKey`
 * in committable config must never flow into the resolved config (commit-safety),
 * and a nested `profiles`/repo-level `profile` selector has no meaning in a scope.
 */
const PROFILE_META_KEYS = [
  'workspace',
  'match',
  'linear',
  'apiKeyEnv',
  'envFile',
  'apiKey',
  'profiles',
  'profile',
] as const;

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
 * Auto-detect the active profile from the repo's `origin` remote owner (Phase 3).
 *
 * Returns `{ name, exclude }` for the matched profile, or null when nothing
 * matches. A **negative match wins** (R9a): if the owner matches an excluded
 * profile (`linear: false` on the profile or its `match`), that exclusion is
 * returned even if another profile positively matches the same owner.
 *
 * Short-circuits to null (without invoking the git provider) when no profile has
 * `match.gitRemoteOwner` rules — so the simple/no-detection case never spawns git.
 * `remoteUrlProvider` is injectable so tests never shell out.
 */
export function detectProfile(
  profiles: Record<string, Profile>,
  remoteUrlProvider: (startDir?: string) => string | null = readGitOriginUrl
): { name: string; exclude: boolean } | null {
  const matchable = Object.entries(profiles).filter(
    ([, p]) => p.match?.gitRemoteOwner && p.match.gitRemoteOwner.length > 0
  );
  if (matchable.length === 0) {
    return null;
  }

  const parsed = parseRemoteOwner(remoteUrlProvider());
  if (!parsed) {
    return null;
  }
  const owner = parsed.owner.toLowerCase();

  let positive: string | null = null;
  for (const [name, profile] of matchable) {
    const owners = (profile.match?.gitRemoteOwner ?? []).map((o) => o.toLowerCase());
    if (!owners.includes(owner)) {
      continue;
    }
    const excluded = profile.linear === false || profile.match?.linear === false;
    if (excluded) {
      return { name, exclude: true }; // negative match wins immediately
    }
    if (positive === null) {
      positive = name;
    }
  }

  return positive ? { name: positive, exclude: false } : null;
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
