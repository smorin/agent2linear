import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideList } from './list.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

function seedGlobal(overrides: unknown[]): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ overrides }, null, 2));
}

function seedProject(overrides: unknown[]): void {
  const dir = join(workdir, '.agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ overrides }, null, 2));
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovlist-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovlist-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  process.chdir(workdir);
  resetInvocationContext();
  __resetGitContextCache();
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

describe('runOverrideList', () => {
  it('lists both scopes when no scope flag is given', () => {
    seedGlobal([{ id: 'g1', when: { owner: 'acme' }, defaultTeam: 'core' }]);
    seedProject([{ id: 'p1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    runOverrideList({});
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('global overrides:');
    expect(out).toContain('project overrides:');
    expect(out).toContain('g1');
    expect(out).toContain('p1');
  });

  it('lists a single scope when filtered', () => {
    seedGlobal([{ id: 'g1', when: { owner: 'acme' }, defaultTeam: 'core' }]);
    seedProject([{ id: 'p1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    runOverrideList({ project: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('p1');
    expect(out).not.toContain('g1');
  });

  it('shows the static specificity tag and an #index for an unlabeled rule', () => {
    seedGlobal([{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    runOverrideList({ global: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('#0 [path]');
    expect(out).toContain('cli-team');
  });

  it('--json emits records with scope, label, index, and tag', () => {
    seedGlobal([{ id: 'g1', when: { owner: 'acme' }, defaultTeam: 'core' }]);
    seedProject([{ when: { branch: 'main' }, defaultTeam: 'rel' }]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    runOverrideList({ json: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    const records = JSON.parse(out);
    expect(records).toEqual([
      {
        scope: 'global',
        label: 'g1',
        index: 0,
        rule: { id: 'g1', when: { owner: 'acme' }, defaultTeam: 'core' },
        tag: 'owner',
      },
      {
        scope: 'project',
        label: '#0',
        index: 0,
        rule: { when: { branch: 'main' }, defaultTeam: 'rel' },
        tag: 'branch',
      },
    ]);
  });

  it('handles empty scopes', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    runOverrideList({});
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('(none)');
  });
});
