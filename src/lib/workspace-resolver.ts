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
import { loadProfiles } from './profiles.js';
import type { WorkspaceResolution, WorkspaceSource } from './types.js';
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
 * The per-invocation selection, decided once by walking the R8 precedence chain
 * (without sourcing a key). Both `resolveActiveProfile()` and
 * `resolveActiveWorkspace()` build on this.
 *
 * - `apikey`: bare `--api-key` (ad-hoc workspace, no profile scope).
 * - `named`: a workspace/profile name chosen by flag/env/project/default, with
 *   the selection source and (when it names a profile) the profile name.
 * - `legacy`: nothing selected — fall back to the legacy single key.
 */
type Selection =
  | { kind: 'apikey'; apiKey: string }
  | { kind: 'named'; name: string; source: WorkspaceSource; profile?: string }
  | { kind: 'legacy' };

function resolveSelection(): Selection {
  const ctx = getInvocationContext();
  const profiles = loadProfiles();
  const isProfile = (n: string): boolean =>
    Object.prototype.hasOwnProperty.call(profiles, n);

  // 1. Explicit per-invocation selection (highest precedence).
  if (ctx.apiKey !== undefined && ctx.workspace === undefined) {
    return { kind: 'apikey', apiKey: ctx.apiKey };
  }
  if (ctx.workspace !== undefined) {
    return {
      kind: 'named',
      name: ctx.workspace,
      source: 'flag',
      profile: isProfile(ctx.workspace) ? ctx.workspace : undefined,
    };
  }

  // 2. AGENT2LINEAR_WORKSPACE env declarator.
  const envWs = process.env.AGENT2LINEAR_WORKSPACE;
  if (envWs) {
    return {
      kind: 'named',
      name: envWs,
      source: 'env',
      profile: isProfile(envWs) ? envWs : undefined,
    };
  }

  // 3. Project config `profile` / `workspace` (nearest .agent2linear/config.json).
  const project = readProjectConfig();
  if (project.profile) {
    return {
      kind: 'named',
      name: project.profile,
      source: 'project',
      profile: isProfile(project.profile) ? project.profile : undefined,
    };
  }
  if (project.workspace) {
    return {
      kind: 'named',
      name: project.workspace,
      source: 'project',
      profile: isProfile(project.workspace) ? project.workspace : undefined,
    };
  }

  // 4. [Phase 3 gap] profile auto-detection via git-remote owner.

  // 5. Global defaultProfile.
  const defaultProfile = readGlobalConfig().defaultProfile;
  if (defaultProfile) {
    return {
      kind: 'named',
      name: defaultProfile,
      source: 'default',
      profile: isProfile(defaultProfile) ? defaultProfile : undefined,
    };
  }

  // 6. Legacy single key.
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
 * Resolve the active PROFILE name only (no key sourcing). Used by getConfig() for
 * its merge. Returns undefined for the ad-hoc, bare-workspace, and legacy paths.
 *
 * MUST NOT call getConfig() (would recurse) — resolveSelection() reads raw config.
 */
export function resolveActiveProfile(): string | undefined {
  const selection = resolveSelection();
  return selection.kind === 'named' ? selection.profile : undefined;
}

/**
 * Resolve the active workspace selection (which workspace + how it was chosen +
 * the sourced key). The `source` describes how the workspace was SELECTED; the
 * key itself is sourced via `resolveWorkspaceKey()`.
 */
export function resolveActiveWorkspace(): WorkspaceResolution {
  const selection = resolveSelection();

  // Bare `--api-key` with no `--workspace` = ad-hoc workspace (no profile scope).
  if (selection.kind === 'apikey') {
    return { key: selection.apiKey, source: 'flag' };
  }

  if (selection.kind === 'named') {
    const wsName = workspaceNameFor(selection.name);
    const { key } = resolveWorkspaceKey(wsName);
    return { key, name: wsName, source: selection.source, profile: selection.profile };
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
