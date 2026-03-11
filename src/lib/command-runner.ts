/**
 * Command Runner - Shared middleware for command execution (C4)
 *
 * Provides standardized error handling, alias resolution, and entity validation
 * for CLI commands. New commands should use this to avoid boilerplate.
 */

import { resolveAlias } from './aliases.js';
import { handleLinearError, isLinearError } from './error-handler.js';
import { showError } from './output.js';
import type { AliasEntityType } from './types.js';

/**
 * Context passed to command execute functions with pre-resolved entities
 */
export interface CommandContext {
  /** Resolved entity IDs after alias resolution */
  resolved: Record<string, string>;
}

/**
 * Alias resolution specification
 */
interface AliasSpec {
  type: AliasEntityType;
  value?: string; // If undefined, skips resolution
}

/**
 * Options for runCommand
 */
interface RunCommandOptions {
  /**
   * Aliases to resolve before execution.
   * Keys become property names in `ctx.resolved`.
   */
  resolveAliases?: Record<string, AliasSpec>;

  /**
   * The command logic to execute with resolved context
   */
  execute: (ctx: CommandContext) => Promise<void>;
}

/**
 * Run a command with standardized error handling and alias resolution.
 *
 * Usage:
 * ```typescript
 * await runCommand({
 *   resolveAliases: {
 *     teamId: { type: 'team', value: options.team },
 *     initiativeId: { type: 'initiative', value: options.initiative },
 *   },
 *   execute: async (ctx) => {
 *     // ctx.resolved.teamId is the resolved team ID
 *     const team = await validateTeamExists(ctx.resolved.teamId);
 *     // ...
 *   },
 * });
 * ```
 */
export async function runCommand(options: RunCommandOptions): Promise<void> {
  try {
    // Resolve aliases
    const resolved: Record<string, string> = {};

    if (options.resolveAliases) {
      for (const [key, spec] of Object.entries(options.resolveAliases)) {
        if (spec.value) {
          resolved[key] = resolveAlias(spec.type, spec.value);
        }
      }
    }

    // Execute command with resolved context
    await options.execute({ resolved });
  } catch (error) {
    // Standardized error handling
    if (isLinearError(error)) {
      const message = handleLinearError(error);
      console.error(message);
    } else {
      showError(error instanceof Error ? error.message : 'Unknown error');
    }
    process.exit(1);
  }
}
