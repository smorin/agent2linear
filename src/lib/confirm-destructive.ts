import * as readline from 'node:readline';

import { UsageError } from './cli-error.js';
import { noInputRequested } from './interaction-policy.js';

export interface DestructiveConfirmationOptions {
  yes?: boolean;
  noInput?: boolean;
}

export interface DestructiveConfirmationDependencies {
  prompt?: (message: string) => Promise<boolean>;
  stdinIsTTY?: boolean;
}

export interface DestructiveConfirmationDeclined {
  confirmed: false;
}

function promptOnStderr(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(message + ' (y/N): ', answer => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export async function confirmDestructiveAction(
  action: string,
  options: DestructiveConfirmationOptions,
  dependencies: DestructiveConfirmationDependencies = {}
): Promise<void | DestructiveConfirmationDeclined> {
  if (options.yes) return;

  if (noInputRequested(options.noInput)) {
    throw new UsageError(
      action + ' requires confirmation, but --no-input forbids prompting - pass -y/--yes'
    );
  }

  const stdinIsTTY = dependencies.stdinIsTTY ?? process.stdin.isTTY === true;
  if (!stdinIsTTY) {
    throw new UsageError(action + ' requires confirmation in non-interactive mode - pass -y/--yes');
  }

  const confirmed = await (dependencies.prompt ?? promptOnStderr)(action);
  return confirmed ? undefined : { confirmed: false };
}
