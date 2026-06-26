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
import { buildGitContext, type RemoteIdentity, selectRemotes } from './git-context.js';
import { matchGlob } from './glob-match.js';
import type { Scope } from './scope.js';
import type { Config, MatchRule, Profile } from './types.js';

/**
 * Default remotes provider for `detectProfile`: the repo's full remotes map from
 * the shared `git-context.ts` parser. `buildGitContext(contextDir)` takes a
 * REQUIRED dir with NO cwd default (unlike the retired
 * `readGitOriginUrl(startDir = process.cwd())`), so this MUST default `startDir`
 * to `process.cwd()` — otherwise detection breaks on every plain (no-`-C`)
 * invocation (M31 Phase 2 seam semantics).
 */
export const defaultRemotes = (startDir: string = process.cwd()): Record<string, RemoteIdentity> =>
  buildGitContext(startDir).remotes;

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
 * config.json `profiles` (project overriding global by name). The optional
 * `startDir` anchors the project-config walk-up to a resolution-context dir other
 * than cwd (M29 J); with no `startDir` this reads cwd, unchanged.
 */
export function loadProfiles(startDir?: string): Record<string, Profile> {
  const globalProfiles = readGlobalConfig().profiles ?? {};
  const projectProfiles = readProjectConfig(startDir).profiles ?? {};
  return {
    ...globalProfiles,
    ...projectProfiles,
  };
}

/**
 * Return a profile's recognized Config defaults as a Partial<Config> ready to be
 * spread into the merge. Returns `{}` (never undefined) when `name` is undefined
 * or unknown — this is the byte-identical invariant the no-profile merge relies on.
 * `startDir` anchors the project-profiles lookup to a context dir other than cwd (M29 J).
 */
export function getProfileScope(name: string | undefined, startDir?: string): Partial<Config> {
  if (!name) {
    return {};
  }
  const profile = loadProfiles(startDir)[name];
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
 * Whether a `match` rule has any field that makes it MATCHABLE (M31 Phase 3): a
 * present identity field (host/owner/repo) OR an explicit `remote`. This gates the
 * no-git short-circuit (the simple/no-detection case never spawns git) AND, with the
 * structural guard inside `ruleMatches`, keeps a `match: {}` / identity-less rule
 * from ever spuriously matching every repo that has an `origin` (trap 1). The
 * bare-`remote` branch of `ruleMatches` is therefore reachable ONLY for a rule the
 * user gave an explicit `remote`.
 */
function isMatchable(rule: MatchRule | undefined): boolean {
  if (!rule) {
    return false;
  }
  const hasHost = (rule.gitRemoteHost?.length ?? 0) > 0;
  const hasOwner = (rule.gitRemoteOwner?.length ?? 0) > 0;
  const hasRepo = (rule.gitRemoteRepo?.length ?? 0) > 0;
  return hasHost || hasOwner || hasRepo || rule.remote !== undefined;
}

/**
 * The single match predicate shared by BOTH `detectProfile` and
 * `detectMatchingProfiles` (M31 Phase 3) — extracting it guarantees where writes
 * land and the ambiguity warning can never disagree (trap 2).
 *
 * Per rule: select the remote(s) it reads (`selectRemotes(rule.remote, …)`, default
 * `origin`); derive case from the rule (`nocase = caseSensitive !== true`, so
 * matching is case-insensitive by default). With present identity fields, the rule
 * matches when SOME selected remote satisfies EVERY present field (host→`id.host`,
 * owner→`id.owner`, repo→`${id.owner}/${id.name}`) — present fields AND, each list
 * ORs. With NO identity fields, a BARE explicit `remote` matches iff a selected
 * remote exists ("a remote of that name exists" — the fork predicate); the
 * `rule.remote !== undefined` guard makes that branch structurally safe even if a
 * caller skips `isMatchable` (trap 1).
 */
function ruleMatches(rule: MatchRule | undefined, remotes: Record<string, RemoteIdentity>): boolean {
  if (!rule) {
    return false;
  }
  const selected = selectRemotes(rule.remote, remotes); // default origin
  const nocase = rule.caseSensitive !== true;
  const present: Array<[string[], (id: RemoteIdentity) => string]> = [];
  if (rule.gitRemoteHost && rule.gitRemoteHost.length > 0) {
    present.push([rule.gitRemoteHost, (id) => id.host]);
  }
  if (rule.gitRemoteOwner && rule.gitRemoteOwner.length > 0) {
    present.push([rule.gitRemoteOwner, (id) => id.owner]);
  }
  if (rule.gitRemoteRepo && rule.gitRemoteRepo.length > 0) {
    present.push([rule.gitRemoteRepo, (id) => `${id.owner}/${id.name}`]);
  }
  if (present.length === 0) {
    // Bare remote = "this is a fork / a remote of that name exists". Gated on an
    // EXPLICIT remote so a `match: {}` rule (selectRemotes defaults to [origin])
    // can never spuriously route every repo with an origin (trap 1).
    return rule.remote !== undefined && selected.length > 0;
  }
  return selected.some(({ identity }) =>
    present.every(([patterns, pick]) => patterns.some((p) => matchGlob(p, pick(identity), { nocase })))
  );
}

/**
 * Auto-detect the active profile from the repo's remotes (M28 Phase 3; M31 Phase 3
 * adds host/repo/remote/case matching).
 *
 * Returns `{ name, exclude }` for the matched profile, or null when nothing
 * matches. A **negative match wins** (R9a): if a profile whose WHOLE rule matches is
 * excluded (`linear: false` on the profile or its `match`), that exclusion is
 * returned even if another profile positively matches (trap 2 — exclusion keys off
 * the full rule matching, not merely an owner hit).
 *
 * Short-circuits to null (without invoking the git provider) when no profile has a
 * MATCHABLE rule (`isMatchable`: any identity field OR an explicit `remote`) — so the
 * simple/no-detection case never spawns git. `remotesProvider` is injectable so
 * tests never shell out.
 *
 * Matching flows through the SHARED parser (`git-context.ts`), the SHARED remote
 * selector (`selectRemotes`), and the SHARED matcher (`matchGlob`). The owner-only
 * case is unchanged: still reads `origin`, still case-insensitive, still list-OR.
 * The one intended delta is nested-group segmentation (D2): the origin's owner is now
 * `group/sub` (all-but-last) instead of `group` (first segment).
 */
export function detectProfile(
  profiles: Record<string, Profile>,
  remotesProvider: (startDir?: string) => Record<string, RemoteIdentity> = defaultRemotes
): { name: string; exclude: boolean } | null {
  const matchable = Object.entries(profiles).filter(([, p]) => isMatchable(p.match));
  if (matchable.length === 0) {
    return null;
  }

  const remotes = remotesProvider();

  let positive: string | null = null;
  for (const [name, profile] of matchable) {
    if (!ruleMatches(profile.match, remotes)) {
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
 * All profile names whose `match` rule matches the repo's remotes (M31 Phase 3) —
 * drives the ambiguity warning when >1 profile matches the same repo. Uses the SAME
 * `ruleMatches` predicate as `detectProfile` (trap 2: the warning can never disagree
 * with where writes land), and the SAME `isMatchable` short-circuit (no git in the
 * simple case).
 *
 * Returns ALL matches, including excluded (`linear: false`) ones — whether the
 * ambiguity threshold counts excluded matches is decided at the Phase 4 consumption
 * point, not here (trap 4). `detectProfile` keeps its single-result,
 * negative-wins/first-positive contract.
 */
export function detectMatchingProfiles(
  profiles: Record<string, Profile>,
  remotesProvider: (startDir?: string) => Record<string, RemoteIdentity> = defaultRemotes
): string[] {
  const matchable = Object.entries(profiles).filter(([, p]) => isMatchable(p.match));
  if (matchable.length === 0) {
    return [];
  }
  const remotes = remotesProvider();
  return matchable.filter(([, p]) => ruleMatches(p.match, remotes)).map(([name]) => name);
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
