# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No additional changes are recorded after the staged v1.0.0 notes below. This
entry does not assert that a v1.0.0 tag or package has been published.

## [1.0.0] - 2026-07-27

> Release documentation was prepared on this date. Candidate CI and live
> evidence, tagging, package inspection, registry verification, and
> publication remain release gates; this section is not a publication claim.

### Added

- XDG Base Directory support for configuration, cache, state, aliases, and
  milestone-template storage, including migration-safe legacy cleanup.
- Multi-workspace and profile configuration with named credential sources,
  repository-based selection, fail-closed no-match policy, mutation banners,
  and workspace/profile management commands.
- Context-aware configuration overrides selected by path, Git identity,
  branch, remote, and boolean match expressions, with `-C`, `config get`,
  `config list`, and `config explain` provenance.
- Configurable prompt templates with location/team precedence, prompt
  inspection, and issue-prompt integration.
- Unified repository identity matching for host, owner, repository, remote,
  case sensitivity, forks, and multi-remote routing.
- `config override` add/list/get/edit/remove/move management with labels,
  validation, ordering, and read-side rule provenance.

- Complete `issue-labels|ilbl` and `project-labels|plbl` lifecycle management with create, view, update, delete, retire, restore, dry-run, guarded writes, human output, and stable JSON results.
- Raw-cursor label pagination with a default of 50, strict 1–250 limits, `--after`, `-a/--all`, `--include-retired`, cursor history, and copyable page-two commands.
- Reversible `project update --trash|--untrash` using Linear's supported project archive/unarchive lifecycle.
- Fail-closed ConceptM live verification covering label catalogs, applied and unused definitions, raw cursor traversal, independent retirement/archive timestamps, project trash/untrash, and fixture cleanup.

- First-class `issue comment add|list` and `project comment add|list` commands with replies, file/stdin body input, dry-run, human output, stable JSON envelopes, raw-cursor continuation, and cursor history.
- Guarded ConceptM live verification for direct issue/project comments, replies, page-two traversal, all-remaining traversal, and fixture cleanup.
- Shared raw-cursor pagination with `--after`, bounded `--limit`, and
  `-a/--all` traversal for issue and project lists.
- Local `cursor-history list|view|clear` commands backed by locked atomic XDG
  state, a 1,000-entry retention cap, safe reconstructed commands, and
  `--no-cursor-history` opt-out.
- Human next-page/all-remaining commands and stable JSON `pageInfo` plus
  `cursorHistory` metadata.
- Offline cursor-history lifecycle and multiprocess writer verification.
- Fail-closed ConceptM live pagination verification for issue/project page-two and all-remaining traversal.
- Global `--config`, repeatable `-v/--verbose`, `--debug`, and `--no-input`
  controls with redacted diagnostics and explicit noninteractive behavior.

### Changed

- **Breaking:** `project-labels list --all` now exhausts the same workspace catalog as bounded mode; it no longer implies archived scope. Use `--include-retired` independently.
- Label lists preserve Linear's explicit `createdAt` order and return stable pagination envelopes in JSON.
- `labels|lbl list|ls` is now a deprecation/help shim that names the canonical issue-label and project-label list commands.

- **Breaking:** replace legacy `issue comment <identifier>` with `issue comment add <identifier>`; the removed route exits 2 with a migration suggestion.
- `issue view --show-comments` now documents and enforces its 50-comment summary role, reports truncation, and propagates fetch failures instead of treating them as empty threads.
- Direct project-comment reads use the live-proven top-level project-filtered comment connection; project-update comments remain excluded.
- **Breaking:** issue/project list JSON results are resource envelopes rather than
  bare arrays.
- **Breaking:** issue/project list result selection uses `-o/--output` and
  `--json`; legacy `-f/--format` is removed.
- Limits use strict full-token integer parsing in the inclusive range 1–250.
- Project `-l/--lead` remains unchanged; project `--limit` remains long-only.
- Project traversal uses internal pages of 50 to remain below Linear GraphQL complexity limits while preserving the public 1–250 result bound.
- Pagination/auth/usage failures use differentiated exits 1–5.

### Security

- **Breaking:** literal `--api-key` argv input is removed. Use
  `--api-key-file <path|->`, named workspace environment variables, profile
  env files, or the local secrets registry; raw keys are not accepted from
  config argv input.
- Key-file and stdin allocation rules prevent a credential read from sharing
  stdin with another command input, and errors retain safe remediation rather
  than echoing a secret.

### Fixed

- Issue trash now uses Linear's dedicated trash mutation; untrash remains the
  matching restore path.
- Human issue/project not-found errors now use the same typed exit 3 contract
  as machine output.
- Invalid `config override add` input exits 2 and duplicate-rule conflicts
  exit 5 instead of both collapsing to runtime exit 1.
- Issue/project TSV output replaces embedded tabs, carriage returns, and line
  feeds so each result remains exactly one parseable row.
- SIGINT, SIGTERM, and closed stdout pipes now follow stable 130, 143, and
  quiet-pipe behavior without leaking stack traces.
- Named dry-run commands no longer perform hidden remote or local state writes.

## [0.24.0] - 2025-11-03

### Changed - Package Rename

- **Package renamed** from `linear-create` to `agent2linear`
- **CLI commands**: Both `agent2linear` and `a2l` (short alias) are now available
- **Repository**: Moved to https://github.com/smorin/agent2linear
- **npm package**: Published as `agent2linear` for better discoverability
- **Publishing**: Added `np` for automated releases (`npm run release`)
- **License**: Added MIT license file for npm compliance
- All documentation and examples updated to reflect new naming

### Added - Issue Commands Complete (M15)

This major release completes the comprehensive issue management suite with four full-featured commands.

#### Issue Create Command (M15.3)

- **23+ creation options** with full field coverage
- **Auto-assignment** to current user by default (override with `--no-assignee`)
- **Member resolution** via ID, alias, email, or display name
- **Project resolution** via ID, alias, or name lookup
- **Config integration** with `defaultTeam` and `defaultProject` support
- **Team-aware validation** for states and projects
- **Smart defaults** minimize required flags for common use cases
- **Hierarchical issues** with `--parent` flag for sub-issue creation
- **Date parsing** with natural language support ("tomorrow", "next week", etc.)
- **Label and subscriber** management with comma-separated lists
- **Content from files** with `--content-file` flag

#### Issue Update Command (M15.4)

- **33+ update options** covering all mutable fields
- **Add/remove patterns** for labels and subscribers (`--add-labels`, `--remove-labels`)
- **Clearing operations** with `--no-*` flags (assignee, dates, estimates, relationships)
- **Flexible updates** - update one field or many simultaneously
- **Team-aware validation** with automatic state compatibility checks
- **Mutual exclusivity** enforcement prevents conflicting flag combinations
- **Lifecycle operations** with `--trash` and `--untrash` flags
- **Parent relationship management** with `--parent` and `--no-parent`
- **Cross-team moves** with automatic state validation

#### Issue View Command (M15.2)

- **Terminal display** with comprehensive formatting
- **JSON output** mode for scripting and automation
- **Web browser** integration with `--web` flag
- **Comments display** with `--show-comments` flag
- **History display** with `--show-history` flag
- **Identifier resolution** supports both ENG-123 format and UUIDs

#### Issue List Command (M15.5)

- **Smart defaults** - shows your assigned issues automatically
- **Extensive filtering** - 20+ filter options including:
  - Team, state, priority, assignee, labels
  - Project, cycle, parent relationships
  - Date ranges (created, updated, due)
  - Parent/sub-issue filters
- **Flexible sorting** by priority, dates, identifier, or other fields
- **Multiple output formats**: table (default), compact, JSON, URLs
- **Performance optimized** with batch fetching:
  - Eliminates N+1 query patterns
  - 11x+ reduction in API calls
  - Sub-100ms response times for typical queries
- **Pagination support** with `--limit` and `--offset`

### Performance

- **Batch fetching infrastructure** (M15.1) eliminates N+1 queries across all issue commands
- **Entity caching** reduces redundant API calls
- **Query optimization** for list operations:
  - Before: ~110 API calls for 10 issues with relationships
  - After: ~10 API calls (11x reduction)
  - Typical response time: <100ms

### Developer Experience

- **Unit tests**: 108 tests covering date parsing and smoke tests
- **Integration tests**: Comprehensive test suites for all 4 commands
- **Type safety**: Full TypeScript coverage with strict mode
- **Error handling**: Helpful error messages with context and suggestions
- **Documentation**: Complete README updates and inline code documentation

### Internal

- **Infrastructure improvements** (M15.1):
  - `BatchFetcher` utility for optimized data loading
  - Enhanced resolvers for members, projects, cycles
  - Improved type definitions for issue entities
  - Config system updates for issue defaults

### Fixed

- JSON output in `issue view` includes status messages (known limitation - documented)
- Label validation in tests fails for cross-team labels (workspace-specific - not a bug)
- Date parser edge cases for relative dates
- Team validation for state transitions

## [0.23.0] - Previous Releases

(See archive/MILESTONES\_\*.md for detailed history of previous releases)

---

[0.24.0]: https://github.com/smorin/agent2linear/releases/tag/v0.24.0
