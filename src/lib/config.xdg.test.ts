import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, getGlobalConfigPath, setConfigValue } from './config.js';
import { __resetGitContextCache } from './git-context.js';
import { getInvocationContext, resetInvocationContext } from './invocation-context.js';
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
    __resetGitContextCache();
  });

  afterEach(() => {
    resetInvocationContext();
    __resetGitContextCache();
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

  it('resolves defaultPrompt by a path override and falls back to the top-level value (M30)', () => {
    writeRepo({
      defaultPrompt: 'general',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    const mobile = mkSub('apps/mobile');

    // Matching context dir → the override wins, tagged with `override` provenance.
    const cfgMobile = getConfig(mobile);
    expect(cfgMobile.defaultPrompt).toBe('mobile-issue');
    expect(cfgMobile.locations.defaultPrompt).toMatchObject({ type: 'override', scope: 'project', ruleIndex: 0 });
    expect(cfgMobile.locations.defaultPrompt.when).toEqual({ path: 'apps/mobile/**' });

    // Outside the override subtree → the top-level (general) value.
    const cfgRoot = getConfig(repoRoot);
    expect(cfgRoot.defaultPrompt).toBe('general');
    expect(cfgRoot.locations.defaultPrompt.type).toBe('project');
  });

  it('resolves defaultPrompt independently of other fields in the same context (M30)', () => {
    // A rule that sets ONLY defaultPrompt must leave defaultTeam to fall back.
    writeRepo({
      defaultTeam: 'platform',
      defaultPrompt: 'general',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    const mobile = mkSub('apps/mobile');

    const cfg = getConfig(mobile);
    expect(cfg.defaultPrompt).toBe('mobile-issue');
    expect(cfg.locations.defaultPrompt.type).toBe('override');
    // defaultTeam is untouched by the prompt-only override → still the top-level value.
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
      unlinkSync(link);
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

  it('resolves a catch-all-only override without needing git context', () => {
    writeRepo({ overrides: [{ when: {}, defaultTeam: 'catch-all' }] });

    const cfg = getConfig(repoRoot);
    expect(cfg.defaultTeam).toBe('catch-all');
    expect(cfg.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'project' });
  });

  it('does not crash on a malformed composite when; warns and keeps resolving (C)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    writeRepo({
      defaultTeam: 'platform',
      overrides: [
        { when: { allOf: {} } as never, defaultTeam: 'bad-allof' },
        { when: { not: null } as never, defaultTeam: 'bad-not' },
        { when: {}, defaultTeam: 'catch' },
      ],
    });

    expect(() => getConfig(repoRoot)).not.toThrow();
    expect(getConfig(repoRoot).defaultTeam).toBe('catch');
    expect(warn).toHaveBeenCalled();
  });

  it('clears a prior context overrideAliases when the next context has no overrides (B)', () => {
    // First context stashes an alias overlay.
    writeRepo({ overrides: [{ when: {}, aliases: { teams: { default: 'team_from_override' } } }] });
    getConfig(repoRoot);
    expect(getInvocationContext().overrideAliases?.teams?.default).toBe('team_from_override');

    // A later context with no overrides must NOT inherit the stale overlay.
    const noOverrides = mkdtempSync(join(tmpdir(), 'a2l-ovr-none-'));
    try {
      getConfig(noOverrides);
      expect(getInvocationContext().overrideAliases).toBeUndefined();
    } finally {
      rmSync(noOverrides, { recursive: true, force: true });
    }
  });

  it('resolves the profile layer from the queried dir, not cwd, for getConfig(dir) (J)', () => {
    writeGlobal({
      profiles: {
        acme: { workspace: 'acme-ws', defaultTeam: 'ACME-CORE' },
        widgets: { workspace: 'widgets-ws', defaultTeam: 'WIDGETS-CORE' },
      },
    });
    const acmeRepo = mkdtempSync(join(tmpdir(), 'a2l-j-acme-'));
    const widgetsRepo = mkdtempSync(join(tmpdir(), 'a2l-j-widgets-'));
    try {
      mkdirSync(join(acmeRepo, '.agent2linear'), { recursive: true });
      writeFileSync(join(acmeRepo, '.agent2linear', 'config.json'), JSON.stringify({ profile: 'acme' }));
      mkdirSync(join(widgetsRepo, '.agent2linear'), { recursive: true });
      writeFileSync(join(widgetsRepo, '.agent2linear', 'config.json'), JSON.stringify({ profile: 'widgets' }));

      process.chdir(acmeRepo); // cwd selects the acme profile
      const cfg = getConfig(widgetsRepo); // but we query the widgets dir
      expect(cfg.defaultTeam).toBe('WIDGETS-CORE');
      expect(cfg.locations.defaultTeam.type).toBe('profile');
    } finally {
      process.chdir(origCwd);
      rmSync(acmeRepo, { recursive: true, force: true });
      rmSync(widgetsRepo, { recursive: true, force: true });
    }
  });

  describe('git-derived context (Phase 2, real git)', () => {
    let gitRepo: string;

    beforeEach(() => {
      gitRepo = mkdtempSync(join(tmpdir(), 'a2l-ovr-git-'));
      const git = (args: string[]) =>
        execFileSync('git', ['-C', gitRepo, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
      git(['init', '-q', '-b', 'release/1.0']);
      git(['config', 'user.email', 't@t.co']);
      git(['config', 'user.name', 't']);
      git(['remote', 'add', 'origin', 'git@github.com:acme/web.git']);
      git(['commit', '-q', '--allow-empty', '-m', 'init']);
    });

    afterEach(() => {
      __resetGitContextCache();
      rmSync(gitRepo, { recursive: true, force: true });
    });

    it('uses the git work-tree root for repoRoot when no .agent2linear exists', () => {
      // No .agent2linear in gitRepo → repoRoot falls back to the git toplevel, so the
      // global relative path override anchors and matches.
      writeGlobal({
        defaultTeam: 'platform',
        overrides: [{ when: { path: 'sub/**' }, defaultTeam: 'sub-team' }],
      });
      const sub = join(gitRepo, 'sub');
      mkdirSync(sub, { recursive: true });

      expect(getConfig(sub).defaultTeam).toBe('sub-team');
      expect(getConfig(gitRepo).defaultTeam).toBe('platform'); // catch-all at the root
    });

    it('matches an owner identity override against the origin remote', () => {
      writeGlobal({ overrides: [{ when: { owner: 'acme' }, defaultTeam: 'acme-eng' }] });

      const cfg = getConfig(gitRepo);
      expect(cfg.defaultTeam).toBe('acme-eng');
      expect(cfg.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'global' });
    });

    it('matches a branch override against the current branch', () => {
      writeGlobal({ overrides: [{ when: { branch: 'release/*' }, defaultInitiative: 'hardening' }] });

      expect(getConfig(gitRepo).defaultInitiative).toBe('hardening');
    });
  });
});
