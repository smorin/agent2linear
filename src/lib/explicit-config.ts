import { closeSync, constants, fstatSync, openSync, readFileSync } from 'fs';

import { RuntimeError } from './cli-error.js';
import type { ExplicitConfigSelection } from './invocation-context.js';
import type { Config } from './types.js';

/** Load and validate one explicitly selected JSON config before a command action runs. */
export function loadExplicitConfig(path: string): ExplicitConfigSelection {
  let descriptor: number;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    throw new RuntimeError(`Explicit config file is missing or unreadable: ${path}`, {
      cause: error,
    });
  }

  let source: string;
  try {
    if (!fstatSync(descriptor).isFile()) {
      throw new RuntimeError(`Explicit config path is not a regular file: ${path}`);
    }
    source = readFileSync(descriptor, 'utf8');
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    throw new RuntimeError(`Explicit config file is unreadable: ${path}`, { cause: error });
  } finally {
    closeSync(descriptor);
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new RuntimeError(`Explicit config file contains malformed JSON: ${path}`, {
      cause: error,
    });
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeError(`Explicit config file must contain a JSON object: ${path}`);
  }

  return { path, value: value as Partial<Config> };
}

const EXPLICIT_CONFIG_MUTATION_PATHS = new Set([
  'config set',
  'config unset',
  'config edit',
  'config override add',
  'config override edit',
  'config override remove',
  'config override move',
  'profile add',
  'profile edit',
  'profile remove',
  'profile exclude',
  'profile match add',
  'profile match remove',
  'workspace add',
  'workspace remove',
  'teams set',
  'teams select',
  'initiatives set',
  'initiatives select',
  'setup',
]);

/** Whether the command writes config.json or its profile/workspace companion stores. */
export function isExplicitConfigMutationCommand(commandPath: readonly string[]): boolean {
  return EXPLICIT_CONFIG_MUTATION_PATHS.has(commandPath.join(' '));
}
