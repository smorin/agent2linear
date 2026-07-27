# M36 Coordinated v1.0.0 Release — Audited-v1 TDD Project Plan

> **Plan status:** Republished and approved on 2026-07-26. No M36 implementation, version bump,
> tag, publication, or release has occurred.
>
> **Milestone:** M36 — Coordinated v1.0.0 Release and Publishable-Tier Audit.
>
> **Implementation worktree rule:** create a dedicated implementation worktree from then-current
> `main`. Do not implement or release from the main checkout or from this planning worktree.
>
> **Standard:** CLI Design Standard v1.4.14, publishable audit depth. This release does **not** claim
> complete conformance: owner-approved project conventions and MUST-level nonconformances are
> recorded explicitly in this plan and `CONFORMANCE.md`.
>
> **Tracked items at publication:** **69** — 34 behavior changes, 3 cross-command tests, 5 owner
> decisions, 9 audit/evidence items, 13 release gates, and 5 documentation items.

**Goal:** Ship the accumulated post-0.24.1 work as v1.0.0 after the security-sensitive CLI
contracts, agent-facing output, ConceptM live behavior, package contents, release automation,
documentation, and rollback path are proven. Audit the whole CLI at the publishable tier, but do
not turn accepted project conventions into unrelated v1 redesigns merely to erase a conformance
exception.

**Current evidence snapshot (2026-07-26):** repository version `0.32.0`; npm `latest` `0.24.1`;
PR18 CI green; ConceptM live workflow red at the M34 active-workspace assertion; one high production
advisory in `ink -> ws@8.18.3`; M33-M35 implemented but unreleased; M25 excluded; M26 superseded and
its retained behavior transferred below; package support still says Node `>=18` and release/live
workflows run Node 20 even though the approved v1 floor is Node 22 with Node 22/24 verification.

## 1. Tracking model

The plan separates actual behavior changes from proof and administration:

- **CHANGE:** one externally observable CLI behavior. It must follow RED -> IMPLEMENT -> GREEN ->
  VERIFY and has independent I/T/V state.
- **TEST:** one cross-command regression workflow. It is written RED-first and verified against the
  built CLI.
- **DECISION:** an owner-approved scope choice. It uses `T=N/A`; no artificial test is invented.
- **AUDIT:** evidence or classification. It uses `I=N/A`, `T=N/A`, and records PASS/FAIL/EXCEPTION/N/A.
- **DOC:** a bounded documentation contract. It uses `T=N/A` and is verified against the built CLI.
- **GATE:** a release invariant over existing evidence. It does not receive a fake RED/GREEN cycle.

Rollups are headings and release stop conditions, not additional atomic IDs. Public arguments,
options, commands, output contracts, and errors that require different implementation behavior keep
separate CHANGE IDs. If the audit confirms a new behavior defect, it receives a new `RLS-*` CHANGE
ID before implementation; observational audit probes do not automatically become permanent tests.

## 2. Workstream 1 — Scope, baseline, and release prerequisites (9)

| ID                         | Kind     | Atomic contract                                                                                                              | I        | T     | V       | Basis                |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ------- | -------------------- |
| `RLS-DEC-CONFORMANCE-MODE` | DECISION | Ship an audited v1 with explicit accepted exceptions; do not claim complete CLI Standard conformance                         | DONE     | N/A   | PASS    | approved 2026-07-26  |
| `RLS-DEC-M25`              | DECISION | Supersede M25; future interactive issue create/update requires a new post-v1 project                                         | DONE     | N/A   | PASS    | approved 2026-07-26  |
| `RLS-DEC-M26`              | DECISION | Supersede M26 and transfer retained behavior to current-convention M36 owners                                                | DONE     | N/A   | PASS    | approved 2026-07-26  |
| `RLS-DEC-PUBLISH-OWNER`    | DECISION | The tag-triggered GitHub workflow is the only npm publisher; local release tooling cannot publish                            | DONE     | N/A   | PASS    | approved 2026-07-26  |
| `RLS-DEC-NODE-SUPPORT`     | DECISION | v1 supports Node 22 and 24, declares `>=22`, and does not claim support for EOL Node 18/20                                   | DONE     | N/A   | PASS    | approved 2026-07-26  |
| `RLS-GATE-M33-M35`         | GATE     | M33-M35 traceability and feature regression suites pass without freezing their historical row counts as public release state | BASELINE | GREEN | PENDING | M33-M35              |
| `RLS-BLK-LIVE-M34`         | GATE     | Fix the hermetic ConceptM identity assertion; read-only M34 live traversal passes                                            | TODO     | N/A   | PENDING | current live failure |
| `RLS-BLK-LIVE-SUITE`       | GATE     | M33, M34, M35, and the full ConceptM live suite pass on one release-candidate SHA                                            | TODO     | N/A   | PENDING | `RLS-BLK-LIVE-M34`   |
| `RLS-BLK-PROD-AUDIT`       | GATE     | Resolve or explicitly block on every high/critical production dependency advisory                                            | TODO     | N/A   | PENDING | current `ink -> ws`  |

## 3. Workstream 2 — CLI foundation and credential safety (14)

| ID                           | Kind   | Interface                    | Atomic contract                                                                                                | I    | T        | V       | Standard                   |
| ---------------------------- | ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------- | -------------------------- |
| `RLS-OPT-CONFIG`             | CHANGE | `--config <path>`            | Global, accepted before commands; selects one explicit JSON config while flags/env/defaults keep precedence    | TODO | RED-TODO | PENDING | R4.1, R5.1; R5.2 exception |
| `RLS-OPT-DEBUG`              | CHANGE | `--debug`                    | Global maximum diagnostics; explicit debug overrides quiet and redacts secrets                                 | TODO | RED-TODO | PENDING | R4.1, R4.4, R5.6           |
| `RLS-OPT-VERBOSE`            | CHANGE | `-v, --verbose`              | Repeatable diagnostic ladder; `-v`, `-vv`, and `-vvv` are deterministic                                        | TODO | RED-TODO | PENDING | R4.1, R4.4                 |
| `RLS-RULE-QUIET-VERBOSE`     | CHANGE | `--quiet` plus verbosity     | Quiet wins without suppressing requested results                                                               | TODO | RED-TODO | PENDING | R4.4                       |
| `RLS-RULE-QUIET-DEBUG`       | CHANGE | `--quiet --debug`            | Explicit debug wins over quiet                                                                                 | TODO | RED-TODO | PENDING | R4.4                       |
| `RLS-OPT-APIKEY-REMOVE`      | CHANGE | legacy `--api-key <literal>` | Remove argv-secret acceptance with exact migration guidance in the v1 breaking release                         | TODO | RED-TODO | PENDING | R5.5, R9.3                 |
| `RLS-OPT-APIKEY-FILE`        | CHANGE | `--api-key-file <path\|->`   | Canonical ad-hoc credential input; long-only; `-` reads one trimmed key from stdin                             | TODO | RED-TODO | PENDING | R3.2, R5.5, R10.1          |
| `RLS-RULE-APIKEY-PRECEDENCE` | CHANGE | credential sources           | key file > `LINEAR_API_KEY`/named workspace env > stored credential, with explicit workspace-conflict behavior | TODO | RED-TODO | PENDING | R5.1, R10.1                |
| `RLS-RULE-APIKEY-STDIN`      | CHANGE | shared stdin                 | Fail with usage 2 before reads when credentials and another explicit input both claim stdin                    | TODO | RED-TODO | PENDING | R3.9, R6.1                 |
| `RLS-OPT-NOINPUT`            | CHANGE | global `--no-input`          | Never prompt; missing non-auth input/consent exits 2, missing auth exits 4, and runtime input failure exits 1  | TODO | RED-TODO | PENDING | R4.1, R8.2                 |
| `RLS-CMD-BARE`               | CHANGE | bare `a2l`                   | Help on stdout, exit 0                                                                                         | TODO | RED-TODO | PENDING | R7.9                       |
| `RLS-CMD-GROUP-BARE`         | CHANGE | bare command group           | Help/usage on stderr, exit 2, no API call                                                                      | TODO | RED-TODO | PENDING | R7.9                       |
| `RLS-CMD-UNKNOWN`            | CHANGE | unknown command/flag         | Usage on stderr, exit 2, nearest suggestion when available                                                     | TODO | RED-TODO | PENDING | R6.1, R7.9                 |
| `RLS-CMD-VERSION`            | CHANGE | `--version`, `-V`            | One stdout line `agent2linear 1.0.0`, exit 0                                                                   | TODO | RED-TODO | PENDING | R4.1, R4.6                 |

## 4. Workstream 3 — Output, automation, and safety behavior (23)

| ID                                  | Kind   | Atomic contract                                                                                                             | I    | T        | V       | Standard   |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------- | ---------- |
| `RLS-RULE-OUTPUT-CONFLICT`          | CHANGE | `--json --output json` succeeds; `--json` with a non-JSON output is usage 2 before side effects                             | TODO | RED-TODO | PENDING | R4.2, R6.1 |
| `RLS-OUT-SHARED-DIAGNOSTICS`        | CHANGE | Shared `show*`/logger helpers preserve result stdout and route diagnostics, progress, warnings, and errors to stderr        | TODO | RED-TODO | PENDING | R7.1       |
| `RLS-OUT-QUIET`                     | CHANGE | Quiet suppresses nonessential diagnostics only, never results, errors, or consent                                           | TODO | RED-TODO | PENDING | R4.4       |
| `RLS-OUT-JSON-CLEAN`                | CHANGE | Every JSON success emits one parseable result with no stdout contamination                                                  | TODO | RED-TODO | PENDING | R7.1-R7.2  |
| `RLS-OUT-JSON-ERROR`                | CHANGE | Every machine-mode ordinary failure emits one stable JSON error object on stderr                                            | TODO | RED-TODO | PENDING | R7.8       |
| `RLS-OUT-PROJECT-LIST-TSV`          | CHANGE | Every project-list TSV cell applies one documented tab/CR/LF policy without adding records or columns                       | TODO | RED-TODO | PENDING | R7.2       |
| `RLS-OUT-PROJECT-VIEW`              | CHANGE | `project view` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                 | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-PROJECT-DEPENDENCIES-LIST` | CHANGE | `project dependencies list` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                    | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-PROJECT-CREATE`            | CHANGE | `project create` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                               | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-PROJECT-UPDATE`            | CHANGE | `project update` preserves canonical `-o/--output <table\|json>` and exact `--json` equivalence                             | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-ISSUE-CREATE`              | CHANGE | `issue create` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                 | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-ISSUE-UPDATE`              | CHANGE | `issue update` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                 | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-ISSUE-VIEW`                | CHANGE | `issue view` preserves canonical `-o/--output <table\|json>` and exact `--json` equivalence                                 | TODO | RED-TODO | PENDING | R4.2       |
| `RLS-OUT-ISSUE-LABELS-LIST`         | CHANGE | `issue-labels list` replaces `-f/--format` with `-o/--output <table\|json\|tsv>` and exact `--json` equivalence             | TODO | RED-TODO | PENDING | R3.4, R4.2 |
| `RLS-OUT-PROJECT-LABELS-LIST`       | CHANGE | `project-labels list` replaces `-f/--format` with `-o/--output <table\|json\|tsv>` and exact `--json` equivalence           | TODO | RED-TODO | PENDING | R3.4, R4.2 |
| `RLS-SIGNAL-INT`                    | CHANGE | SIGINT cleans up, flushes, and exits 130                                                                                    | TODO | RED-TODO | PENDING | R9.6       |
| `RLS-SIGNAL-TERM`                   | CHANGE | SIGTERM cleans up, flushes, and exits 143                                                                                   | TODO | RED-TODO | PENDING | R9.6       |
| `RLS-SIGNAL-PIPE`                   | CHANGE | A closed stdout pipe exits quietly without a stack trace                                                                    | TODO | RED-TODO | PENDING | R9.6       |
| `RLS-SAFE-PROMPTS`                  | CHANGE | Mutations/destructive commands never hang without a TTY and distinguish `--yes`, `--force`, and `--no-input`                | TODO | RED-TODO | PENDING | R8.1-R8.2  |
| `RLS-SAFE-DRYRUN`                   | CHANGE | Every existing dry-run proves zero remote writes and stable human/machine plans; M36 does not add dry-run to every mutation | TODO | RED-TODO | PENDING | R4.3, R8.6 |
| `RLS-TST-STREAMS`                   | TEST   | Built-CLI integration captures stdout, stderr, quiet, and machine errors across every changed result command                | TODO | RED-TODO | PENDING | R7.1, R7.8 |
| `RLS-TST-TSV`                       | TEST   | Built-CLI integration proves issue/project list TSV control-character behavior with a machine parser                        | TODO | RED-TODO | PENDING | R7.2       |
| `RLS-TST-AUTOMATION`                | TEST   | Built-CLI integration creates JSON, extracts an ID, then updates and views the same resource in JSON                        | TODO | RED-TODO | PENDING | R4.2, R7.2 |

## 5. Workstream 4 — Publishable-tier audit and explicit exceptions (9)

These are evidence items, not nine implementation epics. A FAIL that requires behavior change gets
a new CHANGE ID before code is written.

| ID                          | Kind  | Evidence contract                                                                                                                     | I   | T   | V       | Scope      |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------- | ---------- |
| `RLS-AUD-INTERFACE`         | AUDIT | Classify R1-R4 command structure, verbs, arguments, exact parsing, global options, and result options                                 | N/A | N/A | PENDING | R1-R4      |
| `RLS-AUD-CONFIG`            | AUDIT | Classify R5 precedence, XDG paths, JSON-config exception, validation, locking, environment, and redaction                             | N/A | N/A | PENDING | R5         |
| `RLS-AUD-EXIT-SAFETY`       | AUDIT | Classify R6-R8 exits, streams, help, errors, TTY behavior, consent, noninteractive behavior, and existing dry-runs                    | N/A | N/A | PENDING | R6-R8      |
| `RLS-AUD-LIFECYCLE-NETWORK` | AUDIT | Classify R9-R10 SemVer, deprecation, encoding, signals, diagnostics, targeting, raw-cursor pagination, TLS, and rate limits           | N/A | N/A | PENDING | R9-R10     |
| `RLS-AUD-OUTPUT-INVENTORY`  | AUDIT | Inventory every formatted result command; prove conformity or allocate a command-specific CHANGE ID                                   | N/A | N/A | PENDING | R4.2, R7.2 |
| `RLS-AUD-ORDERING`          | AUDIT | Require documented deterministic ordering for paginated/agent-critical lists; record backend-defined ordering as a reviewed waiver    | N/A | N/A | PENDING | R7.11      |
| `RLS-AUD-EXCEPTIONS`        | AUDIT | Record every retained MUST nonconformance and SHOULD waiver with rule, behavior, rationale, owner/date, and future compatibility cost | N/A | N/A | PENDING | governance |
| `RLS-STD-CONFORMANCE`       | AUDIT | Update `CONFORMANCE.md` with pass/fail/exception/waiver/N/A totals and exact evidence                                                 | N/A | N/A | PENDING | Appendix C |
| `RLS-STD-FIXTURES`          | AUDIT | Select permanent fixtures for global contracts and confirmed regressions; do not persist every observational probe                    | N/A | N/A | PENDING | R9.14      |

### Accepted release exceptions

These remain visible blockers to a claim of complete Standard conformance, but they do not block
the approved audited-v1 release:

| Rule               | Retained project convention                                                                                               | v1 disposition                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| R1.3 MUST          | canonical `issue-labels` and `project-labels` remain plural                                                               | retain; document nonconformance       |
| R5.2 MUST          | canonical configuration remains the established JSON/XDG/workspace model rather than a TOML migration                     | retain; `--config` selects JSON       |
| R9.2 MUST          | legacy `issue comment <identifier>` is removed immediately with a migration error rather than a working deprecation alias | retain owner-approved breaking change |
| R10.1 MUST         | identity/authentication remains workspace/profile/`whoami`/`doctor` based rather than adding `auth login\|logout\|status` | retain; do not add an auth redesign   |
| R2.1 SHOULD        | nested comments use `add`, and reversible project trash remains under `project update`                                    | retain documented waivers             |
| R3.9 SHOULD        | comments use the existing field-specific `--body-file`                                                                    | retain documented waiver              |
| R10.2-R10.3 SHOULD | exhaustive traversal uses the established `-a/--all`; raw continuation uses `--after` plus cursor history                 | retain M34-owned waiver               |

N/A axes: streaming output, plugins, long-running/async operation control, self-update, and
application-managed offline caching are not introduced by M36. Telemetry is N/A because the CLI
does not transmit telemetry. Interactive issue UX is excluded with M25; existing interactive
project/setup behavior remains within the R8 audit.

## 6. Workstream 5 — Version and user documentation (7)

| ID                      | Kind | Atomic contract                                                                                                                 | I    | T   | V       |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | --- | ------- |
| `RLS-VER-ALIGN`         | GATE | `package.json`, lockfile, and CLI share `1.0.0`; Node floor is `>=22`; CI covers Node 22/24                                     | TODO | N/A | PENDING |
| `RLS-VER-TAG`           | GATE | annotated `v1.0.0` points to the exact verified release commit                                                                  | TODO | N/A | PENDING |
| `RLS-DOC-CHANGELOG`     | DOC  | move Unreleased into dated 1.0.0 with complete post-0.24.1 added/changed/fixed/security entries                                 | TODO | N/A | PENDING |
| `RLS-DOC-MIGRATION`     | DOC  | exact replacements for removed comment, list-format, label-scope, argv API-key, and Node-support interfaces                     | TODO | N/A | PENDING |
| `RLS-DOC-README`        | DOC  | README/help/error reference documents install, Node, auth, output, exits, pagination, safety, examples, and accepted exceptions | TODO | N/A | PENDING |
| `RLS-DOC-MILESTONES`    | DOC  | milestone ledger closes prerequisites and M36 only from recorded evidence                                                       | TODO | N/A | PENDING |
| `RLS-DOC-RELEASE-NOTES` | DOC  | GitHub release body names features, breaking changes, migration, security, exceptions, and verification SHA                     | TODO | N/A | PENDING |

## 7. Workstream 6 — Candidate, package, publication, and rollback (7)

| ID                      | Kind | Release contract                                                                                                                     | I    | T   | V       |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- | --- | ------- |
| `RLS-PKG-CANDIDATE`     | GATE | fresh checkout passes install, build, typecheck, lint, unit/integration, offline suites, and supported Node matrix                   | TODO | N/A | PENDING |
| `RLS-PKG-PACK`          | GATE | `npm pack --dry-run` contains only allowlisted artifacts and no credentials, config, state, worktree files, or source-only test data | TODO | N/A | PENDING |
| `RLS-PKG-INSTALL`       | GATE | install the exact tarball into a fresh prefix; both `a2l` and `agent2linear` help/version and smoke behavior work                    | TODO | N/A | PENDING |
| `RLS-CI-RELEASE-GATES`  | GATE | tag/version equality and green ordinary CI, security, offline, and ConceptM live evidence are required on the candidate SHA          | TODO | N/A | PENDING |
| `RLS-CI-SINGLE-PUBLISH` | GATE | tag workflow publishes once with provenance/trusted-publisher controls; local `np` cannot publish                                    | TODO | N/A | PENDING |
| `RLS-REG-PUBLISH`       | GATE | create the GitHub release, verify npm `latest=1.0.0`, install from the registry, and prove npm/GitHub SHA/integrity agreement        | TODO | N/A | PENDING |
| `RLS-REG-ROLLBACK`      | GATE | document and assign bad-tag, failed-publish, npm deprecation, rollback, and forward-fix responses                                    | TODO | N/A | PENDING |

## 8. Execution sequence

1. Create the dedicated M36 implementation worktree and verify a clean current `main` baseline.
2. Fix the M34 ConceptM identity harness and resolve the production dependency advisory.
3. Implement Workstreams 2-3 one CHANGE ID at a time: RED, smallest implementation, GREEN, built-CLI
   verification. Keep unrelated IDs untouched.
4. Run the full Workstream 4 audit. Record passes/exceptions/N/A; allocate a new CHANGE ID only for
   a confirmed behavior defect that the owner includes in v1.
5. Run the three cross-command TEST workflows and the complete ConceptM live suite on one candidate
   SHA.
6. Align Node/package/CLI versions and update user documentation only after behavior and audit scope
   are frozen.
7. Prove the fresh candidate, exact tarball, and installed binaries.
8. Merge the candidate, require green ordinary and ConceptM checks on the merge SHA, then create the
   annotated tag.
9. Let the tag workflow publish exactly once and create the GitHub release.
10. Install from npm, verify registry/GitHub identity, record closeout evidence, and close M36.

## 9. Release stop conditions

Do not tag or publish when any of these is true:

- a required CHANGE lacks RED/GREEN/built-CLI evidence;
- a DECISION, TEST, DOC, or GATE required by this plan remains incomplete;
- an applicable Standard MUST failure is unreviewed or missing from the explicit exception record;
- a SHOULD deviation lacks a recorded waiver or planned fix;
- ordinary CI or the ConceptM live workflow is not green on the exact candidate SHA;
- a high or critical production advisory remains without explicit owner acceptance;
- package, lockfile, CLI, Node policy, tag, tarball, and registry metadata disagree;
- tarball contents or fresh-install smoke are unverified;
- anything except the tag workflow can publish npm;
- migration/release notes omit an accepted breaking change or conformance exception;
- registry verification or rollback ownership is unset.

## 10. Out of scope

- M25 interactive issue UX; future interactive create/update needs a new post-v1 project.
- Reopening M26 helper/refactor prescriptions, `-f/--format`, or universal TSV for single records and
  mutations.
- JSON-to-TOML config migration, an `auth` command redesign, or singular label-command migration.
- Shell-completion/man-page expansion, machine command metadata, or fixtures for every audit probe.
- New product resources, an unrelated Linear SDK major upgrade, or new sorting behavior for every
  backend-defined list.
- Live writes outside the ConceptM organization/workspace.
- Publishing, tagging, merging, or changing external credentials during the planning phase.
