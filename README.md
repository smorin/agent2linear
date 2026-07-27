# agent2linear

**agent2linear** is a command-line interface for Linear designed to work seamlessly with both humans and AI agents. Unlike Linear's web interface or standard APIs, agent2linear is built to **minimize token usage and context window waste** - critical for AI workflows where every token counts.

**Why it exists**: Linear uses long UUIDs (`team_9b2e5f8a-c3d1-4e6f-8a9b-2c3d4e5f6a7b`) that consume tokens and confuse agents. agent2linear replaces them with memorable aliases (`--team backend`), persistent config defaults (global or project-local), and natural date formats (`Q1 2025`). Set your `defaultTeam`, `defaultInitiative`, and other preferences once, then create issues and projects without repeating the same parameters. The result: **10x fewer tokens** for the same operations, cleaner agent prompts, and workflows that just work.

**Use `agent2linear` or the short `a2l` alias - both commands work identically.**

---

## v1.0.0 release status and migration

The M36 v1.0.0 documentation is staged, but this worktree is **not** a
published release: no release commit, tag, package publication, or
exact-candidate live-verification result is asserted here. The authoritative
release checklist is the [M36 plan](docs/superpowers/plans/2026-07-26-M36-v1-release-tdd.md)
and its current evidence/waivers are in [CONFORMANCE.md](CONFORMANCE.md).

### Runtime and version contract

The v1.0.0 support contract is Node.js **22 or 24**, declared by the package
as `>=22`; Node 18 and 20 are outside that contract. Package, lockfile, CLI,
and CI version/runtime alignment is complete in this worktree, but that does
not certify a release artifact. Both `a2l --version` and `a2l -V` write exactly
this one line to stdout and exit 0:

```text
agent2linear 1.0.0
```

### What changes for v1 users

- Do not put a Linear key in argv or config. The removed literal
  `--api-key` flag is replaced by `--api-key-file <path|->`; key files, named
  workspace environment variables, profile env files, and the local secrets
  registry remain supported sources.
- Use the explicit command grammar `issue comment add <identifier>` rather
  than the removed `issue comment <identifier>` route.
- For changed issue, project, comment, and label commands, use
  `-o, --output table|json|tsv` where offered, or `--json` for the exact JSON
  result. Changed lifecycle mutations use `table|json`; the deprecated
  `-f, --format` selector is not a replacement for their new contract.
- `labels|lbl list|ls` is a compatibility help shim. Use
  `issue-labels list` or `project-labels list`. `--all` exhausts pages; it
  does not include retired labels unless `--include-retired` is also supplied.
- `alias clear` uses `-y, --yes` as its explicit consent flag. Use
  `--dry-run` first to inspect a write-free plan.

List pagination is cursor based: copy the opaque `pageInfo.endCursor` into
`--after`; `--all` traverses remaining pages; `cursor-history list|view|clear`
manages locally retained continuation context. There is no numeric page jump.

For command-by-command replacements, safety notes, JSON/stream/exit behavior,
and accepted compatibility boundaries, read the dedicated
[v1.0.0 migration guide](docs/superpowers/releases/2026-07-27-M36-v1.0.0-migration-guide.md).
The staged [v1.0.0 release notes](docs/superpowers/releases/2026-07-27-M36-v1.0.0-release-notes.md)
record what still must be verified before a tag or publication.

---

## 🎯 Why Aliases? (The Killer Feature)

**The Problem**: Linear uses UUIDs everywhere. They're impossible to remember and painful for both humans and AI agents.

**The Solution**: agent2linear lets you use friendly aliases instead of UUIDs.

### Before vs After

```bash
# ❌ Without aliases (UUID Hell)
a2l project create \
  --title "Mobile Redesign" \
  --team team_9b2e5f8a-c3d1-4e6f-8a9b-2c3d4e5f6a7b \
  --initiative init_4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a \
  --status status_3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f

# ✅ With aliases (Clean & Readable)
a2l project create \
  --title "Mobile Redesign" \
  --team mobile \
  --initiative q2-product \
  --status planned
```

### Benefits

**For Humans:**

- 🧠 **Memorable**: `--team backend` vs `--team team_9b2e5f8a...`
- 📖 **Self-documenting**: Commands are readable without looking up IDs
- ⚡ **Faster**: Type less, work faster

**For AI Agents (Why this tool exists!):**

- 💭 **Context persistence**: AI remembers "backend" across conversations, not UUIDs
- 🎯 **Fewer errors**: Less likely to corrupt "backend" than a 36-character UUID
- 🪙 **Token efficient**: Aliases save tokens in AI context windows
- 🗣️ **Natural language**: Maps to how humans describe things

### What You Can Alias

Create aliases for **11 entity types**: `team`, `initiative`, `project`, `member`, `workflow-state`, `project-status`, `issue-label`, `project-label`, `issue-template`, `project-template`, `cycle`

### Quick Start with Aliases

The setup wizard automatically creates helpful aliases:

```bash
a2l setup
# Auto-creates aliases for:
#   - Workflow states (todo, in-progress, done, canceled)
#   - Project statuses (planned, started, completed, paused)
#   - Team members (john-smith, jane-doe)
```

**Manual alias management:**

```bash
# Add aliases
a2l alias add team backend team_abc123

# Bulk sync (auto-generates from names)
a2l teams sync-aliases

# List aliases
a2l alias list
a2l alias list teams
```

**💡 Learn more**: See the [Aliases](#aliases) section for full documentation.

---

## ⚡ Quick Start (5 minutes)

Get up and running with agent2linear in 3 easy steps:

### Step 1: Install (or use with npx)

For the v1.0.0 contract, use Node.js 22 or 24 (`>=22`). This repository has
completed its package, lockfile, CLI, and CI version/engine alignment. Verify
the registry artifact only after the release is actually announced.

**Option A: Global Install** (recommended for frequent use)

```bash
npm install -g agent2linear
```

**Option B: Use with npx** (no installation needed - great for trying it out!)

```bash
npx agent2linear --version
```

Both methods work identically. Examples below use the short alias `a2l` for convenience.

### Step 2: Run the Setup Wizard

```bash
agent2linear setup
```

**Or with npx:**

```bash
npx agent2linear setup
```

The interactive setup wizard will:

- ✅ Guide you to get your Linear API key → https://linear.app/settings/api
- ✅ Validate your connection to Linear
- ✅ Help you select your default team
- ✅ Optionally create helpful aliases (workflow states, members, project statuses)
- ✅ Walk you through key features with a 7-screen tutorial

**That's it!** The wizard configures everything for you.

### Step 3: Start Working

```bash
# Create your first issue (auto-assigned to you!)
a2l issue create --title "My first issue"

# List YOUR assigned issues (the default - most common command!)
a2l issue list

# List all issues in your team
a2l issue list --all

# Create a project
a2l project create --title "Q1 Goals"

# Get help anytime
a2l issue create --help
```

**🎉 You're now productive!** Explore the full documentation below for advanced features.

💡 **Tip:** The setup wizard created helpful aliases for you. Try `a2l alias list` to see them.

---

## Installation

### For End Users

**Global Install** (recommended for regular use):

```bash
npm install -g agent2linear

# Verify installation
agent2linear --version
a2l --version
```

**Use with npx** (no installation needed):

```bash
# Try it out without installing
npx agent2linear --help
npx agent2linear setup

# Both commands work: agent2linear and a2l
npx agent2linear issue list
```

**Which should you choose?**

- Install globally if you'll use agent2linear frequently
- Use npx for trying it out or one-off usage
- Both methods provide identical functionality

### For Development

```bash
git clone https://github.com/smorin/agent2linear.git
cd agent2linear
npm install
npm run build
```

## Configuration

### Recommended: Use the Setup Wizard

The easiest way to configure agent2linear is with the interactive setup wizard:

```bash
agent2linear setup
```

The wizard will:

- Guide you to get your Linear API key from https://linear.app/settings/api
- Let you choose between saving to config file or using an environment variable
- Validate your API key by connecting to Linear
- Help you select your default team interactively
- Optionally create helpful aliases for workflow states, members, and project statuses
- Provide a guided tour of features

### Alternative: Manual Configuration

If you prefer manual setup, you can set your Linear API key as an environment variable:

```bash
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
```

Or use the interactive config editor:

```bash
agent2linear config edit
```

**Configuration files:**

- Global: `$XDG_CONFIG_HOME/agent2linear/config.json` (default: `~/.config/agent2linear/config.json`)
- Project: `.agent2linear/config.json`

Project configuration is discovered by walking up from the current directory toward `$HOME` for the nearest `.agent2linear/` directory. Caches are stored separately under `$XDG_CACHE_HOME/agent2linear/<workspace-key>/` (default: `~/.cache/agent2linear/<workspace-key>/`), keyed per workspace so they never mix between accounts.

**See also:** Run `agent2linear config --help` for all configuration options.

### Context-Aware Overrides (`overrides[]`)

Add an optional `overrides` array to any `config.json` (global or repo) to resolve **defaults by context** — filesystem location, repo identity, or branch — instead of one flat value per scope. Each rule is `{ "when": { … }, …defaults }`: when the current context matches `when`, that rule's values apply. Resolution is **field-level** (a rule setting only `defaultTeam` leaves `defaultInitiative` to fall back), and `apiKey` is **never** overridable.

```jsonc
{
  "defaultTeam": "platform", // catch-all (lowest precedence)
  "overrides": [
    {
      "when": { "path": "cli/**" }, // repo-root-anchored path glob
      "defaultTeam": "cli-team",
      "aliases": { "teams": { "default": "team_cli123" } },
    }, // per-rule alias remap
    {
      "when": { "owner": "acme" }, // repo identity (reads `origin`)
      "defaultTeam": "acme-eng",
    },
    {
      "when": { "branch": "release/*" }, // current branch
      "defaultInitiative": "hardening",
    },
    {
      "when": { "anyOf": [{ "owner": "acme" }, { "remote": "upstream", "owner": "acme" }] }, // fork: base OR upstream
      "defaultTeam": "acme-eng",
    },
  ],
}
```

**`when` matchers:** `path` (relative = repo-root-anchored gitignore-style glob; leading `~/` or `/` = absolute disk match), `repo`/`owner`/`host` (identity, normalized to `host/owner/name` from the git remote; reads `origin` unless a `remote` qualifier is given), `branch`, and the boolean composites `allOf`/`anyOf`/`not`. The `remote` qualifier picks which remote(s) identity reads (a name, a list, or `"*"`); a bare `{ "remote": "upstream" }` matches "this checkout has an `upstream` remote".

**Precedence (most → least):** repo scope beats global regardless of specificity; within a scope, most-specific wins (exact `repo` > `repo` glob/`owner`/`host` > `path` > `branch` > catch-all); ties break by declaration order. Configs without `overrides` behave exactly as before.

**Authoring rules from the CLI — `config override` (alias `config ov`):** the full lifecycle without hand-editing JSON. Every rule is addressable by a stable, human-chosen **label** (`<label>`); legacy unlabeled rules are addressable by `#<index>`. Each command takes `-g/--global` (default) or `-p/--project`, and supports `--json` (and `--dry-run` for `add`/`edit`).

```bash
# add — one or more `when` criteria + one or more values, named <label>
a2l config ov add cli-team --when-path 'cli/**' --set defaultTeam=frontend --project
a2l config ov add release  --when-branch 'release/*,main' --set defaultTeam=ship --global   # comma/repeat = OR within a facet
a2l config ov add web-alias --when-repo acme/web --alias team.default=team_cli123 --project  # per-rule alias remap
a2l config ov add nested   --when-json '{"anyOf":[{"path":"cli/**"},{"branch":"main"}]}' --set defaultTeam=cli --global
a2l config ov add fallback --when-json '{}' --set defaultTeam=platform --global              # explicit catch-all

# list / get — context-independent inventory; each row carries a static specificity tag
a2l config ov list                    # both scopes (project + global)
a2l config ov get cli-team --project  # one rule in full (by label or #<index>)

# edit / remove / move — manage an existing rule by selector
a2l config ov edit cli-team --set defaultInitiative=q3 --unset defaultProject --project  # field-by-field value merge
a2l config ov edit '#2' --id release --project                                           # label a legacy #<index> rule
a2l config ov move release --before cli-team --project                                   # reorder (controls equal-specificity tie-break)
a2l config ov remove release --project                                                   # alias: rm
```

`--set` accepts only the overridable defaults (`defaultTeam`, `defaultInitiative`, `defaultProject`, the templates, `defaultPrompt`, `defaultAutoAssignLead`) — `apiKey` can never be set via an override. Flag-sugar (`--when-*`) and the `--when-json` escape hatch are mutually exclusive; comma-lists or repeated `--when-<facet>` express OR **within** a facet, and `--when-json` is the escape hatch for arbitrary nested trees. Globs and label uniqueness are validated **before** writing, so a malformed or never-matching rule is rejected up front.

**Targeting another directory — `-C, --cwd`:** a global, git-style flag makes _any_ command resolve as if launched in `<dir>` (config discovery, override matching, and relative path args). Falls back to `$AGENT2LINEAR_CWD`, then the current directory.

```bash
a2l -C ~/work/acme/web/apps/mobile issue create --title "Bug"   # resolves defaults as if in apps/mobile
AGENT2LINEAR_CWD=~/work/acme/web a2l issue create --title "Bug" # same, via env
```

**Debugging routing — `config explain`:** prints the resolved context (contextDir, repoRoot, remotes, branch) and the winning rule per field — named by its **label** (`config ov` selector), so you can jump straight to `config ov edit <label>`. A `rules:` section then annotates **every** rule (both scopes) with ✓/✗ for this context (the ✓/✗ comes from the same matcher that drives resolution, so the audit can never disagree) and echoes each rule's `when`. `config get <key> [dir]` returns a single override-resolved field for scripting.

```bash
a2l config explain ~/work/acme/web/apps/mobile        # positional dir = sugar for -C
a2l config explain --json                             # machine-readable (resolved map + a rules[] audit array), for agents
a2l config get defaultTeam apps/web                   # one override-resolved field (names the winning rule's label)
```

## Prompt Templates

Ask `a2l` for the **right markdown prompt to follow before creating a Linear issue**, selected by context. This is read-side only today: prompts are **hand-authored** in a committable `prompts.json` (CRUD and interpolation are planned). It is fully additive — a config with no prompts behaves exactly as before, and `apiKey`/workspace selection is never affected.

The `prompt` command is also aliased as **`skill`**: `a2l skill get` returns the right **skill** (prompt) to call — the context-appropriate guidance an agent should follow before creating an issue. `skill` and `prompt` are interchangeable everywhere (`skill get`/`skill list`/`skill explain` = `prompt get`/`prompt list`/`prompt explain`).

### Authoring prompts (`prompts.json`)

Prompts live in a `prompts.json` next to your config:

- **Global:** `$XDG_CONFIG_HOME/agent2linear/prompts.json` (default: `~/.config/agent2linear/prompts.json`)
- **Project:** `.agent2linear/prompts.json` (nearest, walking up from the current directory)

A project prompt **overwrites** a global one of the same name. Each prompt sets **exactly one** of an inline `body` or a `bodyFile`:

```jsonc
{
  "prompts": {
    "general": {
      "description": "Default issue prompt",
      "body": "## Title\nWrite a clear, scoped title.\n",
    },
    "payments-issue": { "description": "Payments convention", "bodyFile": "prompts/payments.md" },
  },
  "promptRules": [
    { "when": { "team": "payments" }, "prompt": "payments-issue" }, // team layer (see below)
  ],
}
```

A **relative** `bodyFile` is anchored to the directory of the `prompts.json` that declares it (not your current directory), so a committed project `prompts.json` referencing `prompts/payments.md` resolves portably regardless of where you run `a2l`. Absolute and `~/`-prefixed paths are used as-is.

### Selecting a prompt

```bash
a2l prompt get                       # the prompt that applies for the current directory (raw markdown)
a2l prompt get payments-issue        # an exact prompt by unique name (highest precedence)
a2l prompt get --team payments       # the team-layer prompt for the payments team
a2l prompt get --json                # a { name, source, selection, body, context } envelope (for agents)
a2l skill get                        # `skill` is an alias for `prompt` — the right skill to call here
a2l issue prompt                     # alias for `prompt get` (same flags) — handy before `issue create`
```

`defaultPrompt` is a first-class config key — a local prompt **name**. Set it like any other default, and it is **wired into `overrides[]`** so it can be resolved by `path`/`repo`/`branch`:

```jsonc
{
  "defaultPrompt": "general", // general default (a name in prompts.json)
  "overrides": [
    { "when": { "path": "apps/mobile/**" }, "defaultPrompt": "mobile-issue" }, // location-specific prompt
  ],
}
```

```bash
a2l config set defaultPrompt general                   # validated: the name must exist in prompts.json
a2l -C apps/mobile prompt get                          # → the location prompt (path override)
```

**Team layer (`promptRules`).** Authored **nested**, exactly like `overrides[]`: `{ "when": { "team": "<id|alias>", …location matchers }, "prompt": "<name>" }`. The resolved team is `--team` (if given) or your `defaultTeam`; both the rule's `team` and your team are normalized through team aliases, so `payments` matches whether expressed as the alias or the raw `team_*` id. (A `team` key is honored **only** here — it is ignored inside config `overrides[]`.)

**Selection precedence:** explicit name → specific location override (`path`/`repo`/`owner`/`host`) → team (`promptRules`) → general `defaultPrompt` (top-level, or a branch-only / catch-all override) → error. An explicit `--team X` with no matching `promptRule` is a **hard error** (exit 1); a _derived_ `defaultTeam` with no rule simply falls through to the general prompt. A branch-only override is general-tier (team outranks branch).

**`--force` (team-first).** Scoped to an explicit `--team`: evaluate the team layer **first**, so a matching `promptRule` outranks any location override; if no rule matches it is a hard error even when a location override or general default would otherwise resolve. `--force` without `--team` is a no-op.

```bash
a2l prompt get --team payments --force                 # force the payments team prompt (beats a location override)
```

### Listing and explaining

```bash
a2l prompt list                      # available prompt names, grouped by source (names only)
a2l prompt list --descriptions       # include each prompt's description
a2l prompt list pay                  # filter to names containing "pay" (case-insensitive)
a2l prompt list --format json        # complete records (name, description, source); the filter still applies
```

`prompt explain` mirrors `config explain` and adds the team layer (which `config explain` alone can't show): the context, the resolved `defaultPrompt` + provenance, the team (input/resolved id), the **matched `promptRule`** (shown even when a location override outranks it), and the final selection + tier. Unlike `prompt get`, it never exits 1 — an unresolved selection is reported in the trace.

```bash
a2l prompt explain                   # what would be selected here, and why
a2l prompt explain apps/mobile       # explain as if in apps/mobile (positional dir = sugar for -C)
a2l prompt explain --team payments --json   # machine-readable decision trace
```

## Multi-Workspace & Profiles

If you work across **multiple Linear workspaces** (e.g. personal + several companies), agent2linear can hold several keys at once and automatically target the right workspace per repository — without naming the workspace in every command.

> **The simple case is unchanged.** If you use a single key (`LINEAR_API_KEY` env var or `apiKey` in config), everything works exactly as before. Profiles and workspaces are strictly opt-in.

### Concepts: `global < profile < repo`

- A **workspace** is a Linear workspace, addressed by one `lin_api_…` key. Keys live in a **secrets registry** that is never committed.
- A **profile** is a named bundle of _settings_ — which workspace to use, optional defaults (`defaultTeam`, `defaultInitiative`, …), and **detection rules**. Profiles live in committable config and **never contain a raw key**.
- Resolved configuration merges **`global < profile < repo`**, so a repo override beats a profile default beats a global default.

### Register workspaces and profiles

```bash
# 1. Register a workspace's key in the secrets registry (piped, never in shell history)
echo "$ACME_KEY" | a2l workspace add acme --api-key-file -
a2l workspace list                    # names + masked keys
a2l workspace current                 # the resolved active workspace + source (offline)

# 2. Define a profile that points at it, with optional defaults
a2l profile add acme --workspace acme --default-team backend --default-initiative q3
a2l config set defaultProfile acme    # persisted fallback default

# 3. Auto-detect: route any repo under a GitHub org to this profile
a2l profile match add acme --git-remote-owner acme-co --git-remote-owner acme-labs
#   (accepts a bare owner OR a full repo URL — the owner is extracted)

# Match on host and/or repo name too — all accept glob patterns:
a2l profile match add acme --git-remote-host '*.gitlab.example.com' --git-remote-owner acme
a2l profile match add acme --git-remote-repo 'my-org/secret-*'        # owner/name glob
a2l profile match add acme --git-remote-owner Acme-Co --case-sensitive  # opt out of the case-insensitive default
```

Now, inside any repo whose `origin` owner is `acme-co`/`acme-labs`, commands automatically use the `acme` workspace and its defaults.

### Common multi-repo setup: two workspaces, routed by repo owner

This is the usual setup when you have a work Linear workspace and a personal
Linear workspace, and you want `a2l` to pick the right one from the current
repo's GitHub owner.

```bash
# 1. Store both keys without putting secrets in config.json.
echo "$WORK_LINEAR_API_KEY" | a2l workspace add work --api-key-file -
echo "$PERSONAL_LINEAR_API_KEY" | a2l workspace add personal --api-key-file -

# 2. Create one profile per Linear workspace.
a2l profile add work --workspace work --default-team platform
a2l profile add personal --workspace personal --default-team inbox

# 3. Route repo owners to profiles. Owners are matched case-insensitively.
a2l profile match add work \
  --git-remote-owner acme-co \
  --git-remote-owner acme-labs

a2l profile match add personal \
  --git-remote-owner alice \
  --git-remote-owner alice-labs

# 4. Refuse to guess in repos that do not match either profile.
a2l config set noMatchPolicy match-only
```

After that:

- `github.com/acme-co/*` and `github.com/acme-labs/*` resolve to `work`.
- `github.com/alice/*` and `github.com/alice-labs/*` resolve to `personal`.
- Any other repo fails with a no-match error instead of silently using the wrong key.
- `--workspace <name>` or `--api-key-file <path|->` still forces a one-off override.

Verify the routing from inside representative repos:

```bash
a2l workspace current   # offline: selected workspace + source
a2l whoami              # API-backed identity check
a2l doctor              # config, workspace, and secret hygiene checks
```

If you run agents or CI non-interactively and you trust your match rules, disable
the write confirmation for auto-detected multi-workspace writes:

```bash
a2l config set confirmAutoDetectedWrites false
```

Otherwise, mutating commands in auto-detected multi-workspace repos require an
interactive confirmation, `-y`, or an explicit `--workspace`.

#### Dotfiles/env-file variant

If you manage secrets outside agent2linear, profiles can point at per-workspace
env files instead of using `a2l workspace add`. The files are dotenv-style,
untracked, and only need to contain the key for that workspace:

```text
~/.config/agent2linear/work.env      # LINEAR_API_KEY_WORK=lin_api_...
~/.config/agent2linear/personal.env  # LINEAR_API_KEY_PERSONAL=lin_api_...
```

Then hand-author or generate this global config at
`~/.config/agent2linear/config.json`:

```json
{
  "noMatchPolicy": "match-only",
  "confirmAutoDetectedWrites": false,
  "profiles": {
    "work": {
      "workspace": "work",
      "defaultTeam": "platform",
      "match": {
        "remote": ["origin", "upstream"],
        "gitRemoteOwner": ["acme-co", "acme-labs"]
      },
      "envFile": "~/.config/agent2linear/work.env"
    },
    "personal": {
      "workspace": "personal",
      "defaultTeam": "inbox",
      "match": {
        "gitRemoteOwner": ["alice", "alice-labs"]
      },
      "envFile": "~/.config/agent2linear/personal.env"
    }
  }
}
```

That `remote: ["origin", "upstream"]` on the work profile handles the common fork
case: if `origin` is your personal fork but `upstream` points at the work org, the
work profile can still win. Keep the work profile before the personal profile so
first-positive-wins picks it for those forks.

### Matching on host, repo name, and which remote

A `match` rule can read **host**, **owner**, **repo** (`owner/name`), and choose **which remote** its identity criteria read:

- All identity fields accept **glob patterns** — `github.com`, `*.gitlab.example.com`, `acme-*`, `my-org/secret-*`.
- Within one rule, **present fields AND**; **each repeated field's list ORs**; a `linear: false` exclusion still wins. A rule matches only when _some selected remote_ satisfies _every_ present field.
- Matching is **case-insensitive by default** (forge-correct). Pass `--case-sensitive` for the rare GitLab `Foo` ≠ `foo` case; it is per-rule, so it does not flip your other (GitHub) rules. (Turning it back off is a hand-edit of `config.json` for now.)
- `--remote <name>` selects which remote(s) the identity reads: default `origin`, a name (`upstream`), `"*"` (any remote), or _bare_ `--remote upstream` with no identity fields = "a remote named `upstream` exists" (the fork predicate).

**Worked example — two orgs to one workspace, two users to another, refuse everything else:**

```bash
a2l config set noMatchPolicy match-only          # recognized repos only; refuse everywhere else

# Org A (both its GitHub orgs) → the work workspace
a2l profile match add work --git-remote-owner acme-co --git-remote-owner acme-labs

# Two personal users → the personal workspace
a2l profile match add personal --git-remote-owner alice --git-remote-owner bob
```

Now `acme-co/*` and `acme-labs/*` route to `work`; `alice/*` and `bob/*` route to `personal`; **any other repo hard-errors** (exit 1) — no default, no guessing.

**Fork example — route by `upstream`, not your personal fork:**

```bash
# You forked acme/widgets to alice/widgets, so origin = your fork and upstream = the org.
a2l profile match add acme --remote upstream --git-remote-owner acme   # read the upstream owner
a2l profile match add personal --git-remote-owner alice                # plain origin-owner rule
```

Declare the `upstream` rule **first** so it wins for a fork (origin = `alice/widgets`, upstream = `acme/widgets`) — the `acme` profile resolves via the upstream owner even though `origin` is `alice`. In a non-forked `alice/*` repo (no `upstream`), the `personal` rule wins. When more than one profile matches the same repo, `a2l doctor` and `a2l profile match list` print an informational ambiguity warning (`⚠️ N profiles match this repo (first-positive-wins; order profiles to control which)`) — resolution is unchanged; ordering profiles is the lever.

`a2l profile match list <profile>` prints each rule's `remote` (when not the default `origin`), `git-remote-host` / `git-remote-owner` / `git-remote-repo` lines, and `case-sensitive: true` when set.

> **Release note (v0.31.0) — nested-group owners.** Profile detection now uses the same git parser as `config` overrides, so for **nested** self-hosted groups (`git@gitlab.com:group/sub/repo.git`) the **owner** is now the all-but-last path (`group/sub`), not just the first segment (`group`). A rule written as `--git-remote-owner group` no longer matches such a repo — use `--git-remote-owner group/sub` or the glob `--git-remote-owner 'group/*'`. Flat `host/owner/name` repos (e.g. plain GitHub) are unaffected.

### How you clone a fork affects routing

Auto-detection reads your **local git remotes** — it never calls the forge. So whether a forked checkout routes correctly depends entirely on _how you obtained it_: for a fork rule (`--remote upstream --git-remote-owner ACMEORG`) to match, an `ACMEORG`-owned `origin` **or** `upstream` must actually be present. Verified behavior for a fork `USERNAME/repo` of `ACMEORG/repo`:

| How you get the code                                                   | Resulting remotes                      | Auto-detect result                                                     |
| ---------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `gh repo fork --clone`                                                 | `origin=USERNAME` + `upstream=ACMEORG` | ✅ upstream rule matches → ACMEORG workspace                           |
| `gh repo clone USERNAME/repo`                                          | `origin=USERNAME` + `upstream=ACMEORG` | ✅ upstream rule matches → ACMEORG workspace                           |
| `gh repo clone USERNAME/repo` _(forge API unreachable / rate-limited)_ | clone **aborts**, exit 1               | ✅ fail-safe — no misrouted checkout is produced                       |
| `git clone <fork-url>` (HTTPS **or** SSH)                              | `origin=USERNAME` only                 | ⚠️ upstream rule can't match → falls through to your origin-owner rule |
| Tarball / ZIP / `git archive` (no `.git`)                              | _none_                                 | ⚠️ no remotes → `match-only` refuses; pass `--workspace`               |

Only forge-aware tooling (`gh`) knows a repo's parent and adds `upstream`; plain `git` sets `origin` to the URL you gave it and nothing more (identical for HTTPS and SSH). `gh repo clone` discovers the parent via a forge API call — and if that call can't complete, it **errors out instead of producing an `upstream`-less clone**, so `gh` never silently routes you to the wrong workspace.

**Rule of thumb:** obtain forks with `gh repo fork --clone` or `gh repo clone`. After a plain `git clone`, restore routing yourself:

```bash
git remote add upstream https://github.com/ACMEORG/repo.git
```

### Selection precedence (which workspace?)

Highest to lowest:

| #   | Source                                                                                | Example                               |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | `--workspace <name>` or `--api-key-file <path-or-stdin>` (per-invocation)             | `a2l --workspace acme issue create …` |
| 2   | `AGENT2LINEAR_WORKSPACE` env declarator                                               | `AGENT2LINEAR_WORKSPACE=acme a2l …`   |
| 3   | Repo config `profile`/`workspace` in `.agent2linear/config.json`                      | `{ "profile": "acme" }`               |
| 4   | Git-remote auto-detect (remote identity → `profile.match` host/owner/repo + `remote`) | (automatic)                           |
| 5   | Global `defaultProfile`                                                               | `a2l config set defaultProfile acme`  |
| 6   | Legacy single key (`LINEAR_API_KEY` / config `apiKey`)                                | (the simple case)                     |

### Key-source precedence (commit-safe — where does the key come from?)

Committable config **never** holds a raw key. For the resolved workspace `<NAME>`, the key is sourced (highest → lowest):

1. `--api-key-file <path|->` (including stdin as `-`)
2. **Named env var** — `apiKeyEnv` override, else the default `LINEAR_API_KEY_<NAME>` (e.g. `acme` → `LINEAR_API_KEY_ACME`, `acme-co` → `LINEAR_API_KEY_ACME_CO`)
3. **Per-profile env-file** — `profiles.<name>.envFile` (dotenv; `~` and `$VAR` expanded; never mutates `process.env`)
4. **Secrets registry** — `workspaces.json` (global, mode `0600`) or `.agent2linear/workspaces.local.json` (project, auto-gitignored)
5. Legacy plain `LINEAR_API_KEY` — used only when unambiguous

If a non-explicitly-selected workspace would fall back to the bare `LINEAR_API_KEY` while ≥2 workspaces are configured, the tool **refuses** (ambiguous) and tells you to set `LINEAR_API_KEY_<NAME>` or pass `--workspace`.

### Refuse to guess: `noMatchPolicy` and exclusion

When ≥2 profiles exist and nothing matches a repo:

- **`deny`** (default) — refuse, with guidance. The simple single-key case never denies.
- **`default`** — fall back to `defaultProfile`.
- **`match-only`** — operate only in recognized repos; refuse everywhere else.

```bash
a2l config set noMatchPolicy deny
a2l profile exclude acme               # mark a profile/org off-limits (linear: false)
# repo opt-out: .agent2linear/config.json -> { "linear": false }
```

An explicit `--workspace`/`--api-key-file` always forces through exclusion **and** no-match.

### Safety on writes (R11)

Mutating commands (`issue create`, `issue update`, `project create`) print a workspace/source banner and never let you write to the wrong place by accident:

```bash
a2l issue create --title "Fix bug"                     # → banner shows the active workspace + source
a2l issue create --title "Fix bug" --json              # { "ok": true, "workspace": { "name": "acme", "source": "auto-detect" }, "issue": { … } }
a2l issue create --title "Fix bug" -y                  # skip the auto-detected-workspace confirmation
```

- In an **auto-detected, multi-workspace** repo, a mutating command **confirms** on an interactive terminal and **fail-safe errors** (never hangs) when run non-interactively without `--workspace`/`-y`/`confirmAutoDetectedWrites=false`.
- `--json` emits `workspace.source` so an agent can verify _which_ workspace it wrote to.
- `a2l whoami` and `a2l doctor` show the active workspace + source; `doctor` also warns if a secrets file is tracked by git or a raw `apiKey` sits in a project `config.json`.

## Usage

The CLI provides two command names that work identically:

- `agent2linear` - Full command name
- `a2l` - Short alias (used in most examples for brevity)

### Common Commands

```bash
# Get help
a2l --help
a2l issue --help
a2l issue create --help

# Work with issues (most common workflows)
a2l issue list                           # List YOUR assigned issues
a2l issue list --all                     # List all team issues
a2l issue create --title "Fix bug"       # Create issue (auto-assigned to you)
a2l issue view ENG-123                   # View issue details
a2l issue update ENG-123 --state done    # Update issue

# Work with projects
a2l project create --title "Q1 Goals"    # Create project
a2l project list                         # List all projects
a2l project view "My Project"            # View project by name

# Configuration
a2l config list                          # Show current config
a2l config edit                          # Interactive config editor
a2l setup                                # Run setup wizard again
```

**💡 Tip:** Most examples in this README use the short `a2l` alias for convenience. You can use `agent2linear` anywhere you see `a2l`.

## Issue Commands

Create and manage Linear issues with comprehensive options and smart defaults.

### Issue Create

Create issues with auto-assignment, full field support, and intelligent validation.

**Basic Examples:**

```bash
# Minimal (auto-assigns to you, uses defaultTeam if configured)
agent2linear issue create --title "Fix login bug"

# Standard creation
agent2linear issue create \
  --title "Add OAuth support" \
  --team backend \
  --priority 2 \
  --estimate 8

# Full-featured
agent2linear issue create \
  --title "Implement auth" \
  --team backend \
  --description "Add OAuth2 providers" \
  --priority 1 \
  --assignee john@company.com \
  --labels "feature,security" \
  --project "Q1 Goals" \
  --due-date 2025-02-15
```

**Key Features:**

- **Auto-assignment**: Issues are assigned to you by default (use `--no-assignee` to override)
- **Member resolution**: Supports ID, alias, email, or display name
- **Project resolution**: Supports ID, alias, or name lookup
- **Config defaults**: Use `defaultTeam` and `defaultProject` to simplify creation
- **Validation**: Team-aware validation for states and projects

For full documentation: `agent2linear issue create --help`

### Issue View

View comprehensive issue details in terminal or browser.

```bash
# View by identifier
agent2linear issue view ENG-123

# View with JSON output
agent2linear issue view ENG-123 --json

# Open in browser
agent2linear issue view ENG-123 --web
```

### Issue and Project Comments

Comments use the same command shape for issues and projects:

```bash
# Add a top-level comment
a2l issue comment add ENG-123 --body "I reproduced this."
a2l project comment add backend-migration --body-file status.md

# Read from stdin or create a reply
printf '%s\n' "Reproduced twice" | a2l issue comment add ENG-123
a2l project comment add backend-migration \
  --reply-to <comment-id> --body "That matches my result."

# Resolve and validate without writing
a2l issue comment add ENG-123 --body-file notes.md --dry-run --json
```

Use exactly one body source: `--body`, `--body-file <path>`, `--body-file -`, or implicit non-TTY stdin. Empty bodies and multiple explicit sources are usage errors. `--api-key-file -` cannot share stdin with a comment body. Add commands use the normal workspace mutation guard; `-y/--yes` supplies confirmation, `--no-input` forbids prompting, and `--dry-run` never prompts or mutates.

Comment lists are human-readable stacked threads by default and use the shared raw-cursor contract:

```bash
# First 50 comments
a2l issue comment list ENG-123

# Page two: copy endCursor from page one exactly
a2l issue comment list ENG-123 --limit 50 --after 'opaque-linear-cursor'

# Every remaining project comment after a cursor
a2l project comment list backend-migration \
  --after 'opaque-linear-cursor' --all

# Stable {target,comments,pageInfo,cursorHistory} envelope
a2l project comment list backend-migration --json
```

Limits are 1 through 250. There is no numeric `--page` or direct page-N jump: use page one's raw `pageInfo.endCursor` with `--after` to reach page two, then continue sequentially. Human truncated output prints copyable next-page and all-remaining commands plus a cursor-history entry ID. Use `--no-cursor-history` when the target or query context should not be retained locally.

Direct project comments are distinct from project-update comments. The CLI creates them with `projectId` and reads the top-level comment connection filtered by the resolved project ID and a null project-update relation.

The former `a2l issue comment ENG-123 --body ...` grammar is removed. Use `a2l issue comment add ENG-123 --body ...`; the old route exits 2 with that migration suggestion.

Both add and list commands default to human `table` output. `-o/--output json` and `--json` are equivalent; combining `--json --output table` is a usage error. Run `a2l issue comment --help` or `a2l project comment --help` for the complete contract.

### Issue Update

Update existing issues with comprehensive field support and smart validation.

**Basic Examples:**

```bash
# Update single field
agent2linear issue update ENG-123 --title "New title"
agent2linear issue update ENG-123 --priority 1
agent2linear issue update ENG-123 --state done

# Update multiple fields
agent2linear issue update ENG-123 \
  --title "Updated title" \
  --priority 2 \
  --estimate 5 \
  --due-date 2025-12-31
```

**Advanced Examples:**

```bash
# Change assignment
agent2linear issue update ENG-123 --assignee john@company.com
agent2linear issue update ENG-123 --no-assignee

# Label management (3 modes)
agent2linear issue update ENG-123 --labels "bug,urgent"           # Replace all
agent2linear issue update ENG-123 --add-labels "feature"          # Add to existing
agent2linear issue update ENG-123 --remove-labels "wontfix"       # Remove specific
agent2linear issue update ENG-123 --add-labels "new" --remove-labels "old"  # Both

# Subscriber management (3 modes)
agent2linear issue update ENG-123 --subscribers "user1,user2"     # Replace all
agent2linear issue update ENG-123 --add-subscribers "user3"       # Add to existing
agent2linear issue update ENG-123 --remove-subscribers "user1"    # Remove specific

# Clear fields
agent2linear issue update ENG-123 --no-assignee --no-due-date --no-estimate
agent2linear issue update ENG-123 --no-project --no-cycle --no-parent

# Parent relationship
agent2linear issue update ENG-123 --parent ENG-100     # Make sub-issue
agent2linear issue update ENG-123 --no-parent          # Make root issue

# Move between teams
agent2linear issue update ENG-123 --team frontend --state todo

# Lifecycle operations
agent2linear issue update ENG-123 --trash              # Move to trash
agent2linear issue update ENG-123 --untrash            # Restore from trash
```

**Key Features:**

- **33+ update options**: Comprehensive field coverage including add/remove patterns
- **Smart validation**: Team-aware state validation, compatibility checks
- **Flexible updates**: Update one field or many at once
- **Clearing operations**: Use `--no-*` flags to clear fields (assignee, dates, etc.)
- **Label/subscriber patterns**: Replace, add, or remove items with distinct flags
- **Mutual exclusivity**: Prevents conflicting flag combinations with helpful errors

For full documentation: `agent2linear issue update --help`

### Issue List

List and filter issues with smart defaults, raw-cursor pagination, stable machine output, and the existing filters and sorting controls.

**Basic examples:**

```bash
# Smart defaults: your assigned active issues
a2l issue list

# Return one page containing at most 10 issues
a2l issue list --limit 10

# Filter and sort
a2l issue list --team backend --state "in progress"
a2l issue list --sort updated --order desc
```

**Pagination:**

```bash
# Continue from the exact cursor printed by the previous result
a2l issue list --limit 10 --after 'opaque-linear-cursor'

# Fetch every remaining issue, optionally starting after a cursor
a2l issue list --all
a2l issue list --after 'opaque-linear-cursor' --all
```

The default is one page of 50. Limits must be from 1 through 250. Linear cursors are opaque: copy them exactly; there is no numeric `--page` option. When another page exists, table output prints copyable next-page and all-remaining commands. See [Pagination and Cursor History](#pagination-and-cursor-history).

**Filtering:**

```bash
a2l issue list \
  --team backend \
  --priority 1 \
  --state "in progress" \
  --assignee steve@company.com

a2l issue list --project "Q1 Goals" --label bug --label urgent
a2l issue list --created-after 2025-01-01 --due-before 2025-12-31
a2l issue list --parent ENG-100
a2l issue list --root-only
```

**Output:**

```bash
a2l issue list --output table       # Human-readable default
a2l issue list --output json        # Stable pagination envelope
a2l issue list --json               # Exact equivalent of --output json
a2l issue list --output tsv         # Row-only TSV; continuation warning is stderr
```

JSON uses this envelope:

```json
{
  "issues": [],
  "pageInfo": {
    "returnedCount": 0,
    "hasNextPage": false,
    "endCursor": null,
    "fetchedAll": true
  },
  "cursorHistory": {
    "status": "not_applicable",
    "entryId": null
  }
}
```

The former `-f/--format` interface is removed. Use `-o/--output`; `-f` remains reserved for force operations under the CLI Design Standard. Existing table, column, description, web, default-filter, and sort behavior remains available.

For the complete option set, run `a2l issue list --help`.

## Label Lifecycle and Project Trash

### Issue and project labels

The canonical label families remain plural for compatibility:

```bash
# Issue-label lifecycle
a2l issue-labels list --team <team-id-or-alias>
a2l issue-labels create --name bug --color '#d73a4a' --team <team-id-or-alias>
a2l issue-labels view <label-id>
a2l issue-labels update <label-id> --description ''
a2l issue-labels retire <label-id>
a2l issue-labels restore <label-id>
a2l issue-labels delete <label-id>

# Project-label lifecycle
a2l project-labels list
a2l project-labels create --name roadmap --color '#0366d6'
a2l project-labels view <label-id>
a2l project-labels update <label-id> --name planning
a2l project-labels retire <label-id>
a2l project-labels restore <label-id>
a2l project-labels delete <label-id>
```

The aliases `ilbl` and `plbl` expose the same commands. `labels|lbl list|ls` is only a deprecated compatibility shim that prints the canonical replacements; it does not provide a third CRUD path.

Label lists return one page of 50 active labels by default. `--limit` accepts 1–250, `--after` accepts the exact opaque cursor printed by the preceding result, and `-a/--all` exhausts every remaining page. Use `--include-retired` to widen lifecycle scope and `--no-cursor-history` to prevent local history recording.

`--all` changes traversal only: it does not include retired labels unless `--include-retired` is also present. There is no numeric `--page`, backward `--before`, or `--cursor` synonym. To reach page two, copy `pageInfo.endCursor` into `--after`; human output prints the copyable command and cursor-history entry ID. Pages preserve Linear's explicit `createdAt` provider order.

`issue-labels list` and `project-labels list` use `-o, --output table|json|tsv`; changed label lifecycle mutations use `-o, --output table|json`. `--json` is exactly equivalent to `--output json`. All changed mutations also support `--dry-run`, `-y/--yes`, and `--no-input`.

Retirement and archival are independent Linear states. M33 exposes nullable `retiredAt` and `archivedAt`, filters active results only by `retiredAt`, and always excludes generically archived labels. It intentionally provides no `--include-archived` or label archive command.

Project-label listing is the workspace catalog: both labels currently applied to projects and unused definitions are in the same bounded or exhaustive result. `--all` never switches endpoints, and historical `lastAppliedAt` is not treated as current usage.

### Reversible project trash

Projects use the existing update surface:

```bash
a2l project update <name-or-id> --trash
a2l project update <name-or-id> --untrash
a2l project update <name-or-id> --trash --dry-run --json
```

`--trash` and `--untrash` are mutually exclusive. Trash requires the normal workspace guard and destructive consent; `--yes` permits the write and `--no-input` prevents prompting. The CLI uses Linear's dedicated `projectArchive(id, { trash: true })` operation and `unarchiveProject(id)`, because live verification showed that sending `trashed` through `projectUpdate` fails. There is no permanent project-delete command or separate project trash/archive command.

## Project List & Search

List and search projects with smart defaults and extensive filtering. The `project list` command provides intelligent defaults for common workflows while supporting comprehensive filtering options.

### Smart Defaults

By default, `project list` filters to show projects where **you are the lead**, in your **default team and initiative** (if configured):

```bash
# Smart defaults: projects I lead in my default team/initiative
agent2linear project list

# Equivalent to (if you have defaults configured):
# --lead <current-user-id> --team <default-team> --initiative <default-initiative>
```

### Override Flags

Use these flags to bypass smart defaults and see more projects:

```bash
# Show ALL projects (any lead) in default team/initiative
agent2linear project list --all-leads

# Show projects I lead across ALL teams
agent2linear project list --all-teams

# Show projects I lead across ALL initiatives
agent2linear project list --all-initiatives

# Override everything - show ALL projects everywhere
agent2linear project list --all-leads --all-teams --all-initiatives
```

### Filter Options

**Core Filters:**

```bash
# Filter by team
agent2linear project list --team backend
agent2linear project list -t backend

# Filter by initiative
agent2linear project list --initiative q1-goals
agent2linear project list -i q1-goals

# Filter by project status
agent2linear project list --status planned
agent2linear project list -s started

# Filter by priority (0-4)
agent2linear project list --priority 1
agent2linear project list -p 2

# Filter by specific project lead
agent2linear project list --lead alice@company.com
agent2linear project list -l alice

# Filter by member (projects where someone is assigned)
agent2linear project list --member bob
agent2linear project list -m alice,bob  # Multiple members

# Filter by label
agent2linear project list --label urgent
agent2linear project list --label urgent,critical  # Multiple labels

# Search in project name, description, or content
agent2linear project list --search "API"
agent2linear project list --search "mobile redesign"
```

**Date Range Filters:**

```bash
# Projects starting in Q1 2025
agent2linear project list --start-after 2025-01-01 --start-before 2025-03-31

# Projects targeting after June 2025
agent2linear project list --target-after 2025-06-01

# Projects targeting before end of year
agent2linear project list --target-before 2025-12-31
```

### Output Formats

**Table Format (default):**

```bash
agent2linear project list
```

Output:

```
ID           Title                          Status      Team           Lead                 Preview
-----------------------------------------------------------------------------------------------------------------------
bf2e1a8a9b   Mobile App Redesign            Started     Mobile         Alice Johnson        Complete redesign of iOS...
a9c3d4e5f6   API v2 Migration               Planned     Backend        Bob Smith            Migrate all endpoints...
c1d2e3f4g5   Customer Dashboard             Completed   Frontend       Carol Davis          New dashboard for customer...

Total: 3 projects
```

**Machine-readable formats:**

```bash
# Stable JSON envelope: { projects, pageInfo, cursorHistory }
a2l project list --output json
a2l project list --json

# Example with filtering
a2l project list --team backend --status started --json

# Row-only TSV; any continuation warning is written to stderr
a2l project list --output tsv > projects.tsv
```

The former `-f/--format` interface is removed. Project list preserves `-l/--lead`, so its pagination limit is deliberately long-only: `--limit <number>`. `-a/--all`, `--after <cursor>`, `-o/--output`, and `--json` otherwise match issue-list behavior.

**Interactive Mode:**

```bash
# Ink UI with rich formatting
agent2linear project list --interactive
agent2linear project list -I
```

### Complex Filter Examples

```bash
# Backend team projects, started status, high priority
agent2linear project list --team backend --status started --priority 1

# Projects led by specific person in any team
agent2linear project list --lead alice@company.com --all-teams

# Projects where Bob is assigned (as member)
agent2linear project list --member bob --all-leads

# Search for "API" projects in backend team (any lead)
agent2linear project list --search "API" --team backend --all-leads

# Urgent projects targeting Q1 2025
agent2linear project list --label urgent --target-after 2025-01-01 --target-before 2025-03-31

# All projects with multiple filters
agent2linear project list \
  --team backend \
  --status started \
  --priority 1 \
  --lead alice \
  --label critical

# Export all projects to JSON
a2l project list --all-teams --all-leads --all-initiatives --json > all-projects.json
```

### Alias Support

All entity filters support aliases:

```bash
# Use team alias instead of ID
agent2linear project list --team backend

# Use initiative alias
agent2linear project list --initiative q1-goals

# Use member alias
agent2linear project list --lead alice

# Use label alias
agent2linear project list --label urgent,critical
```

### Setting Defaults

Configure default values to streamline your workflow:

```bash
# Set default team
agent2linear config set defaultTeam backend

# Set default initiative
agent2linear config set defaultInitiative q1-goals

# Now simple list uses your defaults:
agent2linear project list
# Shows: projects you lead in 'backend' team within 'q1-goals' initiative
```

## Pagination and Cursor History

Issue, project, and issue/project comment lists use Linear's forward-only raw cursors. They do not invent numeric pages or custom cursor tokens.

### Getting the next page

A default invocation fetches at most 50 matching records:

```bash
a2l issue list
a2l project list
```

When more results exist, human output prints an opaque `endCursor` and a shell-safe command such as:

```bash
a2l issue list --limit 50 --after 'opaque-linear-cursor'
```

That command gets the next page for the same effective filters and sort. Project list uses the same form, but its limit is long-only because `-l` remains `--lead`. JSON clients read `pageInfo.endCursor` and pass it unchanged to `--after`:

```bash
a2l project list --limit 50 --after 'opaque-linear-cursor' --json
```

You can get page two by using page one's `endCursor`. You cannot jump directly to page 7: Linear cursors are sequential positions, not stable numeric offsets. Use `--all` when you need the full remaining collection:

```bash
a2l issue list --all
a2l issue list --after 'opaque-linear-cursor' --all
```

With `--all`, the CLI follows sequential internal pages of up to 250 and buffers the complete result before rendering. A supplied `--limit` does not cap `--all`. It deduplicates repeated objects, preserves provider order, rejects malformed or repeated continuation cursors, and never renders a misleading partial result after a later-page failure.

### Cursor history

When a one-page issue, project, or comment-list result has another page, the CLI stores a local advisory history entry and prints its entry ID. The entry records the raw cursor, effective safe filters, order, limit, source command, next-page command, and all-remaining command.

```bash
a2l cursor-history list
a2l cursor-history list --cursor 'opaque-linear-cursor'
a2l cursor-history view <entry-id>
a2l cursor-history clear --dry-run
a2l cursor-history clear --yes
```

History commands are local and do not authenticate with Linear. `cursor-history list` is newest-first and supports `--limit 1..1000`, `-o/--output table|json`, and `--json`. An entry ID identifies a local history record; it is not a Linear cursor and cannot be passed to `--after`.

History is stored at `$XDG_STATE_HOME/agent2linear/cursor-history.json`, or `~/.local/state/agent2linear/cursor-history.json` when `XDG_STATE_HOME` is unset or invalid. The CLI retains the newest 1000 entries, creates the directory with mode `0700`, and writes the file with mode `0600`. It stores reconstructed safe commands rather than raw argv and never stores API keys. Workspace keys derived from credentials are hashed.

Use `--no-cursor-history` on an issue, project, or comment-list invocation to opt out. History-write failure is non-fatal: the list result still succeeds and a warning goes to stderr. History is advisory because the remote collection can change and Linear may reject an old or expired raw cursor.

Ordinary targets, search strings, and filter literals are stored because they are needed to reconstruct the originating query. They are not treated as credentials, but they may still be sensitive. Use `--no-cursor-history` whenever a query contains information you do not want retained locally. The history layer rejects API-key, token, authorization, header, credential, password, secret, and environment-file fields and never reads raw process argv.

### JSON migration and pagination errors

Issue and project JSON lists now use envelopes. Scripts that previously iterated the root array must select the resource key:

```bash
# Before
a2l issue list --json | jq '.[]'
a2l project list --json | jq '.[]'

# M34
a2l issue list --json | jq '.issues[]'
a2l project list --json | jq '.projects[]'

# Read and reuse the next raw cursor
a2l issue list --json | jq -r '.pageInfo.endCursor'
```

Machine errors are one JSON object on stderr when `--json` or `--output json` is requested:

```json
{ "error": { "code": "usage", "message": "Limit must be a whole number between 1 and 250" } }
```

| Exit | Stable code                    | Meaning                                                                       |
| ---: | ------------------------------ | ----------------------------------------------------------------------------- |
|    1 | `runtime`                      | Network, malformed provider page, corrupt local history, or unclassified I/O  |
|    2 | `usage`                        | Invalid option/value, output conflict, or missing destructive consent         |
|    3 | `not_found`                    | A well-formed issue, project, reply parent, or cursor-history entry is absent |
|    4 | `auth`                         | Linear authentication or authorization failed                                 |
|    5 | `invalid_cursor` or `conflict` | Linear rejected the cursor or a precondition failed                           |

The CLI never silently restarts from page one after a rejected cursor.

## Milestone Templates

Milestone templates allow you to quickly set up project milestones using predefined templates. Templates are stored locally in JSON files and can be customized for your workflows.

### Creating Templates

You can create milestone templates using the CLI (recommended) or by manually editing JSON files.

**Using the CLI (Interactive):**

```bash
# Interactive mode - guided wizard
agent2linear milestone-templates create --interactive
agent2linear mtmpl create -I

# Interactive mode with project scope
agent2linear milestone-templates create --project --interactive
```

**Using the CLI (Non-Interactive):**

```bash
# Create a template with milestones
agent2linear milestone-templates create my-sprint \
  --description "Custom 2-week sprint" \
  --milestone "Planning:+1d:Define sprint goals and tasks" \
  --milestone "Development:+10d:Implementation phase" \
  --milestone "Review:+14d:Code review and deployment"

# Create in project scope
agent2linear milestone-templates create team-workflow \
  --project \
  --milestone "Kickoff::Team alignment meeting" \
  --milestone "Execution:+7d:Complete assigned tasks" \
  --milestone "Retrospective:+14d:Review and improve"
```

**Milestone Spec Format:** `name:targetDate:description`

- `name` - Required
- `targetDate` - Optional (+7d, +2w, +1m, or ISO date)
- `description` - Optional (supports markdown)

**Manual Template File Creation:**

Templates are stored at:

- **Global**: `$XDG_CONFIG_HOME/agent2linear/milestone-templates.json` (default: `~/.config/agent2linear/milestone-templates.json`) - Available across all projects
- **Project**: `.agent2linear/milestone-templates.json` - Project-specific templates

**Example Template File:**

```json
{
  "templates": {
    "basic-sprint": {
      "name": "Basic Sprint Template",
      "description": "Simple 2-week sprint structure",
      "milestones": [
        {
          "name": "Sprint Planning",
          "description": "Define sprint goals and tasks",
          "targetDate": "+1d"
        },
        {
          "name": "Development",
          "description": "Implementation phase",
          "targetDate": "+10d"
        },
        {
          "name": "Review & Deploy",
          "description": "Code review and deployment",
          "targetDate": "+14d"
        }
      ]
    }
  }
}
```

**Managing Templates:**

```bash
# Edit a template (interactive)
agent2linear milestone-templates edit basic-sprint

# Remove a template
agent2linear milestone-templates remove basic-sprint
agent2linear mtmpl rm old-template --yes  # Skip confirmation
```

### Using Milestone Templates

```bash
# List all templates
agent2linear milestone-templates list
agent2linear mtmpl ls                # Short alias

# View template details
agent2linear milestone-templates view basic-sprint

# Add milestones to a project
agent2linear project add-milestones PRJ-123 --template basic-sprint

# Set default template
agent2linear config set defaultMilestoneTemplate basic-sprint

# Use default when creating milestones
agent2linear project add-milestones PRJ-123  # Uses default template
```

### Date Offset Format

Target dates support relative formats:

- `+7d` - 7 days from now
- `+2w` - 2 weeks from now
- `+1m` - 1 month from now
- `2025-12-31` - Absolute ISO date

## Aliases

Aliases allow you to use simple, memorable names instead of long Linear IDs. For example, use "backend" instead of "init_abc123xyz". This is especially useful for AI assistants that have difficulty tracking long IDs.

### Managing Aliases

```bash
# Add an alias
agent2linear alias add initiative backend init_abc123xyz
agent2linear alias add team frontend team_def456uvw --project
agent2linear alias add project api proj_ghi789rst

# List all aliases
agent2linear alias list

# List aliases for a specific type
agent2linear alias list initiatives
agent2linear alias list teams

# Get the ID for an alias
agent2linear alias get initiative backend

# Edit aliases interactively
agent2linear alias edit           # Interactive mode - select scope, type, and alias to edit
agent2linear alias edit --global  # Edit global aliases
agent2linear alias edit --project # Edit project aliases

# Remove an alias
agent2linear alias remove initiative backend
agent2linear alias rm team frontend --project

# Validate all aliases
agent2linear alias list --validate
```

### Using Aliases

Once configured, aliases can be used anywhere an ID is accepted:

```bash
# Use initiative alias
agent2linear initiatives set backend
agent2linear initiatives view backend

# Use team and initiative aliases in project creation
agent2linear project create --title "New API" --team backend --initiative backend-init

# Use team alias in selection
agent2linear teams select --id frontend
```

### Storage Locations

- **Global aliases**: `$XDG_CONFIG_HOME/agent2linear/aliases.json` (default: `~/.config/agent2linear/aliases.json`) - Available across all projects
- **Project aliases**: `.agent2linear/aliases.json` - Project-specific, can be version controlled

Project aliases take precedence over global aliases, allowing you to override global settings per-project. The project `.agent2linear/` directory is discovered by walking up from the current directory toward `$HOME`.

### Alias Scope

Aliases are scoped by entity type, meaning you can use the same alias name for different types:

```bash
# "backend" can refer to both an initiative and a team
agent2linear alias add initiative backend init_abc123
agent2linear alias add team backend team_xyz789
```

## Icon Usage

### Supported Icons

agent2linear supports Linear's standard icon catalog for projects. Icons can be specified by name (e.g., "Checklist", "Tree", "Joystick") and are validated by Linear's API.

**Note on Icon Validation**: This tool does NOT validate icons client-side. Icons are passed directly to Linear's API for server-side validation. This design decision was made after investigation revealed:

1. **No API catalog endpoint**: Linear's GraphQL API does not expose an endpoint to fetch the complete standard icon catalog
2. **Emojis query limitation**: The `emojis` query only returns custom organization emojis (user-uploaded), not Linear's built-in icons
3. **Maintenance burden**: Maintaining a hardcoded list would be incomplete and quickly outdated

### Icon Discovery

```bash
# View curated icon suggestions (for discovery only, not exhaustive)
agent2linear icons list

# Search for specific icons
agent2linear icons list --search rocket

# View icons by category
agent2linear icons list --category status

# Extract icons currently used in your workspace
agent2linear icons extract --type projects
```

### Using Icons

```bash
# Icon names are capitalized (Linear's format)
agent2linear project create --title "My Project" --team eng --icon "Checklist"
agent2linear project create --title "API" --team backend --icon "Joystick"
agent2linear project create --title "Design" --team frontend --icon "Tree"

# If an invalid icon is provided, Linear API will return a helpful error
agent2linear project create --title "Test" --team eng --icon "InvalidIcon"
# Error: Icon not found (from Linear API)
```

### Icon Resources

- The `agent2linear icons list` command shows ~67 curated icons for discovery
- Linear supports hundreds of standard icons beyond this curated list
- Invalid icons will be rejected by Linear's API with clear error messages

## Date Formats

agent2linear supports flexible date formats for project `--start-date` and `--target-date` options, making it easy to specify dates naturally without manually calculating start-of-quarter or start-of-month dates.

### Supported Formats

**Quarters:**

```bash
agent2linear project create --title "Q1 Initiative" --start-date "2025-Q1"
agent2linear project create --title "Q2 Goals" --start-date "Q2 2025"
agent2linear project create --title "Q3 Project" --start-date "q3-2025"  # Case-insensitive
```

**Half-Years:**

```bash
agent2linear project create --title "H1 Strategy" --start-date "2025-H1"
agent2linear project create --title "H2 Plan" --start-date "H2 2025"
```

**Months:**

```bash
# Numeric format
agent2linear project create --title "January Sprint" --start-date "2025-01"

# Short month names
agent2linear project create --title "Feb Release" --start-date "Feb 2025"

# Full month names
agent2linear project create --title "March Update" --start-date "March 2025"
```

**Years:**

```bash
agent2linear project create --title "2025 Roadmap" --start-date "2025"
```

**ISO Dates (specific dates):**

```bash
agent2linear project create --title "Sprint 1" --start-date "2025-01-15"
```

### How It Works

The date parser automatically:

- Converts flexible formats to ISO dates (YYYY-MM-DD)
- Detects and sets the appropriate resolution (quarter, month, year)
- Shows confirmation messages with the parsed format

**Example output:**

```bash
$ agent2linear project create --title "Q1 Initiative" --start-date "2025-Q1"
📅 Start date: Q1 2025 (2025-01-01, resolution: quarter)
✅ Created project: Q1 Initiative
```

### Date Resolution

Linear projects support date resolutions to indicate time granularity:

- **quarter**: Project spans a quarter (Q1-Q4)
- **month**: Project spans a month
- **halfYear**: Project spans half a year (H1 or H2)
- **year**: Project spans an entire year
- _(none)_: Specific date without resolution

#### Auto-Detection (Recommended)

The parser **automatically sets the resolution** based on your input format:

```bash
# ✅ Recommended: Let the parser auto-detect resolution
agent2linear project create --start-date "2025-Q1"      # Auto: resolution = quarter
agent2linear project create --start-date "Jan 2025"     # Auto: resolution = month
agent2linear project create --start-date "2025"         # Auto: resolution = year
agent2linear project create --start-date "2025-01-15"   # Auto: no resolution (specific date)
```

#### Explicit Override (Advanced)

For advanced use cases, you can explicitly override the resolution with `--start-date-resolution` or `--target-date-resolution`:

**When to use explicit override:**

- Mid-period dates with specific resolution (e.g., mid-month representing a quarter)
- Resolution-only updates (update command only)

```bash
# ⚙️ Advanced: Override auto-detection
# Mid-month date representing Q1
agent2linear project create --start-date "2025-01-15" --start-date-resolution quarter

# Resolution-only update (update command)
agent2linear project update myproject --start-date-resolution quarter
```

**Validation warnings:**

```bash
# ⚠️ Conflicting format and explicit flag
$ agent2linear project create --start-date "2025-Q1" --start-date-resolution month
⚠️  Warning: Date format '2025-Q1' implies quarter resolution, but --start-date-resolution
    is set to 'month'. Using explicit value (month).
```

**Best practice:** Use auto-detection for 95% of cases. Only use explicit flags when the date format doesn't match your intent.

### Error Handling

Invalid dates are caught with helpful error messages:

```bash
$ agent2linear project create --title "Test" --start-date "2025-Q5"
❌ Invalid start date: Invalid quarter: Q5

Quarter must be Q1, Q2, Q3, or Q4. Examples:
  --start-date "2025-Q1"     → Q1 2025 (Jan 1 - Mar 31)
  --start-date "Q2 2025"     → Q2 2025 (Apr 1 - Jun 30)
  --start-date "Q3 2025"     → Q3 2025 (Jul 1 - Sep 30)
  --start-date "Q4 2025"     → Q4 2025 (Oct 1 - Dec 31)
```

## Development

```bash
# Build the project
npm run build

# Run in development mode (watch)
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with web UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Testing

This project uses [Vitest](https://vitest.dev/) for unit testing with comprehensive coverage of core utilities.

**Two test suites — different runners, different concurrency models:**

| Suite                 | Location             | Runner                      | Concurrency                                            | Isolation                                                                                                                                  |
| --------------------- | -------------------- | --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit tests**        | `src/**/*.test.ts`   | Vitest (`npm run test`)     | **Parallel** — files run concurrently in a worker pool | State/config tests own a `mktemp` sandbox and stub the relevant `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and/or `XDG_STATE_HOME`, with cleanup |
| **Integration / E2E** | `tests/scripts/*.sh` | Bash (`./run-all-tests.sh`) | **Sequential** — one process, no backgrounding         | Each script uses a fresh `mktemp` sandbox (`HOME`/`XDG`); the override-CLI suite is a stateful lifecycle (see below)                       |

**What must stay sequential — and why:**

- **`tests/scripts/*.sh` are sequential by design.** `run-all-tests.sh` runs each suite as a single blocking foreground process (no `&`/`wait`), and the bash suites shell out to the built `dist/index.js`. They are **not** run by Vitest and must not be parallelized.
- **`tests/scripts/test-config-override-cli.sh` is a stateful lifecycle suite**: its numbered cases (`add → list → get → edit → move → remove → explain`) execute in source order against **one shared sandbox** — case 1 creates the rule that later cases build on. Run the **full** suite, or use `--range` **starting at 1** (e.g. `--range 1-7`) to stop early. A non-prefix slice (`--test 14`, `--range 10-14`) reports false failures because the earlier fixtures never ran — expected, not a bug.
- **`tests/scripts/test-cursor-history-cli.sh` is an offline state lifecycle suite**: it isolates `HOME` and all XDG roots, unsets credentials/workspace variables, seeds a versioned history file, and verifies list/view/clear/help/error behavior against the built CLI.

**Parallelism is safe for the Vitest suite** because mutable filesystem tests are self-isolated and there are no `.concurrent` tests. Cursor-history also has a real multi-process lock test with six child writers. **New stateful unit tests must follow the same pattern**: own temporary roots, stub the relevant XDG variables in `beforeEach`, and clean up in `afterEach`.

**CI coverage:** `ci.yml` runs on every PR/push — typecheck, lint, the full Vitest suite (Node 22 + 24), build, four offline lifecycle suites, and the selected M36 built-CLI conformance fixtures (no secret). The **live** API suites run separately in `live.yml` — only on **push-to-`main`** and manual `workflow_dispatch` (never on PRs, so `LINEAR_API_KEY` is never exposed to a fork) — and they fail closed on the ConceptM workspace before creating disposable `TEST_*` entities.

**Running Tests:**

```bash
# Run all unit tests once (recommended for CI/CD and verification)
npm run test

# Watch mode - auto-run tests on file changes (best for active development)
npm run test:watch

# Interactive web UI for test exploration (debugging and visual analysis)
npm run test:ui

# Generate coverage report (check test completeness)
npm run test:coverage
```

**Running Specific Tests:**

```bash
# Run only date parser tests (104 tests)
npx vitest run src/lib/date-parser.test.ts

# Run tests matching a pattern
npx vitest run -t "Quarter formats"

# Run with verbose output
npx vitest run --reporter=verbose
```

**Test Files:**

- `src/lib/smoke.test.ts` - 4 basic sanity tests
- `src/lib/date-parser.test.ts` - 104 comprehensive date parser tests

**Date Parser Test Coverage (104 tests):**

- Quarter formats (15 tests) - All Q1-Q4 variants, case sensitivity, validation
- Half-year formats (10 tests) - H1/H2 variants, edge cases
- Month formats - Numeric (10 tests) - YYYY-MM format with validation
- Month formats - Named (20 tests) - Jan/January, all 12 months, case sensitivity
- Year formats (5 tests) - 4-digit years with range validation
- ISO date formats (10 tests) - YYYY-MM-DD with leap year validation
- Resolution detection (8 tests) - Auto-detection verification
- Parser priority (12 tests) - Format precedence rules
- Error messages (10 tests) - User-friendly error handling
- Edge cases (4 tests) - Whitespace, mixed case, boundaries

**Helper Function Tests (20 tests):**

- `getQuarterStartDate()` - 6 tests
- `getHalfYearStartDate()` - 4 tests
- `getMonthStartDate()` - 5 tests
- `parseMonthName()` - 5 tests

**Coverage:**

- Target: 95%+ coverage for core utilities
- Current: `date-parser.ts` has **99.10%** coverage
  - Statements: 99.10%
  - Branches: 98.07%
  - Functions: 100%
  - Lines: 99.04%
- Coverage reports available in `coverage/` directory after running `npm run test:coverage`

## Publishing

Publishing is owned exclusively by the tag-triggered
`.github/workflows/release.yml` workflow. Do not run `npm publish` locally;
the removed `np`/`npm run release` path is not a supported publisher.

The workflow verifies tag/package equality, static and offline gates,
production dependency audit, and the fail-closed ConceptM live suites before
its GitHub-hosted publish job uses npm trusted publishing with provenance. A
release operator must not create `v1.0.0` until every M36 candidate gate is
recorded against one exact commit and the project owner explicitly authorizes
the tag.

See the [M36 plan](docs/superpowers/plans/2026-07-26-M36-v1-release-tdd.md)
for the release gates and the
[rollback runbook](docs/superpowers/releases/2026-07-27-M36-v1.0.0-rollback.md)
for failed-tag, failed-publish, deprecation, dist-tag rollback, and forward-fix
procedures.

## Design Decisions

### No Permanent Issue or Project Delete Commands

Permanent issue and project deletion commands are intentionally omitted for
data safety. Destructive operations that cannot be recovered should be done
through the Linear web UI where the target can be visually confirmed. This
does not prohibit guarded delete/remove commands for other resource types;
for example, v1 includes issue-label and project-label delete operations.

For issues, you can use the trash/restore workflow:

```bash
agent2linear issue update ENG-123 --trash     # Move to trash (reversible)
agent2linear issue update ENG-123 --untrash   # Restore from trash
```

Trashed issues can be recovered; deleted entities cannot.

## Project Status

See [MILESTONES.md](./MILESTONES.md) for detailed project milestones and progress.

**Source version:** staged v1.0.0 candidate. This line does not claim a tag or
published npm artifact.

## License

MIT
