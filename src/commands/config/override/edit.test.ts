import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readConfigForScope } from '../../../lib/config.js';
import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideEdit } from './edit.js';

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

function expectExit(fn: () => void) {
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  const err = vi.spyOn(console, 'error');
  fn();
  return { exit, err };
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovedit-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovedit-cwd-'));
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

describe('runOverrideEdit', () => {
  it('overwrites a value field with --set, preserving the rest', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend', defaultProject: 'q3' }]);
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true });
    expect(globalRules()).toEqual([
      { id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'mobile', defaultProject: 'q3' },
    ]);
  });

  it('deletes a field with --unset, preserving the rest', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend', defaultProject: 'q3' }]);
    runOverrideEdit('t1', { unset: ['defaultProject'], global: true });
    expect(globalRules()).toEqual([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
  });

  it('rejects --unset of a non-whitelisted key', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() => runOverrideEdit('t1', { unset: ['apiKey'], global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/cannot unset "apiKey"/);
    expect(globalRules()).toHaveLength(1);
  });

  it('rejects --set apiKey on the edit path (structural guard)', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() =>
      runOverrideEdit('t1', { set: ['apiKey=lin_api_x'], global: true })
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/cannot set "apiKey"/);
    expect(globalRules()[0]).toEqual({ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' });
  });

  it('merges a per-rule alias, preserving existing aliases', () => {
    seedGlobal([
      { id: 't1', when: { repo: 'acme/web' }, aliases: { teams: { frontend: 'team_1' } } },
    ]);
    runOverrideEdit('t1', { alias: ['team.backend=team_2'], global: true });
    expect(globalRules()[0].aliases).toEqual({ teams: { frontend: 'team_1', backend: 'team_2' } });
  });

  it('removes a per-rule alias with --rm-alias, dropping an emptied sub-object', () => {
    seedGlobal([
      {
        id: 't1',
        when: { repo: 'acme/web' },
        defaultTeam: 'frontend',
        aliases: { teams: { frontend: 'team_1' } },
      },
    ]);
    runOverrideEdit('t1', { rmAlias: ['team.frontend'], global: true });
    // The emptied teams sub-object and the whole aliases block are dropped.
    expect(globalRules()[0]).toEqual({ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' });
  });

  it('rejects --rm-alias of an absent alias', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() =>
      runOverrideEdit('t1', { rmAlias: ['team.nope'], global: true })
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/not found on this rule/);
  });

  it('replaces the entire `when` wholesale from --when-json', () => {
    seedGlobal([
      { id: 't1', when: { anyOf: [{ repo: 'acme/web' }, { repo: 'acme/api' }] }, defaultTeam: 'frontend' },
    ]);
    runOverrideEdit('t1', { whenJson: '{"branch":"main"}', global: true });
    expect(globalRules()[0].when).toEqual({ branch: 'main' });
  });

  it('replaces the entire `when` wholesale from flag-sugar', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    runOverrideEdit('t1', { whenBranch: 'release/*,main', global: true });
    expect(globalRules()[0].when).toEqual({ anyOf: [{ branch: 'release/*' }, { branch: 'main' }] });
  });

  it('leaves `when` untouched when no when-input is given', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true });
    expect(globalRules()[0].when).toEqual({ repo: 'acme/web' });
  });

  it('rejects --when-json combined with a --when-* flag', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() =>
      runOverrideEdit('t1', { whenJson: '{"branch":"main"}', whenRepo: 'acme/api', global: true })
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/--when-json cannot be combined/);
  });

  it('assigns a label to a #<index> legacy rule, making it addressable', () => {
    seedGlobal([{ when: { branch: 'main' }, defaultTeam: 'core' }]);
    runOverrideEdit('#0', { id: 'mainline', global: true });
    expect(globalRules()).toEqual([{ id: 'mainline', when: { branch: 'main' }, defaultTeam: 'core' }]);
    // Now addressable by the new label.
    runOverrideEdit('mainline', { set: ['defaultTeam=ship'], global: true });
    expect(globalRules()[0].defaultTeam).toBe('ship');
  });

  it('rejects --id that collides with another rule in scope', () => {
    seedGlobal([
      { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
      { when: { branch: 'main' }, defaultTeam: 'core' },
    ]);
    const { exit, err } = expectExit(() => runOverrideEdit('#1', { id: 'a', global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/already exists/);
  });

  it('rejects --id collisions when hand-edited overrides contain null slots', () => {
    seedGlobal([
      { when: { branch: 'main' }, defaultTeam: 'core' },
      null,
      { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
    ]);
    const { exit, err } = expectExit(() => runOverrideEdit('#0', { id: 'a', global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/already exists/);
    expect(globalRules()[0]).toEqual({ when: { branch: 'main' }, defaultTeam: 'core' });
  });

  it('allows --id equal to the rule own label (no-op rename, not a collision)', () => {
    seedGlobal([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    runOverrideEdit('a', { id: 'a', set: ['defaultTeam=mobile'], global: true });
    expect(globalRules()).toEqual([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'mobile' }]);
  });

  it('rejects renaming an already-labeled rule (label is fixed at add — non-goal)', () => {
    seedGlobal([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() => runOverrideEdit('a', { id: 'b', global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/renaming a labeled rule is not supported/);
    expect(globalRules()[0].id).toBe('a');
  });

  it('rejects an --id starting with "#"', () => {
    seedGlobal([{ id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit } = expectExit(() => runOverrideEdit('a', { id: '#0', global: true }));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('rejects an empty edit (nothing to change)', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() => runOverrideEdit('t1', { global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/nothing to edit/);
  });

  it('rejects unsetting the last value (a rule must keep ≥1 value)', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() =>
      runOverrideEdit('t1', { unset: ['defaultTeam'], global: true })
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/at least one value/);
    expect(globalRules()[0]).toEqual({ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' });
  });

  it('errors (exit 1) when the selector is not found in scope', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const { exit, err } = expectExit(() => runOverrideEdit('nope', { set: ['defaultTeam=x'], global: true }));
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/not found/);
  });

  it('--dry-run writes nothing', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true, dryRun: true });
    expect(globalRules()[0].defaultTeam).toBe('frontend');
  });

  it('[RLS-SAFE-DRYRUN] emits a self-identifying JSON plan without writing', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideEdit('t1', {
      set: ['defaultTeam=mobile'],
      global: true,
      dryRun: true,
      json: true,
    });

    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      dryRun: true,
      operation: 'config.override.edit',
      scope: 'global',
      override: {
        label: 't1',
        index: 0,
        rule: { id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'mobile' },
      },
      validation: { localWrite: false },
    });
    expect(globalRules()[0].defaultTeam).toBe('frontend');
  });

  it('--dry-run human output redacts hand-edited secret-named keys', () => {
    seedGlobal([
      {
        id: 't1',
        when: { repo: 'acme/web' },
        defaultTeam: 'frontend',
        apiKey: 'lin_api_SECRET',
        token: 'tok_SECRET',
      },
    ]);
    const log = vi.spyOn(console, 'log');
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true, dryRun: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).not.toContain('lin_api_SECRET');
    expect(out).not.toContain('tok_SECRET');
    expect(out).toContain('"apiKey": "***"');
    expect(out).toContain('"token": "***"');
    expect(globalRules()[0].defaultTeam).toBe('frontend');
  });

  it('human success output redacts hand-edited secret-named keys without mutating them', () => {
    seedGlobal([
      {
        id: 't1',
        when: { repo: 'acme/web' },
        defaultTeam: 'frontend',
        apiKey: 'lin_api_SECRET',
        token: 'tok_SECRET',
      },
    ]);
    const log = vi.spyOn(console, 'log');
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).not.toContain('lin_api_SECRET');
    expect(out).not.toContain('tok_SECRET');
    expect(out).toContain('"apiKey": "***"');
    expect(out).toContain('"token": "***"');
    expect(globalRules()[0]).toEqual({
      id: 't1',
      when: { repo: 'acme/web' },
      defaultTeam: 'mobile',
      apiKey: 'lin_api_SECRET',
      token: 'tok_SECRET',
    });
  });

  it('--json emits the updated rule record as a bare object', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    const log = vi.spyOn(console, 'log');
    runOverrideEdit('t1', { set: ['defaultTeam=mobile'], global: true, json: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(JSON.parse(out)).toEqual({
      label: 't1',
      index: 0,
      rule: { id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'mobile' },
    });
  });

  it('leaves the array untouched when a merge fails (clone isolation)', () => {
    seedGlobal([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
    expectExit(() => runOverrideEdit('t1', { set: ['defaultTeam=mobile', 'apiKey=x'], global: true }));
    // The good --set in the same batch must not have leaked to disk.
    expect(globalRules()[0].defaultTeam).toBe('frontend');
  });
});
