# Issue and Project Comments — ID-Level TDD Project Plan

> **Plan status:** Implemented and verified in the dedicated worktree; all 318 atomic IDs have published completion evidence. The project owner accepted the coordinated `v1.0.0`-or-later path on 2026-07-25, resolving R9.3 version selection while retaining the explicit R9.2 nonconformance.
>
> **Milestone:** M35 — First-class Issue and Project Comments (breaking release; `v1.0.0` or later
> accepted under CLI Design Standard R9.3).
>
> **Authoritative contract and ID registry:** This file defines the M35 contract and its 318 stable
> atomic IDs. Its per-command tables retain their plan-time baseline states.
>
> **Authoritative completion map and evidence ledger:**
> [2026-07-24-M35-traceability.md](2026-07-24-M35-traceability.md) records the current I/T/V status
> and evidence for every unique atomic ID; it is the sole source for completion rollups.
>
> **Implementation rule:** Work only in the consolidated worktree
> `/Users/stevemorin/wt/agent2linear/label-project-lifecycle-tdd-plan` on
> `plan/label-project-lifecycle-tdd`; never implement from the main checkout. Every changed-behavior
> ID must complete its own RED → IMPLEMENT → GREEN → VERIFY lifecycle before it can be marked
> complete. Baseline, documentation, aggregate, and decision IDs use their applicable phases and
> explicit `N/A` statuses; they must not fabricate RED/GREEN evidence for behavior they do not change.

**Goal:** Give humans and agents symmetrical, independently listable and creatable comments on
Linear issues and projects, with explicit cursor pagination, safe workspace-targeted writes,
human-readable defaults, stable JSON envelopes, and no retained legacy issue-comment syntax.

**Architecture:** Replace the current issue-comment leaf command with `comment add` and
`comment list` groups under both `issue` and `project`. Resolve targets through the existing issue
and project resolvers. Put target-neutral comment models, raw GraphQL operations, body input, output
shaping, and error normalization behind shared modules. Adopt M34's raw-cursor/page-history
primitive rather than creating comment-local pagination. Keep Commander registration declarative
and actions independently testable.

**Tech stack:** TypeScript ESM, Commander, `@linear/sdk` 61.x client transport, raw Linear GraphQL,
Vitest, shell integration tests, tsup, TypeScript, ESLint.

**CLI standard:** Publishable tier, standard noun-verb profile, pinned to CLI Design Standard
**v1.4.14**. Applicable axes: configurable, networked, scripted consumers, mutations, and secrets.
N/A for this milestone: destructive operations, long-running/async operations, streaming output,
and plugins. M34 owns cursor-history XDG state; M35 supplies target/query context to it.

---

## 1. Command, argument, and option ledger

### 1.1 Commands and positional arguments

| ID                            | Interface element                | Atomic contract                                                               | I   | T   | V   |
| ----------------------------- | -------------------------------- | ----------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-CMD-ISSUE-GROUP`         | `issue comment`                  | Register a command group beneath the existing singular `issue` group          | NS  | NS  | NS  |
| `CMT-CMD-ISSUE-GROUP-BARE`    | bare `issue comment`             | Print group help to stderr and exit `2`; perform no API call                  | NS  | NS  | NS  |
| `CMT-CMD-ISSUE-ADD`           | `issue comment add`              | Create exactly one direct issue comment                                       | NS  | NS  | NS  |
| `CMT-ARG-ISSUE-ADD-TARGET`    | add `<identifier>`               | Required issue UUID or `TEAM-123`, resolved in the active workspace           | NS  | NS  | NS  |
| `CMT-CMD-ISSUE-LIST`          | `issue comment list`             | Read one bounded page or all direct issue comments                            | NS  | NS  | NS  |
| `CMT-ARG-ISSUE-LIST-TARGET`   | list `<identifier>`              | Required issue UUID or `TEAM-123`, resolved in the active workspace           | NS  | NS  | NS  |
| `CMT-CMD-PROJECT-GROUP`       | `project comment`                | Register a command group beneath the existing singular `project`/`proj` group | NS  | NS  | NS  |
| `CMT-CMD-PROJECT-GROUP-BARE`  | bare `project comment`           | Print group help to stderr and exit `2`; perform no API call                  | NS  | NS  | NS  |
| `CMT-CMD-PROJECT-ADD`         | `project comment add`            | Create exactly one direct project comment, not a project-update comment       | NS  | NS  | NS  |
| `CMT-ARG-PROJECT-ADD-TARGET`  | add `<name-or-id>`               | Required project ID, configured alias, cache hit, or resolvable name          | NS  | NS  | NS  |
| `CMT-CMD-PROJECT-LIST`        | `project comment list`           | Read one bounded page or all direct project comments                          | NS  | NS  | NS  |
| `CMT-ARG-PROJECT-LIST-TARGET` | list `<name-or-id>`              | Required project ID, configured alias, cache hit, or resolvable name          | NS  | NS  | NS  |
| `CMT-CMD-LEGACY-REJECT`       | old `issue comment <identifier>` | Remove execution path; exit `2` with exact `comment add` replacement          | NS  | NS  | NS  |
| `CMT-CMD-NO-ALIASES`          | comment aliases                  | Do not add `comments`, `cmt`, `new`, `ls`, or other undocumented aliases      | NS  | NS  | NS  |

### 1.2 Relevant inherited options

These options already exist globally. Each row tracks their behavior specifically through all four
new commands; `BASELINE` does not mean verified until `T=GREEN` and `V=PASS`.

| ID                         | Option               | Contract on comment commands                                                                | I        | T   | V   |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------- | -------- | --- | --- |
| `CMT-OPT-GLOBAL-CWD`       | `-C, --cwd <dir>`    | Change process cwd before resolution and relative body-file access                          | BASELINE | NS  | NS  |
| `CMT-OPT-GLOBAL-WORKSPACE` | `--workspace <name>` | Explicitly select workspace/profile; takes normal precedence                                | BASELINE | NS  | NS  |
| `CMT-OPT-GLOBAL-APIKEY`    | `--api-key <key\|->` | Use existing ad-hoc credential flow; `-` conflicts with stdin body                          | BASELINE | NS  | NS  |
| `CMT-OPT-GLOBAL-QUIET`     | `-q, --quiet`        | Suppress progress/banner diagnostics, never requested results or errors                     | BASELINE | NS  | NS  |
| `CMT-OPT-GLOBAL-VERBOSE`   | `-v, --verbose`      | Preserve existing debug behavior; ignored-`--limit` note may appear here                    | BASELINE | NS  | NS  |
| `CMT-OPT-GLOBAL-NOCOLOR`   | `--no-color`         | Remove emoji/color decoration from human output only                                        | BASELINE | NS  | NS  |
| `CMT-OPT-COMMENT-HELP`     | `-h, --help`         | Every group/leaf shows purpose, arguments, defaults, interactions, and examples; stdout/`0` | BASELINE | NS  | NS  |

### 1.3 `issue comment add` options

| ID                    | Option                       | Atomic contract                                                             | I   | T   | V   |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OPT-IA-BODY`     | `--body <markdown>`          | Optional inline Markdown source; exact nonempty content preserved           | NS  | NS  | NS  |
| `CMT-OPT-IA-BODYFILE` | `--body-file <path\|->`      | Optional UTF-8 file source; `-` means stdin; no short alias                 | NS  | NS  | NS  |
| `CMT-OPT-IA-REPLYTO`  | `--reply-to <comment-id>`    | Optional parent comment ID; must belong to resolved issue                   | NS  | NS  | NS  |
| `CMT-OPT-IA-DRYRUN`   | `--dry-run`                  | Resolve/validate and render plan; no prompt and no mutation                 | NS  | NS  | NS  |
| `CMT-OPT-IA-OUTPUT`   | `-o, --output <table\|json>` | Default `table`; reject any other value before API mutation                 | NS  | NS  | NS  |
| `CMT-OPT-IA-JSON`     | `--json`                     | Exact equivalent of `--output json`                                         | NS  | NS  | NS  |
| `CMT-OPT-IA-YES`      | `-y, --yes`                  | Bypass existing workspace confirmation only                                 | NS  | NS  | NS  |
| `CMT-OPT-IA-NOINPUT`  | `--no-input`                 | Never prompt; without sufficient explicit workspace consent, usage exit `2` | NS  | NS  | NS  |

### 1.4 `project comment add` options

| ID                    | Option                       | Atomic contract                                                             | I   | T   | V   |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OPT-PA-BODY`     | `--body <markdown>`          | Optional inline Markdown source; exact nonempty content preserved           | NS  | NS  | NS  |
| `CMT-OPT-PA-BODYFILE` | `--body-file <path\|->`      | Optional UTF-8 file source; `-` means stdin; no short alias                 | NS  | NS  | NS  |
| `CMT-OPT-PA-REPLYTO`  | `--reply-to <comment-id>`    | Optional parent comment ID; must belong to resolved project                 | NS  | NS  | NS  |
| `CMT-OPT-PA-DRYRUN`   | `--dry-run`                  | Resolve/validate and render plan; no prompt and no mutation                 | NS  | NS  | NS  |
| `CMT-OPT-PA-OUTPUT`   | `-o, --output <table\|json>` | Default `table`; reject any other value before API mutation                 | NS  | NS  | NS  |
| `CMT-OPT-PA-JSON`     | `--json`                     | Exact equivalent of `--output json`                                         | NS  | NS  | NS  |
| `CMT-OPT-PA-YES`      | `-y, --yes`                  | Bypass existing workspace confirmation only                                 | NS  | NS  | NS  |
| `CMT-OPT-PA-NOINPUT`  | `--no-input`                 | Never prompt; without sufficient explicit workspace consent, usage exit `2` | NS  | NS  | NS  |

### 1.5 `issue comment list` options

| ID                        | Option                             | Atomic contract                                                                                | I   | T   | V   |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OPT-IL-LIMIT`        | `--limit <number>`                 | Expose the M34-backed bound with default 50                                                    | NS  | NS  | NS  |
| `CMT-RULE-IL-LIMIT-PARSE` | issue list limit syntax            | Accept decimal integers only; reject empty, nonnumeric, and fractional input before API access | NS  | NS  | NS  |
| `CMT-RULE-IL-LIMIT-MIN`   | `issue comment list X --limit 0`   | Reject below 1 with usage exit 2 before API access                                             | NS  | NS  | NS  |
| `CMT-RULE-IL-LIMIT-MAX`   | `issue comment list X --limit 251` | Reject above 250 with usage exit 2 before API access                                           | NS  | NS  | NS  |
| `CMT-OPT-IL-AFTER`        | `--after <cursor>`                 | Nonempty raw Linear cursor; passed byte-for-byte as GraphQL `after`                            | NS  | NS  | NS  |
| `CMT-OPT-IL-ALL`          | `-a, --all`                        | Fetch all remaining pages at internal page size up to 250                                      | NS  | NS  | NS  |
| `CMT-OPT-IL-NOHISTORY`    | `--no-cursor-history`              | Emit cursor/commands but skip M34 local history write                                          | NS  | NS  | NS  |
| `CMT-OPT-IL-OUTPUT`       | `-o, --output <table\|json>`       | Default `table`; reject unrecognized values                                                    | NS  | NS  | NS  |
| `CMT-OPT-IL-JSON`         | `--json`                           | Exact equivalent of `--output json`                                                            | NS  | NS  | NS  |

### 1.6 `project comment list` options

| ID                        | Option                               | Atomic contract                                                                                | I   | T   | V   |
| ------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OPT-PL-LIMIT`        | `--limit <number>`                   | Expose the M34-backed bound with default 50                                                    | NS  | NS  | NS  |
| `CMT-RULE-PL-LIMIT-PARSE` | project list limit syntax            | Accept decimal integers only; reject empty, nonnumeric, and fractional input before API access | NS  | NS  | NS  |
| `CMT-RULE-PL-LIMIT-MIN`   | `project comment list X --limit 0`   | Reject below 1 with usage exit 2 before API access                                             | NS  | NS  | NS  |
| `CMT-RULE-PL-LIMIT-MAX`   | `project comment list X --limit 251` | Reject above 250 with usage exit 2 before API access                                           | NS  | NS  | NS  |
| `CMT-OPT-PL-AFTER`        | `--after <cursor>`                   | Nonempty raw Linear cursor; passed byte-for-byte as GraphQL `after`                            | NS  | NS  | NS  |
| `CMT-OPT-PL-ALL`          | `-a, --all`                          | Fetch all remaining pages at internal page size up to 250                                      | NS  | NS  | NS  |
| `CMT-OPT-PL-NOHISTORY`    | `--no-cursor-history`                | Emit cursor/commands but skip M34 local history write                                          | NS  | NS  | NS  |
| `CMT-OPT-PL-OUTPUT`       | `-o, --output <table\|json>`         | Default `table`; reject unrecognized values                                                    | NS  | NS  | NS  |
| `CMT-OPT-PL-JSON`         | `--json`                             | Exact equivalent of `--output json`                                                            | NS  | NS  | NS  |

### 1.7 Cross-option and option-isolation rules

| ID                              | Interaction                             | Atomic contract                                                       | I        | T   | V   |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------- | -------- | --- | --- |
| `CMT-RULE-IA-BODY-XOR`          | issue add body sources                  | `--body` plus any `--body-file` is usage `2` before target resolution | NS       | NS  | NS  |
| `CMT-RULE-PA-BODY-XOR`          | project add body sources                | `--body` plus any `--body-file` is usage `2` before target resolution | NS       | NS  | NS  |
| `CMT-RULE-IA-JSON-EQUIV`        | issue add output aliases                | `--json --output json` valid; `--json --output table` usage `2`       | NS       | NS  | NS  |
| `CMT-RULE-PA-JSON-EQUIV`        | project add output aliases              | `--json --output json` valid; `--json --output table` usage `2`       | NS       | NS  | NS  |
| `CMT-RULE-IL-JSON-EQUIV`        | issue list output aliases               | `--json --output json` valid; `--json --output table` usage `2`       | NS       | NS  | NS  |
| `CMT-RULE-PL-JSON-EQUIV`        | project list output aliases             | `--json --output json` valid; `--json --output table` usage `2`       | NS       | NS  | NS  |
| `CMT-RULE-IL-ALL-LIMIT`         | issue `--all --limit N`                 | `--all` wins; limit ignored with verbose/debug diagnostic only        | NS       | NS  | NS  |
| `CMT-RULE-PL-ALL-LIMIT`         | project `--all --limit N`               | `--all` wins; limit ignored with verbose/debug diagnostic only        | NS       | NS  | NS  |
| `CMT-RULE-IL-AFTER-LIMIT`       | issue `--after C --limit N`             | Return the next N comments after C                                    | NS       | NS  | NS  |
| `CMT-RULE-PL-AFTER-LIMIT`       | project `--after C --limit N`           | Return the next N comments after C                                    | NS       | NS  | NS  |
| `CMT-RULE-IL-AFTER-ALL`         | issue `--after C --all`                 | Fetch all remaining comments strictly after C                         | NS       | NS  | NS  |
| `CMT-RULE-PL-AFTER-ALL`         | project `--after C --all`               | Fetch all remaining comments strictly after C                         | NS       | NS  | NS  |
| `CMT-RULE-IL-NOHISTORY-AFTER`   | issue `--after C --no-cursor-history`   | Resume without recording a new M34 entry                              | NS       | NS  | NS  |
| `CMT-RULE-PL-NOHISTORY-AFTER`   | project `--after C --no-cursor-history` | Resume without recording a new M34 entry                              | NS       | NS  | NS  |
| `CMT-RULE-IL-NOHISTORY-ALL`     | issue `--all --no-cursor-history`       | Exhaust without recording an M34 entry                                | NS       | NS  | NS  |
| `CMT-RULE-PL-NOHISTORY-ALL`     | project `--all --no-cursor-history`     | Exhaust without recording an M34 entry                                | NS       | NS  | NS  |
| `CMT-RULE-IA-DRYRUN-YES`        | issue `--dry-run --yes`                 | Valid; `--yes` has no effect because dry-run never prompts            | NS       | NS  | NS  |
| `CMT-RULE-PA-DRYRUN-YES`        | project `--dry-run --yes`               | Valid; `--yes` has no effect because dry-run never prompts            | NS       | NS  | NS  |
| `CMT-RULE-IA-NOINPUT-YES`       | issue `--no-input --yes`                | Never prompt; explicit consent allows guarded mutation                | NS       | NS  | NS  |
| `CMT-RULE-PA-NOINPUT-YES`       | project `--no-input --yes`              | Never prompt; explicit consent allows guarded mutation                | NS       | NS  | NS  |
| `CMT-RULE-IA-DRYRUN-REPLY`      | issue dry-run reply                     | Resolve and validate parent without creating reply                    | NS       | NS  | NS  |
| `CMT-RULE-PA-DRYRUN-REPLY`      | project dry-run reply                   | Resolve and validate parent without creating reply                    | NS       | NS  | NS  |
| `CMT-RULE-IA-TERMINATOR`        | `issue comment add --`                  | End option parsing under CLI Standard R3.1                            | BASELINE | NS  | NS  |
| `CMT-RULE-PA-TERMINATOR`        | `project comment add --`                | End option parsing under CLI Standard R3.1                            | BASELINE | NS  | NS  |
| `CMT-RULE-IL-TERMINATOR`        | `issue comment list --`                 | End option parsing under CLI Standard R3.1                            | BASELINE | NS  | NS  |
| `CMT-RULE-PL-TERMINATOR`        | `project comment list --`               | End option parsing under CLI Standard R3.1                            | BASELINE | NS  | NS  |
| `CMT-RULE-IA-REJECT-LIMIT`      | issue add `--limit`                     | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-IA-REJECT-AFTER`      | issue add `--after`                     | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-IA-REJECT-ALL`        | issue add `--all`                       | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-IA-REJECT-NOHISTORY`  | issue add `--no-cursor-history`         | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-PA-REJECT-LIMIT`      | project add `--limit`                   | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-PA-REJECT-AFTER`      | project add `--after`                   | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-PA-REJECT-ALL`        | project add `--all`                     | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-PA-REJECT-NOHISTORY`  | project add `--no-cursor-history`       | Reject list-only option with usage exit 2                             | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-BODY`       | issue list `--body`                     | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-BODYFILE`   | issue list `--body-file`                | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-REPLYTO`    | issue list `--reply-to`                 | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-DRYRUN`     | issue list `--dry-run`                  | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-YES`        | issue list `--yes`                      | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-NOINPUT`    | issue list `--no-input`                 | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-BODY`       | project list `--body`                   | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-BODYFILE`   | project list `--body-file`              | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-REPLYTO`    | project list `--reply-to`               | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-DRYRUN`     | project list `--dry-run`                | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-YES`        | project list `--yes`                    | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-PL-REJECT-NOINPUT`    | project list `--no-input`               | Reject add-only option with usage exit 2                              | NS       | NS  | NS  |
| `CMT-RULE-IL-REJECT-PAGE`       | issue list `--page`                     | Reject as unknown with usage exit 2                                   | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-PAGE`       | project list `--page`                   | Reject as unknown with usage exit 2                                   | BASELINE | NS  | NS  |
| `CMT-RULE-IL-REJECT-CURSOR`     | issue list `--cursor`                   | Reject as unknown; only `--after` resumes                             | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-CURSOR`     | project list `--cursor`                 | Reject as unknown; only `--after` resumes                             | BASELINE | NS  | NS  |
| `CMT-RULE-IL-REJECT-BEFORE`     | issue list `--before`                   | Reject as unknown; forward traversal only                             | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-BEFORE`     | project list `--before`                 | Reject as unknown; forward traversal only                             | BASELINE | NS  | NS  |
| `CMT-RULE-IL-REJECT-PAGESIZE`   | issue list `--page-size`                | Reject as unknown; internal request sizing is not public              | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-PAGESIZE`   | project list `--page-size`              | Reject as unknown; internal request sizing is not public              | BASELINE | NS  | NS  |
| `CMT-RULE-IL-REJECT-PAGINATE`   | issue list `--paginate`                 | Reject as unknown; M34 owns the retained `--all` waiver               | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-PAGINATE`   | project list `--paginate`               | Reject as unknown; M34 owns the retained `--all` waiver               | BASELINE | NS  | NS  |
| `CMT-RULE-IL-REJECT-NOPAGINATE` | issue list `--no-paginate`              | Reject as unknown; no second traversal switch                         | BASELINE | NS  | NS  |
| `CMT-RULE-PL-REJECT-NOPAGINATE` | project list `--no-paginate`            | Reject as unknown; no second traversal switch                         | BASELINE | NS  | NS  |
| `CMT-RULE-IL-AFTER-EMPTY`       | issue list empty `--after`              | Usage exit 2 before API access                                        | NS       | NS  | NS  |
| `CMT-RULE-PL-AFTER-EMPTY`       | project list empty `--after`            | Usage exit 2 before API access                                        | NS       | NS  | NS  |
| `CMT-RULE-IL-INVALID-CURSOR`    | Linear rejects issue cursor             | Normalize `invalid_cursor`, exit 5, emit no partial result            | NS       | NS  | NS  |
| `CMT-RULE-PL-INVALID-CURSOR`    | Linear rejects project cursor           | Normalize `invalid_cursor`, exit 5, emit no partial result            | NS       | NS  | NS  |

---

## 2. Body input and target-resolution ledger

### 2.1 Body acquisition

| ID                              | Behavior             | Atomic contract                                                                   | I   | T   | V   |
| ------------------------------- | -------------------- | --------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-INP-INLINE`                | inline body          | Use `--body` exactly when supplied and nonempty after trim                        | NS  | NS  | NS  |
| `CMT-INP-FILE`                  | path body            | Read UTF-8 content from `--body-file <path>`                                      | NS  | NS  | NS  |
| `CMT-INP-STDIN-EXPLICIT`        | explicit stdin       | `--body-file -` consumes stdin to EOF                                             | NS  | NS  | NS  |
| `CMT-INP-STDIN-IMPLICIT`        | implicit stdin       | No explicit source plus non-TTY stdin consumes stdin to EOF                       | NS  | NS  | NS  |
| `CMT-INP-STDIN-PRECEDENCE`      | incidental stdin     | Explicit `--body` or file path wins; do not consume unrelated piped stdin         | NS  | NS  | NS  |
| `CMT-INP-STDIN-APIKEY-CONFLICT` | two stdin consumers  | `--api-key -` plus explicit/implicit stdin body is usage `2` with corrective hint | NS  | NS  | NS  |
| `CMT-INP-TTY-MISSING`           | no source on TTY     | Usage `2`; state `--body`, `--body-file`, and pipeline choices                    | NS  | NS  | NS  |
| `CMT-INP-EMPTY-INLINE`          | blank inline         | Whitespace-only `--body` is usage `2`                                             | NS  | NS  | NS  |
| `CMT-INP-EMPTY-FILE`            | blank file           | Empty/whitespace-only file is usage `2`                                           | NS  | NS  | NS  |
| `CMT-INP-EMPTY-STDIN`           | blank stdin          | Empty/whitespace-only stdin is usage `2`                                          | NS  | NS  | NS  |
| `CMT-INP-PRESERVE`              | nonempty formatting  | Validate with trim but send original Markdown bytes decoded as UTF-8              | NS  | NS  | NS  |
| `CMT-INP-CWD`                   | relative file path   | Apply `-C/--cwd` before resolving and reading the path                            | NS  | NS  | NS  |
| `CMT-INP-FILE-NOTFOUND`         | missing file         | Runtime input failure, exit `1`, name path and corrective next step               | NS  | NS  | NS  |
| `CMT-INP-FILE-UNREADABLE`       | permission/directory | Runtime input failure, exit `1`, distinguish permission and directory             | NS  | NS  | NS  |

### 2.2 Target and parent resolution

| ID                          | Behavior                 | Atomic contract                                                          | I        | T   | V   |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------ | -------- | --- | --- |
| `CMT-ARG-ISSUE-UUID`        | issue UUID               | Resolve and retain canonical ID plus display metadata                    | BASELINE | NS  | NS  |
| `CMT-ARG-ISSUE-IDENTIFIER`  | `TEAM-123`               | Resolve case-insensitively and retain canonical identifier/title         | BASELINE | NS  | NS  |
| `CMT-ARG-ISSUE-INVALID`     | malformed issue target   | Usage `2` before comment API call                                        | NS       | NS  | NS  |
| `CMT-ARG-ISSUE-NOTFOUND`    | missing issue            | Exit `3`; suggest valid identifier/UUID and list/view next step          | NS       | NS  | NS  |
| `CMT-ARG-PROJECT-ID`        | project UUID/`proj_` ID  | Resolve and retain canonical ID/name                                     | BASELINE | NS  | NS  |
| `CMT-ARG-PROJECT-ALIAS`     | project alias            | Resolve through existing alias system and retain resolution provenance   | BASELINE | NS  | NS  |
| `CMT-ARG-PROJECT-NAME`      | project name/cache       | Reuse current exact/lookup/cache semantics and retain canonical metadata | BASELINE | NS  | NS  |
| `CMT-ARG-PROJECT-NOTFOUND`  | missing project          | Exit `3`; name input and suggest project list/alias next step            | NS       | NS  | NS  |
| `CMT-ARG-PROJECT-AMBIGUOUS` | ambiguous project name   | Exit `5`; show disambiguating IDs/aliases and create no comment          | NS       | NS  | NS  |
| `CMT-ARG-REPLY-NOTFOUND`    | unknown parent comment   | Exit `3`; create no comment                                              | NS       | NS  | NS  |
| `CMT-ARG-REPLY-WRONGTARGET` | parent belongs elsewhere | Exit `5` precondition; create no comment                                 | NS       | NS  | NS  |
| `CMT-ARG-REPLY-TOPLEVEL`    | no `--reply-to`          | Create a top-level comment with no parent ID                             | NS       | NS  | NS  |

---

## 3. API and pagination ledger

### 3.1 Shared API contracts

| ID                           | Contract                                                                                                       | Intended files                                     | I        | T   | V   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------- | --- | --- |
| `CMT-API-TARGET-UNION`       | Discriminated `issue\|project` comment target model                                                            | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-COMMENT-MODEL`      | Nullable user/bot/external creator and thread/timestamp fields                                                 | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-PAGE-INPUT`         | Comment adapter maps limit/raw after/all/history opt-out into M34 input                                        | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-PAGE-RESULT`        | Comments plus M34 `pageInfo`/history and target metadata                                                       | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-HISTORY-CONTEXT`    | Supply sanitized canonical target/order/source/next commands to M34                                            | `src/lib/api/comments.ts`, comment output adapter  | NS       | NS  | NS  |
| `CMT-API-FRAGMENT`           | One shared GraphQL comment field fragment for issue/project reads and mutation result                          | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-ISSUE-QUERY`        | `issue(id){comments(first,after,orderBy:createdAt)}` with pageInfo                                             | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-PROJECT-QUERY`      | top-level `comments(filter:{and:[project ID,projectUpdate:null]},first,after,orderBy:createdAt)` with pageInfo | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-ISSUE-CREATE`       | `commentCreate` sends `issueId`, body, optional parent; never project/update ID                                | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-PROJECT-CREATE`     | `commentCreate` sends `projectId`, body, optional parent; never issue/update ID                                | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-CREATE-SUCCESS`     | Require payload `success=true` and a returned comment                                                          | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-CREATE-FAILURE`     | Normalize `success=false`, GraphQL errors, null payloads, and permission errors                                | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-REPLY-VALIDATION`   | Fetch/inspect parent sufficiently to prove same target before mutation                                         | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-NO-PROJECT-UPDATE`  | No `projectUpdateId` query/mutation path in direct project commands                                            | API tests/GraphQL snapshots                        | NS       | NS  | NS  |
| `CMT-API-RAW-TRANSPORT`      | Use `getLinearClient().client.rawRequest` with typed local response guards                                     | `src/lib/api/comments.ts`                          | NS       | NS  | NS  |
| `CMT-API-NO-SDK-BUMP`        | Keep `@linear/sdk` dependency/lock unchanged in M35                                                            | `package.json`, lockfile diff                      | BASELINE | NS  | NS  |
| `CMT-API-EXPORTS`            | Re-export shared API through existing API barrel and `linear-client` facade                                    | `src/lib/api/index.ts`, `src/lib/linear-client.ts` | NS       | NS  | NS  |
| `CMT-API-ISSUE-VIEW-ADAPTER` | Map shared page model to existing issue-view comment shape                                                     | `src/lib/api/issues.ts` or adapter                 | NS       | NS  | NS  |
| `CMT-API-NO-SWALLOW`         | Network/GraphQL failure propagates; only real empty connection returns empty                                   | shared API and view adapter                        | NS       | NS  | NS  |

### 3.2 Comment-adapter pagination contracts

M34 owns reusable validation, traversal, loop guards, raw-cursor fidelity, history persistence, and
common pagination output fields. These rows own only comment-specific mapping and presentation.

| ID                         | Contract                       | Atomic behavior                                                                           | I   | T   | V   |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-PAG-ONE-PAGE`         | bounded comment query          | Map a bounded invocation to exactly one issue/project comment request                     | NS  | NS  | NS  |
| `CMT-PAG-ALL-PAGESIZE`     | comment traversal request size | Map `--all` to comment requests with `first=250`                                          | NS  | NS  | NS  |
| `CMT-PAG-ORDER`            | comment order                  | Request `createdAt` ordering and preserve Linear's returned order                         | NS  | NS  | NS  |
| `CMT-PAG-NO-REVERSE`       | comment presentation           | Do not reverse comment pages or records client-side                                       | NS  | NS  | NS  |
| `CMT-PAG-NO-SNAPSHOT`      | comment concurrency semantics  | Document that multi-request comment traversal is not a snapshot                           | NS  | NS  | NS  |
| `CMT-PAG-EMPTY`            | empty comment connection       | Map to `comments=[]`, complete pageInfo, human empty state, exit 0                        | NS  | NS  | NS  |
| `CMT-PAG-COMPLETE`         | exhausted comment connection   | Map to `hasNextPage=false`, public null cursor, `fetchedAll=true`                         | NS  | NS  | NS  |
| `CMT-PAG-TRUNCATED`        | bounded comment connection     | Map to `hasNextPage=true`, raw cursor, `fetchedAll=false`                                 | NS  | NS  | NS  |
| `CMT-PAG-RETURNEDCOUNT`    | comment count                  | Equal serialized comments returned by this invocation; never claim total unless exhausted | NS  | NS  | NS  |
| `CMT-PAG-HISTORY-RECORD`   | truncated comment history      | Supply target-preserving source/next/all-remaining commands to M34                        | NS  | NS  | NS  |
| `CMT-PAG-HISTORY-COMPLETE` | exhausted comment history      | Map M34 status `not_applicable` with no entry                                             | NS  | NS  | NS  |
| `CMT-PAG-HISTORY-DISABLED` | comment history opt-out        | Map M34 status `disabled`; remote comment result unchanged                                | NS  | NS  | NS  |
| `CMT-PAG-HISTORY-FAILED`   | comment history write failure  | Return result/raw cursor, stderr warning, M34 status `failed`, exit 0                     | NS  | NS  | NS  |

### 3.3 M34 adopter dependency map

This table carries prerequisites only; it does not copy M34 status. Each M35 adopter remains locally
owned and cannot reach `V=PASS` until every named `CPH-*` prerequisite is `V=PASS`.

| M35 adopter ID                  | Exact M34 prerequisite IDs                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `CMT-OPT-IL-LIMIT`              | `CPH-PAG-DEFAULT`                                                                                |
| `CMT-RULE-IL-LIMIT-PARSE`       | `CPH-PAG-LIMIT-PARSE`                                                                            |
| `CMT-RULE-IL-LIMIT-MIN`         | `CPH-PAG-LIMIT-MIN`                                                                              |
| `CMT-RULE-IL-LIMIT-MAX`         | `CPH-PAG-LIMIT-MAX`                                                                              |
| `CMT-OPT-IL-AFTER`              | `CPH-PAG-RAW-FIDELITY`, `CPH-PAG-RAW-NO-WRAP`, `CPH-PAG-AFTER-PASS`                              |
| `CMT-OPT-IL-ALL`                | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-PAG-MISSING-END`, `CPH-PAG-REPEATED-END`, `CPH-PAG-ATOMIC-OUTPUT` |
| `CMT-OPT-IL-NOHISTORY`          | `CPH-HIS-NO-RECORD-DISABLED`                                                                     |
| `CMT-RULE-IL-AFTER-LIMIT`       | `CPH-PAG-AFTER-LIMIT`                                                                            |
| `CMT-RULE-IL-AFTER-ALL`         | `CPH-PAG-AFTER-ALL`                                                                              |
| `CMT-RULE-IL-ALL-LIMIT`         | `CPH-PAG-ALL-LIMIT`                                                                              |
| `CMT-RULE-IL-NOHISTORY-AFTER`   | `CPH-PAG-NOHISTORY-AFTER`                                                                        |
| `CMT-RULE-IL-NOHISTORY-ALL`     | `CPH-PAG-NOHISTORY-ALL`                                                                          |
| `CMT-RULE-IL-AFTER-EMPTY`       | `CPH-PAG-AFTER-EMPTY`                                                                            |
| `CMT-RULE-IL-INVALID-CURSOR`    | `CPH-PAG-INVALID-BACKEND`, `CPH-OUT-EXIT-5`                                                      |
| `CMT-OPT-PL-LIMIT`              | `CPH-PAG-DEFAULT`                                                                                |
| `CMT-RULE-PL-LIMIT-PARSE`       | `CPH-PAG-LIMIT-PARSE`                                                                            |
| `CMT-RULE-PL-LIMIT-MIN`         | `CPH-PAG-LIMIT-MIN`                                                                              |
| `CMT-RULE-PL-LIMIT-MAX`         | `CPH-PAG-LIMIT-MAX`                                                                              |
| `CMT-OPT-PL-AFTER`              | `CPH-PAG-RAW-FIDELITY`, `CPH-PAG-RAW-NO-WRAP`, `CPH-PAG-AFTER-PASS`                              |
| `CMT-OPT-PL-ALL`                | `CPH-PAG-ALL-SEQUENTIAL`, `CPH-PAG-MISSING-END`, `CPH-PAG-REPEATED-END`, `CPH-PAG-ATOMIC-OUTPUT` |
| `CMT-OPT-PL-NOHISTORY`          | `CPH-HIS-NO-RECORD-DISABLED`                                                                     |
| `CMT-RULE-PL-AFTER-LIMIT`       | `CPH-PAG-AFTER-LIMIT`                                                                            |
| `CMT-RULE-PL-AFTER-ALL`         | `CPH-PAG-AFTER-ALL`                                                                              |
| `CMT-RULE-PL-ALL-LIMIT`         | `CPH-PAG-ALL-LIMIT`                                                                              |
| `CMT-RULE-PL-NOHISTORY-AFTER`   | `CPH-PAG-NOHISTORY-AFTER`                                                                        |
| `CMT-RULE-PL-NOHISTORY-ALL`     | `CPH-PAG-NOHISTORY-ALL`                                                                          |
| `CMT-RULE-PL-AFTER-EMPTY`       | `CPH-PAG-AFTER-EMPTY`                                                                            |
| `CMT-RULE-PL-INVALID-CURSOR`    | `CPH-PAG-INVALID-BACKEND`, `CPH-OUT-EXIT-5`                                                      |
| `CMT-RULE-IL-TERMINATOR`        | `CPH-API-ADOPTER-CONTRACT`                                                                       |
| `CMT-RULE-PL-TERMINATOR`        | `CPH-API-ADOPTER-CONTRACT`                                                                       |
| `CMT-RULE-IL-REJECT-PAGE`       | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-PL-REJECT-PAGE`       | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-IL-REJECT-CURSOR`     | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-PL-REJECT-CURSOR`     | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-IL-REJECT-BEFORE`     | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-PL-REJECT-BEFORE`     | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-IL-REJECT-PAGESIZE`   | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-PL-REJECT-PAGESIZE`   | `CPH-DOC-HELP-REMOTE`                                                                            |
| `CMT-RULE-IL-REJECT-PAGINATE`   | `CPH-DOC-CONFORMANCE`                                                                            |
| `CMT-RULE-PL-REJECT-PAGINATE`   | `CPH-DOC-CONFORMANCE`                                                                            |
| `CMT-RULE-IL-REJECT-NOPAGINATE` | `CPH-DOC-CONFORMANCE`                                                                            |
| `CMT-RULE-PL-REJECT-NOPAGINATE` | `CPH-DOC-CONFORMANCE`                                                                            |
| `CMT-API-PAGE-INPUT`            | `CPH-API-PAGE-INPUT`, `CPH-API-ADOPTER-CONTRACT`                                                 |
| `CMT-API-PAGE-RESULT`           | `CPH-API-PAGE-INFO`, `CPH-API-HISTORY-ADAPTER`                                                   |
| `CMT-API-HISTORY-CONTEXT`       | `CPH-API-HISTORY-ADAPTER`, `CPH-HIS-SAFE-COMMAND`                                                |
| `CMT-PAG-ONE-PAGE`              | `CPH-API-PAGE-WALKER`, `CPH-PAG-DEFAULT`                                                         |
| `CMT-PAG-ALL-PAGESIZE`          | `CPH-API-PAGE-WALKER`, `CPH-PAG-ALL-SEQUENTIAL`                                                  |
| `CMT-PAG-ORDER`                 | `CPH-PAG-ORDER`, `CPH-API-PAGE-ORDER`                                                            |
| `CMT-PAG-NO-REVERSE`            | `CPH-PAG-ORDER`                                                                                  |
| `CMT-PAG-NO-SNAPSHOT`           | `CPH-PAG-CONTEXT-UNBOUND`                                                                        |
| `CMT-PAG-EMPTY`                 | `CPH-PAG-END-NULL`, `CPH-PAG-RETURNED-COUNT`                                                     |
| `CMT-PAG-COMPLETE`              | `CPH-PAG-END-NULL`, `CPH-OUT-PAGE-HASNEXT`, `CPH-OUT-PAGE-ALL`                                   |
| `CMT-PAG-TRUNCATED`             | `CPH-PAG-RAW-FIDELITY`, `CPH-OUT-PAGE-HASNEXT`, `CPH-OUT-PAGE-END`, `CPH-OUT-PAGE-ALL`           |
| `CMT-PAG-RETURNEDCOUNT`         | `CPH-PAG-RETURNED-COUNT`, `CPH-OUT-PAGE-COUNT`                                                   |
| `CMT-PAG-HISTORY-RECORD`        | `CPH-HIS-RECORD-CONDITION`, `CPH-HIS-SAFE-COMMAND`, `CPH-OUT-HISTORY-ENTRY`                      |
| `CMT-PAG-HISTORY-COMPLETE`      | `CPH-HIS-NO-RECORD-COMPLETE`, `CPH-OUT-HISTORY-STATUS`                                           |
| `CMT-PAG-HISTORY-DISABLED`      | `CPH-HIS-NO-RECORD-DISABLED`, `CPH-OUT-HISTORY-STATUS`                                           |
| `CMT-PAG-HISTORY-FAILED`        | `CPH-HIS-WRITE-FAILURE`, `CPH-OUT-HISTORY-STATUS`, `CPH-OUT-DIAGNOSTICS`                         |
| `CMT-OUT-HUMAN-NEXT`            | `CPH-OUT-HUMAN-NEXT`, `CPH-OUT-HUMAN-ALL-REMAINING`, `CPH-OUT-HUMAN-HISTORY-ID`                  |
| `CMT-OUT-SHELL-QUOTE-CURSOR`    | `CPH-OUT-SHELL-CURSOR`                                                                           |
| `CMT-OUT-LJ-PAGEINFO`           | `CPH-API-PAGE-INFO`                                                                              |
| `CMT-OUT-LJ-COUNT`              | `CPH-OUT-PAGE-COUNT`                                                                             |
| `CMT-OUT-LJ-HASNEXT`            | `CPH-OUT-PAGE-HASNEXT`                                                                           |
| `CMT-OUT-LJ-ENDCURSOR`          | `CPH-OUT-PAGE-END`                                                                               |
| `CMT-OUT-LJ-FETCHEDALL`         | `CPH-OUT-PAGE-ALL`                                                                               |
| `CMT-OUT-LJ-HISTORY`            | `CPH-API-HISTORY-ADAPTER`                                                                        |
| `CMT-OUT-LJ-HISTORY-STATUS`     | `CPH-OUT-HISTORY-STATUS`                                                                         |
| `CMT-OUT-LJ-HISTORY-ID`         | `CPH-OUT-HISTORY-ENTRY`                                                                          |
| `CMT-TST-PAGINATION`            | `CPH-TST-ADOPTER-CONTRACT`, `CPH-TST-OUTPUT`                                                     |
| `CMT-VER-PAGINATION`            | `CPH-VER-ADOPTER-CONTRACT`, `CPH-VER-RAW`, `CPH-VER-HELP`, `CPH-VER-JSON`                        |
| `CMT-DOC-M34-DEPENDENCIES`      | `CPH-DOC-DEPENDENCY-MAP`, `CPH-DOC-CONFORMANCE`                                                  |

---

## 4. Settled design and proposed enhancements

### 4.1 Canonical command tree

```text
agent2linear
├── issue
│   └── comment
│       ├── add <identifier>
│       └── list <identifier>
└── project
    └── comment
        ├── add <name-or-id>
        └── list <name-or-id>
```

Canonical invocations:

```console
a2l issue comment add ENG-123 --body "I reproduced this."
a2l issue comment list ENG-123
a2l project comment add backend-migration --body-file status.md
a2l project comment list backend-migration --all
```

`comment` becomes a command group. A bare group is a usage error, prints group help to stderr, and
exits `2`. No plural, shorthand, or undocumented comment alias is introduced.

### 4.2 No legacy compatibility path

The current route is a leaf command:

```console
a2l issue comment ENG-123 --body "I reproduced this."
```

M35 removes it rather than installing a parser shim. The old route must fail with exit `2` and a
replacement that preserves the user's target and body flags when Commander has enough information:

```text
error: legacy comment syntax has been removed
try: a2l issue comment add ENG-123 --body "I reproduced this."
```

This is intentionally incompatible with CLI Design Standard R9.2's deprecation-window MUST. It is
also a breaking interface change under R9.3. On 2026-07-25 the project owner accepted the
coordinated `v1.0.0`-or-later release path. That resolves the R9.3 version decision but does not
convert the R9.2 MUST-level nonconformance into a conforming waiver:

- Ship M35 only in `v1.0.0` or later, making the grammar break visible as a major release.
- Do not ship it as `v0.35.0`; that would reopen the R9.3 blocker and invalidate the accepted
  release decision.
- Do not reintroduce the legacy syntax solely to avoid the version decision; the user explicitly
  chose removal.

### 4.3 Direct project comments are in scope

Linear announced direct comments on projects and initiatives on 2026-04-09. These comments belong
to the project's activity feed and are distinct from comments attached to a project update.

- M35 reads direct project comments through the top-level `comments` connection filtered by exact
  project ID, and creates them with `commentCreate(projectId: ...)`.
- M35 does not read or create project-update comments.
- Initiative comments remain out of scope.
- The repository pins `@linear/sdk ^61.0.0`; that installed contract predates public typed
  `CommentCreateInput.projectId` support. Use the existing SDK client's raw GraphQL transport instead
  of coupling M35 to a broad SDK upgrade.

The implementation was corrected by live evidence on 2026-07-24:

- `commentCreate({projectId})` created direct comments whose `projectId` matched the fixture.
- `project(id) { comments }` returned an empty connection for those same direct comments.
- the top-level `comments(filter: { project: { id: { eq: $targetId } } })` connection returned
  the complete direct-comment thread and supported raw `after` pagination.
- adding `projectUpdate: { null: true }` and a disposable project-update comment proved that the
  direct list cannot leak project-update comments.
- the focused raw-query test and the complete guarded ConceptM lifecycle passed after the change.

This is an explicit deviation from the earlier proposed query shape, not a CLI-contract change.
Raw GraphQL remains necessary because the pinned SDK types do not expose this current filter/input
surface consistently.

Primary references:

- <https://linear.app/changelog/2026-04-09-multi-level-sub-teams>
- <https://linear.app/developers/pagination>
- <https://linear.app/developers/sdk-fetching-and-modifying-data>
- <https://github.com/linear/linear/releases>

### 4.4 Enhancement: true TDD while retaining Implement/Test/Verify tracking

The requested status dimensions are **Implement / Test / Verify**, represented by the ledger's
`I`, `T`, and `V` columns. Execution must nevertheless put the test first:

1. **RED:** add or activate the smallest automated assertion for one ID and prove it fails for the
   expected reason.
2. **IMPLEMENT:** make the smallest production change that satisfies that ID.
3. **GREEN:** rerun the targeted assertion and prove it passes.
4. **VERIFY:** exercise the contract independently through a built CLI, raw request assertion,
   stream capture, or live self-created fixture as applicable.

A literal Implement → Test → Verify execution order would be test-after development, not TDD. The
three requested tracking columns remain, while RED evidence is mandatory before `I=DONE` for every
new or changed behavior.

### 4.5 Enhancement: atomic interface IDs

Every command, positional argument, local option, relevant inherited option, option interaction,
pagination rule, machine-output field, and behavior change has its own stable `CMT-*` ID.

- A short and long spelling for one logical option share one ID, for example
  `-o, --output <table|json>`.
- Distinct flags never share one row, even when their implementation is shared.
- Parallel issue/project options receive separate IDs so parity can be audited rather than assumed.
- Shared implementation rows do not replace interface rows.
- Parent commands and milestone rollups are computed from child IDs; they cannot be declared done
  while a child remains incomplete.

### 4.6 Enhancement: deterministic verification layers

Each externally visible change is verified at the lowest deterministic layer and at least one layer
above it:

1. Pure/unit tests for parsers, validation, pagination, serializers, and shell quoting.
2. Command-runner tests with injected resolvers/API/output/exit boundaries.
3. Built-CLI offline tests for help, routing, stdin, stdout/stderr, JSON, and exit status.
4. Opt-in live Linear tests for one self-created issue thread and one self-created project thread.

Live tests must first assert the resolved workspace is ConceptM, fail closed otherwise, and record
every created fixture ID and cleanup result. Unit and built-CLI verification must remain runnable
without a Linear API key.

### 4.7 Enhancement: scope firewall

M35 records but does not silently absorb these repository-wide migrations:

- global `--api-key` currently accepts a secret on argv, contrary to R5.5;
- global verbosity is boolean rather than repeatable and there is no global `--debug`;
- existing list commands usually use `-f/--format`, while the Standard requires
  `-o/--output` and `--json` equivalence;
- existing list commands use `--all` for pagination, while R10.2/R10.3 reserve `--all` for scope
  and specify `--paginate`;
- existing commands generally collapse failures to exit `1` and do not consistently emit the R7.8
  machine-error envelope.

M35 follows the approved comment contract and tracks every local deviation. It does not refactor
unrelated commands merely to make the repository globally conformant.

### 4.8 Enhancement: evidence-backed status, not asserted status

An ID is complete only when:

- `I=DONE` or `I=BASELINE` has a source/behavior reference;
- `T=GREEN` has a targeted passing test and, for changed behavior, prior RED evidence;
- `V=PASS` has an independent verification command and observed result.

If one code change satisfies several IDs, each row still receives its own test assertion and
evidence entry. Shared code is an implementation convenience, not a tracking shortcut.

### 4.9 Accepted AR-003: M34 owns primitives; M35 owns comment adopters

M34 is the sole implementation and TDD owner of reusable pagination validation, traversal,
raw-cursor fidelity, loop/failure guards, cursor-history persistence, common page fields, and the
existing issue/project list migrations. M35 owns only issue/project comment command wiring,
comment-query mapping, target-specific envelopes/rendering, help, and adoption tests.

Every local adopter maps to exact upstream `CPH-*` prerequisites in §3.3. M35 adopter verification
must wait for those prerequisites, but M34 completion never waits on M35. Shared repository gates
may be rerun; shared public behavior may not receive a second implementation/test owner. M34 alone
owns the CLI Standard R10.2/R10.3 `--all` waiver.

### 4.10 Live verification workspace: ConceptM only

Every M35 live test and verification must target the ConceptM Linear account/workspace exclusively.
The harness resolves through the normal repository profile, asserts ConceptM before any write, and
fails closed on missing or mismatched identity. Live tests may mutate only uniquely named issues,
projects, comments, and replies they create themselves; every fixture ID and cleanup result must be
recorded. No M35 live probe may write to another account or workspace.

---

## 5. Tracking methodology

### 5.1 Status vocabulary

| Column | Allowed values                                   | Meaning                         |
| ------ | ------------------------------------------------ | ------------------------------- |
| `I`    | `NS`, `IP`, `DONE`, `BASELINE`, `BLOCKED`, `N/A` | Production implementation state |
| `T`    | `NS`, `RED`, `GREEN`, `BLOCKED`, `N/A`           | Targeted automated-test state   |
| `V`    | `NS`, `PASS`, `FAIL`, `BLOCKED`, `N/A`           | Independent verification state  |

At plan publication, retained existing interfaces may start as `I=BASELINE`; all new, removed, or
corrected behaviors start `I=NS`. Test and verification states start `NS`, except the planning
artifacts verified during publication.

### 5.2 ID families

| Prefix       | Tracks                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| `CMT-CMD-*`  | Command groups, commands, registration, and routing                       |
| `CMT-ARG-*`  | One positional argument and its resolution contract                       |
| `CMT-OPT-*`  | One local or inherited CLI option on one surface                          |
| `CMT-RULE-*` | Cross-option validation, precedence, and rejected combinations            |
| `CMT-INP-*`  | Body acquisition, stdin, file, and content validation                     |
| `CMT-API-*`  | GraphQL models, queries, mutations, and facade exports                    |
| `CMT-PAG-*`  | Comment-adapter mapping, ordering, page presentation, and history context |
| `CMT-SAF-*`  | Workspace targeting, confirmation, dry-run, and retry safety              |
| `CMT-OUT-*`  | Human rendering, JSON schemas, stdout/stderr, and exits                   |
| `CMT-VIEW-*` | Existing `issue view --show-comments` integration behavior                |
| `CMT-DOC-*`  | Milestone, user, migration, conformance, and error documentation          |
| `CMT-TST-*`  | Test harnesses, traceability, and live fixtures                           |
| `CMT-VER-*`  | Aggregate verification gates                                              |

### 5.3 Evidence-log schema

Every state transition appends a row to §12 with:

| Field        | Required content                            |
| ------------ | ------------------------------------------- |
| Date         | ISO date/time                               |
| ID           | Exactly one ledger ID                       |
| Phase        | `RED`, `IMPLEMENT`, `GREEN`, or `VERIFY`    |
| Command/test | Exact test name or shell command            |
| Expected     | Expected observation                        |
| Observed     | Actual observation, including exit status   |
| Files        | Source and test paths                       |
| Revision     | Commit SHA or `working-tree`                |
| Notes        | Blocker, fixture ID, cleanup result, or `—` |

### 5.4 Atomic TDD runbook

For each non-baseline ID:

1. Confirm every exact dependency is complete or explicitly recorded as a blocker; M35 pagination
   adopters cannot pass verification before their §3.3 `CPH-*` prerequisites.
2. Add one assertion named or tagged with the exact ID.
3. Run only that assertion and record the expected RED result.
4. Set `T=RED` and `I=IP`.
5. Implement the smallest behavior for that ID.
6. Rerun the targeted assertion; set `I=DONE`, then `T=GREEN` only when it passes.
7. Run the ID's independent verification and record stdout, stderr, and exit status as applicable.
8. Set `V=PASS` only after independent evidence exists.
9. Recompute the command and phase rollups from their children.

For a baseline ID, first characterize current behavior, set `I=BASELINE`, and still require
`T=GREEN` plus `V=PASS` before depending on it.

### 5.5 Traceability rules

- Every `CMT-CMD`, `CMT-ARG`, and `CMT-OPT` ID must appear in a test name or explicit traceability
  map entry.
- Every option interaction must have its own `CMT-RULE` assertion; testing both options separately
  is insufficient.
- Every public JSON field must have a serializer assertion and schema snapshot/type assertion.
- Every documented example must execute in an offline harness or be marked as an opt-in live case.
- No command rollup passes if any argument or option child is `NS`, `RED`, `FAIL`, or `BLOCKED`.
- No phase passes based only on the same mock used in its targeted unit test.
- Rejected routes and options are positive test obligations, not undocumented absence.

### 5.6 Commit and worktree discipline

- The consolidated planning and implementation worktree is `label-project-lifecycle-tdd-plan` on
  `plan/label-project-lifecycle-tdd`; it contains coordinated M33/M34/M35 work.
- Never implement from the main checkout or create a competing M35 worktree without explicit user
  direction.
- Prefer one focused commit per TDD slice or tightly coupled dependency set; every commit message
  lists its completed IDs.
- Never mark IDs complete merely because their code shares a commit with another completed ID.
- Do not merge, push, publish, or bump a version unless separately requested.

---

## 6. Repository and API baseline

### 6.1 Existing implementation

| Surface                      | Current behavior                                                                                                                        | M35 consequence                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `issue comment <identifier>` | Add-only leaf with `--body`/`--body-file`; all failures exit `1`; no workspace guard, dry-run, JSON, stdin, reply, or list              | Replace with the nested group and explicitly reject the legacy grammar                   |
| `issue view --show-comments` | Human thread or embedded JSON; underlying raw query has no pagination arguments/pageInfo; Linear therefore returns the default first 50 | Keep summary role, correct “all” wording, and direct users to the dedicated list command |
| `getIssueComments`           | Raw GraphQL fetches user data but catches every failure and returns `[]`                                                                | Stop conflating API failure with an empty thread                                         |
| `createIssueComment`         | SDK `createComment({issueId, body})`                                                                                                    | Move issue and project creation to shared GraphQL operation                              |
| Project resolver             | Resolves ID, alias, cache, or name                                                                                                      | Reuse for project comment add/list                                                       |
| Issue resolver               | Resolves UUID or `TEAM-123`                                                                                                             | Reuse for issue comment add/list                                                         |
| Workspace mutation guard     | Banners, auto-detected-workspace confirmation, non-TTY refusal, `-y` bypass, JSON workspace shape                                       | Apply to both add commands immediately before mutation                                   |
| `readContentFile`            | Reads paths only; `-` is not stdin                                                                                                      | Extend through a comment-specific input helper without changing unrelated callers        |

### 6.2 Existing list-output convention

| Existing family              | Human default            | Machine form                             | Public cursor? |
| ---------------------------- | ------------------------ | ---------------------------------------- | -------------- |
| `issue list`                 | Grid table plus total    | `-f/--format json\|tsv`; JSON bare array | No             |
| `project list`               | Grid table plus total    | `-f/--format json\|tsv`; JSON bare array | No             |
| teams/members/initiatives    | Human tables             | `-f/--format json\|tsv`                  | No             |
| cycles/labels                | Human record/card output | `-f/--format` variants                   | No             |
| `config override list`       | Human records            | `--json`                                 | No             |
| `issue view --show-comments` | Thread-like records      | Embedded `comments` array under `--json` | No             |

Comments therefore remain human-readable by default. Their Markdown bodies render as stacked
thread records rather than narrow grid rows. M35 deliberately uses Standard-compliant
`-o/--output table|json` plus `--json`; this differs from the repository's older `-f/--format`
spelling and must remain documented as a scoped deviation.

### 6.3 Existing pagination convention

| Surface                 | Public contract                        | Data behavior                                    | Finding                                                       |
| ----------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `issue list`            | default 50; `--limit` 1–250; `--all`   | raw `first/after/pageInfo`; `--all` loops at 250 | Strongest working repository precedent                        |
| `project list`          | default 50; help says max 250; `--all` | same raw cursor loop                             | Parser does not enforce max 250 as consistently as issue list |
| Existing issue comments | no pagination controls                 | one implicit Linear page                         | Help incorrectly says “all comments”                          |

M35 adopts M34's shared raw `--after`, `-a/--all`, page metadata, history, and rejected-alternative
contract rather than copying the existing private loops.

---

## 7. Detailed interface and behavior contract

### 7.1 Add options

Both add commands expose the same surface:

| Option                       | Type/default   | Contract                                                    |
| ---------------------------- | -------------- | ----------------------------------------------------------- |
| `--body <markdown>`          | string; none   | Inline Markdown body                                        |
| `--body-file <path\|->`      | string; none   | Read UTF-8 body from a path, or stdin when `-`              |
| `--reply-to <comment-id>`    | string; none   | Create a reply whose parent belongs to the resolved target  |
| `--dry-run`                  | boolean; false | Resolve and validate without prompting or mutating          |
| `-o, --output <table\|json>` | enum; `table`  | Human result or stable JSON envelope                        |
| `--json`                     | boolean; false | Exact equivalent of `--output json`                         |
| `-y, --yes`                  | boolean; false | Bypass only the existing workspace confirmation             |
| `--no-input`                 | boolean; false | Never prompt; require sufficient explicit workspace consent |

Body-source rules:

1. `--body` and `--body-file` are mutually exclusive.
2. `--body-file -` reads stdin explicitly.
3. With neither explicit source and non-TTY stdin, read stdin implicitly.
4. With neither explicit source and TTY stdin, fail usage `2`; do not open an editor or prompt.
5. Explicit body input takes precedence over incidental piped stdin.
6. A body whose trimmed value is empty fails usage `2`; preserve the original nonempty content.
7. Resolve `-C/--cwd` before a relative `--body-file` path.
8. Reject `--api-key -` combined with explicit or implicit stdin body; one stream cannot supply two
   independent values.

### 7.2 List options

Both list commands expose the same surface:

| Option                       | Type/default   | Contract                                                  |
| ---------------------------- | -------------- | --------------------------------------------------------- |
| `--limit <number>`           | integer; `50`  | One bounded page, valid inclusive range 1–250             |
| `--after <cursor>`           | string; none   | Start immediately after the exact raw Linear cursor       |
| `-a, --all`                  | boolean; false | Fetch every remaining page; internal page size up to 250  |
| `--no-cursor-history`        | boolean; false | Emit cursor/commands but skip local M34 history recording |
| `-o, --output <table\|json>` | enum; `table`  | Thread records or stable JSON envelope                    |
| `--json`                     | boolean; false | Exact equivalent of `--output json`                       |

`-a` is assigned only to `--all`, matching the shared M34 contract. `--limit` and `--after` remain
long-only so issue and project comments stay identical despite older list-command short conflicts.

### 7.3 Pagination semantics

Linear uses Relay-style cursors. M35 passes the raw cursor through M34 unchanged and makes no
numeric-page promise. Cursor history is advisory and never validates or rewrites `--after`.

| Invocation            | Backend behavior                             | Result meaning                  |
| --------------------- | -------------------------------------------- | ------------------------------- |
| no pagination option  | `first=50`, `after=null`, one request        | first bounded result set        |
| `--limit N`           | `first=N`, one request                       | at most N comments              |
| `--after C`           | `first=50`, `after=C`, one request           | next bounded result set after C |
| `--after C --limit N` | `first=N`, `after=C`, one request            | next N after C                  |
| `--all`               | repeat `first=250` from beginning            | all comments                    |
| `--after C --all`     | repeat `first=250` starting after C          | all remaining comments          |
| `--all --limit N`     | `--all` wins; ignore N with debug diagnostic | repository-compatible traversal |

The query explicitly orders by `createdAt`, preserves Linear's returned order, and never reverses
the page client-side. There is no snapshot guarantee across requests; concurrent mutations may
change later results.

To request page two, use page one's `pageInfo.endCursor`:

```console
a2l issue comment list ENG-123 --limit 50 --after 'raw-linear-cursor'
```

There is no direct page-N jump. Reaching page N requires walking N−1 cursors, and `--all` is the
interface for callers that need the complete collection.

The implementation accumulates every requested page before rendering. If page two or later fails,
the command emits no partial result. It also rejects missing or repeated cursors while
`hasNextPage=true` to prevent an infinite loop.

### 7.4 Human list rendering

```text
Comments for ENG-123 — Handle reconnects safely

2026-07-20 14:32 · Steve Morin · 6cc17a5b-…
  I reproduced this after reconnecting twice.

Showing 1 comment; more are available.

Next page:
  a2l issue comment list ENG-123 --limit 1 --after 'raw-linear-cursor'

All remaining:
  a2l issue comment list ENG-123 --after 'raw-linear-cursor' --all

Cursor history: 5f9cbcef-7b15-4df8-901d-491a2b55ee6f
```

The footer is requested result data and goes to stdout. Generated commands must shell-quote both
the target, effective options, and cursor. The printed history ID resolves through
`cursor-history view`. A complete page ends with `Total: N comments`; an empty collection prints
`No comments found.` and exits `0`.

### 7.5 JSON list rendering

```json
{
  "target": {
    "type": "issue",
    "id": "4f96...",
    "identifier": "ENG-123",
    "title": "Handle reconnects safely"
  },
  "comments": [
    {
      "id": "6cc17a5b-...",
      "url": "https://linear.app/...",
      "body": "I reproduced this.",
      "createdAt": "2026-07-20T18:32:04.000Z",
      "updatedAt": "2026-07-20T18:32:04.000Z",
      "editedAt": null,
      "resolvedAt": null,
      "parentId": null,
      "quotedText": null,
      "user": { "id": "...", "name": "Steve Morin", "email": "..." },
      "botActor": null,
      "externalUser": null
    }
  ],
  "pageInfo": {
    "returnedCount": 1,
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

The envelope intentionally differs from existing bare-array lists because target identity and a
stable cursor contract have nowhere safe to live in a bare array. `endCursor` is `null` when no next
page exists. `returnedCount` is this invocation's count, not a claimed global total.
`cursorHistory.status` follows M34's `recorded|disabled|not_applicable|failed` contract.

### 7.6 Add and dry-run output

Human success:

```text
Comment added to ENG-123 — Handle reconnects safely
ID: 6cc17a5b-…
URL: https://linear.app/…
```

JSON success:

```json
{
  "ok": true,
  "workspace": { "name": "acme", "source": "auto-detect" },
  "target": { "type": "issue", "id": "...", "identifier": "ENG-123", "title": "..." },
  "comment": { "id": "...", "body": "I reproduced this.", "createdAt": "..." }
}
```

JSON dry-run:

```json
{
  "dryRun": true,
  "workspace": { "name": "acme", "source": "auto-detect" },
  "target": { "type": "issue", "id": "...", "identifier": "ENG-123", "title": "..." },
  "comment": { "body": "I reproduced this.", "parentId": null },
  "validation": { "targetResolved": true, "serverMutation": false }
}
```

### 7.7 Stream and exit contract

- Requested results go to stdout.
- Diagnostics, warnings, prompts, and errors go to stderr.
- `--json` stdout contains exactly one JSON document.
- Machine-mode errors use one stderr object:
  `{"error":{"code":"stable_code","message":"human-readable"}}`.
- `--json --output json` is accepted as equivalent.
- `--json --output table` is a usage conflict and exits `2`.
- Empty list is success `0`; not found is `3`; authentication/authorization is `4`; rejected or
  stale cursor/precondition is `5`; unclassified/network failure is `1`; parse/input error is `2`.

### 7.8 Existing issue-view integration

`issue view --show-comments` remains a compact summary rather than gaining a second pagination
interface:

- retain its existing argument and JSON `comments` array shape;
- explicitly fetch at most 50 comments;
- correct help from “all comments” to “up to 50 comments”;
- when more exist in human mode, point to `issue comment list <id> --all`;
- do not create a cursor-history entry from the embedded summary;
- do not add `--limit`, `--after`, or `--all` to `issue view`;
- propagate comment-fetch failures instead of rendering them as an empty thread.

---

## 8. Safety, output, and issue-view ledger

### 8.1 Workspace and mutation safety

| ID                         | Contract                            | Atomic behavior                                                                              | I   | T   | V   |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-SAF-IA-WORKSPACE`     | issue add workspace guard           | Call `guardWorkspaceForMutation` after validation/resolution and immediately before mutation | NS  | NS  | NS  |
| `CMT-SAF-PA-WORKSPACE`     | project add workspace guard         | Call `guardWorkspaceForMutation` after validation/resolution and immediately before mutation | NS  | NS  | NS  |
| `CMT-SAF-BANNER`           | human workspace context             | Reuse existing banner unless JSON or quiet suppresses it                                     | NS  | NS  | NS  |
| `CMT-SAF-CONFIRM`          | auto-detected multi-workspace write | Reuse existing confirmation behavior; prompt text must not contaminate JSON stdout           | NS  | NS  | NS  |
| `CMT-SAF-NONTYY`           | non-TTY auto-detected write         | Fail without mutation when existing guard requires explicit selection or `--yes`; never hang | NS  | NS  | NS  |
| `CMT-SAF-YES`              | routine consent                     | `-y/--yes` bypasses workspace prompt but not validation, target checks, or API failures      | NS  | NS  | NS  |
| `CMT-SAF-IA-NOINPUT`       | issue add noninteractive mode       | Never prompt; without explicit consent/context, usage exit 2 and no mutation                 | NS  | NS  | NS  |
| `CMT-SAF-PA-NOINPUT`       | project add noninteractive mode     | Never prompt; without explicit consent/context, usage exit 2 and no mutation                 | NS  | NS  | NS  |
| `CMT-SAF-DENIED`           | denied workspace resolution         | Fail before target mutation and preserve resolver's actionable hint                          | NS  | NS  | NS  |
| `CMT-SAF-IA-DRYRUN`        | issue dry-run                       | Resolve workspace/target/body/parent; skip confirmation and `commentCreate`                  | NS  | NS  | NS  |
| `CMT-SAF-PA-DRYRUN`        | project dry-run                     | Resolve workspace/target/body/parent; skip confirmation and `commentCreate`                  | NS  | NS  | NS  |
| `CMT-SAF-LIST-READONLY`    | both list commands                  | Never invoke mutation guard or prompt; workspace resolution remains read-only                | NS  | NS  | NS  |
| `CMT-SAF-NO-BLIND-RETRY`   | mutation retry policy               | Never automatically retry `commentCreate`; avoid duplicate comments                          | NS  | NS  | NS  |
| `CMT-SAF-SECRET-REDACTION` | credentials/errors                  | Never include API keys in human output, JSON, errors, debug logs, or evidence                | NS  | NS  | NS  |

### 8.2 Human and stream output

| ID                           | Contract                  | Atomic behavior                                                                       | I   | T   | V   |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OUT-STDOUT`             | requested data            | Human/JSON result data only on stdout                                                 | NS  | NS  | NS  |
| `CMT-OUT-STDERR`             | diagnostics               | Errors, warnings, debug, workspace prompts, and progress only on stderr               | NS  | NS  | NS  |
| `CMT-OUT-IA-HUMAN`           | issue add human success   | Identify issue, comment ID, and URL when available                                    | NS  | NS  | NS  |
| `CMT-OUT-PA-HUMAN`           | project add human success | Identify project, comment ID, and URL when available                                  | NS  | NS  | NS  |
| `CMT-OUT-IL-HUMAN`           | issue list human          | Stacked thread records with target heading, timestamp, creator, ID, and Markdown body | NS  | NS  | NS  |
| `CMT-OUT-PL-HUMAN`           | project list human        | Same stacked-record contract with project heading                                     | NS  | NS  | NS  |
| `CMT-OUT-HUMAN-CREATOR`      | creator fallback          | Display user, then bot actor, then external user, then `Unknown`                      | NS  | NS  | NS  |
| `CMT-OUT-HUMAN-EMPTY`        | empty list                | Print `No comments found.` plus zero total; exit `0`                                  | NS  | NS  | NS  |
| `CMT-OUT-HUMAN-TOTAL`        | complete result           | Print `Total: N comment(s)` only when traversal is complete                           | NS  | NS  | NS  |
| `CMT-OUT-HUMAN-NEXT`         | truncated result          | Print count, next-page command, all-remaining command, and M34 history ID             | NS  | NS  | NS  |
| `CMT-OUT-SHELL-QUOTE-TARGET` | generated target          | Shell-quote target safely rather than interpolating raw input                         | NS  | NS  | NS  |
| `CMT-OUT-SHELL-QUOTE-CURSOR` | generated cursor          | Shell-quote cursor safely and preserve exact bytes after shell parsing                | NS  | NS  | NS  |
| `CMT-OUT-NO-PARTIAL`         | failure output            | Emit no result stdout when any requested page or mutation fails                       | NS  | NS  | NS  |
| `CMT-OUT-NOCOLOR`            | no-color human            | Preserve text/content while removing color and emoji decoration                       | NS  | NS  | NS  |

### 8.3 Stable list JSON fields

Each row is an independently asserted public field contract. Object schemas are open for additive
optional fields but stable within the selected major release.

| ID                             | JSON path                 | Contract                                                                  | I   | T   | V   |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-OUT-LJ-TARGET`            | `target`                  | Required object describing the resolved parent resource                   | NS  | NS  | NS  |
| `CMT-OUT-LJ-TARGET-TYPE`       | `target.type`             | Required literal `issue` or `project`                                     | NS  | NS  | NS  |
| `CMT-OUT-LJ-TARGET-ID`         | `target.id`               | Required canonical Linear ID                                              | NS  | NS  | NS  |
| `CMT-OUT-LJ-TARGET-IDENTIFIER` | `target.identifier`       | Required for issue, absent for project                                    | NS  | NS  | NS  |
| `CMT-OUT-LJ-TARGET-TITLE`      | `target.title`            | Issue title when available; stable nullable/optional semantics documented | NS  | NS  | NS  |
| `CMT-OUT-LJ-TARGET-NAME`       | `target.name`             | Required project name, absent for issue                                   | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENTS`          | `comments`                | Required array in preserved Linear order; empty array for no comments     | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-ID`        | `comments[].id`           | Required comment ID                                                       | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-URL`       | `comments[].url`          | Nullable URL without triggering an extra fetch                            | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-BODY`      | `comments[].body`         | Required Markdown string exactly as returned                              | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-CREATED`   | `comments[].createdAt`    | Required ISO-8601 UTC-compatible string                                   | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-UPDATED`   | `comments[].updatedAt`    | Required ISO-8601 UTC-compatible string                                   | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-EDITED`    | `comments[].editedAt`     | Nullable ISO timestamp                                                    | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-RESOLVED`  | `comments[].resolvedAt`   | Nullable ISO timestamp                                                    | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-PARENT`    | `comments[].parentId`     | Nullable parent comment ID                                                | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-QUOTE`     | `comments[].quotedText`   | Nullable quoted text                                                      | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-USER`      | `comments[].user`         | Nullable `{id,name,email}` object                                         | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-BOT`       | `comments[].botActor`     | Nullable bot actor object with documented stable fields                   | NS  | NS  | NS  |
| `CMT-OUT-LJ-COMMENT-EXTERNAL`  | `comments[].externalUser` | Nullable external-user object with documented stable fields               | NS  | NS  | NS  |
| `CMT-OUT-LJ-PAGEINFO`          | `pageInfo`                | Required normalized pagination object                                     | NS  | NS  | NS  |
| `CMT-OUT-LJ-COUNT`             | `pageInfo.returnedCount`  | Nonnegative count equal to serialized comments length                     | NS  | NS  | NS  |
| `CMT-OUT-LJ-HASNEXT`           | `pageInfo.hasNextPage`    | Boolean indicating another cursor page exists                             | NS  | NS  | NS  |
| `CMT-OUT-LJ-ENDCURSOR`         | `pageInfo.endCursor`      | Opaque string only when more exist; otherwise null                        | NS  | NS  | NS  |
| `CMT-OUT-LJ-FETCHEDALL`        | `pageInfo.fetchedAll`     | True exactly when invocation reached connection exhaustion                | NS  | NS  | NS  |
| `CMT-OUT-LJ-HISTORY`           | `cursorHistory`           | Required M34 recording-status object                                      | NS  | NS  | NS  |
| `CMT-OUT-LJ-HISTORY-STATUS`    | `cursorHistory.status`    | `recorded`, `disabled`, `not_applicable`, or `failed`                     | NS  | NS  | NS  |
| `CMT-OUT-LJ-HISTORY-ID`        | `cursorHistory.entryId`   | UUID only when recorded; otherwise null                                   | NS  | NS  | NS  |

### 8.4 Stable add and dry-run JSON fields

| ID                          | JSON path                   | Contract                                                    | I   | T   | V   |
| --------------------------- | --------------------------- | ----------------------------------------------------------- | --- | --- | --- |
| `CMT-OUT-AJ-OK`             | `ok`                        | Required `true` on successful mutation                      | NS  | NS  | NS  |
| `CMT-OUT-AJ-WORKSPACE`      | `workspace`                 | Required existing `{name,source,urlKey?}` workspace shape   | NS  | NS  | NS  |
| `CMT-OUT-AJ-TARGET`         | `target`                    | Required target object using the list target field contract | NS  | NS  | NS  |
| `CMT-OUT-AJ-COMMENT`        | `comment`                   | Required serialized created comment object                  | NS  | NS  | NS  |
| `CMT-OUT-DJ-DRYRUN`         | `dryRun`                    | Required `true` for dry-run; no `ok` mutation claim         | NS  | NS  | NS  |
| `CMT-OUT-DJ-WORKSPACE`      | `workspace`                 | Resolved workspace shape without mutation                   | NS  | NS  | NS  |
| `CMT-OUT-DJ-TARGET`         | `target`                    | Resolved canonical target                                   | NS  | NS  | NS  |
| `CMT-OUT-DJ-BODY`           | `comment.body`              | Exact planned body                                          | NS  | NS  | NS  |
| `CMT-OUT-DJ-PARENT`         | `comment.parentId`          | Planned parent ID or null                                   | NS  | NS  | NS  |
| `CMT-OUT-DJ-TARGETRESOLVED` | `validation.targetResolved` | Required `true` only after successful resolution            | NS  | NS  | NS  |
| `CMT-OUT-DJ-NOMUTATION`     | `validation.serverMutation` | Required `false`                                            | NS  | NS  | NS  |

### 8.5 Error and exit contracts

| ID                    | Failure class                     | Contract                                                     | I   | T   | V   |
| --------------------- | --------------------------------- | ------------------------------------------------------------ | --- | --- | --- |
| `CMT-OUT-ERROR-HUMAN` | human ordinary error              | Lowercase-first actionable stderr; no result stdout          | NS  | NS  | NS  |
| `CMT-OUT-ERROR-JSON`  | machine ordinary error            | One `{"error":{"code","message"}}` object on stderr          | NS  | NS  | NS  |
| `CMT-OUT-ERROR-CODE`  | machine code                      | Stable documented string; no raw provider string as contract | NS  | NS  | NS  |
| `CMT-OUT-EXIT-0`      | success/empty list                | Exit `0`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-1`      | runtime/network/file/unclassified | Exit `1`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-2`      | usage/input/conflict              | Exit `2`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-3`      | target/comment not found          | Exit `3`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-4`      | auth/authorization                | Exit `4`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-5`      | invalid cursor/precondition       | Exit `5`                                                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-130`    | SIGINT                            | Flush and exit `130` without stack trace                     | NS  | NS  | NS  |
| `CMT-OUT-EXIT-143`    | SIGTERM                           | Flush and exit `143` without stack trace                     | NS  | NS  | NS  |

### 8.6 Existing `issue view --show-comments`

| ID                             | Contract                   | Atomic behavior                                                                                                            | I        | T   | V   |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | --- | --- |
| `CMT-VIEW-OPTION`              | existing `--show-comments` | Preserve spelling and opt-in behavior                                                                                      | BASELINE | NS  | NS  |
| `CMT-VIEW-LIMIT`               | summary bound              | Explicit first 50; do not expose comment-list options on view                                                              | NS       | NS  | NS  |
| `CMT-VIEW-HELP`                | help wording               | Replace “all comments” with “up to 50 comments”                                                                            | NS       | NS  | NS  |
| `CMT-VIEW-HUMAN-SHAPE`         | human rendering            | Preserve existing Comments section/thread presentation                                                                     | BASELINE | NS  | NS  |
| `CMT-VIEW-JSON-SHAPE`          | JSON rendering             | Preserve embedded `comments` array and comment fields; add sibling `commentsTruncated` boolean when comments are requested | BASELINE | NS  | NS  |
| `CMT-VIEW-TRUNCATION`          | more comments              | Human hint names `issue comment list <target> --all`; JSON reports `commentsTruncated: true`                               | NS       | NS  | NS  |
| `CMT-VIEW-NO-HISTORY`          | embedded summary           | Never create an M34 cursor-history entry from `issue view`                                                                 | NS       | NS  | NS  |
| `CMT-VIEW-ERROR`               | fetch failure              | Propagate normalized failure; never render false empty state                                                               | NS       | NS  | NS  |
| `CMT-VIEW-NO-PAGINATION-FLAGS` | view option isolation      | Reject `--after`, `--limit`, and `--all` on `issue view`                                                                   | BASELINE | NS  | NS  |

---

## 9. CLI Standard decisions, applicability, and deviations

### 9.1 Applicability map

| Axis                   | Applies?       | M35 treatment                                                                              |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Configurable           | Yes            | Reuse existing config/workspace selection; no new config keys                              |
| Networked              | Yes            | Linear GraphQL, auth, targeting, bounded pagination, and rate/failure behavior apply       |
| Destructive operations | No             | Comment creation mutates but does not delete/overwrite; destructive confirmation rules N/A |
| Scripted consumers     | Yes            | Stable JSON, streams, errors, and exit codes are central requirements                      |
| Long-running/async     | No             | Each operation completes synchronously; `--no-wait`/timeout operation model N/A            |
| Streaming              | No             | Lists are accumulated and emitted once; JSONL/watch/follow N/A                             |
| Plugins                | No             | No plugin discovery or extension contract in scope                                         |
| Caching/offline/state  | M34 dependency | No comment-result cache; cursor history is local XDG state owned by M34                    |
| Secrets                | Yes            | Existing credential routing applies; secrets must be redacted                              |

### 9.2 Decisions and deviations

| Rule/convention                 | Standard or repository precedent                                               | M35 decision                                                     | Classification and recommendation                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2.1 canonical verb             | Standard SHOULD prefers `create`; local nested resources use `add/list/remove` | Use `comment add`                                                | SHOULD waiver. Local consistency and natural “add a comment” language outweigh a comment-only `create` island. Record owner/date in `CONFORMANCE.md`.       |
| R3.9 request-body file          | Standard SHOULD prefers `--file`; existing issue comment uses `--body-file`    | Keep `--body-file`, add `-`/implicit stdin                       | SHOULD waiver. Field-specific name preserves current user vocabulary and leaves room for future non-body files.                                             |
| R3.4 short flags                | Standard reserves `-f` for force                                               | No short body-file flag; use `-o` and `-y` only                  | Conforming.                                                                                                                                                 |
| R4.2 output                     | Standard MUST uses `-o/--output`; `--json` equivalent                          | Use both on all four leaves                                      | Conforming to Standard; intentional deviation from older local `-f/--format` commands.                                                                      |
| R6.1 exits                      | Standard differentiates 0–5/130/143; current comment command uses 1            | New commands use differentiated exits                            | Conforming forward behavior; explicit local behavior change.                                                                                                |
| R7.2 list JSON                  | Existing list commands usually emit bare arrays                                | Emit `{target,comments,pageInfo,cursorHistory}`                  | Stable new-command envelope; M34 coordinates existing-list major migration.                                                                                 |
| R7.11 ordering                  | Lists SHOULD document deterministic order                                      | Request `createdAt`; preserve returned order                     | Conforming. Do not claim ascending/descending beyond Linear's API contract unless verified.                                                                 |
| R8.6 dry-run                    | Dry-run SHOULD identify side effects and validation level                      | Emit resolved target/body/parent and `serverMutation:false`      | Conforming.                                                                                                                                                 |
| R8.5 noninteractive             | Every prompt needs explicit noninteractive control                             | Add `--no-input` to both add commands; it never implies consent  | Conforming; depends on M33 shared confirmation/workspace safety.                                                                                            |
| R9.2 removal                    | MUST warn, retain hidden alias, and publish removal timeline                   | Remove legacy syntax immediately                                 | **Accepted nonconformance by explicit user direction (2026-07-25).** Cannot be claimed as a conforming waiver; release notes must give the exact migration. |
| R9.3 versioning                 | Breaking interface MUST be major version                                       | Ship M35 only as `v1.0.0` or later                               | **Resolved 2026-07-25.** The project owner accepted the coordinated major-release path; a `v0.35.0` release remains prohibited.                             |
| R9.5 mutation retries           | Never blindly retry non-idempotent mutations                                   | No automatic comment-create retry                                | Conforming.                                                                                                                                                 |
| R10.2/R10.3 pagination spelling | Standard uses `--paginate`; local lists use `--all`                            | Adopt M34 raw `--after` and `-a/--all`                           | Shared SHOULD waiver retained for local parity; M34 owns it.                                                                                                |
| R10.3 bounded default           | Bounded documented first page plus more-results hint                           | Default 50 and actionable cursor footer                          | Conforming.                                                                                                                                                 |
| R5.5 secret argv                | Standard forbids secrets in argv                                               | M35 inherits existing `--api-key <key>`                          | Pre-existing repository MUST blocker, outside comment implementation. M35 adds the two-stdin conflict but must not claim full conformance.                  |
| Human list default              | Existing lists are human-first                                                 | `table` default rendered as stacked thread records               | Consistent. No existing default changes.                                                                                                                    |
| Human cursor visibility         | Existing lists expose no cursor                                                | Show next/all-remaining commands, raw cursor, and history ID     | M34 addition necessary for human page two and later inspection.                                                                                             |
| Cursor context                  | Raw Linear cursor carries no readable query context                            | Persist sanitized advisory M34 history by default; allow opt-out | Explicit user decision; history never validates or rewrites raw cursor.                                                                                     |
| Project comment scope           | Linear project updates have separate comments                                  | Direct project comments only                                     | Explicit scope guard; do not overload terms.                                                                                                                |

### 9.3 Proposed upstream standard amendment

No amendment is proposed for the M35-specific waivers. `add` and `--body-file` are local continuity
choices, and `--all` reflects repository debt rather than a general improvement over R10.3.

The raw `--after` resume capability is compatible with R10.3 and could be considered as an
additive example in a future standard revision, but M35 should first validate it in real use before
proposing a general rule edit.

### 9.4 Explicit defaults and behavior-change register

| Surface                        | Before M35                                | M35 behavior                                                                  | Classification                               |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Issue comment creation grammar | `issue comment <identifier>`              | `issue comment add <identifier>` only                                         | Intentional breaking command change          |
| Issue comment creation options | body/file only; no output/safety contract | stdin, reply, dry-run, output/JSON, workspace guard, yes, no-input            | Additive options on replacement route        |
| Issue comment list             | No dedicated command                      | Bounded human-first list, JSON envelope, raw cursor resume/history, all-pages | New command                                  |
| Project comment add/list       | Unsupported                               | Symmetrical direct project comment commands                                   | New commands                                 |
| Comment-list default           | N/A                                       | Human `table` records, limit 50, no cursor start, `--all=false`               | New documented default                       |
| Existing issue-view comments   | Implicit first 50 but help says all       | Explicit first 50, corrected help, truncation hint                            | Accuracy/correctness change; count unchanged |
| Comment fetch failure          | Converted to empty list                   | Propagated normalized error                                                   | Intentional correctness change               |
| Add human output               | Minimal success record                    | Target, comment ID, URL when present                                          | Replacement command output change            |
| Add JSON output                | Unsupported                               | Stable workspace/target/comment envelope                                      | New machine contract                         |
| List JSON style                | Existing lists often use bare arrays      | Comment lists use target/comments/pageInfo/history envelope                   | M34 shared resumable convention              |
| Pagination option spelling     | Existing issue/project lists use `--all`  | Comments use `--limit`, raw `--after`, `-a/--all`, history opt-out            | M34 shared convention                        |
| Numeric pages                  | Unsupported                               | Still unsupported; explicit rejection tests                                   | No change, now documented                    |
| SDK dependency                 | `@linear/sdk` 61.x                        | Unchanged; raw GraphQL adds current project-comment capability                | No dependency-default change                 |

Explicit new defaults:

```text
add:  output=table, dryRun=false, yes=false, noInput=false, replyTo=null, bodySource=required
list: output=table, limit=50, after=null, all=false, cursorHistory=true
```

---

## 10. Test, documentation, and verification ledger

### 10.1 Test harnesses

| ID                     | Test artifact                           | Required coverage                                                                            | I   | T   | V   |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-TST-REGISTRATION` | Commander registration tests            | Every command/group/argument/option/default plus legacy/rejected routes                      | NS  | NS  | NS  |
| `CMT-TST-HELP`         | Built help inventory                    | Four leaf helps, two group helps, examples, defaults, conflicts, absence assertions          | NS  | NS  | NS  |
| `CMT-TST-INPUT`        | Shared input unit tests                 | inline/file/explicit stdin/implicit stdin/precedence/empty/errors/cwd                        | NS  | NS  | NS  |
| `CMT-TST-INPUT-CLI`    | Built-CLI stdin tests                   | Real pipes, EOF, API-key stdin conflict, no TTY prompt                                       | NS  | NS  | NS  |
| `CMT-TST-API`          | `src/lib/api/comments.test.ts`          | GraphQL variables/fragments, issue/project targets, replies, failures, no update comments    | NS  | NS  | NS  |
| `CMT-TST-PAGINATION`   | M35 comment-adapter tests               | comment option/query/envelope/history mapping against the already-green M34 adopter contract | NS  | NS  | NS  |
| `CMT-TST-ISSUE-ADD`    | issue add runner tests                  | every `CMT-OPT-IA-*`, target, safety, output, errors                                         | NS  | NS  | NS  |
| `CMT-TST-PROJECT-ADD`  | project add runner tests                | every `CMT-OPT-PA-*`, target, safety, output, errors                                         | NS  | NS  | NS  |
| `CMT-TST-ISSUE-LIST`   | issue list runner tests                 | every `CMT-OPT-IL-*`, pagination, human/JSON, exits                                          | NS  | NS  | NS  |
| `CMT-TST-PROJECT-LIST` | project list runner tests               | every `CMT-OPT-PL-*`, pagination, human/JSON, exits                                          | NS  | NS  | NS  |
| `CMT-TST-WORKSPACE`    | mutation-guard tests                    | explicit/auto/denied/multi-workspace/yes/no-input/JSON/quiet/non-TTY                         | NS  | NS  | NS  |
| `CMT-TST-OUTPUT`       | serializer/renderer snapshots           | every `CMT-OUT-*` field/stream contract and shell quoting                                    | NS  | NS  | NS  |
| `CMT-TST-ERRORS`       | error normalization tests               | stable codes, JSON stderr, exits 1–5, no stdout                                              | NS  | NS  | NS  |
| `CMT-TST-VIEW`         | issue-view regressions                  | 50 bound, shape preservation, corrected help/hint, propagated errors                         | NS  | NS  | NS  |
| `CMT-TST-OFFLINE`      | `tests/scripts/test-comments-cli.sh`    | Built CLI routing/help/stdin/parser/streams/JSON/no-hang without API key                     | NS  | NS  | NS  |
| `CMT-TST-LIVE-ISSUE`   | ConceptM issue comment live lifecycle   | assert ConceptM; self-create issue/comment/reply/list/resume/all; record IDs and cleanup     | NS  | NS  | NS  |
| `CMT-TST-LIVE-PROJECT` | ConceptM project comment live lifecycle | assert ConceptM; self-create project/comment/reply/list/resume/all; record IDs and cleanup   | NS  | NS  | NS  |
| `CMT-TST-RUNNER`       | aggregate script/workflow registration  | Offline suite in normal gate; live suites only in opt-in live gate                           | NS  | NS  | NS  |
| `CMT-TST-TRACE`        | ledger traceability checker             | No unknown/missing IDs; every atomic ID maps to assertion/evidence                           | NS  | NS  | NS  |
| `CMT-TST-SCHEMA`       | JSON schema/type fixtures               | Stable list/add/dry-run/error field types and nullability                                    | NS  | NS  | NS  |

### 10.2 Documentation and conformance

| ID                            | Artifact                       | Required change                                                               | I    | T   | V    |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ---- | --- | ---- |
| `CMT-DOC-PLAN`                | This M35 plan                  | Authoritative atomic ledger, M34 dependency, phases, deviations, evidence log | DONE | N/A | PASS |
| `CMT-DOC-MILESTONE`           | `MILESTONES.md`                | Add M35 goal, dependencies, rollups, defaults, gates, and plan link           | DONE | N/A | PASS |
| `CMT-DOC-README-COMMANDS`     | `README.md`                    | Four canonical routes with issue/project examples                             | NS   | NS  | NS   |
| `CMT-DOC-README-INPUT`        | `README.md`                    | body/file/stdin/reply/dry-run/workspace behavior and conflicts                | NS   | NS  | NS   |
| `CMT-DOC-README-PAGINATION`   | `README.md`                    | raw cursor, history/opt-out, page two/all remaining, no numeric page N        | NS   | NS  | NS   |
| `CMT-DOC-README-OUTPUT`       | `README.md`                    | human defaults, JSON envelopes, pageInfo, stream rules                        | NS   | NS  | NS   |
| `CMT-DOC-README-ERRORS`       | `README.md` or error reference | stable codes and exits 0–5/130/143                                            | NS   | NS  | NS   |
| `CMT-DOC-MIGRATION`           | migration/release note         | Exact old→new command examples; no claim of compatibility                     | NS   | NS  | NS   |
| `CMT-DOC-BREAKING-VERSION`    | release metadata               | Record accepted v1.0.0-or-later path and retain explicit R9.2 nonconformance  | DONE | N/A | PASS |
| `CMT-DOC-CHANGELOG`           | `CHANGELOG.md`                 | Direct project support, pagination, issue-view correction, breaking route     | NS   | NS  | NS   |
| `CMT-DOC-CONFORMANCE`         | `CONFORMANCE.md`               | Pin v1.4.14; M35 waivers/blockers; cite M34 as sole R10.2/R10.3 waiver owner  | NS   | NS  | NS   |
| `CMT-DOC-M34-DEPENDENCIES`    | M35/M34 dependency record      | Preserve §3.3 exact adopter map and reject unknown/stale `CPH-*` references   | NS   | NS  | NS   |
| `CMT-DOC-HELP`                | generated command help         | Every argument/option/default/interaction/example and rejected legacy hint    | NS   | NS  | NS   |
| `CMT-DOC-TESTS`               | `tests/README.md`              | Offline/live comment suite usage, fixture cleanup, traceability               | NS   | NS  | NS   |
| `CMT-DOC-PROJECT-DISTINCTION` | README/help                    | Direct project comments explicitly distinguished from project-update comments | NS   | NS  | NS   |
| `CMT-DOC-SOURCE-EVIDENCE`     | plan/conformance references    | Retain official Linear project-comment and pagination sources                 | DONE | N/A | PASS |

### 10.3 Aggregate verification gates

| ID                      | Verification                                 | Pass condition                                                                               | I   | T   | V   |
| ----------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- | --- | --- | --- |
| `CMT-VER-UNIT`          | `npm test`                                   | All Vitest suites pass                                                                       | N/A | N/A | NS  |
| `CMT-VER-TYPE`          | `npm run typecheck`                          | Exit `0`, no diagnostics                                                                     | N/A | N/A | NS  |
| `CMT-VER-LINT`          | `npm run lint`                               | Exit `0`, no diagnostics                                                                     | N/A | N/A | NS  |
| `CMT-VER-BUILD`         | `npm run build`                              | Exit `0`, built CLI produced                                                                 | N/A | N/A | NS  |
| `CMT-VER-HELP`          | built help audit                             | Exact approved routes/options/defaults; rejected routes absent                               | N/A | N/A | NS  |
| `CMT-VER-LEGACY`        | old invocation probe                         | Exit `2`, stderr replacement, zero API mutation                                              | N/A | N/A | NS  |
| `CMT-VER-INPUT`         | built stdin/file matrix                      | Correct source, precedence, empty/file/API-key conflicts                                     | N/A | N/A | NS  |
| `CMT-VER-PAGINATION`    | M35 adapter + built + ConceptM live matrix   | Comment wiring/mapping pass and every exact M34 prerequisite in §3.3 is PASS                 | N/A | N/A | NS  |
| `CMT-VER-JSON`          | pipe every JSON success/dry-run through `jq` | Clean single-document stdout and exact fields                                                | N/A | N/A | NS  |
| `CMT-VER-JSON-ERROR`    | pipe machine stderr through `jq`             | Clean error object and matching exit code                                                    | N/A | N/A | NS  |
| `CMT-VER-STREAMS`       | capture stdout/stderr separately             | No diagnostics in stdout; no requested result in stderr                                      | N/A | N/A | NS  |
| `CMT-VER-WORKSPACE`     | multi-workspace probes                       | Envelope and actual mutation target match selected workspace                                 | N/A | N/A | NS  |
| `CMT-VER-DRYRUN`        | spies and live-safe probe                    | Complete resolved plan, zero confirmation, zero mutation                                     | N/A | N/A | NS  |
| `CMT-VER-LIVE-CONCEPTM` | live workspace preflight                     | Resolve and assert ConceptM before mutation; fail closed on mismatch; record IDs and cleanup | N/A | N/A | NS  |
| `CMT-VER-LIVE-ISSUE`    | ConceptM Linear fixture                      | Add/reply/page/next/all succeed in ConceptM; fixture cleanup recorded                        | N/A | N/A | NS  |
| `CMT-VER-LIVE-PROJECT`  | ConceptM Linear fixture                      | Direct project add/reply/page/next/all succeed in ConceptM; cleanup recorded                 | N/A | N/A | NS  |
| `CMT-VER-VIEW`          | existing issue-view shell/unit suites        | Shapes retained; corrected limit/help/hint/error behavior                                    | N/A | N/A | NS  |
| `CMT-VER-NO-SDK-DIFF`   | package/lock diff inspection                 | No SDK dependency or lockfile version change                                                 | N/A | N/A | NS  |
| `CMT-VER-DIFF`          | `git diff --check` plus scoped review        | No whitespace errors or unrelated changes                                                    | N/A | N/A | NS  |
| `CMT-VER-TRACE`         | ledger checker                               | Every atomic ID has correct test/evidence; no orphan assertions                              | N/A | N/A | NS  |
| `CMT-VER-CONFORMANCE`   | conformance review                           | Every MUST blocker and SHOULD waiver visible; no silent deviation                            | N/A | N/A | NS  |

---

## 11. TDD execution plan and planned file structure

Every phase is a dependency boundary, not permission to batch-complete its rows. Within each phase,
advance one ID at a time through RED → IMPLEMENT → GREEN → VERIFY.

### Phase 0 — Planning publication and contract freeze

**IDs:** `CMT-DOC-PLAN`, `CMT-DOC-MILESTONE`, `CMT-DOC-SOURCE-EVIDENCE`, all baseline rows.

1. Publish this file and the M35 entry from the dedicated planning worktree.
2. Capture current help for `issue comment`, `issue view`, `issue list`, and `project list`.
3. Characterize the current legacy issue-comment success route and current issue-view first-page
   behavior before removing anything.
4. Generate a machine-readable inventory of every approved/rejected command, argument, and option.

**Gate:** planning files validate; every baseline row has a characterization assertion ready; no
production source has changed in the planning worktree.

### Phase 1 — Command tree and parser contracts

**IDs:** all `CMT-CMD-*`, `CMT-ARG-*-TARGET`, `CMT-OPT-COMMENT-HELP`, and every
command-specific terminator, option-isolation, and rejected-pagination `CMT-RULE-*` row.

1. RED-test the four canonical commands, two groups, four positional arguments, and every rejected
   alias/route.
2. Convert `issue comment` from leaf to group and add the project group.
3. Register leaf syntax and delegate to stubbed injectable runners without implementing API calls.
4. Implement the explicit legacy rejection and exact migration suggestion.

**Gate:** help/routing/parser assertions pass from the built CLI; all runners still make no remote
mutation.

### Phase 2 — Shared body input, output-mode parsing, and targets

**IDs:** all `CMT-INP-*`, target-resolution rows, inherited options, all body/output interaction
rules.

Execute in atomic order:

1. inline body;
2. path body;
3. explicit stdin;
4. implicit stdin;
5. explicit-source precedence;
6. empty/missing/error cases;
7. `-C` path behavior;
8. `--api-key -` conflict;
9. output enum and JSON equivalence for each leaf;
10. issue and project resolver adapters.

**Gate:** deterministic unit and built-CLI tests prove every source and parser interaction without a
Linear credential.

### Phase 3 — Shared GraphQL comment layer

**IDs:** all `CMT-API-*` except the view adapter, plus reply argument rows.

1. RED-test typed raw responses and exact GraphQL variables for issue read/create.
2. Implement the shared model/fragment and issue operations.
3. RED-test project direct-comment query/create and prove no `projectUpdateId` appears.
4. Implement project operations through raw transport.
5. Add reply validation, payload-success enforcement, error normalization, and facade exports.
6. Prove package and lockfile remain unchanged.

**Gate:** API tests prove direct issue/project semantics, nullable creators, reply target safety, and
no swallowed failures.

### Phase 4 — M34 comment pagination/history adapter

**IDs:** every retained comment-adapter `CMT-PAG-*`, list pagination interaction, and §3.3
mapping row. Every exact M34 prerequisite must be PASS before this phase can VERIFY.

Implement only comment-specific adoption in ledger order: map options to M34, comment target/order
and sanitized history context, one-page/all/resume requests, normalized errors, and comment
envelopes. Do not RED-test or implement M34-owned validation, walkers, loop guards, raw fidelity,
history storage, or common page fields again.

**Gate:** a deterministic multi-page fake proves exact request sequence and every failure path; no
command renderer is involved yet.

### Phase 5 — `issue comment add`

**IDs:** `CMT-CMD-ISSUE-ADD`, `CMT-ARG-ISSUE-ADD-*`, every `CMT-OPT-IA-*`, issue-add rules,
`CMT-SAF-IA-*`, and issue add output fields.

TDD slices:

1. minimal inline add;
2. file and stdin sources through the shared helper;
3. `--reply-to`;
4. `--dry-run` and dry-run JSON fields;
5. `-o/--output` and `--json` success;
6. workspace guard, `-y`, and `--no-input`;
7. human success, machine errors, and exit mapping.

**Gate:** every issue-add option row is `I=DONE`, `T=GREEN`, `V=PASS`; live write remains deferred
to the aggregate live phase.

### Phase 6 — `project comment add`

**IDs:** project-add counterparts from Phase 5.

Repeat the same option-by-option order without marking parity based on issue coverage. Include an
assertion that raw mutation variables contain `projectId` and never `projectUpdateId`.

**Gate:** every project-add option row independently passes; issue/project shared-code assertions
remain green.

### Phase 7 — `issue comment list`

**IDs:** `CMT-CMD-ISSUE-LIST`, issue list argument/options/rules, list JSON fields, issue human list,
cursor footer, shell quoting, and relevant exits.

TDD slices:

1. default 50 human thread;
2. `--limit` values and errors;
3. raw `--after`, next-page footer, and recorded M34 history;
4. `-a/--all`, `--after --all`, and `--no-cursor-history`;
5. `--all --limit` precedence;
6. empty/complete/truncated states;
7. `-o json` and `--json` field-by-field assertions;
8. later-page failure/no-partial-output behavior.

**Gate:** every issue-list option and output-field row independently passes.

### Phase 8 — `project comment list`

**IDs:** project-list counterparts from Phase 7.

Repeat every slice using project fixtures and resolver paths. Do not infer project parity from issue
tests.

**Gate:** every project-list option and output-field row independently passes.

### Phase 9 — Existing issue-view integration

**IDs:** `CMT-API-ISSUE-VIEW-ADAPTER`, `CMT-API-NO-SWALLOW`, all `CMT-VIEW-*`.

1. Characterize existing human and JSON shapes.
2. RED-test explicit 50/pageInfo handling, corrected help, truncation hint, and error propagation.
3. Route view through the shared reader/adapter without exposing dedicated list flags.
4. Rerun the existing shell suite plus targeted unit tests.

**Gate:** shape snapshots remain green; only the documented help, hint, and failure semantics change.

### Phase 10 — Documentation, conformance, and traceability

**IDs:** all remaining `CMT-DOC-*`, `CMT-TST-*`, `CMT-VER-HELP`, `CMT-VER-TRACE`,
`CMT-VER-CONFORMANCE`.

1. Generate documentation from the tested interface.
2. Add exact migration and breaking-version decision.
3. Create/update `CONFORMANCE.md` with M35 blockers/waivers and cite M34's sole pagination waiver.
4. Publish and validate every exact §3.3 M34 dependency.
5. Register offline suites normally and ConceptM-only live suites in the opt-in live group.
6. Add a ledger checker that parses every backticked `CMT-*` ID and validates test/evidence mapping.

**Gate:** every documented command executes as written or is an explicitly marked live example;
traceability reports zero omissions.

### Phase 11 — Aggregate and live verification

**IDs:** all `CMT-VER-*`.

1. Run unit, type, lint, build, and offline built-CLI gates.
2. Audit help, streams, JSON/error schemas, exits, stdin, workspace safety, and dry-run no-write.
3. Assert ConceptM, then run the opt-in issue fixture and record issue/comment/reply IDs plus cleanup.
4. Reassert ConceptM, then run the opt-in project fixture and record project/comment/reply IDs plus cleanup.
5. Inspect dependency/lock diffs and the entire scoped source diff.
6. Recompute every command and milestone rollup from atomic rows.

**Release gate:** any `NS`, `RED`, `FAIL`, or `BLOCKED` in the authoritative completion map prevents
release. The plan-time baseline cells in the contract tables are historical inputs, not current
status. R9.2 remains an acknowledged user-directed nonconformance, so the repository must not claim
full R9.2 compliance. R9.3 version selection is resolved by the accepted `v1.0.0`-or-later release
path.

### 11.1 Planned file structure

**New or likely new**

- `src/commands/comment/input.ts`
- `src/commands/comment/output.ts`
- `src/commands/issue/comment/register.ts`
- `src/commands/issue/comment/add.ts`
- `src/commands/issue/comment/list.ts`
- `src/commands/project/comment/register.ts`
- `src/commands/project/comment/add.ts`
- `src/commands/project/comment/list.ts`
- `src/lib/api/comments.ts`
- co-located unit/runner tests for each module
- `tests/scripts/test-comments-cli.sh`
- opt-in live issue/project comment test scripts or suites
- `CONFORMANCE.md` if still absent at implementation time

**Modified**

- `src/commands/issue/register.ts`
- `src/commands/project/register.ts`
- `src/commands/issue/view.ts`
- `src/lib/api/issues.ts`
- `src/lib/api/index.ts`
- `src/lib/linear-client.ts`
- M34-owned `src/lib/pagination.ts` and `src/lib/cursor-history.ts` only through their public APIs
- `src/lib/file-utils.ts` only if a generic stdin helper is proven safe for existing callers;
  otherwise leave it untouched
- `README.md`, `CHANGELOG.md`, `MILESTONES.md`, and test documentation
- aggregate offline/live test runners or workflows only when registration requires it

**Removed/replaced**

- `src/commands/issue/comment.ts` leaf implementation after its behavior has characterization
  coverage and the new group is green

### 11.2 Dependency constraints

- Do not upgrade `@linear/sdk` as part of M35.
- Every exact M34 prerequisite in §3.3 must be PASS before its M35 list adopter closes; M34 never
  depends on M35.
- M33's shared confirmation/workspace-safety primitive must be green before M35 add safety closes.
- Do not add a pagination library, duplicate history store, output framework, or stdin dependency
  unless native/shared code cannot satisfy a proven test.
- Do not change resolver cache semantics.
- Do not independently alter existing issue/project list contracts; M34 owns coordinated changes.
- Do not implement comment edit/delete/resolve/reaction support opportunistically.

---

## 12. Evidence log

Implementation appends rows; existing rows must never be rewritten to hide a prior RED or failure.

| Date       | ID                                                                                       | Phase     | Command/test                                                                                 | Expected                                                                                       | Observed                                                                                                                                                                                                                            | Files                                                                 | Revision     | Notes                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | IMPLEMENT | Create M35 authoritative plan in dedicated planning worktree                                 | File contains atomic ledgers and TDD method                                                    | Plan created                                                                                                                                                                                                                        | `docs/superpowers/plans/2026-07-22-M35-issue-project-comments-tdd.md` | working-tree | Planning only                                                                                           |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | VERIFY    | Duplicate-ID, heading, link, Markdown, and scoped-diff audit                                 | All structural checks pass                                                                     | PASS: 264 ledger rows, 264 unique IDs, zero duplicates or stale prior-number refs, ordered headings, valid milestone link, and clean `git diff --check`                                                                             | plan file                                                             | working-tree | Destination branch/worktree identity also verified                                                      |
| 2026-07-22 | `CMT-DOC-MILESTONE`                                                                      | IMPLEMENT | Add concise M35 rollup to root milestone ledger                                              | M35 links authoritative plan and names gates                                                   | M35 entry added ahead of the existing M33 entry without replacing M33 changes                                                                                                                                                       | `MILESTONES.md`                                                       | working-tree | Shared planning ledger                                                                                  |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | IMPLEMENT | Migrate M35 planning into `plan/label-project-lifecycle-tdd`                                 | Exact plan copied and worktree references updated                                              | Destination plan present; source-to-destination diff contains only the intended worktree and migration-evidence updates                                                                                                             | plan file                                                             | working-tree | Destination `/Users/stevemorin/wt/agent2linear/label-project-lifecycle-tdd-plan`                        |
| 2026-07-22 | `CMT-DOC-MILESTONE`                                                                      | VERIFY    | Validate M35 and existing M33 planning in the shared ledger                                  | Both milestone links/files exist and M35 does not replace M33                                  | PASS: M35 heading at line 16, M33 at line 161, both plan files present                                                                                                                                                              | `MILESTONES.md`, both plan files                                      | working-tree | M33 pre-existing changes preserved                                                                      |
| 2026-07-22 | `CMT-DOC-SOURCE-EVIDENCE`                                                                | VERIFY    | Compare official Linear changelog, pagination, SDK docs/releases with pinned repo dependency | Direct project comments and cursor model confirmed; SDK gap explicit                           | Confirmed                                                                                                                                                                                                                           | plan references, `package.json`, lockfile                             | working-tree | `milestone.md` domain was unreachable; repository milestone convention used                             |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | RED       | Reconcile M35 with raw cursor/history and shared M34/M33 dependencies                        | Prior plan duplicated pagination, omitted no-input/history, and claimed premature verification | Plan reopened; corrective publication in progress                                                                                                                                                                                   | this plan; M34 plan; `MILESTONES.md`                                  | working-tree | Supersedes prior structural PASS after final verification                                               |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | GREEN     | Re-run structural plan audit after reconciliation                                            | Updated ledger and Markdown are structurally valid                                             | PASS: 284 rows, 284 unique IDs, valid tables/fences/headings                                                                                                                                                                        | this plan                                                             | working-tree | Raw cursor, history, no-input, and dependencies tracked                                                 |
| 2026-07-22 | `CMT-DOC-PLAN`                                                                           | VERIFY    | Cross-plan/link/stale-contract/diff audit                                                    | M35 delegates pagination/history to M34 and safety to M33                                      | PASS: no stale saved-cursor exclusion or private pagination module; clean diff check                                                                                                                                                | all three plans; `MILESTONES.md`                                      | working-tree | No production source changed                                                                            |
| 2026-07-22 | `CMT-DOC-MILESTONE`                                                                      | VERIFY    | Validate M35 count/link/dependencies after republish                                         | Entry matches 284 IDs and names M34 dependency                                                 | PASS                                                                                                                                                                                                                                | `MILESTONES.md`; this plan                                            | working-tree | Consolidated worktree                                                                                   |
| 2026-07-23 | `CMT-DOC-PLAN`                                                                           | IMPLEMENT | Apply accepted AR-003 ownership split and ConceptM live guard                                | M35 owns comment adopters only and live writes are ConceptM-only                               | Exact M34 dependency map, command-specific rules, and fail-closed ConceptM policy added                                                                                                                                             | this plan; M34 plan; `MILESTONES.md`                                  | working-tree | Planning only                                                                                           |
| 2026-07-23 | `CMT-DOC-PLAN`                                                                           | VERIFY    | Atomic-ID, M34 dependency, Markdown, whitespace, and scoped-status audit                     | M35 comment adopters are independently auditable without shared-primitive ownership            | PASS: 318 unique atomic IDs; all 72 dependency rows reference known local and M34 IDs; ConceptM policy present; tables/fences/headings and diff checks clean                                                                        | this plan; M33/M34 plans; `MILESTONES.md`                             | working-tree | No production source changed                                                                            |
| 2026-07-24 | `CMT-API-PROJECT-QUERY`                                                                  | RED       | Guarded ConceptM disposable project probe                                                    | Newly created direct project comments are listable                                             | `project(id){comments}` returned empty while top-level project-filtered comments returned all three records                                                                                                                         | `src/lib/api/comments.ts`, live probe                                 | working-tree | Fixture cleanup completed                                                                               |
| 2026-07-24 | `CMT-API-PROJECT-QUERY`                                                                  | IMPLEMENT | Replace project connection query with exact top-level project filter                         | Read direct project comments without project-update leakage                                    | Query changed to `comments(filter:{project:{id:{eq:$targetId}}})`                                                                                                                                                                   | `src/lib/api/comments.ts`                                             | working-tree | No SDK upgrade                                                                                          |
| 2026-07-24 | `CMT-API-PROJECT-QUERY`                                                                  | GREEN     | `npx vitest run src/lib/api/comments.test.ts`                                                | Focused query/variables test passes                                                            | PASS: 9 tests                                                                                                                                                                                                                       | API source/test                                                       | working-tree | Exact filter asserted; `project(id)` excluded                                                           |
| 2026-07-24 | `CMT-VER-LIVE`                                                                           | VERIFY    | Guarded `test-comments-live.js` in exact ConceptM workspace                                  | Issue/project add, reply, page two, all remaining, history, and cleanup pass                   | PASS: issue `1097ebc0-9fef-47dd-be23-f7a80a5defba`, project `e6bd009b-1313-492b-aa6f-1bbcacfe6fc6`, both deleted; cleanup complete                                                                                                  | `tests/scripts/test-comments-live.ts`                                 | working-tree | History entries `07cbf7bd-0f5b-495c-a2fd-fc44a4a7df9b`, `de559fb7-9471-4b71-8a8c-4696de42fd79`          |
| 2026-07-24 | `CMT-TST-TRACE`                                                                          | GREEN     | `npx vitest run src/lib/m35-traceability.test.ts`                                            | Every unique atomic ID has one complete evidence row                                           | PASS: 318 rows, 318 unique IDs, exact plan equality                                                                                                                                                                                 | M35 plan, trace report, checker                                       | working-tree | 71 repeated dependency references resolve to their unique row                                           |
| 2026-07-24 | `CMT-API-NO-PROJECT-UPDATE`                                                              | RED       | Focused project-query assertion                                                              | Direct project query explicitly excludes project-update relations                              | RED: query lacked `projectUpdate:{null:true}`                                                                                                                                                                                       | API source/test                                                       | working-tree | Scope firewall made explicit                                                                            |
| 2026-07-24 | `CMT-API-NO-PROJECT-UPDATE`                                                              | IMPLEMENT | Add `projectUpdate:{null:true}` alongside exact project filter                               | Project-update comments cannot enter direct list                                               | Explicit compound filter implemented                                                                                                                                                                                                | `src/lib/api/comments.ts`                                             | working-tree | Raw GraphQL only                                                                                        |
| 2026-07-24 | `CMT-API-NO-PROJECT-UPDATE`                                                              | GREEN     | `npx vitest run src/lib/api/comments.test.ts`                                                | Exact query assertion passes                                                                   | PASS: 9 tests                                                                                                                                                                                                                       | API source/test                                                       | working-tree | —                                                                                                       |
| 2026-07-24 | `CMT-VER-LIVE`                                                                           | VERIFY    | Guarded ConceptM lifecycle with project-update control                                       | Control comment is absent; direct issue/project traversal and cleanup pass                     | PASS: issue `c3c10b7d-dae3-489b-9a26-08302731b32f`, project `1f3a0633-4f3b-4de0-a2ec-5cb4167b558e`, update `8ab51a4d-b679-4925-8644-0cc015b42aea`, update comment `d1efd285-c7e1-4278-bb69-c61084a03e69` excluded, cleanup complete | live harness                                                          | working-tree | A prior transient cleanup failure for separate fixtures was recovered by exact-ID deletion before rerun |
| 2026-07-24 | `CMT-VER-UNIT`                                                                           | VERIFY    | `npx vitest run`                                                                             | Full unit and integration suite passes                                                         | PASS: 59 files passed, 1 skipped; 891 tests passed, 1 skipped                                                                                                                                                                       | source and test suite                                                 | working-tree | 892 total tests                                                                                         |
| 2026-07-24 | `CMT-VER-TYPE` / `CMT-VER-LINT` / `CMT-VER-BUILD`                                        | VERIFY    | `npx tsc --noEmit`; `npx eslint src --ext .ts,.tsx`; `npx tsup`                              | Typecheck, lint, and production build pass                                                     | PASS; lint exits 0 with one pre-existing `src/lib/aliases.ts` ordering warning                                                                                                                                                      | source tree and build configuration                                   | working-tree | No unrelated warning cleanup                                                                            |
| 2026-07-24 | `CMT-VER-HELP` / `CMT-VER-LEGACY` / `CMT-VER-INPUT` / `CMT-VER-JSON` / `CMT-VER-STREAMS` | VERIFY    | Offline built-CLI comment and cursor-history scripts                                         | Approved routing, input, output, pagination, history, and rejection contracts pass             | PASS: comments and cursor-history scripts; config-override regression 21/21 with sanitized PATH to avoid an unrelated untrusted-mise configuration                                                                                  | built CLI scripts                                                     | working-tree | No network writes                                                                                       |
| 2026-07-24 | `CMT-VER-TRACE`                                                                          | VERIFY    | `npx vitest run src/lib/m35-traceability.test.ts`                                            | Exactly 318 complete unique rows and project-query contract                                    | PASS: 2 tests; 318 rows, 318 unique IDs                                                                                                                                                                                             | plan, trace report, checker                                           | working-tree | Completion report published                                                                             |
| 2026-07-24 | `CMT-VER-NO-SDK-DIFF` / `CMT-VER-DIFF` / `CMT-VER-CONFORMANCE`                           | VERIFY    | Package/lock scoped diff, `git diff --check`, and publishable-tier conformance audit         | No SDK/package drift, clean patch, blockers remain explicit                                    | PASS: package and lock diff empty; whitespace clean; R9.2/R9.3 release blockers documented                                                                                                                                          | package files, patch, CONFORMANCE.md                                  | working-tree | No version bump or release authorized                                                                   |

| 2026-07-24 | `CMT-TST-TRACE` | RED | Re-run traceability after Markdown formatting | Machine audit still recognizes all 318 ledger and completion rows | RED: strict single-space table regex recognized only 26 formatted plan rows | traceability checker and formatted plan | working-tree | Documentation-format regression; implementation evidence remained intact |
| 2026-07-24 | `CMT-TST-TRACE` | IMPLEMENT | Make trace parser accept semantically equivalent aligned Markdown-table whitespace | Prettier alignment cannot hide tracked IDs or completion rows | Parser now tolerates column padding while preserving exact ID/status/evidence validation | `src/lib/m35-traceability.test.ts` | working-tree | No contract relaxation |
| 2026-07-24 | `CMT-TST-TRACE` / `CMT-VER-TRACE` | GREEN | `npx vitest run src/lib/m35-traceability.test.ts` | Exactly 318 unique IDs remain auditable after formatting | PASS: 2 tests; exact 318-row equality and project-query contract | plan, trace report, checker | working-tree | Closeout regression resolved |
| 2026-07-25 | `CMT-DOC-BREAKING-VERSION` | VERIFY | Record project-owner release decision | Resolve R9.3 version selection without obscuring R9.2 nonconformance | PASS: coordinated `v1.0.0`-or-later path accepted; `v0.35.0` prohibited; R9.2 exception remains explicit | MILESTONES.md, CONFORMANCE.md, this plan | decision worktree | No version bump, publish, or release action authorized |
| 2026-07-26 | `CMT-DOC-BREAKING-VERSION` | IMPLEMENT | Record the accepted release decision's implementation provenance | The decision is applied consistently to M33–M35 release documentation | PASS: commit `df38cd6` records the accepted `v1.0.0`-or-later path while preserving the R9.2 nonconformance | MILESTONES.md, CONFORMANCE.md, M33/M35 plans | `df38cd6` | Retrospective evidence correction; `T=N/A`, and this owner decision changes no CLI behavior, so RED/GREEN do not apply |

---

## 13. Out of scope

- Comment editing, deletion, reactions, resolve/unresolve, or quoted-description inline comments.
- Initiative, document, team, release, or project-update comments.
- Numeric page navigation, backward cursors, public page size, or snapshots.
- Compatibility alias/shim for the legacy issue-comment grammar.
- JSONL, YAML, TSV, wide, or name-only comment output.
- Interactive editor/composer behavior.
- Automatic retries of comment mutations.
- Comment-result caching or offline reads. Cursor history is the M34 local-state dependency.
- Repository-wide output, exit, auth, or command-naming migrations beyond coordinated M34 changes.
- SDK upgrade, version bump, release, publish, push, PR creation, or merge without a separate request.

---

## 14. Completion definition

M35 implementation is complete only when:

1. every row in the authoritative completion map has `I=DONE|BASELINE|N/A`, `T=GREEN|N/A`, and
   `V=PASS|N/A`;
2. every changed behavior has recorded RED evidence before implementation evidence;
3. the four canonical commands work from the built CLI and all rejected routes fail as specified;
4. direct project-comment behavior is proven against a self-created live project;
5. raw next-page, all-remaining, history/opt-out, and cursor-error paths are proven for both targets;
6. human output is actionable and every JSON/error document parses cleanly;
7. workspace/dry-run tests prove no unintended write;
8. issue-view compatibility assertions pass except for the explicit corrections;
9. the traceability audit finds no missing, duplicate, unknown, or orphaned IDs;
10. all deviations/blockers remain visible in conformance and release documentation;
11. the release remains on the accepted `v1.0.0`-or-later path that resolves R9.3; and
12. the main checkout remains untouched by implementation work.
