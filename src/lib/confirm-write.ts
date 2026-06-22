/**
 * Cross-workspace write confirmation (Phase 5, R11).
 *
 * The accident risk is precisely a MUTATING command whose workspace was
 * AUTO-DETECTED in a multi-workspace setup. `needsWorkspaceConfirm` is a pure
 * predicate for that case; the gate prompts on an interactive TTY but fail-safe
 * ERRORS for non-interactive callers (it never hangs, never silently proceeds).
 *
 * `guardWorkspaceForMutation` ties resolution + banner + confirm together so the
 * three mutating commands share one call.
 */

import * as readline from 'readline';

import { getConfig } from './config.js';
import { getLogLevel } from './logger.js';
import { showError } from './output.js';
import type { Config, WorkspaceResolution } from './types.js';
import { printWorkspaceBanner } from './workspace-banner.js';
import { configuredWorkspaceCount, resolveActiveWorkspace } from './workspace-resolver.js';

interface MutationOptions {
  json?: boolean;
  yes?: boolean;
}

/**
 * True only for an auto-detected mutation in a multi-workspace setup that lacks
 * an explicit selector (`source` would be 'flag'), `-y/--yes`, or
 * `confirmAutoDetectedWrites: false`. Pure — `multipleWorkspaces` is supplied by
 * the caller so this never reads the filesystem.
 */
export function needsWorkspaceConfirm(
  resolution: WorkspaceResolution,
  options: MutationOptions,
  config: Pick<Config, 'confirmAutoDetectedWrites'>,
  multipleWorkspaces: boolean
): boolean {
  if (options.yes) {
    return false;
  }
  if (config.confirmAutoDetectedWrites === false) {
    return false;
  }
  if (resolution.source !== 'auto-detect') {
    return false;
  }
  return multipleWorkspaces;
}

/** Readline `(y/N)` prompt, default No. */
function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    })
  );
}

/**
 * The confirmation gate. No-op unless `needsWorkspaceConfirm`. On an interactive
 * stdin it prompts (default No); on a non-TTY stdin with no escape it ERRORS
 * (exit 1) — never hangs, never guesses.
 */
export async function confirmWorkspaceWrite(
  resolution: WorkspaceResolution,
  options: MutationOptions,
  config: Pick<Config, 'confirmAutoDetectedWrites'>,
  multipleWorkspaces: boolean
): Promise<void> {
  if (!needsWorkspaceConfirm(resolution, options, config, multipleWorkspaces)) {
    return;
  }

  if (!process.stdin.isTTY) {
    showError(
      `Refusing to write to auto-detected workspace "${resolution.name}" non-interactively.`,
      'Pass --workspace <name>, -y/--yes, or set "config set confirmAutoDetectedWrites false".'
    );
    process.exit(1);
  }

  const ok = await promptConfirmation(
    `Write to workspace "${resolution.name}" (auto-detected from this repo)?`
  );
  if (!ok) {
    console.log('❌ Operation cancelled');
    process.exit(0);
  }
}

/**
 * Resolve the active workspace for a mutating command, then: refuse if resolution
 * was denied (Phase 3/4 gates), print the banner (unless `--json`/`--quiet`), and
 * run the confirm gate (which runs even under `--json`). Returns the resolution
 * so the caller can include `workspace.source` in `--json` output.
 */
export async function guardWorkspaceForMutation(
  options: MutationOptions
): Promise<WorkspaceResolution> {
  const resolution = resolveActiveWorkspace();

  if (resolution.denied) {
    showError(resolution.denied.reason, resolution.denied.hint);
    process.exit(1);
  }

  const silent = options.json || getLogLevel() === 'quiet';
  if (!silent) {
    printWorkspaceBanner(resolution);
  }

  await confirmWorkspaceWrite(resolution, options, getConfig(), configuredWorkspaceCount() >= 2);
  return resolution;
}
