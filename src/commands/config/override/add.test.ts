import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readConfigForScope } from '../../../lib/config.js';
import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideAdd } from './add.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovadd-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovadd-cwd-'));
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

describe('runOverrideAdd', () => {
  it('appends a rule with id, when, and value to global scope', () => {
    runOverrideAdd('t1', { whenRepo: 'acme/web', set: ['defaultTeam=frontend'], global: true });
    const rules = readConfigForScope('global').overrides ?? [];
    expect(rules).toEqual([{ id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' }]);
  });

  it('appends a rule with a per-rule alias block (translated storage key)', () => {
    runOverrideAdd('web-aliases', {
      whenRepo: 'acme/web',
      alias: ['team.frontend=team_123'],
      project: true,
    });
    const rules = readConfigForScope('project').overrides ?? [];
    expect(rules).toEqual([
      { id: 'web-aliases', when: { repo: 'acme/web' }, aliases: { teams: { frontend: 'team_123' } } },
    ]);
  });

  it('hard-blocks a duplicate label in the same scope', () => {
    runOverrideAdd('t1', { whenRepo: 'acme/web', set: ['defaultTeam=frontend'], global: true });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideAdd('t1', { whenRepo: 'acme/mobile', set: ['defaultTeam=mobile'], global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/already exists/);
    // The first rule is untouched (no second rule appended).
    expect(readConfigForScope('global').overrides).toHaveLength(1);
  });

  it('rejects --set apiKey=… before writing', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideAdd('t1', { whenRepo: 'acme/web', set: ['apiKey=lin_api_x'], global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/cannot set "apiKey"/);
    expect(readConfigForScope('global').overrides ?? []).toHaveLength(0);
  });

  it('requires at least one match criterion', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideAdd('t1', { set: ['defaultTeam=frontend'], global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/at least one match criterion/);
  });

  it('requires at least one value', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideAdd('t1', { whenRepo: 'acme/web', global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/at least one value/);
  });

  it('rejects a label starting with "#"', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    runOverrideAdd('#0', { whenRepo: 'acme/web', set: ['defaultTeam=frontend'], global: true });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('--dry-run writes nothing', () => {
    runOverrideAdd('t1', {
      whenRepo: 'acme/web',
      set: ['defaultTeam=frontend'],
      global: true,
      dryRun: true,
    });
    expect(readConfigForScope('global').overrides ?? []).toHaveLength(0);
  });

  it('--json emits a rule record on write as a bare object (single-fetch convention)', () => {
    const log = vi.spyOn(console, 'log');
    runOverrideAdd('t1', {
      whenRepo: 'acme/web',
      set: ['defaultTeam=frontend'],
      global: true,
      json: true,
    });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({
      label: 't1',
      index: 0,
      rule: { id: 't1', when: { repo: 'acme/web' }, defaultTeam: 'frontend' },
    });
  });

  it('preserves a hand-written unlabeled rule when appending (no silent mutation)', () => {
    const cfgDir = join(xdgConfig, 'agent2linear');
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(
      join(cfgDir, 'config.json'),
      JSON.stringify({ overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] }, null, 2)
    );
    runOverrideAdd('t1', { whenRepo: 'acme/web', set: ['defaultTeam=frontend'], global: true });
    const rules = readConfigForScope('global').overrides ?? [];
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }); // untouched, still no id
    expect(rules[1].id).toBe('t1');
  });

  it('writes 2-space-indented JSON (matches writeConfigFile convention)', () => {
    runOverrideAdd('t1', { whenRepo: 'acme/web', set: ['defaultTeam=frontend'], global: true });
    const raw = readFileSync(join(xdgConfig, 'agent2linear', 'config.json'), 'utf-8');
    expect(raw).toContain('\n  "overrides"');
  });
});
