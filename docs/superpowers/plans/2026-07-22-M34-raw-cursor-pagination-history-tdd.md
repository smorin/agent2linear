# Shared Raw-Cursor Pagination and Cursor History — ID-Level TDD Project Plan

> **Milestone:** M34 — Shared Raw-Cursor Pagination and Cursor History.
>
> **Worktree:** `/Users/stevemorin/wt/agent2linear/label-project-lifecycle-tdd-plan`
>
> **Branch:** `plan/label-project-lifecycle-tdd`
>
> **CLI standard:** CLI Design Standard v1.4.14, publishable tier.
>
> **Status:** Implemented and verified in the M34 worktree; 214-ID evidence is published in [the traceability report](2026-07-24-M34-traceability.md).

## 1. Recommendation and settled decisions

M34 establishes one reusable pagination/history contract, migrates the existing issue/project lists,
and publishes the adopter interface consumed by the label and comment lists delivered by M33/M35:

```text
--limit <number>       bounded result count; default 50; inclusive range 1–250
--after <cursor>       resume after the exact raw Linear cursor
-a, --all              fetch every remaining page, from the beginning or after --after
--no-cursor-history    emit the cursor but do not persist this invocation locally
```

The public cursor is the raw opaque value returned by Linear. a2l must print it exactly, accept it
exactly, and pass it byte-for-byte as GraphQL `after`. It must not wrap, sign, decode, increment,
normalize, fingerprint, or context-bind the value.

The 250 maximum is an a2l validation cap inherited from repository convention, not a claim that
Linear universally rejects `first=251` on every connection.

Because a raw cursor does not describe its originating query, M34 also adds local advisory history:

```text
a2l cursor-history list
a2l cursor-history view <entry-id>
a2l cursor-history clear
```

History records the sanitized command that produced a continuation cursor, its effective workspace,
resource, target, filters, ordering, and copyable next/all-remaining commands. History never changes,
validates, substitutes, or blocks `--after`; Linear remains the authority on cursor validity.

### 1.1 Proposed enhancements retained in this plan

- Store history under XDG state rather than cache because it is user-visible durable history, not
  disposable remote-response caching.
- Reconstruct commands from parsed safe values; never persist raw `process.argv`, API keys, tokens,
  stdin, environment variables, or request headers.
- Create an entry only when `hasNextPage=true` and `endCursor` is nonempty.
- Retain the newest 1,000 entries with no time-based expiry; prune oldest entries only after a
  successful locked write.
- Expose `--no-cursor-history` on every cursor-producing list invocation.
- Use atomic replacement and interprocess locking. A history-write failure warns but never hides a
  successful list result or continuation cursor.
- Change existing resumable JSON lists to envelopes in the same breaking release. Bare arrays cannot
  carry stable page metadata; JSON is the canonical machine continuation channel.

### 1.2 Accepted AR-002 correction: existing limits are not a strict baseline

The existing issue and project list commands both parse `--limit` with `parseInt(..., 10)`.
Consequently, inputs such as `1.5` and `12abc` are silently accepted as 1 and 12. Issue list
already rejects values below 1 and above 250; project list rejects values below 1 but does not
enforce the documented 250 maximum. Both command handlers and the top-level entrypoint currently
collapse these usage failures to exit 1.

M34 therefore preserves only each option's existing `-l, --limit <number>` spelling, default 50,
and already-observed bounds as `BASELINE`. It separately tracks, per existing command, strict
whole-token integer validation, each lower/upper boundary, and usage-exit normalization. New
validation behavior remains `NS`; existing boundary behavior remains `BASELINE`. Under CLI
Standard v1.4.14 R6.1 the corrected usage result is exit 2, and under R9.3 that exit-code change is
part of the coordinated major release.

### 1.3 Accepted AR-003 ownership boundary

Every public behavior and implementation contract has exactly one owning ID. A downstream adopter
may depend on that ID but must not recreate its implementation contract or copy its I/T/V status.

M34 owns the reusable parser, cursor, walker, normalized page result, continuation-command builder,
and cursor-history system. It also owns migration of the already-existing `issue list` and
`project list` commands. M33 exclusively owns issue-label/project-label command wiring, filtering,
resource output, and live adoption. M35 exclusively owns issue-comment/project-comment command
wiring, targeting, resource output, and live adoption.

A downstream adopter reaches `V=PASS` only after its exact upstream `CPH-*` prerequisites have
`V=PASS`. M34 completion never waits for M33 or M35. Re-running the full repository verification
gate in each milestone is intentional; duplicating ownership of a public behavior is not.

The shared R10.2/R10.3 `--all` waiver and generic pagination semantics have one owner in M34.
M33/M35 cite that decision rather than creating independent waivers or alternate contracts.

### 1.4 Live verification workspace: ConceptM only

Every M34 live test and verification must target the ConceptM Linear account/workspace exclusively.
The harness resolves through the normal repository profile, asserts ConceptM before any fixture
write, and fails closed on missing or mismatched identity. It may mutate only uniquely named issue
and project fixtures it creates itself, must record every fixture ID, and must record cleanup. No
M34 live probe may write to another account or workspace.

## 2. Tracking methodology

### 2.1 Per-ID lifecycle

Every row is tracked independently through the user-requested columns while preserving real TDD:

1. **RED:** write and run the ID-labelled failing test.
2. **IMPLEMENT:** make the smallest production change for that ID.
3. **GREEN:** rerun the targeted test and record the passing result.
4. **VERIFY:** independently exercise the built CLI, filesystem contract, or live API behavior.

`I=DONE`, `T=GREEN`, and `V=PASS` require separate evidence-log entries. No parent command or phase
is complete while any child ID remains incomplete.

### 2.2 Status vocabulary

| Column | Values | Meaning |
|---|---|---|
| `I` | `NS`, `IP`, `DONE`, `BASELINE`, `BLOCKED`, `N/A` | Implementation state |
| `T` | `NS`, `RED`, `GREEN`, `BLOCKED`, `N/A` | Targeted automated-test state |
| `V` | `NS`, `PASS`, `FAIL`, `BLOCKED`, `N/A` | Independent verification state |

### 2.3 ID families

| Prefix | Tracks |
|---|---|
| `CPH-CMD-*` | command/group registration and routing |
| `CPH-ARG-*` | one positional argument contract |
| `CPH-OPT-*` | one option on one command |
| `CPH-RULE-*` | one command-specific interaction, rejection, or terminator contract |
| `CPH-PAG-*` | shared raw-cursor and traversal behavior |
| `CPH-HIS-*` | history persistence, schema, retention, and privacy |
| `CPH-OUT-*` | human, JSON, TSV, stdout, stderr, and exit contracts |
| `CPH-API-*` | shared page types and resource adapters |
| `CPH-TST-*` | test harnesses and fixtures |
| `CPH-DOC-*` | documentation and conformance artifacts |
| `CPH-VER-*` | aggregate verification gates |

### 2.4 Evidence log requirements

Every transition appends the ID, phase, exact command/test, expected result, observed result,
source/test paths, revision (`working-tree` until committed), and blocker or live-fixture IDs when
applicable. Existing failure or RED evidence is never rewritten away.

## 3. Command, argument, and option ledger

### 3.1 Cursor-producing list commands owned by M34

M34 owns shared pagination plus the two existing list-command migrations. Future label/comment
commands consume the public adopter contract and remain owned by M33/M35.

| ID | Interface element | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-CMD-ISSUE-LIST` | `issue list` pagination adoption | Preserve all nonpagination behavior; adopt the shared page result/history adapter | BASELINE | GREEN | PASS |
| `CPH-OPT-ISSUE-LIMIT` | issue `-l, --limit <number>` | Preserve the existing spelling and default 50 bounded-result option | BASELINE | GREEN | PASS |
| `CPH-OPT-ISSUE-LIMIT-PARSE` | issue `--limit` value grammar | Require one complete base-10 integer token; reject fractional, nonnumeric, signed-empty, and trailing-junk values before API/history access | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-LIMIT-MIN` | issue `--limit` lower bound | Preserve acceptance of 1 and rejection of 0/negative values | BASELINE | GREEN | PASS |
| `CPH-OPT-ISSUE-LIMIT-MAX` | issue `--limit` upper bound | Preserve acceptance of 250 and rejection of 251 or greater | BASELINE | GREEN | PASS |
| `CPH-CMD-ISSUE-PAGINATION-USAGE` | invalid issue pagination syntax/value | Normalize bad pagination flags, missing values, and invalid limits to stderr, usage exit 2, and zero API/history access | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-AFTER` | issue `--after <cursor>` | New; exact nonempty raw Linear cursor | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-ALL` | issue `-a, --all` | Preserve all-page behavior; with `--after`, fetch all remaining | BASELINE | GREEN | PASS |
| `CPH-OPT-ISSUE-NOHISTORY` | issue `--no-cursor-history` | Do not persist the emitted continuation cursor | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-OUTPUT` | issue `-o, --output <table\|json\|tsv>` | Replace the nonstandard result selector with the canonical R4.1 spelling while preserving all three formats | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-JSON` | issue `--json` | Exact shorthand for `--output json`; equivalent JSON/JSON is accepted and JSON/non-JSON conflicts fail with usage 2 | DONE | GREEN | PASS |
| `CPH-OPT-ISSUE-REJECT-FORMAT` | issue `-f, --format` | Remove the R3.4-conflicting legacy result selector in the coordinated major release; reject it with usage 2 and migration guidance | DONE | GREEN | PASS |
| `CPH-CMD-PROJECT-LIST` | `project list` pagination adoption | Preserve all nonpagination behavior; adopt shared page result/history | BASELINE | GREEN | PASS |
| `CPH-OPT-PROJECT-LEAD` | project `-l, --lead <name>` | Preserve the existing nonpagination short option; pagination must not reassign `-l` | BASELINE | GREEN | PASS |
| `CPH-OPT-PROJECT-LIMIT` | project `--limit <number>` | Preserve the existing long-only spelling and default 50 bounded-result option | BASELINE | GREEN | PASS |
| `CPH-OPT-PROJECT-LIMIT-PARSE` | project `--limit` value grammar | Require one complete base-10 integer token; reject fractional, nonnumeric, signed-empty, and trailing-junk values before API/history access | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-LIMIT-MIN` | project `--limit` lower bound | Preserve acceptance of 1 and rejection of 0/negative values | BASELINE | GREEN | PASS |
| `CPH-OPT-PROJECT-LIMIT-MAX` | project `--limit` upper bound | Newly accept 250 and reject 251 or greater before the API call | DONE | GREEN | PASS |
| `CPH-CMD-PROJECT-PAGINATION-USAGE` | invalid project pagination syntax/value | Normalize bad pagination flags, missing values, and invalid limits to stderr, usage exit 2, and zero API/history access | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-AFTER` | project `--after <cursor>` | New; exact nonempty raw Linear cursor | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-ALL` | project `-a, --all` | Add `-a`; preserve all-page behavior; support all remaining | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-NOHISTORY` | project `--no-cursor-history` | Do not persist the emitted continuation cursor | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-OUTPUT` | project `-o, --output <table\|json\|tsv>` | Replace the nonstandard result selector with the canonical R4.1 spelling while preserving all three formats | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-JSON` | project `--json` | Exact shorthand for `--output json`; equivalent JSON/JSON is accepted and JSON/non-JSON conflicts fail with usage 2 | DONE | GREEN | PASS |
| `CPH-OPT-PROJECT-REJECT-FORMAT` | project `-f, --format` | Remove the R3.4-conflicting legacy result selector in the coordinated major release; reject it with usage 2 and migration guidance | DONE | GREEN | PASS |


### 3.2 Cursor-history commands

| ID | Interface element | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-CMD-HISTORY-GROUP` | `cursor-history` | Local history command group; incomplete invocation prints help to stderr and exits 2 | DONE | GREEN | PASS |
| `CPH-CMD-HISTORY-LIST` | `cursor-history list` | List newest entries first; no network or authentication required | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-LIST-LIMIT` | list `--limit <number>` | Default 50; integer 1–1000; caps retained entries returned | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-LIST-CURSOR` | list `--cursor <cursor>` | Exact raw-cursor filter; nonempty; does not call Linear | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-LIST-OUTPUT` | list `-o, --output <table\|json>` | Human table/records by default; JSON envelope on request | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-LIST-JSON` | list `--json` | Exact shorthand for `--output json` | DONE | GREEN | PASS |
| `CPH-CMD-HISTORY-VIEW` | `cursor-history view <entry-id>` | View one exact retained history entry | DONE | GREEN | PASS |
| `CPH-ARG-HISTORY-VIEW-ID` | view `<entry-id>` | Exact UUID emitted by history; malformed usage 2; missing entry 3 | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-VIEW-OUTPUT` | view `-o, --output <table\|json>` | Human record by default; JSON object on request | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-VIEW-JSON` | view `--json` | Exact shorthand for `--output json` | DONE | GREEN | PASS |
| `CPH-CMD-HISTORY-CLEAR` | `cursor-history clear` | Delete all retained cursor history after confirmation | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-CLEAR-DRYRUN` | clear `--dry-run` | Report count/path; do not prompt or write | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-CLEAR-YES` | clear `-y, --yes` | Supply destructive consent and bypass confirmation | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-CLEAR-NOINPUT` | clear `--no-input` | Never prompt; without `--yes`, usage exit 2 and no write | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-CLEAR-OUTPUT` | clear `-o, --output <table\|json>` | Human summary or JSON result | DONE | GREEN | PASS |
| `CPH-OPT-HISTORY-CLEAR-JSON` | clear `--json` | Exact shorthand for `--output json` | DONE | GREEN | PASS |

### 3.3 Shared cross-option primitives

These IDs own reusable behavior. Section 3.4 and the M33/M35 dependency maps independently prove
that each command delegates to the primitive; they do not copy its implementation status.

| ID | Interaction | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-PAG-AFTER-LIMIT` | `--after C --limit N` primitive | Return the next N matching items after C | DONE | GREEN | PASS |
| `CPH-PAG-AFTER-ALL` | `--after C --all` primitive | Fetch every remaining item strictly after C | DONE | GREEN | PASS |
| `CPH-PAG-ALL-LIMIT` | `--all --limit N` primitive | `--all` wins for current a2l compatibility; debug diagnostic only | DONE | GREEN | PASS |
| `CPH-PAG-NOHISTORY-AFTER` | resume/history primitive | Resume normally; do not record any newly emitted cursor | DONE | GREEN | PASS |
| `CPH-PAG-NOHISTORY-ALL` | exhaustion/history primitive | Traverse normally; no history entry is possible at exhaustion | DONE | GREEN | PASS |
| `CPH-OUT-JSON-CONFLICT` | output-alias validator primitive | Accept equivalent JSON requests; reject JSON/table conflict with usage exit 2 | DONE | GREEN | PASS |

### 3.4 M34-owned command adoption rules

Every row names one executable command and one option or interaction so failure is independently
auditable.

| ID | Command interaction | Contract | Depends on | I | T | V |
|---|---|---|---|---|---|---|
| `CPH-RULE-ISSUE-AFTER-LIMIT` | issue `--after C --limit N` | Return the next N matching issues after C | `CPH-PAG-AFTER-LIMIT` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-AFTER-LIMIT` | project `--after C --limit N` | Return the next N matching projects after C | `CPH-PAG-AFTER-LIMIT` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-AFTER-ALL` | issue `--after C --all` | Fetch every remaining issue after C | `CPH-PAG-AFTER-ALL` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-AFTER-ALL` | project `--after C --all` | Fetch every remaining project after C | `CPH-PAG-AFTER-ALL` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-ALL-LIMIT` | issue `--all --limit N` | Apply the documented compatibility precedence | `CPH-PAG-ALL-LIMIT` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-ALL-LIMIT` | project `--all --limit N` | Apply the documented compatibility precedence | `CPH-PAG-ALL-LIMIT` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-NOHISTORY-AFTER` | issue `--after C --no-cursor-history` | Resume without recording a new cursor | `CPH-PAG-NOHISTORY-AFTER` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-NOHISTORY-AFTER` | project `--after C --no-cursor-history` | Resume without recording a new cursor | `CPH-PAG-NOHISTORY-AFTER` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-NOHISTORY-ALL` | issue `--all --no-cursor-history` | Exhaust without creating a history entry | `CPH-PAG-NOHISTORY-ALL` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-NOHISTORY-ALL` | project `--all --no-cursor-history` | Exhaust without creating a history entry | `CPH-PAG-NOHISTORY-ALL` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-TERMINATOR` | issue `--` | End option parsing | CLI Standard R3.1 | BASELINE | GREEN | PASS |
| `CPH-RULE-PROJECT-TERMINATOR` | project `--` | End option parsing | CLI Standard R3.1 | BASELINE | GREEN | PASS |
| `CPH-RULE-HISTORY-LIST-TERMINATOR` | history list `--` | End option parsing | CLI Standard R3.1 | DONE | GREEN | PASS |
| `CPH-RULE-HISTORY-VIEW-TERMINATOR` | history view `--` | End option parsing | CLI Standard R3.1 | DONE | GREEN | PASS |
| `CPH-RULE-HISTORY-CLEAR-TERMINATOR` | history clear `--` | End option parsing | CLI Standard R3.1 | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-REJECT-PAGE` | issue `--page <number>` | Reject as unknown with usage exit 2 | `CPH-CMD-ISSUE-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-REJECT-PAGE` | project `--page <number>` | Reject as unknown with usage exit 2 | `CPH-CMD-PROJECT-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-REJECT-BEFORE` | issue `--before <cursor>` | Reject as unknown with usage exit 2 | `CPH-CMD-ISSUE-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-REJECT-BEFORE` | project `--before <cursor>` | Reject as unknown with usage exit 2 | `CPH-CMD-PROJECT-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-REJECT-CURSOR` | issue `--cursor <cursor>` | Reject; only `--after` resumes | `CPH-CMD-ISSUE-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-REJECT-CURSOR` | project `--cursor <cursor>` | Reject; only `--after` resumes | `CPH-CMD-PROJECT-PAGINATION-USAGE` | DONE | GREEN | PASS |
| `CPH-RULE-ISSUE-JSON` | issue `--json --output` | Accept JSON/JSON; reject JSON/table or JSON/TSV before API/history access | `CPH-OUT-JSON-CONFLICT` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-JSON` | project `--json --output` | Accept JSON/JSON; reject JSON/table or JSON/TSV before API/history access | `CPH-OUT-JSON-CONFLICT` | DONE | GREEN | PASS |
| `CPH-RULE-PROJECT-INTERACTIVE` | project `--interactive` pagination | Use the same already-fetched normalized page/history result as other human rendering; never perform a second divergent fetch | `CPH-CMD-PROJECT-LIST` | DONE | GREEN | PASS |
| `CPH-RULE-HISTORY-LIST-JSON` | history list `--json --output` | Accept JSON/JSON; reject JSON/table | `CPH-OUT-JSON-CONFLICT` | DONE | GREEN | PASS |
| `CPH-RULE-HISTORY-VIEW-JSON` | history view `--json --output` | Accept JSON/JSON; reject JSON/table | `CPH-OUT-JSON-CONFLICT` | DONE | GREEN | PASS |
| `CPH-RULE-HISTORY-CLEAR-JSON` | history clear `--json --output` | Accept JSON/JSON; reject JSON/table before clearing | `CPH-OUT-JSON-CONFLICT` | DONE | GREEN | PASS |


## 4. Raw-cursor pagination contract

### 4.1 Public behavior

| Invocation | Linear request behavior | User-visible meaning |
|---|---|---|
| no page options | `first=50`, no `after` | first bounded result set |
| `--limit N` | bounded traversal sufficient to return N post-filter items | first N matching items |
| `--after C` | `first=50`, `after=C` | next bounded result set |
| `--after C --limit N` | bounded traversal from C | next N matching items |
| `--all` | sequential requests from the beginning | every matching item |
| `--after C --all` | sequential requests beginning after C | every remaining matching item |

Numeric page addressing remains unsupported. Page two means: run page one, copy its `endCursor`, and
pass that exact value to `--after`. Page N requires walking the preceding cursor chain.

Adapters may use a smaller internal GraphQL request size without changing the public result bound.
The project adapter uses 50 because ConceptM live verification proved that requesting 250 projects
makes the Linear query complexity 18,200 over the provider maximum 10,000. A public
`--limit 250` is still filled by sequential internal pages and returns up to 250 matching projects.

### 4.2 Atomic pagination behavior ledger

| ID | Behavior | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-PAG-DEFAULT` | bounded default | Return at most 50 matching items and expose whether more exist | DONE | GREEN | PASS |
| `CPH-PAG-LIMIT-PARSE` | integer parser | Reject nonnumeric, fractional, signed-empty, or trailing-junk input before API | DONE | GREEN | PASS |
| `CPH-PAG-LIMIT-MIN` | lower bound | 1 accepted; 0/negative rejected with usage 2 | DONE | GREEN | PASS |
| `CPH-PAG-LIMIT-MAX` | upper bound | 250 accepted; 251 rejected with usage 2 | DONE | GREEN | PASS |
| `CPH-PAG-RAW-FIDELITY` | raw cursor | Preserve exact Unicode/code-unit string from output through next GraphQL variable | DONE | GREEN | PASS |
| `CPH-PAG-RAW-NO-WRAP` | no custom token | Never encode, sign, prefix, version, or replace Linear's cursor | DONE | GREEN | PASS |
| `CPH-PAG-AFTER-EMPTY` | empty cursor | Usage 2; no API call and no history write | DONE | GREEN | PASS |
| `CPH-PAG-AFTER-PASS` | backend variable | Supply the caller string unchanged as GraphQL `after` | DONE | GREEN | PASS |
| `CPH-PAG-ORDER` | stable query order | Every adapter declares supported provider order and preserves returned order | DONE | GREEN | PASS |
| `CPH-PAG-ISSUE-ORDER` | issue provider order | Translate priority/created/updated/due plus asc/desc to Linear `sort`; retain provider-returned order and record the exact declaration | DONE | GREEN | PASS |
| `CPH-PAG-PROJECT-ORDER` | project provider order | Declare Linear `updatedAt` descending and retain provider-returned order for every cursor page | DONE | GREEN | PASS |
| `CPH-PAG-EDGE-CURSOR` | filtered boundaries | Request edge cursors when client filtering may stop within a backend page | DONE | GREEN | PASS |
| `CPH-PAG-LAST-EXAMINED` | continuation boundary | Emit cursor of last examined edge, never blindly skip to backend page end | DONE | GREEN | PASS |
| `CPH-PAG-ALL-SEQUENTIAL` | traversal | Follow cursors sequentially; never parallelize cursor-dependent requests | DONE | GREEN | PASS |
| `CPH-PAG-MISSING-END` | malformed pageInfo | `hasNextPage=true` without cursor fails runtime 1; never loops | DONE | GREEN | PASS |
| `CPH-PAG-REPEATED-END` | loop guard | Repeated cursor fails runtime 1; never loops | DONE | GREEN | PASS |
| `CPH-PAG-DEDUPE` | duplicate node | Keep first occurrence by ID without changing provider order | DONE | GREEN | PASS |
| `CPH-PAG-ATOMIC-OUTPUT` | later-page failure | Buffer traversal; do not emit partial result documents | DONE | GREEN | PASS |
| `CPH-PAG-INVALID-BACKEND` | rejected cursor | Normalize to `invalid_cursor`, exit 5; never restart page one | DONE | GREEN | PASS |
| `CPH-PAG-CONTEXT-UNBOUND` | changed query context | a2l does not prevalidate raw cursor context; docs direct users to history | DONE | GREEN | PASS |
| `CPH-PAG-END-NULL` | exhausted result | Public `endCursor=null`, `hasNextPage=false`, `fetchedAll=true` | DONE | GREEN | PASS |
| `CPH-PAG-RETURNED-COUNT` | invocation count | Count only items returned by this invocation, not remote collection total | DONE | GREEN | PASS |

### 4.3 Cursor handoff

Human truncated output must place actionable data on stdout:

```text
Showing 50 items; more are available.

Next page:
  a2l issue list --limit 50 --after '<raw-linear-cursor>'

All remaining:
  a2l issue list --after '<raw-linear-cursor>' --all

Cursor history: 5f9cbcef-7b15-4df8-901d-491a2b55ee6f
```

Generated commands preserve the resolved resource target, effective filters, lifecycle scope,
ordering, and result limit. Targets and cursors are shell-quoted. The source command is sanitized and
canonicalized; it need not reproduce the user's original spelling or option order.

## 5. Cursor-history storage and privacy contract

### 5.1 Location and retention

Canonical path:

```text
$XDG_STATE_HOME/agent2linear/cursor-history.json
```

Fallback:

```text
~/.local/state/agent2linear/cursor-history.json
```

History is a single cross-workspace file so a user can identify an unknown cursor even when outside
the originating repository. Each entry carries readable workspace context plus the existing
non-secret workspace cache key when available.

### 5.2 History behavior ledger

| ID | Behavior | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-HIS-XDG-STATE` | state root | Honor absolute nonempty `XDG_STATE_HOME`; otherwise use the fallback | DONE | GREEN | PASS |
| `CPH-HIS-DIR-MODE` | state directory permissions | Create agent2linear state directory with owner-only permissions where supported | DONE | GREEN | PASS |
| `CPH-HIS-FILE-MODE` | history file permissions | Create/replace with mode 0600 where supported | DONE | GREEN | PASS |
| `CPH-HIS-SCHEMA-VERSION` | file schema | Top-level version allows diagnosed future migration | DONE | GREEN | PASS |
| `CPH-HIS-RECORD-CONDITION` | entry creation | Record only nonempty emitted cursors when more pages exist | DONE | GREEN | PASS |
| `CPH-HIS-NO-RECORD-COMPLETE` | exhausted page | Do not create an entry when no next page exists | DONE | GREEN | PASS |
| `CPH-HIS-NO-RECORD-DISABLED` | opt-out | `--no-cursor-history` performs no history read/write needed for recording | DONE | GREEN | PASS |
| `CPH-HIS-RETENTION` | maximum entries | Retain newest 1,000; prune oldest after successful merge | DONE | GREEN | PASS |
| `CPH-HIS-NO-TTL` | expiration | Entries do not expire by time; only clear or count pruning removes them | DONE | GREEN | PASS |
| `CPH-HIS-NEWEST-FIRST` | display order | List newest first with deterministic ID tie-break | DONE | GREEN | PASS |
| `CPH-HIS-ATOMIC-WRITE` | persistence | Write temp file, fsync where supported, and atomically replace destination | DONE | GREEN | PASS |
| `CPH-HIS-LOCK` | concurrency | Interprocess lock protects read-modify-write and clear | DONE | GREEN | PASS |
| `CPH-HIS-LOCK-TIMEOUT` | contention | Retry every 25 ms for at most 2,000 ms, then warn/fail according to caller type; never hang | DONE | GREEN | PASS |
| `CPH-HIS-LOCK-RECOVERY` | crashed writer | Treat a lock older than 30,000 ms as stale, quarantine it before deletion, and validate the owner token before commit/release | DONE | GREEN | PASS |
| `CPH-HIS-CORRUPT` | invalid file | History commands fail with precise path/schema error; remote list still returns cursor with warning | DONE | GREEN | PASS |
| `CPH-HIS-WRITE-FAILURE` | nonfatal recording failure | Remote list exits 0 with result/cursor; human stderr warning or JSON status `failed` | DONE | GREEN | PASS |
| `CPH-HIS-CLEAR-ATOMIC` | clear | Locked deletion/replacement leaves no partial file | DONE | GREEN | PASS |
| `CPH-HIS-CLEAR-EMPTY` | empty history | Successful no-op, exit 0, deleted count 0 | DONE | GREEN | PASS |
| `CPH-HIS-CACHE-CLEAR-ISOLATION` | `cache clear` | Existing entity-cache clear never deletes cursor history | DONE | GREEN | PASS |
| `CPH-HIS-HISTORY-CLEAR-ISOLATION` | history clear | Deletes cursor history only; never deletes entity/project caches | DONE | GREEN | PASS |
| `CPH-HIS-NO-NETWORK` | inspection | list/view/clear never initialize Linear client or require auth | DONE | GREEN | PASS |
| `CPH-HIS-RAW-ARGV-BAN` | command capture | Never persist `process.argv` verbatim | DONE | GREEN | PASS |
| `CPH-HIS-SECRET-BAN` | redaction | Never persist API keys, tokens, headers, env values, stdin, or credential paths | DONE | GREEN | PASS |
| `CPH-HIS-SAFE-COMMAND` | canonical source command | Reconstruct only approved parsed operands/options with shell quoting | DONE | GREEN | PASS |
| `CPH-HIS-SENSITIVE-FILTER-DISCLOSURE` | ordinary query text | Non-credential targets/search/filter literals are stored; docs direct sensitive queries to opt out | DONE | GREEN | PASS |
| `CPH-HIS-CURSOR-ADVISORY` | no enforcement | History lookup never authorizes, rejects, rewrites, or substitutes a cursor | DONE | GREEN | PASS |

### 5.3 Entry schema ledger

| ID | JSON field | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-HIS-F-ID` | `id` | Random UUID for local lookup; not accepted by remote `--after` | DONE | GREEN | PASS |
| `CPH-HIS-F-CURSOR` | `cursor` | Exact raw Linear cursor | DONE | GREEN | PASS |
| `CPH-HIS-F-CREATED` | `createdAt` | UTC ISO 8601 timestamp | DONE | GREEN | PASS |
| `CPH-HIS-F-WORKSPACE-KEY` | `workspace.key` | Existing non-secret workspace cache key or null | DONE | GREEN | PASS |
| `CPH-HIS-F-WORKSPACE-ID` | `workspace.id` | Linear workspace ID when already resolved; otherwise null | DONE | GREEN | PASS |
| `CPH-HIS-F-WORKSPACE-NAME` | `workspace.name` | Resolved workspace/profile display name when available | DONE | GREEN | PASS |
| `CPH-HIS-F-COMMAND-PATH` | `commandPath` | Canonical path such as `issue comment list` | DONE | GREEN | PASS |
| `CPH-HIS-F-RESOURCE` | `resource` | Stable enum: issue, project, issue-label, project-label, issue-comment, project-comment | DONE | GREEN | PASS |
| `CPH-HIS-F-TARGET` | `target` | Canonical target ID and safe human label, or null for collection roots | DONE | GREEN | PASS |
| `CPH-HIS-F-FILTERS` | `filters` | Normalized effective filters/lifecycle scope with secrets excluded | DONE | GREEN | PASS |
| `CPH-HIS-F-ORDER` | `orderBy` | Exact declared provider ordering used by the request | DONE | GREEN | PASS |
| `CPH-HIS-F-LIMIT` | `limit` | Effective returned-item bound for the originating invocation | DONE | GREEN | PASS |
| `CPH-HIS-F-SOURCE-COMMAND` | `sourceCommand` | Sanitized canonical command that produced the cursor | DONE | GREEN | PASS |
| `CPH-HIS-F-NEXT-COMMAND` | `nextCommand` | Copyable command preserving context and adding raw `--after` | DONE | GREEN | PASS |
| `CPH-HIS-F-ALL-COMMAND` | `allRemainingCommand` | Copyable context-preserving `--after C --all` command | DONE | GREEN | PASS |

## 6. Output, history inspection, and errors

### 6.1 Remote-list JSON

Existing issue/project/label bare arrays become resource-specific envelopes in the breaking release:

```json
{
  "issues": [],
  "pageInfo": {
    "returnedCount": 50,
    "hasNextPage": true,
    "endCursor": "raw-linear-cursor",
    "fetchedAll": false
  },
  "cursorHistory": {
    "status": "recorded",
    "entryId": "5f9cbcef-7b15-4df8-901d-491a2b55ee6f"
  }
}
```

The collection key is `issues`, `projects`, `labels`, or `comments`; comment envelopes also retain
their `target`. `cursorHistory.status` is one of `recorded`, `disabled`, `not_applicable`, or
`failed`. TSV remains row-only; JSON is the stable machine continuation format.

### 6.2 History list JSON

```json
{
  "entries": [],
  "returnedCount": 0,
  "retainedCount": 0,
  "maxEntries": 1000
}
```

Human list output prints the entry ID, timestamp, workspace, resource/target, source command, next
command, and full raw cursor. `view` prints every stored field. Empty history/list filters succeed
with exit 0.

### 6.3 Output and error ledger

| ID | Contract | Required behavior | I | T | V |
|---|---|---|---|---|---|
| `CPH-OUT-HUMAN-NEXT` | next-page footer | stdout includes full copyable next command when more exist | DONE | GREEN | PASS |
| `CPH-OUT-HUMAN-ALL-REMAINING` | all-remaining footer | stdout command starts at emitted cursor, not collection beginning | DONE | GREEN | PASS |
| `CPH-OUT-HUMAN-HISTORY-ID` | recorded entry | stdout includes history entry ID | DONE | GREEN | PASS |
| `CPH-OUT-SHELL-CURSOR` | cursor quoting | shell round-trip preserves exact cursor bytes | DONE | GREEN | PASS |
| `CPH-OUT-SHELL-CONTEXT` | context quoting | targets/filter values survive shell round-trip | DONE | GREEN | PASS |
| `CPH-OUT-PAGE-COUNT` | `pageInfo.returnedCount` | nonnegative integer for this invocation | DONE | GREEN | PASS |
| `CPH-OUT-PAGE-HASNEXT` | `pageInfo.hasNextPage` | exact backend/traversal continuation state | DONE | GREEN | PASS |
| `CPH-OUT-PAGE-END` | `pageInfo.endCursor` | raw cursor when more exist, else null | DONE | GREEN | PASS |
| `CPH-OUT-PAGE-ALL` | `pageInfo.fetchedAll` | true only when invocation reached exhaustion | DONE | GREEN | PASS |
| `CPH-OUT-HISTORY-STATUS` | `cursorHistory.status` | stable four-value enum | DONE | GREEN | PASS |
| `CPH-OUT-HISTORY-ENTRY` | `cursorHistory.entryId` | UUID only when recorded, otherwise null | DONE | GREEN | PASS |
| `CPH-OUT-JSON-ATOMIC` | JSON stdout | exactly one valid document after complete success | DONE | GREEN | PASS |
| `CPH-OUT-TSV-CLEAN` | TSV stdout | rows only; truncated diagnostic on stderr points to JSON/history | DONE | GREEN | PASS |
| `CPH-OUT-DIAGNOSTICS` | stderr | warnings, confirmation, progress, and errors only | DONE | GREEN | PASS |
| `CPH-OUT-ERROR-JSON` | machine error | one `{"error":{"code","message"}}` object on stderr | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-0` | success/empty | exit 0, including empty history and empty remote page | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-1` | runtime/state failure | network, malformed server pageInfo, corrupt history command, unclassified I/O | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-2` | usage | invalid option/value/conflict or noninteractive clear without consent | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-3` | history entry missing | exact well-formed ID absent | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-4` | auth | remote list authentication/authorization failure | DONE | GREEN | PASS |
| `CPH-OUT-EXIT-5` | invalid cursor/conflict | Linear cursor rejection or precondition failure | DONE | GREEN | PASS |

## 7. API and implementation ledger

| ID | Component | Contract | I | T | V |
|---|---|---|---|---|---|
| `CPH-API-PAGE-INPUT` | shared `PageInput` | `limit`, raw `after`, `fetchAll`, history opt-out | DONE | GREEN | PASS |
| `CPH-API-PAGE-INFO` | shared `PageInfo` | returnedCount/hasNextPage/endCursor/fetchedAll | DONE | GREEN | PASS |
| `CPH-API-PAGE-EDGE` | shared edge model | node plus exact edge cursor | DONE | GREEN | PASS |
| `CPH-API-PAGE-WALKER` | traversal primitive | guarded sequential cursor loop with adapter callbacks | DONE | GREEN | PASS |
| `CPH-API-PAGE-FILTER` | client-filter hook | counts matches without losing last-examined edge | DONE | GREEN | PASS |
| `CPH-API-PAGE-ORDER` | ordering declaration | adapter must provide stable provider order metadata | DONE | GREEN | PASS |
| `CPH-API-HISTORY-ADAPTER` | history record adapter | safe structured context, never raw argv | DONE | GREEN | PASS |
| `CPH-API-ADOPTER-CONTRACT` | public resource-adapter protocol | typed callbacks and normalized input/result/context without resource imports | DONE | GREEN | PASS |
| `CPH-API-ISSUE-ADAPTER` | issue list | return shared page result and effective query context | DONE | GREEN | PASS |
| `CPH-API-PROJECT-ADAPTER` | project list | return shared page result and effective query context | DONE | GREEN | PASS |
| `CPH-API-XDG-STATE` | `userStateDir()` | single XDG state-path source of truth | DONE | GREEN | PASS |
| `CPH-API-HISTORY-STORE` | history module | typed read/append/find/clear with lock and atomic write | DONE | GREEN | PASS |
| `CPH-API-FACADE` | exports | explicit shared pagination/history exports; no cycles | DONE | GREEN | PASS |

## 8. CLI Standard applicability, deviations, and behavior changes

### 8.1 Applicability

| Axis | Applies? | Reason |
|---|---|---|
| Config | Yes | Existing workspace/config resolution and new XDG state path |
| Networked | Yes | Remote Linear list traversal |
| Destructive | Yes | Local `cursor-history clear` deletes durable user state |
| Scripted consumers | Yes | Stable JSON envelopes and errors are required |
| Caching/offline | Partial | History is state, not remote-data cache; local inspection works offline |
| Secrets | Yes | Sanitized command history must never capture credentials |
| Async/streaming/plugins | No | No async job, streaming protocol, or plugin surface |

### 8.2 Decisions and deviations

| Rule/area | Standard or repository convention | M34 decision | Status/reason |
|---|---|---|---|
| R5.3 XDG | history belongs under XDG state | add `userStateDir()` and state file | Conforming |
| R5.8 locking | shared state should use atomic writes/locking | locked atomic history replacement | Conforming SHOULD |
| R5.9 clearing | cached/stored local data needs clearing controls | `cursor-history clear` | Conforming in spirit; history is not cache |
| Local clear precedent | Existing `cache clear` removes disposable data without confirmation | History clear confirms and supports no-input/dry-run | Intentional safety difference: history is durable user-visible state, not disposable cache |
| R7.1/R7.8 streams | data stdout, diagnostics stderr, structured machine errors | enforce for page/history commands | Conforming |
| R4.1/R4.2 result selection | result commands use `-o/--output` plus equivalent `--json` | migrate both M34 remote lists and all history result commands | Conforming breaking correction; independently tracked per affected command |
| R3.4 `-f` reservation | `-f` is reserved for force | remove existing issue/project `-f/--format` result selectors | Conforming correction and intentional major-release break; migration guidance required |
| R6.1/R9.3 usage exits | existing issue/project pagination usage failures collapse to exit 1 | normalize each existing command's pagination parse/value failures to exit 2 | Conforming correction and intentional public exit-code break; ship only in the coordinated major release |
| R8.1/R8.2/R8.5 clear safety | destructive action confirms and has noninteractive path | `--yes`, `--no-input`, `--dry-run` | Conforming |
| R10.3 bounded pages | bounded default and explicit exhaustive traversal | default 50, limit, next cursor, all remaining | Conforming behavior |
| R10.2/R10.3 spelling | Standard uses `--paginate`; repo uses `--all` for pagination | retain `-a, --all` across adopters | SHOULD waiver for repository consistency |
| Raw cursor | no repository public-cursor precedent | expose Linear cursor unchanged | Explicit user decision; history mitigates lost context but does not validate |
| JSON arrays | existing issue/project/label lists emit arrays | move resumable formats to envelopes | Intentional breaking change required for page metadata; ship only in major release |
| `cursor-history` noun | new singular collective resource | use noun-verb `list/view/clear` | Conforming profile; `clear` follows local `cache clear` domain convention |

### 8.3 Explicit behavior-change register

- Existing issue list preserves `-l, --limit <number>`; project list preserves long-only `--limit`
  because `-l` remains `--lead`. Both preserve default 50, but newly reject partial numeric tokens such as `1.5` and `12abc`; project newly enforces the documented maximum
  250. Invalid pagination syntax/values change from generic exit 1 to usage exit 2. These public
  validation/exit changes are part of the coordinated major release.
- M33 label lists gain raw `--after`; `--all` becomes pagination-only and no longer implies retired
  scope. `--include-retired` removes only M33's client-side `retiredAt == null` predicate;
  `archivedAt` remains independent and label lists retain `includeArchived: false`.
- M35 comment lists delegate shared cursor/history behavior to M34.
- Existing issue/project/label JSON arrays become envelopes in the coordinated major release.
- Existing issue/project result selection moves from `-f/--format` to canonical `-o/--output` plus
  `--json`; this is an explicitly tracked coordinated-major migration, not an unannounced alias.
- Successful cursor-producing commands write sanitized local history by default; this new default and
  its opt-out/path/retention are documented prominently.
- Ordinary target/search/filter text is part of that history context and may itself be sensitive;
  documentation must state this and show `--no-cursor-history` for sensitive queries.
- No command accepts a history entry ID as `--after`; callers must use the stored raw cursor or
  copyable command.

## 9. Test, documentation, and verification ledger

### 9.1 Tests

| ID | Harness | Coverage | I | T | V |
|---|---|---|---|---|---|
| `CPH-TST-PARSER` | command registration tests | every new command/argument/option and every rejected alias | DONE | GREEN | PASS |
| `CPH-TST-RAW` | raw cursor unit tests | exact pass-through, empty, shell quoting, no wrapping | DONE | GREEN | PASS |
| `CPH-TST-WALKER` | page walker unit tests | bounds, after, all, guards, dedupe, atomic failure | DONE | GREEN | PASS |
| `CPH-TST-ADOPTER-CONTRACT` | synthetic resource adapter | public callbacks, filter hook, context, normalized result; no M33/M35 imports | DONE | GREEN | PASS |
| `CPH-TST-FILTER-EDGE` | filtered-page fixture | stop mid-page and resume without skip/duplicate | DONE | GREEN | PASS |
| `CPH-TST-HISTORY-STORE` | store unit tests | schema, retention, ordering, read/append/find/clear | DONE | GREEN | PASS |
| `CPH-TST-HISTORY-XDG` | filesystem tests | XDG/fallback path, permissions, no home pollution | DONE | GREEN | PASS |
| `CPH-TST-HISTORY-CONCURRENCY` | multi-process test | locking, timeout, no lost update/corruption | DONE | GREEN | PASS |
| `CPH-TST-HISTORY-PRIVACY` | adversarial command tests | API key/env/stdin/header never persisted; quoting safe | DONE | GREEN | PASS |
| `CPH-TST-HISTORY-CLI` | built CLI | list/view/clear, consent, no-input, dry-run, JSON, exits | DONE | GREEN | PASS |
| `CPH-TST-ISSUE-ADOPTION` | issue list tests | baseline spelling/default/bounds; strict `1.5`/`12abc` rejection; usage exit 2; raw next page/history/envelope with existing filters | DONE | GREEN | PASS |
| `CPH-TST-PROJECT-ADOPTION` | project list tests | preserve `-l/--lead` and long-only limit/default/lower bound; new strict token and 250 maximum; usage exit 2; raw next page/history/envelope | DONE | GREEN | PASS |
| `CPH-TST-OUTPUT` | snapshots/schema | shared fields, issue/project envelopes, history output, errors | DONE | GREEN | PASS |
| `CPH-TST-OFFLINE` | `tests/scripts/test-cursor-history-cli.sh` | local history lifecycle without credentials/network | DONE | GREEN | PASS |
| `CPH-TST-LIVE` | opt-in Linear suite | ConceptM issue/project raw page-one/page-two/all-remaining traversal | DONE | GREEN | PASS |
| `CPH-TST-TRACE` | ledger checker | every `CPH-*` ID maps to test/evidence | DONE | GREEN | PASS |

### 9.2 Documentation

| ID | Artifact | Required content | I | T | V |
|---|---|---|---|---|---|
| `CPH-DOC-PLAN` | this plan | atomic interface/behavior ledger and execution method | DONE | N/A | PASS |
| `CPH-DOC-DEPENDENCY-MAP` | M33/M35 adopter map | Validate the exact downstream maps in M33 §4.6 and M35 §3.3; no copied status or reverse dependency | DONE | N/A | PASS |
| `CPH-DOC-MILESTONE` | `MILESTONES.md` | M34 dependency, behavior changes, gates, plan link | DONE | N/A | PASS |
| `CPH-DOC-README-PAGINATION` | README | page one/two/all remaining, raw cursor, no page N | DONE | N/A | PASS |
| `CPH-DOC-README-HISTORY` | README | path, default recording, retention, privacy, opt-out, clear | DONE | N/A | PASS |
| `CPH-DOC-HELP-REMOTE` | list help | exact defaults/interactions and generated-command examples | DONE | N/A | PASS |
| `CPH-DOC-HELP-HISTORY` | history help | list/view/clear examples and local-only behavior | DONE | N/A | PASS |
| `CPH-DOC-MIGRATION-JSON` | release/migration note | bare-array to envelope examples and jq migration | DONE | N/A | PASS |
| `CPH-DOC-ERRORS` | error reference | history and invalid-cursor stable codes/exits | DONE | N/A | PASS |
| `CPH-DOC-CONFORMANCE` | `CONFORMANCE.md` | v1.4.14, applicability, R10.2/R10.3 waiver, major break | DONE | N/A | PASS |
| `CPH-DOC-PRIVACY` | privacy/security docs | exact persisted fields and explicit exclusions | DONE | N/A | PASS |

### 9.2.1 Downstream dependency index

M34 publishes prerequisites; it does not own downstream command status:

| Downstream owner | Exact dependency map | M34 completion relationship |
|---|---|---|
| M33 label adopters | `2026-07-22-label-project-lifecycle-tdd.md` §4.6, keyed by `LPL-*` ID | One-way: each local `V=PASS` waits for its listed `CPH-*`; M34 never waits for M33 |
| M35 comment adopters | `2026-07-22-M35-issue-project-comments-tdd.md` §3.3, keyed by `CMT-*` ID | One-way: each local `V=PASS` waits for its listed `CPH-*`; M34 never waits for M35 |

The traceability gate must parse both maps, reject unknown local or upstream IDs, reject a completed
downstream adopter whose prerequisite is incomplete, and reject any reverse `CPH-*` dependency on
`LPL-*` or `CMT-*`. Re-running full repository gates downstream is evidence reuse, not a second
owner for the parser, walker, history store, or common output fields.

### 9.3 Aggregate verification

| ID | Gate | Pass condition | I | T | V |
|---|---|---|---|---|---|
| `CPH-VER-UNIT` | `npm test` | all unit suites pass | N/A | N/A | PASS |
| `CPH-VER-TYPE` | `npm run typecheck` | exit 0 | N/A | N/A | PASS |
| `CPH-VER-LINT` | `npm run lint` | exit 0 | N/A | N/A | PASS |
| `CPH-VER-BUILD` | `npm run build` | built CLI produced | N/A | N/A | PASS |
| `CPH-VER-HELP` | built help audit | exact commands/options/defaults/rejections | N/A | N/A | PASS |
| `CPH-VER-RAW` | cursor round trip | emitted cursor equals next GraphQL `after` byte-for-byte | N/A | N/A | PASS |
| `CPH-VER-ADOPTER-CONTRACT` | synthetic adopter gate | public adapter passes without M33/M35 resource imports | N/A | N/A | PASS |
| `CPH-VER-HISTORY` | local lifecycle | record/list/filter/view/dry-run/clear/opt-out all pass | N/A | N/A | PASS |
| `CPH-VER-PRIVACY` | state-file inspection | no secret/raw argv material; owner-only permissions | N/A | N/A | PASS |
| `CPH-VER-CONCURRENCY` | parallel writers | no corruption/lost successful record/hang | N/A | N/A | PASS |
| `CPH-VER-JSON` | `jq` schemas | all envelopes/errors parse with exact required fields | N/A | N/A | PASS |
| `CPH-VER-STREAMS` | stdout/stderr capture | requested data and diagnostics remain separated | N/A | N/A | PASS |
| `CPH-VER-LIVE` | ConceptM Linear traversal | fail closed on the exact ConceptM organization and active workspace; issue/project raw next and all-remaining paths match expected IDs; zero remote writes | N/A | N/A | PASS |
| `CPH-VER-DIFF` | scoped diff | `git diff --check`; no unrelated/source-secret changes | N/A | N/A | PASS |
| `CPH-VER-TRACE` | traceability report | unique IDs, no missing/orphan/incomplete child | N/A | N/A | PASS |
| `CPH-VER-CONFORMANCE` | publishable review | every MUST/blocker and SHOULD waiver visible | N/A | N/A | PASS |

## 10. TDD execution plan

### Phase 0 — Freeze ownership and dependency contracts

**IDs:** `CPH-DOC-PLAN`, `CPH-DOC-MILESTONE`, `CPH-DOC-DEPENDENCY-MAP`, baseline rows.

1. Capture current issue/project help, requests, JSON arrays, and exit behavior.
2. Publish the one-owner rule and exact M33/M35 dependency map.
3. Generate a machine-readable inventory and reject duplicate semantic owners.

**Gate:** counts/dependencies validate; no production source has changed.

### Phase 1 — Shared types, parser, and raw cursor RED tests

**IDs:** shared page types, `CPH-PAG-LIMIT-*`, raw cursor, and adopter input contracts.

RED-test complete-token parsing, bounds, exact cursor transfer, empty cursors, and normalized page
types before implementing the shared parser and models.

**Gate:** parser and pure contracts pass without credentials or resource modules.

### Phase 2 — XDG state and history store

**IDs:** `CPH-API-XDG-STATE`, `CPH-API-HISTORY-STORE`, all storage/schema/privacy rows.

Implement the typed schema, safe command builder, locked atomic writes, retention, corruption
handling, and clear behavior one ID at a time.

**Gate:** hermetic filesystem and parallel-process tests prove location, modes, retention, privacy,
locking, and no writes to the developer's real state directory.

### Phase 3 — Cursor-history CLI

**IDs:** every history command/argument/option and its command-specific adoption rules.

Implement list/view/clear in parser-first slices. Prove inspection and clearing never require a
Linear client and keep JSON/stdout clean.

**Gate:** the built offline CLI completes the local history lifecycle.

### Phase 4 — Walker, output normalization, and synthetic adopter

**IDs:** remaining shared `CPH-PAG-*`, page/history output fields,
`CPH-API-ADOPTER-CONTRACT`, `CPH-TST-ADOPTER-CONTRACT`.

Implement guarded traversal, edge-aware continuation, ordering, atomic rendering, history
recording/opt-out, and a synthetic adapter that proves the public contract without importing M33 or
M35 resource modules.

**Gate:** deterministic fake pages prove every cursor, returned sequence, and adopter callback.

### Phase 5 — Existing issue-list adoption

**IDs:** issue command/options/rules, issue adapter, tests, and JSON migration evidence.

Preserve nonpagination filters and human columns. Independently RED/GREEN every option and
interaction, including strict limit parsing and usage exits.

**Gate:** issue filters remain green; built issue help, next-page, history, streams, and envelope pass.

### Phase 6 — Existing project-list adoption

**IDs:** project command/options/rules, project adapter, tests, and JSON migration evidence.

Repeat the issue adoption lifecycle independently; never infer project parity from issue coverage.

**Gate:** project filters remain green; built project help, limits, next-page, history, streams, and
envelope pass.

### Phase 7 — Documentation, conformance, and closure

**IDs:** all remaining documentation and verification rows.

Run full gates, read-only issue/project live traversal, privacy/state-file inspection, dependency traceability,
and the publishable conformance review.

**Release gate:** existing JSON/exit breaks and unresolved MUST blockers prevent a non-major release.
M33/M35 adoption is downstream and does not block M34 completion.


## 11. Planned file structure

**New or likely new**

- `src/lib/pagination.ts`
- `src/lib/cursor-history.ts`
- `src/commands/cursor-history/register.ts`
- `src/commands/cursor-history/list.ts`
- `src/commands/cursor-history/view.ts`
- `src/commands/cursor-history/clear.ts`
- colocated unit/runner tests
- `tests/scripts/test-cursor-history-cli.sh`
- opt-in fail-closed ConceptM issue/project raw-cursor live harness

**Modified**

- `src/lib/xdg-paths.ts` and tests
- `src/cli.ts` and `src/index.ts` for typed usage-error propagation
- `src/commands/issue/list.ts` and `src/commands/project/list.tsx` for per-command limit migration
- public pagination adopter types/contract fixtures (no label/comment resource imports)
- resource output serializers and JSON schema fixtures
- `README.md`, `CHANGELOG.md`, `CONFORMANCE.md`, `MILESTONES.md`, test docs
- aggregate offline/live test registration

**Dependency constraints**

- No cursor encoding/signing library and no custom continuation token.
- No API request solely to enrich optional history fields.
- No SDK upgrade as part of cursor/history work.
- No raw-argv command logger.
- No reuse of disposable `$XDG_CACHE_HOME` for durable cursor history.

## 12. Evidence log

| Date | ID | Phase | Command/test | Expected | Observed | Files | Revision | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-07-22 | `CPH-DOC-PLAN` | IMPLEMENT | Publish raw-cursor/history plan | Settled raw cursor, history, IDs, phases, deviations | Plan created | this file | working-tree | Planning only; structural verification pending |
| 2026-07-22 | `CPH-DOC-PLAN` | VERIFY | Table/fence/heading/link/ID/diff audit | Structurally valid plan with unique atomic IDs | PASS: 194 rows, 194 unique IDs, valid Markdown tables/fences/headings, milestone link present, clean diff check | this file; `MILESTONES.md` | working-tree | No production source changed |
| 2026-07-22 | `CPH-DOC-MILESTONE` | VERIFY | Validate M34 placement and M33/M35 dependency references | One M34 entry between M35 and M33 with matching count/link | PASS | `MILESTONES.md`; all three plans | working-tree | Consolidated worktree |
| 2026-07-22 | `CPH-DOC-PLAN` | VERIFY | Final privacy/count audit | Sensitive ordinary filters are disclosed and every atomic ID remains unique | PASS: 195 rows, 195 unique IDs, matching milestone count/link, clean diff check | this file; `MILESTONES.md` | working-tree | Supersedes the prior 194-row count after adding the privacy-disclosure ID |
| 2026-07-22 | `CPH-DOC-PLAN` | VERIFY | Reconcile accepted M33 label-state correction | M34 owns cursor behavior without redefining lifecycle state | PASS: label adoption preserves M33's client-side `retiredAt` predicate, independent `archivedAt`, `includeArchived: false`, and last-examined edge cursor; count remains 195 | this file; M33 plan | working-tree | No duplicate state ownership added |
| 2026-07-22 | `CPH-DOC-MILESTONE` | VERIFY | Recheck integrated M34/M33 milestone wording | Shared pagination and label-state contracts agree | PASS | `MILESTONES.md`; M33/M34 plans | working-tree | Planning only |
| 2026-07-23 | `CPH-DOC-PLAN` | VERIFY | Apply accepted AR-002 limit and usage-exit correction | Baseline spelling/defaults and existing bounds remain distinct from new strict parsing, project maximum, and exit 2 behavior | PASS: 203 atomic rows, 203 unique IDs; per-command limit/usage IDs added; R6.1/R9.3 major-release classification explicit | this file; `MILESTONES.md`; existing issue/project list sources; `src/index.ts` | working-tree | No production source changed |
| 2026-07-23 | `CPH-DOC-PLAN` | IMPLEMENT | Apply accepted AR-003 owner/adopter split and ConceptM live guard | M34 owns reusable core plus existing issue/project migrations only | Downstream label/comment IDs removed; exact one-way maps published in M33/M35; ConceptM-only fixture policy added; 201 atomic IDs | all three plans; `MILESTONES.md` | working-tree | Planning only; final structural verification follows |
| 2026-07-23 | `CPH-DOC-PLAN` | VERIFY | Atomic-ID, dependency, table/fence/heading, whitespace, and scoped-status audit | 201 unique M34 IDs and valid one-way downstream maps | PASS: 201 unique atomic IDs; 60 M33 and 72 M35 dependency rows reference known local/upstream IDs; ConceptM policy present; Markdown and diff checks clean | all three plans; `MILESTONES.md` | working-tree | No production source changed |
| 2026-07-24 | `CPH-DOC-PLAN` | IMPLEMENT | Reconcile M34 against current source and CLI Standard v1.4.14 before production work | Every affected result option, existing short option, ordering rule, interactive path, and crashed-lock behavior has an independent audit ID | 13 rows added: canonical output/JSON and format removal for issue/project, project lead preservation, two JSON adoption rules, interactive adoption, two provider orders, and stale-lock recovery; total 214 | this file; `MILESTONES.md`; current issue/project list sources | working-tree | Corrects the false project `-l/--limit` baseline and closes R4/R3/lock-policy plan gaps |


| 2026-07-24 | `CPH-TST-WALKER` | RED/GREEN/VERIFY | `npx vitest run src/lib/pagination.test.ts` | Bounded/filter/all traversal, guards, adapter request cap | PASS: 31 tests | `src/lib/pagination.ts`; test | working-tree | Project cap added after live complexity RED |
| 2026-07-24 | `CPH-TST-HISTORY-STORE` | RED/GREEN/VERIFY | focused history, XDG, shell, concurrency, and built offline suites | Secure atomic local lifecycle | PASS, including six synchronized writers and offline built CLI | history modules/tests; offline script | working-tree | Secret-bearing flags/fields rejected centrally |
| 2026-07-24 | `CPH-TST-ISSUE-ADOPTION` | RED/GREEN/VERIFY | issue command and API focused suites plus built probes | Canonical output, raw resume, envelope, history, usage exits | PASS: 19 command and 15 API tests | issue command/API/tests | working-tree | Legacy format gives exact migration guidance |
| 2026-07-24 | `CPH-TST-PROJECT-ADOPTION` | RED/GREEN/VERIFY | project command/API suites plus built and live probes | Symmetric adoption with preserved lead short flag | PASS: 12 command and 4 API tests | project command/API/tests | working-tree | Invalid limit exit corrected from 1 to 2 |
| 2026-07-24 | `CPH-TST-LIVE` | VERIFY | `node tests/scripts/test-pagination-live.js` | Fail closed to ConceptM; page one to two to all remaining | PASS: issue 70 remaining; project 91 remaining; remoteWrites 0 | live harness | working-tree | First project attempt RED at complexity 18,200; internal cap 50 passed |
| 2026-07-24 | `CPH-VER-UNIT` | VERIFY | `npx vitest run --maxWorkers=4` | Full suite on CI-equivalent worker count | PASS: 822 passed, 1 intentional worker skip | all tests | working-tree | Unbounded local run had three load timeouts; each passed alone |
| 2026-07-24 | `CPH-VER-TRACE` | VERIFY | `npx vitest run src/lib/m34-traceability.test.ts` | Exactly 214 complete rows and valid one-way maps | PASS: 214 unique, zero missing or unknown prerequisites | trace report; M33/M34/M35 plans | working-tree | Per-ID evidence report is authoritative |

## 13. Out of scope

- Custom, signed, encoded, versioned, or context-bound a2l cursor tokens.
- Numeric pages, direct page-N jumps, backward pagination, or public page-size tuning.
- Using history IDs as remote continuation values.
- Automatic context mismatch enforcement or silent page-one restart.
- Caching remote list records or offline replay of list results.
- Syncing cursor history between machines or sending it to Linear/telemetry.
- Unbounded history, configurable retention, history import/export, or search indexing.
- Version bump, release, publish, push, PR creation, or merge without separate authorization.

## 14. Completion definition

M34 is complete only when:

1. every M34 atomic row has complete I/T/V evidence;
2. shared parser, walker, cursor, page-result, command-builder, and history contracts pass;
3. the synthetic adopter proves the public contract without importing M33/M35 resource modules;
4. issue-list and project-list adoption independently pass every command option and interaction;
5. page-one output gives humans copyable page-two and all-remaining commands;
6. emitted raw cursors become the next GraphQL `after` byte-for-byte;
7. filtered mid-page continuation neither skips nor duplicates matching records;
8. history path, privacy, permissions, retention, atomicity, locking, and clearing pass;
9. issue/project envelopes, errors, streams, and fail-closed ConceptM live traversal pass;
10. the dependency map references only known M33/M35 adopter IDs and known M34 prerequisites;
11. traceability finds no duplicate semantic owner, missing evidence, or completed dependent with an
    incomplete prerequisite; and
12. the R10.2/R10.3 waiver and every R9.3 breaking change remain explicit.

M33 and M35 may begin nonpagination work independently. Their pagination adoption cannot close until
its exact M34 prerequisites pass, but their completion is not a prerequisite for M34.
