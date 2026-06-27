import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideGet } from './get.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

function seedGlobal(overrides: unknown[]): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ overrides }, null, 2));
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovget-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovget-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  process.chdir(workdir);
  resetInvocationContext();
  __resetGitContextCache();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(origCwd);
  resetInvocationContext();
  __resetGitContextCache();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('runOverrideGet', () => {
  it('prints a rule resolved by label', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideGet('t1', { global: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(JSON.parse(out)).toEqual({ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' });
  });

  it('resolves an unlabeled rule by #index', () => {
    seedGlobal([{ when: { branch: 'main' }, defaultTeam: 'core' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideGet('#0', { global: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(JSON.parse(out)).toEqual({ when: { branch: 'main' }, defaultTeam: 'core' });
  });

  it('--json emits a serialized record as a bare object (single-fetch convention)', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideGet('t1', { global: true, json: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(JSON.parse(out)).toEqual({
      label: 't1',
      index: 0,
      rule: { id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
    });
  });

  it('errors (exit 1) when the selector is not found in scope', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideGet('nope', { global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/not found/);
  });
});
