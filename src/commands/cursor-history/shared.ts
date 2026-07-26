import { createInterface } from 'node:readline/promises';

import { UsageError } from '../../lib/cli-error.js';
import { CursorHistoryStore } from '../../lib/cursor-history.js';
import { type OutputMode, resolveOutputMode } from '../../lib/output-mode.js';

export interface CursorHistoryCommandDependencies {
  store: CursorHistoryStore;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  isInteractive: () => boolean;
  confirm: (message: string) => Promise<boolean>;
}

export interface OutputOptions {
  output?: string;
  json?: boolean;
  outputExplicit?: boolean;
}

export function defaultCursorHistoryDependencies(): CursorHistoryCommandDependencies {
  return {
    store: new CursorHistoryStore(),
    stdout: value => process.stdout.write(value),
    stderr: value => process.stderr.write(value),
    isInteractive: () => process.stdin.isTTY === true,
    confirm: async message => {
      const prompt = createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: true,
      });
      try {
        const answer = await prompt.question(message);
        return /^(?:y|yes)$/i.test(answer.trim());
      } finally {
        prompt.close();
      }
    },
  };
}

export function mergeCursorHistoryDependencies(
  overrides: Partial<CursorHistoryCommandDependencies> = {}
): CursorHistoryCommandDependencies {
  return { ...defaultCursorHistoryDependencies(), ...overrides };
}

export function commandOutputMode(
  options: OutputOptions,
  allowedModes: readonly OutputMode[] = ['table', 'json']
): OutputMode {
  if (options.output === undefined) {
    return resolveOutputMode({ json: options.json, allowedModes });
  }
  return resolveOutputMode({
    output: options.output,
    outputSource: options.outputExplicit ? 'explicit' : 'default',
    json: options.json,
    allowedModes,
  });
}

export function writeJson(dependencies: CursorHistoryCommandDependencies, value: unknown): void {
  dependencies.stdout(`${JSON.stringify(value, null, 2)}\n`);
}

export function parseHistoryLimit(value: string | undefined): number {
  if (value === undefined) return 50;
  if (!/^\d+$/.test(value)) {
    throw new UsageError('history limit must be a whole number between 1 and 1000');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new UsageError('history limit must be a whole number between 1 and 1000');
  }
  return parsed;
}

export function validateHistoryCursor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.length === 0) {
    throw new UsageError('history cursor filter must not be empty');
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateHistoryEntryId(value: string): string {
  if (!UUID_RE.test(value)) {
    throw new UsageError('cursor history entry ID must be a UUID');
  }
  return value;
}
