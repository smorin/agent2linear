import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupLegacyProjectCaches,
  findProjectConfigDir,
  projectConfigWriteDir,
  userCacheDir,
  userConfigDir,
  workspaceCacheDir,
  workspaceCacheKey,
} from './xdg-paths.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-xdg-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('userConfigDir', () => {
  it('uses $XDG_CONFIG_HOME when set to an absolute path', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/abs/cfg');
    expect(userConfigDir()).toBe(join('/abs/cfg', 'agent2linear'));
  });

  it('ignores a relative $XDG_CONFIG_HOME and falls back to ~/.config', () => {
    vi.stubEnv('XDG_CONFIG_HOME', 'relative/cfg');
    expect(userConfigDir()).toBe(join(homedir(), '.config', 'agent2linear'));
  });

  it('ignores an empty $XDG_CONFIG_HOME and falls back to ~/.config', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '');
    expect(userConfigDir()).toBe(join(homedir(), '.config', 'agent2linear'));
  });

  it('falls back to ~/.config when $XDG_CONFIG_HOME is unset', () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined as unknown as string);
    expect(userConfigDir()).toBe(join(homedir(), '.config', 'agent2linear'));
  });
});

describe('userCacheDir', () => {
  it('uses $XDG_CACHE_HOME when absolute', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/abs/cache');
    expect(userCacheDir()).toBe(join('/abs/cache', 'agent2linear'));
  });

  it('falls back to ~/.cache when unset', () => {
    vi.stubEnv('XDG_CACHE_HOME', undefined as unknown as string);
    expect(userCacheDir()).toBe(join(homedir(), '.cache', 'agent2linear'));
  });
});

describe('workspaceCacheKey', () => {
  it('returns the first 12 hex chars of sha256(apiKey)', () => {
    const key = 'lin_api_secret';
    const expected = createHash('sha256').update(key).digest('hex').slice(0, 12);
    expect(workspaceCacheKey(key)).toBe(expected);
  });

  it('returns "default" for an undefined apiKey', () => {
    expect(workspaceCacheKey(undefined)).toBe('default');
  });

  it('returns "default" for an empty/whitespace apiKey', () => {
    expect(workspaceCacheKey('   ')).toBe('default');
  });
});

describe('workspaceCacheDir', () => {
  it('joins the cache root with the workspace key', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/abs/cache');
    expect(workspaceCacheDir('lin_api_secret')).toBe(
      join('/abs/cache', 'agent2linear', workspaceCacheKey('lin_api_secret'))
    );
  });

  it('uses the default bucket without an apiKey', () => {
    vi.stubEnv('XDG_CACHE_HOME', '/abs/cache');
    expect(workspaceCacheDir()).toBe(join('/abs/cache', 'agent2linear', 'default'));
  });
});

describe('findProjectConfigDir', () => {
  it('returns the nearest .agent2linear dir walking up from a subdir', () => {
    const proj = join(tmp, 'proj');
    const sub = join(proj, 'a', 'b');
    mkdirSync(join(proj, '.agent2linear'), { recursive: true });
    mkdirSync(sub, { recursive: true });
    expect(findProjectConfigDir(sub, tmp)).toBe(join(proj, '.agent2linear'));
  });

  it('returns null when no .agent2linear exists below the home boundary', () => {
    const sub = join(tmp, 'proj', 'a');
    mkdirSync(sub, { recursive: true });
    expect(findProjectConfigDir(sub, tmp)).toBeNull();
  });

  it('never treats a .agent2linear located at $HOME as project config', () => {
    mkdirSync(join(tmp, '.agent2linear'), { recursive: true }); // tmp is the home boundary
    const sub = join(tmp, 'proj', 'a');
    mkdirSync(sub, { recursive: true });
    expect(findProjectConfigDir(sub, tmp)).toBeNull();
  });

  it('prefers the nearest of two nested .agent2linear dirs', () => {
    const outer = join(tmp, 'outer');
    const inner = join(outer, 'inner');
    mkdirSync(join(outer, '.agent2linear'), { recursive: true });
    mkdirSync(join(inner, '.agent2linear'), { recursive: true });
    expect(findProjectConfigDir(inner, tmp)).toBe(join(inner, '.agent2linear'));
  });
});

describe('projectConfigWriteDir', () => {
  it('returns the discovered .agent2linear dir when one exists', () => {
    const proj = join(tmp, 'proj');
    const sub = join(proj, 'a');
    mkdirSync(join(proj, '.agent2linear'), { recursive: true });
    mkdirSync(sub, { recursive: true });
    expect(projectConfigWriteDir(sub, tmp)).toBe(join(proj, '.agent2linear'));
  });

  it('falls back to <startDir>/.agent2linear when none is discovered', () => {
    const sub = join(tmp, 'proj', 'a');
    mkdirSync(sub, { recursive: true });
    expect(projectConfigWriteDir(sub, tmp)).toBe(join(sub, '.agent2linear'));
  });
});

describe('cleanupLegacyProjectCaches', () => {
  it('deletes legacy cache files but leaves config files intact', () => {
    const dir = join(tmp, '.agent2linear');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'cache.json'), '{}');
    writeFileSync(join(dir, 'project-cache.json'), '{}');
    writeFileSync(join(dir, 'config.json'), '{}');

    cleanupLegacyProjectCaches(tmp, join(tmp, '..'));

    expect(existsSync(join(dir, 'cache.json'))).toBe(false);
    expect(existsSync(join(dir, 'project-cache.json'))).toBe(false);
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
  });
});
