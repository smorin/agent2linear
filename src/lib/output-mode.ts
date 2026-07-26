import { UsageError } from './cli-error.js';

export const OUTPUT_MODES = ['table', 'json', 'tsv'] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];
export type OutputValueSource = 'default' | 'explicit';

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

export function resolveOutputMode(options: ResolveOutputModeOptions): OutputMode {
  const allowed = allowedModes(options);
  const selected = options.output;

  if (options.json) {
    if (!allowed.includes('json')) {
      throw new UsageError('JSON output is not supported by this command');
    }

    if (selected !== undefined && options.outputSource === 'explicit' && selected !== 'json') {
      throw new UsageError(`--json cannot be combined with explicit --output '${selected}'`);
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
