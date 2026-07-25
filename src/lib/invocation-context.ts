/**
 * Per-process invocation context: the workspace/api-key selection stashed by the
 * CLI `preAction` hook before any command runs. Keeps the workspace resolver free
 * of Commander coupling and avoids re-reading `process.argv`.
 *
 * The hook resolves `--api-key -` (stdin) to a literal key BEFORE stashing, so the
 * resolver only ever sees a plain string. This is what lets `getApiKey()` stay
 * synchronous.
 */

import type { Aliases } from './types.js';

export interface InvocationContext {
  /** Value of the program-level `--workspace <name>` flag, if provided. */
  workspace?: string;
  /** Literal API key from `--api-key <key>` (or read from stdin for `--api-key -`). */
  apiKey?: string;
  /** True when the invocation consumed stdin to resolve `--api-key -`. */
  apiKeyFromStdin?: boolean;
  /**
   * Resolution-context dir from the program-level `-C, --cwd` flag (or
   * `AGENT2LINEAR_CWD`), realpath-canonicalized in the preAction hook (M29 §5.7).
   * Governs config discovery and override matching downstream.
   */
  contextDir?: string;
  /**
   * Per-rule alias overlay resolved by `getConfig()` for the current context
   * (M29 §5.1/U6). `loadAliases()` overlays it at highest precedence (override >
   * project > global) so `resolveAlias()` stays drop-in.
   */
  overrideAliases?: Partial<Aliases>;
}

let context: InvocationContext = {};

/** Stash the per-invocation selection (called once by the CLI preAction hook). */
export function setInvocationContext(ctx: InvocationContext): void {
  context = { ...ctx };
}

/** Read the per-invocation selection (read by the workspace resolver). */
export function getInvocationContext(): InvocationContext {
  return context;
}

/** Reset the stashed context. Primarily for test isolation. */
export function resetInvocationContext(): void {
  context = {};
}
