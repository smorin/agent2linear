# M36 Coordinated v1.0.0 Release — Audited-v1 TDD Project Plan

> **Plan status:** Complete on 2026-08-14. The annotated `v1.0.0` tag, GitHub Release, and
> provenance-backed npm publication all identify exact candidate
> `56f15fee7d5b505cc67d74b2febe501322e73ecd`; all 76 tracked IDs are closed.
>
> **Milestone:** M36 — Coordinated v1.0.0 Release and Publishable-Tier Audit.
>
> **Implementation worktree:** `/Users/stevemorin/wt/agent2linear/m36-v1-release` on branch
> `feat/m36-v1-release`, created from the approved planning baseline. Do not implement or release
> from the main checkout.
>
> **Standard:** CLI Design Standard v1.4.14, publishable audit depth. This release does **not** claim
> complete conformance: owner-approved project conventions and MUST-level nonconformances are
> recorded explicitly in this plan and `CONFORMANCE.md`.
>
> **Tracked items after publishable-tier audit disposition:** **76** — 41 behavior changes, 3 cross-command tests, 5 owner
> decisions, 9 audit/evidence items, 13 release gates, and 5 documentation items.

**Goal:** Ship the accumulated post-0.24.1 work as v1.0.0 after the security-sensitive CLI
contracts, agent-facing output, ConceptM live behavior, package contents, release automation,
documentation, and rollback path are proven. Audit the whole CLI at the publishable tier, but do
not turn accepted project conventions into unrelated v1 redesigns merely to erase a conformance
exception.

**Baseline evidence snapshot (2026-07-26):** repository version `0.32.0`; npm `latest` `0.24.1`;
PR18 CI green; the M33-M35 live identity harnesses now validate exact remote organization name and
workspace URL key rather than the local `Active` selector; local ConceptM M34 and M35 live probes
pass; `ink -> ws` is locked to patched `ws@8.21.1`, but the complete production audit awaits owner
consent to send dependency metadata to npm; M33-M35 are implemented but unreleased; M25 is excluded;
M26 is superseded and its retained behavior is transferred below. Package support still says Node
`>=18` and release/live workflows run Node 20 even though the approved v1 floor is Node 22 with Node
22/24 verification.

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

| ID                         | Kind     | Atomic contract                                                                                                              | I        | T     | V    | Basis                     |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ---- | ------------------------- |
| `RLS-DEC-CONFORMANCE-MODE` | DECISION | Ship an audited v1 with explicit accepted exceptions; do not claim complete CLI Standard conformance                         | DONE     | N/A   | PASS | approved 2026-07-26       |
| `RLS-DEC-M25`              | DECISION | Supersede M25; future interactive issue create/update requires a new post-v1 project                                         | DONE     | N/A   | PASS | approved 2026-07-26       |
| `RLS-DEC-M26`              | DECISION | Supersede M26 and transfer retained behavior to current-convention M36 owners                                                | DONE     | N/A   | PASS | approved 2026-07-26       |
| `RLS-DEC-PUBLISH-OWNER`    | DECISION | The tag-triggered GitHub workflow is the only npm publisher; local release tooling cannot publish                            | DONE     | N/A   | PASS | approved 2026-07-26       |
| `RLS-DEC-NODE-SUPPORT`     | DECISION | v1 supports Node 22 and 24, declares `>=22`, and does not claim support for EOL Node 18/20                                   | DONE     | N/A   | PASS | approved 2026-07-26       |
| `RLS-GATE-M33-M35`         | GATE     | M33-M35 traceability and feature regression suites pass without freezing their historical row counts as public release state | BASELINE | GREEN | PASS | focused + full suite      |
| `RLS-BLK-LIVE-M34`         | GATE     | Fix the hermetic ConceptM identity assertion; read-only M34 live traversal passes                                            | DONE     | N/A   | PASS | local ConceptM pass       |
| `RLS-BLK-LIVE-SUITE`       | GATE     | Auth plus the guarded M33-M36 ConceptM harnesses pass and clean up on one release-candidate SHA                              | DONE     | N/A   | PASS | candidate `670cd69`       |
| `RLS-BLK-PROD-AUDIT`       | GATE     | Resolve or explicitly block on every high/critical production dependency advisory                                            | DONE     | GREEN | PASS | production audit: 0 total |

## 3. Workstream 2 — CLI foundation and credential safety (17)

| ID                            | Kind   | Interface                    | Atomic contract                                                                                                                                                                                                                                                                     | I    | T     | V    | Standard                   |
| ----------------------------- | ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- | -------------------------- |
| `RLS-OPT-CONFIG`              | CHANGE | `--config <path>`            | Global and accepted before commands; relative paths resolve after `-C`; the file replaces discovered project/global config while flags, environment, and defaults retain their precedence                                                                                           | DONE | GREEN | PASS | R4.1, R5.1; R5.2 exception |
| `RLS-RULE-CONFIG-ERRORS`      | CHANGE | explicit config read         | A missing, non-regular, unreadable, or malformed explicit JSON config fails before the action with exit 1 and a path-specific stderr error; never `{}` or discovered-config fallback                                                                                                | DONE | GREEN | PASS | R5.4, R6.1                 |
| `RLS-RULE-CONFIG-MUTATION`    | CHANGE | `--config` plus mutation     | `--config` is read-only in v1; every command that writes `config.json` or profile/workspace companion stores—including config/profile/workspace mutations, teams/initiatives set/select, and setup—fails before writes with usage 2 and explains `--global`/`--project` write scope | DONE | GREEN | PASS | R5.1, R6.1                 |
| `RLS-OPT-DEBUG`               | CHANGE | `--debug`                    | Global level-three diagnostics plus redacted stack and bug-report context; explicit debug overrides quiet and all output redacts credentials                                                                                                                                        | DONE | GREEN | PASS | R4.1, R4.4, R5.6           |
| `RLS-OPT-VERBOSE`             | CHANGE | `-v, --verbose`              | Repeatable redacted ladder: `-v` safe operation summaries; `-vv` method/request-ID/status/latency/page counts; `-vvv` resolver/config/internal decisions; never headers, bodies, variables, or credentials                                                                          | DONE | GREEN | PASS | R4.1, R4.4, R5.6           |
| `RLS-RULE-QUIET-VERBOSE`      | CHANGE | `--quiet` plus verbosity     | Quiet wins without suppressing requested results                                                                                                                                                                                                                                    | DONE | GREEN | PASS | R4.4                       |
| `RLS-RULE-QUIET-DEBUG`        | CHANGE | `--quiet --debug`            | Explicit debug wins over quiet                                                                                                                                                                                                                                                      | DONE | GREEN | PASS | R4.4                       |
| `RLS-OPT-APIKEY-REMOVE`       | CHANGE | legacy `--api-key <literal>` | Remove argv-secret acceptance with exact migration guidance in the v1 breaking release                                                                                                                                                                                              | DONE | GREEN | PASS | R5.5, R9.3                 |
| `RLS-OPT-APIKEY-FILE`         | CHANGE | `--api-key-file <path\|->`   | Canonical long-only ad-hoc input; accepts exactly one nonempty logical line after its final line ending; empty or extra non-whitespace lines exit 2; missing/unreadable files exit 1                                                                                                | DONE | GREEN | PASS | R3.2, R5.5, R10.1          |
| `RLS-RULE-APIKEY-CONFIG-ARGV` | CHANGE | generic config secret argv   | Reject `config set apiKey <value>` and `config edit --key apiKey --value <value>` with usage 2 and guidance to safe file, environment, interactive setup, or workspace-add input                                                                                                    | DONE | GREEN | PASS | R5.5, R6.1                 |
| `RLS-RULE-APIKEY-PRECEDENCE`  | CHANGE | credential sources           | Order is key file; selected workspace named env; selected profile env-file; selected workspace stored credential; then, only unnamed, `LINEAR_API_KEY` and legacy stored `apiKey`; a key file may override a workspace credential without changing its target context               | DONE | GREEN | PASS | R5.1, R10.1                |
| `RLS-RULE-APIKEY-STDIN`       | CHANGE | shared stdin                 | Fail with usage 2 before any read when credentials and an explicit or implicit consumer both claim stdin, including comment-add body, issue-create implicit input, and issue-update `--description -`                                                                               | DONE | GREEN | PASS | R3.9, R6.1                 |
| `RLS-OPT-NOINPUT`             | CHANGE | global `--no-input`          | Never prompt; missing non-auth input/consent exits 2, missing auth exits 4, and runtime input failure exits 1                                                                                                                                                                       | DONE | GREEN | PASS | R4.1, R8.2                 |
| `RLS-CMD-BARE`                | CHANGE | bare `a2l`                   | Help on stdout, exit 0                                                                                                                                                                                                                                                              | DONE | GREEN | PASS | R7.9                       |
| `RLS-CMD-GROUP-BARE`          | CHANGE | bare command group           | Every registered node with children and no documented executable default prints help/usage on stderr, exits 2, and performs no API or filesystem action; bare top-level `a2l` is the sole stdout/0 case                                                                             | DONE | GREEN | PASS | R7.9                       |
| `RLS-CMD-UNKNOWN`             | CHANGE | unknown command/flag         | Usage on stderr, exit 2, nearest suggestion when available                                                                                                                                                                                                                          | DONE | GREEN | PASS | R6.1, R7.9                 |
| `RLS-CMD-VERSION`             | CHANGE | `--version`, `-V`            | One stdout line `agent2linear 1.0.0`, exit 0                                                                                                                                                                                                                                        | DONE | GREEN | PASS | R4.1, R4.6                 |

## 4. Workstream 3 — Output, automation, and safety behavior (25)

| ID                                  | Kind   | Atomic contract                                                                                                                                                                                                             | I    | T     | V    | Standard                |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- | ----------------------- |
| `RLS-RULE-OUTPUT-CONFLICT`          | CHANGE | `--json --output json` succeeds; `--json` with a non-JSON output is usage 2 before side effects                                                                                                                             | DONE | GREEN | PASS | R4.2, R6.1              |
| `RLS-OUT-SHARED-DIAGNOSTICS`        | CHANGE | Shared `show*`/logger helpers preserve result stdout and route diagnostics, progress, warnings, and errors to stderr                                                                                                        | DONE | GREEN | PASS | R7.1                    |
| `RLS-OUT-QUIET`                     | CHANGE | Quiet suppresses nonessential diagnostics only, never results, errors, or consent                                                                                                                                           | DONE | GREEN | PASS | R4.4                    |
| `RLS-OUT-JSON-CLEAN`                | CHANGE | Every successful machine invocation in the named M36 result inventory emits exactly one parseable stdout result; all diagnostics remain on stderr                                                                           | DONE | GREEN | PASS | R7.1-R7.2               |
| `RLS-OUT-JSON-ERROR`                | CHANGE | Ordinary failures in the named M36 result inventory emit exactly one `{"error":{"code","message"}}` object on stderr, empty stdout, and the documented exit, including usage failures when machine mode was requested       | DONE | GREEN | PASS | R7.8                    |
| `RLS-OUT-PROJECT-LIST-TSV`          | CHANGE | Every project-list TSV cell replaces each tab, CR, and LF code point with one ASCII space without changing row or column count                                                                                              | DONE | GREEN | PASS | R7.2                    |
| `RLS-OUT-ISSUE-LIST-TSV`            | CHANGE | Every issue-list TSV cell replaces each tab, CR, and LF code point with one ASCII space without changing row or column count                                                                                                | DONE | GREEN | PASS | R7.2                    |
| `RLS-OUT-PROJECT-VIEW`              | CHANGE | `project view` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                                 | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-PROJECT-DEPENDENCIES-LIST` | CHANGE | `project dependencies list` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                    | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-PROJECT-CREATE`            | CHANGE | `project create` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                               | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-PROJECT-UPDATE`            | CHANGE | `project update` preserves canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                             | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-ISSUE-CREATE`              | CHANGE | `issue create` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                                 | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-ISSUE-UPDATE`              | CHANGE | `issue update` exposes canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                                 | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-ISSUE-VIEW`                | CHANGE | `issue view` preserves canonical `-o/--output <table\|json>` and exact `--json` equivalence                                                                                                                                 | DONE | GREEN | PASS | R4.2                    |
| `RLS-OUT-ISSUE-LABELS-LIST`         | CHANGE | `issue-labels list` replaces `-f/--format` with `-o/--output <table\|json\|tsv>` and exact `--json` equivalence                                                                                                             | DONE | GREEN | PASS | R3.4, R4.2              |
| `RLS-OUT-PROJECT-LABELS-LIST`       | CHANGE | `project-labels list` replaces `-f/--format` with `-o/--output <table\|json\|tsv>` and exact `--json` equivalence                                                                                                           | DONE | GREEN | PASS | R3.4, R4.2              |
| `RLS-SIGNAL-INT`                    | CHANGE | SIGINT cleans up, flushes, and exits 130                                                                                                                                                                                    | DONE | GREEN | PASS | R9.6                    |
| `RLS-SIGNAL-TERM`                   | CHANGE | SIGTERM cleans up, flushes, and exits 143                                                                                                                                                                                   | DONE | GREEN | PASS | R9.6                    |
| `RLS-SIGNAL-PIPE`                   | CHANGE | A closed stdout pipe exits quietly without a stack trace                                                                                                                                                                    | DONE | GREEN | PASS | R9.6                    |
| `RLS-SAFE-PROMPTS`                  | CHANGE | Shared workspace/destructive confirmations, legacy readline confirmations, and current Ink entries never read or render interactive input under `--no-input`; `--yes`, `--force`, and `--no-input` retain distinct meanings | DONE | GREEN | PASS | R8.1-R8.2               |
| `RLS-SAFE-DRYRUN`                   | CHANGE | The named 24-command dry-run inventory proves zero remote and local writes; commands with machine output emit a stable machine plan; M36 does not add dry-run universally                                                   | DONE | GREEN | PASS | R4.3, R8.6              |
| `RLS-FIX-ISSUE-TRASH`               | CHANGE | `issue update --trash` uses Linear's dedicated issue-trash mutation and `--untrash` uses unarchive; neither sends `trashed` through ordinary issue update                                                                   | DONE | GREEN | PASS | live automation blocker |
| `RLS-EXIT-HUMAN-NOT-FOUND`          | CHANGE | Human `issue view` and `project view` not-found results use the same typed exit 3 contract as JSON instead of generic exit 1                                                                                                | DONE | GREEN | PASS | R6.1-R6.2               |
| `RLS-EXIT-LEGACY-USAGE-CONFLICT`    | CHANGE | `config override add` invalid input exits 2 and a duplicate-rule conflict exits 5 instead of collapsing both to generic exit 1                                                                                              | DONE | GREEN | PASS | R6.1-R6.2               |
| `RLS-TST-STREAMS`                   | TEST   | Runner and built-CLI integration captures stdout, stderr, quiet, machine success, and machine errors across the named M36 result inventory                                                                                  | DONE | GREEN | PASS | R7.1, R7.8              |
| `RLS-TST-TSV`                       | TEST   | Built-CLI integration proves issue/project list TSV control-character behavior with a machine parser                                                                                                                        | DONE | GREEN | PASS | R7.2                    |
| `RLS-TST-AUTOMATION`                | TEST   | In ConceptM, built CLI creates one disposable issue as JSON, extracts its ID, updates and views it as JSON, proves identity/title continuity, and trashes it in `finally`                                                   | DONE | GREEN | PASS | R4.2, R7.2              |

### Named Workstream 3 inventories

The **M36 result inventory** is: every command named by an `RLS-OUT-*` row; `issue list` and
`project list`; `cursor-history list|view|clear`; `issue|project comment add|list`; and
`issue-labels|project-labels create|update|delete|retire|restore`. Commands outside this inventory
remain owned by `RLS-AUD-OUTPUT-INVENTORY`; a confirmed v1 defect receives its own CHANGE ID before
implementation.

The **24-command dry-run inventory** is: `alias clear`; `cycles sync-aliases`; `project-status
sync-aliases`; `config override add|edit`; `issue|project create|update`; `issue|project comment
add`; `issue-labels|project-labels create|update|delete|retire|restore|sync-aliases`; and
`cursor-history clear`.

## 5. Workstream 4 — Publishable-tier audit and explicit exceptions (9)

These are evidence items, not nine implementation epics. A FAIL that requires behavior change gets
a new CHANGE ID before code is written.

| ID                          | Kind  | Evidence contract                                                                                                                     | I    | T     | V    | Scope      |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- | ---------- |
| `RLS-AUD-INTERFACE`         | AUDIT | Classify R1-R4 command structure, verbs, arguments, exact parsing, global options, and result options                                 | DONE | N/A   | PASS | R1-R4      |
| `RLS-AUD-CONFIG`            | AUDIT | Classify R5 precedence, XDG paths, JSON-config exception, validation, locking, environment, and redaction                             | DONE | N/A   | PASS | R5         |
| `RLS-AUD-EXIT-SAFETY`       | AUDIT | Classify R6-R8 exits, streams, help, errors, TTY behavior, consent, noninteractive behavior, and existing dry-runs                    | DONE | N/A   | PASS | R6-R8      |
| `RLS-AUD-LIFECYCLE-NETWORK` | AUDIT | Classify R9-R10 SemVer, deprecation, encoding, signals, diagnostics, targeting, raw-cursor pagination, TLS, and rate limits           | DONE | N/A   | PASS | R9-R10     |
| `RLS-AUD-OUTPUT-INVENTORY`  | AUDIT | Inventory every formatted result command; prove conformity or allocate a command-specific CHANGE ID                                   | DONE | N/A   | PASS | R4.2, R7.2 |
| `RLS-AUD-ORDERING`          | AUDIT | Require documented deterministic ordering for paginated/agent-critical lists; record backend-defined ordering as a reviewed waiver    | DONE | N/A   | PASS | R7.11      |
| `RLS-AUD-EXCEPTIONS`        | AUDIT | Record every retained MUST nonconformance and SHOULD waiver with rule, behavior, rationale, owner/date, and future compatibility cost | DONE | N/A   | PASS | governance |
| `RLS-STD-CONFORMANCE`       | AUDIT | Update `CONFORMANCE.md` with pass/fail/exception/waiver/N/A totals and exact evidence                                                 | DONE | N/A   | PASS | Appendix C |
| `RLS-STD-FIXTURES`          | AUDIT | Select permanent fixtures for global contracts and confirmed regressions; do not persist every observational probe                    | DONE | GREEN | PASS | R9.14      |

### Accepted release exceptions

These remain visible blockers to a claim of complete Standard conformance, but they do not block
the approved audited-v1 release. The project owner approved the bounded disposition on 2026-07-27.
`CONFORMANCE.md` is the authoritative record for each rule's exact behavior, rationale, owner/date,
and future compatibility cost.

The accepted MUST-exception families are: canonical plural resource groups; legacy output selectors
and stream/error behavior outside the named M36 inventory; credential-name parity; the established
JSON/XDG/profile/workspace configuration model; Commander help shape; legacy direct-exit flushing;
coordinated immediate v1 removals; locale-sensitive legacy list ordering; and the existing
workspace/profile identity model.

The accepted SHOULD-waiver families are: established nested verbs and `--body-file`; bounded rather
than universal dry-run; discovered-config validation; legacy partial-failure semantics; legacy
progress and ordering; completion/man generation; application timeouts/retries; empty-state
guidance; doctor machine behavior; M34-owned `--all` plus raw-cursor pagination; and centralized
rate-limit handling.

N/A axes: streaming output, plugins, long-running/async operation control, self-update, and
application-managed offline caching are not introduced by M36. Telemetry is N/A because the CLI
does not transmit telemetry. Interactive issue UX is excluded with M25; existing interactive
project/setup behavior remains within the R8 audit.

## 6. Workstream 5 — Version and user documentation (7)

| ID                      | Kind | Atomic contract                                                                                                                  | I    | T     | V    |
| ----------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- |
| `RLS-VER-ALIGN`         | GATE | `package.json`, lockfile, and CLI share `1.0.0`; Node floor is `>=22`; CI covers Node 22/24                                      | DONE | GREEN | PASS |
| `RLS-VER-TAG`           | GATE | annotated `v1.0.0` points to the exact verified release commit                                                                   | DONE | N/A   | PASS |
| `RLS-DOC-CHANGELOG`     | DOC  | move Unreleased into dated 1.0.0 with complete post-0.24.1 added/changed/fixed/security entries                                  | DONE | N/A   | PASS |
| `RLS-DOC-MIGRATION`     | DOC  | exact replacements for removed comment, list-format, label-scope, argv API-key, alias-clear consent, and Node-support interfaces | DONE | N/A   | PASS |
| `RLS-DOC-README`        | DOC  | README/help/error reference documents install, Node, auth, output, exits, pagination, safety, examples, and accepted exceptions  | DONE | N/A   | PASS |
| `RLS-DOC-MILESTONES`    | DOC  | milestone ledger closes prerequisites and M36 only from recorded evidence                                                        | DONE | N/A   | PASS |
| `RLS-DOC-RELEASE-NOTES` | DOC  | GitHub release body names features, breaking changes, migration, security, exceptions, and verification SHA                      | DONE | N/A   | PASS |

## 7. Workstream 6 — Candidate, package, publication, and rollback (7)

| ID                      | Kind | Release contract                                                                                                                     | I    | T     | V    |
| ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- | ----- | ---- |
| `RLS-PKG-CANDIDATE`     | GATE | fresh checkout passes install, build, typecheck, lint, unit/integration, offline suites, and supported Node matrix                   | DONE | N/A   | PASS |
| `RLS-PKG-PACK`          | GATE | `npm pack --dry-run` contains only allowlisted artifacts and no credentials, config, state, worktree files, or source-only test data | DONE | N/A   | PASS |
| `RLS-PKG-INSTALL`       | GATE | install the exact tarball into a fresh prefix; both `a2l` and `agent2linear` help/version and smoke behavior work                    | DONE | N/A   | PASS |
| `RLS-CI-RELEASE-GATES`  | GATE | tag/version equality and green ordinary CI, security, offline, and ConceptM live evidence are required on the candidate SHA          | DONE | GREEN | PASS |
| `RLS-CI-SINGLE-PUBLISH` | GATE | tag workflow publishes once with provenance/trusted-publisher controls; local `np` cannot publish                                    | DONE | GREEN | PASS |
| `RLS-REG-PUBLISH`       | GATE | create the GitHub release, verify npm `latest=1.0.0`, install from the registry, and prove npm/GitHub SHA/integrity agreement        | DONE | N/A   | PASS |
| `RLS-REG-ROLLBACK`      | GATE | document and assign bad-tag, failed-publish, npm deprecation, rollback, and forward-fix responses                                    | DONE | N/A   | PASS |

## 8. Execution evidence to date

- Worktree/branch: `/Users/stevemorin/wt/agent2linear/m36-v1-release` on
  `feat/m36-v1-release`, planning baseline `e9888e00bc5930d4dcc0066ac93b7e8bd153a65a`.
- RED: identity-helper fixture was absent; the dependency regression observed vulnerable
  `ws@8.18.3`.
- IMPLEMENT: shared exact `Organization: ConceptM` plus `Workspace: conceptm` parsing for M33-M35;
  lock-only `ws@8.21.1`; isolated real-Git Vitest project; Node 24 symlink cleanup correction.
- GREEN: identity and M33-M35 traceability focus is 20/20; the full suite is 965 passed and 1
  skipped on repeated Node 22 and Node 24 runs; typecheck, lint, and build pass.
- VERIFY: local ConceptM M34 raw-cursor traversal passes with zero writes; local ConceptM M35
  comment/reply/history traversal passes with cleanup. The one-candidate M33-M35/full-live gate is
  not yet claimed.
- SECURITY STOP: GHSA-specific regression and `npm ls ws --omit=dev --all` prove the known `ws`
  path is patched. The complete `npm audit --omit=dev --json` remains pending explicit permission
  because it sends package/dependency metadata to the npm registry.
- REVIEW: independent Sol adversarial review accepted the blocker patch after M33 adopted the same
  exact identity helper and required the original 73-item plan correction. The coverage-threshold behavior
  was classified as pre-existing test-infrastructure debt, not caused by the Vitest project split.
- SLICE 1: explicit-config RED tests preceded implementation; 72 focused tests and the hermetic
  built-CLI replacement/error/20-writer zero-mutation script pass. Independent Sol review accepted
  strict descriptor reads, `-C` ordering, positional-context and override provenance, and state
  isolation with no remaining findings.
- SLICE 2: credential RED tests preceded implementation; 92 focused tests, the hermetic built-CLI
  credential contract, comments contract, XDG smoke, and a 1,040-pass full suite are green.
  Independent Sol review found and then accepted fixes for parser short-circuits, complete accepted
  root/config-set option ordering, empty-title stdin contention, exact precedence, and secret-free
  errors.
- SLICE 3: diagnostic RED tests preceded implementation; 64 focused tests, typecheck, lint, build,
  and the hermetic built-CLI diagnostic contract pass. Independent Sol review accepted repeatable
  verbosity, quiet/debug precedence, parser-error initialization, single-object JSON errors,
  recursive credential/error redaction, allowlisted real SDK request metadata, and removal of the
  legacy environment debug dumps. Machine diagnostic flushing on handlers that still call
  `process.exit()` remains explicitly owned by the later Workstream 3 output/error-routing rows; no
  exit-hook workaround was added here.
- SLICE 4: parser/no-input RED probes preceded implementation; the permanent hermetic built-CLI
  matrix passes for the bare root, all 29 parent groups, 21 alias paths, unknown commands/options,
  generated-help typo/repetition/leaf-argument cases, non-TTY prompt boundaries, explicit stdin,
  consent/input precedence, and missing-auth exit 4. A real malformed-help config mutation was
  reproduced in temp XDG, then closed with pre-parse structured usage errors and a zero-file
  regression. The full suite is 1,072 passed and 1 skipped; typecheck, lint, build, and diff check
  pass. Independent Sol review reports PASS on all four Slice 4 IDs after exhaustive parser,
  no-action, no-input, non-TTY, auth, consent, and zero-mutation matrices. Force-consent semantics
  remain owned by Slice 8; unrelated pre-existing semantic-usage debt was not pulled into scope.
- SLICE 5: shared-stream and output-conflict RED tests failed before implementation because shared
  progress used stdout and the root hook read an API-key file before rejecting conflicting output
  selectors. Focused unit tests, the hermetic built-CLI matrix, typecheck, build, lint, and diff
  check pass; the full suite is 1,074 passed and 1 skipped. The built matrix proves implicit
  Commander defaults, both selector orders, long/short/attached forms, exact JSON equivalence, quiet
  JSON preservation, and conflict exit 2 before cwd/config/key I/O. Independent Sol review reports
  PASS on all three Slice 5 IDs. Pre-existing no-color defects were recorded as outside these
  literal stream/quiet/conflict contracts and were not pulled into M36.
- SLICE 6: selector-registration, label migration, and adversarial TSV fixtures failed before
  implementation. Focused tests then proved canonical output selectors and exact JSON equivalence,
  label-list `-f/--format` removal, canonical cursor continuations, and one-space sanitization of
  every tab, CR, and LF in standard and custom-column TSV cells. Typecheck, build, lint, diff check,
  the full suite (1,089 passed and 1 skipped), the command-selector built matrix, and the 37-case
  offline label lifecycle matrix pass. Independent Sol review reports PASS on all eleven Slice 6
  IDs. JSON schema/error expansion,
  documentation, and unrelated legacy output behavior remain in their later published slices.
- SLICE 7: focused RED tests reproduced legacy JSON progress, Commander help contamination, typed
  error bypasses, project date exits, provider-error misclassification, and composed project-update
  warnings before an ancillary failure. The bounded implementation suppresses legacy machine
  progress, routes named handlers through shared typed errors, preserves provider auth/runtime
  failures, and rejects incompatible browser, interactive, and bulk-dry-run modes without adding
  new schemas. Focused tests, the 56-probe parser review, standalone hermetic built-CLI matrix,
  typecheck, build, lint, diff check, and full suite (1,105 passed and 1 skipped) pass. Independent
  Sol review reports PASS on both Slice 7 IDs. Interactive cancellation remains owned by Slice 8;
  dry-run plan semantics remain Slice 9.
- SLICE 8: focused RED tests proved the missing SIGINT, SIGTERM, and stdout-EPIPE process boundary,
  then the built process exposed signal-readiness and consent-vocabulary defects rather than masking
  them with timing or compatibility aliases. One process helper now flushes buffered diagnostics and
  streams before explicit 130/143 exits and quietly handles stdout EPIPE. Existing no-input guards
  required no refactor; targeted tests prove shared workspace/destructive consent, ambiguous Ink
  selection, seeded legacy readline state preservation, and distinct consent semantics. `alias
clear` now uses `-y/--yes`; its former force-as-consent spelling is removed because no guard exists.
  Focused tests, standalone hermetic signal and parser/no-input matrices, typecheck, build, lint,
  diff check, and the full suite (1,113 passed and 1 skipped) pass. Independent Sol re-review reports
  PASS on all four Slice 8 IDs. The legacy readline prompt-channel R8.1 SHOULD item remains for the
  published interactive audit rather than expanding this slice.
- SLICE 9: RED tests and built probes reproduced persistent dry-run cache writes, unsupported issue
  trash input, incomplete result-command evidence, and missing TSV machine parsing. The bounded
  implementation suppresses the two persistent cache writers only while the five top-level dry-run
  runners execute; uses dedicated issue trash/unarchive mutations in the correct combined-update
  order; enumerates all 28 named result commands; and adds a built-CLI TSV parser plus fail-closed
  ConceptM issue create/update/view/trash automation. The live run passed on disposable `AGE-54`
  with cleanup confirmed as trashed. The full suite is 1,140 passed and 1 skipped; typecheck, source
  lint, build, the sequential built-CLI fixture set, and focused formatting pass. A fixture exposed
  and closed explicit-config mutation validation occurring after the TTY guard; the parser harness
  subprocess timeout was raised from 3 to 10 seconds after direct behavior reproduced correctly in
  0.67 seconds. Independent strongest-agent re-review closed all four adversarial findings and
  reports PASS on all five Slice 9 IDs. The one-candidate M33-M35/full-live gate remains unclaimed.
- AUDIT: independent R1-R5 and R6-R10 passes classified all 74 Standard rule IDs. The owner chose
  two bounded correctness fixes and explicit exceptions/waivers rather than 27 legacy output
  migrations or broader batch/help/network/ordering redesigns. TDD changed human issue/project
  not-found results from generic exit 1 to typed exit 3 and changed `config override add` invalid
  input/duplicate exits from 1 to 2/5 while preserving runtime/write exit 1. Focused tests are 39/39
  plus 16/16 shared typed-error tests; the built config fixture passes. Strongest-agent review found
  no remaining findings and reports PASS on both added IDs.
- CONFORMANCE: `CONFORMANCE.md` records 32 pass rules, 17 owner-accepted MUST exceptions, 14 SHOULD
  waivers, and 11 N/A rules, each retained deviation carrying
  rationale, owner/date, and future compatibility cost. Nine M36 built-CLI fixtures are now wired
  into ordinary CI alongside the four existing offline family suites; the initial CI-presence test
  moved from 8 RED failures to 8/8 GREEN before the exact-version fixture became the ninth.
- VERSION: two RED alignment tests preceded package/lock/CLI `1.0.0`, Node `>=22`, the Node 22/24
  CI matrix, and Node 24 release/live runners. The built binary now emits exactly one
  `agent2linear 1.0.0` line for both `--version` and `-V`; alignment and CI-presence coverage is
  11/11 GREEN. The ninth permanent M36 fixture keeps the exact version contract in ordinary CI.
- RELEASE REVIEW: adversarial review corrected stale migration/README/changelog/release-note claims,
  replaced unlocked `npx tsx` execution with live suites compiled by the locked `tsup` dependency,
  and made the tag workflow require an annotated tag on `main` plus successful Node 22/24 ordinary
  CI checks for the exact SHA before its security/live/publish gates. The reviewed rollback runbook
  assigns failed-tag, failed-publish, deprecation, dist-tag rollback, and forward-fix ownership.
  Full Vitest is 1,156 passed and 1 skipped; typecheck, lint, CLI/live-suite builds, focused release
  policy tests, formatting, and diff checks pass. Release-note SHA, exact-candidate, package,
  trusted-publisher, tag, and registry verification remain pending.
- SECURITY: with explicit owner authorization, `npm audit --omit=dev --audit-level=high --json`
  reported 0 info, low, moderate, high, critical, or total vulnerabilities across 71 production
  dependencies. `RLS-BLK-PROD-AUDIT` is closed; the tag workflow retains the same production audit
  as a mandatory same-candidate gate.
- FIXTURE RELIABILITY: cumulative sequential execution reproduced `status=null`/timeout at the
  former 3-second child ceiling while the same commands passed standalone. Output,
  output-migrations, parser/no-input, and TSV fixtures now share a fail-closed 10-second ceiling;
  a true timeout still returns `ETIMEDOUT`/`SIGTERM` and fails the explicit exit assertion. The
  complete four-family plus nine-M36 sequential built gate passed under the supported Node 24
  runtime after normalization. Strongest-agent review reports PASS.
- LIVE GATE AUDIT: exact candidate `1b2b885` passed auth and the guarded M33-M36 ConceptM
  harnesses; all disposable fixtures were cleaned up. The additional legacy `run-all-tests.sh`
  invocation was rejected as a release gate because its pre-v1 grammar assertions, repo-root path
  assumptions, and manual-cleanup fixtures are not hermetic release evidence. Its eight created
  `AGE-58` through `AGE-65` issues were trashed. A RED release-policy regression now requires both
  live workflows to retain the five guarded commands and exclude the legacy aggregate; the
  workflow correction is GREEN and awaits exact follow-up-candidate verification.
- FOLLOW-UP LIVE CONSISTENCY: candidate `d13b7f9` passed the fresh Node 22/24, dependency-audit,
  package, tarball, and installed-binary gates, then M33 exposed an immediate stale by-ID read after
  issue-label restore. The unchanged candidate passed the same cleanly isolated ConceptM harness on
  rerun, while source tracing proved a fresh label ID, verified retired precondition, one restore
  mutation, and one immediate post-read. Four RED lifecycle tests now cover issue/project retire and
  restore with a stale first read; the shared bounded post-read and exhaustion behavior are GREEN.
  A later rebuilt run proved those lifecycle results but exposed the separate assumption that
  Linear's catalog filter updates immediately; the live harness now bounds only that read-only
  observation. Node 22 and Node 24 each pass 1,162 tests with 1 skipped, the label built-CLI family
  passes 37/37, and production/live builds pass. Exact-candidate M33-M36 live closure remains
  PENDING: subsequent ConceptM runs first encountered explicit upstream GraphQL 503 connection
  resets, including one at the initial read-only `whoami`, and all created fixtures were cleaned up.
  After recovery, read-only auth and the complete rebuilt working-tree M33-M36 guarded set passed;
  M33/M35 cleanup completed, M34 performed zero writes, and the M36 disposable issue was trashed.
- EXACT FOLLOW-UP CANDIDATE: detached candidate `670cd69` passed fresh `npm ci`, Node 22 and Node 24
  full suites at 1,162 passed with 1 skipped each, typecheck, lint, production/live builds, all four
  offline families, all nine M36 built-CLI fixtures, and the authorized production audit with zero
  vulnerabilities across 71 production dependencies. `npm pack` contained exactly the seven
  allowlisted files; tarball `agent2linear-1.0.0.tgz` has SHA-1
  `73561cff56069465e384a8c62b791903fd57708c`. A fresh 60-package install proved both binary names,
  version, root/project help, and empty cursor-history JSON. Exact-SHA ConceptM auth plus M33-M36
  then passed; M33/M35 cleaned every disposable fixture, M34 made zero writes, and M36 trashed its
  disposable issue. Merged-candidate CI, tag, release-note SHA, single publication, and registry
  verification remain PENDING.
- FINAL RELEASE: merged candidate `56f15fee7d5b505cc67d74b2febe501322e73ecd` passed ordinary
  Node 22/24 CI in [run 31865724525](https://github.com/smorinlabs/agent2linear/actions/runs/31865724525)
  and the guarded ConceptM M33-M36 live suite in
  [run 31865724531](https://github.com/smorinlabs/agent2linear/actions/runs/31865724531). Annotated tag
  object `b038c9b81d072135d6af0d771631bbc5b2f91803` peels to that exact candidate.
  [Release run 31866141282](https://github.com/smorinlabs/agent2linear/actions/runs/31866141282)
  passed tag/version, ancestry, exact-SHA CI, static, unit, offline, production-audit, and live gates
  before its sole `npm publish --provenance` job published
  [`agent2linear@1.0.0`](https://www.npmjs.com/package/agent2linear/v/1.0.0) through the GitHub `npm`
  environment. npm reports `latest=1.0.0`, SHA-512 integrity
  `W/ekNJQgbJn73r8VfEQRDJ8ruzumrxpKQsWoiqDNH9xw2dwNb+mHU5QOyJHhawqjVaAMsFCPzSUXGZCGbjHCGQ==`,
  and SLSA provenance. A fresh public-registry install verified both binaries and npm verified 60
  registry signatures plus 4 attestations. The published
  [GitHub Release](https://github.com/smorinlabs/agent2linear/releases/tag/v1.0.0) records the
  candidate, migration, security, exceptions, CI/live evidence, integrity, and provenance.

## 9. Ordered TDD execution slices

Every CHANGE slice stops after its own RED, IMPLEMENT, GREEN, and VERIFY evidence is recorded.

1. **Config boundary:** `RLS-OPT-CONFIG`, `RLS-RULE-CONFIG-ERRORS`, and
   `RLS-RULE-CONFIG-MUTATION`; stop after temp-XDG built-CLI tests prove replacement, `-C` path
   resolution, strict errors, and zero mutation writes.
2. **Credential safety:** legacy removal, safe file input, generic config argv rejection, exact
   precedence, and all explicit/implicit stdin conflicts.
3. **Diagnostic controls:** repeatable verbosity, debug, quiet precedence, and redaction.
4. **Noninteractive/parser boundary:** global no-input, prompt inventory, bare root/groups, and
   unknown command/flag behavior.
5. **Shared streams/output conflict:** canonical output conflict, diagnostic routing, and quiet
   result behavior.
6. **Command output migrations:** issue/project TSV, label-list format removal, then missing
   issue/project result selectors.
7. **Bounded JSON conversion:** success/error contracts only for the named M36 result inventory.
8. **Signals and prompt safety:** SIGINT, SIGTERM, EPIPE, and workspace/destructive consent.
9. **Dry-run/cross-command proof:** the 24-command matrix, stream/TSV workflows, then disposable
   ConceptM automation and the complete exact-candidate live suite.
10. **Audit, version, and release:** complete Workstream 4, align version/Node policy, update docs,
    prove the candidate/tarball/installed binaries, then follow the merge/tag/single-publisher/
    registry/rollback gates in order. `RLS-CMD-VERSION` ships with `RLS-VER-ALIGN`, never earlier.

## 10. Release stop conditions

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

## 11. Out of scope

- M25 interactive issue UX; future interactive create/update needs a new post-v1 project.
- Reopening M26 helper/refactor prescriptions, `-f/--format`, or universal TSV for single records and
  mutations.
- JSON-to-TOML config migration, an `auth` command redesign, or singular label-command migration.
- Shell-completion/man-page expansion, machine command metadata, or fixtures for every audit probe.
- New product resources, an unrelated Linear SDK major upgrade, or new sorting behavior for every
  backend-defined list.
- Live writes outside the ConceptM organization/workspace.
- Publishing, tagging, merging, or changing external credentials during the planning phase.
