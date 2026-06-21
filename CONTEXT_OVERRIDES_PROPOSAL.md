# Context-Aware Config Overrides Proposal

## Executive Summary

**Problem:** `agent2linear` resolves defaults (`defaultTeam`, `defaultInitiative`,
`defaultProject`, templates, aliases, …) from a single flat `config.json` per scope.
In a monorepo, every subtree wants different defaults ("issues under `cli/` go to the
CLI team, issues under `apps/web/` go to the Web team"). Across many repos on one
machine, you want "all of my employer's repos default to the Eng team" without editing
each repo. Today the only knob is one global value and one repo-wide value — there is no
way to vary defaults *by where you are* or *by which repo you're in*.

**Proposal:** Add an `overrides` array to `config.json` (at both global and repo scope).
Each override is a `{ "when": { … }, …config }` rule: when the current **context**
(filesystem location, repo identity, branch) matches the `when` clause, that rule's
config values apply. Resolution is **field-level, most-specific-wins**, and overrides
from the global and repo layers are **concatenated**. The design follows the conventions
proven by ESLint/Prettier (`overrides[]`) and Git's conditional includes
(`gitdir` / `hasconfig:remote.*.url` / `onbranch`), while improving on Git's
remote-URL matching by normalizing identity to `host/owner/name`.

**Non-goals:** This never affects `apiKey` or which workspace you talk to — only the
*defaults* a command starts from. Explicit CLI flags always win.

---

## Table of Contents

1. [Motivating Use Cases](#1-motivating-use-cases)
2. [Current State](#2-current-state)
3. [Prior Art & Conventions](#3-prior-art--conventions)
4. [The "Follows the Clone, Not the Repo" Problem](#4-the-follows-the-clone-not-the-repo-problem)
5. [Proposed Design](#5-proposed-design)
   - 5.1 [Schema](#51-schema)
   - 5.2 [Matchers (`when`)](#52-matchers-when)
   - 5.3 [Path Anchoring](#53-path-anchoring)
   - 5.4 [Repo Identity Normalization](#54-repo-identity-normalization)
   - 5.5 [Resolution Algorithm](#55-resolution-algorithm)
   - 5.6 [Precedence & Tie-Breaking](#56-precedence--tie-breaking)
6. [Worked Examples](#6-worked-examples)
7. [CLI & UX](#7-cli--ux)
8. [Technical Implementation](#8-technical-implementation)
9. [Edge Cases](#9-edge-cases)
10. [Security & Trust](#10-security--trust)
11. [Backward Compatibility](#11-backward-compatibility)
12. [Open Questions / Future Work](#12-open-questions--future-work)

---

## 1. Motivating Use Cases

| # | Scenario | Desired behavior |
|---|----------|------------------|
| U1 | **Monorepo routing** | In one repo, `cli/**` → team `cli-team`, `apps/web/**` → `web-team`, everything else → repo-wide `platform`. |
| U2 | **Field inheritance** | A path rule overrides only `defaultTeam`; `defaultInitiative` still falls back to the repo-wide value. |
| U3 | **Org-wide default (machine)** | Every repo under owner `acme` defaults to team `acme-eng`, set once globally — no per-repo edits, works for future repos. |
| U4 | **Repo + subpath** | "In `acme/web`, under `apps/mobile/**`, default to `mobile`." Combine a subpath rule with the repo's own config (or an identity matcher globally). |
| U5 | **Branch-scoped** | On `release/*` branches, default initiative `hardening`. |
| U6 | **Generic alias remap** | A generic alias `default` resolves to different team IDs in different subtrees. |
| U7 | **Disk-location fallback** | Anything under `~/scratch/**` (no/irrelevant remote) → personal team. |

---

## 2. Current State

**File:** `src/lib/config.ts`

- One `config.json` name at two scopes:
  - **Global:** `~/.config/agent2linear/config.json` (`$XDG_CONFIG_HOME/...`).
  - **Repo-local:** `.agent2linear/config.json`, found by walking up to the nearest
    `.agent2linear/` (stops at `$HOME`) — `xdg-paths.ts:findProjectConfigDir`.
- Merge is **repo overrides global**, field by field (`{...global, ...project}` —
  `config.ts:196`). `apiKey` additionally honors the `LINEAR_API_KEY` env var.
- Overridable keys today (`VALID_CONFIG_KEYS`, `config.ts:276`): `defaultInitiative`,
  `defaultTeam`, `defaultProject`, `defaultIssueTemplate`, `defaultProjectTemplate`,
  `defaultMilestoneTemplate`, `defaultAutoAssignLead`, plus cache tunables.
- `getConfig()` already tracks **provenance** per field (`ResolvedConfig.locations`),
  reporting whether each value came from `project`, `global`, `env`, or `none`.

There is **no** mechanism to vary any of these by directory, repo, or branch.

---

## 3. Prior Art & Conventions

| Source | Mechanism | What we borrow |
|--------|-----------|----------------|
| **ESLint / Prettier** | `overrides: [{ files:[glob], …settings }]`, later entry wins, merged | The **`overrides[]` name and shape** (array of conditional config blocks). |
| **CODEOWNERS** | path glob → team; gitignore-style globs | Domain fit (path → team); gitignore glob syntax. |
| **.gitignore** | `*`, `**`, leading `/` anchor, trailing `/`, `!` negation | **Glob semantics** for `path`. |
| **EditorConfig** | cascading glob sections, nearer wins, properties merge | Field-level merge + most-specific-wins. |
| **Git `includeIf`** | `gitdir:` (path), `hasconfig:remote.*.url:` (identity), `onbranch:` (branch) | The **matcher families**; `**`/trailing-`/` conventions; the identity-vs-location lesson. |
| **CI configs** (Actions `if:`, GitLab `rules:`) | conditional `when` clauses | The **`when` keyword** for the matcher block. |

**Git's three conditions, precisely:**

- `gitdir:` / `gitdir/i:` — matches the **`.git` directory path on disk**. `**/` and
  `/**` match multiple path components; a trailing `/` auto-appends `**`
  (`foo/` ≡ `foo/**`); leading `~/` → `$HOME`, `./` → config-file dir; with no anchor,
  `**/` is auto-prepended. `/i` = case-insensitive.
- `hasconfig:remote.*.url:` — matches the repo's **remote URL** (Git 2.36, 2022). Added
  precisely because `gitdir` follows the clone, not the repo.
- `onbranch:` — matches the **current branch** name (same glob rules).

**Where we deliberately deviate:** Git auto-prepends `**/` to unanchored `gitdir`
patterns (so `foo/bar` matches at any depth), which is surprising. We borrow gitignore's
*wildcard tokens* (`*`, `**`, trailing `/`, `!`) but **not** its match-at-any-depth
default: a relative `path` is matched against the repo-root-relative path and is therefore
**anchored at the repo root** (use `**` explicitly for any-depth) — closer to CODEOWNERS'
leading-slash patterns or ESLint `files` globs. Absolute patterns (`~/…`, `/…`) are disk
matches (see §5.3). We also **improve on `hasconfig:remote.*.url`**: Git matches the raw
URL string, so SSH and HTTPS forms need two patterns; we normalize to `host/owner/name`,
so one `owner: acme` rule covers both.

Sources: [git-config docs](https://git-scm.com/docs/git-config) ·
[onbranch commit 07b2c0e](https://github.com/git/git/commit/07b2c0eacac91c8db1a371667ed621cff443cf0d) ·
[ESLint overrides](https://eslint.org/docs/latest/use/configure/configuration-files) ·
[Prettier overrides](https://prettier.io/docs/en/configuration.html#configuration-overrides).

---

## 4. The "Follows the Clone, Not the Repo" Problem

Two matcher families with opposite portability:

- **Location matchers** — an **absolute** `path` (`~/work/…`, `/checkout/…`), like Git's
  `gitdir`. Matches the working tree's **spot on this disk**. *Fragile:* a different
  clone directory, another machine, or a CI checkout path (`/home/runner/work/…`)
  silently won't match. Correct only when you literally mean "this folder on this disk,"
  or when the repo has **no remote**.
- **Identity matchers** — `repo` / `owner` / `host`, like Git's
  `hasconfig:remote.*.url`. Read from the remote URL, so they **travel with the repo**
  across clones, machines, and CI. Portable.

**Git itself lived this:** it shipped `gitdir` first, then added
`hasconfig:remote.*.url` specifically because path matching follows the clone, not the
repo. We encode the lesson as guidance: **prefer identity matchers; use absolute-path
matchers only as an escape hatch.** The compound rule (§5.3) gives the best of both —
identity anchors the rule to the repo, and a *relative* `path` refines within it,
portably.

---

## 5. Proposed Design

### 5.1 Schema

```jsonc
{
  // Top-level fields = the implicit catch-all (lowest specificity), unchanged.
  "defaultTeam": "platform",
  "defaultInitiative": "q3-roadmap",

  "overrides": [
    {
      "when": { "owner": "acme" },
      "defaultTeam": "acme-eng"
    },
    {
      // compound matcher = logical AND; precedence is governed by §5.6 (in global
      // config this loses to acme/web's own repo config — see §6).
      "when": { "repo": "acme/web", "path": "apps/mobile/**" },
      "defaultTeam": "mobile"
    },
    {
      "when": { "path": "cli/**" },
      "defaultTeam": "cli-team",
      "aliases": { "teams": { "default": "team_cli123" } }  // per-rule alias override (namespaced by entity type; value is a Linear ID)
    },
    {
      "when": { "branch": "release/*" },
      "defaultInitiative": "hardening"
    },
    {
      "when": { "path": "~/scratch/**" },        // absolute → disk match
      "defaultTeam": "personal"
    }
  ]
}
```

- A rule's value fields are **the same overridable keys that `config.json` supports
  today** (team, initiative, project, templates, autoAssignLead) **plus an `aliases`
  block**. Aliases are *not* a top-level `config.json` field today (they live in
  `aliases.json`); inside a rule they are **namespaced by entity type**, matching that
  store's shape — `{ teams: { <alias>: <linearId> }, initiatives: { … }, … }` — where each
  value is a Linear ID (`alias → ID`), exactly as `resolveAlias(entityType, …)` expects.
- **`apiKey` is NOT overridable** in a rule (security; no use case).
- `overrides` is optional and additive. Absent ⇒ behavior identical to today.

TypeScript (in `src/lib/types.ts`):

```ts
export interface WhenClause {
  repo?: string;    // "owner/name" glob, e.g. "acme/web", "acme/*"
  owner?: string;   // owner/group path glob, e.g. "acme"
  host?: string;    // host glob, e.g. "github.com"
  path?: string;    // gitignore-style glob (relative = repo-anchored; ~//abs = disk)
  branch?: string;  // branch glob, e.g. "release/*"
}

export type OverridableConfig = Pick<Config,
  | 'defaultTeam' | 'defaultInitiative' | 'defaultProject'
  | 'defaultIssueTemplate' | 'defaultProjectTemplate' | 'defaultMilestoneTemplate'
  | 'defaultAutoAssignLead'
> & {
  // `Aliases` is the existing namespaced map ({ teams, initiatives, ... }),
  // each entity type holding an `AliasMap` of `alias -> Linear ID`.
  aliases?: Partial<Aliases>;
};

export interface ConfigOverride extends OverridableConfig {
  when: WhenClause;
}

// Config gains:  overrides?: ConfigOverride[]
```

### 5.2 Matchers (`when`)

A rule **matches** only if **every** present criterion matches (logical AND). An empty
or absent `when` (the top-level config) always matches — it is the catch-all.

| Key | Matches against | Pattern |
|-----|-----------------|---------|
| `repo` | normalized `owner/name` of the origin remote | glob (`acme/web`, `acme/*`) |
| `owner` | normalized owner/group path | glob (`acme`, `acme/platform`) |
| `host` | normalized host | glob (`github.com`, `*.gitlab.com`) |
| `path` | cwd (see §5.3) | gitignore-style glob |
| `branch` | current branch | glob (`release/*`) |

Identity matchers (`repo`/`owner`/`host`) are meaningful only when the repo has a
resolvable remote; they simply don't match otherwise. They are allowed in repo-local
files but are redundant there (the file is already repo-scoped).

### 5.3 Path Anchoring

This is the unification that dissolves the earlier "global = absolute, repo = relative"
split. **Anchoring depends on the pattern, not on which file the rule lives in:**

- A `path` starting with `~/` or `/` is an **absolute disk match** (Git `gitdir` style)
  — the escape hatch for §4.
- Any other `path` is **relative to the repo root** and matched against
  `relative(repoRoot, cwd)`. The repo root is resolved at runtime (the dir containing
  the discovered `.agent2linear/`, else the Git work-tree root).

Because the repo root is resolved at runtime, a **relative `path` works identically in
global and repo-local files**. Combined with an identity matcher (U4), the rule becomes
*portable* — identity makes it follow the repo, the relative path refines within it.

Glob conventions: we use gitignore's wildcard *tokens* — `*` (one path segment), `**`
(zero or more segments), trailing `/` ≡ `/**`, `!` (negation) — but a **relative** pattern
is **anchored at the repo root** (matched against `relative(repoRoot, cwd)`), so `cli/**`
means "under `<repoRoot>/cli`," **not** "any `cli/` at any depth." Use a leading `**/`
explicitly for any-depth matching (e.g. `**/cli/**`). A leading `~/` or `/` switches the
pattern to an **absolute disk match** (per the first bullet above). We do **not**
auto-prepend `**/` (Git's surprising behavior).

### 5.4 Repo Identity Normalization

Resolve the `origin` remote URL and normalize across forms:

| Raw URL | host | owner | name |
|---------|------|-------|------|
| `git@github.com:acme/web.git` | `github.com` | `acme` | `web` |
| `https://github.com/acme/web.git` | `github.com` | `acme` | `web` |
| `ssh://git@gitlab.com/acme/platform/web.git` | `gitlab.com` | `acme/platform` | `web` |

Rules: strip a trailing `.git`; accept `scheme://`, `user@host:path`, and `ssh://…`
forms; the **last** path segment is `name`, the rest is `owner` (supports nested GitLab
groups). `repo` matches `owner/name`; `owner` matches the owner path; `host` matches the
host. v1 consults **`origin` only** (forks: add an explicit `repo` rule).

### 5.5 Resolution Algorithm

```
1. Build runtime context (lazily; only if any override has when-criteria):
     cwd, repoRoot, identity {host, owner, name}, branch.
2. Gather layers:
     globalCfg  = read ~/.config/.../config.json
     repoCfg    = read nearest .agent2linear/config.json (or {})
3. Build candidate rules (in order):
     [ {when:{}, ...globalCfg top-level fields},      // global catch-all
       ...globalCfg.overrides,                         // global overrides
       {when:{}, ...repoCfg top-level fields},         // repo catch-all
       ...repoCfg.overrides ]                          // repo overrides   (CONCATENATE)
4. Keep rules whose `when` matches the context (AND across criteria).
5. For EACH overridable field independently, pick the value from the WINNING matching
     rule that sets it, where "winning" is decided by, in order (§5.6):
       (a) SCOPE  — repo-local beats global;
       (b) SPECIFICITY within the scope;
       (c) declaration order — later wins.
     (the `aliases` block merges per entity type, then per alias key, by the same order.)
6. apiKey resolves as today (env > repo > global); never from overrides.
7. Explicit CLI flags override the resolved value.
```

Field-level merge (U2): a rule setting only `defaultTeam` leaves `defaultInitiative` to
be resolved from less-specific rules.

### 5.6 Precedence & Tie-Breaking

Per field, the winning rule is chosen by this **lexicographic sort** (the first key
decides; later keys only break ties):

1. **Scope (primary): repo-local beats global.** A rule in the repo's
   `.agent2linear/config.json` always wins over any rule in the global config —
   *regardless of specificity*. This matches Git/ESLint/Prettier/EditorConfig (locality
   dominates), and it protects committed, shared repo config from being silently
   overridden by a personal global file. Guidance: use **global** config for coarse,
   cross-repo fallbacks (mostly identity); use **repo** config for authoritative,
   fine-grained routing.
2. **Specificity (within a scope)**, most → least specific:
   1. **Exact `repo`** (no wildcard) — strongest identity.
   2. **`repo` glob / `owner` / `host`** identity.
   3. **`path`** — finer = **more leading literal (non-wildcard) path segments**, then
      fewer wildcard segments. Specificity is counted in **path segments, never raw
      string length**; relative and absolute `path`s are scored the same way (by segment
      count), so an absolute pattern is not "more specific" merely for being a longer
      string.
   4. **`branch`** presence.
   5. The **catch-all** (empty `when`) is lowest.
   A compound `when` sums its criteria, so *within a scope* `repo` + `path` outranks
   `owner` alone, which outranks a bare `path`.
3. **Declaration order:** later-declared wins within the same scope and specificity.

Because the winner is score-based (file order matters only as the final tie-break),
reordering rules within a scope cannot change behavior except on exact ties — unlike
CODEOWNERS' order-sensitive last-match.

---

## 6. Worked Examples

**Monorepo (U1, U2, U6)** — repo-local `.agent2linear/config.json`, committed:

```jsonc
{
  "defaultTeam": "platform",
  "defaultInitiative": "q3-roadmap",
  "overrides": [
    { "when": { "path": "cli/**" },      "defaultTeam": "cli-team",
                                          "aliases": { "teams": { "default": "team_cli123" } } },
    { "when": { "path": "apps/web/**" }, "defaultTeam": "web-team" },
    { "when": { "path": "packages/foo/**" }, "defaultTeam": "foo-team",
                                              "defaultInitiative": "foo-initiative" }
  ]
}
```

- From `apps/web/src/`: `defaultTeam=web-team` (path rule), `defaultInitiative=q3-roadmap`
  (inherited catch-all). `a2l issue create …` needs no `--team`.
- From `packages/foo/`: both team and initiative come from the foo rule.
- From repo root: catch-all `platform` / `q3-roadmap`.

**Machine-wide identity (U3, U7)** — global `~/.config/agent2linear/config.json` holds
*coarse, cross-repo* fallbacks:

```jsonc
{
  "overrides": [
    { "when": { "owner": "acme" },        "defaultTeam": "acme-eng" },
    { "when": { "path": "~/scratch/**" }, "defaultTeam": "personal" }
  ]
}
```

**Repo + subpath (U4)** — fine-grained routing belongs in the repo's own
`acme/web/.agent2linear/config.json`, where it is committed, shared, and — per §5.6 —
authoritative over the global fallback:

```jsonc
{
  "defaultTeam": "web-platform",
  "overrides": [
    { "when": { "path": "apps/mobile/**" }, "defaultTeam": "mobile" }
  ]
}
```

In any `acme/*` checkout with **no** repo config you get `acme-eng` (global fallback). In
`acme/web` you get the repo's `web-platform` — which beats the global `owner: acme` rule
because **repo scope wins** (§5.6) — and under `apps/mobile/` the more-specific repo rule
gives `mobile`. Under `~/scratch` you get `personal`. Global and repo overrides are both
considered (concatenated), then sorted per §5.6.

---

## 7. CLI & UX

- **Authoring:** `config edit [--global|--project]` (exists) opens `config.json` for
  hand-editing the `overrides` array. Structured `config override add/list/remove`
  subcommands are deferred (JSON-array editing via flags is awkward); see §12.
- **Provenance:** extend `ResolvedConfig.locations[field]` with a new source type
  `{ type: 'override', scope, ruleIndex, when }` so existing `config list` output shows
  *which rule* supplied each value.
- **New `config explain` (a.k.a. `config which`):** for the current context, print each
  resolved field, its value, and the winning rule — the answer to "why did it pick team
  X here?" Include resolved context (cwd, repoRoot, identity, branch) and the ordered
  list of matching rules with scores. This is the key debuggability feature.

```
$ a2l config explain
context:
  cwd        /home/me/acme/web/apps/mobile/feature
  repoRoot   /home/me/acme/web
  identity   github.com  acme/web
  branch     feature/login
resolved:
  defaultTeam        mobile        ← global override #2  when{repo:acme/web, path:apps/mobile/**}
  defaultInitiative  q3-roadmap    ← repo catch-all
```

---

## 8. Technical Implementation

| Area | Change |
|------|--------|
| `src/lib/types.ts` | Add `WhenClause`, `OverridableConfig`, `ConfigOverride`; add `overrides?` to `Config`. |
| `src/lib/git-context.ts` *(new)* | Resolve `repoRoot`, `origin` URL → `{host, owner, name}` (normalize SSH/HTTPS/ssh://, strip `.git`, nested groups), current branch. Pure, lazily invoked, process-cached. |
| `src/lib/glob-match.ts` *(new)* | gitignore-style matcher (`*`/`**`/trailing-`/`/leading-`/`/`!`), plus identity/branch glob match. Reuse a vetted lib (e.g. `picomatch`/`minimatch`) rather than hand-roll. |
| `src/lib/overrides.ts` *(new)* | `resolveOverrides(context, layers)` → per-field winner + provenance; specificity scoring (§5.6). |
| `src/lib/config.ts` | In `getConfig()`: after building `merged`, apply override resolution per field; populate `locations[...] = { type: 'override', … }`; **concatenate** global+repo `overrides` instead of letting the repo array replace the global one. Keep `apiKey` path untouched. |
| `src/commands/config/explain.ts` *(new)* | Implements `config explain`. |
| Tests | `tests/scripts/test-config-overrides.sh` (integration) + unit tests for glob-match, git-context normalization, and specificity ordering (Vitest, matching existing `*.test.ts`). |

**Performance:** the Git context is resolved lazily and only when at least one override
declares an identity/path/branch matcher; result cached for the process. Pure path-only
configs that don't use overrides pay nothing.

---

## 9. Edge Cases

| Case | Behavior |
|------|----------|
| Not in a Git repo / no remote | Identity matchers don't match. Relative `path` rules anchor to the discovered `.agent2linear/` dir if present, else are skipped. Absolute `path` and catch-all still apply. |
| Multiple remotes | v1 uses `origin`. Forks: add an explicit `repo` rule (documented). |
| Detached HEAD / no branch | `branch` matchers don't match; everything else unaffected. |
| Git worktrees | Branch and root resolved via Git; works normally. |
| Invalid glob / unknown `when` key | Warn (stderr) and skip that rule; never crash resolution. |
| `path` escapes repo root (`../`) | Treated as a disk path comparison; documented as discouraged. |
| Conflicting equal-specificity rules | Tie-break: repo layer > global layer > later declaration (§5.6). |

---

## 10. Security & Trust

- Overrides **never** touch `apiKey` or which workspace is contacted — only *defaults*.
- A repo-local `config.json` is **committed and therefore trusted**; it can already set
  `defaultTeam` today, so per-path defaults are not a new trust boundary. The new wrinkle
  is an `aliases` override remapping a generic team alias (e.g. `teams.default`) to an
  arbitrary ID — still resolved
  against *your* workspace via *your* key, and still just a default you can override with
  a flag. Acceptable; called out so it's a conscious decision.
- `config explain` makes any surprising routing visible, mitigating "silently sent to the
  wrong team."

---

## 11. Backward Compatibility

- `overrides` is **additive and optional**. Configs without it behave exactly as today.
- The only merge-semantics change is that `overrides` arrays **concatenate** across
  global+repo (previously there were none, so nothing breaks).
- `getConfig()`'s return shape is a superset (new `override` provenance type); existing
  consumers that read merged scalar fields are unaffected.

---

## 12. Open Questions / Future Work

- **Structured authoring** (`config override add/list/remove`) vs. hand-editing JSON.
- **`onbranch`-style extras**: `host` is included; do we want `remote` (match a specific
  named remote) or multi-remote matching beyond `origin`?
- **Negation / exclusion** at the rule level (gitignore `!` covers path negation; do we
  want `when.not`?).
- **`extends`/includes** if `overrides` arrays grow large enough to warrant splitting out
  of `config.json` (the routes.json option we deferred).
