# linear-create Milestones

**Note**: For completed milestones, see archive files:
- M01-M11, M13: [archive/MILESTONES_01.md](archive/MILESTONES_01.md) (v0.1.0 - v0.13.0)
- M12, M14-M15: [archive/MILESTONES_02.md](archive/MILESTONES_02.md) (v0.12.0 - v0.14.0)
- M20-M23, M22-M22.1: [archive/MILESTONES_03.md](archive/MILESTONES_03.md) (v0.19.0 - v0.21.1)

**Legend:**
- `[x]` Completed
- `[-]` In Progress
- `[ ]` Not Started
- `[~]` Won't fix / Invalid / False positive

---

## Backlog (Future Milestones)

## [ ] Milestone M15: Issue Commands - Core CRUD (v0.24.0)
**Goal**: Implement comprehensive issue management with create, update, view, and list commands for Linear issues. This is a meta-milestone tracking the overall issue command implementation across multiple phased releases.

### Clarified Behaviors (Updated 2025-10-28)

This section documents key design decisions and clarified behaviors for M15 implementation:

**1. Active Filter Definition (M15.5)**
- "Active" issues = workflow states with type: `triage`, `backlog`, `unstarted`, `started`
- Explicitly excludes states with type: `completed`, `canceled`
- Archived issues excluded separately via `archivedAt` field

**2. Filter Precedence Logic (M15.5)**
- **Assignee**: Explicit `--assignee` overrides "me" default (no `--all-assignees` needed). `--all-assignees` removes filter entirely.
- **Team**: Explicit `--team` overrides `defaultTeam` from config
- **Initiative**: Explicit `--initiative` overrides `defaultInitiative` from config

**3. Config Validation (M15.3)**
- If `defaultTeam` and `defaultProject` are both set but belong to different teams: **ERROR**
- Error message: "defaultProject '{name}' belongs to team '{team}' but issue team is '{issueTeam}'. Use --project to specify compatible project or update config."

**4. Cycle Validation (M15.3, M15.4)**
- Cycles support both UUID format AND alias resolution (via M15.1-T22)
- Validate format: must be valid UUID OR resolve to cycle alias
- Reject invalid formats with helpful error

**5. Update Options Validation (M15.4)**
- "No options provided" error counts only data-modifying flags
- Excludes: `--web` (mode flag), `--json` (output format)
- Counts: title, description, priority, estimate, state, dates, assignments, labels, subscribers, trash/untrash, team, project, cycle, parent

**6. Member Resolution (M15.1)**
- Full support for: ID, alias, email, and display name lookup
- Email lookup via Linear API user search (exact match)
- Display name lookup with disambiguation if multiple matches
- Error messages show available options or "Did you mean...?" suggestions

**7. Project Resolution (M15.1)**
- Support: ID, alias, and name (exact + fuzzy/partial matching)
- Ambiguous names show list of matching projects for disambiguation

**8. Label/Subscriber Mutual Exclusivity (M15.4)**
- `--labels` conflicts with `--add-labels` or `--remove-labels` (ERROR)
- `--add-labels` AND `--remove-labels` together is ALLOWED (add first, then remove)
- Same logic applies to `--subscribers`, `--add-subscribers`, `--remove-subscribers`

### Overview
M15 is delivered through six implementation phases (M15.1-M15.6) using incremental alpha releases:
- **M15.1** (v0.24.0-alpha.1): Infrastructure & Foundation
- **M15.2** (v0.24.0-alpha.2): Issue View Command
- **M15.3** (v0.24.0-alpha.3): Issue Create Command
- **M15.4** (v0.24.0-alpha.4): Issue Update Command
- **M15.5** (v0.24.0-alpha.5): Issue List Command
- **M15.6** (v0.24.0): Interactive Enhancements + Final Release

### Key Features
- Non-interactive by default (interactive `-I` modes in M15.6)
- Create issues with all field support (23+ options)
- Auto-assign to creator by default (--no-assignee to override)
- Update issues with comprehensive options (33+ options including add/remove patterns)
- View issue details in terminal or browser
- List with smart defaults (assigned to me + defaultTeam + defaultInitiative + active only)
- Support all alias types (team, workflow-state, issue-label, member, project, initiative)
- Resolve issue identifiers (ENG-123 format) - no custom aliases
- Add defaultTeam and defaultProject to config

### High-Level Task Mapping
This meta-milestone defines high-level tasks that map to detailed implementation tasks in sub-milestones:

| Meta Task | Description | Maps To Sub-Milestone Tasks |
|-----------|-------------|----------------------------|
| M15-T01 | Implement issue identifier resolver (ENG-123 → UUID) | M15.1-T05 through M15.1-T09 |
| M15-T02 | Add defaultTeam and defaultProject to config system | M15.1-T10 through M15.1-T11 |
| M15-TS02 | Test config get/set for new defaults | M15.1-TS05 |
| M15-T03 | Implement issue create command (non-interactive default) | M15.3-T01 through M15.3-T25 (all create tasks) |
| M15-TS03 | Test suite for issue create (~40 cases) | M15.3-TS01 through M15.3-TS40 |
| M15-T04 | Implement issue update command with all options | M15.4-T01 through M15.4-T39 (all update tasks) |
| M15-TS04 | Test suite for issue update (~44 cases) | M15.4-TS01 through M15.4-TS44 |
| M15-T05 | Implement issue view command | M15.2-T01 through M15.2-T14 (all view tasks) |
| M15-TS05 | Test suite for issue view (~10 cases) | M15.2-TS01 through M15.2-TS10 |
| M15-T06 | Implement issue list with smart defaults | M15.5-T01 through M15.5-T36 (all list tasks) |
| M15-TS06 | Test suite for issue list (~29 cases) | M15.5-TS01 through M15.5-TS29 |
| M15-T07 | Update CLI registration in src/cli.ts | M15.2-T02, M15.3-T02, M15.4-T02, M15.5-T02 |
| M15-T08 | Verify all tests pass and build succeeds | Verification steps in each phase |

### Test Summary
- **Total test cases**: ~159+ (10 view + 50 create + 52 update + 37 list + 20 infrastructure)
- **Test scripts**: 5 integration test suites (infrastructure, view, create, update, list)
- **Coverage**: All CLI flags, alias resolution (including email/name lookup), multi-value fields, error cases with helpful messages, config defaults with validation, file operations, edge cases

### Deliverable
```bash
# Create with defaults (auto-assigned to you)
$ linear-create issue create --title "Fix auth bug"
✅ Created issue ENG-456: Fix auth bug (assigned to you)

# Update multiple fields
$ linear-create issue update ENG-456 --priority 1 --state in-progress --add-labels urgent
✅ Updated issue ENG-456

# View in terminal
$ linear-create issue view ENG-456
ENG-456: Fix auth bug
Status: In Progress | Priority: Urgent | Team: Backend
...

# List with defaults (me + defaultTeam + active)
$ linear-create issue list
ENG-456  Fix auth bug       Urgent  In Progress  Backend
ENG-123  API redesign       High    Backlog      Backend
```

### Overall Verification
- [ ] All alpha releases (v0.24.0-alpha.1 through v0.24.0-alpha.5) completed
- [ ] All 159+ test cases pass
- [ ] `npm run build` succeeds for final release
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Interactive modes work (`-I` flag in v0.24.0)
- [ ] Web modes work (`-w` flag)
- [ ] Config defaults apply correctly with validation
- [ ] Member resolution works via ID, alias, email, and display name
- [ ] Project resolution works via ID, alias, and name
- [ ] All error messages are helpful with context and suggestions
- [ ] Cleanup scripts generated for all test suites
- [ ] Full regression testing completed across all phases
- [ ] **Performance verified**: No N+1 query patterns, efficient API usage across all commands

**For detailed implementation tasks, see sub-milestones M15.1 through M15.6 below.**

---

### [x] Milestone M15.1: Issue Infrastructure & Foundation (v0.24.0-alpha.1)
**Goal**: Build foundational infrastructure for issue commands - types, resolver, config, and API functions

**Performance Note**: While this is infrastructure, ensure API functions are efficient. For batch operations or lists, design for single-query patterns from the start.

#### Requirements
- Add comprehensive issue-related TypeScript types
- Implement issue identifier resolver (ENG-123 → UUID)
- Add `defaultProject` config support
- Implement Linear API functions for issue CRUD operations (design for efficiency)
- Add shared validators and utilities for issues (prefer non-querying validation)
- Test all infrastructure components

#### Out of Scope
- Actual command implementations (see M15.2-M15.5 for command implementations)
- Interactive modes (see M15.6 for interactive `-I` support)

#### Tests & Tasks

**Type Definitions:**
- [x] [M15.1-T01] Add `IssueCreateInput` interface to types.ts with all creation fields
- [x] [M15.1-T02] Add `IssueUpdateInput` interface to types.ts with all update fields
- [x] [M15.1-T03] Add `IssueListFilters` interface to types.ts with all filter options
- [x] [M15.1-T04] Add `IssueViewData` interface to types.ts for display
- [x] [M15.1-TS01] Verify TypeScript compilation with new types (npm run typecheck)

**Issue Identifier Resolver:**
- [x] [M15.1-T05] Create src/lib/issue-resolver.ts with `resolveIssueIdentifier()` function
- [x] [M15.1-T06] Implement UUID format detection and passthrough
- [x] [M15.1-T07] Implement team-key + number parsing (ENG-123 format)
- [x] [M15.1-T07a] Add identifier format validation (regex for team-number pattern: /^[A-Z]+-\d+$/)
- [x] [M15.1-T08] Implement GraphQL query to resolve identifier to UUID
- [x] [M15.1-T08a] Add UUID format validation (proper UUID structure check: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
- [x] [M15.1-T09] Add caching for resolved identifiers (optional optimization)
- [x] [M15.1-TS02] Test resolver with ENG-123 format identifiers
- [x] [M15.1-TS03] Test resolver with UUID format
- [x] [M15.1-TS04] Test resolver with invalid identifiers (error handling)
- [x] [M15.1-TS04a] Test error: malformed identifier (e.g., "ENG", "123", "invalid-123")
- [x] [M15.1-TS04b] Test error: identifier with invalid characters (e.g., "ENG-123abc")
- [x] [M15.1-TS04c] Test case insensitivity (eng-123 vs ENG-123 should both work)

**Config Updates:**
- [x] [M15.1-T10] Add `defaultProject` support to config.ts (type already exists in types.ts)
- [x] [M15.1-T10a] Verify defaultTeam config key exists in config.ts (should already exist)
- [x] [M15.1-T11] Update config get/set/list commands to handle defaultProject and defaultTeam
- [x] [M15.1-TS05] Test config set/get for defaultProject
- [x] [M15.1-TS05a] Test config set/get for defaultTeam

**Linear Client API Functions:**
- [x] [M15.1-T12] Add `createIssue(input: IssueCreateInput)` to linear-client.ts
- [x] [M15.1-T13] Add `updateIssue(id: string, input: IssueUpdateInput)` to linear-client.ts
- [x] [M15.1-T14] Add `getIssueById(id: string)` to linear-client.ts
- [x] [M15.1-T15] Add `getIssueByIdentifier(identifier: string)` to linear-client.ts
- [x] [M15.1-T16] Add `getAllIssues(filters: IssueListFilters)` to linear-client.ts
- [x] [M15.1-T17] Add `getCurrentUserIssues()` helper for list defaults
- [x] [M15.1-TS06] Test createIssue API function with minimal input
- [x] [M15.1-TS07] Test getIssueById API function
- [x] [M15.1-TS08] Test getAllIssues API function with basic filters

**Shared Utilities:**
- [x] [M15.1-T18] Add issue-specific validators to src/lib/validators.ts (priority range, etc.)
- [x] [M15.1-TS09] Test validators with valid and invalid inputs

**Member Resolution with Email Lookup:**
- [x] [M15.1-T19] Implement email lookup in member resolver (query Linear API users by email)
- [x] [M15.1-T20] Implement display name lookup fallback in member resolver (query by display name)
- [x] [M15.1-T20a] Add disambiguation logic for multiple name matches (error with list of matches)
- [x] [M15.1-TS10] Test member resolution by email (exact match)
- [x] [M15.1-TS11] Test member resolution by display name
- [x] [M15.1-TS11a] Test error: multiple users match display name (clear disambiguation message)

**Project Name Resolution:**
- [x] [M15.1-T21] Implement project name resolver in src/lib/project-resolver.ts (or extend existing resolver)
- [x] [M15.1-T21a] Add exact name matching for project resolution
- [x] [M15.1-T21b] Add fuzzy/partial name matching with disambiguation for multiple matches
- [x] [M15.1-TS12] Test project resolution by exact name
- [x] [M15.1-TS13] Test project resolution by partial name match
- [x] [M15.1-TS14] Test error: ambiguous project name (multiple matches, show options)

**Cycle Alias Support:**
- [x] [M15.1-T22] Add 'cycle' to supported alias types in aliases.ts
- [x] [M15.1-T22a] Implement cycle resolver supporting both UUID and alias
- [x] [M15.1-TS14a] Test cycle resolution by UUID
- [x] [M15.1-TS14b] Test cycle resolution by alias

**GraphQL Error Handling:**
- [x] [M15.1-T23] Implement GraphQL error handler in src/lib/error-handler.ts (parse Linear API errors)
- [x] [M15.1-T24] Add user-friendly error messages for common Linear errors:
      - 401: "Authentication failed. Check LINEAR_API_KEY environment variable."
      - 403: "Permission denied. You don't have access to this resource."
      - 404: "Resource not found. Check that {entity} ID/identifier is correct."
      - 429: "Rate limited. Please wait {retry-after} seconds and try again."
      - Validation errors: Extract and display Linear's error message
- [x] [M15.1-TS15] Test error: API returns 401 (authentication failed)
- [x] [M15.1-TS16] Test error: API returns 403 (permission denied)
- [x] [M15.1-TS17] Test error: API returns 429 (rate limited)
- [x] [M15.1-TS18] Test error: API returns 404 (not found)

**Alias Resolution Error Messages:**
- [x] [M15.1-T25] Add helpful alias resolution error messages:
      - "Alias '{alias}' not found for type '{type}'. Available: {list of aliases}"
      - Implement fuzzy matching for "Did you mean '{suggestion}'?" suggestions
- [x] [M15.1-TS19] Test error: alias doesn't exist (with helpful message showing available aliases)
- [x] [M15.1-TS20] Test error: typo in alias name (with "did you mean" suggestion)

#### Deliverable
```bash
# Infrastructure is ready, but no user-facing commands yet
# Verify with TypeScript compilation
$ npm run typecheck
✅ No errors

# Verify config support
$ linear-create config set defaultProject "my-project"
✅ Set defaultProject = my-project
```

#### Verification
- [x] `npm run build` succeeds
- [x] `npm run typecheck` passes with no errors
- [x] `npm run lint` passes
- [x] All infrastructure tests pass (TS01-TS20, ~20 test cases)
- [x] Issue identifier resolver works with both ENG-123 and UUID formats (with validation)
- [x] Member resolver supports ID, alias, email, and display name
- [x] Project resolver supports ID, alias, and name (exact + fuzzy)
- [x] Cycle resolver supports both UUID and alias
- [x] Config defaultProject and defaultTeam can be set and retrieved
- [x] Linear API functions execute without runtime errors
- [x] Error handling provides helpful messages for all common failure modes

---

### [x] Milestone M15.2: Issue View Command (v0.24.0-alpha.2)
**Goal**: Implement issue view command with terminal and web display modes

#### Requirements
- View issues by identifier (ENG-123 or UUID)
- Display all issue fields in formatted terminal output
- Support JSON output format
- Support web browser opening
- Support optional comments and history display
- Use issue resolver for identifier lookup

#### Out of Scope
- Interactive view mode (see M15.6 for interactive `-I` support)
- Comment threading/replies (display only)

#### Tests & Tasks

**Command Setup:**
- [x] [M15.2-T01] Create src/commands/issue/view.ts file with commander setup
- [x] [M15.2-T02] Register issue view command in src/cli.ts
- [x] [M15.2-T03] Add `<identifier>` required argument (ENG-123 or UUID)

**Core Implementation:**
- [x] [M15.2-T04] Implement identifier resolution using issue-resolver
- [x] [M15.2-T05] Fetch issue data using getFullIssueById (enhanced from getIssueById)
- [x] [M15.2-T06] Implement terminal display formatting (all core fields)
- [x] [M15.2-T07] Add relationship display (parent, children, project, team)
- [x] [M15.2-T08] Add metadata display (dates, assignee, subscribers, labels)

**Output Options:**
- [x] [M15.2-T09] Implement `--json` flag for JSON output
- [x] [M15.2-T10] Implement `-w, --web` flag to open in browser
- [x] [M15.2-T11] Implement `--show-comments` flag with comment fetching
- [x] [M15.2-T12] Implement `--show-history` flag with history fetching

**Error Handling:**
- [x] [M15.2-T13] Handle invalid identifier (not found)
- [x] [M15.2-T14] Handle permission errors (issue not accessible via error-handler.ts)

**Testing:**
- [x] [M15.2-TS01] Create tests/scripts/test-issue-view.sh
- [x] [M15.2-TS02] Test view with ENG-123 format identifier
- [x] [M15.2-TS03] Test view with UUID format identifier
- [x] [M15.2-TS04] Test view with invalid identifier (error case)
- [x] [M15.2-TS05] Test JSON output format
- [x] [M15.2-TS06] Test web mode (opens browser)
- [x] [M15.2-TS07] Test --show-comments flag
- [x] [M15.2-TS08] Test --show-history flag
- [x] [M15.2-TS09] Test view of issue with parent/children relationships
- [x] [M15.2-TS10] Test view of issue with all fields populated

#### Deliverable
```bash
# View by identifier
$ linear-create issue view ENG-123
ENG-123: Fix authentication bug
Status: In Progress | Priority: Urgent | Team: Backend
Assignee: john@company.com
Created: 2025-01-15 | Updated: 2025-01-20

Description:
Users cannot log in after password reset...

# JSON output
$ linear-create issue view ENG-123 --json
{"id": "...", "identifier": "ENG-123", "title": "Fix authentication bug", ...}

# Open in browser
$ linear-create issue view ENG-123 --web
Opening https://linear.app/company/issue/ENG-123...
```

#### Verification
- [x] `npm run build` succeeds (dist/index.js: 597.75 KB)
- [x] `npm run typecheck` passes with no errors
- [x] `npm run lint` passes (0 errors, 24 warnings - acceptable)
- [x] All view tests implemented (~10 test cases in test-issue-view.sh)
- [x] Terminal output is readable and well-formatted
- [x] JSON output is valid and parseable
- [x] Web mode opens correct URL in browser

**Manual Verification Steps:**
- [x] View issue by ENG-123 format and verify all fields display correctly
- [x] Check terminal output has proper formatting and line wrapping
- [x] Verify dates display in human-readable format (formatDate helper)
- [x] Run `issue view ENG-123 --web` and verify URL matches: https://linear.app/{workspace}/issue/ENG-123
- [x] Verify browser opens automatically via openInBrowser helper
- [x] Test `issue view ENG-123 --json | jq .` parses without errors

**Regression Testing:**
- [x] Re-run M15.1 infrastructure tests to ensure no regressions (no changes to M15.1 code)

---

### [x] Milestone M15.3: Issue Create Command (v0.24.0-alpha.3)
**Goal**: Implement full-featured issue creation with 23+ options following project command patterns

**Performance Note**: Minimize validation API calls. Use cached entity data where possible (entity-cache). Avoid validating every field with separate API requests.

#### Requirements
- Create issues with title (required) and team (required unless defaultTeam configured)
- Support all content, priority, workflow, date, assignment, and organization options
- Implement auto-assignment to creator by default
- Support config defaults (defaultTeam, defaultProject)
- Support all alias types (team, workflow-state, issue-label, member, project)
- Mutual exclusivity: --description vs --description-file
- Web mode to open created issue
- **Efficient validation**: Batch lookups, use cache, avoid per-field API calls

#### Out of Scope
- Interactive creation mode (see M15.6 for interactive `-I` support)
- Issue templates UI (basic --template support included)

#### Tests & Tasks

**Command Setup:**
- [ ] [M15.3-T01] Create src/commands/issue/create.ts file with commander setup
- [ ] [M15.3-T02] Register issue create command in src/cli.ts

**Group 1: Required/Core Options:**
- [ ] [M15.3-T03] Implement `--title <string>` required option
- [ ] [M15.3-T04] Implement `--team <id|alias>` option with alias resolution
- [ ] [M15.3-T05] Implement defaultTeam config fallback logic
- [ ] [M15.3-T06] Validate that title and team are provided (error if missing)
- [ ] [M15.3-TS01] Test minimal creation: title + team only
- [ ] [M15.3-TS02] Test creation with defaultTeam from config
- [ ] [M15.3-TS03] Test team alias resolution
- [ ] [M15.3-TS04] Test error: missing required title
- [ ] [M15.3-TS05] Test error: missing required team (no default)

**Group 2: Content Options:**
- [ ] [M15.3-T07] Implement `--description <string>` option for inline markdown
- [ ] [M15.3-T08] Implement `--description-file <path>` option to read from file
- [ ] [M15.3-T08a] Add file existence and readability validation for description-file
- [ ] [M15.3-T09] Implement mutual exclusivity validation (error if both)
- [ ] [M15.3-TS06] Test with inline description
- [ ] [M15.3-TS07] Test with description from file
- [ ] [M15.3-TS08] Test error: both --description and --description-file provided
- [ ] [M15.3-TS08a] Test error: description-file path doesn't exist
- [ ] [M15.3-TS08b] Test error: description-file not readable (permissions)

**Group 3: Priority & Estimation Options:**
- [ ] [M15.3-T10] Implement `--priority <0-4>` option with validation
- [ ] [M15.3-T11] Implement `--estimate <number>` option
- [ ] [M15.3-TS09] Test all priority levels (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
- [ ] [M15.3-TS10] Test estimate values
- [ ] [M15.3-TS11] Test priority + estimate combination

**Group 4: Workflow Options:**
- [ ] [M15.3-T12] Implement `--state <id|alias>` option with alias resolution
- [ ] [M15.3-T13] Validate state belongs to specified team
- [ ] [M15.3-T13a] Implement state-team validation (query state.team, compare with issue.team)
- [ ] [M15.3-T13b] Add helpful error message showing state's actual team vs expected team
- [ ] [M15.3-TS12] Test state by ID
- [ ] [M15.3-TS13] Test state by alias resolution
- [ ] [M15.3-TS14] Test error: invalid state for team (clear error with team info)
- [ ] [M15.3-TS14a] Test error: state from wrong team (message shows state's team)

**Group 5: Date Options:**
- [ ] [M15.3-T14] Implement `--due-date <YYYY-MM-DD>` option with ISO validation
- [ ] [M15.3-TS15] Test due date with valid ISO format
- [ ] [M15.3-TS16] Test error: invalid date format (malformed date)
- [ ] [M15.3-TS16a] Test error: invalid calendar date (2025-02-30, 2025-13-01)

**Group 6: Assignment Options:**
- [ ] [M15.3-T15] Implement auto-assignment to creator by default
- [ ] [M15.3-T16] Implement `--assignee <id|alias|email>` option with member resolution (ID, alias, email, display name per M15.1-T19/T20)
- [ ] [M15.3-T17] Implement `--no-assignee` flag to override auto-assignment
- [ ] [M15.3-T18] Implement `--subscribers <id|alias|email,...>` comma-separated option
- [ ] [M15.3-TS17] Test default auto-assignment (no flags)
- [ ] [M15.3-TS18] Test explicit assignee by ID
- [ ] [M15.3-TS19] Test assignee by alias resolution
- [ ] [M15.3-TS20] Test assignee by email lookup
- [ ] [M15.3-TS20a] Test assignee by display name lookup
- [ ] [M15.3-TS21] Test --no-assignee flag (unassigned issue)
- [ ] [M15.3-TS22] Test multiple subscribers (comma-separated)
- [ ] [M15.3-TS22a] Test error: invalid subscriber ID in list
- [ ] [M15.3-TS22b] Test subscribers with mixed ID/alias/email formats

**Group 7: Organization Options:**
- [ ] [M15.3-T19] Implement `--project <id|alias|name>` option with project resolver (per M15.1-T21)
- [ ] [M15.3-T20] Implement defaultProject config fallback logic:
      - If --project provided, use it
      - Else if defaultProject in config, use it (validate compatible with team)
      - Else no project assigned
- [ ] [M15.3-T20a] Validate defaultProject/defaultTeam compatibility:
      - If defaultProject's team != issue team, error: "defaultProject '{name}' belongs to team '{team}' but issue team is '{issueTeam}'. Use --project to specify compatible project or update config."
- [ ] [M15.3-T21] Implement `--cycle <id|alias>` option supporting UUID and alias (per M15.1-T22)
- [ ] [M15.3-T21a] Add cycle UUID/alias validation (reject if neither format matches)
- [ ] [M15.3-T22] Implement `--parent <identifier>` option for sub-issues (ENG-123 or UUID)
- [ ] [M15.3-T23] Implement `--labels <id|alias,...>` comma-separated option with alias resolution
- [ ] [M15.3-TS23] Test project by ID
- [ ] [M15.3-TS24] Test project by name resolution
- [ ] [M15.3-TS25] Test project by alias resolution
- [ ] [M15.3-TS26] Test project from defaultProject config
- [ ] [M15.3-TS26a] Test error: defaultProject incompatible with defaultTeam (clear error message)
- [ ] [M15.3-TS27] Test cycle assignment by UUID
- [ ] [M15.3-TS27a] Test cycle assignment by alias
- [ ] [M15.3-TS27b] Test error: cycle with invalid format (not UUID or alias)
- [ ] [M15.3-TS28] Test parent (sub-issue creation with ENG-123 format)
- [ ] [M15.3-TS29] Test parent (sub-issue creation with UUID)
- [ ] [M15.3-TS30] Test single label by alias
- [ ] [M15.3-TS31] Test multiple labels (comma-separated)
- [ ] [M15.3-TS31a] Test error: invalid label ID/alias in list

**Group 8: Template Options:**
- [ ] [M15.3-T24] Implement `--template <id|alias>` option with alias resolution
- [ ] [M15.3-TS32] Test template application
- [ ] [M15.3-TS32a] Test template resolution by ID
- [ ] [M15.3-TS32b] Test template resolution by alias

**Group 9: Mode Options:**
- [ ] [M15.3-T25] Implement `-w, --web` flag to open created issue in browser
- [ ] [M15.3-TS33] Test web mode (opens browser after creation)

**Documentation:**
- [ ] [M15.3-T26] Add comprehensive help text to issue create command:
      - Group options by category (Content, Priority, Assignment, etc.)
      - Show examples for common workflows
      - Document default behaviors (auto-assignment, defaultTeam/defaultProject fallback)
- [ ] [M15.3-TS41] Update README.md with issue create command examples

**Complex Scenarios:**
- [ ] [M15.3-TS34] Test kitchen sink: all options combined
- [ ] [M15.3-TS35] Test team + state + labels + assignee combination
- [ ] [M15.3-TS36] Test parent + labels + subscribers combination
- [ ] [M15.3-TS37] Test description-file + priority + dates combination

**Error Cases:**
- [ ] [M15.3-TS38] Test error: invalid team ID (with helpful message)
- [ ] [M15.3-TS39] Test error: invalid priority value (out of range)
- [ ] [M15.3-TS40] Test error: invalid parent identifier
- [ ] [M15.3-TS40a] Test error: team alias doesn't exist (with available aliases list)
- [ ] [M15.3-TS40b] Test error: state alias doesn't exist (with helpful suggestion)
- [ ] [M15.3-TS40c] Test error: invalid identifier format (comprehensive validation)

#### Deliverable
```bash
# Minimal (uses defaultTeam from config)
$ linear-create issue create --title "Fix login bug"
✅ Created issue ENG-456: Fix login bug (assigned to you)

# Standard non-interactive
$ linear-create issue create --title "Add OAuth" --team backend --priority 2
✅ Created issue ENG-457: Add OAuth

# Full featured
$ linear-create issue create \
  --title "Implement auth" \
  --team backend \
  --description "Add OAuth2 support" \
  --priority 2 \
  --estimate 8 \
  --state in-progress \
  --assignee john@acme.com \
  --labels "feature,security" \
  --project "Q1 Goals" \
  --due-date 2025-02-15 \
  --web
✅ Created issue ENG-458: Implement auth
Opening in browser...
```

#### Verification
- [x] `npm run build` succeeds (dist/index.js: 617.92 KB)
- [x] `npm run typecheck` passes (0 errors)
- [-] `npm run lint` passes (pending - will run before commit)
- [x] All create test cases implemented (~50 test cases in test-issue-create.sh)
- [x] Auto-assignment works by default
- [x] All alias types resolve correctly (team, state, label, member, project, template, cycle)
- [x] Member resolution supports ID, alias, email, and display name
- [x] Project resolution supports ID, alias, and name
- [x] Config defaults apply correctly (defaultTeam, defaultProject with validation)
- [x] File validation works for description-file (existence, readability)
- [x] State-team validation provides clear error messages
- [x] Cleanup script generated: cleanup-issue-create.sh
- [x] README.md updated with issue create examples
- [x] Version updated to 0.24.0-alpha.3

**Regression Testing:**
- [-] Re-run M15.1 infrastructure tests (deferred - no changes to M15.1 code)
- [-] Re-run M15.2 view command tests (deferred - no changes to M15.2 code)

---

### [x] Milestone M15.4: Issue Update Command (v0.24.0-alpha.4)
**Goal**: Implement comprehensive issue update with 33+ options including add/remove patterns

**Performance Note**: Similar to create - minimize validation calls. Only fetch what's needed for validation. Consider that update is modifying existing data, so validation may require current state (but batch it).

#### Requirements
- Update any issue field by identifier (ENG-123 or UUID)
- Support all basic, priority, workflow, date, assignment, organization, and lifecycle options
- Implement add/remove patterns for labels and subscribers
- Support clearing fields with --no-* flags
- Validate team changes with workflow state compatibility
- Support parent relationship changes and removal
- Web mode to open updated issue
- **Efficient validation**: Fetch current issue state once if needed, batch all validations

#### Out of Scope
- Interactive update mode (see M15.6 for interactive `-I` support)
- Bulk updates (single issue per command)

#### Tests & Tasks

**Command Setup:**
- [x] [M15.4-T01] Create src/commands/issue/update.ts file with commander setup
- [x] [M15.4-T02] Register issue update command in src/cli.ts
- [x] [M15.4-T03] Add `<identifier>` required argument (ENG-123 or UUID)
- [x] [M15.4-T04] Implement identifier resolution using issue-resolver
- [x] [M15.4-T05] Validate at least one update option is provided (error if none):
      - Count data-modifying flags: title, description, priority, estimate, state, dates, assignments,
        labels, subscribers, trash/untrash, team, project, cycle, parent
      - Exclude: --web (mode flag), --json (output format)
      - Error message: "No update options specified. Use --help to see available options."

**Group 1: Basic Field Updates:**
- [x] [M15.4-T06] Implement `--title <string>` option
- [x] [M15.4-T07] Implement `--description <string>` option (inline)
- [x] [M15.4-T08] Implement `--description-file <path>` option
- [x] [M15.4-T08a] Add file existence and readability validation for description-file
- [x] [M15.4-T09] Implement mutual exclusivity for description options
- [x] [M15.4-TS01] Test update title only
- [x] [M15.4-TS02] Test update description inline
- [x] [M15.4-TS03] Test update description from file
- [x] [M15.4-TS03a] Test error: description-file doesn't exist
- [x] [M15.4-TS03b] Test error: description-file not readable
- [x] [M15.4-TS04] Test error: no update options provided (only identifier)
- [x] [M15.4-TS04a] Test --web alone doesn't count as update (should error)
- [x] [M15.4-TS05] Test error: both description and description-file

**Group 2: Priority & Estimation Updates:**
- [x] [M15.4-T10] Implement `--priority <0-4>` option with validation
- [x] [M15.4-T11] Implement `--estimate <number>` option
- [x] [M15.4-T12] Implement `--no-estimate` flag to clear estimate
- [x] [M15.4-TS06] Test change priority
- [x] [M15.4-TS07] Test change estimate
- [x] [M15.4-TS08] Test clear estimate with --no-estimate
- [x] [M15.4-TS09] Test priority + estimate together

**Group 3: Workflow Updates:**
- [x] [M15.4-T13] Implement `--state <id|alias>` option with alias resolution
- [x] [M15.4-T14] Validate state belongs to current team (or new team if changing)
- [x] [M15.4-T14a] Handle cross-team state validation during team change:
      - If changing team and state, validate state belongs to NEW team
      - If changing state only, validate state belongs to CURRENT team
      - Provide clear error with both teams if mismatch
- [x] [M15.4-TS10] Test change state by ID
- [x] [M15.4-TS11] Test change state by alias
- [x] [M15.4-TS11a] Test error: state from wrong team (clear error message)

**Group 4: Date Updates:**
- [x] [M15.4-T15] Implement `--due-date <YYYY-MM-DD>` option with ISO validation
- [x] [M15.4-T16] Implement `--no-due-date` flag to clear due date
- [x] [M15.4-TS12] Test set due date
- [x] [M15.4-TS13] Test change due date
- [x] [M15.4-TS14] Test clear due date with --no-due-date

**Group 5: Assignment Updates:**
- [x] [M15.4-T17] Implement `--assignee <id|alias|email>` option with member resolution
- [x] [M15.4-T18] Implement `--no-assignee` flag to remove assignee
- [x] [M15.4-TS15] Test change assignee by ID
- [x] [M15.4-TS16] Test change assignee by email
- [x] [M15.4-TS17] Test remove assignee with --no-assignee

**Group 6: Team & Organization Updates:**
- [x] [M15.4-T19] Implement `--team <id|alias>` option to move between teams
- [x] [M15.4-T20] Validate workflow state compatibility when changing teams
- [x] [M15.4-T21] Implement `--project <id|alias|name>` option with project resolver
- [x] [M15.4-T22] Implement `--no-project` flag to remove from project
- [x] [M15.4-T23] Implement `--cycle <id>` option
- [x] [M15.4-T24] Implement `--no-cycle` flag to remove from cycle
- [x] [M15.4-TS18] Test move to different team
- [x] [M15.4-TS19] Test assign to project
- [x] [M15.4-TS20] Test remove from project (--no-project)
- [x] [M15.4-TS21] Test assign to cycle
- [x] [M15.4-TS22] Test remove from cycle (--no-cycle)
- [x] [M15.4-TS23] Test move team + change state together
- [x] [M15.4-TS24] Test error: invalid state for new team

**Group 7: Parent Relationship Updates:**
- [x] [M15.4-T25] Implement `--parent <identifier>` option to set/change parent
- [x] [M15.4-T26] Implement `--no-parent` flag to remove parent (make root issue)
- [x] [M15.4-TS25] Test set parent (make sub-issue)
- [x] [M15.4-TS26] Test change parent
- [x] [M15.4-TS27] Test remove parent with --no-parent (make root)

**Group 8: Label Management (Three Modes):**
- [x] [M15.4-T27] Implement `--labels <id|alias,...>` option to replace all labels
- [x] [M15.4-T28] Implement `--add-labels <id|alias,...>` option to add labels
- [x] [M15.4-T29] Implement `--remove-labels <id|alias,...>` option to remove labels
- [x] [M15.4-T30] Validate mutual exclusivity: --labels vs --add-labels/--remove-labels
      - Error if --labels AND --add-labels provided
      - Error if --labels AND --remove-labels provided
      - Allow --add-labels AND --remove-labels together (add first, then remove)
- [x] [M15.4-T31] Implement comma-separated parsing and alias resolution for labels
- [x] [M15.4-TS28] Test replace all labels (--labels)
- [x] [M15.4-TS29] Test add labels to existing (--add-labels)
- [x] [M15.4-TS30] Test remove specific labels (--remove-labels)
- [x] [M15.4-TS31] Test add + remove in same command
- [x] [M15.4-TS32] Test clear all labels (empty list)
- [x] [M15.4-TS32a] Test error: --labels and --add-labels together (mutual exclusivity)
- [x] [M15.4-TS32b] Test error: --labels and --remove-labels together
- [x] [M15.4-TS33] Test label alias resolution
- [x] [M15.4-TS33a] Test remove label that doesn't exist on issue (silent success)

**Group 9: Subscriber Management (Three Modes):**
- [x] [M15.4-T32] Implement `--subscribers <id|alias|email,...>` option to replace all
- [x] [M15.4-T33] Implement `--add-subscribers <id|alias|email,...>` option
- [x] [M15.4-T34] Implement `--remove-subscribers <id|alias|email,...>` option
- [x] [M15.4-T35] Validate mutual exclusivity: --subscribers vs --add/--remove variants
- [x] [M15.4-T36] Implement comma-separated parsing and member resolution
- [x] [M15.4-TS34] Test replace all subscribers
- [x] [M15.4-TS35] Test add subscribers
- [x] [M15.4-TS36] Test remove subscribers

**Group 10: Lifecycle Operations:**
- [x] [M15.4-T37] Implement `--trash` flag to move issue to trash
- [x] [M15.4-T38] Implement `--untrash` flag to restore from trash
- [x] [M15.4-TS37] Test move to trash
- [x] [M15.4-TS38] Test restore with --untrash

**Group 11: Mode Options:**
- [x] [M15.4-T39] Implement `-w, --web` flag to open updated issue in browser
- [x] [M15.4-TS39] Test web mode (opens browser after update)

**Documentation:**
- [x] [M15.4-T40] Add comprehensive help text to issue update command:
      - Explain mutual exclusivity rules (--labels vs --add-labels/--remove-labels)
      - Document add/remove patterns for labels and subscribers
      - Show examples for common update workflows
      - Clarify clearing flags (--no-assignee, --no-due-date, etc.)

**Complex Scenarios:**
- [x] [M15.4-TS40] Test kitchen sink: update many fields at once
- [x] [M15.4-TS41] Test multiple clearing flags (--no-assignee, --no-due-date, --no-estimate)
- [x] [M15.4-TS42] Test parent + labels + subscribers combination

**Error Cases:**
- [x] [M15.4-TS43] Test error: invalid identifier (not found)
- [x] [M15.4-TS44] Test error: conflicting flags (--labels and --add-labels)
- [x] [M15.4-TS45] Update README.md with issue update command documentation and examples
- [x] [M15.4-TS46] Test error: cycle with non-UUID/non-alias value
- [x] [M15.4-TS47] Test error: invalid state during team change
- [x] [M15.4-TS48] Test move team + incompatible state (detailed error message)

#### Deliverable
```bash
# Update single field
$ linear-create issue update ENG-123 --state done
✅ Updated issue ENG-123

# Multiple fields
$ linear-create issue update ENG-123 --priority 1 --assignee jane@acme.com --due-date 2025-02-01
✅ Updated issue ENG-123

# Label management
$ linear-create issue update ENG-123 --add-labels "urgent,bug"
✅ Added labels to ENG-123

$ linear-create issue update ENG-123 --remove-labels "feature"
✅ Removed labels from ENG-123

# Clear fields
$ linear-create issue update ENG-123 --no-assignee --no-due-date --no-estimate
✅ Cleared fields on ENG-123

# Move between teams/projects
$ linear-create issue update ENG-123 --team frontend --project "Mobile App"
✅ Moved ENG-123 to frontend team

# Sub-issue management
$ linear-create issue update ENG-123 --parent ENG-100
✅ Made ENG-123 a sub-issue of ENG-100

$ linear-create issue update ENG-123 --no-parent
✅ Made ENG-123 a root issue
```

#### Verification
- [x] `npm run build` succeeds
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] All update tests pass (~52 test cases including new error tests)
- [x] "No update options" validation works correctly (excludes --web, --json)
- [x] File validation works for description-file (existence, readability)
- [x] Add/remove patterns work for labels and subscribers with mutual exclusivity validation
- [x] Team changes validate workflow state compatibility with clear error messages
- [x] Clearing flags work (--no-assignee, --no-due-date, --no-estimate, --no-project, --no-cycle, --no-parent)
- [x] Parent relationship changes work correctly
- [x] Cleanup script generated: cleanup-issue-update.sh

**Regression Testing:**
- [-] Re-run M15.1 infrastructure tests (deferred - no changes to M15.1 code)
- [-] Re-run M15.2 view command tests (deferred - no changes to M15.2 code)
- [-] Re-run M15.3 create command tests (deferred - no changes to M15.3 code)

---

### [ ] Milestone M15.5: Issue List Command (v0.24.0-alpha.5)
**Goal**: Implement comprehensive issue listing with smart defaults and extensive filtering

⚠️ **CRITICAL PERFORMANCE REQUIREMENT**: This milestone requires **extreme care** to avoid N+1 query problems and GraphQL complexity warnings. See "Performance & Query Optimization" section below.

#### Requirements
- List issues with smart defaults (assignee=me, defaultTeam, defaultInitiative, active only)
- Support override flags to bypass defaults (--all-assignees, --all-teams, --all-initiatives)
- Implement extensive filtering: team, assignee, project, initiative, state, priority, labels
- Support relationship filters (parent, cycle, no-parent)
- Support status filters (active, completed, canceled, all-states, archived)
- Implement full-text search
- Support multiple output formats (table, JSON, TSV)
- Implement sorting and limiting
- Web mode to open Linear with filters applied
- **MUST be performant**: Single efficient GraphQL query, no N+1 patterns

#### Out of Scope
- Interactive list/browser mode (see M15.6 for interactive `-I` support)
- Bulk operations on listed issues

#### Performance & Query Optimization

**⚠️ CRITICAL LESSONS FROM PROJECT LIST (M20):**

The `project list` command initially had severe N+1 query problems:
- Made separate API calls for EVERY project to fetch related data
- Resulted in 50+ API calls for listing 50 projects
- Extremely slow performance (10-30 seconds for simple lists)
- Hit Linear's GraphQL complexity limits with warnings
- Poor user experience

**ROOT CAUSE**: Using Linear SDK's convenience methods that hide nested queries and make separate calls per item.

**SOLUTION REQUIREMENTS FOR ISSUE LIST:**

1. **Single GraphQL Query Approach** ⭐ REQUIRED
   - Write custom GraphQL query that fetches ALL needed data in one request
   - Use GraphQL fragments to include all display fields upfront
   - Include nested relations (assignee, team, project, labels, etc.) in initial query
   - Avoid Linear SDK's `issue.assignee`, `issue.team` patterns that trigger new queries

2. **Query Structure**
   ```graphql
   query IssueList($filter: IssueFilter, $first: Int) {
     issues(filter: $filter, first: $first) {
       nodes {
         id
         identifier
         title
         priority
         state {
           id
           name
           type
         }
         assignee {
           id
           name
           email
         }
         team {
           id
           key
           name
         }
         project {
           id
           name
         }
         labels {
           nodes {
             id
             name
           }
         }
         # All other needed fields
       }
     }
   }
   ```

3. **Implementation Strategy** (✅ Completed in Phase 1)
   - [x] [M15.5-T00a] Research Linear's GraphQL schema for issues query
   - [x] [M15.5-T00b] Design single-query approach that fetches all display data
   - [x] [M15.5-T00c] Consider direct GraphQL vs Linear SDK (used rawRequest for full control)
   - [x] [M15.5-T00d] Implement query batching if needed for alias resolution (not needed in Phase 1)
   - [x] [M15.5-T00e] Add performance logging to detect any N+1 patterns during testing (api-call-tracker.ts)

4. **Validation Strategy** (Phase 1 Status: No validation needed yet)
   - Smart validation will be added in Phase 2 for filters
   - Will use cached data from entity-cache
   - Will avoid per-issue validation loops

5. **Testing Requirements** (✅ Completed in Phase 1)
   - [x] [M15.5-TS00a] Test with 100+ issues to verify performance (2 seconds for 250 issues)
   - [x] [M15.5-TS00b] Log all GraphQL queries and verify single-query pattern (DEBUG mode confirmed)
   - [x] [M15.5-TS00c] Measure total API calls (verified: 1 API call for basic list)
   - [x] [M15.5-TS00d] Verify no GraphQL complexity warnings from Linear API (no warnings observed)

**REFERENCE IMPLEMENTATIONS:**
- ❌ **Bad**: `src/commands/project/list.tsx` (initial implementation - slow, N+1)
- ✅ **Good**: After M20 optimization (need to reference that implementation)

**KEY PRINCIPLE**: If you're iterating over results and making API calls inside the loop, you're doing it wrong.

#### Pagination Requirements

**⚠️ LINEAR API LIMITS:**
- **Default**: 50 results per query
- **Maximum**: 250 results per query (hard limit)
- **For 250+ results**: Must use cursor-based pagination

**PAGINATION STRATEGY (from M20/M21 project list optimization):**

1. **Page Size Logic**
   ```typescript
   // Default: 50 (user-friendly default)
   // With --limit N: Use min(N, 250)
   // With --all: Use 250 (maximum efficiency)
   const pageSize = filters?.fetchAll ? 250 : Math.min(filters?.limit || 50, 250);
   ```

2. **Cursor-Based Pagination Loop**
   ```typescript
   let issues: any[] = [];
   let cursor: string | null = null;
   let hasNextPage = true;

   while (hasNextPage && (fetchAll || issues.length < targetLimit)) {
     const response = await client.rawRequest(query, {
       filter: graphqlFilter,
       first: pageSize,
       after: cursor  // Cursor for next page
     });

     issues.push(...response.data.issues.nodes);
     hasNextPage = response.data.issues.pageInfo.hasNextPage;
     cursor = response.data.issues.pageInfo.endCursor;

     // Stop early if we have enough (when not --all)
     if (!fetchAll && issues.length >= targetLimit) break;
   }
   ```

3. **Query Must Include pageInfo**
   ```graphql
   query IssueList($filter: IssueFilter, $first: Int, $after: String) {
     issues(filter: $filter, first: $first, after: $after) {
       nodes { ... }
       pageInfo {
         hasNextPage
         endCursor
       }
     }
   }
   ```

4. **CLI Options**
   - [ ] [M15.5-T00f] Implement `--limit <number>` option (default: 50, max: 250)
   - [ ] [M15.5-T00g] Implement `--all` flag (fetch all results with pagination)
   - [ ] [M15.5-T00h] Add pagination logic that respects both --limit and --all

5. **Performance Considerations**
   - Use 250 per page for `--all` flag (5x faster than 50)
   - Stop early when limit reached (don't over-fetch)
   - Show progress for large result sets if appropriate

**REFERENCE**: `src/lib/linear-client.ts` lines 714-823 (getAllProjects pagination implementation)

#### Tests & Tasks

**=== PHASE 1 COMPLETE (v0.24.0-alpha.5.1) ===**

**Performance Foundation & Pagination - COMPLETED**

- [x] [M15.5-P1-T01] Create API call tracker infrastructure (src/lib/api-call-tracker.ts)
- [x] [M15.5-P1-T02] Rewrite getAllIssues() with custom GraphQL query following getAllProjects() pattern
- [x] [M15.5-P1-T03] Implement cursor-based pagination with pageInfo
- [x] [M15.5-P1-T04] Create src/commands/issue/list.ts with basic table output
- [x] [M15.5-P1-T05] Register issue list command in src/cli.ts
- [x] [M15.5-P1-T06] Add IssueListItem type to types.ts
- [x] [M15.5-P1-T07] Implement --limit flag (default: 50, max: 250)
- [x] [M15.5-P1-T08] Implement --all flag for full pagination
- [x] [M15.5-P1-T09] Create performance test script (test-issue-list-performance.sh)
- [x] [M15.5-P1-TS01] Test pagination with various limits (10, 100, 250)
- [x] [M15.5-P1-TS02] Test --all flag
- [x] [M15.5-P1-TS03] Test error handling (invalid limits)
- [x] [M15.5-P1-TS04] Verify table output format (tab-separated)
- [x] [M15.5-P1-TS05] Performance baseline: 100+ issues in <3 seconds
- [x] [M15.5-P1-TS06] Verify single-query pattern (1 API call for basic list)

**Phase 1 Verification:**
- [x] `npm run build` succeeds (dist/index.js: 660.95 KB)
- [x] `npm run typecheck` passes (0 errors)
- [x] `npm run lint` passes (warnings only, no errors)
- [x] All 10 performance tests pass
- [x] Performance verified: **1 API call** for listing 100 issues (not N+1)
- [x] Pagination verified: Early termination when limit reached
- [x] Debug mode confirms single-page fetch for limit ≤250

**Phase 1 Deliverable:**
```bash
$ linear-create issue list --limit 100
Identifier  Title           State       Priority  Assignee  Team
BAN-277     Test Issue      Backlog     None      alan      BAN
...
Total: 100 issue(s)

# Performance: 1 API call, ~2 seconds for 100 issues
```

**Next Phase:** Phase 2 will add smart defaults (assignee=me, defaultTeam, active filter) and core filtering options.

---

**=== PHASE 2 COMPLETE (v0.24.0-alpha.5.2) ===**

**Smart Defaults + Core Filters - COMPLETED**

- [x] [M15.5-P2-T01] Implement buildDefaultFilters() helper function
- [x] [M15.5-P2-T02] Implement assignee default ("me") with --all-assignees override
- [x] [M15.5-P2-T03] Implement team default (config.defaultTeam) with --team override
- [x] [M15.5-P2-T04] Implement active filter default (excludes completed/canceled via completedAt/canceledAt)
- [x] [M15.5-P2-T05] Add primary filter options: --team, --assignee, --project, --state, --priority
- [x] [M15.5-P2-T06] Add status filter options: --active, --completed, --canceled, --all-states, --archived
- [x] [M15.5-P2-T07] Verify filter precedence logic (explicit overrides defaults)
- [x] [M15.5-P2-T08] Add comprehensive help text with examples
- [x] [M15.5-P2-T09] Manual testing of all filters
- [x] [M15.5-P2-TS01] Regression testing (Phase 1 tests still pass)

**Phase 2 Scope Adjustments:**
- ✅ Initiative filtering **deferred to Phase 3** (Linear's IssueFilter doesn't support direct initiative field)
- ✅ Simplified to core filters that map directly to Linear API

**Phase 2 Verification:**
- [x] `npm run build` succeeds (dist/index.js: 665.30 KB)
- [x] `npm run typecheck` passes (0 errors)
- [x] `npm run lint` passes (warnings only, no errors)
- [x] All Phase 1 performance tests pass (10/10)
- [x] Manual testing confirms smart defaults work correctly
- [x] Manual testing confirms filter overrides work (--all-assignees, --priority, etc.)
- [x] Performance maintained: Still 1 API call for basic list

**Phase 2 Deliverable:**
```bash
# Default: My active issues in default team
$ linear-create issue list
Identifier  Title           State       Priority  Assignee  Team
BAN-273     Updated Title   Backlog     Urgent    steve     BAN
...
Total: 5 issue(s)

# Override assignee default
$ linear-create issue list --all-assignees
[Shows all users' active issues]

# Filter by priority
$ linear-create issue list --priority 1
[Shows only Urgent issues assigned to me]

# Show completed instead of active
$ linear-create issue list --completed
[Shows completed issues assigned to me]

# Combine filters
$ linear-create issue list --team backend --priority 2 --state todo
[Shows High priority Todo issues in backend team assigned to me]
```

**Smart Defaults Confirmed:**
- ✅ Assignee = current user ("me") unless --assignee or --all-assignees provided
- ✅ Team = defaultTeam from config (if set), overridden by --team
- ✅ Status = Active only (excludes completed/canceled) unless status filter provided
- ✅ Archived = Excluded unless --archived provided

**Filter Precedence Verified:**
- ✅ Explicit --assignee overrides "me" default (no --all-assignees needed)
- ✅ --all-assignees removes assignee filter entirely
- ✅ Explicit --team overrides defaultTeam
- ✅ Status filters (--completed, --canceled, --all-states) override active default

**Next Phase:** Phase 3 will add advanced filters (labels, search, relationships), output formats (JSON, TSV), sorting, and web mode.

---

**Pagination Tasks:** (✅ Completed in Phase 1)
- [x] [M15.5-T00f] Implement `--limit <number>` flag with validation (1-250 range)
- [x] [M15.5-T00g] Implement `--all` flag to fetch all results
- [x] [M15.5-T00h] Implement cursor-based pagination loop with pageInfo
- [x] [M15.5-T00i] Add early termination when limit reached (efficiency)
- [x] [M15.5-TS00e] Test pagination with --limit 50 (default)
- [x] [M15.5-TS00f] Test pagination with --limit 150 (multi-page, 250 max per page)
- [x] [M15.5-TS00g] Test --all flag with 300+ issues (verify all fetched)
- [x] [M15.5-TS00h] Verify pagination queries include pageInfo in GraphQL

**Command Setup:** (✅ Completed in Phase 1)
- [x] [M15.5-T01] Create src/commands/issue/list.ts file with commander setup
- [x] [M15.5-T02] Register issue list command in src/cli.ts

**Default Behavior Implementation:**
- [ ] [M15.5-T03] Implement default filter: assignee = current user ("me")
- [ ] [M15.5-T04] Implement default filter: team = defaultTeam from config (if set)
- [ ] [M15.5-T05] Implement default filter: projects in defaultInitiative from config (if set)
- [ ] [M15.5-T06] Implement default filter: active issues only = (triage, backlog, unstarted, started) workflow state types
      - Explicitly include states with type: triage, backlog, unstarted, started
      - Exclude states with type: completed, canceled
      - Note: Archived issues excluded separately (see M15.5-T25)
- [ ] [M15.5-T06a] Add --help text clearly defining "active" status filter behavior
- [ ] [M15.5-T07] Implement default limit: 50 results
- [ ] [M15.5-T08] Implement default sort: priority descending
- [ ] [M15.5-TS01] Test default behavior (no filters, uses "me" + config defaults + active only)
- [ ] [M15.5-TS02] Test with defaultTeam in config
- [ ] [M15.5-TS03] Test with defaultInitiative in config

**Group 1: Primary Filter Options:**
- [ ] [M15.5-T09] Implement `--team <id|alias>` option with alias resolution (overrides defaultTeam)
- [ ] [M15.5-T09a] Implement team filter precedence logic:
      1. If explicit --team provided, use it (overrides defaultTeam)
      2. Otherwise, use defaultTeam from config (if set)
- [ ] [M15.5-T10] Implement `--assignee <id|alias|email>` option with member resolution (overrides "me" default)
- [ ] [M15.5-T11] Implement `--all-assignees` flag to remove assignee filter entirely
- [ ] [M15.5-T11a] Implement assignee filter precedence logic:
      1. If explicit --assignee provided, use it (overrides "me" default)
      2. If --all-assignees provided, remove assignee filter entirely
      3. Otherwise, default to assignee=me
- [ ] [M15.5-T12] Implement `--project <id|alias|name>` option with project resolver
- [ ] [M15.5-T13] Implement `--initiative <id|alias>` option with alias resolution
- [ ] [M15.5-T13a] Implement initiative filter precedence:
      1. If explicit --initiative provided, use it
      2. Otherwise, use defaultInitiative from config (if set)
- [ ] [M15.5-TS04] Test filter by team (explicit override of defaultTeam)
- [ ] [M15.5-TS05] Test filter by assignee (by email, overrides "me")
- [ ] [M15.5-TS05a] Test explicit --assignee overrides "me" default (no --all-assignees needed)
- [ ] [M15.5-TS06] Test --all-assignees flag (removes assignee filter, show all users)
- [ ] [M15.5-TS07] Test filter by project (by name)
- [ ] [M15.5-TS08] Test filter by initiative
- [ ] [M15.5-TS08a] Test --all-initiatives flag (if implemented)

**Group 2: Workflow Filter Options:**
- [ ] [M15.5-T14] Implement `--state <id|alias>` option with alias resolution
- [ ] [M15.5-T15] Implement `--priority <0-4>` option with validation
- [ ] [M15.5-T16] Implement `--label <id|alias>` repeatable option with alias resolution
- [ ] [M15.5-T17] Build GraphQL filter combining multiple --label flags
- [ ] [M15.5-TS09] Test filter by state
- [ ] [M15.5-TS10] Test filter by priority
- [ ] [M15.5-TS11] Test filter by single label
- [ ] [M15.5-TS12] Test filter by multiple labels (--label flag repeated)

**Group 3: Relationship Filter Options:**
- [ ] [M15.5-T18] Implement `--parent <identifier>` option to show sub-issues
- [ ] [M15.5-T19] Implement `--no-parent` flag to show only root issues
- [ ] [M15.5-T20] Implement `--cycle <id>` option
- [ ] [M15.5-TS13] Test show sub-issues of parent (--parent ENG-123)
- [ ] [M15.5-TS14] Test show only root issues (--no-parent)
- [ ] [M15.5-TS15] Test filter by cycle

**Group 4: Status Filter Options:**
- [ ] [M15.5-T21] Implement `--active` flag (explicitly show active only, default behavior)
- [ ] [M15.5-T22] Implement `--completed` flag (only completed issues)
- [ ] [M15.5-T23] Implement `--canceled` flag (only canceled issues)
- [ ] [M15.5-T24] Implement `--all-states` flag (include all states)
- [ ] [M15.5-T25] Implement `--archived` flag (include archived issues)
- [ ] [M15.5-TS16] Test active only (default)
- [ ] [M15.5-TS17] Test completed only
- [ ] [M15.5-TS18] Test all states
- [ ] [M15.5-TS19] Test include archived

**Group 5: Search Functionality:**
- [ ] [M15.5-T26] Implement `--search <query>` option for full-text search
- [ ] [M15.5-T27] Build GraphQL search filter (title + description)
- [ ] [M15.5-TS20] Test full-text search

**Group 6: Output Formatting:**
- [ ] [M15.5-T28] Implement default table output format
- [ ] [M15.5-T29] Design table columns: Identifier | Title | Status | Priority | Assignee | Team
- [ ] [M15.5-T30] Implement `-f, --format json` option for JSON output
- [ ] [M15.5-T31] Implement `-f, --format tsv` option for TSV output
- [ ] [M15.5-T32] Implement `--limit <number>` option (default 50)
- [ ] [M15.5-T33] Implement `--sort <field>` option (priority, created, updated, due)
- [ ] [M15.5-T34] Implement `--order <direction>` option (desc, asc)
- [ ] [M15.5-TS21] Test JSON format output
- [ ] [M15.5-TS22] Test TSV format output
- [ ] [M15.5-TS23] Test custom sort and limit
- [ ] [M15.5-TS23a] Test sort with limit larger than total results
- [ ] [M15.5-TS23b] Test invalid sort field (error with helpful message)

**Group 7: Mode Options:**
- [ ] [M15.5-T35] Implement `-w, --web` flag to open Linear with applied filters
- [ ] [M15.5-T36] Build Linear web URL with filter parameters:
      - Research Linear's URL schema for filters
      - Map CLI filters to Linear web query params
      - Ensure URL opens with filters applied correctly
- [ ] [M15.5-TS24] Test web mode (opens browser with filters)

**Documentation:**
- [ ] [M15.5-T37] Add comprehensive help text to issue list command:
      - Explain default behavior clearly (me + defaultTeam + defaultInitiative + active)
      - Document override flags (--all-assignees, --all-teams, --all-initiatives)
      - Show examples for common filter combinations
      - Define "active" status clearly in help text

**Complex Query Scenarios:**
- [ ] [M15.5-TS25] Test multi-filter combination (team + state + priority)
- [ ] [M15.5-TS26] Test override defaults with specific filters
- [ ] [M15.5-TS27] Test kitchen sink: all filters combined
- [ ] [M15.5-TS27a] Test --completed --archived together
- [ ] [M15.5-TS27b] Test multiple --label flags with --state and --priority
- [ ] [M15.5-TS27c] Test --search with multiple other filters
- [ ] [M15.5-TS27d] Test empty result set (all filters but nothing matches)

**Error Cases:**
- [ ] [M15.5-TS28] Test error: invalid team (with helpful message)
- [ ] [M15.5-TS29] Test error: invalid filter combination (if any conflicts exist)
- [ ] [M15.5-TS29a] Test error: --no-parent and --parent together (conflicting, should error)
- [ ] [M15.5-TS30] Update README.md with issue list command documentation

#### Deliverable
```bash
# Default: My issues in default team/initiative, active only
$ linear-create issue list
ENG-456  Fix auth bug       Urgent  In Progress  Backend
ENG-123  API redesign       High    Backlog      Backend

# Override defaults
$ linear-create issue list --all-assignees
[Shows issues for all users]

$ linear-create issue list --team backend --all-leads
[Shows all projects in backend team, any lead]

# Specific filters
$ linear-create issue list --team eng --state in-progress
$ linear-create issue list --assignee john@acme.com --priority 1
$ linear-create issue list --project "Q1 Goals" --active

# Search
$ linear-create issue list --search "authentication"

# Label filtering (multiple)
$ linear-create issue list --label bug --label urgent

# Sub-issues
$ linear-create issue list --parent ENG-123
$ linear-create issue list --no-parent

# Status filtering
$ linear-create issue list --completed
$ linear-create issue list --all-states

# Output formats
$ linear-create issue list --format json | jq '.[] | {id, title}'
$ linear-create issue list --format tsv | cut -f1,2

# Sorting
$ linear-create issue list --sort due --order asc
$ linear-create issue list --sort updated --order desc --limit 100

# Open in Linear web
$ linear-create issue list --team backend --web
```

#### Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All list tests pass (~37 test cases including new edge case and error tests)
- [ ] Smart defaults work correctly:
      - assignee=me (unless --assignee or --all-assignees provided)
      - team=defaultTeam (unless --team provided)
      - initiative=defaultInitiative (unless --initiative provided)
      - active only = (triage, backlog, unstarted, started) states
- [ ] Filter precedence logic works:
      - Explicit --assignee overrides "me" default (no --all-assignees needed)
      - Explicit --team overrides defaultTeam
      - Explicit --initiative overrides defaultInitiative
- [ ] Override flags work correctly (--all-assignees removes assignee filter)
- [ ] All filter combinations work correctly
- [ ] All output formats work (table, JSON, TSV)
- [ ] Sorting and limiting work correctly with edge cases
- [ ] Web mode opens correct URL with filters applied

**Regression Testing:**
- [ ] Re-run M15.1 infrastructure tests
- [ ] Re-run M15.2 view command tests
- [ ] Re-run M15.3 create command tests
- [ ] Re-run M15.4 update command tests

---

### [ ] Milestone M15.6: Issue Interactive Enhancements (v0.24.0)
**Goal**: Add Ink-powered interactive experiences for all issue commands

#### Requirements
- Add `-I/--interactive` Ink UI for `issue create`, `issue update`, `issue view`, and `issue list`
- Reuse shared resolver/cache logic between interactive and non-interactive flows
- Ensure web/JSON/table modes remain available in non-interactive runs
- Update help text, README, and ISSUE.md to document interactive usage

#### Tasks
- [ ] [M15.6-T01] Create shared interactive form primitives for issues
- [ ] [M15.6-T02] Implement interactive wrapper for `issue create`
- [ ] [M15.6-T03] Implement interactive wrapper for `issue update`
- [ ] [M15.6-T04] Implement interactive wrapper for `issue view`
- [ ] [M15.6-T05] Implement interactive wrapper for `issue list`
- [ ] [M15.6-TS01] Add dedicated interactive test scenarios per command
- [ ] [M15.6-TS02] Update documentation and help output with interactive instructions

#### Verification
- `npm run build` succeeds
- `npm run typecheck` passes
- `npm run lint` passes
- Manual walkthrough confirms interactive parity with non-interactive flows

---

## Deprecated Milestones

The following milestones have been superseded by more detailed implementations:

### [~] Milestone M19: Issue Creation & Management (v0.18.0)
**Status**: DEPRECATED - Replaced by M15 meta-milestone and M15.1-M15.6 detailed milestones

**Reason**: This milestone was originally planned as a single release but was later broken down into a more granular phased approach for better incremental delivery and testing. See M15 (v0.24.0) and its sub-milestones M15.1 through M15.6 for the current implementation plan.

**Original Goal**: Implement issue creation and management commands

**Superseded By**:
- M15: Issue Commands - Core CRUD (v0.24.0) - Meta-milestone
- M15.1: Issue Infrastructure & Foundation (v0.24.0-alpha.1)
- M15.2: Issue View Command (v0.24.0-alpha.2)
- M15.3: Issue Create Command (v0.24.0-alpha.3)
- M15.4: Issue Update Command (v0.24.0-alpha.4)
- M15.5: Issue List Command (v0.24.0-alpha.5)
- M15.6: Issue Interactive Enhancements (v0.24.0)
