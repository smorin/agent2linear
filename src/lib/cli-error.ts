import { getDiagnosticState, takeDiagnosticBuffer } from './logger.js';
import { redactText, redactValue } from './redaction.js';
import { CLI_VERSION } from './version.js';

export type CliErrorCode =
  | 'runtime'
  | 'usage'
  | 'not_found'
  | 'auth'
  | 'conflict'
  | 'invalid_cursor';

export type CliExitCode = 1 | 2 | 3 | 4 | 5;

type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface CliErrorOptions {
  cause?: unknown;
  details?: unknown;
}

interface CliErrorDefinition {
  code: CliErrorCode;
  exitCode: CliExitCode;
}

function toSafeJson(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return String(value);
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(entry => toSafeJson(entry, seen));
  }

  const result: { [key: string]: JsonValue } = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = toSafeJson(entry, seen);
  }
  return result;
}

export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly details?: JsonValue;
  readonly exitCode: CliExitCode;

  constructor(message: string, definition: CliErrorDefinition, options: CliErrorOptions = {}) {
    super(redactText(message), options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = definition.code;
    this.exitCode = definition.exitCode;
    this.details =
      options.details === undefined
        ? undefined
        : (redactValue(toSafeJson(options.details)) as JsonValue);
  }
}

export class RuntimeError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'runtime', exitCode: 1 }, options);
  }
}

export class UsageError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'usage', exitCode: 2 }, options);
  }
}

export class NotFoundError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'not_found', exitCode: 3 }, options);
  }
}

export class AuthError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'auth', exitCode: 4 }, options);
  }
}

export class ConflictError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'conflict', exitCode: 5 }, options);
  }
}

export class InvalidCursorError extends CliError {
  constructor(message: string, options?: CliErrorOptions) {
    super(message, { code: 'invalid_cursor', exitCode: 5 }, options);
  }
}

interface ErrorSignals {
  messages: string[];
  statuses: number[];
  codes: string[];
}

function collectErrorSignals(
  value: unknown,
  signals: ErrorSignals = { messages: [], statuses: [], codes: [] },
  seen = new WeakSet<object>(),
  depth = 0
): ErrorSignals {
  if (depth > 5 || value === null || typeof value !== 'object') return signals;
  if (seen.has(value)) return signals;
  seen.add(value);

  const record = value as Record<string, unknown>;
  if (typeof record.message === 'string') signals.messages.push(record.message);
  if (typeof record.status === 'number') signals.statuses.push(record.status);
  if (typeof record.statusCode === 'number') signals.statuses.push(record.statusCode);
  if (typeof record.code === 'string') signals.codes.push(record.code);

  for (const key of ['cause', 'response', 'data', 'extensions', 'errors', 'graphQLErrors']) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      nested.forEach(entry => collectErrorSignals(entry, signals, seen, depth + 1));
    } else {
      collectErrorSignals(nested, signals, seen, depth + 1);
    }
  }
  return signals;
}

function classifyProviderError(error: unknown): CliError | null {
  const signals = collectErrorSignals(error);
  const message = signals.messages.join(' | ');
  const upperCodes = signals.codes.map(code => code.toUpperCase());

  if (
    signals.statuses.some(status => status === 401 || status === 403) ||
    upperCodes.some(code => code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') ||
    /(?:authentication|unauthori[sz]ed|permission denied|forbidden|linear api key (?:not found|invalid)|invalid linear api key)/i.test(
      message
    )
  ) {
    return new AuthError(message || 'Linear authentication or authorization failed', {
      cause: error,
    });
  }

  if (
    /cursor.{0,120}(?:invalid|expired|malformed|stale|rejected|not found|does not exist)|(?:invalid|expired|malformed|stale|rejected).{0,120}cursor/i.test(
      message
    )
  ) {
    return new InvalidCursorError('Linear rejected the supplied cursor.', {
      cause: error,
    });
  }

  return null;
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof AuthError || classifyProviderError(error)?.code === 'auth';
}

export function normalizeCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('commander.')
  ) {
    return new UsageError(error.message.replace(/^error:\s*/i, ''), { cause: error });
  }

  const providerError = classifyProviderError(error);
  if (providerError) return providerError;

  if (error instanceof Error) {
    return new RuntimeError(error.message, { cause: error });
  }

  return new RuntimeError(String(error));
}

export function inferErrorOutputMode(argv: readonly string[]): ErrorOutputMode {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') return 'json';
    if (value === '--output' || value === '-o') {
      if (argv[index + 1] === 'json') return 'json';
      continue;
    }
    if (value === '--output=json' || value === '-ojson') return 'json';
  }
  return 'table';
}

export type ErrorOutputMode = 'table' | 'json' | 'tsv';

export function renderCliError(error: unknown, mode: ErrorOutputMode): CliError {
  const normalized = normalizeCliError(error);
  const bufferedDiagnostics = takeDiagnosticBuffer();
  const debug = getDiagnosticState().debug
    ? {
        stack: redactText(
          (error instanceof Error ? error.stack : undefined) ?? normalized.stack ?? normalized.message
        ),
        context: {
          cli: 'agent2linear',
          version: CLI_VERSION,
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      }
    : undefined;

  if (mode === 'json') {
    const envelope: {
      error: {
        code: CliErrorCode;
        debug?: JsonValue;
        details?: JsonValue;
        diagnostics?: JsonValue;
        message: string;
      };
    } = {
      error: {
        code: normalized.code,
        message: normalized.message,
      },
    };
    if (normalized.details !== undefined) {
      envelope.error.details = normalized.details;
    }
    if (bufferedDiagnostics.length > 0) {
      envelope.error.diagnostics = bufferedDiagnostics;
    }
    if (debug !== undefined) {
      envelope.error.debug = redactValue(debug) as JsonValue;
    }
    process.stderr.write(`${JSON.stringify(envelope)}\n`);
  } else {
    const debugText =
      debug === undefined
        ? ''
        : `debug: agent2linear ${CLI_VERSION} · ${process.version} · ${process.platform}/${process.arch}\n${debug.stack}\n`;
    process.stderr.write(`error: ${normalized.message}\n${debugText}`);
  }

  return normalized;
}
