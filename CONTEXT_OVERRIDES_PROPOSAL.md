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
config values apply. Resolution is **field-level**, with **repo scope beating global
scope** and most-specific-wins **within a scope**; overrides from the global and repo
layers are **concatenated** and then sorted by precedence (§5.6). The design follows the
conventions
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
     - 5.2.1 [Grammar reference](#521-grammar-reference)
     - 5.2.2 [Worked examples](#522-worked-examples)
   - 5.3 [Path Anchoring](#53-path-anchoring)
   - 5.4 [Repo Identity Normalization](#54-repo-identity-normalization)
   - 5.5 [Resolution Algorithm](#55-resolution-algorithm)
   - 5.6 [Precedence & Tie-Breaking](#56-precedence--tie-breaking)
   - 5.7 [Resolution Context & Targeting](#57-resolution-context--targeting)
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
| U8 | **Agent targets another directory** | An agent runs the CLI from its own workspace (or `/`) but means a *different* target dir; it must resolve (or query) defaults for that target, not the process cwd. |
| U9 | **Fork: base OR upstream** | In a fork (`origin = myuser/web`, `upstream = acme/web`), an `acme` identity rule should fire because the **upstream** matches even though `origin` doesn't. |

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
| **EditorConfig** | cascading glob sections, nearer wins, properties merge | Field-level (per-property) merge; closer/locality wins. |
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
      // Identity reads `origin` by default; match base OR upstream explicitly via anyOf.
      "when": {
        "anyOf": [
          { "owner": "acme" },                        // origin's owner is acme, OR
          { "remote": "upstream", "owner": "acme" }   // the upstream (parent) is acme
        ]
      },
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
// A `when` node. Leaf criteria present at a node are AND'd together; `anyOf`/`allOf`/`not`
// add JSON-Schema-style boolean composition and may nest. ALL keys present at a node are
// AND'd (so leaf criteria AND the composite results), e.g. `{ owner, anyOf:[…] }` means
// `owner AND (… OR …)`.
export interface WhenLeaf {
  repo?: string;    // "owner/name" glob, e.g. "acme/web", "acme/*"
  owner?: string;   // owner/group path glob, e.g. "acme"
  host?: string;    // host glob, e.g. "github.com"
  path?: string;    // path glob (relative = repo-anchored; leading ~/ or / = disk)
  branch?: string;  // branch glob, e.g. "release/*"
  // Which remote(s) the identity criteria (repo/owner/host) in THIS node read.
  // A remote name, list of names, or "*" (any remote). Omitted ⇒ "origin". Alone (no
  // identity criterion) ⇒ matches if a remote of that name exists (e.g. { remote: "upstream" }).
  // `(string & {})` keeps the "*" literal visible in editors without widening to `string`.
  remote?: '*' | (string & {}) | string[];
}
export interface WhenComposite {
  allOf?: WhenClause[]; // AND of children   (allOf: [] ⇒ true, vacuous)
  anyOf?: WhenClause[]; // OR of children    (anyOf: [] ⇒ false)
  not?: WhenClause;     // negation
}
export type WhenClause = WhenLeaf & WhenComposite;

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

A `when` node is evaluated with **JSON-Schema-style** semantics: every key present at a
node must hold (logical AND). Leaf **criteria** below are AND'd with each other and with
the results of any composite keys. An empty or absent `when` (the top-level config) always
matches — it is the catch-all.

**Leaf criteria:**

| Key | Matches against | Pattern |
|-----|-----------------|---------|
| `repo` | normalized `owner/name` of the selected remote(s) | glob (`acme/web`, `acme/*`) |
| `owner` | normalized owner/group path | glob (`acme`, `acme/platform`) |
| `host` | normalized host | glob (`github.com`, `*.gitlab.com`) |
| `path` | the context dir as a **repo-root-relative** path (or the absolute context dir for `~/`/`/` patterns) — see §5.3 | root-anchored glob (gitignore tokens) |
| `branch` | current branch | glob (`release/*`) |
| `remote` | the remote(s) the identity criteria in this node read; `string \| string[] \| "*"` | name / list / any |

**Boolean composites** (each is a child `when`, may nest):

| Key | Meaning |
|-----|---------|
| `allOf: [...]` | AND of children (`[]` ⇒ true) |
| `anyOf: [...]` | OR of children (`[]` ⇒ false) — this is how you express "base OR upstream" |
| `not: {...}` | negation |

**The `remote` qualifier.** Identity criteria (`repo`/`owner`/`host`) are evaluated against
the remote(s) named by `remote` in the *same* node; omitted ⇒ **`origin`** (explicit and
predictable — we do not implicitly fold in other remotes). `remote: ["origin","upstream"]`
ORs the identity check across those remotes; `remote: "*"` checks any remote (git's
`remote.*.url` model). `remote` **alone** (no identity criterion) matches if a remote of
that name exists — e.g. `{ "remote": "upstream" }` means "this is a fork with an upstream."
`path`/`branch` ignore `remote`. Identity criteria only match when the selected remote
resolves; they're allowed in repo-local files but redundant there (already repo-scoped).

"Upstream" is just the remote literally **named** `upstream` (read from git config); we do
**not** call the GitHub API to discover a fork's parent (stays offline/portable).

#### 5.2.1 Grammar reference

A `when` value is a **node**. Evaluation is JSON-Schema-style: a node matches iff **every
key present at that node** matches (AND); composite keys contribute their own boolean result.

```ebnf
when     = node ;
node     = "{" { criterion | composite } "}" ;   (* all entries AND together *)

criterion = "repo"   ":" glob              (* identity, read via `remote` (default origin) *)
          | "owner"  ":" glob              (* identity *)
          | "host"   ":" glob              (* identity *)
          | "path"   ":" glob              (* repo-anchored, or leading ~/ or / = disk — §5.3 *)
          | "branch" ":" glob
          | "remote" ":" ( name | name[] | "*" ) ;  (* selects remote(s) for identity above *)

composite = "allOf" ":" node[]             (* AND of children;  [] ⇒ true  *)
          | "anyOf" ":" node[]             (* OR  of children;  [] ⇒ false *)
          | "not"   ":" node ;             (* negation *)
```

Evaluation, precisely:

```
match(node) =
      AND over each criterion c present:  matchCriterion(c, ctx)
  AND (node.allOf ? every child matches            : true)
  AND (node.anyOf ? at least one child matches      : true)
  AND (node.not   ? !match(node.not)                : true)
```

Identity criteria in a node are tested against the remote(s) named by that node's `remote`
(default `origin`), OR'd if a list/`"*"`; `path`/`branch` ignore `remote`. Specificity of a
match (for §5.6 tie-breaking) comes from the leaf criteria that actually caused it — for
`anyOf`, the single most-specific matching branch.

#### 5.2.2 Worked examples

```jsonc
// 1. Base OR upstream (the fork case). Equivalent shorthand shown second.
{ "when": { "anyOf": [ { "owner": "acme" },
                       { "remote": "upstream", "owner": "acme" } ] },
  "defaultTeam": "acme-eng" }
{ "when": { "remote": ["origin", "upstream"], "owner": "acme" },   // same meaning
  "defaultTeam": "acme-eng" }

// 2. allOf — release branches of acme repos on GitHub get the hardening initiative.
//    (Top-level keys already AND, so allOf is only needed to AND *composites*; here it
//    reads clearly and groups the three identity/branch conditions.)
{ "when": { "allOf": [ { "host": "github.com" },
                       { "owner": "acme" },
                       { "branch": "release/*" } ] },
  "defaultInitiative": "hardening" }

// 3. not — everything under apps/** EXCEPT the sandbox app routes to the apps team.
{ "when": { "allOf": [ { "path": "apps/**" },
                       { "not": { "path": "apps/sandbox/**" } } ] },
  "defaultTeam": "apps" }

// 4. Mixed leaf + composite (all AND): owner acme AND (mobile path OR release branch).
{ "when": { "owner": "acme",
            "anyOf": [ { "path": "apps/mobile/**" }, { "branch": "release/*" } ] },
  "defaultTeam": "mobile" }

// 5. remote-only predicate — "this checkout is a fork" (has an `upstream` remote).
{ "when": { "remote": "upstream" }, "defaultInitiative": "fork-contributions" }
```

### 5.3 Path Anchoring

This is the unification that dissolves the earlier "global = absolute, repo = relative"
split. **Anchoring depends on the pattern, not on which file the rule lives in:**

- A `path` starting with `~/` or `/` is an **absolute disk match** (Git `gitdir` style)
  — the escape hatch for §4.
- Any other `path` is **relative to the repo root** and matched against
  `relative(repoRoot, contextDir)` (the context dir is `process.cwd()` by default, or
  `-C`/`AGENT2LINEAR_CWD` — §5.7). The repo root is resolved at runtime (the dir containing
  the discovered `.agent2linear/`, else the Git work-tree root).

Because the repo root is resolved at runtime, a **relative `path` works identically in
global and repo-local files**. Combined with an identity matcher (U4), the rule becomes
*portable* — identity makes it follow the repo, the relative path refines within it.

Glob conventions: we use gitignore's wildcard *tokens* — `*` (one path segment), `**`
(zero or more segments), trailing `/` ≡ `/**`, `!` (negation) — but a **relative** pattern
is **anchored at the repo root** (matched against `relative(repoRoot, contextDir)`), so `cli/**`
means "under `<repoRoot>/cli`," **not** "any `cli/` at any depth." Use a leading `**/`
explicitly for any-depth matching (e.g. `**/cli/**`). A leading `~/` or `/` switches the
pattern to an **absolute disk match** (per the first bullet above). We do **not**
auto-prepend `**/` (Git's surprising behavior).

### 5.4 Repo Identity Normalization

Resolve each remote's URL and normalize across forms (examples below use one remote):

| Raw URL | host | owner | name |
|---------|------|-------|------|
| `git@github.com:acme/web.git` | `github.com` | `acme` | `web` |
| `https://github.com/acme/web.git` | `github.com` | `acme` | `web` |
| `ssh://git@gitlab.com/acme/platform/web.git` | `gitlab.com` | `acme/platform` | `web` |

Rules: strip a trailing `.git`; accept `scheme://`, `user@host:path`, and `ssh://…`
forms; the **last** path segment is `name`, the rest is `owner` (supports nested GitLab
groups). `repo` matches `owner/name`; `owner` matches the owner path; `host` matches the
host. Note that `repo` is the **full `<owner>/<name>`** and may therefore contain **more
than two segments** for nested groups (e.g. `acme/platform/web`) — match those with a glob
such as `acme/**` or `acme/platform/*` as needed.

We resolve **every** remote into a `name → {host, owner, name}` map. Identity criteria
read **`origin` by default**; use the `remote` qualifier (§5.2) to read `upstream`, a
named remote, a list, or `"*"` (any). This makes the **fork** case first-class — match
"base OR upstream" with an `anyOf`, no `repo`-rule workaround needed.

### 5.5 Resolution Algorithm

```
1. Build runtime context (lazily; only if any override has when-criteria),
     rooted at the resolution-context dir (§5.7), NOT necessarily process.cwd():
     contextDir, repoRoot, branch, and remotes = { <name> -> {host, owner, name} }
     for every git remote (origin, upstream, ...).
2. Gather layers:
     globalCfg  = read ~/.config/.../config.json
     repoCfg    = read nearest .agent2linear/config.json (or {})
3. Build candidate rules (in order):
     [ {when:{}, ...globalCfg top-level fields},      // global catch-all
       ...globalCfg.overrides,                         // global overrides
       {when:{}, ...repoCfg top-level fields},         // repo catch-all
       ...repoCfg.overrides ]                          // repo overrides   (CONCATENATE)
4. Keep rules whose `when` tree matches (leaf criteria AND'd; `anyOf`/`allOf`/`not`
     and the `remote` qualifier per §5.2).
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
   `owner` alone, which outranks a bare `path`. Sub-tie-break for identity: a match via
   **`origin` outranks a match via a non-origin remote** (your fork's own identity beats
   the parent's).
3. **Declaration order:** later-declared wins within the same scope and specificity.

**Scoring composite `when` trees.** Specificity is computed from the **set of leaf
criteria that actually caused the match**: an `allOf` (and plain AND'd leaves) sums all its
matched leaves; an `anyOf` contributes its **single most-specific matching branch**; `not`
contributes only a small presence weight (never negative). So the `anyOf` "base OR
upstream" example scores like a single `owner` identity match — exactly as if you'd written
the matching branch directly. A bare `remote`-presence predicate (`{ "remote": "upstream" }`,
no identity criterion) scores at the identity-**presence** tier (alongside `host`), below any
`repo`/`owner` value match. (Exact weights are an implementation detail; the tiers above
are the contract.)

Because the winner is score-based (file order matters only as the final tie-break),
reordering rules within a scope cannot change behavior except on exact ties — unlike
CODEOWNERS' order-sensitive last-match.

### 5.7 Resolution Context & Targeting

Everything above resolves against a **resolution-context directory** — the answer to
"where am I?" for repo-local config discovery, `path` matching, and identity/`branch`
detection. By default that is `process.cwd()`, but because this tool is built for agents
and automation, the CLI must run from one directory while **targeting another**.

**The lever — a global `-C, --cwd <dir>` flag** (git-style, like `git -C`): the process
behaves as if it had been launched in `<dir>`. It is resolved once (in the program's
`preAction` hook) and governs **everything** downstream — config discovery, override
matching, *and* relative path arguments (e.g. `--content-file ./spec.md` resolves under
`<dir>`). One unified notion of "current directory"; agents that need a different dir for
file args use absolute file paths.

**Source precedence** for the context dir:

1. `-C, --cwd <dir>` flag (highest)
2. `AGENT2LINEAR_CWD` environment variable (for wrapping/automation)
3. `process.cwd()` (default)

The dir is **canonicalized (realpath)** before any matching (so symlinks resolve
consistently). It must exist when a command will act on it (otherwise: hard error); in
pure **query** mode a missing/repo-less dir simply yields "no matching context" rather
than an error.

**Two modes, one lever:**

- **Execute** — any command honors `-C`/`--cwd`:
  ```
  a2l -C ~/work/acme/web/apps/mobile issue create --title "Bug"
  # resolves defaults as if run from apps/mobile (→ defaultTeam: mobile), then creates.
  ```
- **Query** (no side effects) — reuse the same lever on the read commands:
  ```
  a2l config explain ~/work/acme/web/apps/mobile        # positional sugar for --cwd
  a2l config explain --cwd <dir> --json                 # machine-readable, for agents
  a2l config get defaultTeam --cwd <dir>                # single override-resolved field
  ```

**Overrides are always *defaults*, regardless of how the context dir is chosen.** Whether
the context is `process.cwd()`, `-C`, or `AGENT2LINEAR_CWD`, the resolved values only seed
defaults; explicit CLI flags/args always win (§5.5 step 7). So "pwd *is* the target" and
"`-C` points at the target" behave identically — both merely supply defaults — which
directly answers the "is that for defaults?" question for the cwd case.

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
- **Targeting (§5.7):** a **global `-C, --cwd <dir>`** flag (with `AGENT2LINEAR_CWD` env
  fallback) sets the resolution-context dir for *any* command, git-style. This is the lever
  that serves both execute and query modes.
- **New `config explain` (a.k.a. `config which`):** for the context dir, print each
  resolved field, its value, and the winning rule — the answer to "why did it pick team
  X here?" Include resolved context (contextDir, repoRoot, remotes, branch) and the
  ordered list of matching rules with scores. Accepts an optional **positional `[dir]`**
  (sugar for `--cwd`) and **`--json`** for agents. This is the key debuggability feature.
- **`config get <key> --cwd <dir>`:** returns a single **override-resolved** field for the
  target dir — the lightweight scripting path for agents that just need one value.

```
$ a2l config explain ~/work/acme/web/apps/mobile/feature   # positional = --cwd
context:
  contextDir  ~/work/acme/web/apps/mobile/feature
  repoRoot    ~/work/acme/web
  remotes     origin   → github.com  myuser/web
              upstream → github.com  acme/web
  branch      feature/login
resolved:
  defaultTeam        mobile        ← repo override   when{path:apps/mobile/**}
  defaultInitiative  q3-roadmap    ← repo catch-all
  (acme-eng rule matched via upstream; lost to repo scope, per §5.6)
```

---

## 8. Technical Implementation

| Area | Change |
|------|--------|
| `src/lib/types.ts` | Add `WhenLeaf`, `WhenComposite`, `WhenClause` (recursive), `OverridableConfig`, `ConfigOverride`; add `overrides?` to `Config`. |
| `src/cli.ts` | Add a global `-C, --cwd <dir>` option; in the existing `preAction` hook, resolve the context dir (flag → `AGENT2LINEAR_CWD` env → `process.cwd()`), realpath + existence-check it, and stash it for downstream resolution. Apply git-style `-C` semantics (also the base for relative path args). |
| `src/lib/git-context.ts` *(new)* | Given a **context dir** (not hard-wired to `process.cwd()`), resolve `repoRoot`, current branch, and **all** remotes into `{ <name> -> {host, owner, name} }` (normalize SSH/HTTPS/ssh://, strip `.git`, nested groups). Pure, lazily invoked, cached per context dir. |
| `src/lib/glob-match.ts` *(new)* | gitignore-style matcher (`*`/`**`/trailing-`/`/leading-`/`/`!`), plus identity/branch glob match. Reuse a vetted lib (e.g. `picomatch`/`minimatch`) rather than hand-roll. |
| `src/lib/overrides.ts` *(new)* | `resolveOverrides(context, layers)` → per-field winner + provenance. Evaluate the recursive `when` tree (leaf AND + `anyOf`/`allOf`/`not`, `remote` qualifier resolved against the remotes map); specificity scoring incl. composites (§5.6). |
| `src/lib/config.ts` | `getConfig(contextDir?)` takes an optional context dir (default `process.cwd()`) and threads it into `findProjectConfigDir(contextDir)` (which **already accepts a `startDir`** — `xdg-paths.ts:55`) and the override resolver. After building `merged`, apply override resolution per field; populate `locations[...] = { type: 'override', … }`; **concatenate** global+repo `overrides` instead of letting the repo array replace the global one. Keep `apiKey` path untouched. |
| `src/commands/config/explain.ts` *(new)* | Implements `config explain [dir]` with `--cwd`/`--json`. |
| `src/commands/config/get.ts` | Add `--cwd <dir>` and override-resolve the requested key for that context dir. |
| Tests | `tests/scripts/test-config-overrides.sh` (integration) + unit tests for glob-match, git-context normalization, and specificity ordering (Vitest, matching existing `*.test.ts`). |

**Performance:** the Git context is resolved lazily and only when at least one override
declares a context matcher (identity/`path`/`branch`/`remote`); result cached for the
process. Configs without overrides pay nothing.

---

## 9. Edge Cases

| Case | Behavior |
|------|----------|
| Not in a Git repo / no remote | Identity matchers don't match. Relative `path` rules anchor to the discovered `.agent2linear/` dir if present, else are skipped. Absolute `path` and catch-all still apply. |
| Multiple remotes / forks | All remotes resolved. Identity reads `origin` by default; use the `remote` qualifier (`upstream`, a name, a list, or `"*"`) and `anyOf` for "base OR upstream". `origin` match outranks non-origin on ties (§5.6). |
| `remote` names a remote that doesn't exist | That node's identity criteria don't match (and a bare `{ remote: "x" }` is false); other rules/branches unaffected. |
| Empty `anyOf: []` / `allOf: []` | `anyOf: []` ⇒ false (matches nothing); `allOf: []` ⇒ true (vacuous). Warn on a likely-mistaken empty `anyOf`. |
| Detached HEAD / no branch | `branch` matchers don't match; everything else unaffected. |
| Git worktrees | Branch and root resolved via Git; works normally. |
| Invalid glob / unknown `when` key | Warn (stderr) and skip that rule; never crash resolution. |
| `path` escapes repo root (`../`) | Treated as a disk path comparison; documented as discouraged. |
| Conflicting rules | Resolved by §5.6 precedence: scope (repo > global) first, then specificity, then later declaration. |
| `-C`/`--cwd` dir does not exist or is unreadable | **Execute:** hard error. **Query** (`config explain`/`get`): report "no matching context" (catch-all/global only), not a crash. |
| `-C`/`--cwd` dir is outside any repo | Honored as the context dir; identity/`branch` matchers don't match; relative `path` anchors to its discovered `.agent2linear/` if any; absolute `path` + catch-all still apply. |
| Symlinked context dir | Canonicalized (realpath) before matching, so rules match the real location consistently. |
| Both `--cwd` flag and `AGENT2LINEAR_CWD` set | Flag wins (precedence in §5.7). |

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
- **GitHub-aware upstream discovery** — v1 treats "upstream" as the remote literally named
  `upstream`; optionally resolve a fork's true parent via the GitHub API (would require
  network and auth — deliberately out of scope for the offline core).
- **`extends`/includes** if `overrides` arrays grow large enough to warrant splitting out
  of `config.json` (the routes.json option we deferred).
- **Batch targeting** — resolving defaults for *many* directories in one call (beyond
  `config explain --json` per dir) if agents need to map a whole tree at once.
- **`getConfig()` is currently cwd-implicit at call sites** — threading an explicit
  context dir (§5.7) through all command handlers is the bulk of the wiring; a
  request-scoped context object could carry it instead of an extra parameter everywhere.

*Resolved in this revision:* `remote` qualifier + multi-remote matching, and boolean
composition `anyOf`/`allOf`/`not` — see §5.2.
