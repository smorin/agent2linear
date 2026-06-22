# Design Spec: XDG Base Directory Compliance

**Date:** 2026-06-19
**Status:** Approved (design), pending implementation plan
**Related:** `.humanlayer/tasks/xdg-base-directory-configuration-and-assessment/xdg-compliance-assessment.md` (the audit that motivated this work)

---

## 1. Background & motivation

The audit found that agent2linear is **not** XDG-compliant: it hardcodes `homedir() + '.config' + 'agent2linear'` in three modules and never reads `$XDG_CONFIG_HOME` (a grep for `XDG` across `src/` returns zero matches). It happens to land on XDG's *default* path, so default-config users see correct behavior, but anyone who relocates their config dir via `$XDG_CONFIG_HOME` is silently ignored. Separately, two caches (`cache.json`, `project-cache.json`) live mixed into the per-project `.agent2linear/` dir rather than in a cache location.

This spec closes audit findings **#1** (config env var not honored), **#2** (no cache-home concept), and **#4** (config/cache mixed in the project dir). Findings #3 (`STATE_HOME`/`DATA_HOME`) and the data-vs-config question (#5) are explicitly **out of scope** — see §11.

### How XDG works (the contract being implemented)

XDG governs the **user home directory** only. Relevant base dirs:

| Variable | Default | Purpose |
|----------|---------|---------|
| `$XDG_CONFIG_HOME` | `~/.config` | User-specific configuration |
| `$XDG_CACHE_HOME` | `~/.cache` | Non-essential cached data (safe to delete) |

Compliance contract for each: (1) read the env var; (2) if set, non-empty, **and absolute**, use it; (3) otherwise fall back to the default. Relative or empty values MUST be ignored (treated as unset).

---

## 2. Approved decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | **B** — honor `$XDG_CONFIG_HOME` for config; route caches through `$XDG_CACHE_HOME` |
| 2 | Cache placement | **B1 keyed** — promote caches to user-level `~/.cache/agent2linear/`, partitioned per workspace |
| 3 | Project-config discovery | **C2** — walk up parent directories from cwd |
| 4a | Walk-up multiplicity | **Nearest-only** — use the first `.agent2linear/` found; no cascade/merge |
| 4b | Walk-up boundary | **Stop at `$HOME`** (and at filesystem root `/` for paths outside home) |
| 5 | Cache key derivation | **D1 + default fallback** — `sha256(apiKey).slice(0,12)`, or `default` when no key |
| 6 | Legacy project-local caches | **E2** — auto-delete the two known cache filenames on next run |

Treated as config (decision from audit #5): `aliases.json` and `milestone-templates.json` stay in `$XDG_CONFIG_HOME`. No `$XDG_DATA_HOME` usage.

---

## 3. Architecture overview

Introduce one **pure** module, `src/lib/xdg-paths.ts`, as the single source of truth for filesystem locations. Every other module asks it for paths instead of hardcoding them. The module depends only on `os`, `path`, `process.env`, and `crypto` — never on `config.ts` — to avoid a dependency cycle (`config → xdg-paths → config`). The API key needed for cache-keying is passed in as a *parameter*, not imported.

```
                    ┌─────────────────────┐
                    │  src/lib/xdg-paths  │  (pure: os, path, process.env, crypto)
                    └─────────┬───────────┘
        ┌──────────────┬──────┴───────┬──────────────────┐
        ▼              ▼              ▼                  ▼
   config.ts      aliases.ts   milestone-          status-cache.ts
                                templates.ts        project-resolver.ts
   (user + project config dirs)                     (workspace cache dir)
```

---

## 4. New module: `src/lib/xdg-paths.ts`

```ts
/** User-level config dir: $XDG_CONFIG_HOME/agent2linear else ~/.config/agent2linear */
export function userConfigDir(): string;

/** User-level cache root: $XDG_CACHE_HOME/agent2linear else ~/.cache/agent2linear */
export function userCacheDir(): string;

/** Cache partition key: sha256(apiKey)[:12], or 'default' if apiKey is empty/undefined */
export function workspaceCacheKey(apiKey?: string): string;

/** Per-workspace cache dir: userCacheDir()/<workspaceCacheKey(apiKey)> */
export function workspaceCacheDir(apiKey?: string): string;

/** Walk up from cwd toward $HOME; return path to nearest `.agent2linear/` dir, or null */
export function findProjectConfigDir(): string | null;

/** Where a `--scope project` write lands: findProjectConfigDir() ?? join(cwd, '.agent2linear') */
export function projectConfigWriteDir(): string;
```

### XDG safety rule (shared internal helper)

`userConfigDir` and `userCacheDir` resolve via a small internal helper:

```
resolveXdgBase(envVar, defaultRelativeToHome):
  v = process.env[envVar]
  if v is a non-empty, absolute path → return join(v, 'agent2linear')
  else → return join(homedir(), defaultRelativeToHome, 'agent2linear')
```

`defaultRelativeToHome` is `.config` for config and `.cache` for cache. Absoluteness is checked with `path.isAbsolute`.

### Cache key derivation

```
workspaceCacheKey(apiKey):
  if !apiKey || apiKey.trim() === '' → return 'default'
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 12)
```

The hash means the secret never appears in a path; lookup is synchronous and offline. Rotating the API key starts a fresh cache (harmless — caches re-warm from one API call).

### Walk-up semantics (`findProjectConfigDir`)

```
dir = process.cwd()
home = homedir()
loop:
  if dir === home → return null                    # $HOME boundary: never test or pass home
  candidate = join(dir, '.agent2linear')
  if exists(candidate) and it is a directory → return candidate
  parent = dirname(dir)
  if parent === dir → return null                  # filesystem root
  dir = parent
```

Nearest match wins (returns on first hit). The `$HOME` check happens *before* testing each directory, so a `.agent2linear/` located at `$HOME` (or above it) is **never** treated as project config — that would shadow every project under home, the footgun decision 4b prevents. Paths outside `$HOME` walk up to the filesystem root.

---

## 5. Config resolution (user + project tiers)

**Read** — `getConfig()`, `loadAliases()`, `loadMilestoneTemplates()`:
- Global file: `join(userConfigDir(), '<file>.json')`
- Project file: `const d = findProjectConfigDir(); d ? join(d, '<file>.json') : null` (skip if null)
- Merge precedence unchanged: **project > global > env**, except **API key: env > project > global**.

**Write** — `setConfigValue()`, `setDefaultInitiative()`, `addAlias()`, `removeAlias()`, `updateAliasId()`, `renameAlias()`, `clearAliases()`, milestone-template writes:
- `--scope global` → `join(userConfigDir(), '<file>.json')`
- `--scope project` → `join(projectConfigWriteDir(), '<file>.json')`

Read and write target the **same** project file (the discovered ancestor, or cwd if none exists), so `config set --scope project` always updates the file `config list` reads.

**Path accessors** (`getGlobalConfigPath`, `getProjectConfigPath`, `getGlobalAliasesPath`, `getProjectAliasesPath`, etc.) return the *resolved* absolute paths. All user-facing "your config is at …" strings switch to calling these instead of printing a hardcoded `~/.config/agent2linear/`.

---

## 6. Cache resolution (user-level, keyed)

`status-cache.ts` and `project-resolver.ts` replace their `CACHE_DIR = '.agent2linear'` constant with a call to `workspaceCacheDir(getApiKey())`:

- `~/.cache/agent2linear/<key>/cache.json` (entity cache: statuses, teams, initiatives, members, templates, workflow states, labels)
- `~/.cache/agent2linear/<key>/project-cache.json` (project name→ID resolution)

One cache per workspace, shared across every directory the CLI is run from. `getApiKey()` already resolves env > project > global, so the cache automatically follows the active workspace.

---

## 7. Legacy cache cleanup (E2)

On cache-module initialization, look in both `join(cwd, '.agent2linear')` and `findProjectConfigDir()` (if non-null) for **exactly** `cache.json` and `project-cache.json`. Delete those two filenames if present. Never touch config files (`config.json`, `aliases.json`, `milestone-templates.json`). The operation is bounded to two known names, idempotent, and safe because caches are disposable.

---

## 8. Edge cases

| Situation | Behavior |
|---|---|
| `XDG_CONFIG_HOME` set & absolute | use `<value>/agent2linear` |
| `XDG_CONFIG_HOME` set but relative or empty | ignore → `~/.config/agent2linear` |
| `XDG_CACHE_HOME` | mirror of the above with `~/.cache` |
| No API key set | cache bucket = `default/` |
| Nested `.agent2linear/` up the tree | nearest ancestor wins |
| Walk-up reaches `$HOME` | stop; no project config (a `.agent2linear/` *at* `$HOME` is ignored) |
| Walk-up reaches filesystem root | stop; no project config |
| `--scope project` write, no project dir discovered | create `./.agent2linear/` in cwd |

---

## 9. Files touched

**New**
- `src/lib/xdg-paths.ts`

**Modify — path logic**
- `src/lib/config.ts` — replace `GLOBAL_CONFIG_DIR`/`PROJECT_CONFIG_*` constants with `userConfigDir()` / project discovery
- `src/lib/aliases.ts` — same pattern for aliases files
- `src/lib/milestone-templates.ts` — same pattern for templates files
- `src/lib/status-cache.ts` — `workspaceCacheDir(getApiKey())`; add legacy cleanup
- `src/lib/project-resolver.ts` — `workspaceCacheDir(getApiKey())`; add legacy cleanup

**Modify — display strings** (print resolved paths via the accessors)
- `src/commands/setup.tsx`
- `src/commands/config/register.ts`
- `src/commands/config/edit.tsx`
- `src/commands/alias/edit.tsx`
- `src/commands/milestone-templates/list.ts`
- `src/lib/sync-aliases.ts`

**Docs**
- `README.md` — config/cache location section
- `CLAUDE.md` — "Aliases System" / "Configuration" path references

---

## 10. Testing

Following the project's bash-integration convention in `tests/scripts/`, add `test-xdg-paths.sh`:

- **Config home honored:** set `XDG_CONFIG_HOME=/abs/tmp/xdgtest`; run `config set --scope global …`; assert the file lands under `/abs/tmp/xdgtest/agent2linear/`.
- **Relative value ignored:** set `XDG_CONFIG_HOME=relative/path`; assert write falls back to `~/.config/agent2linear/`.
- **Cache home honored & keyed:** set `XDG_CACHE_HOME=/abs/tmp/xdgcache` with a known `LINEAR_API_KEY`; warm a cache (e.g. a list command); assert `cache.json` appears under `/abs/tmp/xdgcache/agent2linear/<expected-hash>/`.
- **Default cache bucket:** unset `LINEAR_API_KEY` path where applicable; assert `default/` bucket.
- **Walk-up:** create `.agent2linear/config.json` in a temp project root, `cd` into a nested subdir, assert the project config is discovered; assert a `.agent2linear/` at `$HOME` is *not* picked up.
- **Legacy cleanup:** seed a legacy `./.agent2linear/cache.json`, run any command, assert it is deleted while `config.json` remains.

Plus the standard gates: `npm run build`, `npm run typecheck`, `npm run lint` must pass.

---

## 11. Out of scope (non-goals)

- `$XDG_STATE_HOME` / `$XDG_DATA_HOME` support (audit finding #3) — no state/data category exists today; YAGNI.
- Moving `aliases.json` / `milestone-templates.json` to `$XDG_DATA_HOME` (audit #5) — decided: they are config.
- Cascading/merging multiple project configs up the tree (decision 4a chose nearest-only).
- `$XDG_CONFIG_DIRS` system-wide config search path (`/etc/xdg`) — not needed for this tool.
- A dedicated `a2l paths` debug command — existing `config list` already shows resolved locations.

---

## 12. Backwards compatibility & migration

- **Default-config users:** no migration needed. `~/.config/agent2linear/` already equals the XDG default, so config files are found exactly where they are today.
- **Users who set `$XDG_CONFIG_HOME`:** their config now resolves to the configured location — this is the intended fix, not a regression.
- **Caches:** existing project-local caches are auto-deleted (E2) and transparently re-created at the new user-level keyed location on first use. No user action required.
- **Project config files** (`./.agent2linear/*.json`): unchanged on disk; only *discovery* gains walk-up reach.
