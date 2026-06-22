/**
 * Workspace banner + JSON shaping (Phase 5, R11).
 *
 * Pure formatting helpers (unit-testable). The banner uses only locally-known
 * name/source — it makes NO extra API call. `workspaceForJson` shapes the
 * machine-readable `workspace` object an agent asserts on (`workspace.source`).
 */

import type { WorkspaceResolution, WorkspaceSource } from './types.js';

/** Short human label for how the active workspace was selected. */
const SOURCE_LABELS: Record<WorkspaceSource, string> = {
  flag: 'explicit (--workspace/--api-key)',
  env: 'AGENT2LINEAR_WORKSPACE env',
  'env-file': 'env-file',
  project: 'repo config',
  'auto-detect': 'git-remote auto-detect',
  default: 'default profile',
  legacy: 'legacy key',
};

/** The display name for a resolution (handles ad-hoc / default fallbacks). */
function displayName(ws: WorkspaceResolution): string {
  return ws.name ?? (ws.source === 'flag' ? '(ad-hoc via --api-key)' : '(default)');
}

/**
 * Print the workspace/source banner to stderr.
 *
 * Mutating sites call this unconditionally (suppressed by the caller under
 * `--json`/`--quiet`). Read sites pass `{ verbose }` so the banner appears only
 * under `-v` — `verbose: false` is a no-op. (The read-site wiring lands later;
 * the contract exists here.)
 */
export function printWorkspaceBanner(ws: WorkspaceResolution, opts: { verbose?: boolean } = {}): void {
  if (opts.verbose === false) {
    return;
  }
  console.error(`→ Workspace: ${displayName(ws)}  ·  source: ${SOURCE_LABELS[ws.source]}`);
}

/**
 * Shape the machine-readable workspace object for `--json` output. `urlKey` is
 * included only when the caller already has it (e.g. parsed from a result URL) —
 * the banner/JSON never make an extra API call to fetch it.
 */
export function workspaceForJson(
  ws: WorkspaceResolution,
  urlKey?: string
): { name: string | null; urlKey?: string; source: WorkspaceSource } {
  return {
    name: ws.name ?? null,
    ...(urlKey ? { urlKey } : {}),
    source: ws.source,
  };
}
