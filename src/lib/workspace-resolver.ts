/**
 * The workspace resolution chokepoint.
 *
 * `resolveActiveWorkspace()` walks the precedence chain (R8) to decide WHICH
 * workspace is active and HOW it was selected. `resolveActiveProfile()` returns
 * just the active PROFILE name and is what `getConfig()` uses for its merge.
 * `resolveWorkspaceKey()` sources the chosen workspace's key through an ordered
 * list of source-resolvers (cli -> [Phase 4 gaps] -> secrets file -> legacy).
 *
 * RECURSION SAFETY: nothing here may call `getConfig()`. `getConfig()` now calls
 * `resolveActiveProfile()` for its merge, so any getConfig() call from the
 * resolution path would recurse infinitely. We read RAW config files via
 * `readGlobalConfig()` / `readProjectConfig()` instead.
 *
 * Phase 1 filled R7 key-source steps 1 (cli), 4 (secrets file), 5 (legacy).
 * Phase 2 adds the SELECTION precedence: flag -> AGENT2LINEAR_WORKSPACE env ->
 * project config profile/workspace -> [auto-detect: Phase 3] -> global
 * defaultProfile -> legacy. Steps 2/3 of the key-source order are Phase 4 gaps.
 *
 * INVARIANT (R4): with zero workspaces/profiles configured and no explicit
 * selection, this returns exactly today's value — env `LINEAR_API_KEY` (source
 * 'env') or the config-file `apiKey` (source 'legacy') — and selects no profile.
 */

import { readGlobalConfig, readProjectConfig } from './config.js';
import { loadEnvFile } from './env-file.js';
import { getInvocationContext } from './invocation-context.js';
import { defaultRemotes, detectProfile, loadProfiles } from './profiles.js';
import type { Profile, WorkspaceResolution, WorkspaceSource } from './types.js';
import { loadWorkspaces } from './workspaces.js';

/**
 * The legacy single-key value: env `LINEAR_API_KEY` (highest), else project-file
 * `apiKey`, else global-file `apiKey`. Mirrors today's apiKey precedence
 * (env > project > global) WITHOUT calling getConfig() (would recurse).
 */
function legacyKey(): { key: string; source: WorkspaceSource } | null {
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }
  const projectKey = readProjectConfig().apiKey;
  if (projectKey) {
    return { key: projectKey, source: 'legacy' };
  }
  const globalKey = readGlobalConfig().apiKey;
  if (globalKey) {
    return { key: globalKey, source: 'legacy' };
  }
  return null;
}

/**
 * The per-invocation decision, computed once by walking the R8 precedence chain
 * AND applying the Phase-3 gate (exclusion + no-match policy) — without sourcing a
 * key. Both `resolveActiveProfile()` and `resolveActiveWorkspace()` build on this.
 *
 * - `apikey`: bare `--api-key-file` (ad-hoc workspace, forces through everything).
 * - `named`: a workspace/profile chosen by flag/env/project/auto-detect/default.
 * - `denied`: resolution REFUSED (exclusion, or the no-match gate).
 * - `legacy`: nothing selected — fall back to the legacy single key.
 */
type Decision =
  | { kind: 'apikey'; apiKey: string }
  | { kind: 'named'; name: string; source: WorkspaceSource; profile?: string }
  | { kind: 'denied'; reason: string; hint: string }
  | { kind: 'legacy' };

const FORCE_HINT = 'Pass --workspace <name> or --api-key-file <path|-> to override.';

function isProfileName(profiles: Record<string, Profile>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(profiles, name);
}

/**
 * Build a `named` decision for a config/env/default selection, denying first if
 * the named profile is excluded (`linear: false`). Explicit `--workspace` does
 * NOT go through here — it forces through exclusion.
 */
function namedOrExcluded(
  name: string,
  source: WorkspaceSource,
  profiles: Record<string, Profile>
): Decision {
  const profile = profiles[name];
  if (profile && profile.linear === false) {
    return {
      kind: 'denied',
      reason: `Profile '${name}' is excluded from Linear (linear: false).`,
      hint: FORCE_HINT,
    };
  }
  return { kind: 'named', name, source, profile: isProfileName(profiles, name) ? name : undefined };
}

function resolveDecision(startDir?: string): Decision {
  const ctx = getInvocationContext();
  const profiles = loadProfiles(startDir);

  // 1. Explicit per-invocation selection (highest precedence; forces through
  //    exclusion AND the no-match gate).
  if (ctx.apiKey !== undefined && ctx.workspace === undefined) {
    return { kind: 'apikey', apiKey: ctx.apiKey };
  }
  if (ctx.workspace !== undefined) {
    return {
      kind: 'named',
      name: ctx.workspace,
      source: 'flag',
      profile: isProfileName(profiles, ctx.workspace) ? ctx.workspace : undefined,
    };
  }

  // Repo-level exclusion: `.agent2linear/config.json` `linear: false`.
  const project = readProjectConfig(startDir);
  if (project.linear === false) {
    return {
      kind: 'denied',
      reason: 'This repository is excluded from Linear (linear: false).',
      hint: FORCE_HINT,
    };
  }

  // 2. AGENT2LINEAR_WORKSPACE env declarator.
  const envWs = process.env.AGENT2LINEAR_WORKSPACE;
  if (envWs) {
    return namedOrExcluded(envWs, 'env', profiles);
  }

  // 3. Project config `profile` / `workspace` (nearest .agent2linear/config.json).
  if (project.profile) {
    return namedOrExcluded(project.profile, 'project', profiles);
  }
  if (project.workspace) {
    return namedOrExcluded(project.workspace, 'project', profiles);
  }

  // 4. Profile auto-detection via git remote identity (host/owner/repo + remote;
  //    negative match wins). Read remotes from `startDir` when querying a context dir
  //    other than cwd (M29 J); with no `startDir` the default provider
  //    (`defaultRemotes`) reads cwd via its own `= process.cwd()` default, unchanged.
  const detected = detectProfile(
    profiles,
    startDir === undefined ? defaultRemotes : () => defaultRemotes(startDir)
  );
  if (detected) {
    if (detected.exclude) {
      return {
        kind: 'denied',
        reason: `The detected profile '${detected.name}' is excluded from Linear.`,
        hint: FORCE_HINT,
      };
    }
    return { kind: 'named', name: detected.name, source: 'auto-detect', profile: detected.name };
  }

  // 5. No-match gate (R9b): nothing matched and nothing explicit.
  const policy = readGlobalConfig().noMatchPolicy ?? 'deny';
  const profileCount = Object.keys(profiles).length;
  if (policy === 'match-only') {
    return {
      kind: 'denied',
      reason: 'No workspace resolved for this repository (noMatchPolicy: match-only).',
      hint: 'Pass --workspace <name>, set a repo profile/workspace, or add a match rule.',
    };
  }
  if (policy === 'deny' && profileCount >= 2) {
    return {
      kind: 'denied',
      reason: 'No workspace resolved for this repository and multiple profiles exist.',
      hint: 'Pass --workspace <name>, set a repo profile/workspace, or add a match rule.',
    };
  }

  // 6. Global defaultProfile (reached under `default`, or `deny` with <2 profiles —
  //    the simple/single-workspace case, which never denies).
  const defaultProfile = readGlobalConfig().defaultProfile;
  if (defaultProfile) {
    return namedOrExcluded(defaultProfile, 'default', profiles);
  }

  // 7. Legacy single key.
  return { kind: 'legacy' };
}

/**
 * Map a selected name to the workspace name whose key should be sourced. A
 * profile points at a workspace by name; a bare workspace name maps to itself.
 */
function workspaceNameFor(name: string): string {
  const profile = loadProfiles()[name];
  if (profile && profile.workspace) {
    return profile.workspace;
  }
  return name;
}

/**
 * Resolve the active PROFILE name only (no key sourcing, never denies). Used by
 * getConfig() for its merge — a denied/legacy/ad-hoc decision contributes no
 * profile scope, so getConfig() still returns a working config in a denied repo.
 *
 * MUST NOT call getConfig() (would recurse) — resolveDecision() reads raw config.
 */
export function resolveActiveProfile(startDir?: string): string | undefined {
  const decision = resolveDecision(startDir);
  return decision.kind === 'named' ? decision.profile : undefined;
}

/**
 * Resolve the active workspace: which workspace + how it was selected + the
 * sourced key, OR a `denied` resolution when the gate refused to pick one.
 */
export function resolveActiveWorkspace(): WorkspaceResolution {
  const decision = resolveDecision();

  if (decision.kind === 'denied') {
    return { key: '', source: 'legacy', denied: { reason: decision.reason, hint: decision.hint } };
  }

  // Bare `--api-key-file` with no `--workspace` = ad-hoc workspace (no profile scope).
  if (decision.kind === 'apikey') {
    return { key: decision.apiKey, source: 'flag' };
  }

  if (decision.kind === 'named') {
    const wsName = workspaceNameFor(decision.name);
    const profile = decision.profile ? loadProfiles()[decision.profile] : undefined;
    const result = resolveWorkspaceKey(wsName, profile);

    return { key: result.key, name: wsName, source: decision.source, profile: decision.profile };
  }

  // Legacy single-key passthrough — byte-identical to today's getApiKey().
  const legacy = legacyKey();
  if (legacy) {
    return { key: legacy.key, source: legacy.source };
  }

  // No key resolvable anywhere. Return an empty legacy resolution; downstream
  // callers (getLinearClient) raise the existing "no API key" error.
  return { key: '', source: 'legacy' };
}

/**
 * The default per-workspace env-var name: `LINEAR_API_KEY_<NORMALIZED-NAME>`,
 * upper-cased with any char outside [A-Z0-9_] replaced by `_`
 * (e.g. `acme` -> LINEAR_API_KEY_ACME, `acme-co` -> LINEAR_API_KEY_ACME_CO).
 */
export function normalizeEnvVarName(name: string): string {
  return `LINEAR_API_KEY_${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
}

/** Number of distinct configured workspaces (registry entries ∪ profile pointers). */
export function configuredWorkspaceCount(): number {
  const names = new Set<string>(Object.keys(loadWorkspaces()));
  for (const profile of Object.values(loadProfiles())) {
    if (profile.workspace) {
      names.add(profile.workspace);
    }
  }
  return names.size;
}

/**
 * The result of sourcing a workspace's key.
 */
interface KeySourceResult {
  key: string;
  source: WorkspaceSource;
}

/**
 * Source the chosen workspace's key through the ordered R7 chain (first hit wins):
 *   1. cli `--api-key-file`
 *   2. named env var (`apiKeyEnv` override, else default LINEAR_API_KEY_<NAME>)
 *   3. per-profile env-file (dotenv; same var name; no process.env mutation)
 *   4. secrets registry (workspaces.json / .local.json)
 *   5. only when unnamed: legacy plain LINEAR_API_KEY / config apiKey
 *
 * @param name - resolved workspace name, or undefined for the legacy path.
 * @param profile - the active profile (carries `apiKeyEnv` / `envFile`), if any.
 */
export function resolveWorkspaceKey(name: string | undefined, profile?: Profile): KeySourceResult {
  const ctx = getInvocationContext();

  // 1. cli: explicit `--api-key-file` (already resolved in preAction).
  if (ctx.apiKey !== undefined) {
    return { key: ctx.apiKey, source: 'flag' };
  }

  const envVarName = profile?.apiKeyEnv ?? (name ? normalizeEnvVarName(name) : undefined);

  // 2. named env var in the process environment.
  if (envVarName) {
    const fromEnv = process.env[envVarName];
    if (fromEnv) {
      return { key: fromEnv, source: 'env' };
    }
  }

  // 3. the same var name inside the profile's env-file.
  if (envVarName && profile?.envFile) {
    const fromFile = loadEnvFile(profile.envFile)[envVarName];
    if (fromFile) {
      return { key: fromFile, source: 'env-file' };
    }
  }

  // 4. secrets registry. (No dedicated 'secrets' source member; reuse 'flag'.)
  if (name) {
    const ws = loadWorkspaces()[name];
    if (ws && ws.apiKey) {
      return { key: ws.apiKey, source: 'flag' };
    }
  }

  // A named workspace must never borrow the unnamed legacy credential.
  if (name) {
    return { key: '', source: 'legacy' };
  }

  // 5. unnamed legacy plain LINEAR_API_KEY / config apiKey.
  const legacy = legacyKey();
  if (legacy) {
    return legacy;
  }
  return { key: '', source: 'legacy' };
}
