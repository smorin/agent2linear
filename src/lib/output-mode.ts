import { UsageError } from './cli-error.js';

export const OUTPUT_MODES = ['table', 'json', 'tsv'] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];
export type OutputValueSource = 'default' | 'explicit';

interface OutputCompatibilityOptions {
  json?: boolean;
  output?: unknown;
  outputSource?: OutputValueSource;
}

interface OutputModeBase {
  allowedModes?: readonly OutputMode[];
  json?: boolean;
}

export type ResolveOutputModeOptions =
  | (OutputModeBase & { output?: undefined; outputSource?: never })
  | (OutputModeBase & { output: string; outputSource: OutputValueSource });

function allowedModes(options: ResolveOutputModeOptions): readonly OutputMode[] {
  return options.allowedModes ?? OUTPUT_MODES;
}

function invalidModeError(allowed: readonly OutputMode[]): UsageError {
  return new UsageError(`output must be one of: ${allowed.join(', ')}`);
}

export function assertOutputOptionCompatibility(options: OutputCompatibilityOptions): void {
  if (
    options.json === true &&
    options.outputSource === 'explicit' &&
    typeof options.output === 'string' &&
    options.output !== 'json'
  ) {
    throw new UsageError(`--json cannot be combined with explicit --output '${options.output}'`);
  }
}

export function resolveOutputMode(options: ResolveOutputModeOptions): OutputMode {
  const allowed = allowedModes(options);
  const selected = options.output;

  assertOutputOptionCompatibility(options);

  if (options.json) {
    if (!allowed.includes('json')) {
      throw new UsageError('JSON output is not supported by this command');
    }

    return 'json';
  }

  if (selected !== undefined) {
    if (
      !OUTPUT_MODES.includes(selected as OutputMode) ||
      !allowed.includes(selected as OutputMode)
    ) {
      throw invalidModeError(allowed);
    }
    return selected as OutputMode;
  }

  if (!allowed.includes('table')) {
    throw new UsageError("default output mode 'table' is not allowed");
  }

  return 'table';
}
