# M25/M26 and Historical Milestone Reconciliation

> **Audit date:** 2026-07-26
>
> **Repository baseline:** `52165b531f05d4a0eae5ebf4f083d7dd54c92752`
>
> **Standard:** CLI Design Standard v1.4.14, publishable tier. Applicable axes are configurable,
> networked, destructive operations, scripted consumers, interactive flows, and secrets. Streaming,
> plugins, long-running operations, and offline caching are not introduced by M25 or M26.
>
> **Purpose:** Reconcile tracking state without treating an old checkbox as proof. `DONE` requires
> current implementation and evidence; `PARTIAL` means only part of the original atomic contract
> exists; `OPEN` means the contract is absent; `SUPERSEDED` means later approved behavior made the
> old contract invalid.

## 1. Executive result

- At the audited baseline, M25 was genuinely unimplemented: all seven IDs were open. Its approved
  disposition is now **superseded, not completed or deprecated**. It is excluded from M36 and v1;
  any future interactive issue create/update work requires a newly scoped post-v1 project with new
  IDs.
- At the audited baseline, M26 was partially implemented: one ID complete, nine partial, eight open,
  and one superseded. Its approved disposition is now **superseded, not completed**. Every retained
  behavioral requirement is transferred to a dedicated M36 owner; obsolete interface and
  implementation prescriptions are retired.
- The original M26 `-f/--format` design must not be implemented as written. CLI Standard R3.4 and
  R4.2 reserve `-f` for force and require `-o/--output` plus equivalent `--json`; M33-M35 established
  that newer result commands use the Standard spelling.
- Unchecked rows inside completed historical milestones are not active product backlog. They are
  reconciled as completed where the milestone already contains explicit evidence, or `[~]` where
  they were optional, superseded, deferred, duplicate, or never part of the completed scope.

## 2. M25 atomic audit

This table records the observed baseline before the owner decision. The approved final disposition
is recorded immediately below the Standard assessment.

| ID         | Baseline status | Evidence                                                                                                          | Audit recommendation |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| `M25-T01`  | OPEN            | `src/ui/components/` contains project/shared Ink components, but no issue form primitives                         | Keep open pending S2 |
| `M25-T02`  | OPEN            | `src/commands/issue/create.ts` explicitly says interactive mode is future; registration has no `-I/--interactive` | Keep open pending S2 |
| `M25-T03`  | OPEN            | issue update is non-interactive and registers no interactive option                                               | Keep open pending S2 |
| `M25-T04`  | OPEN            | issue view registers JSON/web/detail options only                                                                 | Keep open pending S2 |
| `M25-T05`  | OPEN            | issue list has no interactive option or Ink runner                                                                | Keep open pending S2 |
| `M25-TS01` | OPEN            | no issue-interactive automated scenario exists                                                                    | Keep open pending S2 |
| `M25-TS02` | OPEN            | issue help and README contain no M25 interactive contract                                                         | Keep open pending S2 |

### M25 Standard assessment

CLI Standard R8.5 makes interactive setup/wizard flows optional. If M25 is retained, every prompt
must have a complete non-interactive equivalent, respect `--no-input`, remain cancelable with
SIGINT/130, and keep prompts/diagnostics off stdout. M25 is therefore a product choice, not a v1.0.0
conformance blocker.

### Approved M25 disposition

| M25 ID     | Approved disposition     | Reason                                                                                                           |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `M25-T01`  | SUPERSEDED               | Shared primitives have no independent user value; recreate them only inside a newly approved interactive project |
| `M25-T02`  | SUPERSEDED               | Interactive create may be reconsidered after v1, but the stale M25 scope and ID are closed                       |
| `M25-T03`  | SUPERSEDED               | Interactive update may be reconsidered with create after v1 under new scope and IDs                              |
| `M25-T04`  | SUPERSEDED / NOT PLANNED | Existing table, JSON, detail, and web paths already cover issue viewing                                          |
| `M25-T05`  | SUPERSEDED / NOT PLANNED | Existing list, filter, JSON, table, and web behavior avoids a second interactive list product                    |
| `M25-TS01` | SUPERSEDED               | Test work closes with the unimplemented interactive behaviors                                                    |
| `M25-TS02` | SUPERSEDED               | Documentation work closes with the unimplemented interactive behaviors                                           |

`DEPRECATED` is intentionally not used: no M25 public interface shipped. A future owner must create
a new post-v1 project rather than reopening these historical IDs.

## 3. M26 atomic audit

This table records the observed baseline and the pre-decision audit recommendation. The approved
final disposition is the transfer map immediately below the Standard corrections.

| ID         | Baseline status | Evidence                                                                                                                                       | Audit recommendation                                      |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `M26-T01`  | OPEN            | `showResolvedAlias`, `showValidating`, `showValidated`, `showSuccess`, `showInfo`, and `showWarning` still use stdout                          | Keep open; R7.1 blocker                                   |
| `M26-T02`  | PARTIAL         | shared JSON/TSV formatters exist, but no complete output/progress abstraction; TSV omits CR handling and replaces rather than encodes controls | Mark in progress                                          |
| `M26-T03`  | PARTIAL         | global `-q/--quiet` and logger level exist, but legacy shared output bypasses the logger                                                       | Mark in progress                                          |
| `M26-T04`  | OPEN            | project-list TSV sanitizes only some fields; titles/status/team/lead/custom columns can still contain raw tabs/newlines/CR                     | Keep open                                                 |
| `M26-T05`  | OPEN            | project list retains separate table, TSV, and custom-column renderers                                                                          | Keep open                                                 |
| `M26-T06`  | DONE            | project-list JSON and TSV emit no human total; the total remains table-only                                                                    | Mark complete                                             |
| `M26-T07`  | OPEN            | project view exposes no machine-output selector                                                                                                | Keep open; R4.2 affected                                  |
| `M26-T08`  | OPEN            | project dependency list exposes only human output                                                                                              | Keep open; R4.2 affected                                  |
| `M26-T09`  | PARTIAL         | project create supports `--json`, but not canonical `-o/--output`; no TSV contract                                                             | Mark in progress                                          |
| `M26-T10`  | PARTIAL         | project update supports `-o table\|json` plus `--json`; original TSV contract is absent                                                        | Mark in progress                                          |
| `M26-T11`  | PARTIAL         | issue create supports `--json`, but not canonical `-o/--output`; no TSV contract                                                               | Mark in progress                                          |
| `M26-T12`  | PARTIAL         | issue update supports `--json`, but not canonical `-o/--output`; no TSV contract                                                               | Mark in progress                                          |
| `M26-T13`  | PARTIAL         | README documents current list output and machine errors, but not repository-wide stream/quiet behavior                                         | Mark in progress                                          |
| `M26-T14`  | PARTIAL         | newer commands document output options, while project view/dependencies and older mutations do not                                             | Mark in progress                                          |
| `M26-T15`  | OPEN            | `OUTPUT_STREAMS_PROPOSAL.md` still describes the old `--format` design as proposed work                                                        | Keep open                                                 |
| `M26-TS01` | OPEN            | no repository-wide stdout/stderr/quiet integration suite exists                                                                                | Keep open                                                 |
| `M26-TS02` | OPEN            | no focused TSV-control-character integration suite exists                                                                                      | Keep open                                                 |
| `M26-TS03` | PARTIAL         | several command suites parse JSON with jq/Node, but no complete create-extract-update workflow gate exists                                     | Mark in progress                                          |
| `M26-TS04` | SUPERSEDED      | M33-M35 intentionally break list formats/JSON under the accepted v1 release                                                                    | Mark `[~]`; replace with a migration-contract gate in M36 |

### M26 Standard corrections

The rebaselined design must explicitly differ from the old milestone in these places:

1. Use `-o/--output` and equivalent `--json` under R4.1/R4.2; do not restore `-f/--format`.
2. Requested human results remain stdout. Only diagnostics, progress, prompts, warnings, and errors
   move to stderr under R7.1. The old phrase "all human messages to stderr" is too broad.
3. `--quiet` suppresses nonessential diagnostics only; it never suppresses requested results or
   implies prompt consent (R4.4).
4. Machine errors use one stable JSON object on stderr (R7.8); silencing `console.log` is not a
   substitute for correct stream ownership.
5. Stable machine schemas and ordering are versioned interface under R7.2/R9.3.

### Approved M26 disposition and transfer map

M26 remains historical evidence. It is not an implementation queue. A transferred ID owns the
behavior under current CLI conventions; `RETIRED` means the old prescription is intentionally not
carried forward.

| M26 ID     | Approved disposition | M36 owner or reason                                                                                                                                                 |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M26-T01`  | SUPERSEDED           | `RLS-OUT-SHARED-DIAGNOSTICS`                                                                                                                                        |
| `M26-T02`  | SUPERSEDED           | `RLS-OUT-JSON-CLEAN`, `RLS-OUT-PROJECT-LIST-TSV`, and `RLS-OUT-SHARED-DIAGNOSTICS`; the prescribed helper API is `RETIRED`                                          |
| `M26-T03`  | SUPERSEDED           | `RLS-OUT-QUIET`                                                                                                                                                     |
| `M26-T04`  | SUPERSEDED           | `RLS-OUT-PROJECT-LIST-TSV`                                                                                                                                          |
| `M26-T05`  | SUPERSEDED           | Prescribed formatter consolidation and duplication percentage are implementation details and `RETIRED`                                                              |
| `M26-T06`  | COMPLETE             | Existing project-list JSON/TSV result purity remains protected by M36 stream and format gates                                                                       |
| `M26-T07`  | SUPERSEDED           | `RLS-OUT-PROJECT-VIEW`; old universal TSV requirement is `RETIRED`                                                                                                  |
| `M26-T08`  | SUPERSEDED           | `RLS-OUT-PROJECT-DEPENDENCIES-LIST`; old universal TSV requirement is `RETIRED`                                                                                     |
| `M26-T09`  | SUPERSEDED           | `RLS-OUT-PROJECT-CREATE`; old mutation TSV requirement is `RETIRED`                                                                                                 |
| `M26-T10`  | SUPERSEDED           | `RLS-OUT-PROJECT-UPDATE`; old mutation TSV requirement is `RETIRED`                                                                                                 |
| `M26-T11`  | SUPERSEDED           | `RLS-OUT-ISSUE-CREATE`; old mutation TSV requirement is `RETIRED`                                                                                                   |
| `M26-T12`  | SUPERSEDED           | `RLS-OUT-ISSUE-UPDATE`; old mutation TSV requirement is `RETIRED`                                                                                                   |
| `M26-T13`  | SUPERSEDED           | `RLS-DOC-README`                                                                                                                                                    |
| `M26-T14`  | SUPERSEDED           | `RLS-OUT-PROJECT-VIEW`, `RLS-OUT-PROJECT-DEPENDENCIES-LIST`, `RLS-OUT-PROJECT-CREATE`, `RLS-OUT-PROJECT-UPDATE`, `RLS-OUT-ISSUE-CREATE`, and `RLS-OUT-ISSUE-UPDATE` |
| `M26-T15`  | SUPERSEDED           | This reconciliation replaces the obsolete proposal-status work                                                                                                      |
| `M26-TS01` | SUPERSEDED           | `RLS-TST-STREAMS`                                                                                                                                                   |
| `M26-TS02` | SUPERSEDED           | `RLS-TST-TSV`                                                                                                                                                       |
| `M26-TS03` | SUPERSEDED           | `RLS-TST-AUTOMATION`                                                                                                                                                |
| `M26-TS04` | SUPERSEDED           | `RLS-DOC-MIGRATION` plus the M36 interface migration gate                                                                                                           |

The current repository and CLI Standard support table/JSON output for result commands and TSV on
list/export surfaces where it remains useful. They do not justify carrying M26's universal TSV
requirement into view and mutation commands. This is an explicit scope correction, not a lost task.

## 4. Historical checkbox reconciliation policy

Archive files preserve rationale, but open boxes inside a completed or superseded archive cannot
remain indistinguishable from active backlog. The reconciliation uses:

- `[x]` only where the same section already records explicit completion evidence.
- `[~]` for duplicate plans, optional work, superseded designs, deferred live/manual checks, or
  historical expansion that was not part of the delivered milestone.
- An archive note names the authoritative replacement rather than inventing retrospective test
  evidence.

### Reconciled groups

| File/group                                               | Classification      | Reason                                                                            |
| -------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| root M15 interactive verification                        | `[~]`               | explicitly deferred to M25, not a failed M15 completion gate                      |
| root M15.5 final verification                            | `[x]`               | completed M15.5 section and current CI/list suites provide evidence               |
| root M15.6 duplicate verification                        | `[x]`               | the same section records completed tasks, commit, tag, docs, and release evidence |
| archive 01 original M08/M09                              | `[~]`               | abandoned duplicate milestone numbers, superseded by later completed M08/M09      |
| archive 01 in-progress M12                               | `[~]` for open rows | superseded by the completed authoritative M12 in archive 02                       |
| archive 01 future M14/M15 pointers                       | `[~]`               | replaced by later authoritative milestone definitions                             |
| archive 02 M14.5 unchecked tests                         | `[~]`               | historical optional/unverified expansion, not an active completion gate           |
| archive 02 M14 unchecked test expansion                  | `[~]`               | the proposed 5-week expansion was not the delivered milestone contract            |
| archive 02 M19 pointer                                   | `[~]`               | superseded by completed issue milestone M15                                       |
| archive 03 M23 live follow-ups                           | `[~]`               | current ConceptM live workflow owns live coverage; historical rows are not active |
| archive 03 M22/M22.1 deferred, optional, and manual rows | `[~]`               | completed implementation is recorded; old live/manual rows are not current gates  |
| archive 03 duplicate M22.1 heading                       | `[~]`               | empty duplicate immediately preceding the authoritative completed entry           |

## 5. Release-readiness findings discovered during reconciliation

- GitHub CI for merged PR18 succeeded, but the ConceptM live workflow failed at the M34 identity
  guard. `whoami` proved `Organization: ConceptM` and `Workspace: conceptm`, while the harness
  incorrectly required `Active: ConceptM`; the environment-backed default prints
  `Active: (default)`. M33 completed and cleaned up before this read-only M34 failure.
- The source version is `0.32.0`; npm `latest` is `0.24.1`. M33-M35 are therefore unreleased.
- `npm audit --omit=dev` reports one high production advisory through `ink -> ws@8.18.3`; a fixed
  version is available.
- The tag-triggered release workflow publishes directly, while `npm run release` invokes `np`,
  whose default workflow can also publish. M36 must establish one publication owner.

These are M36 blockers. They do not retroactively reopen the completed M33-M35 implementation
ledgers, but v1.0.0 cannot ship until each has independent evidence.
