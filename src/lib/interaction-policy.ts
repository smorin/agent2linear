import { UsageError } from './cli-error.js';
import { getInvocationContext } from './invocation-context.js';

const ALWAYS_INTERACTIVE_COMMANDS = new Set([
  'setup',
  'initiatives select',
  'teams select',
  'alias edit',
  'config edit',
  'milestone-templates edit',
]);

export function noInputRequested(localNoInput = false): boolean {
  return localNoInput || getInvocationContext().noInput === true;
}

export function requireInteractiveInput(
  action: string,
  localNoInput = false,
  stdinIsTTY = getInvocationContext().stdinIsTTY ?? true
): void {
  if (noInputRequested(localNoInput)) {
    throw new UsageError(
      `${action} requires interactive input; --no-input forbids interactive input or prompting`
    );
  }
  if (!stdinIsTTY) throw new UsageError(`${action} requires interactive input from a TTY`);
}

export function assertInteractionAllowed(
  commandPath: readonly string[],
  noInput: boolean,
  stdinIsTTY = process.stdin.isTTY === true
): void {
  if (!noInput && stdinIsTTY) return;
  const path = commandPath.join(' ');
  if (ALWAYS_INTERACTIVE_COMMANDS.has(path)) {
    throw new UsageError(
      noInput
        ? `${path} requires interactive input; --no-input forbids interactive input`
        : `${path} requires interactive input from a TTY`
    );
  }
}
