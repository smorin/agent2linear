/**
 * Shared scope utilities for determining config scope
 *
 * This module provides reusable functions for handling the global/project
 * scope pattern used across commands to reduce code duplication.
 */

/**
 * Options for commands that support scope flags
 */
export interface ScopeOptions {
  global?: boolean;
  project?: boolean;
}

/**
 * Config scope type: either 'global' or 'project'
 */
export type Scope = 'global' | 'project';

/**
 * Determine scope from command options
 *
 * @param options - Command options with global/project flags
 * @returns 'project' if options.project is true, otherwise 'global'
 *
 * @example
 * const scope = determineScope({ project: true });
 * // Returns: 'project'
 *
 * @example
 * const scope = determineScope({});
 * // Returns: 'global' (default)
 */
export function determineScope(options: ScopeOptions = {}): Scope {
  return options.project ? 'project' : 'global';
}

/**
 * Get human-readable scope label
 *
 * @param scope - The scope ('global' or 'project')
 * @returns Scope label for display
 *
 * @example
 * const label = getScopeLabel('global');
 * // Returns: 'global'
 */
export function getScopeLabel(scope: Scope): string {
  return scope;
}

/**
 * Get scope and label together (most common use case)
 *
 * This combines determineScope() and getScopeLabel() for convenience,
 * since most commands need both values.
 *
 * @param options - Command options with global/project flags
 * @returns Object with scope and label properties
 *
 * @example
 * const { scope, label } = getScopeInfo({ project: true });
 * // Returns: { scope: 'project', label: 'project' }
 *
 * @example
 * const { scope, label } = getScopeInfo({});
 * // Returns: { scope: 'global', label: 'global' }
 */
export function getScopeInfo(options: ScopeOptions = {}): { scope: Scope; label: string } {
  const scope = determineScope(options);
  const label = getScopeLabel(scope);
  return { scope, label };
}
