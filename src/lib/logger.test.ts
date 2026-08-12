import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  configureDiagnostics,
  configureDiagnosticsFromArgv,
  getDiagnosticState,
  logger,
  resetDiagnostics,
} from './logger.js';
import { registerSecret, resetRegisteredSecrets } from './redaction.js';

afterEach(() => {
  resetDiagnostics();
  resetRegisteredSecrets();
  vi.restoreAllMocks();
});

function capture() {
  const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
  const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
  return { stderr, stdout };
}

describe('diagnostic ladder', () => {
  it('parses repeatable verbosity and precedence independent of flag order', () => {
    configureDiagnosticsFromArgv(['--quiet', '-vvv']);
    expect(getDiagnosticState()).toEqual({ debug: false, quiet: true, verbosity: 3 });

    configureDiagnosticsFromArgv(['-vvvv', '--quiet', '--debug']);
    expect(getDiagnosticState()).toEqual({ debug: true, quiet: true, verbosity: 3 });

    configureDiagnosticsFromArgv(['--config', '--debug', '-vv']);
    expect(getDiagnosticState()).toEqual({ debug: false, quiet: false, verbosity: 2 });
  });

  it.each([
    [1, ['operation']],
    [2, ['operation', 'request']],
    [3, ['operation', 'request', 'internal']],
  ] as const)('verbosity %i emits only its level and lower', (verbosity, expected) => {
    const { stderr, stdout } = capture();
    configureDiagnostics({ verbosity });

    logger.operation('operation');
    logger.request({ method: 'POST', status: 200, latencyMs: 12, pageCount: 2 });
    logger.internal('internal');

    const rendered = stderr.mock.calls.flat().join(' ');
    for (const value of expected) expect(rendered).toContain(value);
    for (const value of ['operation', 'request', 'internal'].filter(v => !expected.includes(v as never))) {
      expect(rendered).not.toContain(value);
    }
    expect(stdout).not.toHaveBeenCalled();
  });

  it('quiet wins over repeated verbose, while explicit debug wins over quiet', () => {
    const { stderr } = capture();
    configureDiagnostics({ quiet: true, verbosity: 3 });
    logger.operation('hidden-operation');
    logger.request({ method: 'POST' });
    logger.internal('hidden-internal');
    expect(stderr).not.toHaveBeenCalled();

    configureDiagnostics({ debug: true, quiet: true, verbosity: 0 });
    logger.operation('debug-operation');
    logger.request({ method: 'POST' });
    logger.internal('debug-internal');
    expect(stderr.mock.calls.flat().join(' ')).toContain('debug-internal');
  });

  it('warn and error remain visible under quiet', () => {
    const { stderr } = capture();
    configureDiagnostics({ quiet: true, verbosity: 3 });

    logger.warn('warning');
    logger.error('failure');

    expect(stderr.mock.calls.flat().join(' ')).toContain('warning');
    expect(stderr.mock.calls.flat().join(' ')).toContain('failure');
  });

  it('request diagnostics allowlist metadata and redact registered credentials', () => {
    const { stderr } = capture();
    configureDiagnostics({ verbosity: 2 });
    registerSecret('opaque-request-secret');

    logger.request({
      method: 'POST opaque-request-secret',
      requestId: 'req-1',
      status: 200,
      latencyMs: 12,
      pageCount: 2,
      headers: { authorization: 'opaque-request-secret' },
      body: 'opaque-request-secret',
      variables: { token: 'opaque-request-secret' },
    } as never);

    const rendered = stderr.mock.calls.flat().join(' ');
    expect(rendered).toContain('[REDACTED]');
    expect(rendered).toContain('requestId=req-1');
    expect(rendered).not.toContain('opaque-request-secret');
    expect(rendered).not.toContain('headers');
    expect(rendered).not.toContain('body');
    expect(rendered).not.toContain('variables');
  });
});
