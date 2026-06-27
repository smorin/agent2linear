# agent2linear - Linear CLI Tool

  ## Project Overview
  **agent2linear** is a TypeScript-based command-line tool for creating and managing Linear projects, issues, labels, workflow states, and other entities via the Linear GraphQL API. Designed for AI agents and automation workflows.

  **CLI Commands:**
  - `agent2linear` - Full command name
  - `a2l` - Short alias for convenience

  **Technology Stack:**
  - TypeScript (ES2022, ESNext modules)
  - Commander.js (CLI framework)
  - Ink (React-based terminal UI for interactive modes)
  - Linear SDK (@linear/sdk)
  - Build: tsup (TypeScript bundler)
  - Task runner: turbo

  ## Prerequisites & Setup

  ### Required Environment Variables
  ```bash
  export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx

  Installation & Build

  # For development
  npm install
  npm run build

  # For end users (npm package)
  npm install -g agent2linear

  Running the CLI

  # After build (both commands work identically)
  agent2linear --help
  a2l --help

  # Or via node directly during development
  node dist/index.js --help

  Development Workflow

  Build Commands

  npm run build        # Production build (tsup)
  npm run dev          # Watch mode for development
  npm run lint         # ESLint check
  npm run typecheck    # TypeScript type checking
  npm run format       # Prettier formatting

  Architecture

  - Entry point: src/index.ts → compiles to dist/index.js (with shebang)
  - CLI definition: src/cli.ts - all command registration
  - Commands: src/commands/<entity>/<action>.ts(x) (.tsx for Ink components)
  - Libraries: src/lib/ - shared utilities (aliases, config, linear-client, etc.)
  - Types: src/lib/types.ts - TypeScript interfaces for all entities

  ## Code Intelligence Tooling

  This repo enables two Claude Code plugins for code intelligence. They are
  declared in the committed `.claude/settings.json` (`enabledPlugins`), so they
  apply to everyone who clones the repo:

  ```json
  {
    "enabledPlugins": {
      "typescript-lsp@claude-plugins-official": true,
      "ast-grep@ast-grep-marketplace": true
    }
  }
  ```

  **Note:** `enabledPlugins` is read at session startup; after editing
  `.claude/settings.json`, start a fresh session for changes to take effect.
  Personal/machine-specific overrides belong in `.claude/settings.local.json`
  (gitignored, not shared).

  ### TypeScript LSP (semantic navigation)

  Use for questions that require **type resolution** — "where is X defined / used",
  type/JSDoc info, refactor-grade reference analysis, and call hierarchy. Resolves
  this repo's ESM `.js`-extension imports back to their `.ts` sources via
  `tsconfig.json`.
  - Operations: `goToDefinition`, `findReferences`, `hover`, `documentSymbol`,
    `workspaceSymbol`, `goToImplementation`, `incomingCalls`/`outgoingCalls`.
  - Plugin: `typescript-lsp@claude-plugins-official`.

  ### ast-grep (structural pattern matching)

  Use for **structural** queries that ignore types — "every exported async function
  that awaits", "all `console.error(...)` call sites". Complements the LSP; it
  matches on AST shape, not semantics.
  - Requires the `ast-grep` binary on PATH (`brew install ast-grep`).
  - Match the grammar to the file's role: `--lang ts` for pure-logic `.ts` files,
    `--lang tsx` for Ink/React `.tsx` command files (JSX is a different grammar).
  - For relational YAML rules (`has`/`inside`), add `stopBy: end` so the traversal
    reaches descendants buried in function bodies.
  - Plugin: `ast-grep@ast-grep-marketplace` — docs:
    https://github.com/ast-grep/claude-skill

  ## Icon Handling (v0.13.2+)

  **IMPORTANT**: Icons are NOT validated client-side.

  - Icons are passed directly to Linear API for server-side validation
  - The curated icon list (src/lib/icons.ts) is for discovery only, not validation
  - Investigation confirmed Linear's API has no endpoint for the standard icon catalog
  - The `emojis` GraphQL query only returns custom organization emojis (user-uploaded)
  - See README.md "Icon Usage" section for user documentation
  - See MILESTONES.md M14.6 for complete investigation and rationale
  - See src/commands/project/create.tsx:208 for inline code documentation

  When implementing new commands with icon support:
  - Do NOT add client-side icon validation
  - Pass icon values directly to Linear API
  - Let Linear return errors for invalid icons
  - Reference the Icon Handling section for future developers

  Testing

  Test Suite Location

  All tests are in tests/scripts/ directory.

  Test Philosophy

  Integration tests using real Linear API, NOT unit tests.

  Tests create actual Linear entities with TEST_<timestamp>_ prefix and generate cleanup scripts (since delete commands aren't fully implemented yet).

  Running Tests

  Prerequisites

  1. LINEAR_API_KEY environment variable must be set
  2. Project must be built: npm run build
  3. Linear workspace should have at least one team

  Run All Tests

  cd tests/scripts
  ./run-all-tests.sh                # Run all project + issue tests
  ./run-all-tests.sh --project-only # Run only project tests
  ./run-all-tests.sh --issue-only   # Run only issue tests

  Run Individual Test Suites

  # Project tests
  ./test-project-create.sh          # ~45 test cases
  ./test-project-update.sh          # ~35 test cases

  # Issue tests
  ./test-issue-view.sh              # ~10 test cases
  ./test-issue-create.sh            # ~40 test cases
  ./test-issue-update.sh            # ~57 test cases
  ./test-issue-list.sh              # ~25 test cases

  # Run specific test range (project tests only)
  ./test-project-create.sh --test 5      # Run only test #5
  ./test-project-create.sh --range 10-20 # Run tests 10-20

  Test Coverage

  - ✅ All CLI flags and options
  - ✅ Alias resolution for all entity types (teams, initiatives, statuses, members, labels)
  - ✅ Multi-value fields (labels, members, links)
  - ✅ Content handling (inline vs file)
  - ✅ Date/priority/visual properties
  - ✅ Complex multi-field combinations
  - ✅ Error validation and edge cases
  - ✅ Project resolution (name/ID/alias)

  Test Output & Cleanup

  Tests create real Linear projects but do not auto-delete them. After running tests:

  # Cleanup scripts are auto-generated
  ./cleanup-create-projects.sh  # Lists projects to delete
  ./cleanup-update-projects.sh  # Lists updated projects
  ./cleanup-all-projects.sh     # Combined cleanup

  # Note: Currently requires manual deletion via Linear UI
  # (Waiting for 'project delete' command implementation)

  Verification Process

  When implementing new features or fixing bugs:
  1. Build: npm run build must succeed
  2. Type Check: npm run typecheck must pass
  3. Lint: npm run lint must pass (no new errors)
  4. Integration Tests: Run relevant test suite
  5. Manual Testing: Test interactive modes (-I flag) manually

  Project Milestones

  Active Milestones

  See MILESTONES.md for current and future milestones.

  Completed Milestones

  See archive/MILESTONES_01.md for milestones M01-M13 (v0.1.0 through v0.13.1).

  Milestone Format

  Each milestone follows this structure:
  - Status: [x] Completed, [-] In Progress, [ ] Not Started, [~] Won't fix
  - Goal: What functionality is being delivered
  - Requirements: Detailed requirements
  - Out of Scope: Explicitly excluded items
  - Tests & Tasks: Individual tasks with IDs (e.g., M12-T01, M12-TS01)
  - Deliverable: Example CLI usage
  - Automated Verification: Build, lint, typecheck requirements
  - Manual Verification: Human testing checklist

  Current Version

  v0.13.1 - Bug fixes from analysis

  In Progress

  M12: Metadata Commands - Labels, workflow states, icons & colors (v0.12.0)

  Key Features

  Aliases System

  Aliases allow using simple names instead of Linear IDs:
  - Storage: $XDG_CONFIG_HOME/agent2linear/aliases.json (global; default: ~/.config/agent2linear/aliases.json) or .agent2linear/aliases.json (project)
  - Supported entities: teams, initiatives, project-statuses, members, workflow-states, issue-labels, project-labels
  - Commands: alias add/list/remove/get/edit/sync
  - Usage: Aliases can be used anywhere an ID is expected

  Milestone Templates

  Reusable milestone templates for projects:
  - Storage: $XDG_CONFIG_HOME/agent2linear/milestone-templates.json (global; default: ~/.config/agent2linear/milestone-templates.json) or .agent2linear/milestone-templates.json (project)
  - Format: JSON with name, description, milestones array
  - Commands: milestone-templates create/list/view/edit/remove
  - Application: project add-milestones <project> --template <name>

  Configuration

  Persistent defaults for common values:
  - Storage: $XDG_CONFIG_HOME/agent2linear/config.json (default: ~/.config/agent2linear/config.json)
  - Supported: defaultTeam, defaultInitiative, defaultMilestoneTemplate
  - Multi-workspace keys (M28): defaultProfile, profiles, noMatchPolicy (deny|default|match-only), confirmAutoDetectedWrites
  - Context-aware overrides (M29): overrides[] (see below)
  - Commands: config list/get/set/unset/edit, config explain [dir]

  Context-Aware Config Overrides (M29)

  Optional `overrides[]` in config.json (global + repo) resolve *defaults* (defaultTeam,
  defaultInitiative, defaultProject, templates, defaultAutoAssignLead, per-rule aliases) by
  CONTEXT — filesystem location, repo identity, branch — instead of one flat value per scope.
  Additive/backward-compatible: no `overrides` ⇒ behavior identical to today; apiKey/workspace
  selection is never affected.
  - Rule shape: { when: {…}, …defaults, aliases?: { teams: { <alias>: <id> } } }. Resolution is
    field-level (a rule setting only defaultTeam leaves defaultInitiative to fall back).
  - `when` matchers: path (relative = repo-root-anchored gitignore glob; leading ~//= disk),
    repo/owner/host (identity normalized to host/owner/name; reads `origin` unless `remote`
    qualifies), branch, and composites allOf/anyOf/not. `remote` = name | list | "*"; bare
    `remote` = "a remote of that name exists" (the fork case via anyOf + remote, U9).
  - Precedence (§5.6): repo scope beats global regardless of specificity; within a scope
    most-specific wins (exact repo > repo-glob/owner value > host/bare-remote presence >
    path > branch > catch-all); ties break by declaration order.
  - Targeting: global `-C, --cwd <dir>` (git-style) + AGENT2LINEAR_CWD make any command resolve
    as if launched in <dir> (config discovery + override matching + relative path args).
  - Authoring (M32 — `config override`, alias `config ov`): full CRUD + reorder without hand-editing
    config.json. Every rule is addressable by a stable human-chosen LABEL (top-level `id`); legacy
    unlabeled rules by `#<index>`. Verbs (all take `-g/--global` default or `-p/--project`, `--json`):
      - `add <label>` — ≥1 `when` criterion + ≥1 value; flag-sugar (`--when-repo/-owner/-host/-path/
        -branch/-remote`, repeatable + comma = OR within a facet; `--when-not-*` → one De-Morgan `not`)
        XOR the `--when-json` escape hatch; `--set <key=value>` (OVERRIDABLE_FIELDS only — apiKey
        rejected structurally) / `--alias <entity>.<name>=<id>`. Dup label in scope is hard-blocked.
      - `list` (context-independent inventory, scope→file order + a static specificity tag) / `get
        <selector>` (full rule) / `edit <selector>` (field-by-field value merge + `--unset`/`--rm-alias`;
        ANY `when` input replaces the whole `when`; may assign a label to a `#<index>` rule) /
        `remove <selector>` (alias `rm`) / `move <selector> --before|--after <selector>` (reorder a
        scope to control equal-specificity tie-break). `--dry-run` on `add`/`edit`.
      - Single-item `--json` (get/add/edit/remove/move) is a BARE object; `list` + `explain`'s
        `rules[]` are the only arrays. Eager validation (globs, `when` keys, label uniqueness) before write.
      - Implementation: src/commands/config/override/{add,list,get,edit,remove,move,register,shared}.ts.
        shared.ts is the pure builder/validator/serializer (parseSet/parseAlias/buildWhenFromFlags/
        validateWhenJson/resolveSelector/specificityTag/apply*); the value whitelist is the resolver's
        own OVERRIDABLE_FIELDS (single source of truth — no CLI-vs-engine drift).
  - Debugging: `config explain [dir] [--json]` prints the resolved context + winning rule per field —
    named by its LABEL (`label ?? #<ruleIndex>`, a valid `config ov` selector). M32 (4b lite) adds a
    `rules:` section annotating EVERY rule (both scopes) ✓/✗ for the context — ✓/✗ comes from the
    resolver's OWN matchWhen(rule.when, ctx) (no drift) and each rule's `when` is echoed (no per-facet
    prose reason); `--json` carries a top-level `rules: [{label, scope, when, matched, winsFields}]`
    array alongside `resolved` (`winsFields` derived from the resolved locations, not recomputed).
    `config get <key> [dir]` returns one override-resolved field (label-named).
  - Implementation: src/lib/glob-match.ts (path: picomatch + anchoring; identity/branch glob),
    src/lib/git-context.ts (§5.4 identity normalization; injectable runner; leaves
    git-remote.ts untouched), src/lib/overrides.ts (recursive matchWhen → {matched, score}; copies
    `rule.id` into the provenance ConfigLocation.ruleId — provenance only, never a resolved value),
    threaded via getConfig(contextDir?) in src/lib/config.ts. The per-rule alias overlay is
    stashed in the invocation context and applied at highest precedence by loadAliases().

  Prompt Templates (M30)

  Ask `a2l` for the right markdown prompt to follow before creating a Linear issue,
  selected by context. M1 (this release) is read-side only — prompts are hand-authored
  JSON/`.md`; CRUD/interpolation are M2. Fully additive: a config with no prompts behaves
  exactly as today, and apiKey/workspace selection is never affected.
  - Storage (prompts.json, committable):
    - Global:  $XDG_CONFIG_HOME/agent2linear/prompts.json (default: ~/.config/agent2linear/prompts.json)
    - Project: .agent2linear/prompts.json (nearest, walking up from the current directory)
    - Project overwrites global by name (same merge as milestone-templates).
  - Store shape: { "prompts": { "<name>": { description?, body? | bodyFile? } }, "promptRules"?: [...] }.
    Each prompt sets EXACTLY ONE of inline `body` or `bodyFile`. A relative `bodyFile` is
    anchored to the directory of the prompts.json that DECLARES it (not the invocation cwd),
    so a committed project prompts.json resolves portably; absolute / `~` paths are used as-is.
  - `defaultPrompt` is a first-class config key (a local prompt NAME): settable/gettable/
    listed/validated (the name must exist in prompts.json) and shown in `config explain` /
    `config list`. It is wired into the M29 `overrides[]` engine, so a path/repo/branch rule
    may set `defaultPrompt` (location-aware general default) with zero new matching code.
  - Team layer (`promptRules`, NESTED like config overrides[]): each rule is
    { "when": { "team": "<id|alias>", …location matchers }, "prompt": "<name>" }. The resolved
    team = `--team` ?? config.defaultTeam, normalized via resolveAlias('team', …) on BOTH sides
    so an alias and the raw team_* id compare equal. (M1 compares resolved ids; team-name
    globbing is M2.) A `team` key in config `overrides[]` is still warn-skipped (config-field
    resolution is byte-identical) — `team` is honored ONLY on the prompt path.
  - Selection precedence: explicit name → specific location override (path/repo/owner/host) →
    team (promptRules) → general defaultPrompt (top-level OR a branch-only/catch-all override)
    → error. An explicit `--team X` with no matching promptRule is a hard error (exit 1); a
    DERIVED defaultTeam with no rule falls through to general. A branch-only override is
    general-tier (team outranks branch).
  - `--force` (on `prompt get` / `issue prompt`, scoped to an explicit `--team`): evaluate the
    team layer FIRST — a matching promptRule outranks any location override; no match is a hard
    error (exit 1) even when a location override or general default would otherwise resolve.
    `--force` without an explicit `--team` is a no-op.
  - Commands (the `prompt` group is aliased as `skill` — `a2l skill <sub>` = `a2l prompt <sub>`;
    `a2l skill get` returns "the right skill to call," i.e. the context-appropriate prompt an
    agent should follow before creating an issue):
    - `prompt get [name]` — print the applicable prompt as raw markdown (or `--json` envelope
      { name, source, selection, body, context }). Flags: `--team <id|alias>`, `--force`, `--json`.
    - `prompt list [partial]` — names grouped by source. Default human output is NAMES ONLY;
      `--descriptions` adds descriptions; `--format json|tsv` emits the complete record
      (name, description, source). `[partial]` filters by name substring (case-insensitive),
      applied to every format.
    - `prompt explain [dir]` — mirrors `config explain` plus the team layer: context, resolved
      defaultPrompt + provenance, team (input/resolved id), the matched promptRule (shown even
      when a location override outranks it), and the final selection + tier. `--json` for the
      structured trace; unlike `prompt get`, it never exits 1 (an unresolved selection is reported).
    - `issue prompt [name]` — thin alias for `prompt get` (same `--team`/`--force`/`--json` flags).
  - Implementation: src/lib/prompts.ts (store load/merge, body resolution, promptRules, the
    `resolvePrompt` ladder), src/lib/overrides.ts (team-aware `matchWhen` gated by `allowTeam`;
    `whenIsLocationSpecific` for tiering), src/commands/prompt/{get,list,explain,register}.ts.

  Multi-Workspace & Profiles (M28)

  Three-tier defaults hierarchy `global < profile < repo`. The single-key "simple
  case" (LINEAR_API_KEY env or apiKey in config) is unchanged — profiles/workspaces
  are strictly opt-in.
  - Workspaces (secrets): name → { apiKey }. Storage: $XDG_CONFIG_HOME/agent2linear/workspaces.json (global, mode 0600) or .agent2linear/workspaces.local.json (project, auto-gitignored). Commands: workspace add/list/remove/current.
  - Profiles (settings, commit-safe): name → { workspace, default*, match, linear, apiKeyEnv, envFile }. Live in config.json under `profiles`. Commands: profile add/list/edit/remove, profile match add/list/remove, profile exclude.
  - Match rules (M31): `match` is a `MatchRule` = { remote?, gitRemoteHost?[], gitRemoteOwner?[], gitRemoteRepo?[], caseSensitive?, linear? }, all identity fields glob, case-INSENSITIVE by default (per-rule `caseSensitive` opts in). Present fields AND, each list ORs; a rule matches when some `selectRemotes(remote)` (default origin; name/list/`"*"`/bare = the fork "a remote exists" predicate, mirrors M29's `WhenLeaf.remote`) satisfies every present field. detectProfile now shares git-context.ts's parser + matchGlob, so nested-group owner is `group/sub` (all-but-last), not `group`. >1 positive match prints an informational ambiguity warning in doctor + `match list` (tie-break unchanged). Branch-based selection is out of scope.
  - Selection precedence (R8): --workspace/--api-key → AGENT2LINEAR_WORKSPACE → repo config profile/workspace → git-remote auto-detect (remote identity → profile.match host/owner/repo + `remote`; default origin, negative-wins → first-positive-wins) → defaultProfile → legacy key.
  - Key-source precedence (R7): --api-key → named env var (apiKeyEnv or LINEAR_API_KEY_<NAME>) → per-profile envFile (dotenv) → workspaces secrets registry → legacy plain LINEAR_API_KEY. Committable config never holds a raw key.
  - Safety (R11): mutating commands (issue create/update, project create) print a workspace/source banner (stderr) and support --json (incl. workspace.source) + -y/--yes. An auto-detected write in a multi-workspace setup confirms on a TTY and fail-safe errors (exit 1) non-interactively. noMatchPolicy=deny (default) refuses to guess; explicit --workspace/--api-key always forces through. whoami/doctor show the active workspace + source; doctor warns on secrets-hygiene issues.

  Storage Locations (XDG)

  - Config (config.json, aliases.json, milestone-templates.json) honors $XDG_CONFIG_HOME/agent2linear/ (default: ~/.config/agent2linear/).
  - Secrets registry: workspaces.json (global, mode 0600) and .agent2linear/workspaces.local.json (project, auto-added to .gitignore). Never committed.
  - Caches live at $XDG_CACHE_HOME/agent2linear/<workspace-key>/ (default: ~/.cache/agent2linear/<workspace-key>/), keyed per workspace (sha256(apiKey) slice), so switching workspaces never mixes cached data.
  - Project config is discovered by walking up from the current directory toward $HOME for the nearest .agent2linear/ directory.

  Common Commands

  Project Creation

  # Minimal
  agent2linear project create --title "My Project" --team <team-id>

  # With aliases
  agent2linear project create --title "API Redesign" --team backend --initiative q1-goals

  # Full featured
  agent2linear project create \
    --title "Mobile App" \
    --team mobile \
    --initiative product-2025 \
    --description "iOS and Android app" \
    --content-file docs/mobile-spec.md \
    --status planned \
    --priority 1 \
    --start-date 2025-02-01 \
    --target-date 2025-06-30 \
    --icon "Smartphone" \
    --color "#4ECDC4" \
    --labels "label_1,label_2" \
    --members "user_1,user_2" \
    --link "https://github.com/org/mobile|GitHub"

  Testing New Commands

  When implementing new commands:
  # 1. Build
  npm run build

  # 2. Test command directly
  node dist/index.js <command> --help
  node dist/index.js <command> <args>

  # 3. Run relevant test suite (if exists)
  cd tests/scripts
  ./<relevant-test>.sh

  # 4. Test interactive mode manually
  node dist/index.js <command> --interactive

  # 5. Verify build & type checking
  npm run typecheck
  npm run lint

  Release Process

  1. Complete all tasks in milestone
  2. Update MILESTONES.md - mark tasks as [x] completed
  3. Run verification:
  npm run build
  npm run typecheck
  npm run lint
  cd tests/scripts && ./run-all-tests.sh
  4. Update version in package.json and src/cli.ts
  5. Commit with milestone message
  6. Tag release: git tag v0.X.Y
  7. Push: git push && git push --tags
  8. Move completed milestone to archive/MILESTONES_XX.md if needed

  Important Notes for AI Assistants

  Alias Resolution

  When implementing commands that accept entity IDs:
  1. Always use resolveAlias(entityType, idOrAlias) from src/lib/aliases.ts
  2. Entity types: 'team', 'initiative', 'project-status', 'member', 'workflow-state', 'issue-label', 'project-label'
  3. Resolution happens in command logic, not in the CLI argument parsing

  Error Handling

  - Validate inputs early (before API calls)
  - Provide helpful error messages with context
  - Use Linear SDK error types where applicable

  Interactive vs Non-Interactive

  - Use .tsx extension for components with Ink UI (interactive)
  - Use .ts extension for pure command logic (non-interactive)
  - Always support both modes where applicable with -I, --interactive flag

  Testing Strategy

  - Write integration tests in tests/scripts/ using bash
  - Test both success and error cases
  - Use real Linear API (not mocks)
  - Generate cleanup scripts for manual deletion
  - Test with aliases, not just IDs

  Code Style

  - TypeScript strict mode enabled
  - ESM modules (.js extensions in imports)
  - Prefer async/await over promises
  - Use commander.js Option/Argument classes for type-safe options