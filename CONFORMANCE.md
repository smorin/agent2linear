# CLI Design Standard Conformance

This repository is reviewed against **CLI Design Standard v1.4.14** at the
**publishable** tier. M34's pagination and cursor-history surfaces are designed to
that tier; this document does not claim that every older command already conforms.

## M36 audited-v1 release snapshot (2026-07-27)

M36 is the coordinated v1.0.0 publishable-tier audit and release gate. Its authoritative 76-item
ledger is [the M36 TDD plan](docs/superpowers/plans/2026-07-26-M36-v1-release-tdd.md). M25 and M26
are superseded as recorded in
[the milestone reconciliation](docs/superpowers/plans/2026-07-26-M25-M26-milestone-reconciliation.md).

The implementation through release-policy review is green, including 1,156 passing tests (one
intentional skip), the complete sequential built-CLI fixture gate, and fail-closed ConceptM
automation with cleanup. Version/Node alignment, reviewed documentation, the rollback runbook, and
the production dependency audit (0 vulnerabilities across 71 production dependencies) are
complete. The release is still not ready to publish: exact-candidate live evidence, package
inspection, trusted-publisher verification, tag, registry verification, and publication remain
open. No commit, tag, or publication is authorized by this snapshot.

This is an **audited release with explicit exceptions**, not a claim of complete CLI Standard
conformance. Applicable MUST deviations remain labeled exceptions. Applicable SHOULD deviations
remain labeled waivers. The owner approved this bounded disposition on 2026-07-27 instead of
expanding M36 into a repository-wide interface rewrite.

### Applicability and rule disposition

| Axis                   | Applies | M36 disposition                                                          |
| ---------------------- | ------: | ------------------------------------------------------------------------ |
| Configuration          |     Yes | Established JSON/XDG/profile/workspace model; explicit exceptions below  |
| Networked              |     Yes | Linear SDK/raw GraphQL, workspace targeting, bounded raw-cursor adopters |
| Destructive operations |     Yes | Shared confirmation, `--yes`, `--no-input`, and dry-run evidence         |
| Scripted consumers     |     Yes | Canonical output for the named M36 inventory; legacy exceptions below    |
| Local state/cache      |     Yes | XDG state/cache with scoped dry-run suppression                          |
| Secrets                |     Yes | argv literal removed; safe key-file/env/stored resolution and redaction  |
| Long-running/streaming |      No | No asynchronous job or streaming-result interface                        |
| Plugins/self-update    |      No | Neither capability exists                                                |
| Application telemetry  |      No | agent2linear transmits no application telemetry                          |

Primary disposition across R1.1-R10.7's 74 rule IDs: **32 pass, 17 accepted MUST exceptions, 14
SHOULD waivers, and 11 N/A**. `R4.1` is classified as an exception because legacy result commands
lack the canonical selector; its required version behavior now emits exactly `agent2linear 1.0.0`.

### Owner-approved MUST exceptions

These prevent a complete-conformance claim. They are accepted only for the audited v1 release and
must remain visible in migration and release notes.

| Rule                               | Retained behavior                                                                                                                                                                               | Rationale                                                                                                    | Future compatibility cost                                                                                         | Owner/date                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------- |
| R1.3                               | Canonical plural groups remain: `issue-labels`, `project-labels`, `teams`, `members`, `templates`, `initiatives`, `cycles`, `icons`, `colors`, `workflow-states`, and `milestone-templates`     | Renaming established families would multiply v1 migration work without improving the coordinated features    | Future singularization is another major-version migration or permanent cross-tool inconsistency                   | Project owner, 2026-07-27                                    |
| R3.4, R4.1, R4.2, R7.1, R7.2, R7.8 | Fifteen legacy result commands retain `-f/--format`; twelve JSON-capable legacy commands retain JSON-only selectors. The named 28-command M36 inventory is canonical                            | Migrating 27 additional commands was rejected as uncontrolled release-scope growth                           | Wrappers must understand two output generations; complete normalization requires a later major-compatible project | Project owner, 2026-07-27                                    |
| R3.8                               | Credential sources retain `--api-key-file`, `LINEAR_API_KEY*`, and the historical `apiKey` config key instead of deterministic name parity                                                      | The distinct names communicate file versus literal value and preserve Linear ecosystem environment variables | Generic cross-tool configuration mapping cannot infer this setting mechanically                                   | Project owner, 2026-07-27                                    |
| R5.1                               | Resolution retains project/profile/global layering, with environment overriding the credential path rather than the Standard's full generic chain                                               | Replacing multi-workspace routing would be a separate configuration redesign                                 | Operators must use agent2linear-specific precedence documentation                                                 | Project owner, 2026-07-27                                    |
| R5.2                               | JSON remains the canonical discovered and explicit configuration format                                                                                                                         | A TOML migration is unrelated to the v1 feature/release objective                                            | Future format migration requires dual-read tooling and a major compatibility plan                                 | Project owner, 2026-07-27                                    |
| R5.3                               | User config/state/cache honor XDG, but there is no `$XDG_CONFIG_DIRS` system search and project discovery follows the established repository/home behavior                                      | Adding a new system layer could silently alter existing workspace selection                                  | Later adoption needs explicit precedence and boundary migration tests                                             | Project owner, 2026-07-27                                    |
| R5.4                               | `LINEAR_API_KEY*` and `AGENT2LINEAR_WORKSPACE` remain the environment interface                                                                                                                 | These public names reflect the provider and existing product identity                                        | A uniform prefix would require aliases, deprecation, and another major cleanup                                    | Project owner, 2026-07-27                                    |
| R7.5                               | Commander help retains its existing `Usage`-first shape and `Options` terminology rather than the Standard's summary-first `Flags` shape                                                        | Global help retemplating is broad presentation work with substantial snapshot churn                          | Help consumers cannot assume the organization-wide section order                                                  | Project owner, 2026-07-27                                    |
| R7.7                               | The shared boundary flushes normal and signal paths, but legacy direct `process.exit()` sites do not all use it                                                                                 | Replacing hundreds of legacy exit sites was rejected as unsafe release expansion                             | A rare buffered legacy path may lose final output until exits are centralized                                     | Project owner, 2026-07-27                                    |
| R9.2                               | v1 immediately removes literal `--api-key`, legacy issue-comment grammar, issue/project/label `-f/--format` selectors, the old functional `labels list` route, and alias-clear force-as-consent | These breaks are security corrections or coordinated v1 migrations with exact replacement guidance           | Old scripts must migrate at the major boundary; no hidden working alias remains                                   | Project owner, 2026-07-27                                    |
| R9.4                               | Several legacy machine lists use locale-sensitive `localeCompare` ordering                                                                                                                      | Reordering unrelated legacy lists was rejected for this release                                              | Cross-locale row order can differ until a later stable-order project                                              | Project owner, 2026-07-27                                    |
| R10.1                              | Workspace/profile/`whoami`/`doctor` remain the authentication and identity model instead of a new `auth login                                                                                   | logout                                                                                                       | status` group                                                                                                     | The existing model is fundamental to multi-workspace routing | Integrations must follow agent2linear's identity vocabulary | Project owner, 2026-07-27 |

### Owner-approved SHOULD waivers

| Rule        | Waived behavior                                                                                                                                         | Rationale                                                                                                | Future compatibility cost                                                      | Owner/date                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| R2.1        | Nested comments use `add`; project trash remains under `project update`; several established nested resources use `add`/`remove`                        | Matches existing repository vocabulary and avoids implying permanent project deletion                    | Vocabulary remains less predictable across organization CLIs                   | Project owner, 2026-07-27 |
| R3.9        | Comments retain field-specific `--body-file`                                                                                                            | It preserves the existing body-input contract and is clearer than a generic file when other inputs exist | Generic wrappers need a command-specific input mapping                         | Project owner, 2026-07-27 |
| R4.3        | M36 proves the named 24-command dry-run inventory but does not add dry-run to every legacy mutation                                                     | Universal mutation redesign was outside the bounded release                                              | Some legacy mutations still require command-specific safety knowledge          | Project owner, 2026-07-27 |
| R5.8        | Discovered malformed config may still collapse to an empty object and there is no `config validate` command                                             | Strict explicit `--config` safety was prioritized; discovered-config migration is larger                 | Troubleshooting hand-edited discovered config remains weaker                   | Project owner, 2026-07-27 |
| R6.3        | Bulk issue update stops at the first child failure; mixed dependency successes/failures do not always exit 1                                            | Changing partial-success semantics risks existing automation and needs its own output contract           | Agents cannot use one uniform partial-failure rule across these legacy batches | Project owner, 2026-07-27 |
| R7.4        | Legacy progress/TTY suppression is not normalized repository-wide                                                                                       | Named M36 machine streams are clean; unrelated human presentation was deferred                           | Some legacy piped human commands may retain inconsistent progress behavior     | Project owner, 2026-07-27 |
| R7.11       | `cycles`, project statuses, project dependencies, team-filtered members, and workspace-color ties retain backend-defined order                          | Changing order is observable and unrelated to the coordinated cursor adopters                            | Reproducible diffs require callers to sort those legacy results                | Project owner, 2026-07-27 |
| R9.1        | No shell-completion or man-page generator ships in v1                                                                                                   | Documentation and generated completion are a separate deliverable                                        | Discoverability relies on built-in help and README                             | Project owner, 2026-07-27 |
| R9.5        | The application adds no timeout/bounded-retry layer over the Linear client                                                                              | Retry safety requires mutation/idempotency analysis beyond this release                                  | Network stalls and transient failures follow SDK behavior                      | Project owner, 2026-07-27 |
| R9.8        | Some legacy empty states do not suggest a next command                                                                                                  | Rewriting unrelated human messages was deferred                                                          | First-run guidance remains uneven                                              | Project owner, 2026-07-27 |
| R9.10       | `doctor` lacks machine output and does not make every failed check nonzero                                                                              | The existing human diagnostic remains useful; redesign was deferred                                      | Automation must parse or separately verify diagnostics                         | Project owner, 2026-07-27 |
| R10.2-R10.3 | `-a/--all` remains exhaustive pagination, raw continuation uses `--after` only on adopted cursor surfaces, and legacy remote lists are not all migrated | This is the established M34 pagination convention and avoids two exhaustive synonyms                     | Callers must know which list family supports raw continuation                  | Project owner, 2026-07-27 |
| R10.7       | Rate limits are not normalized to a central stable code/retry-hint contract                                                                             | Correct retry policy depends on provider and mutation safety                                             | Automation sees some rate limits as generic runtime failures                   | Project owner, 2026-07-27 |

### Permanent conformance evidence

Ordinary CI now runs the existing config-override, cursor-history, comments, and label-lifecycle
offline suites plus nine M36 built-CLI fixtures covering safe credentials, explicit config, streams,
JSON errors, output migration, parser/no-input behavior, signals, TSV machine parsing, and exact
version output. The
fixture-to-CI assertion is `src/lib/m36-conformance-fixtures.test.ts`. Exact-candidate CI and
ConceptM live evidence remain separate release gates.

## M34 applicability

| Axis                           | Applies | M34 behavior                                            |
| ------------------------------ | ------: | ------------------------------------------------------- |
| Configuration                  |     Yes | Existing workspace resolution plus XDG state            |
| Networked                      |     Yes | Forward-only Linear GraphQL cursor traversal            |
| Destructive                    |     Yes | Local `cursor-history clear`                            |
| Scripted output                |     Yes | Stable JSON envelopes and structured errors             |
| Local state                    |     Yes | Locked, atomic, owner-only cursor history               |
| Secrets                        |     Yes | Reconstructed commands exclude credentials and raw argv |
| Async jobs, streaming, plugins |      No | Not part of M34                                         |

## Conforming M34 decisions

- Result-producing issue/project lists use canonical `-o, --output` and equivalent
  `--json`; cursor-history result commands do the same.
- Invalid syntax and values exit 2; missing history entries exit 3; authentication
  failures exit 4; rejected cursors and precondition conflicts exit 5.
- Result data is written to stdout. Diagnostics and structured machine errors are
  written to stderr.
- Durable history uses `$XDG_STATE_HOME/agent2linear` or
  `~/.local/state/agent2linear`, with locked atomic replacement and explicit clear.
- `cursor-history clear` supports confirmation, `--yes`, `--no-input`, and
  `--dry-run`.
- Remote lists are bounded by default and expose a raw forward cursor for explicit
  continuation.
- Adapter-specific internal request caps may be lower than the public result bound; project traversal uses 50 to satisfy Linear GraphQL complexity while still returning up to 250 requested results.

## Explicit M34 waiver

CLI Standard R10.2/R10.3 uses `--paginate` for exhaustive traversal and treats
`--all` primarily as a scope selector. agent2linear already uses `-a, --all` for
pagination, so M34 retains that spelling consistently across adopters. M34 is the
sole owner of this SHOULD-level waiver; M33 label lists and M35 comment lists depend
on it and do not define additional aliases.

## Coordinated-major breaking changes

M34 intentionally requires a coordinated major release for these existing
interfaces:

- Issue/project list JSON changes from a bare array to
  `{issues|projects,pageInfo,cursorHistory}`.
- The nonstandard `-f, --format` result selector is removed in favor of
  `-o, --output` and `--json`. The Standard reserves `-f` for force.
- Partial numeric limit tokens such as `12abc` and `1.5` are rejected.
- Project list newly enforces the documented maximum limit of 250.
- Pagination usage failures use exit 2 instead of the older generic exit 1.

**Release decision (2026-07-25):** the project owner accepted `v1.0.0` or
later for the coordinated M33-M35 changes. This resolves R9.3 version selection;
it does not waive the separate MUST-level nonconformances documented below.

## Pre-existing repository blockers outside M34

The repository must not claim complete publishable-tier conformance until older
global surfaces are addressed. Known blockers include:

- no global `--config` selector;
- no global `--debug` option;
- `-v/--verbose` is not repeatable;
- `--api-key <key>` accepts a secret through argv.

Those items are not broadened into M34. They remain visible so a scoped M34 review
cannot be mistaken for a full-CLI conformance claim.

## Evidence

The authoritative atomic ledger and verification method are in
[the M34 TDD plan](docs/superpowers/plans/2026-07-22-M34-raw-cursor-pagination-history-tdd.md).
Offline built-CLI coverage is provided by
`tests/scripts/test-cursor-history-cli.sh`. The opt-in
`tests/scripts/test-pagination-live.js` harness is intended to fail closed to the
ConceptM organization/workspace and performs no remote writes. Its current CI identity assertion is
the explicit `RLS-BLK-LIVE-M34` release blocker; M36 must make the environment hermetic and restore
the green live proof. The 214-ID completion map is
`docs/superpowers/plans/2026-07-24-M34-traceability.md`.

## M35 comment-management conformance

M35 adds symmetrical `issue comment add|list` and `project comment add|list`
surfaces at the publishable tier. Result commands independently expose
`-o, --output <table|json>` and equivalent `--json`. Lists are bounded at 50
by default, expose the exact raw `--after` cursor, and adopt M34's cursor-history
and `-a, --all` behavior without defining a second pagination primitive.

Direct project comments are created with `commentCreate(projectId: ...)`. Live
ConceptM verification proved that current direct project-comment reads must use
the top-level `comments` connection filtered by exact project ID and a null
project-update relation; the
`project(id) { comments }` connection returned empty for the same disposable
comments. M35 therefore uses raw GraphQL for both targets while retaining the
pinned `@linear/sdk` 61.x dependency.

### Explicit M35 waivers and blockers

- R2.1 SHOULD waiver: `add` is retained instead of `create` because it is the
  established nested-resource verb in agent2linear.
- R3.9 SHOULD waiver: `--body-file` is retained instead of generic `--file`
  because it preserves the existing comment vocabulary and names the field.
- R9.2 accepted nonconformance: the user-directed legacy
  `issue comment <identifier>` removal has no deprecation window. The project
  owner accepted this explicit exception on 2026-07-25, but it cannot be
  described as R9.2-conformant.
- R9.3 resolved decision: the grammar break ships only in the accepted
  coordinated `v1.0.0`-or-later release. No version bump is part of this
  implementation.
- R10.2/R10.3: M34 remains the sole owner of the existing `--all` pagination
  waiver; M35 is only an adopter.
- R5.5 remains a pre-existing repository blocker because global
  `--api-key <key>` still permits a secret on argv.

M35 does not claim whole-repository publishable conformance while the R9.2 and
pre-existing R5.5 blockers remain. Its 318-ID status and evidence map is
`docs/superpowers/plans/2026-07-24-M35-traceability.md`.

## M33 label lifecycle and project-trash conformance

M33 applies the publishable tier to the touched label mutations and project lifecycle result. The existing plural `issue-labels|ilbl` and `project-labels|plbl` command families remain canonical; `labels|lbl` is a deprecation/help shim only. Changed mutations use `-o, --output <table|json>` with exact `--json` equivalence, structured errors, guarded writes, dry-run, `--yes`, and `--no-input`.

Label lists adopt M34's raw forward cursor and history contract: bounded default 50, strict 1–250 limit, exact `--after`, exhaustive `-a/--all`, and `--no-cursor-history`. Lifecycle scope is orthogonal: `--include-retired` changes only retirement filtering, while generic archives remain excluded. Raw GraphQL selects `retiredAt` and `archivedAt` independently and preserves Linear's explicit `createdAt` order.

Live ConceptM proof confirmed that project trash must use `projectArchive(id, { trash: true })` and restoration must use `unarchiveProject(id)`. Although pinned SDK 61 declares `ProjectUpdateInput.trashed`, Linear returned an internal server error when it was sent through `projectUpdate`; the dedicated lifecycle mutations succeeded. M33 keeps the public interface as mutually exclusive `project update --trash|--untrash` for issue-command parity and reversibility.

### Explicit M33 deviations, waivers, and blockers

- R1.3 MUST deviation: plural canonical label nouns are retained for compatibility. A singular migration remains future major-version work; M33 does not introduce a competing route.
- R3.4/R4.2 scoped deviation: established label lists retain `-f/--format default|json|tsv`. Every result-bearing mutation changed by M33 conforms with `-o/--output` and `--json`. A repository-wide read/list migration remains separate.
- R2.1 SHOULD waiver: reversible project trash remains an option on `project update` rather than a standalone `delete` command. This matches existing issue lifecycle behavior and avoids implying permanent deletion.
- R10.2/R10.3: M34 remains the sole owner of the established `--all` pagination waiver. M33 is an adopter and adds no synonym.
- R9.2: `labels|lbl` emits a deprecation warning and names both canonical replacements, with removal targeted for v2.0.0.
- R9.3 resolved decision: corrected `project-labels --all` scope ships only on the accepted coordinated `v1.0.0`-or-later release. No release action is part of M33.
- R5.5 and the global config/debug/verbosity gaps listed above remain whole-repository blockers outside M33.

M33's 317 atomic statuses and evidence are recorded in
`docs/superpowers/plans/2026-07-24-M33-traceability.md`.
The offline built-CLI suite is `tests/scripts/test-label-lifecycle-cli.sh`; the opt-in
`tests/scripts/test-label-lifecycle-live.ts` harness fails closed to ConceptM, uses
only uniquely named self-created fixtures, and verifies cleanup.
