import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readConfigForScope } from '../../../lib/config.js';
import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideRemove } from './remove.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

function seedGlobal(overrides: unknown[]): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ overrides }, null, 2));
}

function globalRules() {
  return readConfigForScope('global').overrides ?? [];
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovrm-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovrm-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
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

describe('runOverrideRemove', () => {
  it('removes a rule by label, leaving the others', () => {
    seedGlobal([
      { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
      { id: 'b', when: { branch: 'main' }, defaultTeam: 'core' },
    ]);
    runOverrideRemove('a', { global: true });
    expect(globalRules()).toEqual([{ id: 'b', when: { branch: 'main' }, defaultTeam: 'core' }]);
  });

  it('removes an unlabeled rule by #index', () => {
    seedGlobal([
      { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
      { when: { branch: 'main' }, defaultTeam: 'core' },
    ]);
    runOverrideRemove('#1', { global: true });
    expect(globalRules()).toEqual([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
  });

  it('errors (exit 1) when the selector is not found in scope', () => {
    seedGlobal([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideRemove('nope', { global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/not found/);
    expect(globalRules()).toHaveLength(1);
  });

  it('--json emits the removed rule record as a bare object', () => {
    seedGlobal([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideRemove('a', { global: true, json: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(JSON.parse(out)).toEqual({
      label: 'a',
      index: 0,
      rule: { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
    });
    expect(globalRules()).toHaveLength(0);
  });
});
