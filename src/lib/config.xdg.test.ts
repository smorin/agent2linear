import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, getGlobalConfigPath, setConfigValue } from './config.js';
import { resetInvocationContext } from './invocation-context.js';
import type { Config } from './types.js';

let tmp: string;
const origCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-cfg-'));
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('config.ts global path honors XDG', () => {
  it('writes global config under $XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    setConfigValue('defaultTeam', 'team_123', 'global');
    const expected = join(tmp, 'agent2linear', 'config.json');
    expect(getGlobalConfigPath()).toBe(expected);
    expect(existsSync(expected)).toBe(true);
    expect(JSON.parse(readFileSync(expected, 'utf-8')).defaultTeam).toBe('team_123');
  });
});

describe('config.ts project path uses cwd when no ancestor is found', () => {
  it('writes project config to <cwd>/.agent2linear', () => {
    process.chdir(tmp);
    setConfigValue('defaultTeam', 'team_p', 'project');
    expect(existsSync(join(tmp, '.agent2linear', 'config.json'))).toBe(true);
  });
});

describe('getConfig() - profile-aware merge (global < profile < repo)', () => {
  let xdgConfig: string;
  let workdir: string;

  beforeEach(() => {
    xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-cfgm-xdg-'));
    workdir = mkdtempSync(join(tmpdir(), 'a2l-cfgm-cwd-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
    process.chdir(workdir);
    resetInvocationContext();
  });

  afterEach(() => {
    process.chdir(origCwd);
    resetInvocationContext();
    rmSync(xdgConfig, { recursive: true, force: true });
    rmSync(workdir, { recursive: true, force: true });
  });

  function writeGlobalConfig(config: Partial<Config>): void {
    const dir = join(xdgConfig, 'agent2linear');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
  }

  function writeProjectConfig(config: Partial<Config>): void {
    const dir = join(workdir, '.agent2linear');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
  }

  it('resolves precedence global < profile < repo for an overridden key', () => {
    writeGlobalConfig({
      defaultProfile: 'acme',
      defaultTeam: 'global-team',
      defaultInitiative: 'global-init',
      profiles: {
        acme: { workspace: 'acme', defaultTeam: 'profile-team', defaultInitiative: 'profile-init' },
      },
    });
    writeProjectConfig({ defaultTeam: 'repo-team' });

    const config = getConfig();
    // repo wins over profile wins over global
    expect(config.defaultTeam).toBe('repo-team');
    expect(config.locations.defaultTeam.type).toBe('project');
    // profile wins over global when repo is silent
    expect(config.defaultInitiative).toBe('profile-init');
    expect(config.locations.defaultInitiative.type).toBe('profile');
  });

  it('labels a global-only key as global even when a profile is active', () => {
    writeGlobalConfig({
      defaultProfile: 'acme',
      defaultProject: 'global-proj',
      profiles: { acme: { workspace: 'acme', defaultTeam: 'profile-team' } },
    });

    const config = getConfig();
    expect(config.defaultProject).toBe('global-proj');
    expect(config.locations.defaultProject.type).toBe('global');
    expect(config.defaultTeam).toBe('profile-team');
    expect(config.locations.defaultTeam.type).toBe('profile');
  });

  it('no-profile path is byte-identical to {...global, ...project}', () => {
    writeGlobalConfig({ defaultTeam: 'global-team', defaultInitiative: 'global-init' });
    writeProjectConfig({ defaultTeam: 'repo-team' });

    const config = getConfig();
    const merged: Record<string, unknown> = { ...config };
    delete merged.locations;
    // Equivalent to the pre-change merge: project over global, no profile layer.
    expect(merged).toEqual({ defaultInitiative: 'global-init', defaultTeam: 'repo-team' });
    // No key is labeled 'profile' when no profile is active.
    for (const loc of Object.values(config.locations)) {
      expect(loc.type).not.toBe('profile');
    }
  });
});
