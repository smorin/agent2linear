import { createHash } from 'crypto';
import { existsSync, rmSync, statSync } from 'fs';
import { homedir } from 'os';
import { dirname, isAbsolute, join } from 'path';

const APP_DIR = 'agent2linear';
const PROJECT_DIR = '.agent2linear';
const LEGACY_CACHE_FILES = ['cache.json', 'project-cache.json'] as const;

/** Resolve an XDG base dir: use the env var only if set, non-empty, and absolute. */
function resolveXdgBase(envVar: string, homeRelativeDefault: string): string {
  const value = process.env[envVar];
  if (value && isAbsolute(value)) {
    return join(value, APP_DIR);
  }
  return join(homedir(), homeRelativeDefault, APP_DIR);
}

/** User-level config dir: $XDG_CONFIG_HOME/agent2linear else ~/.config/agent2linear */
export function userConfigDir(): string {
  return resolveXdgBase('XDG_CONFIG_HOME', '.config');
}

/** User-level cache root: $XDG_CACHE_HOME/agent2linear else ~/.cache/agent2linear */
export function userCacheDir(): string {
  return resolveXdgBase('XDG_CACHE_HOME', '.cache');
}

/** User-level state root: $XDG_STATE_HOME/agent2linear else ~/.local/state/agent2linear */
export function userStateDir(): string {
  return resolveXdgBase('XDG_STATE_HOME', '.local/state');
}

/** Cache partition key: sha256(apiKey)[:12], or 'default' when no key is available. */
export function workspaceCacheKey(apiKey?: string): string {
  if (!apiKey || apiKey.trim() === '') {
    return 'default';
  }
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
}

/** Per-workspace cache dir: userCacheDir()/<workspaceCacheKey(apiKey)> */
export function workspaceCacheDir(apiKey?: string): string {
  return join(userCacheDir(), workspaceCacheKey(apiKey));
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Walk up from startDir toward home; return the path of the nearest `.agent2linear/`
 * directory found, or null. The home boundary is checked before testing each
 * directory, so a `.agent2linear/` located at (or above) home is never returned.
 */
export function findProjectConfigDir(
  startDir: string = process.cwd(),
  home: string = homedir()
): string | null {
  let dir = startDir;
  for (;;) {
    if (dir === home) {
      return null; // $HOME boundary: never test or pass home
    }
    const candidate = join(dir, PROJECT_DIR);
    if (isDir(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null; // filesystem root
    }
    dir = parent;
  }
}

/** Where a `--scope project` write lands: discovered dir, else <startDir>/.agent2linear */
export function projectConfigWriteDir(
  startDir: string = process.cwd(),
  home: string = homedir()
): string {
  return findProjectConfigDir(startDir, home) ?? join(startDir, PROJECT_DIR);
}

/**
 * Delete legacy project-local cache files (cache.json, project-cache.json) from the
 * cwd's `.agent2linear/` and any discovered project `.agent2linear/`. Never touches
 * config files. Safe and idempotent — caches are disposable.
 */
export function cleanupLegacyProjectCaches(
  startDir: string = process.cwd(),
  home: string = homedir()
): void {
  const dirs = new Set<string>();
  dirs.add(join(startDir, PROJECT_DIR));
  const discovered = findProjectConfigDir(startDir, home);
  if (discovered) {
    dirs.add(discovered);
  }
  for (const dir of dirs) {
    for (const file of LEGACY_CACHE_FILES) {
      const path = join(dir, file);
      if (existsSync(path)) {
        try {
          rmSync(path);
        } catch {
          // best-effort cleanup; ignore failures
        }
      }
    }
  }
}
