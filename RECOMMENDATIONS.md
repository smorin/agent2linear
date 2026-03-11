# agent2linear Codebase Improvement Recommendations

## Context
Research-based analysis of the agent2linear CLI tool (v0.24.1) — a TypeScript CLI for managing Linear projects and issues, designed for AI agents and automation. The codebase has 78+ command files, 20+ library modules, and ~18K lines of source code. Two recommendation sets follow: product (user-facing) and codebase (internal quality).

---

## Set 1: Product Recommendations (CLI Interface & UX)

### P1. Add a `whoami` top-level command
Currently there's no quick way to verify your API key and identity. `a2l whoami` should print the authenticated user's name, email, organization, and masked API key. The `testConnection()` and `getCurrentUser()` functions in `linear-client.ts` already exist — this is just a thin wrapper.

### P2. Add `--dry-run` flag to mutation commands
For AI agent use cases, a `--dry-run` flag on `create` and `update` commands would let agents preview what would be sent to the API without actually mutating state. Print the resolved payload (team name, labels, etc.) and exit. This is especially valuable for automation pipelines where mistakes are costly.

### P3. Add `cycle` commands (list, view, set-default)
Cycles (sprints) are a core Linear concept. The alias system already supports cycles (`'cycle'` entity type), but there are no `cycle list`, `cycle view`, or `cycle set` commands. Users have to know cycle IDs to use `--cycle` on issue create/update with no way to discover them via the CLI.

### P4. Add `issue comment` subcommand
Issues support comments in Linear but the CLI has no way to add them. `a2l issue comment <identifier> --body "text"` or `--body-file` would enable AI agents to post status updates on issues they're working on — a very common automation workflow.

### P5. Add `issue search` as an explicit command or enhance `issue list --search`
The current `--search` flag on `issue list` is limited. A dedicated `a2l issue search "query"` command (or enhancing the existing flag) with support for Linear's full-text search, filtering by date ranges, and sorting by relevance would be more discoverable and powerful.

### P6. Support piping and command chaining
Beyond M26's stream separation work, add support for reading input from stdin. For example: `echo "Bug title" | a2l issue create --team backend` or `a2l issue list --format json | a2l issue update --from-stdin`. This enables Unix pipeline workflows that AI agents and scripts depend on.

### P7. Add `--output-fields` / `--columns` flag for list commands
Let users choose which fields appear in table/TSV output. Currently fields are hardcoded per command. `a2l project list --columns "name,status,lead,url"` would reduce noise for automation and let users customize their view.

### P8. Add bulk operations
`a2l issue update --bulk "ENG-1,ENG-2,ENG-3" --state done` or `a2l issue create --from-file issues.json` for batch creation. AI agents frequently need to update multiple issues at once and currently must make N sequential calls.

### P10. Add `a2l doctor` diagnostic command
A diagnostic command that checks: API connectivity, configuration validity (default team/initiative exist), cache health, alias counts per entity type, and version info. Useful for debugging setup issues — especially in CI/CD or when an AI agent's environment is misconfigured. Separate from `whoami` (P1) which handles identity only.

### P13. No `delete` commands — by design
Delete commands are intentionally omitted for data safety. Document this decision prominently in README.md. Users should use `issue update --trash` for issues and the Linear UI for project deletion. The test cleanup scripts are an acceptable tradeoff.

### P9. Improve help text with examples
Commander.js supports `addHelpText('after', ...)`. Each command should show 2-3 concrete usage examples in `--help` output. Currently help only shows flags — users (especially AI agents) need to see example invocations to understand usage patterns.

### P11. Add `--no-color` global flag
For automation and CI environments, stripping ANSI color codes from output makes parsing easier. The output currently uses emojis and potentially ANSI codes that can interfere with machine parsing.

---

## Set 2: Codebase Recommendations (Code Quality & Architecture)

### C1. Split `cli.ts` (1,700 lines) into per-entity command registration files
`src/cli.ts` is a monolith that registers all 78+ commands. Each entity should register its own commands in a `register.ts` file (e.g., `src/commands/project/register.ts`) and `cli.ts` should just import and mount them. This improves maintainability and makes it easier to add new entities.

**Files affected**: `src/cli.ts` → split into ~18 registration files + slim orchestrator

### C2. Split `linear-client.ts` (4,084 lines) into domain-specific modules
This single file handles all Linear API calls for every entity type. Split into:
- `src/lib/api/projects.ts` — project CRUD + dependencies
- `src/lib/api/issues.ts` — issue CRUD + comments
- `src/lib/api/teams.ts` — team queries
- `src/lib/api/labels.ts` — issue + project labels
- `src/lib/api/client.ts` — authentication, connection test, shared utilities
- etc.

Re-export from a barrel `src/lib/api/index.ts` for backward compatibility.

**Files affected**: `src/lib/linear-client.ts` → ~8-10 focused modules

### C3. Consolidate the dual caching systems
There are two overlapping cache implementations: `entity-cache.ts` (session + persistent cache) and `status-cache.ts` (file-based cache with its own TTL logic). They duplicate cache loading, TTL checking, and file I/O patterns. Unify into a single `CacheManager` class with entity-specific methods, reducing ~400 lines of duplication.

**Files affected**: `src/lib/entity-cache.ts`, `src/lib/status-cache.ts` → unified `src/lib/cache.ts`

### C4. Extract command boilerplate into shared middleware/helpers
Many commands repeat the same pattern: resolve alias → validate entity → fetch data → format output → handle errors. Extract this into a command runner utility:
```typescript
// Conceptual
await runCommand({
  resolve: { team: options.team, initiative: options.initiative },
  validate: true,
  execute: async (resolved) => { /* command logic */ },
  format: options.format,
});
```
This would reduce per-command boilerplate by 30-50 lines.

**Files affected**: New `src/lib/command-runner.ts`, then incremental adoption across commands

### C5. Add unit tests for core library modules
Only `date-parser.ts` has unit tests (104 tests, 99.1% coverage). Critical modules with zero unit test coverage:
- `aliases.ts` (1,089 lines) — alias resolution, fuzzy matching
- `validators.ts` — input validation logic
- `parsers.ts` — comma/pipe parsing, dependency parsing
- `config.ts` — config priority chain
- `error-handler.ts` — HTTP error handling

These are pure functions that can be tested without API calls. Adding vitest tests would catch regressions cheaply.

**Files to create**: `src/lib/aliases.test.ts`, `src/lib/validators.test.ts`, `src/lib/parsers.test.ts`, etc.

### C6. Create a `LinearClient` singleton instead of calling `getLinearClient()` repeatedly
Every API function calls `getLinearClient()` which creates a new `SDKClient` instance each time. While lightweight, a singleton pattern would be cleaner and enable connection pooling or request queuing in the future.

**Files affected**: `src/lib/linear-client.ts`

### C7. Add structured logging instead of scattered `console.log`
Commands and library code use raw `console.log` throughout. A minimal logger (even just a thin wrapper) with levels (debug, info, warn, error) would enable:
- `--verbose` mode for debugging
- `--quiet` mode (M26 plans this but doesn't address the underlying architecture)
- Structured output for machine consumption
- Consistent formatting

**Files affected**: New `src/lib/logger.ts`, then gradual migration from `console.log`/`console.error`

### C8. Version mismatch between `package.json` and `cli.ts`
`package.json` says `0.24.1` but `cli.ts:80` has `.version('0.24.0')`. These should be kept in sync — ideally by reading from `package.json` at build time or using a single source of truth.

**Files affected**: `src/cli.ts:80`

### C9. Add CI/CD with GitHub Actions
No `.github/` directory exists. A basic CI pipeline should:
- Run `npm run typecheck` and `npm run lint` on every PR
- Run `vitest` unit tests on every PR
- Run integration tests on a schedule (since they need LINEAR_API_KEY)
- Automate npm publishing on tagged releases

**Files to create**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

### C10. Standardize error handling patterns across commands
Some commands use `try/catch` with `process.exit(1)`, others use `handleLinearError()`, and some throw unhandled. Standardize on a single pattern — ideally the command runner from C4 would handle this uniformly.

### C11. Move Ink components to a consistent location
Interactive UI components are split between `src/ui/components/` (5 files) and `src/components/` (WalkthroughScreen). Consolidate into one location.

**Files affected**: `src/components/` → move to `src/ui/components/`

### C12. Add `eslint-plugin-import` or equivalent for import ordering
Imports in `cli.ts` and command files have no consistent ordering. Adding import sorting rules would improve readability and reduce merge conflicts.

**Files affected**: `.eslintrc.json`

---

## Verification

These are research recommendations — no code changes to verify. The recommendations can be validated by:
1. Checking the referenced files and line numbers exist
2. Confirming the patterns described match the actual code
3. Reviewing against the existing MILESTONES.md backlog for overlap (M26 overlaps with C7 and P12)
