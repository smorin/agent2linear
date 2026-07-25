# CLI Design Standard Conformance

This repository is reviewed against **CLI Design Standard v1.4.14** at the
**publishable** tier. M34's pagination and cursor-history surfaces are designed to
that tier; this document does not claim that every older command already conforms.

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
`tests/scripts/test-pagination-live.js` harness fails closed unless both the
organization and active workspace are exactly ConceptM; it performs no remote
writes. The 214-ID completion map is
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
- R9.2 blocker: the user-directed legacy `issue comment <identifier>` removal
  has no deprecation window.
- R9.3 release blocker: the grammar break requires a major release;
  `v1.0.0` is recommended. No version bump is part of this implementation.
- R10.2/R10.3: M34 remains the sole owner of the existing `--all` pagination
  waiver; M35 is only an adopter.
- R5.5 remains a pre-existing repository blocker because global
  `--api-key <key>` still permits a secret on argv.

M35 does not claim whole-repository publishable conformance while these blockers
remain. Its 318-ID status and evidence map is
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
- R9.3 release blocker: corrected `project-labels --all` scope ships only on the coordinated major release; v1.0.0 remains the recommendation. No release action is part of M33.
- R5.5 and the global config/debug/verbosity gaps listed above remain whole-repository blockers outside M33.

M33's 317 atomic statuses and evidence are recorded in
`docs/superpowers/plans/2026-07-24-M33-traceability.md`.
The offline built-CLI suite is `tests/scripts/test-label-lifecycle-cli.sh`; the opt-in
`tests/scripts/test-label-lifecycle-live.ts` harness fails closed to ConceptM, uses
only uniquely named self-created fixtures, and verifies cleanup.
