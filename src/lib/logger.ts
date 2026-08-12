/** Structured, stderr-only diagnostics with one repeatable verbosity ladder. */

import { redactText, redactValue } from './redaction.js';

type LogLevel = 'quiet' | 'normal' | 'verbose';
type Verbosity = 0 | 1 | 2 | 3;

export interface DiagnosticOptions {
  debug?: boolean;
  quiet?: boolean;
  verbosity?: number;
}

export interface RequestDiagnostic {
  latencyMs?: number;
  method: string;
  pageCount?: number;
  requestId?: string;
  status?: number | string;
}

interface DiagnosticState {
  debug: boolean;
  quiet: boolean;
  verbosity: Verbosity;
}

let state: DiagnosticState = { debug: false, quiet: false, verbosity: 0 };
let bufferMachineDiagnostics = false;
let diagnosticBuffer: string[] = [];

function boundedVerbosity(value: number | undefined): Verbosity {
  return Math.max(0, Math.min(3, Math.trunc(value ?? 0))) as Verbosity;
}

export function configureDiagnostics(options: DiagnosticOptions): void {
  state = {
    debug: options.debug === true,
    quiet: options.quiet === true,
    verbosity: boundedVerbosity(options.verbosity),
  };
}

/** Configure parser-error diagnostics before Commander can run preAction. */
export function configureDiagnosticsFromArgv(argv: readonly string[]): void {
  let debug = false;
  let quiet = false;
  let verbosity = 0;
  const valueOptions = new Set([
    '--workspace',
    '--api-key',
    '--api-key-file',
    '--config',
    '-C',
    '--cwd',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') break;
    if (valueOptions.has(arg)) {
      index += 1;
      continue;
    }
    if (arg === '--debug') debug = true;
    else if (arg === '--quiet' || arg === '-q') quiet = true;
    else if (arg === '--verbose') verbosity += 1;
    else if (/^-[qv]+$/.test(arg)) {
      quiet ||= arg.includes('q');
      verbosity += [...arg].filter(character => character === 'v').length;
    }
  }

  configureDiagnostics({ debug, quiet, verbosity });
  bufferMachineDiagnostics = argv.some(
    (arg, index) =>
      arg === '--json' ||
      arg === '--output=json' ||
      arg === '-ojson' ||
      ((arg === '--output' || arg === '-o') && argv[index + 1] === 'json')
  );
}

export function resetDiagnostics(): void {
  state = { debug: false, quiet: false, verbosity: 0 };
  bufferMachineDiagnostics = false;
  diagnosticBuffer = [];
}

export function getDiagnosticState(): Readonly<DiagnosticState> {
  return { ...state };
}

function effectiveVerbosity(): Verbosity {
  if (state.debug) return 3;
  if (state.quiet) return 0;
  return state.verbosity;
}

export function diagnosticsEnabled(level: 1 | 2 | 3): boolean {
  return effectiveVerbosity() >= level;
}

function writeDiagnostic(line: string, data?: unknown): void {
  const rendered =
    data === undefined ? line : `${line} ${JSON.stringify(redactValue(data))}`;
  if (bufferMachineDiagnostics) {
    diagnosticBuffer.push(rendered);
  } else if (data === undefined) {
    console.error(line);
  } else {
    console.error(line, redactValue(data));
  }
}

export function flushDiagnosticBuffer(): void {
  if (diagnosticBuffer.length > 0) {
    process.stderr.write(`${diagnosticBuffer.join('\n')}\n`);
    diagnosticBuffer = [];
  }
}

export function takeDiagnosticBuffer(): string[] {
  const buffered = diagnosticBuffer;
  diagnosticBuffer = [];
  return buffered;
}

function emit(level: Verbosity, prefix: string, message: string, data?: unknown): void {
  if (effectiveVerbosity() < level) return;
  if (data === undefined) {
    writeDiagnostic(`${prefix} ${redactText(message)}`);
  } else {
    writeDiagnostic(`${prefix} ${redactText(message)}`, data);
  }
}

/** Compatibility setter for existing callers while the CLI uses configureDiagnostics. */
export function setLogLevel(level: LogLevel): void {
  if (level === 'quiet') configureDiagnostics({ quiet: true });
  else if (level === 'verbose') configureDiagnostics({ verbosity: 1 });
  else resetDiagnostics();
}

export function getLogLevel(): LogLevel {
  if (state.quiet && !state.debug) return 'quiet';
  return effectiveVerbosity() > 0 ? 'verbose' : 'normal';
}

export const logger = {
  /** Existing safe debug notes are level-one operation summaries. */
  debug(message: string, ...args: unknown[]): void {
    emit(1, '[verbose]', message, args.length > 0 ? args : undefined);
  },

  operation(message: string, data?: unknown): void {
    emit(1, '[verbose]', message, data);
  },

  request(input: RequestDiagnostic): void {
    if (effectiveVerbosity() < 2) return;
    const allowed: RequestDiagnostic = {
      method: input.method,
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
      ...(input.pageCount !== undefined ? { pageCount: input.pageCount } : {}),
    };
    const rendered = Object.entries(allowed)
      .map(([key, value]) => `${key}=${redactText(String(value))}`)
      .join(' ');
    writeDiagnostic(`[request] ${rendered}`);
  },

  internal(message: string, data?: unknown): void {
    emit(3, '[debug]', message, data);
  },

  info(message: string, ...args: unknown[]): void {
    if (!state.quiet || state.debug) {
      writeDiagnostic(redactText(message), args.length > 0 ? args : undefined);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    writeDiagnostic(`⚠️  ${redactText(message)}`, args.length > 0 ? args : undefined);
  },

  error(message: string, ...args: unknown[]): void {
    writeDiagnostic(`❌ ${redactText(message)}`, args.length > 0 ? args : undefined);
  },
};
