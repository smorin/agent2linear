import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, getGlobalConfigPath, setConfigValue } from './config.js';
import { resetInvocationContext } from './invocation-context.js';
import { logger } from './logger.js';
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

describe('getConfig() — context-aware overrides (M29)', () => {
  let xdgConfig: string;
  let repoRoot: string;

  beforeEach(() => {
    xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovr-xdg-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'a2l-ovr-repo-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
    resetInvocationContext();
  });

  afterEach(() => {
    resetInvocationContext();
    rmSync(xdgConfig, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  function writeGlobal(config: Partial<Config>): void {
    const dir = join(xdgConfig, 'agent2linear');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
  }

  function writeRepo(config: Partial<Config>): void {
    const dir = join(repoRoot, '.agent2linear');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
  }

  function mkSub(name: string): string {
    const dir = join(repoRoot, name);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  it('resolves a repo path override for the matching context dir', () => {
    writeRepo({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] });
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.defaultTeam).toBe('cli-team');
    expect(cfg.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'project', ruleIndex: 0 });
    expect(cfg.locations.defaultTeam.when).toEqual({ path: 'cli/**' });
  });

  it('falls back to the repo top-level (catch-all) outside the override subtree', () => {
    writeRepo({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] });

    const cfg = getConfig(repoRoot);
    expect(cfg.defaultTeam).toBe('platform');
    expect(cfg.locations.defaultTeam.type).toBe('project');
  });

  it('concatenates global + repo overrides, resolving each field independently', () => {
    writeGlobal({ overrides: [{ when: { path: 'cli/**' }, defaultInitiative: 'global-init' }] });
    writeRepo({ overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'repo-cli-team' }] });
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.defaultTeam).toBe('repo-cli-team');
    expect(cfg.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'project' });
    expect(cfg.defaultInitiative).toBe('global-init');
    expect(cfg.locations.defaultInitiative).toMatchObject({ type: 'override', scope: 'global' });
  });

  it('a global override does not clobber a repo top-level value (repo scope wins, §6)', () => {
    writeGlobal({ overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'global-cli' }] });
    writeRepo({ defaultTeam: 'repo-platform' });
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.defaultTeam).toBe('repo-platform');
    expect(cfg.locations.defaultTeam.type).toBe('project');
  });

  it('a global override does beat a global top-level value (same scope, specificity)', () => {
    writeGlobal({ defaultTeam: 'global-platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'global-cli' }] });
    writeRepo({}); // empty .agent2linear still provides the repoRoot that anchors the relative path
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.defaultTeam).toBe('global-cli');
    expect(cfg.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'global' });
  });

  it('never lets an override set apiKey (§10)', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_env_key');
    // A malformed rule trying to override apiKey must be ignored for key resolution.
    writeRepo({ overrides: [{ when: { path: 'cli/**' }, apiKey: 'lin_evil', defaultTeam: 'cli-team' } as never] });
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.apiKey).toBe('lin_env_key');
    expect(cfg.locations.apiKey.type).toBe('env');
    expect(cfg.defaultTeam).toBe('cli-team'); // the legitimate field still applies
  });

  it('canonicalizes a symlinked context dir before matching (§9)', () => {
    writeRepo({ overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] });
    mkSub('cli');
    const link = join(tmpdir(), `a2l-ovr-link-${Date.now()}`);
    symlinkSync(join(repoRoot, 'cli'), link);
    try {
      const cfg = getConfig(link);
      expect(cfg.defaultTeam).toBe('cli-team');
    } finally {
      rmSync(link, { force: true });
    }
  });

  it('yields no override context for a missing dir, without crashing (§9 query)', () => {
    writeRepo({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] });
    const missing = join(repoRoot, 'does', 'not', 'exist');

    const cfg = getConfig(missing);
    // No repoRoot resolves above a missing path, so the relative override is skipped.
    expect(cfg.defaultTeam).toBe('platform');
  });

  it('ignores an empty overrides array (no resolution attempted)', () => {
    writeRepo({ defaultTeam: 'platform', overrides: [] });

    const cfg = getConfig(repoRoot);
    expect(cfg.defaultTeam).toBe('platform');
    expect(cfg.locations.defaultTeam.type).toBe('project');
  });

  it('skips a relative override when no repo root resolves (context outside any repo)', () => {
    writeGlobal({
      defaultTeam: 'global-platform',
      overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'global-cli' }],
    });
    const isolated = mkdtempSync(join(tmpdir(), 'a2l-ovr-iso-'));
    try {
      const cfg = getConfig(join(isolated, 'cli'));
      expect(cfg.defaultTeam).toBe('global-platform');
      expect(cfg.locations.defaultTeam.type).toBe('global');
    } finally {
      rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('warns and skips an invalid override rule but keeps resolving (§9)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    writeRepo({
      overrides: [
        { when: { path: '' }, defaultTeam: 'bad' },
        { when: { path: 'cli/**' }, defaultTeam: 'cli-team' },
      ],
    });
    const cli = mkSub('cli');

    const cfg = getConfig(cli);
    expect(cfg.defaultTeam).toBe('cli-team');
    expect(warn).toHaveBeenCalled();
  });
});
