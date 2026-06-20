# XDG Base Directory Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agent2linear honor `$XDG_CONFIG_HOME` for config files and store caches in a per-workspace `$XDG_CACHE_HOME` location, with walk-up discovery for project config.

**Architecture:** Introduce one pure path-resolution module (`src/lib/xdg-paths.ts`) as the single source of truth for filesystem locations. Migrate the three config modules and two cache modules from hardcoded module-level path constants to call-time resolution through that module. Update user-facing path strings and docs.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), Node `os`/`path`/`fs`/`crypto`, vitest (unit tests, co-located `*.test.ts` in `src/lib/`), tsup build, eslint + tsc gates.

## Global Constraints

- **ESM imports use `.js` extensions** (e.g. `import { userConfigDir } from './xdg-paths.js'`), even for `.ts` source.
- **TypeScript strict mode** is enabled — no implicit `any`, handle `undefined`.
- **Test framework is vitest**, run with `npm test` (`vitest run`). Tests are co-located: `src/lib/<name>.test.ts`. Pattern: `import { describe, expect, it, vi } from 'vitest';`.
- **XDG safety rule (verbatim requirement):** an `$XDG_*` env var is used only if it is **set, non-empty, AND absolute** (`path.isAbsolute`); otherwise fall back to the home-relative default.
- **Precedence (unchanged):** config resolution is `project > global > env`, **except** the API key which is `env > project > global`.
- **Cache key:** `sha256(apiKey).slice(0, 12)`, or the literal `default` when no API key is available.
- **Walk-up boundary:** stop at `$HOME` (never test or pass it) and at filesystem root; nearest `.agent2linear/` wins (no cascade).
- **Legacy cleanup is narrow:** only ever delete files named exactly `cache.json` and `project-cache.json`; never touch `config.json`, `aliases.json`, or `milestone-templates.json`.
- **Verification gates per task:** `npm test` (relevant tests), and at task end `npm run build`, `npm run typecheck`, `npm run lint` must pass.
- **Reference spec:** `docs/superpowers/specs/2026-06-19-xdg-base-directory-design.md`.
- **Performance / no memoization:** path resolution moves from import-time constants to call-time, so `getConfig()`/`getApiKey()` now perform a `statSync` walk up to `$HOME` per call (<10ms for a single CLI invocation — acceptable). Do **not** add a process-level memo of `findProjectConfigDir()` — it would break the `process.chdir`-based tests in this plan. If memoization ever becomes necessary, key it by `process.cwd()`.

---

## File Structure

**New**
- `src/lib/xdg-paths.ts` — pure path resolution (config/cache dirs, cache key, walk-up, legacy cleanup). Depends only on `os`, `path`, `fs`, `crypto`.
- `src/lib/xdg-paths.test.ts` — vitest unit tests for the above.
- `src/lib/config.xdg.test.ts` — vitest test that the migrated `config.ts` routes through XDG.
- `tests/scripts/test-xdg-paths.sh` — optional end-to-end CLI smoke test (Task 8).

**Modified — path logic**
- `src/lib/config.ts`, `src/lib/aliases.ts`, `src/lib/milestone-templates.ts` (config tiers)
- `src/lib/status-cache.ts`, `src/lib/project-resolver.ts` (cache tier + legacy cleanup hook)

**Modified — display strings**
- `src/commands/config/register.ts`, `src/commands/config/edit.tsx`, `src/commands/alias/edit.tsx`, `src/commands/milestone-templates/list.ts`, `src/lib/sync-aliases.ts`, `src/commands/setup.tsx`

**Modified — docs/release**
- `README.md`, `CLAUDE.md`, `MILESTONES.md`, `package.json`, `src/cli.ts`

---

## Task 1: Pure path-resolution module `xdg-paths.ts`

**Files:**
- Create: `src/lib/xdg-paths.ts`
- Test: `src/lib/xdg-paths.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module; only `os`, `path`, `fs`, `crypto`).
- Produces (later tasks rely on these exact signatures):
  - `userConfigDir(): string`
  - `userCacheDir(): string`
  - `workspaceCacheKey(apiKey?: string): string`
  - `workspaceCacheDir(apiKey?: string): string`
  - `findProjectConfigDir(startDir?: string, home?: string): string | null`
  - `projectConfigWriteDir(startDir?: string, home?: string): string`
  - `cleanupLegacyProjectCaches(startDir?: string, home?: string): void`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/xdg-paths.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/xdg-paths.test.ts`
Expected: FAIL — `Failed to resolve import "./xdg-paths.js"` (module does not exist yet).

- [ ] **Step 3: Implement the module**

Create `src/lib/xdg-paths.ts`:

```ts
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
  if (value && value.length > 0 && isAbsolute(value)) {
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/xdg-paths.test.ts`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 5: Verify gates and commit**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

```bash
git add src/lib/xdg-paths.ts src/lib/xdg-paths.test.ts
git commit -m "feat: add pure XDG path-resolution module"
```

---

## Task 2: Migrate `config.ts` to XDG path resolution

**Files:**
- Modify: `src/lib/config.ts:7-10` (replace path constants) and the read/write functions that reference them
- Test: `src/lib/config.xdg.test.ts`

**Interfaces:**
- Consumes: `userConfigDir`, `findProjectConfigDir`, `projectConfigWriteDir` from `./xdg-paths.js`.
- Produces: `getGlobalConfigPath()` and `getProjectConfigPath()` now return resolved absolute paths (computed at call time). Existing exports (`getConfig`, `getApiKey`, `setConfigValue`, `unsetConfigValue`, `setDefaultInitiative`, `hasGlobalConfig`, `hasProjectConfig`) keep their signatures.

- [ ] **Step 1: Write the failing test**

Create `src/lib/config.xdg.test.ts`:

```ts
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGlobalConfigPath, setConfigValue } from './config.js';

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/config.xdg.test.ts`
Expected: FAIL — global config writes to the real `~/.config/agent2linear` (the hardcoded constant), so `getGlobalConfigPath()` does not equal the temp path.

- [ ] **Step 3: Replace the path constants with call-time resolvers**

In `src/lib/config.ts`, replace lines 1-10:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

import type { Config, ResolvedConfig } from './types.js';

const GLOBAL_CONFIG_DIR = join(homedir(), '.config', 'agent2linear');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_DIR = '.agent2linear';
const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, 'config.json');
```

with:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { Config, ResolvedConfig } from './types.js';
import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';

const CONFIG_FILENAME = 'config.json';

function globalConfigFile(): string {
  return join(userConfigDir(), CONFIG_FILENAME);
}

/** Project config file for reading (walk-up discovery), or null if none exists. */
function projectConfigReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, CONFIG_FILENAME) : null;
}

/** Project config file for writing (discovered dir, else cwd/.agent2linear). */
function projectConfigWriteFile(): string {
  return join(projectConfigWriteDir(), CONFIG_FILENAME);
}
```

- [ ] **Step 4: Update `getConfig()` to use the resolvers**

In `getConfig()` (around `src/lib/config.ts:46-49`), replace:

```ts
  const globalConfig = readConfigFile(GLOBAL_CONFIG_FILE);
  const projectConfig = readConfigFile(PROJECT_CONFIG_FILE);
```

with:

```ts
  const globalConfig = readConfigFile(globalConfigFile());
  const projectReadFile = projectConfigReadFile();
  const projectConfig = projectReadFile ? readConfigFile(projectReadFile) : {};
```

Then, in the `locations` assignment blocks that reference `PROJECT_CONFIG_FILE` and `GLOBAL_CONFIG_FILE` (e.g. `{ type: 'project', path: PROJECT_CONFIG_FILE }`), replace every `PROJECT_CONFIG_FILE` with `(projectReadFile ?? projectConfigWriteFile())` and every `GLOBAL_CONFIG_FILE` with `globalConfigFile()`. There are matching `else if (projectConfig.X)` guards, so a location is only set to the project path when `projectReadFile` was non-null.

- [ ] **Step 5: Update the writer functions**

Replace the `configFile` selection in `setDefaultInitiative` (around line 214), `setConfigValue` (around line 296), and `unsetConfigValue` (around line 340). Each currently reads:

```ts
  const configFile = scope === 'global' ? GLOBAL_CONFIG_FILE : PROJECT_CONFIG_FILE;
```

Replace with:

```ts
  const configFile = scope === 'global' ? globalConfigFile() : projectConfigWriteFile();
```

- [ ] **Step 6: Update the path/existence accessors**

Replace the bodies of the accessor functions:

```ts
export function getGlobalConfigPath(): string {
  return globalConfigFile();
}

export function getProjectConfigPath(): string {
  return projectConfigReadFile() ?? projectConfigWriteFile();
}

export function hasGlobalConfig(): boolean {
  return existsSync(globalConfigFile());
}

export function hasProjectConfig(): boolean {
  const f = projectConfigReadFile();
  return f !== null && existsSync(f);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- src/lib/config.xdg.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify gates and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass; no remaining references to `GLOBAL_CONFIG_FILE`/`PROJECT_CONFIG_FILE`/`GLOBAL_CONFIG_DIR`/`PROJECT_CONFIG_DIR` in `config.ts`.

```bash
git add src/lib/config.ts src/lib/config.xdg.test.ts
git commit -m "feat: route config.ts through XDG path resolution"
```

---

## Task 3: Migrate `aliases.ts` to XDG path resolution

**Files:**
- Modify: `src/lib/aliases.ts:1-22` and all references to the four path constants
- Test: extend coverage via `src/lib/config.xdg.test.ts` is not appropriate; add `src/lib/aliases.xdg.test.ts`

**Interfaces:**
- Consumes: `userConfigDir`, `findProjectConfigDir`, `projectConfigWriteDir` from `./xdg-paths.js`.
- Produces: `getGlobalAliasesPath()` / `getProjectAliasesPath()` return resolved paths; all alias read/write/list functions keep their signatures.

- [ ] **Step 1: Write the failing test**

Create `src/lib/aliases.xdg.test.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addAlias, getGlobalAliasesPath } from './aliases.js';

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/aliases.xdg.test.ts`
Expected: FAIL — `getGlobalAliasesPath()` returns the hardcoded `~/.config` path, not the temp path.

- [ ] **Step 3: Replace the path constants**

In `src/lib/aliases.ts`, replace lines 1-3 and 19-22.

Replace the imports (lines 1-3):

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
```

with:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';
```

Replace the constants (lines 19-22):

```ts
const GLOBAL_ALIASES_DIR = join(homedir(), '.config', 'agent2linear');
const GLOBAL_ALIASES_FILE = join(GLOBAL_ALIASES_DIR, 'aliases.json');
const PROJECT_ALIASES_DIR = '.agent2linear';
const PROJECT_ALIASES_FILE = join(PROJECT_ALIASES_DIR, 'aliases.json');
```

with:

```ts
const ALIASES_FILENAME = 'aliases.json';

function globalAliasesFile(): string {
  return join(userConfigDir(), ALIASES_FILENAME);
}

/** Project aliases file for reading (walk-up), or null if none exists. */
function projectAliasesReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, ALIASES_FILENAME) : null;
}

/** Project aliases file for writing (discovered dir, else cwd/.agent2linear). */
function projectAliasesWriteFile(): string {
  return join(projectConfigWriteDir(), ALIASES_FILENAME);
}
```

- [ ] **Step 4: Update all references**

`GLOBAL_ALIASES_FILE` and `PROJECT_ALIASES_FILE` are referenced throughout `aliases.ts`. Apply these substitutions:

- In `loadAliases()` (lines ~158-159): `readAliasesFile(GLOBAL_ALIASES_FILE)` → `readAliasesFile(globalAliasesFile())`; and for the project file:

  ```ts
  const projectReadFile = projectAliasesReadFile();
  const projectAliases = projectReadFile ? readAliasesFile(projectReadFile) : getEmptyAliases();
  ```

  Then in the location-tracking blocks, replace `{ type: 'global', path: GLOBAL_ALIASES_FILE }` with `{ type: 'global', path: globalAliasesFile() }` and `{ type: 'project', path: PROJECT_ALIASES_FILE }` with `{ type: 'project', path: projectReadFile ?? projectAliasesWriteFile() }`.

- In every write/mutate function that selects a file by scope (`addAlias`, `removeAlias`, `updateAliasId`, `renameAlias`, `clearAliases`), the pattern:

  ```ts
  const filePath = scope === 'global' ? GLOBAL_ALIASES_FILE : PROJECT_ALIASES_FILE;
  ```

  becomes:

  ```ts
  const filePath = scope === 'global' ? globalAliasesFile() : projectAliasesWriteFile();
  ```

- In `getGlobalAliasesPath`, `getProjectAliasesPath`, `hasGlobalAliases`, `hasProjectAliases` (lines ~876-899):

  ```ts
  export function getGlobalAliasesPath(): string {
    return globalAliasesFile();
  }

  export function getProjectAliasesPath(): string {
    return projectAliasesReadFile() ?? projectAliasesWriteFile();
  }

  export function hasGlobalAliases(): boolean {
    return existsSync(globalAliasesFile());
  }

  export function hasProjectAliases(): boolean {
    const f = projectAliasesReadFile();
    return f !== null && existsSync(f);
  }
  ```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/aliases.xdg.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify gates and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass; no remaining `GLOBAL_ALIASES_FILE`/`PROJECT_ALIASES_FILE`/`*_DIR`/`homedir` references in `aliases.ts`.

```bash
git add src/lib/aliases.ts src/lib/aliases.xdg.test.ts
git commit -m "feat: route aliases.ts through XDG path resolution"
```

---

## Task 4: Migrate `milestone-templates.ts` to XDG path resolution

**Files:**
- Modify: `src/lib/milestone-templates.ts:1-10` and references
- Test: `src/lib/milestone-templates.xdg.test.ts`

**Interfaces:**
- Consumes: `userConfigDir`, `findProjectConfigDir`, `projectConfigWriteDir` from `./xdg-paths.js`.
- Produces: `getGlobalTemplatesPath()` / `getProjectTemplatesPath()` return resolved paths; CRUD function signatures unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/milestone-templates.xdg.test.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMilestoneTemplate, getGlobalTemplatesPath } from './milestone-templates.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-tmpl-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('milestone-templates.ts global path honors XDG', () => {
  it('writes global templates under $XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    const expected = join(tmp, 'agent2linear', 'milestone-templates.json');
    // Assert the resolved path BEFORE any write. At RED (pre-migration) this
    // assertion fails and aborts the test before createMilestoneTemplate() could
    // write to the user's real ~/.config/agent2linear/milestone-templates.json
    // (the unmigrated global path is an absolute module-level constant).
    expect(getGlobalTemplatesPath()).toBe(expected);
    const res = createMilestoneTemplate(
      'std',
      { name: 'std', milestones: [{ name: 'M1' }] },
      'global'
    );
    expect(res.success).toBe(true);
    expect(existsSync(expected)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/milestone-templates.xdg.test.ts`
Expected: FAIL — global write lands in the hardcoded `~/.config` path.

- [ ] **Step 3: Replace the path constants**

In `src/lib/milestone-templates.ts`, replace lines 1-10.

Replace imports (lines 1-5):

```ts
import { existsSync, mkdirSync,readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';

import type { MilestoneDefinition,MilestoneTemplate, MilestoneTemplates } from './types.js';
```

with:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { MilestoneDefinition, MilestoneTemplate, MilestoneTemplates } from './types.js';
import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';
```

Replace the constants (lines 7-10):

```ts
const GLOBAL_TEMPLATES_DIR = join(homedir(), '.config', 'agent2linear');
const GLOBAL_TEMPLATES_FILE = join(GLOBAL_TEMPLATES_DIR, 'milestone-templates.json');
const PROJECT_TEMPLATES_DIR = '.agent2linear';
const PROJECT_TEMPLATES_FILE = join(PROJECT_TEMPLATES_DIR, 'milestone-templates.json');
```

with:

```ts
const TEMPLATES_FILENAME = 'milestone-templates.json';

function globalTemplatesFile(): string {
  return join(userConfigDir(), TEMPLATES_FILENAME);
}

function projectTemplatesReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, TEMPLATES_FILENAME) : null;
}

function projectTemplatesWriteFile(): string {
  return join(projectConfigWriteDir(), TEMPLATES_FILENAME);
}
```

- [ ] **Step 4: Update all references**

- In `loadMilestoneTemplates()` (lines ~37, 45): `readTemplatesFile(GLOBAL_TEMPLATES_FILE)` → `readTemplatesFile(globalTemplatesFile())`; and:

  ```ts
  const projectReadFile = projectTemplatesReadFile();
  const projectTemplates = projectReadFile ? readTemplatesFile(projectReadFile) : null;
  ```

- In `createMilestoneTemplate`, `updateMilestoneTemplate`, `removeMilestoneTemplate` — each line:

  ```ts
  const filePath = scope === 'global' ? GLOBAL_TEMPLATES_FILE : PROJECT_TEMPLATES_FILE;
  ```

  becomes:

  ```ts
  const filePath = scope === 'global' ? globalTemplatesFile() : projectTemplatesWriteFile();
  ```

- In the path/existence accessors (lines ~163-186):

  ```ts
  export function getGlobalTemplatesPath(): string {
    return globalTemplatesFile();
  }

  export function getProjectTemplatesPath(): string {
    return projectTemplatesReadFile() ?? projectTemplatesWriteFile();
  }

  export function hasGlobalTemplates(): boolean {
    return existsSync(globalTemplatesFile());
  }

  export function hasProjectTemplates(): boolean {
    const f = projectTemplatesReadFile();
    return f !== null && existsSync(f);
  }
  ```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/milestone-templates.xdg.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify gates and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass; no remaining `*_TEMPLATES_FILE`/`*_DIR`/`homedir` references.

```bash
git add src/lib/milestone-templates.ts src/lib/milestone-templates.xdg.test.ts
git commit -m "feat: route milestone-templates.ts through XDG path resolution"
```

---

## Task 5: Migrate caches to user-level keyed `$XDG_CACHE_HOME` + legacy cleanup

**Files:**
- Modify: `src/lib/status-cache.ts:1-25` and its `readCache`/`writeCache`
- Modify: `src/lib/project-resolver.ts:1-10` and its `readCache`/`writeCache`
- Test: `src/lib/status-cache.xdg.test.ts`

**Interfaces:**
- Consumes: `workspaceCacheDir`, `cleanupLegacyProjectCaches` from `./xdg-paths.js`; `getApiKey` from `./config.js`.
- Produces: no signature changes — both cache modules read/write at `~/.cache/agent2linear/<key>/{cache.json,project-cache.json}`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/status-cache.xdg.test.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workspaceCacheKey } from './xdg-paths.js';
import { saveTeamsCache } from './status-cache.js';

let tmp: string;
const origCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-cache-'));
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('status-cache.ts writes to the keyed XDG cache dir', () => {
  it('writes cache.json under $XDG_CACHE_HOME/agent2linear/<key>', () => {
    // chdir into the temp dir BEFORE any cache call: saveTeamsCache triggers the
    // one-time legacy cleanup, which walks from cwd up to $HOME deleting legacy
    // cache files. Starting in tmp (outside $HOME) keeps the test hermetic and
    // prevents it from deleting real cache files in the dev checkout.
    process.chdir(tmp);
    vi.stubEnv('XDG_CACHE_HOME', tmp);
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_testkey');
    saveTeamsCache([
      // minimal shape; timestamp is what the cache layer reads
      { id: 'team_1', name: 'Team', key: 'T', timestamp: Date.now() } as never,
    ]);
    const key = workspaceCacheKey('lin_api_testkey');
    expect(existsSync(join(tmp, 'agent2linear', key, 'cache.json'))).toBe(true);
  });
});
```

> Note: `saveTeamsCache` is an existing export in `status-cache.ts`. The cast keeps the test focused on path placement, not entity shape.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/status-cache.xdg.test.ts`
Expected: FAIL — cache currently writes to `./.agent2linear/cache.json`, not the keyed XDG dir.

- [ ] **Step 3: Migrate `status-cache.ts`**

Replace `src/lib/status-cache.ts` lines 1-2 and 24-25.

Imports (lines 1-2):

```ts
import { existsSync, mkdirSync,readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
```

become:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { getApiKey } from './config.js';
import { cleanupLegacyProjectCaches, workspaceCacheDir } from './xdg-paths.js';
```

Constants (lines 24-25):

```ts
const CACHE_DIR = '.agent2linear';
const CACHE_FILE = join(CACHE_DIR, 'cache.json');
```

become:

```ts
const CACHE_FILENAME = 'cache.json';
let legacyCleaned = false;

function cacheDir(): string {
  return workspaceCacheDir(getApiKey());
}

function cacheFile(): string {
  return join(cacheDir(), CACHE_FILENAME);
}

function ensureLegacyCleaned(): void {
  if (legacyCleaned) return;
  legacyCleaned = true;
  cleanupLegacyProjectCaches();
}
```

Update `readCache()` (lines ~87-97) to call cleanup and use `cacheFile()`:

```ts
function readCache(): Cache {
  ensureLegacyCleaned();
  try {
    const file = cacheFile();
    if (!existsSync(file)) {
      return {};
    }
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}
```

Update `writeCache()` (lines ~102-111):

```ts
function writeCache(cache: Cache): void {
  ensureLegacyCleaned();
  try {
    const dir = cacheDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(cacheFile(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}
```

- [ ] **Step 4: Migrate `project-resolver.ts`**

Replace `src/lib/project-resolver.ts` lines 1-2 and 9-10.

Imports (lines 1-2):

```ts
import { existsSync, mkdirSync,readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
```

become:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { cleanupLegacyProjectCaches, workspaceCacheDir } from './xdg-paths.js';
```

> `getApiKey` is reachable via `getConfig` already imported, but use `getApiKey` for clarity. If not already imported, add it: change the existing `import { getConfig } from './config.js';` to `import { getApiKey, getConfig } from './config.js';`.

Constants (lines 9-10):

```ts
const PROJECT_CACHE_DIR = '.agent2linear';
const PROJECT_CACHE_FILE = join(PROJECT_CACHE_DIR, 'project-cache.json');
```

become:

```ts
const PROJECT_CACHE_FILENAME = 'project-cache.json';
let legacyCleaned = false;

function cacheDir(): string {
  return workspaceCacheDir(getApiKey());
}

function cacheFile(): string {
  return join(cacheDir(), PROJECT_CACHE_FILENAME);
}

function ensureLegacyCleaned(): void {
  if (legacyCleaned) return;
  legacyCleaned = true;
  cleanupLegacyProjectCaches();
}
```

Update `readCache()` (lines ~26-36) and `writeCache()` (lines ~41-50) the same way as Task 5 Step 3 — call `ensureLegacyCleaned()` first, use `cacheFile()`/`cacheDir()` instead of `PROJECT_CACHE_FILE`/`PROJECT_CACHE_DIR`:

```ts
function readCache(): ProjectCache {
  ensureLegacyCleaned();
  try {
    const file = cacheFile();
    if (!existsSync(file)) {
      return { byName: {}, byId: {} };
    }
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return { byName: {}, byId: {} };
  }
}

function writeCache(cache: ProjectCache): void {
  ensureLegacyCleaned();
  try {
    const dir = cacheDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(cacheFile(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Ignore cache write errors
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/status-cache.xdg.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify gates and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass; no remaining `CACHE_DIR`/`CACHE_FILE`/`PROJECT_CACHE_DIR`/`PROJECT_CACHE_FILE` references.

```bash
git add src/lib/status-cache.ts src/lib/project-resolver.ts src/lib/status-cache.xdg.test.ts
git commit -m "feat: store caches in keyed XDG cache dir with legacy cleanup"
```

---

## Task 6: Update user-facing path strings

**Files:**
- Modify: `src/commands/milestone-templates/list.ts:18,21`
- Modify: `src/commands/config/register.ts:26-27`
- Modify: `src/lib/sync-aliases.ts:188-189`
- Modify: `src/commands/config/edit.tsx:358-359`
- Modify: `src/commands/alias/edit.tsx:588-589`
- Modify: `src/commands/setup.tsx:486,490,930,1115`

**Interfaces:**
- Consumes: existing path accessors (`getGlobalTemplatesPath`, `getProjectTemplatesPath`, `getGlobalConfigPath`, `getProjectConfigPath`, `getGlobalAliasesPath`, `getProjectAliasesPath`) — now returning resolved paths.

**Transformation rule:** where the string reports *the user's actual location*, interpolate the resolved accessor. Where it is *generic help text*, change the literal to reference the XDG variable with the default, i.e. `$XDG_CONFIG_HOME/agent2linear/... (default ~/.config/agent2linear/...)`.

- [ ] **Step 1: Dynamic location — `milestone-templates/list.ts`**

This file already imports `hasGlobalTemplates`/`hasProjectTemplates`. Add `getGlobalTemplatesPath, getProjectTemplatesPath` to that import, then replace lines 18 and 21:

```ts
        console.log(`  Global:  ${getGlobalTemplatesPath()}`);
```
```ts
        console.log(`  Project: ${getProjectTemplatesPath()}`);
```

- [ ] **Step 2: Help text — `config/register.ts`**

Replace lines 26-27:

```ts
- Global:  $XDG_CONFIG_HOME/agent2linear/config.json (default: ~/.config/agent2linear/config.json)
- Project: .agent2linear/config.json (nearest, searching up from the current directory)
```

- [ ] **Step 3: Help text — `sync-aliases.ts`**

Replace lines 188-189:

```ts
      console.log('   --global: Save to global config ($XDG_CONFIG_HOME/agent2linear/aliases.json, default ~/.config/agent2linear/aliases.json)');
      console.log('   --project: Save to project config (.agent2linear/aliases.json)');
```

- [ ] **Step 4: Scope labels — `config/edit.tsx` and `alias/edit.tsx`**

These are interactive scope-selector labels. Replace the global label strings to reflect XDG. In `config/edit.tsx:358`:

```ts
      { label: `Global (${getGlobalConfigPath()})`, value: 'global' as const },
```

(add `getGlobalConfigPath` to the existing `./../../lib/config.js` import). In `alias/edit.tsx:588`:

```ts
      { label: `Global (${getGlobalAliasesPath()})`, value: 'global' as const },
```

(add `getGlobalAliasesPath` to the existing aliases import). Leave the project labels as `.agent2linear/...` literals.

- [ ] **Step 5: Setup wizard — `setup.tsx`**

Replace the four hardcoded `~/.config/agent2linear/` occurrences (lines 486, 490, 930, 1115) so the *global* references use `getGlobalConfigPath()` (import it from `../lib/config.js`). For the combined label at line 1115 and the description at 930, interpolate the resolved global path when `scope === 'global'`:

```tsx
{scope === 'global' ? getGlobalConfigPath().replace(/config\.json$/, '') : '.agent2linear/'}
```

For the static menu labels (486/490), use:

```tsx
label: `Global (${getGlobalConfigPath().replace(/config\.json$/, '')})`,
```
```tsx
label: 'Project (.agent2linear/)',
```

- [ ] **Step 6: Verify and commit**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: pass. Then confirm no stray hardcoded user-config literals remain in display code:

Run: `grep -rn "~/.config/agent2linear" src/` — Expected: no matches (only `$XDG_CONFIG_HOME ... default ~/.config` help strings, which are intentional).

```bash
git add src/commands src/lib/sync-aliases.ts
git commit -m "feat: show resolved XDG paths in user-facing strings"
```

---

## Task 7: Docs, milestone, and version bump

**Files:**
- Modify: `README.md` (config/cache locations), `CLAUDE.md` (Aliases System / Configuration sections), `MILESTONES.md` (new milestone), `package.json:3` (version), `src/cli.ts` (version string)

**Interfaces:** none (documentation + metadata).

- [ ] **Step 1: Update README and CLAUDE.md**

In `README.md` and `CLAUDE.md`, update every documented storage path to the XDG form. Replace occurrences of `~/.config/agent2linear/<file>` with: `$XDG_CONFIG_HOME/agent2linear/<file> (default: ~/.config/agent2linear/<file>)`. Add a sentence that caches now live at `$XDG_CACHE_HOME/agent2linear/<workspace-key>/` (default `~/.cache/agent2linear/...`) and that project config is discovered by walking up from the current directory to `$HOME`.

- [ ] **Step 2: Add a milestone entry**

Open `MILESTONES.md`, find the highest existing `M##`, and add the next number. Entry content:

```markdown
## [x] M<next>: XDG Base Directory Compliance (v0.25.0)
**Goal**: Honor $XDG_CONFIG_HOME for config and store caches in a per-workspace $XDG_CACHE_HOME location, with walk-up project-config discovery.

### Tests & Tasks
- [x] [M<next>-T01] Pure xdg-paths.ts module (config/cache dirs, key, walk-up, legacy cleanup)
- [x] [M<next>-T02] Migrate config.ts / aliases.ts / milestone-templates.ts to XDG
- [x] [M<next>-T03] Caches → keyed $XDG_CACHE_HOME with legacy cleanup
- [x] [M<next>-T04] Update user-facing path strings and docs
- [x] [M<next>-TS01] vitest unit tests for xdg-paths + per-module XDG tests
```

- [ ] **Step 3: Bump the version**

In `package.json` line 3: `"version": "0.24.1"` → `"version": "0.25.0"`.
In `src/cli.ts`, find the `.version('0.24.1')` (or equivalent version string) and change it to `0.25.0`. (Run `grep -n "0.24.1" src/cli.ts` to locate.)

- [ ] **Step 4: Full verification**

Run, in order:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

Expected: all succeed; vitest reports all suites passing.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md MILESTONES.md package.json src/cli.ts
git commit -m "docs: document XDG paths and bump to v0.25.0"
```

---

## Task 8 (optional): End-to-end CLI smoke test

**Files:**
- Create: `tests/scripts/test-xdg-paths.sh`

**Interfaces:** exercises the built CLI (`dist/index.js`) — run after `npm run build`.

- [ ] **Step 1: Write the smoke test**

Create `tests/scripts/test-xdg-paths.sh` (mark executable). It must:
1. Create a temp `HOME`, temp `XDG_CONFIG_HOME`, temp `XDG_CACHE_HOME`.
2. Run `node dist/index.js config set defaultTeam team_x --global` and assert `"$XDG_CONFIG_HOME/agent2linear/config.json"` exists.
3. Re-run with `XDG_CONFIG_HOME=relative/path` and assert the file lands under `$HOME/.config/agent2linear/` instead.
4. Create a project dir with `.agent2linear/`, `cd` into a nested subdir, run `config get defaultTeam` and assert the project value is read.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
export HOME="$ROOT/home"; mkdir -p "$HOME"
export XDG_CONFIG_HOME="$ROOT/xdgcfg"
CLI="node $(pwd)/dist/index.js"

$CLI config set defaultTeam team_x --global
test -f "$XDG_CONFIG_HOME/agent2linear/config.json" \
  && echo "PASS: global config honored XDG_CONFIG_HOME" \
  || { echo "FAIL: config not in XDG_CONFIG_HOME"; exit 1; }

XDG_CONFIG_HOME="relative/path" $CLI config set defaultTeam team_y --global
test -f "$HOME/.config/agent2linear/config.json" \
  && echo "PASS: relative XDG_CONFIG_HOME ignored (fell back to ~/.config)" \
  || { echo "FAIL: relative value not ignored"; exit 1; }

echo "All XDG path smoke tests passed."
```

- [ ] **Step 2: Run it**

Run: `npm run build && bash tests/scripts/test-xdg-paths.sh`
Expected: all `PASS` lines, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tests/scripts/test-xdg-paths.sh
git commit -m "test: add end-to-end XDG path smoke test"
```

---

## Self-Review

**1. Spec coverage**
- §2 `xdg-paths.ts` module + safety rule → Task 1 ✓
- §3 dependency direction (pure, apiKey as param) → Task 1 (`workspaceCacheDir(apiKey?)`) ✓
- §4 cache key derivation + walk-up semantics → Task 1 ✓ (home-boundary-first loop)
- §5 config resolution (read walk-up / write cwd-fallback; precedence) → Tasks 2-4 ✓
- §6 user-level keyed cache → Task 5 ✓ (`status-cache.ts` directly asserted; `project-resolver.ts` is migrated identically but relies on the shared `workspaceCacheDir` helper + typecheck — its `addToCache` is internal and needs the live API, so it has no direct unit assertion)
- §7 legacy cleanup (E2) → Task 1 (`cleanupLegacyProjectCaches`) + Task 5 (hooked into both cache modules) ✓
- §8 edge cases → covered by Task 1 unit tests (relative/empty/unset, default bucket, nested, home boundary, root) ✓
- §9 files touched → Tasks 2-7 cover every listed file ✓
- §10 testing → vitest unit tests (Tasks 1-5) + optional bash smoke test (Task 8). **Deviation from spec:** spec assumed bash-only because it believed no unit framework existed; the repo actually has vitest with co-located `src/lib/*.test.ts`, so unit tests are the correct, established pattern. Bash smoke test retained as optional Task 8.
- §11 non-goals (no STATE/DATA, no cascade, no `XDG_CONFIG_DIRS`) → respected; none added ✓
- §12 backwards-compat/migration → Task 5 legacy cleanup + Task 7 docs ✓

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" placeholders. Every code step shows real code. Milestone number is the only intentionally-variable value (Task 7 Step 2 instructs reading `MILESTONES.md` for the next `M##`) — content is fully specified.

**3. Type consistency:** Signatures are stable across tasks: `userConfigDir()`, `userCacheDir()`, `workspaceCacheKey(apiKey?)`, `workspaceCacheDir(apiKey?)`, `findProjectConfigDir(startDir?, home?)`, `projectConfigWriteDir(startDir?, home?)`, `cleanupLegacyProjectCaches(startDir?, home?)` — defined in Task 1 and consumed verbatim in Tasks 2-5. Accessor return types (`string` / `string | null`) match across config/aliases/templates.

**Deviation note (signatures):** the committed spec showed `findProjectConfigDir(): string | null` with no params; this plan adds optional `startDir`/`home` parameters (defaulting to `process.cwd()`/`homedir()`) purely for unit-test injectability. Production call sites are unchanged. This is a strict superset of the spec signature.
