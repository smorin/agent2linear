import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseApiKeyInput,
  readApiKeyFile,
  rejectUnsafeCredentialArgv,
} from './api-key-input.js';
import { RuntimeError, UsageError } from './cli-error.js';

describe('parseApiKeyInput', () => {
  it.each([
    ['lin_api_key', 'lin_api_key'],
    ['lin_api_key\n', 'lin_api_key'],
    ['lin_api_key\r\n', 'lin_api_key'],
    ['  lin_api_key  \n\n  \n', 'lin_api_key'],
  ])('accepts exactly one nonempty logical line: %j', (source, expected) => {
    expect(parseApiKeyInput(source)).toBe(expected);
  });

  it.each(['', '   ', '\n', 'first\nsecond', 'first\r\nsecond\r\n']) (
    'rejects empty or multiple nonempty logical lines: %j',
    source => {
      expect(() => parseApiKeyInput(source)).toThrow(UsageError);
    }
  );
});

describe('rejectUnsafeCredentialArgv', () => {
  it.each([
    ['--api-key', 'lin_api_secret', '--help'],
    ['--api-key=lin_api_secret', '--version'],
  ])('rejects the removed literal-key option before parser short-circuits: %j', (...argv) => {
    expect(() => rejectUnsafeCredentialArgv(argv)).toThrow(/Legacy --api-key <key> has been removed/);
  });

  it.each([
    ['config', 'set', 'apiKey', 'lin_api_secret', '--help'],
    ['cfg', 'set', 'apiKey', 'lin_api_secret'],
    ['config', 'set', '--global', 'apiKey', 'lin_api_secret', '--help'],
    ['cfg', 'set', '--project', 'apiKey', 'lin_api_secret', '--version'],
    ['config', 'set', '--quiet', 'apiKey', 'lin_api_secret', '--help'],
    ['config', 'set', '--no-color', 'apiKey', 'lin_api_secret', '--help'],
    ['config', 'set', '-C', '/tmp', 'apiKey', 'lin_api_secret', '--help'],
    ['cfg', 'set', '-v', 'apiKey', 'lin_api_secret', '--version'],
    ['config', 'edit', '--key', 'apiKey', '--value', 'lin_api_secret', '--help'],
    ['config', 'edit', '--value=lin_api_secret', '--key=apiKey'],
  ])('rejects config secret values before parser short-circuits: %j', (...argv) => {
    expect(() => rejectUnsafeCredentialArgv(argv)).toThrow(/exposes an API key in argv/);
  });

  it.each([
    ['--api-key-file', 'linear.key', '--help'],
    ['--config', 'config', 'issue', 'list'],
    ['issue', 'create', '--title', 'config', '--team', 'set', '--assignee', 'apiKey', '--description', 'foo'],
    ['config', 'explain', '--key', 'set', '--value', 'apiKey'],
    ['config', 'explain', '--key', 'edit', '--value', 'apiKey'],
    ['config', 'set', 'defaultTeam', 'team-id'],
    ['config', 'set', '--global', 'defaultTeam', 'team-id'],
    ['config', 'set', '-C', '/tmp', 'defaultTeam', 'team-id'],
    ['config', 'set', 'apiKey', '--help'],
    ['config', 'edit', '--key', 'apiKey', '--help'],
  ])('does not reject safe or valueless argv: %j', (...argv) => {
    expect(() => rejectUnsafeCredentialArgv(argv)).not.toThrow();
  });
});

describe('readApiKeyFile', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'a2l-api-key-input-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads and parses a regular file', async () => {
    const path = join(root, 'key.txt');
    writeFileSync(path, ' lin_api_from_file \n', 'utf8');

    await expect(readApiKeyFile(path)).resolves.toBe('lin_api_from_file');
  });

  it('uses the injected stdin reader for -', async () => {
    const readStdin = vi.fn().mockResolvedValue('lin_api_from_stdin\n');

    await expect(readApiKeyFile('-', readStdin)).resolves.toBe('lin_api_from_stdin');
    expect(readStdin).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing', (path: string) => path],
    [
      'directory',
      (path: string) => {
        mkdirSync(path);
        return path;
      },
    ],
    [
      'unreadable',
      (path: string) => {
        writeFileSync(path, 'lin_api_key', 'utf8');
        chmodSync(path, 0o000);
        return path;
      },
    ],
  ])('maps a %s path to a path-specific runtime error', async (_case, arrange) => {
    const path = arrange(join(root, 'key.txt'));

    await expect(readApiKeyFile(path)).rejects.toBeInstanceOf(RuntimeError);
    await expect(readApiKeyFile(path)).rejects.toThrow(path);
  });
});
