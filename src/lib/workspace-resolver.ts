/**
 * The workspace resolution chokepoint.
 *
 * `resolveActiveWorkspace()` walks the (Phase-1 subset of the) precedence chain to
 * decide WHICH workspace is active and HOW it was selected. `resolveWorkspaceKey()`
 * then sources the chosen workspace's key through an ordered list of source-resolvers
 * (cli -> [Phase 4 gaps] -> secrets file -> legacy), first non-null wins.
 *
 * Phase 1 fills R7 steps 1 (cli), 4 (secrets file), and 5 (legacy plain
 * `LINEAR_API_KEY` / config `apiKey`). Steps 2 (named env var) and 3 (per-profile
 * env-file) are left as explicit gaps for Phase 4 to INSERT between cli and secrets.
 *
 * INVARIANT (R4): with zero workspaces/profiles configured and no explicit
 * selection, this returns exactly today's value — env `LINEAR_API_KEY` (source
 * 'env') or the config-file `apiKey` (source 'legacy') — and reads no new files.
 *
 * Note: this module must NOT call `getApiKey()` (config.ts) — that would recurse,
 * since `getApiKey()` routes through here. It reads `getConfig().apiKey` and the
 * environment directly instead.
 */

import { getConfig } from './config.js';
import { getInvocationContext } from './invocation-context.js';
import type { WorkspaceResolution, WorkspaceSource } from './types.js';
import { loadWorkspaces } from './workspaces.js';

/**
 * The legacy single-key value: env `LINEAR_API_KEY` (highest), else config-file
 * `apiKey`. Mirrors today's `getApiKey()` resolution exactly. The `source`
 * distinguishes an env-sourced key ('env') from a config-file key ('legacy').
 */
function legacyKey(): { key: string; source: WorkspaceSource } | null {
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }
  const configKey = getConfig().apiKey;
  if (configKey) {
    return { key: configKey, source: 'legacy' };
  }
  return null;
}

/**
 * Resolve the active workspace selection (which workspace + how it was chosen).
 *
 * Phase 1 precedence:
 *   1. explicit `--api-key` (ad-hoc workspace, no profile)  -> source 'flag'
 *   1. explicit `--workspace <name>` (named workspace)       -> source 'flag'
 *   ... [Phase 2/3 insert env declarator / project config / auto-detect / default]
 *   6. legacy single key (env or config apiKey)              -> source 'env' | 'legacy'
 */
export function resolveActiveWorkspace(): WorkspaceResolution {
  const ctx = getInvocationContext();

  // 1. Explicit per-invocation selection (highest precedence).
  // Bare `--api-key` with no `--workspace` = ad-hoc workspace (no profile scope).
  if (ctx.apiKey !== undefined && ctx.workspace === undefined) {
    return { key: ctx.apiKey, source: 'flag' };
  }
  if (ctx.workspace !== undefined) {
    // The selection source is always 'flag' because the workspace was chosen
    // explicitly. `resolveWorkspaceKey` describes where the KEY came from.
    const { key } = resolveWorkspaceKey(ctx.workspace);
    return { key, name: ctx.workspace, source: 'flag' };
  }

  // 6. Legacy single-key passthrough — byte-identical to today's getApiKey().
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
      // No dedicated 'secrets' source member exists in P1; reuse 'flag' since a
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
