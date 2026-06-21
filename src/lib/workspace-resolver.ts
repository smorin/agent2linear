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
import { getInvocationContext } from './invocation-context.js';
import { detectProfile, loadProfiles } from './profiles.js';
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
 * - `apikey`: bare `--api-key` (ad-hoc workspace, forces through everything).
 * - `named`: a workspace/profile chosen by flag/env/project/auto-detect/default.
 * - `denied`: resolution REFUSED (exclusion, or the no-match gate).
 * - `legacy`: nothing selected — fall back to the legacy single key.
 */
type Decision =
  | { kind: 'apikey'; apiKey: string }
  | { kind: 'named'; name: string; source: WorkspaceSource; profile?: string }
  | { kind: 'denied'; reason: string; hint: string }
  | { kind: 'legacy' };

const FORCE_HINT = 'Pass --workspace <name> or --api-key to override.';

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

function resolveDecision(): Decision {
  const ctx = getInvocationContext();
  const profiles = loadProfiles();

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
  const project = readProjectConfig();
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

  // 4. Profile auto-detection via git-remote owner (negative match wins).
  const detected = detectProfile(profiles);
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
export function resolveActiveProfile(): string | undefined {
  const decision = resolveDecision();
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

  // Bare `--api-key` with no `--workspace` = ad-hoc workspace (no profile scope).
  if (decision.kind === 'apikey') {
    return { key: decision.apiKey, source: 'flag' };
  }

  if (decision.kind === 'named') {
    const wsName = workspaceNameFor(decision.name);
    const { key } = resolveWorkspaceKey(wsName);
    return { key, name: wsName, source: decision.source, profile: decision.profile };
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
 * A single key source-resolver: given the chosen workspace name and the invocation
 * context, return its key + key-source, or null to fall through to the next source.
 */
type KeySourceResolver = (
  name: string | undefined,
  ctx: ReturnType<typeof getInvocationContext>
) => { key: string; source: WorkspaceSource } | null;

/**
 * Ordered key-source resolvers (R7). First non-null wins. Phase 4 inserts the
 * named-env-var (step 2) and per-profile env-file (step 3) resolvers between
 * `cli` and `secretsFile` without rewriting the others.
 */
const KEY_SOURCE_RESOLVERS: KeySourceResolver[] = [
  // 1. cli: explicit `--api-key` (literal, or stdin already resolved in preAction)
  (_name, ctx) => (ctx.apiKey !== undefined ? { key: ctx.apiKey, source: 'flag' } : null),

  // 2. [Phase 4 gap] named env var: `apiKeyEnv` or default LINEAR_API_KEY_<NAME>
  // 3. [Phase 4 gap] per-profile env-file (dotenv)

  // 4. secrets file: literal apiKey in workspaces.json / workspaces.local.json
  (name) => {
    if (!name) return null;
    const ws = loadWorkspaces()[name];
    if (ws && ws.apiKey) {
      // No dedicated 'secrets' source member exists yet; reuse 'flag' since a
      // secrets-file key is only reached via an explicit --workspace selection.
      return { key: ws.apiKey, source: 'flag' };
    }
    return null;
  },

  // 5. legacy plain LINEAR_API_KEY / config apiKey
  () => legacyKey(),
];

/**
 * Source the chosen workspace's key through the ordered resolver list.
 *
 * @param name - resolved workspace/profile name, or undefined for the legacy path.
 */
export function resolveWorkspaceKey(
  name: string | undefined
): { key: string; source: WorkspaceSource } {
  const ctx = getInvocationContext();
  for (const resolver of KEY_SOURCE_RESOLVERS) {
    const result = resolver(name, ctx);
    if (result) {
      return result;
    }
  }
  return { key: '', source: 'legacy' };
}

/**
 * Read a Linear API key from stdin (backs `--api-key -`). Awaited only in the CLI
 * preAction hook (the single stdin reader per invocation) — never from inside
 * `getApiKey()`, so the synchronous key-resolution path is preserved.
 */
export async function readStdinKey(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}
