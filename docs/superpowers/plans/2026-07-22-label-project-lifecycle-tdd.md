# Label Lifecycle and Project Trash — ID-Level TDD Project Plan

> **Plan status:** Published under M33; implementation has not started.
>
> **Milestone:** M33 — Label Lifecycle, Pagination, and Project Trash (breaking-release companion).
>
> **Implementation rule:** Work only in a dedicated feature worktree. Do not implement from the
> main checkout. Every interface or behavior ID below must complete its own RED → GREEN → VERIFY
> lifecycle before it can be marked done.

**Goal:** Complete issue-label and project-label lifecycle support, fix known label correctness
defects, and add reversible project trash/untrash behavior without replacing the established
`issue-labels` and `project-labels` command families.

**Architecture:** Preserve the existing command groups and compatibility facade. Extract touched
Commander actions into testable `run*` functions, keep remote operations in `src/lib/api/labels.ts`
and `src/lib/api/projects.ts`, and route them through `src/lib/linear-client.ts`. Introduce one shared
TTY-aware destructive-confirmation primitive integrated with the existing workspace mutation guard.
Adopt M34's shared raw-cursor/page-history primitive rather than building label-local pagination.
Use the pinned SDK methods for label retire/restore mutations, but raw GraphQL selections for
`retiredAt` and `archivedAt` because SDK 61's high-level label fragments omit `retiredAt`.

**Tech stack:** TypeScript ESM, Commander, `@linear/sdk`, Vitest, shell integration tests, tsup,
TypeScript, ESLint.

**CLI standard:** Publishable tier, standard noun-verb profile, pinned to CLI Design Standard
**v1.4.14**. Applicable axes: configurable, networked, destructive operations, scripted consumers,
and secrets. N/A for this project: long-running/async operations, streaming output, and plugins.
M34 owns the new XDG cursor-history state; M33 only supplies label query context to it.

---

## 1. Planning decisions and proposed enhancements

### 1.1 Preserve the accepted command architecture

- Keep `issue-labels`/`ilbl` and `project-labels`/`plbl` as the functional command families.
- Add `retire` and `restore` to both label families.
- Add project lifecycle state through `project update --trash|--untrash`.
- Do not add `label`, `label issue`, `label project`, `project delete`, `project trash`,
  `project restore`, or `project archive`.
- Keep the nonfunctional `labels|lbl list|ls` route temporarily as a help/deprecation shim; do not
  repurpose it as a third CRUD implementation.

### 1.2 Enhancement: use real TDD ordering

The requested tracking dimensions remain **Implement / Test / Verify**, but implementation work is
executed in true TDD order:

1. **RED:** write or activate the smallest test for one ID and prove that it fails for the expected
   reason.
2. **IMPLEMENT:** make the smallest production change needed for that ID.
3. **GREEN:** rerun the targeted test and prove that it passes.
4. **VERIFY:** run the ID's independent CLI/contract verification and the applicable aggregate gate.

A literal Implement → Test → Verify order would be test-after development, not TDD. The ledger keeps
the three requested status columns while requiring recorded RED evidence before `I=DONE`.

### 1.3 Enhancement: semantic IDs instead of release-number IDs

IDs use the stable `LPL-*` prefix (Label and Project Lifecycle), not the assigned milestone number.
This plan remains project M33 while joining the coordinated M33–M35 major-release train. `v1.0.0`
is recommended because M34 changes existing list JSON and M33 corrects existing `--all` scope.
Its semantic IDs remain stable if release scheduling changes.

### 1.4 Enhancement: status is computed from evidence

No item has a manually asserted overall “done” flag. It is complete only when:

- `I=DONE` — production implementation or intentional baseline retention is recorded;
- `T=GREEN` — a targeted automated test passes and a prior RED result is linked for changed behavior;
- `V=PASS` — independent verification passes and its command/output is recorded.

Baseline-only compatibility entries use `I=BASELINE`; they still require `T=GREEN` and `V=PASS`.

### 1.5 Enhancement: unit verification and live verification are separate

Remote lifecycle tests must not depend solely on a real Linear workspace. Each changed behavior gets
deterministic Vitest coverage. A smaller live suite proves SDK/API compatibility using fixtures it
creates itself. Live tests must record cleanup IDs and remain opt-in outside the live workflow.

### 1.6 Enhancement: scope firewall

The following known CLI-standard migrations remain separate projects:

- plural canonical nouns (`issue-labels`, `project-labels`) versus R1.3;
- repository-wide migration of legacy list commands from `-f/--format` to `-o/--output` (R3.4,
  R4.2). M33 does not migrate the two existing label lists or remove their TSV mode;
- repository-wide exit-code and machine-error-schema migration;
- repository-wide migration from a2l's existing pagination `--all` spelling to the CLI Standard's
  `--paginate` spelling (R10.2, R10.3).

Every result-bearing mutation changed by M33 does use the publishable-tier output contract:
`-o, --output <table|json>` defaults to `table`, and `--json` is its exact `--output json`
convenience equivalent. This project records the retained list deviation without making the wider
legacy-list migration part of M33.

### 1.7 Accepted AR-001: command-specific output tracking

The affected result commands are exactly `issue-labels create|update|delete|retire|restore`,
`project-labels create|update|delete|retire|restore`, and `project update`. Each of these eleven
commands has its own `LPL-OPT-*-OUTPUT` ID and its own `LPL-RULE-*-OUTPUT` interaction ID. For every
command, `--json --output json` is accepted as one mode, while `--json --output table` is a usage
error with exit 2 before any mutation. The two label-list commands retain their separately tracked
`-f/--format default|json|tsv` baseline and are not part of AR-001.

### 1.8 Accepted AR-004 correction: retirement and archival are independent

M33 supports both nullable timestamps without treating them as synonyms:

- `retiredAt` is the canonical label-lifecycle state. `retire` must set it, `restore` must clear it,
  default lists must exclude records where it is non-null, and `--include-retired` removes only
  that client-side predicate.
- `archivedAt` is preserved independently in models and output. Label reads keep
  `includeArchived: false`; M33 adds neither `--include-archived` nor label archive/unarchive
  commands because no such label mutation contract has been established.
- Raw GraphQL must select both fields for lists, views, and post-mutation verification. A label may
  carry neither, either, or both timestamps; code and output must never infer one from the other.
- Linear exposes no `retiredAt` label filter, so active-only filtering is client-side and must use
  the last examined edge cursor to avoid skipping records.

Evidence for this correction:

- `package-lock.json` resolves exactly `@linear/sdk` 61.0.0; the shipped declarations and runtime
  expose all four issue/project label retire/restore methods, so method availability is not blocked.
- SDK 61's raw generated schema type contains both `retiredAt` and `archivedAt`, while its high-level
  label fragment/model omits `retiredAt`; both generated label filter types omit a retirement
  predicate.
- A 2026-07-22 read-only live probe returned one issue label with non-null `retiredAt` and null
  `archivedAt` under default, `includeArchived: false`, and `includeArchived: true` queries. Each
  variant returned the same 44 records and the same single retired record. No mutation or identity
  disclosure occurred. Therefore `includeArchived` is observably not an `includeRetired` switch.

### 1.9 Accepted AR-003: one pagination owner and explicit adopters

M34 is the sole implementation and TDD owner of reusable pagination parsing, validation, walking,
raw-cursor fidelity, history storage, reusable output fields, and the existing `issue list` and
`project list` migrations. M33 owns only the issue-label/project-label command wiring, label
filter adapter, label-specific result envelopes, help, and live adoption proof.

Each M33 adopter row names exact upstream `CPH-*` prerequisites. Its `V=PASS` is prohibited
until those prerequisites are `V=PASS`; M34 never waits on an M33 row. Shared full-repository gates
may be rerun in both milestones, but one public behavior or primitive may not have two independent
Implement/Test/Verify owners. M34 alone records the CLI Standard R10.2/R10.3 `--all` waiver; M33
cites that decision rather than republishing a second waiver.

### 1.10 Live verification workspace: ConceptM only

Every M33 live test and verification must target the ConceptM Linear account/workspace exclusively.
The harness resolves through the normal repository profile, asserts the resolved workspace identity
is ConceptM before any write, and fails closed on a missing or mismatched identity. Live tests may
mutate only uniquely named fixtures they create themselves, must record every fixture ID, and must
record successful cleanup. No M33 live probe may write to another Linear account or workspace.

### 1.11 Accepted AR-005: project-label catalog scope

`project-labels list` operates over every project-label definition in the current workspace, whether
the label is currently applied to a project or unused. Applied-versus-unused state is not a hidden
scope boundary and `--all` must not switch query endpoints or change catalog membership. The default
invocation returns the first 50 matching active definitions from that same catalog; `--all` only
exhausts its cursor pages, while `--include-retired` alone broadens retirement scope.

Implementation uses one raw top-level `projectLabels` connection for bounded and exhaustive reads.
It must not use `lastAppliedAt` as evidence of current usage: that timestamp records historical
application and can remain non-null after every association is removed. M33 adds no
`--include-unused` or usage-filter option. A future usage filter, if justified, must define current
association semantics explicitly and receive its own interface/TDD project.

Evidence for this decision:

- SDK 61 documents top-level `projectLabels()` as “All project labels”; both it and
  `organization.projectLabels()` accept the same filter, cursor, ordering, and `includeArchived`
  variables and return the same connection shape.
- The current alternate organization query is selected only by a speculative implementation comment
  that the SDK path “may” omit unused labels; no installed SDK/schema contract supports that split.
- Current `--all` help claims archived inclusion, but its alternate query never passes
  `includeArchived: true`. M33 withdraws that unsupported promise and continues to pass
  `includeArchived: false` deliberately.
- Implementation-time live characterization must use a fail-closed ConceptM fixture with one applied
  label and one never-applied label, prove both occur in the base catalog, and record cleanup.

---

## 2. Tracking methodology

### 2.1 Status vocabulary

| Column | Allowed values                                   | Meaning                        |
| ------ | ------------------------------------------------ | ------------------------------ |
| `I`    | `NS`, `IP`, `DONE`, `BASELINE`, `BLOCKED`, `N/A` | Implementation state           |
| `T`    | `NS`, `RED`, `GREEN`, `BLOCKED`, `N/A`           | Targeted automated-test state  |
| `V`    | `NS`, `PASS`, `FAIL`, `BLOCKED`, `N/A`           | Independent verification state |

At plan publication, existing interface elements are `I=BASELINE`; new or corrected behavior is
`I=NS`. All test and verification states begin `NS`.

### 2.2 ID families

| Prefix       | Tracks                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| `LPL-CMD-*`  | Command/group registration and routing                                             |
| `LPL-ALS-*`  | Built-in command aliases and compatibility routes                                  |
| `LPL-ARG-*`  | Positional argument contracts and resolution                                       |
| `LPL-OPT-*`  | One CLI option, including spelling, type, default, interaction, and output effect  |
| `LPL-RULE-*` | One cross-option or lifecycle interaction, independently testable from its options |
| `LPL-API-*`  | Domain types, SDK wrappers, pagination, and facade exports                         |
| `LPL-SAF-*`  | Confirmation, TTY, workspace targeting, dry-run, and noninteractive safety         |
| `LPL-OUT-*`  | stdout/stderr, human output, JSON, and error contracts                             |
| `LPL-DOC-*`  | User, contributor, milestone, and conformance documentation                        |
| `LPL-TST-*`  | Cross-item test harnesses and live fixture workflows                               |
| `LPL-VER-*`  | Aggregate verification gates                                                       |

### 2.3 Required evidence for every ID

Each state transition must append one evidence-log row containing:

- ID and phase (`RED`, `IMPLEMENT`, `GREEN`, or `VERIFY`);
- exact test name or command;
- expected result and observed result;
- source/test file path;
- commit SHA when committed, otherwise `working-tree`;
- blocker link or explanation when blocked.

### 2.4 Atomicity rule

- One ledger ID may depend on another, but it may not silently implement another ID.
- Every reusable behavior has one Implement/Test/Verify owner; adopter rows test only their own
  command wiring, mapping, filtering, and presentation.
- Every M33 adopter dependency names exact upstream `CPH-*` IDs. An adopter cannot reach `V=PASS`
  until every named prerequisite is `V=PASS`, while M34 completion never depends on M33.
- If one code change satisfies multiple IDs, every affected row receives its own evidence entry.
- A test may cover multiple IDs only when each assertion is labeled with those IDs in its test name
  or a nearby traceability comment.
- No command-level parent is complete while any child argument or option remains incomplete.
- No phase may be marked verified based only on the same mock used by its unit test.

### 2.5 Per-ID TDD runbook

1. Set `T=RED`; add a test named with the ID and capture the expected failure.
2. Set `I=IP`; implement only that contract.
3. Set `I=DONE`; rerun the targeted test.
4. Set `T=GREEN` only after the targeted test passes.
5. Run the listed CLI/stream/API verification from a built artifact.
6. Set `V=PASS`; append evidence.
7. Recompute parent command and phase status from their children.

---

## 3. Pagination design

### 3.1 Existing a2l pagination precedent

| Surface               | Public options/default                                                | Data-layer behavior                                                                                                                                         | Finding                                                                                                          |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `issue list`          | `-l, --limit <number>`; default 50; accepted range 1–250; `-a, --all` | Cursor loop over `pageInfo`; bounded calls use `limit`, `--all` uses page size 250 until exhaustion                                                         | Strongest validated convention; live tests cover default, limits, errors, and `--all`                            |
| `project list`        | `--limit <number>`; default 50; help says max 250; `--all`            | Same cursor-loop shape as issues                                                                                                                            | Long names/default match issues, but the command does not currently reject values over 250 despite its help text |
| `issue-labels list`   | No explicit pagination options                                        | Raw connection query omits `pageInfo`; Linear's default page is effectively the implicit bound                                                              | Pagination is currently accidental and cannot report truncation                                                  |
| `project-labels list` | `-a, --all` claims “including archived”                               | Both normal and `--all` paths omit cursor handling; neither path selects `retiredAt`, and live evidence shows `includeArchived` does not control retirement | Existing flag is functionally incorrect and mixes lifecycle scope with collection pagination                     |

Relevant implementation references:

- `src/commands/issue/list.ts` and `src/lib/api/issues.ts`
- `src/commands/project/list.tsx` and `src/lib/api/projects.ts`
- `tests/scripts/test-issue-list.sh`
- `src/commands/issue-labels/list.tsx`, `src/commands/project-labels/list.tsx`, and
  `src/lib/api/labels.ts`

### 3.2 Selected label-list contract

The two label families receive one identical pagination contract. Long option names and semantics
follow the existing issue/project implementations; short aliases are added only where both label
families can remain identical.

| Option/default            | Selected behavior                                                                                                                                            | Compatibility rationale                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No pagination option      | Return at most 50 active labels after server-side team/workspace filters and client-side `retiredAt == null`; request `includeArchived: false` independently | **Lifecycle correctness change:** current queries do not select/filter `retiredAt`, so a retired record can appear in the default page     |
| `--limit <number>`        | Long-only on both label families; integer 1–250; default 50                                                                                                  | Both issue and project lists expose the long spelling; their short `-l` usage is inconsistent, so label lists do not add a new short alias |
| `--after <cursor>`        | Resume with the exact nonempty raw Linear cursor emitted by the preceding invocation                                                                         | M34 gives issue/project/label/comment lists the same human page-two contract                                                               |
| `-a, --all`               | Fetch all remaining cursor pages from the beginning or after `--after`; never changes lifecycle scope                                                        | Pagination semantics match existing a2l lists while keeping the cursor's query scope stable                                                |
| `--include-retired`       | Include active and retired labels by removing only the `retiredAt == null` client predicate                                                                  | This is the sole retired-label scope switch; it never changes `includeArchived`                                                            |
| `--no-cursor-history`     | Emit the cursor and commands but skip the M34 local history write for this invocation                                                                        | Explicit privacy/state opt-out without changing remote results                                                                             |
| `--all --limit N`         | `--all` wins, matching current issue/project behavior; emit a debug-level diagnostic that the bound is ignored                                               | Avoids inventing a label-only mutual-exclusion rule                                                                                        |
| `--after C --all`         | Fetch all remaining labels after C with the same filters and lifecycle scope                                                                                 | Enables resumable exhaustive traversal                                                                                                     |
| `--all --include-retired` | Exhaust active and retired labels                                                                                                                            | Pagination and lifecycle options compose without hidden implication                                                                        |

There is deliberately no `--include-archived` option in M33. All list queries pass
`includeArchived: false`; direct views and result models still preserve `archivedAt` when Linear
returns it. JSON emits distinct nullable ISO-8601 `retiredAt` and `archivedAt` keys, TSV emits
separate columns, and human output must distinguish the two states rather than collapse them into a
single “archived” marker.

No label-only `--page-size`, `--paginate`, or `--no-paginate` flags are introduced. Adding them only
to label lists would conflict with established a2l help and scripts. The retained `--all` spelling is
a known deviation from CLI Standard v1.4.14 R10.2/R10.3, which reserves `--all` for scope and names
all-page traversal `--paginate`. Full conformance requires a separate repository-wide migration;
this plan must record the deviation rather than silently claiming compliance.

M34 records the retained deviation from CLI Standard v1.4.14 R10.2/R10.3, which reserves `--all`
for scope and names all-page traversal `--paginate`. M33 must not add another spelling or implement a
label-local cursor/history module.

### 3.3 Explicit behavior-change register

| Surface                     | Current observable behavior                                                                                                             | Planned behavior                                                                                                                                                                            | Classification                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Default issue-label list    | First API page with no `retiredAt` selection/filter; retired labels may appear                                                          | Explicit limit 50 after `retiredAt == null`, JSON page envelope, human next command/history when more exist                                                                                 | Intentional lifecycle correction plus new continuation output                             |
| Default project-label list  | First SDK page with no `retiredAt` selection/filter; retired labels may appear                                                          | Explicit limit 50 after `retiredAt == null`, JSON page envelope, human next command/history when more exist                                                                                 | Intentional lifecycle correction plus new continuation output                             |
| `project-labels list --all` | Switches to a one-page organization query based on an unproven unused-label distinction and claims archived scope without requesting it | Use one top-level project-label catalog connection; applied and unused definitions are always in scope; `--all` exhausts pages only and `--include-retired` alone broadens retirement scope | Accepted AR-005 collection correction and intentional major-release flag-semantics change |
| `issue-labels list --all`   | Command does not exist                                                                                                                  | Fetches every active issue label; compose with `--include-retired`                                                                                                                          | New option                                                                                |
| `--after`                   | Unsupported                                                                                                                             | Resume after the exact raw Linear cursor while preserving query scope/order                                                                                                                 | New M34 capability                                                                        |
| `--color` with a bound      | Filters only the labels present in the fetched first page                                                                               | Continues cursor traversal until it finds `limit` matching labels or exhausts the connection                                                                                                | Correctness/performance change; may make additional API calls                             |
| Sorting                     | Sorts the fetched page by name                                                                                                          | Declare a Linear-supported provider order and preserve it across pages; do not per-page name-sort a resumable connection                                                                    | Cursor correctness change; avoids globally inconsistent concatenated pages                |
| Label JSON                  | Bare label array                                                                                                                        | `{labels,pageInfo,cursorHistory}` envelope                                                                                                                                                  | Intentional major-release break owned by M34                                              |

The old `project-labels --all` help promise is not retained because it combines an unproven
applied-versus-unused split, an unsupported archived-label claim, and pagination. There is no
replacement flag for unused labels: they are part of the base project-label catalog. Use `--all` to
exhaust that catalog and add `--include-retired` only when retired definitions are required. Archived
labels remain excluded because every query passes `includeArchived: false`.

### 3.4 Cursor and filtering algorithm

Both label families must use the same tested pagination primitive or byte-equivalent shared helper:

1. Validate `limit` as an integer in `[1, 250]` before any API call.
2. Push team/workspace filters into GraphQL, pass `includeArchived: false`, and select both
   `retiredAt` and `archivedAt`; do not map `includeRetired` to `includeArchived`.
3. Apply `retiredAt == null` client-side unless `--include-retired` is set. Request
   `edges { cursor node { ... } }` plus `pageInfo { hasNextPage endCursor }` because that predicate
   may stop within a backend page.
4. Pass the caller's raw `--after` unchanged into the first M34 request.
5. Apply unavoidable client predicates before counting matches and track the last examined edge.
6. In bounded mode, emit the cursor of the last examined edge; never jump to a backend page-end
   cursor past unexamined nodes.
7. In `--all` mode, continue sequentially until exhaustion; deduplicate IDs without reordering.
8. Fail safely on missing/repeated continuation cursors and never emit partial JSON.
9. Preserve the declared Linear provider order across every page; do not sort pages independently.
10. Return the M34 `{items,pageInfo,cursorHistory}` result plus normalized label query context.

When more matching results exist, human mode prints copyable next-page and all-remaining commands on
stdout plus the M34 history entry ID. JSON exposes `pageInfo.endCursor`; TSV remains row-only and may
receive a stderr diagnostic directing machine callers to JSON or `cursor-history`.

### 3.5 Pagination TDD invariants

- The first test for each label family proves the current implementation fails to cross page 1.
- A two-page fixture must prove cursor propagation and no duplicate records.
- `--limit 1`, `--limit 50`, and `--limit 250` pass; `0`, negative, nonnumeric, fractional, and `251`
  fail before an API call.
- Default mode may scan additional backend pages to return 50 active labels; the cursor always
  identifies the last examined edge and `hasMore` describes remaining matching results.
- `--after` is passed unchanged and page two begins strictly after it.
- `--all` follows every cursor without changing retired-label scope.
- Project-label bounded and `--all` modes use the same catalog connection and include both applied and
  unused definitions; traversal never switches to `organization.projectLabels`.
- `lastAppliedAt` is never used to infer current association or to include/exclude a catalog record.
- `--after C --all` exhausts only the remaining results.
- `--include-retired --limit N` remains bounded.
- `--include-retired --after C` preserves the same lifecycle scope as the cursor's source command.
- `--include-retired` never changes `includeArchived: false`; rejected `--include-archived` input
  fails before any API call.
- `retiredAt` and `archivedAt` survive mapping and serialization independently, including fixtures
  where both are null, either is non-null, or both are non-null; create/update output never invents
  lifecycle values, and update mutations use the raw lifecycle-aware post-read before rendering.
- A repeated or missing cursor under `hasNextPage=true` fails deterministically.
- Color filtering fills the requested result count across pages and resumes from the last examined
  edge without skipped/duplicated matches.
- Table, JSON, and TSV contain the same selected IDs in provider order.
- `--no-cursor-history` emits the same remote result/cursor and creates no history entry.

### 3.6 Manual page navigation decision

Linear connections are cursor-based, not page-number-based. M34 exposes the raw continuation cursor
consistently across issue, project, label, and comment lists.

| User intent                     | Supported in this proposal? | Behavior                                                                                                         |
| ------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Get the default result set      | Yes                         | Run `issue-labels list` or `project-labels list`; receive at most 50 matching active labels                      |
| Get a larger bounded result set | Yes                         | Run with `--limit N`, where `N` is 1–250; the CLI may traverse internal API pages to satisfy post-filter matches |
| Get every result                | Yes                         | Run with `--all`; add `--include-retired` when lifecycle scope requires it                                       |
| Get the next page               | **Yes**                     | Copy the generated `--after '<raw-cursor>'` command                                                              |
| Get page two                    | **Yes, sequentially**       | Run page one and pass its `endCursor` to `--after`                                                               |
| Jump directly to page N         | **No**                      | Linear exposes cursor chains, not stable numeric offsets                                                         |
| Inspect cursor origin           | **Yes**                     | Use the printed history ID or `cursor-history list --cursor '<raw-cursor>'`                                      |

History is advisory. Changing filters, scope, workspace, or ordering before reusing a raw cursor is
the caller's responsibility; M34 records the source context but does not enforce it.

---

## 4. Interface contract ledger

### 4.1 Issue-label command family

| ID                             | Interface element                                 | Contract                                                                                                             | I        | T     | V    |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ---- |
| LPL-CMD-IL-GROUP               | `issue-labels`                                    | Established issue-label command group remains canonical in this release                                              | BASELINE | GREEN | PASS |
| LPL-ALS-IL-GROUP               | `ilbl`                                            | Exact alias of `issue-labels` for every child command                                                                | BASELINE | GREEN | PASS |
| LPL-CMD-IL-LIST                | `issue-labels list`                               | List issue labels; explicit Linear `createdAt` provider order; no mutation                                           | BASELINE | GREEN | PASS |
| LPL-ALS-IL-LIST                | `issue-labels ls`                                 | Exact alias of `list`                                                                                                | BASELINE | GREEN | PASS |
| LPL-OPT-IL-LIST-TEAM           | `-t, --team <id>`                                 | Filter by team ID, name, or alias                                                                                    | BASELINE | GREEN | PASS |
| LPL-OPT-IL-LIST-WORKSPACE      | `-w, --workspace`                                 | Return only workspace-level labels; exclude every team label                                                         | DONE     | GREEN | PASS |
| LPL-OPT-IL-LIST-COLOR          | `--color <hex>`                                   | Filter by normalized label color                                                                                     | BASELINE | GREEN | PASS |
| LPL-OPT-IL-LIST-FORMAT         | `-f, --format <type>`                             | Preserve current `default\|json\|tsv` behavior; tracked CLI-standard deviation                                       | BASELINE | GREEN | PASS |
| LPL-OPT-IL-LIST-LIMIT          | `--limit <number>`                                | Expose the M34-backed bound with default 50                                                                          | DONE     | GREEN | PASS |
| LPL-RULE-IL-LIMIT-PARSE        | `issue-labels list --limit VALUE`                 | Accept decimal integers only; reject nonnumeric and fractional values before API access                              | DONE     | GREEN | PASS |
| LPL-RULE-IL-LIMIT-MIN          | `issue-labels list --limit 0`                     | Reject values below 1 with usage exit 2 before API access                                                            | DONE     | GREEN | PASS |
| LPL-RULE-IL-LIMIT-MAX          | `issue-labels list --limit 251`                   | Reject values above 250 with usage exit 2 before API access                                                          | DONE     | GREEN | PASS |
| LPL-RULE-IL-AFTER-LIMIT        | `issue-labels list --after C --limit N`           | Return the next N matching issue labels after C                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-AFTER-ALL          | `issue-labels list --after C --all`               | Fetch every remaining matching issue label after C                                                                   | DONE     | GREEN | PASS |
| LPL-RULE-IL-ALL-LIMIT          | `issue-labels list --all --limit N`               | `--all` wins; internal requests use up to 250                                                                        | DONE     | GREEN | PASS |
| LPL-RULE-IL-NOHISTORY-AFTER    | `issue-labels list --after C --no-cursor-history` | Resume without recording a new cursor                                                                                | DONE     | GREEN | PASS |
| LPL-RULE-IL-NOHISTORY-ALL      | `issue-labels list --all --no-cursor-history`     | Exhaust without recording a history entry                                                                            | DONE     | GREEN | PASS |
| LPL-RULE-IL-TERMINATOR         | `issue-labels list --`                            | End option parsing under the CLI Standard R3.1 contract                                                              | BASELINE | GREEN | PASS |
| LPL-OPT-IL-LIST-AFTER          | `--after <cursor>`                                | Resume after exact nonempty raw Linear cursor through M34                                                            | DONE     | GREEN | PASS |
| LPL-OPT-IL-LIST-INCLUDERETIRED | `--include-retired`                               | Remove only the client-side `retiredAt == null` predicate while retaining the bound; never changes `includeArchived` | DONE     | GREEN | PASS |
| LPL-OPT-IL-LIST-ALL            | `-a, --all`                                       | Fetch all remaining pages without changing retired scope; overrides `--limit`                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-LIST-NOHISTORY      | `--no-cursor-history`                             | Skip M34 local history write without changing remote output                                                          | DONE     | GREEN | PASS |
| LPL-CMD-IL-VIEW                | `issue-labels view <id>`                          | View one active or retired issue label                                                                               | BASELINE | GREEN | PASS |
| LPL-ARG-IL-VIEW-ID             | `<id>`                                            | Accept label UUID or configured issue-label alias                                                                    | BASELINE | GREEN | PASS |
| LPL-CMD-IL-CREATE              | `issue-labels create`                             | Create a workspace- or team-scoped issue label                                                                       | BASELINE | GREEN | PASS |
| LPL-OPT-IL-CREATE-NAME         | `-n, --name <name>`                               | Required nonblank label name                                                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-IL-CREATE-COLOR        | `-c, --color <hex>`                               | Valid HEX color; default `#5E6AD2`                                                                                   | BASELINE | GREEN | PASS |
| LPL-OPT-IL-CREATE-DESCRIPTION  | `-d, --description <text>`                        | Optional description; empty string allowed                                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-IL-CREATE-TEAM         | `-t, --team <id>`                                 | Optional team identity; omission creates a workspace label                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-IL-CREATE-DRYRUN       | `--dry-run`                                       | Validate and resolve, print plan, perform no mutation                                                                | DONE     | GREEN | PASS |
| LPL-OPT-IL-CREATE-OUTPUT       | `-o, --output <table\|json>`                      | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-CREATE-JSON         | `--json`                                          | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-CREATE-OUTPUT      | `--json` with `--output`                          | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-IL-CREATE-YES          | `-y, --yes`                                       | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-IL-CREATE-NOINPUT      | `--no-input`                                      | Never prompt; fail with usage error if required input is absent                                                      | DONE     | GREEN | PASS |
| LPL-CMD-IL-UPDATE              | `issue-labels update <id>`                        | Update one issue label                                                                                               | BASELINE | GREEN | PASS |
| LPL-ARG-IL-UPDATE-ID           | `<id>`                                            | Accept label UUID or issue-label alias                                                                               | BASELINE | GREEN | PASS |
| LPL-OPT-IL-UPDATE-NAME         | `--name <name>`                                   | Replace label name with nonblank input                                                                               | BASELINE | GREEN | PASS |
| LPL-OPT-IL-UPDATE-COLOR        | `--color <hex>`                                   | Replace label color after validation                                                                                 | BASELINE | GREEN | PASS |
| LPL-OPT-IL-UPDATE-DESCRIPTION  | `--description <text>`                            | Replace description; `--description ""` clears it                                                                    | DONE     | GREEN | PASS |
| LPL-OPT-IL-UPDATE-DRYRUN       | `--dry-run`                                       | Validate and resolve, print plan, perform no mutation                                                                | DONE     | GREEN | PASS |
| LPL-OPT-IL-UPDATE-OUTPUT       | `-o, --output <table\|json>`                      | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-UPDATE-JSON         | `--json`                                          | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-UPDATE-OUTPUT      | `--json` with `--output`                          | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-IL-UPDATE-YES          | `-y, --yes`                                       | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-IL-UPDATE-NOINPUT      | `--no-input`                                      | Never prompt; fail if confirmation/input is required                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-IL-DELETE              | `issue-labels delete <id>`                        | Permanently delete one issue label after confirmation                                                                | BASELINE | GREEN | PASS |
| LPL-ARG-IL-DELETE-ID           | `<id>`                                            | Accept label UUID or issue-label alias                                                                               | BASELINE | GREEN | PASS |
| LPL-OPT-IL-DELETE-YES          | `-y, --yes`                                       | Supply destructive consent and workspace confirmation consent                                                        | BASELINE | GREEN | PASS |
| LPL-OPT-IL-DELETE-DRYRUN       | `--dry-run`                                       | Preview deletion and perform no mutation                                                                             | DONE     | GREEN | PASS |
| LPL-OPT-IL-DELETE-OUTPUT       | `-o, --output <table\|json>`                      | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-DELETE-JSON         | `--json`                                          | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-DELETE-OUTPUT      | `--json` with `--output`                          | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-IL-DELETE-NOINPUT      | `--no-input`                                      | Never prompt; require `--yes` when consent is needed                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-IL-RETIRE              | `issue-labels retire <id>`                        | Reversibly retire one issue label                                                                                    | DONE     | GREEN | PASS |
| LPL-ARG-IL-RETIRE-ID           | `<id>`                                            | Accept active label UUID or issue-label alias                                                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-RETIRE-YES          | `-y, --yes`                                       | Supply retire and workspace confirmation consent                                                                     | DONE     | GREEN | PASS |
| LPL-OPT-IL-RETIRE-DRYRUN       | `--dry-run`                                       | Preview retirement and perform no mutation                                                                           | DONE     | GREEN | PASS |
| LPL-OPT-IL-RETIRE-OUTPUT       | `-o, --output <table\|json>`                      | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-RETIRE-JSON         | `--json`                                          | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-RETIRE-OUTPUT      | `--json` with `--output`                          | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-IL-RETIRE-NOINPUT      | `--no-input`                                      | Never prompt; require `--yes` when consent is needed                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-IL-RESTORE             | `issue-labels restore <id>`                       | Restore one retired issue label                                                                                      | DONE     | GREEN | PASS |
| LPL-ARG-IL-RESTORE-ID          | `<id>`                                            | Accept retired label UUID or retained issue-label alias                                                              | DONE     | GREEN | PASS |
| LPL-OPT-IL-RESTORE-DRYRUN      | `--dry-run`                                       | Preview restoration and perform no mutation                                                                          | DONE     | GREEN | PASS |
| LPL-OPT-IL-RESTORE-OUTPUT      | `-o, --output <table\|json>`                      | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-IL-RESTORE-JSON        | `--json`                                          | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-IL-RESTORE-OUTPUT     | `--json` with `--output`                          | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-IL-RESTORE-YES         | `-y, --yes`                                       | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-IL-RESTORE-NOINPUT     | `--no-input`                                      | Never prompt; fail if workspace confirmation is required                                                             | DONE     | GREEN | PASS |
| LPL-CMD-IL-SYNC                | `issue-labels sync-aliases`                       | Preserve issue-label alias synchronization behavior                                                                  | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-GLOBAL         | `-g, --global`                                    | Write aliases to global config                                                                                       | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-PROJECT        | `-p, --project`                                   | Write aliases to project config                                                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-DRYRUN         | `--dry-run`                                       | Preview aliases without writing                                                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-FORCE          | `-f, --force`                                     | Overwrite conflicting aliases; does not imply prompt consent                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-TEAM           | `-t, --team <id>`                                 | Restrict synchronization to one team                                                                                 | BASELINE | GREEN | PASS |
| LPL-OPT-IL-SYNC-NOAUTOSUFFIX   | `--no-auto-suffix`                                | Skip duplicates instead of numbering them                                                                            | BASELINE | GREEN | PASS |

### 4.2 Project-label command family

| ID                             | Interface element                                   | Contract                                                                                                             | I        | T     | V    |
| ------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ---- |
| LPL-CMD-PL-GROUP               | `project-labels`                                    | Established project-label command group remains canonical in this release                                            | BASELINE | GREEN | PASS |
| LPL-ALS-PL-GROUP               | `plbl`                                              | Exact alias of `project-labels` for every child command                                                              | BASELINE | GREEN | PASS |
| LPL-CMD-PL-LIST                | `project-labels list`                               | List project labels in explicit Linear `createdAt` provider order                                                    | BASELINE | GREEN | PASS |
| LPL-ALS-PL-LIST                | `project-labels ls`                                 | Exact alias of `list`                                                                                                | BASELINE | GREEN | PASS |
| LPL-OPT-PL-LIST-COLOR          | `--color <hex>`                                     | Filter by normalized label color                                                                                     | BASELINE | GREEN | PASS |
| LPL-OPT-PL-LIST-FORMAT         | `-f, --format <type>`                               | Preserve current `default\|json\|tsv` behavior; tracked CLI-standard deviation                                       | BASELINE | GREEN | PASS |
| LPL-OPT-PL-LIST-LIMIT          | `--limit <number>`                                  | Expose the M34-backed bound with default 50                                                                          | DONE     | GREEN | PASS |
| LPL-RULE-PL-LIMIT-PARSE        | `project-labels list --limit VALUE`                 | Accept decimal integers only; reject nonnumeric and fractional values before API access                              | DONE     | GREEN | PASS |
| LPL-RULE-PL-LIMIT-MIN          | `project-labels list --limit 0`                     | Reject values below 1 with usage exit 2 before API access                                                            | DONE     | GREEN | PASS |
| LPL-RULE-PL-LIMIT-MAX          | `project-labels list --limit 251`                   | Reject values above 250 with usage exit 2 before API access                                                          | DONE     | GREEN | PASS |
| LPL-RULE-PL-AFTER-LIMIT        | `project-labels list --after C --limit N`           | Return the next N matching project labels after C                                                                    | DONE     | GREEN | PASS |
| LPL-RULE-PL-AFTER-ALL          | `project-labels list --after C --all`               | Fetch every remaining matching project label after C                                                                 | DONE     | GREEN | PASS |
| LPL-RULE-PL-ALL-LIMIT          | `project-labels list --all --limit N`               | `--all` wins; internal requests use up to 250                                                                        | DONE     | GREEN | PASS |
| LPL-RULE-PL-NOHISTORY-AFTER    | `project-labels list --after C --no-cursor-history` | Resume without recording a new cursor                                                                                | DONE     | GREEN | PASS |
| LPL-RULE-PL-NOHISTORY-ALL      | `project-labels list --all --no-cursor-history`     | Exhaust without recording a history entry                                                                            | DONE     | GREEN | PASS |
| LPL-RULE-PL-TERMINATOR         | `project-labels list --`                            | End option parsing under the CLI Standard R3.1 contract                                                              | BASELINE | GREEN | PASS |
| LPL-OPT-PL-LIST-AFTER          | `--after <cursor>`                                  | Resume after exact nonempty raw Linear cursor through M34                                                            | DONE     | GREEN | PASS |
| LPL-OPT-PL-LIST-INCLUDERETIRED | `--include-retired`                                 | Remove only the client-side `retiredAt == null` predicate while retaining the bound; never changes `includeArchived` | DONE     | GREEN | PASS |
| LPL-OPT-PL-LIST-ALL            | `-a, --all`                                         | Fetch all remaining pages without changing retired scope; overrides `--limit`                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-LIST-NOHISTORY      | `--no-cursor-history`                               | Skip M34 local history write without changing remote output                                                          | DONE     | GREEN | PASS |
| LPL-RULE-PL-CATALOG            | `project-labels list` collection                    | Base catalog includes applied and unused project-label definitions under the same filters/order                      | DONE     | GREEN | PASS |
| LPL-CMD-PL-VIEW                | `project-labels view <id>`                          | View one active or retired project label                                                                             | BASELINE | GREEN | PASS |
| LPL-ARG-PL-VIEW-ID             | `<id>`                                              | Accept label UUID or configured project-label alias                                                                  | BASELINE | GREEN | PASS |
| LPL-CMD-PL-CREATE              | `project-labels create`                             | Create one project label                                                                                             | BASELINE | GREEN | PASS |
| LPL-OPT-PL-CREATE-NAME         | `-n, --name <name>`                                 | Required nonblank label name                                                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-PL-CREATE-COLOR        | `-c, --color <hex>`                                 | Valid HEX color; default `#5E6AD2`                                                                                   | BASELINE | GREEN | PASS |
| LPL-OPT-PL-CREATE-DESCRIPTION  | `-d, --description <text>`                          | Optional description; empty string allowed                                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-PL-CREATE-DRYRUN       | `--dry-run`                                         | Validate and resolve, print plan, perform no mutation                                                                | DONE     | GREEN | PASS |
| LPL-OPT-PL-CREATE-OUTPUT       | `-o, --output <table\|json>`                        | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-CREATE-JSON         | `--json`                                            | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-PL-CREATE-OUTPUT      | `--json` with `--output`                            | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-CREATE-YES          | `-y, --yes`                                         | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-PL-CREATE-NOINPUT      | `--no-input`                                        | Never prompt; fail with usage error if input is required                                                             | DONE     | GREEN | PASS |
| LPL-CMD-PL-UPDATE              | `project-labels update <id>`                        | Update one project label                                                                                             | BASELINE | GREEN | PASS |
| LPL-ARG-PL-UPDATE-ID           | `<id>`                                              | Accept label UUID or project-label alias                                                                             | BASELINE | GREEN | PASS |
| LPL-OPT-PL-UPDATE-NAME         | `--name <name>`                                     | Replace label name with nonblank input                                                                               | BASELINE | GREEN | PASS |
| LPL-OPT-PL-UPDATE-COLOR        | `--color <hex>`                                     | Replace label color after validation                                                                                 | BASELINE | GREEN | PASS |
| LPL-OPT-PL-UPDATE-DESCRIPTION  | `--description <text>`                              | Replace description; `--description ""` clears it                                                                    | DONE     | GREEN | PASS |
| LPL-OPT-PL-UPDATE-DRYRUN       | `--dry-run`                                         | Validate and resolve, print plan, perform no mutation                                                                | DONE     | GREEN | PASS |
| LPL-OPT-PL-UPDATE-OUTPUT       | `-o, --output <table\|json>`                        | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-UPDATE-JSON         | `--json`                                            | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-PL-UPDATE-OUTPUT      | `--json` with `--output`                            | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-UPDATE-YES          | `-y, --yes`                                         | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-PL-UPDATE-NOINPUT      | `--no-input`                                        | Never prompt; fail if confirmation/input is required                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-PL-DELETE              | `project-labels delete <id>`                        | Permanently delete one project label after confirmation                                                              | BASELINE | GREEN | PASS |
| LPL-ARG-PL-DELETE-ID           | `<id>`                                              | Accept label UUID or project-label alias                                                                             | BASELINE | GREEN | PASS |
| LPL-OPT-PL-DELETE-YES          | `-y, --yes`                                         | Supply destructive and workspace confirmation consent                                                                | BASELINE | GREEN | PASS |
| LPL-OPT-PL-DELETE-DRYRUN       | `--dry-run`                                         | Preview deletion and perform no mutation                                                                             | DONE     | GREEN | PASS |
| LPL-OPT-PL-DELETE-OUTPUT       | `-o, --output <table\|json>`                        | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-DELETE-JSON         | `--json`                                            | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-PL-DELETE-OUTPUT      | `--json` with `--output`                            | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-DELETE-NOINPUT      | `--no-input`                                        | Never prompt; require `--yes` when consent is needed                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-PL-RETIRE              | `project-labels retire <id>`                        | Reversibly retire one project label                                                                                  | DONE     | GREEN | PASS |
| LPL-ARG-PL-RETIRE-ID           | `<id>`                                              | Accept active label UUID or project-label alias                                                                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-RETIRE-YES          | `-y, --yes`                                         | Supply retire and workspace confirmation consent                                                                     | DONE     | GREEN | PASS |
| LPL-OPT-PL-RETIRE-DRYRUN       | `--dry-run`                                         | Preview retirement and perform no mutation                                                                           | DONE     | GREEN | PASS |
| LPL-OPT-PL-RETIRE-OUTPUT       | `-o, --output <table\|json>`                        | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-RETIRE-JSON         | `--json`                                            | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-PL-RETIRE-OUTPUT      | `--json` with `--output`                            | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-RETIRE-NOINPUT      | `--no-input`                                        | Never prompt; require `--yes` when consent is needed                                                                 | DONE     | GREEN | PASS |
| LPL-CMD-PL-RESTORE             | `project-labels restore <id>`                       | Restore one retired project label                                                                                    | DONE     | GREEN | PASS |
| LPL-ARG-PL-RESTORE-ID          | `<id>`                                              | Accept retired label UUID or retained project-label alias                                                            | DONE     | GREEN | PASS |
| LPL-OPT-PL-RESTORE-DRYRUN      | `--dry-run`                                         | Preview restoration and perform no mutation                                                                          | DONE     | GREEN | PASS |
| LPL-OPT-PL-RESTORE-OUTPUT      | `-o, --output <table\|json>`                        | Select result format; default `table`; reject any other value before mutation                                        | DONE     | GREEN | PASS |
| LPL-OPT-PL-RESTORE-JSON        | `--json`                                            | Exact convenience equivalent of `--output json`                                                                      | DONE     | GREEN | PASS |
| LPL-RULE-PL-RESTORE-OUTPUT     | `--json` with `--output`                            | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation                      | DONE     | GREEN | PASS |
| LPL-OPT-PL-RESTORE-YES         | `-y, --yes`                                         | Consent to any required workspace confirmation                                                                       | DONE     | GREEN | PASS |
| LPL-OPT-PL-RESTORE-NOINPUT     | `--no-input`                                        | Never prompt; fail if workspace confirmation is required                                                             | DONE     | GREEN | PASS |
| LPL-CMD-PL-SYNC                | `project-labels sync-aliases`                       | Preserve project-label alias synchronization behavior                                                                | BASELINE | GREEN | PASS |
| LPL-OPT-PL-SYNC-GLOBAL         | `-g, --global`                                      | Write aliases to global config                                                                                       | BASELINE | GREEN | PASS |
| LPL-OPT-PL-SYNC-PROJECT        | `-p, --project`                                     | Write aliases to project config                                                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-PL-SYNC-DRYRUN         | `--dry-run`                                         | Preview aliases without writing                                                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-PL-SYNC-FORCE          | `-f, --force`                                       | Overwrite conflicting aliases; does not imply prompt consent                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-PL-SYNC-NOAUTOSUFFIX   | `--no-auto-suffix`                                  | Skip duplicates instead of numbering them                                                                            | BASELINE | GREEN | PASS |

### 4.3 Project update command

Every existing option is listed because the command parser and “at least one update” predicate are
being modified. Baseline entries require regression coverage even when their implementation is not
otherwise changed.

| ID                        | Interface element                       | Contract                                                                                        | I        | T     | V    |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- | ----- | ---- |
| LPL-CMD-PROJ-UPDATE       | `project update <name-or-id>`           | Update active project fields and project lifecycle state                                        | DONE     | GREEN | PASS |
| LPL-ARG-PROJ-UPDATE-ID    | `<name-or-id>`                          | Active path accepts name/UUID/alias; untrash path must accept trashed UUID/alias                | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-STATUS       | `--status <name-or-id>`                 | Preserve project-status update behavior                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-NAME         | `--name <name>`                         | Preserve project rename behavior                                                                | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-DESCRIPTION  | `--description <text>`                  | Preserve project-description update behavior                                                    | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-CONTENT      | `--content <markdown>`                  | Preserve inline project-content behavior                                                        | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-CONTENTFILE  | `--content-file <path>`                 | Preserve file-content behavior and exclusivity with `--content`                                 | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-PRIORITY     | `--priority <0-4>`                      | Preserve validated priority update                                                              | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-TARGETDATE   | `--target-date <date>`                  | Preserve flexible target-date parsing                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-STARTDATE    | `--start-date <date>`                   | Preserve flexible start-date parsing                                                            | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-COLOR        | `--color <hex>`                         | Preserve color update                                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-ICON         | `--icon <icon>`                         | Preserve icon update                                                                            | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-LEAD         | `--lead <id>`                           | Preserve lead ID/alias/email resolution                                                         | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-MEMBERS      | `--members <ids>`                       | Preserve comma-separated member resolution                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-LABELS       | `--labels <ids>`                        | Preserve comma-separated project-label resolution                                               | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-STARTRES     | `--start-date-resolution <resolution>`  | Preserve choice validation and resolution-only updates                                          | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-TARGETRES    | `--target-date-resolution <resolution>` | Preserve choice validation and resolution-only updates                                          | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-LINK         | `--link <url-and-label>`                | Preserve repeatable external-link creation                                                      | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-REMOVELINK   | `--remove-link <url>`                   | Preserve repeatable exact-URL removal                                                           | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-DEPENDSON    | `--depends-on <projects>`               | Preserve dependency additions                                                                   | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-BLOCKS       | `--blocks <projects>`                   | Preserve blocking-relation additions                                                            | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-DEPENDENCY   | `--dependency <spec>`                   | Preserve repeatable advanced dependency additions                                               | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-RMDEPENDSON  | `--remove-depends-on <projects>`        | Preserve dependency removals                                                                    | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-RMBLOCKS     | `--remove-blocks <projects>`            | Preserve blocking-relation removals                                                             | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-RMDEPENDENCY | `--remove-dependency <project>`         | Preserve repeatable all-relations removal                                                       | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-WEB          | `-w, --web`                             | Preserve opening the updated project in a browser                                               | BASELINE | GREEN | PASS |
| LPL-OPT-PROJ-DRYRUN       | `--dry-run`                             | Include every planned primary and ancillary effect; perform no mutation                         | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-TRASH        | `--trash`                               | Trash through dedicated `projectArchive(id, { trash: true })`; require destructive consent      | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-UNTRASH      | `--untrash`                             | Restore through dedicated `unarchiveProject(id)`; resolve trashed UUID/alias                    | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-OUTPUT       | `-o, --output <table\|json>`            | Select result format; default `table`; reject any other value before mutation                   | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-JSON         | `--json`                                | Exact convenience equivalent of `--output json`                                                 | DONE     | GREEN | PASS |
| LPL-RULE-PROJ-OUTPUT      | `--json` with `--output`                | Accept `--json --output json`; reject `--json --output table` with usage exit 2 before mutation | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-YES          | `-y, --yes`                             | Supply destructive and workspace confirmation consent                                           | DONE     | GREEN | PASS |
| LPL-OPT-PROJ-NOINPUT      | `--no-input`                            | Never prompt; fail with usage error when consent/input is missing                               | DONE     | GREEN | PASS |
| LPL-RULE-PROJ-TRASH-XOR   | `--trash` XOR `--untrash`               | Both flags together are a usage error and make no API call                                      | DONE     | GREEN | PASS |
| LPL-RULE-PROJ-STATUS      | Project status lifecycle                | Completion/cancellation remains `--status`; trash does not invent archive semantics             | BASELINE | GREEN | PASS |

### 4.4 Compatibility-only labels stub

| ID                          | Interface element | Contract                                                                                       | I        | T     | V    |
| --------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- | -------- | ----- | ---- |
| LPL-CMD-LABELS-SHIM         | `labels`          | Help/deprecation shim only; never performs label CRUD                                          | DONE     | GREEN | PASS |
| LPL-ALS-LABELS-SHIM         | `lbl`             | Exact alias of the compatibility shim                                                          | BASELINE | GREEN | PASS |
| LPL-CMD-LABELS-LIST-SHIM    | `labels list`     | Preserve exit behavior while naming `issue-labels list` and `project-labels list`              | DONE     | GREEN | PASS |
| LPL-ALS-LABELS-LIST-SHIM    | `labels ls`       | Exact alias of the list shim                                                                   | BASELINE | GREEN | PASS |
| LPL-RULE-LABELS-DEPRECATION | Shim lifecycle    | Warning on stderr; replacements and removal release documented; no script break before removal | DONE     | GREEN | PASS |

### 4.5 Page-navigation rules and rejected alternatives

| ID                                 | Interface element                          | Contract                                                                                                                            | I        | T     | V    |
| ---------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ---- |
| LPL-RULE-IL-REJECT-PAGE            | `issue-labels list --page <number>`        | Reject as unknown with usage exit 2; cursors do not provide stable page numbers                                                     | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-PAGE            | `project-labels list --page <number>`      | Reject as unknown with usage exit 2; cursors do not provide stable page numbers                                                     | BASELINE | GREEN | PASS |
| LPL-RULE-IL-REJECT-CURSOR          | `issue-labels list --cursor <cursor>`      | Reject as unknown; only `--after` resumes                                                                                           | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-CURSOR          | `project-labels list --cursor <cursor>`    | Reject as unknown; only `--after` resumes                                                                                           | BASELINE | GREEN | PASS |
| LPL-RULE-IL-REJECT-BEFORE          | `issue-labels list --before <cursor>`      | Reject as unknown; M34 supports forward traversal only                                                                              | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-BEFORE          | `project-labels list --before <cursor>`    | Reject as unknown; M34 supports forward traversal only                                                                              | BASELINE | GREEN | PASS |
| LPL-RULE-IL-REJECT-PAGESIZE        | `issue-labels list --page-size <number>`   | Reject as unknown; internal request sizing is not public                                                                            | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-PAGESIZE        | `project-labels list --page-size <number>` | Reject as unknown; internal request sizing is not public                                                                            | BASELINE | GREEN | PASS |
| LPL-RULE-IL-REJECT-PAGINATE        | `issue-labels list --paginate`             | Reject as unknown; M34 owns the retained `--all` waiver                                                                             | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-PAGINATE        | `project-labels list --paginate`           | Reject as unknown; M34 owns the retained `--all` waiver                                                                             | BASELINE | GREEN | PASS |
| LPL-RULE-IL-REJECT-NOPAGINATE      | `issue-labels list --no-paginate`          | Reject as unknown; no second traversal switch is exposed                                                                            | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-NOPAGINATE      | `project-labels list --no-paginate`        | Reject as unknown; no second traversal switch is exposed                                                                            | BASELINE | GREEN | PASS |
| LPL-RULE-PL-REJECT-INCLUDEUNUSED   | `project-labels list --include-unused`     | Reject as unknown; unused definitions already belong to the base catalog                                                            | BASELINE | GREEN | PASS |
| LPL-RULE-IL-LIST-NOINCLUDEARCHIVED | `issue-labels list --include-archived`     | Reject as unknown with usage exit 2 before API access; M33 exposes retirement scope only                                            | DONE     | GREEN | PASS |
| LPL-RULE-PL-LIST-NOINCLUDEARCHIVED | `project-labels list --include-archived`   | Reject as unknown with usage exit 2 before API access; M33 exposes retirement scope only                                            | DONE     | GREEN | PASS |
| LPL-RULE-IL-PAGE-NEXT              | Issue-label next-page behavior             | Human and JSON output expose the raw cursor; next invocation uses `--after`                                                         | DONE     | GREEN | PASS |
| LPL-RULE-PL-PAGE-NEXT              | Project-label next-page behavior           | Human and JSON output expose the raw cursor; next invocation uses `--after`                                                         | DONE     | GREEN | PASS |
| LPL-RULE-IL-PAGE-NUMBER            | Issue-label page-number behavior           | Page two is sequentially supported; direct numeric page N remains unsupported                                                       | DONE     | GREEN | PASS |
| LPL-RULE-PL-PAGE-NUMBER            | Project-label page-number behavior         | Page two is sequentially supported; direct numeric page N remains unsupported                                                       | DONE     | GREEN | PASS |
| LPL-RULE-IL-ALL-SCOPE              | `issue-labels list --all`                  | Pagination only; `--include-retired` alone controls retired scope                                                                   | DONE     | GREEN | PASS |
| LPL-RULE-PL-ALL-SCOPE              | `project-labels list --all`                | Pagination only; changes neither applied/unused catalog membership nor retired scope; `--include-retired` alone controls retirement | DONE     | GREEN | PASS |
| LPL-RULE-LABEL-STATE-INDEPENDENT   | Retirement/archive interaction             | Preserve all null/non-null combinations; never infer `retiredAt` from `archivedAt` or vice versa                                    | DONE     | GREEN | PASS |

### 4.6 M34 adopter dependency map

This table declares prerequisites, not duplicate status. Every local row remains M33-owned and may
reach `V=PASS` only after every listed M34 ID is `V=PASS`.

| M33 adopter ID                 | Exact M34 prerequisite IDs                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LPL-OPT-IL-LIST-LIMIT          | `CPH-PAG-DEFAULT`                                                                                                                                            |
| LPL-RULE-IL-LIMIT-PARSE        | `CPH-PAG-LIMIT-PARSE`                                                                                                                                        |
| LPL-RULE-IL-LIMIT-MIN          | `CPH-PAG-LIMIT-MIN`                                                                                                                                          |
| LPL-RULE-IL-LIMIT-MAX          | `CPH-PAG-LIMIT-MAX`                                                                                                                                          |
| LPL-OPT-IL-LIST-AFTER          | `CPH-PAG-RAW-FIDELITY`, `CPH-PAG-RAW-NO-WRAP`, `CPH-PAG-AFTER-EMPTY`, `CPH-PAG-AFTER-PASS`                                                                   |
| LPL-OPT-IL-LIST-INCLUDERETIRED | `CPH-API-PAGE-FILTER`, `CPH-PAG-EDGE-CURSOR`, `CPH-PAG-LAST-EXAMINED`                                                                                        |
| LPL-OPT-IL-LIST-ALL            | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-PAG-MISSING-END`, `CPH-PAG-REPEATED-END`, `CPH-PAG-ATOMIC-OUTPUT`                                                             |
| LPL-OPT-IL-LIST-NOHISTORY      | `CPH-HIS-NO-RECORD-DISABLED`                                                                                                                                 |
| LPL-RULE-IL-AFTER-LIMIT        | `CPH-PAG-AFTER-LIMIT`                                                                                                                                        |
| LPL-RULE-IL-AFTER-ALL          | `CPH-PAG-AFTER-ALL`                                                                                                                                          |
| LPL-RULE-IL-ALL-LIMIT          | `CPH-PAG-ALL-LIMIT`                                                                                                                                          |
| LPL-RULE-IL-NOHISTORY-AFTER    | `CPH-PAG-NOHISTORY-AFTER`                                                                                                                                    |
| LPL-RULE-IL-NOHISTORY-ALL      | `CPH-PAG-NOHISTORY-ALL`                                                                                                                                      |
| LPL-RULE-IL-TERMINATOR         | `CPH-API-ADOPTER-CONTRACT`                                                                                                                                   |
| LPL-RULE-IL-REJECT-PAGE        | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-IL-REJECT-CURSOR      | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-IL-REJECT-BEFORE      | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-IL-REJECT-PAGESIZE    | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-IL-REJECT-PAGINATE    | `CPH-DOC-CONFORMANCE`                                                                                                                                        |
| LPL-RULE-IL-REJECT-NOPAGINATE  | `CPH-DOC-CONFORMANCE`                                                                                                                                        |
| LPL-RULE-IL-PAGE-NEXT          | `CPH-OUT-HUMAN-NEXT`, `CPH-OUT-HUMAN-ALL-REMAINING`, `CPH-OUT-SHELL-CURSOR`, `CPH-OUT-SHELL-CONTEXT`                                                         |
| LPL-RULE-IL-PAGE-NUMBER        | `CPH-DOC-README-PAGINATION`                                                                                                                                  |
| LPL-RULE-IL-ALL-SCOPE          | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-DOC-CONFORMANCE`                                                                                                              |
| LPL-OPT-PL-LIST-LIMIT          | `CPH-PAG-DEFAULT`                                                                                                                                            |
| LPL-RULE-PL-LIMIT-PARSE        | `CPH-PAG-LIMIT-PARSE`                                                                                                                                        |
| LPL-RULE-PL-LIMIT-MIN          | `CPH-PAG-LIMIT-MIN`                                                                                                                                          |
| LPL-RULE-PL-LIMIT-MAX          | `CPH-PAG-LIMIT-MAX`                                                                                                                                          |
| LPL-OPT-PL-LIST-AFTER          | `CPH-PAG-RAW-FIDELITY`, `CPH-PAG-RAW-NO-WRAP`, `CPH-PAG-AFTER-EMPTY`, `CPH-PAG-AFTER-PASS`                                                                   |
| LPL-OPT-PL-LIST-INCLUDERETIRED | `CPH-API-PAGE-FILTER`, `CPH-PAG-EDGE-CURSOR`, `CPH-PAG-LAST-EXAMINED`                                                                                        |
| LPL-OPT-PL-LIST-ALL            | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-PAG-MISSING-END`, `CPH-PAG-REPEATED-END`, `CPH-PAG-ATOMIC-OUTPUT`                                                             |
| LPL-OPT-PL-LIST-NOHISTORY      | `CPH-HIS-NO-RECORD-DISABLED`                                                                                                                                 |
| LPL-RULE-PL-AFTER-LIMIT        | `CPH-PAG-AFTER-LIMIT`                                                                                                                                        |
| LPL-RULE-PL-AFTER-ALL          | `CPH-PAG-AFTER-ALL`                                                                                                                                          |
| LPL-RULE-PL-ALL-LIMIT          | `CPH-PAG-ALL-LIMIT`                                                                                                                                          |
| LPL-RULE-PL-NOHISTORY-AFTER    | `CPH-PAG-NOHISTORY-AFTER`                                                                                                                                    |
| LPL-RULE-PL-NOHISTORY-ALL      | `CPH-PAG-NOHISTORY-ALL`                                                                                                                                      |
| LPL-RULE-PL-TERMINATOR         | `CPH-API-ADOPTER-CONTRACT`                                                                                                                                   |
| LPL-RULE-PL-REJECT-PAGE        | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-PL-REJECT-CURSOR      | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-PL-REJECT-BEFORE      | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-PL-REJECT-PAGESIZE    | `CPH-DOC-HELP-REMOTE`                                                                                                                                        |
| LPL-RULE-PL-REJECT-PAGINATE    | `CPH-DOC-CONFORMANCE`                                                                                                                                        |
| LPL-RULE-PL-REJECT-NOPAGINATE  | `CPH-DOC-CONFORMANCE`                                                                                                                                        |
| LPL-RULE-PL-PAGE-NEXT          | `CPH-OUT-HUMAN-NEXT`, `CPH-OUT-HUMAN-ALL-REMAINING`, `CPH-OUT-SHELL-CURSOR`, `CPH-OUT-SHELL-CONTEXT`                                                         |
| LPL-RULE-PL-PAGE-NUMBER        | `CPH-DOC-README-PAGINATION`                                                                                                                                  |
| LPL-RULE-PL-ALL-SCOPE          | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-DOC-CONFORMANCE`                                                                                                              |
| LPL-API-PAGE-INPUT             | `CPH-API-PAGE-INPUT`, `CPH-API-ADOPTER-CONTRACT`                                                                                                             |
| LPL-API-PAGE-RESULT            | `CPH-API-PAGE-INFO`, `CPH-API-HISTORY-ADAPTER`                                                                                                               |
| LPL-API-PAGE-CURSOR            | `CPH-API-PAGE-EDGE`, `CPH-API-PAGE-FILTER`, `CPH-PAG-LAST-EXAMINED`                                                                                          |
| LPL-API-PAGE-BOUNDED           | `CPH-API-PAGE-WALKER`, `CPH-API-PAGE-FILTER`                                                                                                                 |
| LPL-API-PAGE-HISTORY           | `CPH-API-HISTORY-ADAPTER`, `CPH-HIS-SAFE-COMMAND`                                                                                                            |
| LPL-OUT-PAGE-HINT              | `CPH-OUT-HUMAN-NEXT`, `CPH-OUT-HUMAN-ALL-REMAINING`, `CPH-OUT-HUMAN-HISTORY-ID`                                                                              |
| LPL-OUT-PAGE-MACHINE           | `CPH-OUT-PAGE-COUNT`, `CPH-OUT-PAGE-HASNEXT`, `CPH-OUT-PAGE-END`, `CPH-OUT-PAGE-ALL`, `CPH-OUT-HISTORY-STATUS`, `CPH-OUT-HISTORY-ENTRY`, `CPH-OUT-TSV-CLEAN` |
| LPL-OUT-PAGE-CURSOR            | `CPH-PAG-END-NULL`, `CPH-PAG-RAW-FIDELITY`                                                                                                                   |
| LPL-TST-PAGE-UNIT              | `CPH-TST-ADOPTER-CONTRACT`, `CPH-TST-FILTER-EDGE`                                                                                                            |
| LPL-TST-PAGE-CLI               | `CPH-TST-PARSER`, `CPH-TST-OUTPUT`                                                                                                                           |
| LPL-TST-PAGE-LIVE              | `CPH-VER-ADOPTER-CONTRACT`                                                                                                                                   |
| LPL-TST-PAGE-ABSENCE           | `CPH-DOC-HELP-REMOTE`, `CPH-DOC-CONFORMANCE`                                                                                                                 |
| LPL-VER-PAGINATION             | `CPH-VER-ADOPTER-CONTRACT`, `CPH-VER-RAW`, `CPH-VER-HELP`, `CPH-VER-JSON`                                                                                    |
| LPL-DOC-M34-DEPENDENCIES       | `CPH-DOC-DEPENDENCY-MAP`, `CPH-DOC-CONFORMANCE`                                                                                                              |

---

## 5. Shared implementation and behavior ledger

### 5.1 API and data-layer contracts

| ID                            | Contract                                                                                                                                                  | Intended files                                      | I    | T     | V    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---- | ----- | ---- |
| LPL-API-LABEL-RETIREDAT       | Raw-select and map nullable `retiredAt` as the canonical label-lifecycle state                                                                            | `src/lib/api/labels.ts`, `src/lib/types.ts`         | DONE | GREEN | PASS |
| LPL-API-LABEL-ARCHIVEDAT      | Raw-select and map nullable `archivedAt` independently without lifecycle inference                                                                        | `src/lib/api/labels.ts`, `src/lib/types.ts`         | DONE | GREEN | PASS |
| LPL-API-LABEL-ARCHIVED-SCOPE  | Every M33 label list passes `includeArchived: false`; `includeRetired` never changes it                                                                   | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PAGE-INPUT            | Label adapter supplies `limit`, raw `after`, `fetchAll`, `includeRetired`, and history opt-out to M34                                                     | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PAGE-RESULT           | Label adapter returns M34 items/pageInfo/history plus normalized query context                                                                            | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PAGE-CURSOR           | Label adapter supplies the last examined edge after retirement/color predicates; M34 owns cursor guards                                                   | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PAGE-BOUNDED          | Label predicates compose with M34 so bounded mode returns N matches and all mode exhausts                                                                 | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PAGE-HISTORY          | Label adapter supplies sanitized workspace/scope/filter/order context to M34 history                                                                      | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-IL-LIST               | Raw issue-label edges select both timestamps; server-filter team/workspace and client-filter `retiredAt` before the bound                                 | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-LIST               | Raw project-label edges select both timestamps and client-filter `retiredAt` before the bound                                                             | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-CATALOG            | Bounded and exhaustive reads use one top-level raw `projectLabels` connection containing applied and unused definitions; never endpoint-switch on `--all` | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-NO-USAGE-INFERENCE | Catalog membership is independent of `lastAppliedAt`; do not treat historical application time as current association state                               | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-IL-VIEW-STATE         | Issue-label view raw-selects and preserves both nullable timestamps                                                                                       | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-VIEW-STATE         | Project-label view raw-selects and preserves both nullable timestamps                                                                                     | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-IL-RETIRE             | SDK `issueLabelRetire` must succeed and return an ID; raw refetch proves `retiredAt` non-null and `archivedAt` unchanged                                  | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-IL-RESTORE            | SDK `issueLabelRestore` must succeed and return an ID; raw refetch proves `retiredAt` null and `archivedAt` unchanged                                     | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-RETIRE             | SDK `projectLabelRetire` must succeed and return an ID; raw refetch proves `retiredAt` non-null and `archivedAt` unchanged                                | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-RESTORE            | SDK `projectLabelRestore` must succeed and return an ID; raw refetch proves `retiredAt` null and `archivedAt` unchanged                                   | `src/lib/api/labels.ts`                             | DONE | GREEN | PASS |
| LPL-API-PL-DELETE-SUCCESS     | Project-label delete propagates payload `success=false` as failure                                                                                        | `src/lib/api/labels.ts`, command runner             | DONE | GREEN | PASS |
| LPL-API-PROJ-TRASHED-TYPE     | Add `trashed?: boolean` to project update input                                                                                                           | `src/lib/api/projects.ts`                           | DONE | GREEN | PASS |
| LPL-API-PROJ-TRASHED-PAYLOAD  | Route defined `trashed` values to SDK `archiveProject(id, { trash: true })` or `unarchiveProject(id)`; never send them through `projectUpdate`            | `src/lib/api/projects.ts`                           | DONE | GREEN | PASS |
| LPL-API-PROJ-TRASHED-RESOLVE  | Resolve trashed project by UUID/alias without active-only name lookup                                                                                     | `src/lib/project-resolver.ts` or dedicated resolver | DONE | GREEN | PASS |
| LPL-API-FACADE                | Re-export every new wrapper through the existing API barrel/facade                                                                                        | `src/lib/api/index.ts`, `src/lib/linear-client.ts`  | DONE | GREEN | PASS |

### 5.2 Safety and mutation contracts

| ID                        | Contract                                                                                        | I    | T     | V    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ----- | ---- |
| LPL-SAF-CONFIRM-SHARED    | One reusable destructive-confirmation primitive; no private readline copies in touched commands | DONE | GREEN | PASS |
| LPL-SAF-CONFIRM-TTY       | Prompt only when stdin is a TTY; never open surprise `/dev/tty`                                 | DONE | GREEN | PASS |
| LPL-SAF-CONFIRM-STDERR    | Prompt, warnings, and progress go to stderr                                                     | DONE | GREEN | PASS |
| LPL-SAF-CONFIRM-YES       | `--yes` answers routine consent; it does not mean `--force`                                     | DONE | GREEN | PASS |
| LPL-SAF-CONFIRM-NOINPUT   | `--no-input` prohibits prompting and fails with exit 2 when consent is missing                  | DONE | GREEN | PASS |
| LPL-SAF-CONFIRM-NONTYY    | Non-TTY destructive invocation without `--yes` fails with exit 2 and does not mutate            | DONE | GREEN | PASS |
| LPL-SAF-WORKSPACE-LABELS  | Every remote label mutation uses `guardWorkspaceForMutation` immediately before its write       | DONE | GREEN | PASS |
| LPL-SAF-WORKSPACE-PROJECT | `project update` uses the same workspace guard immediately before its primary write             | DONE | GREEN | PASS |
| LPL-SAF-DRYRUN-LABELS     | Label dry-run validates/resolves but calls no mutation wrapper                                  | DONE | GREEN | PASS |
| LPL-SAF-DRYRUN-PROJECT    | Project dry-run includes trash and ancillary effects and calls no mutation wrapper              | DONE | GREEN | PASS |
| LPL-SAF-ISSUE-TRASH       | Apply the shared confirmation contract to existing `issue update --trash`                       | DONE | GREEN | PASS |
| LPL-SAF-RESTORE           | Restore/untrash requires workspace safety but no destructive confirmation                       | DONE | GREEN | PASS |

### 5.3 Output and error contracts

| ID                      | Contract                                                                                                        | I    | T     | V    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- |
| LPL-OUT-HUMAN           | Default `--output table` mode emits requested result to stdout and diagnostics/progress to stderr               | DONE | GREEN | PASS |
| LPL-OUT-JSON-ENVELOPE   | Successful remote mutations emit `{ok, workspace, <entity>}`; declined destructive operations emit `{ok:false,cancelled:true,...}` and never plain text | DONE | GREEN | PASS |
| LPL-OUT-JSON-DRYRUN     | JSON dry-run adds stable operation/plan data and remains mutation-free                                          | DONE | GREEN | PASS |
| LPL-OUT-JSON-DELETE     | Delete JSON identifies the deleted resource and propagates unsuccessful payloads                                | DONE | GREEN | PASS |
| LPL-OUT-JSON-ERROR      | Under `--output json` or equivalent `--json`, ordinary and ancillary-operation failures emit a stable error instead of a false success envelope | DONE | GREEN | PASS |
| LPL-OUT-QUIET-JSON      | JSON stdout contains no progress, alias-resolution, warning, or confirmation text                               | DONE | GREEN | PASS |
| LPL-OUT-LIST-RETIREDAT  | Human output distinguishes retired state; JSON/TSV expose nullable `retiredAt` without inference                | DONE | GREEN | PASS |
| LPL-OUT-LIST-ARCHIVEDAT | Human output distinguishes archived state; JSON/TSV expose nullable `archivedAt` independently                  | DONE | GREEN | PASS |
| LPL-OUT-ORDER           | Issue/project label lists preserve one declared Linear provider order across pages                              | DONE | GREEN | PASS |
| LPL-OUT-PAGE-HINT       | Bounded human stdout includes raw next-page/all-remaining commands and history ID                               | DONE | GREEN | PASS |
| LPL-OUT-PAGE-MACHINE    | JSON emits `{labels,pageInfo,cursorHistory}`; TSV remains row-only and clean                                    | DONE | GREEN | PASS |
| LPL-OUT-PAGE-CURSOR     | JSON `pageInfo.endCursor` is exact raw Linear cursor when more exist, else null                                 | DONE | GREEN | PASS |

---

## 6. Test and verification ledger

### 6.1 Test harnesses

| ID                      | Test artifact                                | Required coverage                                                                                                                                                      | I    | T     | V    |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---- |
| LPL-TST-CONFIRM         | `src/lib/confirm-destructive.test.ts`        | TTY/non-TTY, stderr, yes, no-input, cancellation, exit 2                                                                                                               | DONE | GREEN | PASS |
| LPL-TST-IL-LIST         | Issue-label list unit tests                  | team/workspace/limit/after/all/include-retired/no-history/color/format/order plus client retirement filtering                                                          | DONE | GREEN | PASS |
| LPL-TST-PL-LIST         | Project-label list unit tests                | limit/after/all/include-retired/no-history/color/format/order plus client retirement filtering                                                                         | DONE | GREEN | PASS |
| LPL-TST-PL-CATALOG      | Project-label catalog unit tests             | one connection for bounded/all modes; applied and unused fixtures remain in base scope; no `lastAppliedAt` filtering                                                   | DONE | GREEN | PASS |
| LPL-TST-LABEL-STATE     | Shared label-state unit tests                | raw field selection, four null combinations, no inference, archived exclusion, rejected archive flag, edge cursor after retired filtering                              | DONE | GREEN | PASS |
| LPL-TST-PAGE-UNIT       | M33 label-adapter tests                      | Map filters, last-examined edge, context, and label envelopes onto the already-green M34 adopter contract                                                              | DONE | GREEN | PASS |
| LPL-TST-PAGE-CLI        | Built-CLI label adoption tests               | command-specific defaults/interactions, history, errors, human footer, and clean JSON/TSV                                                                              | DONE | GREEN | PASS |
| LPL-TST-PAGE-LIVE       | ConceptM label pagination fixture            | assert ConceptM, force at least two pages through injectable test sizing, record fixture IDs, and clean up                                                             | DONE | GREEN | PASS |
| LPL-TST-PAGE-ABSENCE    | Command-specific pagination absence tests    | both label families reject `--page`, `--cursor`, `--before`, `--page-size`, `--paginate`, and `--no-paginate`; project labels also reject redundant `--include-unused` | DONE | GREEN | PASS |
| LPL-TST-IL-MUTATE       | Issue-label command-runner tests             | each create/update/delete/retire/restore command: aliases, dry-run, output default/enum, JSON equivalence/conflict, guard                                              | DONE | GREEN | PASS |
| LPL-TST-PL-MUTATE       | Project-label command-runner tests           | each create/update/delete/retire/restore command: aliases, dry-run, output default/enum, JSON equivalence/conflict, guard                                              | DONE | GREEN | PASS |
| LPL-TST-PROJ-UPDATE     | Project update tests                         | every parser option remains accepted; trash XOR; untrash resolution; dry-run; output default/enum; JSON equivalence/conflict                                           | DONE | GREEN | PASS |
| LPL-TST-ISSUE-TRASH     | Issue trash safety regression tests          | shared prompt and noninteractive behavior                                                                                                                              | DONE | GREEN | PASS |
| LPL-TST-LABELS-SHIM     | Compatibility-shim tests                     | stdout/stderr, exit stability, exact replacements, aliases                                                                                                             | DONE | GREEN | PASS |
| LPL-TST-CLI-OFFLINE     | `tests/scripts/test-label-lifecycle-cli.sh`  | built-CLI help/routing/parser/stream/error tests without API key                                                                                                       | DONE | GREEN | PASS |
| LPL-TST-LIVE-LABELS     | `tests/scripts/test-label-lifecycle-live.sh` | ConceptM only: assert workspace, then both label types create→apply→retire→verify→restore→delete with recorded IDs/cleanup                                             | DONE | GREEN | PASS |
| LPL-TST-LIVE-PL-CATALOG | ConceptM project-label catalog fixture       | assert ConceptM; create applied and never-applied labels plus disposable project; prove both list by default and under `--all`; record IDs and cleanup                 | DONE | GREEN | PASS |
| LPL-TST-LIVE-PROJECT    | Extend project live suite                    | ConceptM only: assert workspace, create→trash→untrash→trash cleanup with recorded unique fixture ID                                                                    | DONE | GREEN | PASS |
| LPL-TST-RUNNER          | Aggregate registration                       | Register offline and live suites in the correct workflow groups                                                                                                        | DONE | GREEN | PASS |
| LPL-TST-TRACE           | Traceability checker                         | Every interface-ledger ID appears in a test name or traceability map                                                                                                   | DONE | GREEN | PASS |

### 6.2 Aggregate verification gates

| ID                    | Verification command or inspection                                                                       | Pass condition                                                                                                                                  | I   | T   | V    |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ---- |
| LPL-VER-UNIT          | `npm test`                                                                                               | All Vitest suites pass                                                                                                                          | N/A | N/A | PASS |
| LPL-VER-TYPE          | `npm run typecheck`                                                                                      | Exit 0, no diagnostics                                                                                                                          | N/A | N/A | PASS |
| LPL-VER-LINT          | `npm run lint`                                                                                           | Exit 0, no diagnostics                                                                                                                          | N/A | N/A | PASS |
| LPL-VER-BUILD         | `npm run build`                                                                                          | Exit 0 and built CLI produced                                                                                                                   | N/A | N/A | PASS |
| LPL-VER-OFFLINE       | `bash tests/scripts/test-label-lifecycle-cli.sh`                                                         | All offline routing/stream/parser checks pass                                                                                                   | N/A | N/A | PASS |
| LPL-VER-LIVE-CONCEPTM | Live workspace preflight                                                                                 | Resolve and assert ConceptM before any mutation; fail closed on mismatch; record fixture IDs and cleanup                                        | N/A | N/A | PASS |
| LPL-VER-LIVE-LABELS   | ConceptM live label lifecycle suite                                                                      | Both label families complete lifecycle and cleanup in ConceptM only                                                                             | N/A | N/A | PASS |
| LPL-VER-LIVE-PROJECT  | ConceptM live project trash suite                                                                        | Project trash/untrash works and final cleanup is recorded in ConceptM only                                                                      | N/A | N/A | PASS |
| LPL-VER-HELP          | Built help inventory                                                                                     | Exact approved commands/options/aliases; rejected commands absent                                                                               | N/A | N/A | PASS |
| LPL-VER-JSON          | Run every changed result command with `-o json` and `--json`, compare output, and pipe both through `jq` | Equivalent clean parseable stdout; diagnostics only on stderr; conflicting table request exits 2 before mutation                                | N/A | N/A | PASS |
| LPL-VER-NONTYY        | Run destructive commands with stdin redirected                                                           | Never hangs; exit 2 without `--yes`; no mutation                                                                                                | N/A | N/A | PASS |
| LPL-VER-DRYRUN        | Spy/live-safe dry-run checks                                                                             | No mutation API called; complete plan shown                                                                                                     | N/A | N/A | PASS |
| LPL-VER-WORKSPACE     | Multi-workspace routing checks                                                                           | Workspace envelope and mutation target match resolver                                                                                           | N/A | N/A | PASS |
| LPL-VER-PAGINATION    | M33 adapter, built-CLI, and ConceptM live adoption matrix                                                | Label wiring/filtering/output pass and every exact M34 prerequisite in §4.6 is PASS                                                             | N/A | N/A | PASS |
| LPL-VER-LABEL-STATE   | Static SDK/schema audit, mocked raw queries, and disposable live lifecycle                               | Methods exist; both timestamps remain independent; retire sets and restore clears only `retiredAt`; active filtering uses examined-edge cursors | N/A | N/A | PASS |
| LPL-VER-PL-CATALOG    | Static SDK/query audit, unit fixtures, built CLI, and ConceptM live fixture                              | One catalog connection includes applied and unused definitions; `--all` changes only traversal; no `lastAppliedAt` usage inference              | N/A | N/A | PASS |
| LPL-VER-DIFF          | `git diff --check` and scoped diff review                                                                | No whitespace errors or unrelated changes                                                                                                       | N/A | N/A | PASS |
| LPL-VER-TRACE         | Ledger audit script/manual query                                                                         | No missing IDs; every done ID has RED/GREEN/VERIFY evidence                                                                                     | N/A | N/A | PASS |

---

## 7. Documentation and conformance ledger

| ID                       | Artifact                          | Required change                                                                                                                                                          | I    | T   | V    |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --- | ---- |
| LPL-DOC-PLAN             | This plan                         | Remains the authoritative ID/status ledger                                                                                                                               | DONE | N/A | PASS |
| LPL-DOC-MILESTONE        | `MILESTONES.md`                   | Add goal, M34 dependency, requirements, ID ranges, and verification                                                                                                      | DONE | N/A | PASS |
| LPL-DOC-README-CMDS      | `README.md`                       | Document label retire/restore and project trash/untrash                                                                                                                  | DONE | N/A | PASS |
| LPL-DOC-README-DELETE    | `README.md`                       | Clarify no permanent issue/project delete; reversible trash is supported                                                                                                 | DONE | N/A | PASS |
| LPL-DOC-TESTREADME       | `tests/README.md`                 | Remove stale “future project delete” direction; document reversible cleanup                                                                                              | DONE | N/A | PASS |
| LPL-DOC-CLAUDE           | `CLAUDE.md`                       | Replace “waiting for project delete” cleanup note                                                                                                                        | DONE | N/A | PASS |
| LPL-DOC-SETUP            | Setup/help strings                | Keep concrete `issue-labels`/`project-labels` guidance                                                                                                                   | DONE | N/A | PASS |
| LPL-DOC-CONFORMANCE      | `CONFORMANCE.md`                  | Pin standard v1.4.14 and record each retained SHOULD deviation                                                                                                           | DONE | N/A | PASS |
| LPL-DOC-DEV-R13          | Conformance deviation             | R1.3 plural canonical resource nouns: known MUST blocker, future major migration                                                                                         | DONE | N/A | PASS |
| LPL-DOC-DEV-R34-R42      | Conformance deviation             | R3.4/R4.2 legacy label-list `-f/--format` and TSV remain pending a repository-wide migration; M33 mutations conform                                                      | DONE | N/A | PASS |
| LPL-DOC-DEV-R21          | Conformance waiver                | R2.1 project `update --trash` instead of `delete`: reversibility and issue parity                                                                                        | DONE | N/A | PASS |
| LPL-DOC-PAGINATION       | User/reference docs               | Document default/range, raw `--after`, `--all`, retired scope, history opt-out, precedence, and API cost                                                                 | DONE | N/A | PASS |
| LPL-DOC-LABEL-STATE      | User/conformance docs             | Define `retiredAt` versus `archivedAt`, `--include-retired`, rejected archive scope/commands, raw-read rationale, and live proof                                         | DONE | N/A | PASS |
| LPL-DOC-PL-CATALOG       | User/reference and migration docs | Define applied/unused catalog membership, pagination-only `--all`, no `--include-unused`, historical `lastAppliedAt`, and removal of the unsupported archived-help claim | DONE | N/A | PASS |
| LPL-DOC-PAGE-NAVIGATION  | User/reference docs               | Show page one → raw cursor → page two/all remaining; reject direct numeric page N                                                                                        | DONE | N/A | PASS |
| LPL-DOC-M34-DEPENDENCIES | M33/M34 dependency record         | Map each label adopter ID to exact M34 prerequisites and cite M34's sole R10.2/R10.3 `--all` waiver                                                                      | DONE | N/A | PASS |
| LPL-DOC-BREAKING-VERSION | Release/conformance decision      | M33 remains project number; integrated M34 changes require coordinated major release                                                                                     | DONE | N/A | PASS |
| LPL-DOC-DEPRECATION      | Deprecation note                  | `labels\|lbl list\|ls` replacement and removal release per R9.2                                                                                                          | DONE | N/A | PASS |

---

## 8. Execution plan

Each phase is a dependency boundary, not a batch-completion shortcut. IDs inside a phase still move
through RED → IMPLEMENT → GREEN → VERIFY independently.

### Phase 0 — Contract freeze and baseline characterization

**IDs:** all `LPL-CMD-*`, `LPL-ALS-*`, `LPL-ARG-*`, and baseline `LPL-OPT-*` entries.

1. Generate a built-CLI help inventory for the affected command paths.
2. Add parser/routing characterization tests for every baseline command, alias, positional, and
   option before changing registration.
3. Prove the four known defects with RED tests:
   - issue-label workspace filter;
   - project-label endpoint-switching, unsupported archived-help promise, and `--all` pagination behavior;
   - empty label-description clearing;
   - project-label delete reporting success on `success=false`.
4. RED-test label pagination defaults, limits, raw `--after`, `--after --all`, client-side
   `retiredAt` scope isolation, independent `archivedAt`, edge-cursor traversal, history context,
   and next-page output before changing queries.
5. Freeze rejected routes/options (`label …`, label archive/unarchive, `--include-archived`,
   project-label `--include-unused`, and `project delete|trash|restore|archive`) as absence
   assertions.

**Phase gate:** every baseline interface row is `T=GREEN`; every known defect row is `T=RED` for the
expected reason.

### Phase 1 — Extract testable command runners

**IDs:** `LPL-TST-IL-MUTATE`, `LPL-TST-PL-MUTATE`, `LPL-TST-PROJ-UPDATE` plus their command parents.

1. Extract `runIssueLabel*` and `runProjectLabel*` functions without behavior changes.
2. Keep registration files responsible only for Commander syntax and action delegation.
3. Introduce injectable API/output/exit boundaries following the newer `config override` pattern.
4. Extract the project-update orchestration boundary sufficiently to mock update/resolution safely.

**Phase gate:** baseline characterization remains green with byte-equivalent human behavior.

### Phase 2 — Shared destructive and workspace safety

**IDs:** all `LPL-SAF-*`, `LPL-TST-CONFIRM`, `LPL-TST-ISSUE-TRASH`.

1. RED-test TTY, non-TTY, stderr, `--yes`, `--no-input`, and cancellation behavior.
2. Implement one shared confirmation primitive and integrate it with the workspace guard.
3. Migrate touched label deletion, label retirement, project trash, and issue trash.
4. Keep restore/untrash non-destructive while retaining workspace confirmation behavior.

**Phase gate:** no destructive invocation can hang with redirected stdin; prompt/error streams and
exit codes match the contract.

### Phase 3 — Label API lifecycle and list correctness

**IDs:** all label `LPL-API-*` entries and `LPL-API-FACADE`.

1. Add RED API-wrapper tests using SDK-shaped mutation payloads and raw-query-shaped state data.
2. Add independent nullable `retiredAt` and `archivedAt` fields to models and serializers.
3. Raw-select both fields for list/view/post-mutation reads; always pass `includeArchived: false`.
4. Replace the project-label endpoint split with one top-level raw catalog connection; include applied
   and unused definitions in bounded/all modes and never infer current usage from `lastAppliedAt`.
5. Correct workspace filtering, then apply client-side `retiredAt == null` unless
   `includeRetired` is true; never map it to `includeArchived`.
6. Adapt label query/results only through the exact M34 prerequisites in §4.6, retaining the last
   examined edge through retirement and color predicates; do not reimplement shared guards.
7. Add retire/restore wrappers that check `success` and returned ID, raw-refetch state, prove only
   `retiredAt` changed, and enforce deletion success.
8. Export every wrapper through the existing barrel and facade.

**Phase gate:** API tests prove exact SDK calls, pagination, model mapping, false-success rejection,
and contextualized errors.

### Phase 4 — Issue-label command completion

**IDs:** every non-baseline `LPL-CMD-IL-*`, `LPL-ARG-IL-*`, `LPL-OPT-IL-*`, and
`LPL-RULE-IL-*` row. M34 prerequisites in §4.6 must already be PASS before adopter verification.

Execute one command at a time in this order:

1. `list --workspace|--limit|--after|--all|--include-retired|--no-cursor-history`, rejected
   `--include-archived`, edge cursor after `retiredAt` filtering, distinct timestamp output,
   next/all-remaining output, history context, and state-aware views.
2. `create` safety/dry-run and independently tracked `-o/--output`/`--json` options and interaction.
3. `update` empty-description/safety/dry-run and independently tracked output options/interaction.
4. `delete` shared safety, dry-run, output options/interaction, and payload verification.
5. `retire` command, output options/interaction, and all other options.
6. `restore` command, output options/interaction, and all other options.
7. Full `ilbl` alias parity and `sync-aliases` regression.

**Phase gate:** all issue-label ledger rows have `I=DONE|BASELINE`, `T=GREEN`, `V=PASS`.

### Phase 5 — Project-label command completion

**IDs:** every non-baseline `LPL-CMD-PL-*`, `LPL-ARG-PL-*`, `LPL-OPT-PL-*`, and
`LPL-RULE-PL-*` row. M34 prerequisites in §4.6 must already be PASS before adopter verification.

Execute one command at a time in the same sequence as Phase 4, including each command's independent
`-o/--output` option and `--json` equivalence/conflict rule plus the explicit project-label catalog
behavior from AR-005, pagination-only `--all`, optional `--include-retired`, independent timestamp
handling, and rejected archive/`--include-unused` scope from §3.3, then prove `plbl` parity and
`sync-aliases` regression.

**Phase gate:** all project-label ledger rows have `I=DONE|BASELINE`, `T=GREEN`, `V=PASS`.

### Phase 6 — Project trash/untrash

**IDs:** `LPL-CMD-PROJ-UPDATE`, all `LPL-ARG/OPT/RULE-PROJ-*`, project API IDs, and project safety IDs.

1. Characterize every existing parser option and the current update-field predicate.
2. RED-test `--trash`/`--untrash` registration, XOR behavior, dry-run payload, and no-write behavior.
3. Extend the project update command input with conceptual `trashed` state, but route it through the dedicated SDK archive/unarchive mutations; live verification rejects forwarding it to `projectUpdate`.
4. Verify the existing raw UUID/alias resolver can retrieve a trashed project for restoration.
5. Add project update workspace safety, `-o/--output`, exact `--json` equivalence/conflict,
   `--yes`, and `--no-input`.
6. Prove all baseline project-update options remain accepted and routed unchanged.

**Phase gate:** every project-update row is green and verified; rejected standalone lifecycle routes
remain absent.

### Phase 7 — Output contracts and compatibility shim

**IDs:** all `LPL-OUT-*`, `LPL-CMD/ALS-LABELS-*`, `LPL-RULE-LABELS-DEPRECATION`.

1. RED-test default table mode, distinct human retirement/archive state, distinct nullable JSON/TSV
   timestamps, output-enum rejection, exact `-o json`/`--json` equivalence, conflict rejection,
   clean JSON stdout, and stderr-only diagnostics for every affected command.
2. Implement the remote mutation envelope consistently across touched commands and both JSON entry
   points.
3. Implement one structured JSON error path for these commands.
4. Convert `labels|lbl list|ls` to the documented help/deprecation shim without adding CRUD.
5. Pipe both JSON spellings for every changed route through `jq` and compare their envelopes in
   offline verification.

**Phase gate:** machine-output and compatibility contracts pass from the built CLI.

### Phase 8 — Documentation, conformance, and test registration

**IDs:** all `LPL-DOC-*`, `LPL-TST-CLI-*`, `LPL-TST-LIVE-*`, `LPL-TST-RUNNER`, `LPL-TST-TRACE`.

1. Update user and contributor documentation from the tested interface—not from the draft plan.
2. Add the milestone mapping without renumbering `LPL-*` IDs.
3. Seed/update `CONFORMANCE.md` with v1.4.14, applicability, blockers, and M33-owned waivers;
   cite M34 for the sole R10.2/R10.3 decision.
4. Publish the exact §4.6 dependency map and verify every referenced `CPH-*` ID exists.
5. Register offline tests in CI and ConceptM-only live tests in the live workflow only.
6. Document the AR-005 base-catalog contract and replace the unsupported archived/unused `--all`
   promise with exact pagination and retirement examples.
7. Add a traceability check that rejects missing/unknown ledger IDs.

**Phase gate:** docs examples execute successfully and the ledger traceability check reports zero
orphaned interface IDs and zero orphaned tests.

### Phase 9 — Full verification and handoff

**IDs:** all `LPL-VER-*`.

1. Run targeted and aggregate automated gates.
2. Run offline built-CLI checks.
3. Run live lifecycle suites only after the ConceptM preflight passes, including the applied versus
   never-applied project-label catalog fixture, with explicit fixture IDs and cleanup results; fail
   closed on any workspace mismatch.
4. Audit stdout/stderr, exit codes, dry-run no-write evidence, and ConceptM workspace targeting.
5. Re-read every ledger row; no parent can pass with an incomplete child.
6. Review the scoped diff and prove the main checkout remained untouched.

**Release gate:** every in-scope row is complete by the computed rule. Any `BLOCKED`, `FAIL`, `RED`,
or `NS` row prevents release and is named explicitly in the handoff.

---

## 9. Planned file structure

Names may be refined during Phase 1, but changes must remain within these responsibilities.

**New or likely new**

- `src/lib/confirm-destructive.ts`
- `src/lib/confirm-destructive.test.ts`
- `src/commands/issue-labels/retire.ts`
- `src/commands/issue-labels/restore.ts`
- `src/commands/project-labels/retire.ts`
- `src/commands/project-labels/restore.ts`
- co-located label command tests
- project update lifecycle test
- `tests/scripts/test-label-lifecycle-cli.sh`
- `tests/scripts/test-label-lifecycle-live.sh`
- `CONFORMANCE.md` if the repository still has no conformance note

**Modified**

- `src/commands/issue-labels/{register,list,view,create,update,delete,sync-aliases}.*`
- `src/commands/project-labels/{register,list,view,create,update,delete,sync-aliases}.*`
- `src/commands/project/{register,update}.ts`
- `src/commands/issue/{register,update}.ts` for shared trash confirmation only
- `src/lib/api/labels.ts`
- M34-owned `src/lib/pagination.ts` and `src/lib/cursor-history.ts` only through their public adapters
- `src/lib/api/projects.ts`
- `src/lib/api/index.ts`
- `src/lib/linear-client.ts`
- `src/lib/project-resolver.ts` if needed for trashed-resource resolution
- `src/lib/types.ts`
- `src/cli.ts` for the compatibility shim only
- `tests/scripts/run-all-tests.sh`
- `.github/workflows/ci.yml` and `.github/workflows/live.yml` only if registration requires changes
- `README.md`, `tests/README.md`, `CLAUDE.md`, `MILESTONES.md`

---

## 10. Out of scope

- A new generic `label` CRUD implementation or nested label umbrella.
- Permanent deletion of issues or projects.
- A project archive command or direct use of deprecated `projectArchive`.
- Label archive/unarchive commands or a public `--include-archived` label-list option; M33 reads and
  preserves `archivedAt` but manages only retirement.
- Bulk label mutation.
- Migration of legacy list/read commands from `-f/--format` to `-o/--output`; M33's changed
  mutation result commands adopt `-o/--output` directly.
- Global singular-noun migration.
- Global exit-code migration beyond changed paths.
- Changing existing issue/project list pagination flags to Standard `--paginate`/`--no-paginate`.
- Adding a public `--page-size` option solely for label lists.
- Adding `--page`, `--before`, `--cursor`, or another continuation synonym to label lists.
- Adding `--include-unused` or a public applied/unused usage filter; unused project-label definitions
  are part of the base catalog, and any future usage filter requires separately defined association
  semantics.
- Custom cursor tokens or label-local cursor-history persistence; both contracts are owned by M34.
- New remote-result cache, async, streaming, or plugin behavior.
- Release, version bump, publish, push, or PR creation unless separately authorized. This plan
  recommends but does not perform the coordinated `v1.0.0` release.

---

## 11. Evidence log

Append rows; do not rewrite history. A correction gets a new row that supersedes the earlier one.

| Date       | ID                       | Phase     | State | Evidence command/test                                                                                                | Observed result                                                                                                                                                                                      | Source/test path                                                   | Commit       |
| ---------- | ------------------------ | --------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| 2026-07-22 | LPL-DOC-PLAN             | IMPLEMENT | DONE  | Plan written in dedicated worktree                                                                                   | Contract and status ledgers created; no product implementation                                                                                                                                       | `docs/superpowers/plans/2026-07-22-label-project-lifecycle-tdd.md` | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | RED       | RED   | `rg -q '^## \\[ \\] Milestone M33: Label Lifecycle, Pagination, and Project Trash \\(v0\\.33\\.0\\)$' MILESTONES.md` | Exit 1 before the M33 entry existed                                                                                                                                                                  | `MILESTONES.md`                                                    | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | IMPLEMENT | DONE  | Add M33 with plan link, requirements, deviations, rollups, and verification sections                                 | M33 maps `v0.33.0` to the authoritative 237-ID ledger                                                                                                                                                | `MILESTONES.md`                                                    | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | RED       | RED   | Correction to prior escaped display: exact-heading `rg -q` assertion                                                 | Exit 1 before the M33 entry existed; this row supersedes the prior command rendering                                                                                                                 | `MILESTONES.md`                                                    | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | GREEN     | GREEN | Rerun the exact-heading `rg -q` assertion                                                                            | Exit 0 after adding M33                                                                                                                                                                              | `MILESTONES.md`                                                    | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | VERIFY    | PASS  | Structural Node audit plus `git diff --check`                                                                        | One M33 heading, 13 unique M33 rollups, 237 unique ledger IDs, no duplicate IDs, clean whitespace and diff                                                                                           | `MILESTONES.md`; this plan                                         | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | RED       | RED   | Reconcile the user-required raw-cursor/history contract with M33                                                     | Prior plan rejected `--after` and coupled `--all` to retired scope; plan reopened                                                                                                                    | this plan; M34 plan                                                | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | GREEN     | GREEN | Re-run structural plan audit after M34 reconciliation                                                                | 244 ledger rows, 244 unique IDs, corrected raw-cursor/history/page-two contracts, valid tables/fences/headings                                                                                       | this plan                                                          | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | VERIFY    | PASS  | Cross-plan dependency, stale-contract, link, and diff audit                                                          | M33 delegates shared mechanics to M34; no stale `--after` rejection or retired-scope coupling; clean diff check                                                                                      | this plan; M34 plan; `MILESTONES.md`                               | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | VERIFY    | PASS  | Validate M33 count/link/requirements after republish                                                                 | M33 entry names M34 dependency and matches 244 unique IDs                                                                                                                                            | `MILESTONES.md`; this plan                                         | working-tree |
| 2026-07-22 | LPL-DOC-BREAKING-VERSION | RED       | RED   | Compare integrated M33/M34 behavior with the prior `v0.33.0` mapping                                                 | Existing-array and `--all` behavior breaks cannot ship as a publishable minor                                                                                                                        | this plan; M34 plan; `MILESTONES.md`                               | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | VERIFY    | PASS  | Final post-versioning structural/count audit                                                                         | 245 ledger rows, 245 unique IDs, valid tables/fences/headings, matching milestone count/link, clean diff check                                                                                       | this plan; `MILESTONES.md`                                         | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | RED       | RED   | Apply CLI Standard v1.4.14 R4.1/R4.2 to every M33 result-bearing mutation                                            | Eleven commands had `--json` rows but no independently tracked canonical `-o/--output` option or equivalence/conflict rule                                                                           | this plan; CLI Design Standard v1.4.14                             | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | GREEN     | GREEN | Add one output-option ID and one interaction-rule ID per affected result command                                     | Added 22 atomic rows across five issue-label mutations, five project-label mutations, and `project update`; legacy lists remain explicitly scoped out                                                | this plan                                                          | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | VERIFY    | PASS  | Structural ID/table/count audit plus `git diff --check`                                                              | 267 ledger rows, 267 unique IDs, zero duplicates, 11 output-option IDs, 11 matching interaction IDs, matching milestone count, clean whitespace                                                      | this plan; `MILESTONES.md`                                         | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | VERIFY    | PASS  | Reconcile M33 requirements, rollups, verification, and count after AR-001                                            | Milestone names the canonical output contract and exact equivalence/conflict behavior and matches all 267 IDs                                                                                        | `MILESTONES.md`; this plan                                         | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | RED       | RED   | Reevaluate SDK declarations, generated raw schema, label filters, and read-only live list state                      | Methods exist, but the prior plan conflated retirement with generic archival: SDK models omit `retiredAt`, filters cannot select it, and `includeArchived` did not alter the observed retired record | SDK 61 generated files; this plan                                  | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | GREEN     | GREEN | Split retirement/archive contracts and reconcile M33 with M34 adoption                                               | Added 11 net atomic IDs for independent timestamps, archive-scope rejection, raw views, state tests/verification/docs; lifecycle now uses client-side `retiredAt` and examined-edge cursors          | this plan; M34 plan; `MILESTONES.md`                               | working-tree |
| 2026-07-22 | LPL-DOC-PLAN             | VERIFY    | PASS  | Cross-plan ID/table/count/state-term audit plus `git diff --check`                                                   | M33 has 278 rows/278 unique IDs; M34 remains 195 and M35 remains 284; no duplicates or malformed tables; milestone counts match; whitespace clean                                                    | this plan; M34 plan; M35 plan; `MILESTONES.md`                     | working-tree |
| 2026-07-22 | LPL-DOC-MILESTONE        | VERIFY    | PASS  | Reconcile M33/M34 milestone contracts after label-state correction                                                   | Milestones distinguish `retiredAt` from `archivedAt`, retain `includeArchived: false`, reject archive scope, and match the 278-ID M33 ledger                                                         | `MILESTONES.md`; this plan; M34 plan                               | working-tree |
| 2026-07-23 | LPL-DOC-PLAN             | IMPLEMENT | DONE  | Apply accepted AR-003 ownership split and ConceptM live-test guard                                                   | M33 now owns label adopters only, names exact M34 prerequisites, and forbids live writes outside ConceptM                                                                                            | this plan; M34 plan; `MILESTONES.md`                               | working-tree |
| 2026-07-23 | LPL-DOC-PLAN             | VERIFY    | PASS  | Atomic-ID, M34 dependency, Markdown, whitespace, and scoped-status audit                                             | 309 unique atomic IDs; all 60 dependency rows reference known local and M34 IDs; ConceptM policy present; tables/fences/headings and diff checks clean                                               | this plan; M34/M35 plans; `MILESTONES.md`                          | working-tree |
| 2026-07-24 | LPL-DOC-PLAN             | RED       | RED   | Compare AR-005 against current implementation, SDK 61 generated contracts, and CLI Standard v1.4.14                  | Existing alternate query and archived-help claim were unsupported; applied/unused catalog semantics lacked atomic IDs and ConceptM proof                                                             | `src/lib/api/labels.ts`; SDK 61 generated files; this plan         | working-tree |
| 2026-07-24 | LPL-DOC-PLAN             | IMPLEMENT | DONE  | Apply accepted AR-005 project-label catalog decision                                                                 | Added eight atomic IDs for base catalog scope, unified query, usage non-inference, rejection/help, tests, docs, and verification                                                                     | this plan; `MILESTONES.md`                                         | working-tree |
| 2026-07-24 | LPL-DOC-PLAN             | VERIFY    | PASS  | Atomic-ID, M34 dependency, Markdown-table, fence, stale-contract, milestone-count, and whitespace audit              | 317 atomic rows/317 unique IDs; eight AR-005 IDs present; all 60 dependency rows resolve against 201 M34 IDs; milestone count 317; tables/fences and diff checks clean                               | this plan; M34 plan; `MILESTONES.md`                               | working-tree |

| 2026-07-24 | LPL-API-LABEL-RETIREDAT | RED | RED | Focused API tests before shared raw label reader existed | Module/API contracts were absent and the focused suite failed | `src/lib/api/labels.pagination.test.ts` | working-tree |
| 2026-07-24 | LPL-CMD-IL-GROUP | RED | RED | Focused command registration tests before grouped runners were wired | All six canonical route/alias assertions failed | `src/commands/labels/register.test.ts` | working-tree |
| 2026-07-24 | LPL-CMD-PROJ-UPDATE | RED | RED | Focused project lifecycle tests before flags and result controls existed | Six lifecycle/parser/output assertions failed | `src/commands/project/update.lifecycle.test.ts` | working-tree |
| 2026-07-24 | LPL-CMD-LABELS-SHIM | RED | RED | Focused compatibility-shim test before registration | Shim module and routes were absent | `src/commands/labels/register-shim.test.ts` | working-tree |
| 2026-07-24 | LPL-SAF-ISSUE-TRASH | RED | RED | Focused issue-trash safety test before shared destructive confirmation | Two confirmation/non-TTY assertions failed | `src/commands/issue/update.trash-safety.test.ts` | working-tree |
| 2026-07-24 | LPL-TST-RUNNER | GREEN | GREEN | Run focused label API/runner/registration/project/shim/safety suites | All focused M33 unit suites passed | M33 Vitest files | working-tree |
| 2026-07-24 | LPL-VER-OFFLINE | VERIFY | PASS | `bash tests/scripts/test-label-lifecycle-cli.sh` | 31 passed, 0 failed against built CLI | `tests/scripts/test-label-lifecycle-cli.sh` | working-tree |
| 2026-07-24 | LPL-API-PROJ-TRASHED-PAYLOAD | LIVE-RED | RED | Fail-closed ConceptM lifecycle run using `projectUpdate({ trashed: true })` | Linear returned internal server error; every disposable fixture was cleaned | `tests/scripts/test-label-lifecycle-live.ts`; `src/lib/api/projects.ts` | working-tree |
| 2026-07-24 | LPL-API-PROJ-TRASHED-PAYLOAD | IMPLEMENT | DONE | Replace update-field forwarding with `archiveProject(id, { trash: true })` and `unarchiveProject(id)` | Dedicated mutation probe succeeded for trash and untrash; probe fixture cleaned | `src/lib/api/projects.ts`; `src/lib/api/projects.trash.test.ts` | working-tree |
| 2026-07-24 | LPL-VER-LIVE-CONCEPTM | VERIFY | PASS | Fail-closed M33 live harness | Exact ConceptM organization/workspace confirmed before writes | `tests/scripts/test-label-lifecycle-live.ts` | working-tree |
| 2026-07-24 | LPL-VER-LIVE-LABELS | VERIFY | PASS | Disposable issue/project-label lifecycle and cursor traversal | Page two, all remaining, history context, retire/restore independence, applied/unused catalog, delete, and cleanup passed | `tests/scripts/test-label-lifecycle-live.ts` | working-tree |
| 2026-07-24 | LPL-VER-LIVE-PROJECT | VERIFY | PASS | Disposable project create → trash → untrash → trash lifecycle | Dedicated lifecycle mutations passed and cleanup completed | `tests/scripts/test-label-lifecycle-live.ts` | working-tree |

| 2026-07-24 | LPL-VER-UNIT | VERIFY | PASS | `npm test -- --run` after final source corrections | 68 test files passed, 1 skipped; 941 tests passed, 1 skipped | repository Vitest suite | working-tree |
| 2026-07-24 | LPL-VER-TYPE | VERIFY | PASS | `npm run typecheck` | TypeScript completed with no diagnostics | repository typecheck gate | working-tree |
| 2026-07-24 | LPL-VER-LINT | VERIFY | PASS | `npm run lint` after scoped import sorting and redundant-catch removal | ESLint completed with zero errors and zero warnings | repository lint gate | working-tree |
| 2026-07-24 | LPL-VER-BUILD | VERIFY | PASS | `npm run build` | ESM, source map, and declarations built successfully | repository build gate | working-tree |
| 2026-07-24 | LPL-VER-OFFLINE | VERIFY | PASS | Final built `bash tests/scripts/test-label-lifecycle-cli.sh` | 31 passed, 0 failed | `tests/scripts/test-label-lifecycle-cli.sh` | working-tree |
| 2026-07-24 | LPL-VER-LIVE-CONCEPTM | VERIFY | PASS | Hermetic named-workspace rerun with temporary XDG roots | ConceptM selected without host profile dependency; all fixtures cleaned | `tests/scripts/test-label-lifecycle-live.ts`; `.github/workflows/live.yml` | working-tree |
| 2026-07-24 | LPL-VER-TRACE | VERIFY | PASS | `npx vitest run src/lib/m33-traceability.test.ts` | 317 unique plan IDs and 317 exact trace rows; live API and provider-order corrections asserted | `src/lib/m33-traceability.test.ts`; M33 trace report | working-tree |

---

## 12. Initial plan audit

- Every approved command path has a command ID.
- Every positional argument in the changed command surface has an argument ID.
- Every existing or new option on the affected label commands and `project update` has an option ID.
- Every new SDK/API operation has an API ID.
- Every pagination default, raw-cursor option, command-specific interaction/rejection, edge/filter
  invariant, history handoff, ordering rule, output field, and compatibility behavior has an ID.
- M34 is the sole shared pagination owner; every M33 adopter row has exact acyclic prerequisites.
- Every live test is fail-closed to ConceptM with fixture-ID and cleanup evidence.
- Project-label catalog scope is explicit: applied and unused definitions share one base connection;
  `--all` changes only traversal and `lastAppliedAt` never represents current association.
- Supported page-two behavior and deliberately unsupported numeric/backward/cursor-alias options
  have separate positive/negative contract IDs and tests.
- Every destructive, noninteractive, dry-run, workspace, and stream rule has a behavior ID.
- Every test harness, documentation obligation, standard deviation, and aggregate gate has an ID.
- All 317 atomic rows are implemented or preserved as baseline, tested where applicable, independently verified, and mapped in the M33 traceability report.
- The plan intentionally requires RED evidence before implementation for changed behavior.
