import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addAlias, getGlobalAliasesPath, loadAliases, resolveAlias } from './aliases.js';
import { resetInvocationContext, setInvocationContext } from './invocation-context.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-alias-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('aliases.ts global path honors XDG', () => {
  it('writes global aliases under $XDG_CONFIG_HOME', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    const expected = join(tmp, 'agent2linear', 'aliases.json');
    // Assert the resolved path BEFORE any write. At RED (pre-migration) this
    // assertion fails and aborts the test before addAlias() could write to the
    // user's real ~/.config/agent2linear/aliases.json (the unmigrated global path
    // is an absolute module-level constant that env stubbing cannot redirect).
    expect(getGlobalAliasesPath()).toBe(expected);
    const res = await addAlias('team', 'backend', 'team_123', 'global', { skipValidation: true });
    expect(res.success).toBe(true);
    expect(existsSync(expected)).toBe(true);
  });
});

describe('loadAliases / resolveAlias — per-rule override overlay (M29 U6)', () => {
  let xdg: string;
  let work: string;
  const origCwd = process.cwd();

  beforeEach(() => {
    xdg = mkdtempSync(join(tmpdir(), 'a2l-ovl-xdg-'));
    work = mkdtempSync(join(tmpdir(), 'a2l-ovl-work-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    process.chdir(work);
    resetInvocationContext();
  });

  afterEach(() => {
    process.chdir(origCwd);
    resetInvocationContext();
    vi.unstubAllEnvs();
    rmSync(xdg, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  it('overlays override > project > global and labels it `override`', async () => {
    await addAlias('team', 'default', 'team_global', 'global', { skipValidation: true });
    await addAlias('team', 'default', 'team_project', 'project', { skipValidation: true });

    // Baseline (no overlay): project beats global.
    expect(resolveAlias('team', 'default')).toBe('team_project');
    expect(loadAliases().locations.team.default.type).toBe('project');

    // With the override overlay stashed: it wins, and is labeled `override`.
    setInvocationContext({ overrideAliases: { teams: { default: 'team_override' } } });
    expect(resolveAlias('team', 'default')).toBe('team_override');
    expect(loadAliases().locations.team.default.type).toBe('override');
  });

  it('no overlay ⇒ today’s behavior (drop-in)', async () => {
    await addAlias('team', 'backend', 'team_b', 'global', { skipValidation: true });
    expect(resolveAlias('team', 'backend')).toBe('team_b');
    expect(loadAliases().locations.team.backend.type).toBe('global');
  });

  it('introduces an override-only alias absent from project/global', () => {
    setInvocationContext({ overrideAliases: { initiatives: { q: 'init_q' } } });
    expect(resolveAlias('initiative', 'q')).toBe('init_q');
    expect(loadAliases().locations.initiative.q.type).toBe('override');
  });
});
