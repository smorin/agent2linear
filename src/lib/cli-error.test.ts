import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AuthError,
  CliError,
  ConflictError,
  InvalidCursorError,
  normalizeCliError,
  NotFoundError,
  renderCliError,
  RuntimeError,
  UsageError,
} from './cli-error.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('typed CLI errors', () => {
  it('[CPH-OUT-EXIT-1] represents a runtime failure', () => {
    const error = new RuntimeError('request failed');
    expect(error).toBeInstanceOf(CliError);
    expect(error).toMatchObject({ code: 'runtime', exitCode: 1, message: 'request failed' });
  });

  it('[CPH-OUT-EXIT-2] represents a usage failure', () => {
    expect(new UsageError('bad limit')).toMatchObject({ code: 'usage', exitCode: 2 });
  });

  it('[CPH-OUT-EXIT-3] represents a missing resource', () => {
    expect(new NotFoundError('entry missing')).toMatchObject({ code: 'not_found', exitCode: 3 });
  });

  it('[CPH-OUT-EXIT-4] represents an authentication or authorization failure', () => {
    expect(new AuthError('authentication required')).toMatchObject({ code: 'auth', exitCode: 4 });
  });

  it('[CPH-OUT-EXIT-5] represents conflict and invalid-cursor failures', () => {
    expect(new ConflictError('state changed')).toMatchObject({ code: 'conflict', exitCode: 5 });
    expect(new InvalidCursorError('cursor rejected')).toMatchObject({
      code: 'invalid_cursor',
      exitCode: 5,
    });
  });

  it('[CPH-OUT-ERROR-JSON] retains structured details without exposing an Error stack', () => {
    const cause = new Error('provider detail');
    const error = new InvalidCursorError('cursor rejected', {
      details: { cursor: 'opaque', cause },
    });

    expect(error.details).toEqual({
      cursor: 'opaque',
      cause: { name: 'Error', message: 'provider detail' },
    });
    expect(JSON.stringify(error.details)).not.toContain('stack');
  });
});

describe('normalizeCliError', () => {
  it('[CPH-OUT-EXIT-4] classifies provider authentication failures', () => {
    expect(
      normalizeCliError({
        response: { status: 401 },
        message: 'request rejected',
      })
    ).toMatchObject({ code: 'auth', exitCode: 4 });
    expect(normalizeCliError(new Error('Linear API key not found'))).toMatchObject({
      code: 'auth',
      exitCode: 4,
    });
  });

  it('[CPH-PAG-INVALID-BACKEND] classifies rejected cursors without restarting', () => {
    expect(
      normalizeCliError({
        graphQLErrors: [
          {
            message: 'The supplied cursor is expired',
            extensions: { code: 'BAD_USER_INPUT' },
          },
        ],
      })
    ).toMatchObject({
      code: 'invalid_cursor',
      exitCode: 5,
      message: 'Linear rejected the supplied cursor.',
    });
  });

  it('[CPH-OUT-EXIT-1] preserves typed errors', () => {
    const original = new UsageError('bad input');
    expect(normalizeCliError(original)).toBe(original);
  });

  it('[CPH-OUT-EXIT-1] converts Error and non-Error failures to runtime errors', () => {
    expect(normalizeCliError(new Error('network down'))).toMatchObject({
      code: 'runtime',
      exitCode: 1,
      message: 'network down',
    });
    expect(normalizeCliError('unknown failure')).toMatchObject({
      code: 'runtime',
      exitCode: 1,
      message: 'unknown failure',
    });
  });
});

describe('renderCliError', () => {
  it('[CPH-OUT-ERROR-JSON] writes one structured JSON document to stderr only', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const error = new InvalidCursorError('cursor rejected', {
      details: { cursor: 'opaque' },
    });

    renderCliError(error, 'json');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();
    const rendered = String(stderr.mock.calls[0][0]);
    expect(rendered.endsWith('\n')).toBe(true);
    expect(JSON.parse(rendered)).toEqual({
      error: {
        code: 'invalid_cursor',
        message: 'cursor rejected',
        details: { cursor: 'opaque' },
      },
    });
  });

  it('[CPH-OUT-DIAGNOSTICS] writes one human diagnostic to stderr only', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    renderCliError(new UsageError('limit must be an integer'), 'table');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();
    expect(stderr).toHaveBeenCalledWith('error: limit must be an integer\n');
  });

  it('[CPH-OUT-DIAGNOSTICS] treats TSV failures as human diagnostics', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    renderCliError(new RuntimeError('request failed'), 'tsv');

    expect(stderr).toHaveBeenCalledOnce();
    expect(stderr).toHaveBeenCalledWith('error: request failed\n');
  });
});
