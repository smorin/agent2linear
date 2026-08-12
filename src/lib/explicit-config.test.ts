import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeError } from './cli-error.js';
import { isExplicitConfigMutationCommand, loadExplicitConfig } from './explicit-config.js';

describe('loadExplicitConfig', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'a2l-explicit-config-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loads a regular readable JSON file and preserves its absolute path', () => {
    const path = join(root, 'selected.json');
    writeFileSync(path, JSON.stringify({ defaultTeam: 'explicit-team' }), 'utf8');

    expect(loadExplicitConfig(path)).toEqual({
      path,
      value: { defaultTeam: 'explicit-team' },
    });
  });

  it.each([
    ['missing', (path: string) => path],
    [
      'not a regular file',
      (path: string) => {
        mkdirSync(path);
        return path;
      },
    ],
    [
      'malformed JSON',
      (path: string) => {
        writeFileSync(path, '{not-json', 'utf8');
        return path;
      },
    ],
    [
      'unreadable',
      (path: string) => {
        writeFileSync(path, '{}', 'utf8');
        chmodSync(path, 0o000);
        return path;
      },
    ],
  ])('rejects a %s explicit config with a path-specific runtime error', (_case, arrange) => {
    const path = arrange(join(root, 'selected.json'));

    expect(() => loadExplicitConfig(path)).toThrow(RuntimeError);
    expect(() => loadExplicitConfig(path)).toThrow(path);
  });
});

describe('isExplicitConfigMutationCommand', () => {
  it.each([
    ['config', 'set'],
    ['config', 'unset'],
    ['config', 'edit'],
    ['config', 'override', 'add'],
    ['config', 'override', 'edit'],
    ['config', 'override', 'remove'],
    ['config', 'override', 'move'],
    ['profile', 'add'],
    ['profile', 'edit'],
    ['profile', 'remove'],
    ['profile', 'exclude'],
    ['profile', 'match', 'add'],
    ['profile', 'match', 'remove'],
    ['workspace', 'add'],
    ['workspace', 'remove'],
    ['teams', 'set'],
    ['teams', 'select'],
    ['initiatives', 'set'],
    ['initiatives', 'select'],
    ['setup'],
  ])('classifies %s as a configuration-store mutation', (...commandPath) => {
    expect(isExplicitConfigMutationCommand(commandPath)).toBe(true);
  });

  it.each([
    ['config'],
    ['config', 'list'],
    ['config', 'get'],
    ['config', 'explain'],
    ['config', 'override'],
    ['config', 'override', 'list'],
    ['config', 'override', 'get'],
    ['profile'],
    ['profile', 'list'],
    ['profile', 'match'],
    ['profile', 'match', 'list'],
    ['workspace'],
    ['workspace', 'list'],
    ['workspace', 'current'],
    ['teams', 'list'],
    ['initiatives', 'list'],
    ['issue', 'list'],
  ])('does not classify read-only or unrelated %s as a mutation', (...commandPath) => {
    expect(isExplicitConfigMutationCommand(commandPath)).toBe(false);
  });
});
