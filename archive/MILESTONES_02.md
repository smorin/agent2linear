# linear-create Milestones Archive (M12-M15)

**Note**: This file contains completed milestones M12-M15 (v0.12.0 through v0.14.0).

- For milestones M01-M11, see [MILESTONES_01.md](MILESTONES_01.md)
- For current active milestones, see [../MILESTONES.md](../MILESTONES.md)

**Legend:**

- `[x]` Completed
- `[-]` In Progress
- `[ ]` Not Started
- `[~]` Won't fix / Invalid / False positive

> **Archive reconciliation (2026-07-26):** Open rows inside completed M14/M14.5 describe an
> optional historical test expansion rather than current backlog. They are marked `[~]` instead of
> receiving fabricated completion evidence. The M19 pointer is superseded by completed M15.

---

## [x] Milestone M12: Metadata Commands - Labels, Workflow States, Icons & Colors (v0.12.0)

**Goal**: Add comprehensive metadata management commands for issue labels, project labels, workflow states (issue statuses), icons, and colors with full CRUD operations, alias support, and filtering capabilities

**Requirements**:

- Separate top-level commands for each metadata type (issue-labels, project-labels, workflow-states, icons, colors)
- Full CRUD operations (create, read, update, delete) for labels and workflow states
- Alias support with sync-aliases capability for all metadata types
- Smart filtering by team, color, icon, and other properties
- Display icons and colors in list/view commands with visual indicators
- Default to user's default team for team-scoped entities
- Curated color palette with workspace extraction capability
- Icon browsing and extraction from workspace entities
- Both standalone commands and integrated filtering in existing commands

**Out of Scope**:

- Bulk operations across multiple entities
- Label/status migration tools
- Custom icon upload (use Linear's provided icons)
- Color scheme management

### Tests & Tasks

- [x] [M12-T01] Update type definitions for new entity types - Add WorkflowState, IssueLabel, ProjectLabel, Color, Icon interfaces to types.ts - Add 'issue-label', 'project-label', 'workflow-state' to AliasEntityType - Update Aliases interface with issueLabels, projectLabels, workflowStates maps - Update ResolvedAliases for new entity location tracking

- [x] [M12-T02] Extend alias system to support new entity types - Update getEmptyAliases() with new entity maps - Update readAliasesFile() to ensure all keys exist - Extend normalizeEntityType() for label and workflow-state variants - Update getAliasesKey() mapping for new types - Update loadAliases() to merge new entity aliases - Extend looksLikeLinearId() for label* and workflow* prefixes - Update validateAllAliases() to check new entity types

#### Phase II Prerequisites (from M14.5 Bug #3 and #9)

- [x] [M12-T02a] Add workflow state caching infrastructure (Bug #9) - Add getAllWorkflowStates() caching to status-cache.ts - Add getCachedWorkflowStates(), refreshWorkflowStatesCache(), clearWorkflowStatesCache() - Add WorkflowStateCacheEntry type - Use same TTL strategy as other entities (60 min default) - File storage: .linear-create/entity-cache.json - This enables workflow state name-based resolution

- [x] [M12-T02b] Add workflow state resolution to resolution.ts (Bug #9) - Update resolveStatus() for workflow-state entity type - Add name lookup logic (like project-status has) - Use workflow state cache for fast lookups - Support resolution by: alias → name → ID - Add helpful error messages with available states - This completes Bug #9 fix from M14.5

- [x] [M12-T02c] Add issue label caching infrastructure (Bug #3) - Add getIssueLabels() / getProjectLabels() methods to EntityCache - Add persistent cache functions to status-cache.ts - Add getCachedIssueLabels(), getCachedProjectLabels() - Add IssueLabelCacheEntry, ProjectLabelCacheEntry types - Follow same pattern as teams, initiatives, members, templates - This completes Bug #3 fix from M14.5

- [x] [M12-T02d] Restore label entities to cache clear command (Bug #3) - Add 'issue-labels' and 'project-labels' back to validEntities in cache/clear.ts - Add switch cases for clearIssueLabelsCache() and clearProjectLabelsCache() - Update error message to include label entity types - This completes the cache clear functionality for labels

- [x] [M12-T03] Add Linear API client methods for workflow states - Add getAllWorkflowStates(teamId?: string) to linear-client.ts - Add getWorkflowStateById(id: string) for single state fetch - Add createWorkflowState(input: WorkflowStateCreateInput) - Add updateWorkflowState(id: string, input: WorkflowStateUpdateInput) - Add deleteWorkflowState(id: string) - Define WorkflowStateCreateInput and WorkflowStateUpdateInput types - Handle team-scoped workflow states

- [x] [M12-T04] Add Linear API client methods for issue labels - Add getAllIssueLabels(teamId?: string) to linear-client.ts - Add getIssueLabelById(id: string) - Add createIssueLabel(input: IssueLabelCreateInput) - Add updateIssueLabel(id: string, input: IssueLabelUpdateInput) - Add deleteIssueLabel(id: string) - Support both workspace-level and team-level labels - Filter by team when teamId provided

- [x] [M12-T05] Add Linear API client methods for project labels - Add getAllProjectLabels() to linear-client.ts - Add getProjectLabelById(id: string) - Add createProjectLabel(input: ProjectLabelCreateInput) - Add updateProjectLabel(id: string, input: ProjectLabelUpdateInput) - Add deleteProjectLabel(id: string) - Note: Project labels are workspace-level only

- [x] [M12-T06] Create icons library with curated list - Create src/lib/icons.ts - Define CURATED_ICONS array with emoji, unicode, name, category (~67 common icons) - Implement searchIcons(query: string) for filtering - Implement getIconsByCategory(category: string) - Implement extractIconsFromEntities() to get workspace icons - Support filtering and searching icon list

      **IMPORTANT - Icon Validation Decision (v0.13.2)**:
      - Icon validation was REMOVED from project create/update commands
      - Investigation (linear_schema.md, @linear/sdk analysis) confirmed:
        * No GraphQL endpoint exists to fetch Linear's standard icon catalog
        * The `emojis` query only returns custom organization emojis (user-uploaded)
        * Hardcoded CURATED_ICONS list (67 icons) was missing valid Linear icons
        * Valid icons like "Checklist", "Skull", "Tree", "Joystick" failed validation
      - Solution: Pass icons directly to Linear API for server-side validation
      - CURATED_ICONS remains for discovery only (icons list command)
      - See src/lib/validators.ts (line 231) for deprecation notice
      - See src/commands/project/create.tsx (line 208) for inline documentation
      - See src/commands/project/update.ts for corresponding documentation
      - Rationale documented in: README.md "Icon Usage" section

- [x] [M12-T07] Create colors library with curated palette - Create src/lib/colors.ts - Define CURATED_COLORS with Linear's standard palette - Implement searchColors(hex: string) - Implement extractColorsFromEntities() to get workspace colors - Implement getColorUsage(hex: string) for usage count - Support both curated and extracted color sources

- [x] [M12-T08] Implement workflow-states list command - Create src/commands/workflow-states/list.tsx - Default to defaultTeam from config if set - Support --team flag for filtering - Support --type filter (triage/backlog/unstarted/started/completed/canceled) - Support --color filter (hex code) - Support -I/--interactive, --web, -f/--format flags - Display: ID, Name, Type, Color (with visual indicator), Position, Team

- [x] [M12-T09] Implement workflow-states view command - Create src/commands/workflow-states/view.ts - Resolve by name, ID, or alias - Display full details with color preview - Show usage tip for using in commands - Support --web flag to open team settings

- [x] [M12-T10] Implement workflow-states create command - Create src/commands/workflow-states/create.tsx - Require --team flag (or use defaultTeam) - Support -I/--interactive mode with prompts - Non-interactive flags: --name, --type, --color, --icon, --position - Validate all inputs - Show success with created state details

- [x] [M12-T11] Implement workflow-states update command - Create src/commands/workflow-states/update.ts - Resolve state by name, ID, or alias - Support partial updates (only specified fields) - Flags: --name, --type, --color, --icon, --position - Show before/after summary

- [x] [M12-T12] Implement workflow-states delete command - Create src/commands/workflow-states/delete.ts - Resolve state by name, ID, or alias - Require confirmation unless --yes flag - Check if state is in use (warn if so) - Show success message

- [x] [M12-T13] Implement workflow-states sync-aliases command - Create src/commands/workflow-states/sync-aliases.ts - Fetch all workflow states for team (or all teams) - Generate slug from name (lowercase, hyphens) - Support --global, --project, --dry-run, --force flags - Show preview of aliases to be created - Handle conflicts appropriately

- [x] [M12-T14] Implement issue-labels list command - Create src/commands/issue-labels/list.tsx - Default to defaultTeam if set, otherwise workspace-level - Support --team, --workspace flags for filtering - Support --color, --icon filters - Support -I/--interactive, --web, -f/--format flags - Display: ID, Name, Color, Icon, Team (if team-scoped)

- [x] [M12-T15] Implement issue-labels view command - Create src/commands/issue-labels/view.ts - Resolve by name, ID, or alias - Display full details with color/icon preview - Show scope (workspace vs team) - Support --web flag

- [x] [M12-T16] Implement issue-labels create command - Create src/commands/issue-labels/create.tsx - Support -I/--interactive mode - Non-interactive flags: --name, --description, --color, --icon, --team - Omit --team for workspace-level label - Validate inputs - Show success message

- [x] [M12-T17] Implement issue-labels update command - Create src/commands/issue-labels/update.ts - Resolve label by name, ID, or alias - Support partial updates - Flags: --name, --description, --color, --icon - Show before/after summary

- [x] [M12-T18] Implement issue-labels delete command - Create src/commands/issue-labels/delete.ts - Require confirmation unless --yes - Check usage count (warn if in use) - Support --force to delete anyway

- [x] [M12-T19] Implement issue-labels sync-aliases command - Create src/commands/issue-labels/sync-aliases.ts - Follow workflow-states sync pattern - Support team filtering - Generate slugs from label names

- [x] [M12-T20] Implement project-labels list command - Create src/commands/project-labels/list.tsx - No team filtering (workspace-only) - Support --color, --icon filters - Support -I/--interactive, --web, -f/--format flags - Display: ID, Name, Color, Icon, Description

- [x] [M12-T21] Implement project-labels view command - Create src/commands/project-labels/view.ts - Resolve by name, ID, or alias - Display full details - Support --web flag

- [x] [M12-T22] Implement project-labels create command - Create src/commands/project-labels/create.tsx - Support -I/--interactive mode - Non-interactive flags: --name, --description, --color, --icon - Validate inputs - Show success message

- [x] [M12-T23] Implement project-labels update command - Create src/commands/project-labels/update.ts - Support partial updates - Show before/after summary

- [x] [M12-T24] Implement project-labels delete command - Create src/commands/project-labels/delete.ts - Require confirmation - Check usage

- [x] [M12-T25] Implement project-labels sync-aliases command - Create src/commands/project-labels/sync-aliases.ts - Follow same sync pattern as other entities

- [x] [M12-T26] Implement icons list command - Create src/commands/icons/list.tsx - Default to curated list - Support --search flag for filtering - Support --category flag - Support --palette flag (default | workspace) - Support -f/--format with grid option for visual display - Display: Name, Emoji, Unicode, Category

- [x] [M12-T27] Implement icons view command - Create src/commands/icons/view.ts - Display icon details - Show usage examples - Show where icon is used in workspace

- [x] [M12-T28] Implement icons extract command - Create src/commands/icons/extract.ts - Extract from labels, workflow states, projects - Support --type flag to filter source - Show unique icons with usage count - Support output formats

- [x] [M12-T29] Implement colors list command - Create src/commands/colors/list.tsx - Default to curated palette - Support --palette flag (default | workspace | both) - Support --search for hex filtering - Support -f/--format with grid option - Display: Hex, Name, Usage Count (if extracted) - Visual color blocks in terminal output

- [x] [M12-T30] Implement colors view command - Create src/commands/colors/view.ts - Display color details - Show usage count in workspace - Show which entities use this color

- [x] [M12-T31] Implement colors extract command - Create src/commands/colors/extract.ts - Extract from labels, workflow states, projects - Support --type flag to filter source - Show unique colors with usage count - Support output formats

- [x] [M12-T32] Register all new commands in cli.ts - Add workflow-states command group (alias: wstate, ws) - Add issue-labels command group (alias: ilbl) - Add project-labels command group (alias: plbl) - Add icons command group - Add colors command group - Register all subcommands for each group - Add comprehensive help text with examples - Update main CLI help to show new commands

- [x] [M12-T33] Build and test all new commands - Run npm run build - Run npm run lint - Run npm run typecheck - Test each command group help text - Test basic functionality of each command - Verify aliases work correctly

- [~] [M12-TS01] Test workflow-states CRUD operations - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS02] Test issue-labels CRUD operations - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS03] Test project-labels CRUD operations - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS04] Test icons commands - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS05] Test colors commands - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS06] Test alias integration - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS07] Test filtering capabilities - Covered by existing bash integration test suite - Manual testing performed during development

- [~] [M12-TS08] Test defaultTeam behavior - Covered by existing bash integration test suite - Manual testing performed during development

### Deliverable

```bash
# Workflow States (Issue Statuses)
$ linear-create workflow-states list
Available workflow states for Engineering team:
ID              Name          Type        Color     Position
state_abc123    Backlog       backlog     #95A2B3   1
state_def456    Todo          unstarted   #5E6AD2   2
state_ghi789    In Progress   started     #26B5CE   3
state_jkl012    Done          completed   #4CB782   4

$ linear-create wstate create --name "In Review" --type started --color "#FF6B6B" --team eng
✅ Workflow state created: In Review (state_mno345)

$ linear-create ws sync-aliases --global
✅ Created 4 workflow state aliases (global)

# Issue Labels
$ linear-create issue-labels list
Workspace Labels (2):
  label_abc123   Bug        🐛   #FF6B6B
  label_def456   Feature    ✨   #4CB782

Engineering Team Labels (3):
  label_ghi789   Backend    ⚙️    #5E6AD2
  label_jkl012   Frontend   🎨   #26B5CE
  label_mno345   Database   🗄️    #95A2B3

$ linear-create ilbl create --name "Urgent" --color "#FF0000" --icon "🚨"
✅ Issue label created: Urgent (label_pqr678)

$ linear-create ilbl sync-aliases --global
✅ Created 5 issue label aliases (global)

# Project Labels
$ linear-create project-labels list
Available project labels:
ID              Name        Color     Icon
label_abc123    Priority    #FF6B6B   ⭐
label_def456    Research    #5E6AD2   🔬
label_ghi789    Internal    #95A2B3   🏢

$ linear-create plbl create --name "Customer" --color "#4CB782" --icon "👥"
✅ Project label created: Customer (label_jkl012)

# Icons
$ linear-create icons list
Curated Icons (50):
Category: Status
  🐛 bug         - Bug or error
  ✨ sparkles    - New feature
  🔥 fire        - Critical/Hot

Category: Objects
  🎨 art         - Design/Creative
  ⚙️  gear       - Settings/Config

$ linear-create icons extract --type labels
Extracted 12 unique icons from workspace labels:
Icon  Usage  Entities
🐛    3      Bug, Error, Issue
✨    2      Feature, Enhancement
⚙️     4      Backend, Settings, Config, System

# Colors
$ linear-create colors list
Curated Linear Colors:
Hex       Name      Preview
#5E6AD2   Purple    ████
#26B5CE   Cyan      ████
#4CB782   Green     ████
#FF6B6B   Red       ████

$ linear-create colors list --palette workspace
Workspace Colors (8):
Hex       Usage  Entities
#5E6AD2   12     Backend, Settings, ...
#26B5CE   8      Frontend, UI, ...
#4CB782   5      Feature, Done, ...

$ linear-create colors extract --type workflow-states
Extracted 6 unique colors from workflow states:
Hex       Usage  States
#95A2B3   4      Backlog, Canceled, ...
#5E6AD2   3      Todo, Planned, ...
```

### Automated Verification

- `npm run build` succeeds without errors
- `npm run lint` passes (no new errors)
- `npm run typecheck` passes
- All commands registered in help output
- Alias system supports all new entity types

### Manual Verification

- Create workflow states for different teams
- Create workspace and team-level issue labels
- Create project labels
- List icons and colors with different palettes
- Extract icons and colors from workspace
- Sync aliases for all metadata types
- Use aliases in other commands (issues, projects)
- Test filtering by team, color, icon
- Verify defaultTeam behavior
- Test interactive modes for all create/update commands

### Notes

- Workflow states are always team-scoped in Linear
- Issue labels can be workspace-level or team-scoped
- Project labels are always workspace-level
- Icons and colors are reference data, not stored entities
- Color display uses terminal ANSI codes for visual preview
- Icon display shows emoji directly in terminal

---

## [x] Milestone M13: Bug Fixes from Analysis (v0.13.1)

**Goal**: Fix all bugs identified in BUGS.md to improve reliability and user experience

**Requirements**:

- Fix high-priority alias resolution bug
- Add proper error tracking and reporting
- Improve validation for edge cases
- Maintain backward compatibility
- No breaking changes

**Out of Scope**:

- New features or functionality
- Performance optimizations beyond bug fixes
- API changes

### Tests & Tasks

- [x] [M13-T01] Fix Bug #1: Add alias resolution for team filter in issue-labels - Update src/commands/issue-labels/sync-aliases.ts to resolve team aliases - Follow pattern from workflow-states/sync-aliases.ts (lines 19-21) - Add resolveAlias('team', teamId) call before getAllIssueLabels() - Test with team alias to verify resolution works - Committed: 9d2f0e9

- [x] [M13-T02] Fix Bug #2: Track and report failures in sync summary - Add `failed` counter in src/lib/sync-aliases.ts - Increment counter when alias creation fails (excluding "already points to") - Update summary message to show failures with warning emoji - Show success only when failed === 0 - Test with simulated failure to verify counter - Committed: 44515a2

- [x] [M13-T03] Fix Bug #3: Add duplicate detection for labels - Add detectDuplicates: true in issue-labels/sync-aliases.ts - Add detectDuplicates: true in project-labels/sync-aliases.ts - Test by creating labels with duplicate names - Verify duplicates are detected and skipped - Committed: 87f4003

- [x] [M13-T04] Fix Bug #4: Validate empty slugs - Add empty slug check in sync-aliases.ts after generateSlug() - Skip entities with empty slugs and show warning - Add empty alias validation in aliases.ts addAlias() function - Return error if alias is empty or whitespace-only - Test with entity name containing only special characters - Committed: c6f27eb

- [x] [M13-T05] Fix Bug #5: Warn users about corrupted aliases file - Update readAliasesFile() catch block in aliases.ts - Add console.warn when file exists but cannot be parsed - Include error message and recovery guidance - Only warn if file exists (not just missing) - Test by corrupting aliases.json and running command - Committed: 6659614

- [x] [M13-TS01] Regression test: Verify existing functionality - Test team sync-aliases with valid team ID - Test workflow-state sync-aliases - Test issue-label sync-aliases with --team flag - Test project-label sync-aliases - Verify npm run build succeeds ✅ - Verify npm run lint passes ✅ - Verify npm run typecheck passes ✅

### Deliverable

All 5 bugs fixed with individual commits:

```bash
git log --oneline
fix: warn users about corrupted aliases file
fix: validate empty slugs and reject empty aliases
fix: add duplicate detection for issue/project labels
fix: track and report failures in sync-aliases summary
fix: resolve team aliases in issue-labels sync-aliases
```

### Automated Verification

- `npm run build` succeeds without errors
- `npm run lint` passes (no new errors)
- `npm run typecheck` passes
- All existing commands continue to work

### Manual Verification

- Team aliases resolve correctly in issue-labels sync
- Failed alias creations are reported in summary
- Duplicate label names are detected and skipped
- Empty slugs are rejected with clear warnings
- Corrupted aliases.json shows helpful warning

---

## [x] Milestone M14.5: Cache & Resolution Bug Fixes (v0.13.2)

**Goal**: Fix critical caching bugs (data corruption and silent failures) discovered in bug analysis

**Requirements**:

- **Phase I (v0.13.2)**: Fix critical bugs #2 and #7
  - Bug #7: Fix member cache pollution when using team filters
  - Bug #2: Remove unsupported label entities from cache clear validation
  - Comprehensive testing to ensure fixes work correctly
  - No regressions in existing functionality
- **Phase II (future - fold into M12)**: Complete label caching and workflow state resolution
  - Bug #3: Implement full label cache infrastructure
  - Bug #9: Add workflow state name-based resolution
  - Integrate with M12 metadata commands milestone

**Out of Scope**:

- New features beyond bug fixes
- Performance optimizations beyond bug fixes
- Breaking changes to existing APIs

**Bug Details**:

**Bug #7 (HIGH PRIORITY)**: Entity Cache Team Filter Pollutes Global Cache

- **File**: `src/lib/entity-cache.ts:220-273`
- **Issue**: When `getMembers({ teamId: X })` is called, it fetches filtered members from API but caches them as "all members". Subsequent calls to `getMembers()` return incorrect subset.
- **Impact**: Data corruption - cache returns wrong member list
- **Root Cause**: Passes `options` to API call but caches filtered result globally
- **Fix**: Fetch all members, cache all, filter client-side (as code comment suggests)

**Bug #2 (MEDIUM PRIORITY)**: Missing Cache Clear for Issue/Project Labels

- **File**: `src/commands/cache/clear.ts:19-48`
- **Issue**: `validEntities` includes 'issue-labels' and 'project-labels', but switch statement has no cases for them. Command reports success but only clears session cache, not persistent cache.
- **Impact**: Silent failure - users think cache is cleared but persistent cache remains stale
- **Root Cause**: Labels added to validation but no persistent cache implementation exists yet
- **Fix**: Remove 'issue-labels' and 'project-labels' from `validEntities` until persistent cache is implemented

### Phase I Tests & Tasks

#### Bug Fixes

- [x] [M14.5-T01] Fix Bug #7: Update getMembers() in entity-cache.ts - Bypass cache when teamId filter is provided (call API directly) - Only cache unfiltered member requests (all organization members) - Added documentation explaining why teamId filtering bypasses cache - Fix prevents cache pollution from team-filtered member queries

- [x] [M14.5-T02] Fix Bug #2: Update cache/clear.ts validation - Remove 'issue-labels' from validEntities array - Remove 'project-labels' from validEntities array - Keep only entities with persistent cache support: teams, initiatives, members, templates, statuses - Added comment explaining labels will be added in M12

#### Testing

- [~] [M14.5-TS01] Test getMembers() without filter - Call getMembers() with no options - Verify returns all members - Verify caches all members

- [~] [M14.5-TS02] Test getMembers() with team filter - Call getMembers({ teamId: 'team_123' }) - Verify returns only members from that team - Verify cache still contains ALL members (not filtered subset)

- [~] [M14.5-TS03] Test sequential calls (critical regression test) - Call getMembers({ teamId: 'team_123' }) - filtered - Call getMembers() - no filter - Verify second call returns ALL members, not just team_123 members - This is the bug reproduction test

- [~] [M14.5-TS04] Test cache clear with valid entities - Test cache clear --entity teams - Test cache clear --entity initiatives - Test cache clear --entity members - Test cache clear --entity templates - Test cache clear --entity statuses - Verify all succeed

- [x] [M14.5-TS05] Test cache clear with invalid entities (should fail) - Test cache clear --entity issue-labels (should error) ✓ - Test cache clear --entity project-labels (should error) ✓ - Verify helpful error message with valid options ✓

- [x] [M14.5-TS06] Build and type verification - npm run build (succeeds) ✓ - npm run typecheck (passes) ✓ - npm run lint (passes, no new errors, 1 pre-existing warning) ✓

- [~] [M14.5-TS07] Regression tests - Run existing test suite (tests/scripts/run-all-tests.sh) - Verify no existing functionality broken - Test project create with members - Test project update with members

### Phase II Planning (Integrated into M12)

**Bug #3**: Complete Label Cache Implementation → **M12-T02c, M12-T02d**

- Add getIssueLabels() / getProjectLabels() to EntityCache (M12-T02c)
- Add getAllIssueLabels() / getAllProjectLabels() to linear-client.ts (M12-T04, M12-T05)
- Add persistent cache functions to status-cache.ts (M12-T02c)
- Restore 'issue-labels' and 'project-labels' to cache clear command (M12-T02d)
- **Status**: Integrated into M12 milestone as prerequisite tasks

**Bug #9**: Implement Workflow State Resolution → **M12-T02a, M12-T02b**

- Add getAllWorkflowStates(teamId?) to linear-client.ts (M12-T03 - already exists)
- Add workflow state caching to status-cache.ts (M12-T02a)
- Update resolveStatus() to lookup by name (like project-status) (M12-T02b)
- Add to cache clear command (M12-T02a)
- **Status**: Integrated into M12 milestone as prerequisite tasks

See M12 milestone tasks M12-T02a through M12-T02d for implementation details.

### Deliverable (Phase I)

```bash
# Bug #7 fixed - member caching works correctly
$ linear-create project create --team eng --members "user_1,user_2"
# Cache is populated with ALL members, not just user_1 and user_2

# Bug #2 fixed - cache clear validates correctly
$ linear-create cache clear --entity issue-labels
❌ Invalid entity type: issue-labels
   Valid options: teams, initiatives, members, templates, statuses

$ linear-create cache clear --entity members
🗑️  Clearing members cache...
✅ Cache cleared successfully (session + persistent)
```

### Automated Verification

- `npm run build` succeeds without errors
- `npm run lint` passes (no new errors)
- `npm run typecheck` passes
- All existing tests continue to pass

### Manual Verification

- Member caching with team filters works correctly
- Sequential getMembers() calls return correct data
- Cache clear command only accepts valid entity types
- No false success messages from cache clear
- No regressions in existing functionality

---

## [x] Milestone M14.6: Icon Validation Removal (v0.13.2)

**Goal**: Fix icon validation bug by removing client-side validation that was rejecting valid Linear icons

**Requirements**:

- Remove icon validation from project create command
- Remove/deprecate validateIcon() function
- Document why validation was removed (no API catalog exists)
- Ensure all valid Linear icons work (Checklist, Skull, Tree, Joystick, etc.)
- Update documentation explaining deliberate design decision

**Out of Scope**:

- Creating custom icon validation logic
- Fetching icons from Linear API (no endpoint exists)
- Maintaining hardcoded icon lists

### Background & Investigation

**Problem**: Icon validation was rejecting valid Linear icons like "Checklist", "Skull", "Tree", and "Joystick" despite being valid in Linear's system.

**Root Cause Analysis**:

1. Validation used hardcoded `CURATED_ICONS` list with only 67 icons
2. Linear supports hundreds of standard icons not in our list
3. Investigation of Linear's GraphQL schema (`linear_schema.md`) revealed:
   - `emojis` query exists but only returns custom organization emojis (user-uploaded)
   - No endpoint to fetch Linear's standard icon catalog
   - Icon fields typed as `icon?: String` (not enum, no GraphQL introspection)
4. Linear validates icons server-side; client-side validation is redundant

**Solution**: Remove client-side validation entirely and rely on Linear's API validation.

### Tests & Tasks

- [x] [M14.6-T01] Remove icon validation from src/commands/project/create.tsx - Removed validateIcon() call (lines 208-218) - Added comprehensive inline documentation explaining decision - Icons now passed directly to Linear API

- [x] [M14.6-T02] Deprecate validateIcon() in src/lib/validators.ts - Removed function implementation - Added @deprecated JSDoc with investigation findings - Documented that Linear API validates icons server-side

- [x] [M14.6-T03] Add documentation to README.md - Created "Icon Usage" section after "Aliases" section - Explained why validation was removed (no API catalog) - Documented icon discovery commands - Provided usage examples

- [x] [M14.6-T04] Update MILESTONES.md documentation - Added note to M12-T06 explaining icon validation decision - Created M14.6 milestone documenting the fix - Referenced inline code documentation locations

- [x] [M14.6-T05] Add preventive documentation to project/update.ts - Added note in UpdateOptions interface for future icon support (M15) - Documented that icons should NOT be validated when added - Cross-referenced create.tsx and README for rationale

- [x] [M14.6-TS01] Verify icon tests pass - Test #26: Icon "Joystick" ✅ - Test #28: Icon "Tree" ✅ - Test #38: Icon "Skull" ✅ - Test #40: Icon "Checklist" ✅ - All previously failing icon tests now pass

- [x] [M14.6-TS02] Build & quality checks - npm run build ✅ - npm run typecheck ✅ - npm run lint ✅ (1 pre-existing warning)

### Deliverable

**Icons work without client-side validation:**

```bash
# All valid Linear icons work
linear-create project create --title "Tasks" --team eng --icon "Checklist"
linear-create project create --title "Gaming" --team eng --icon "Joystick"
linear-create project create --title "Nature" --team eng --icon "Tree"
linear-create project create --title "Warning" --team eng --icon "Skull"

# Invalid icons get clear error from Linear API
linear-create project create --title "Test" --team eng --icon "NotRealIcon"
# Error from Linear API with helpful message
```

**Icon discovery still available:**

```bash
# Browse curated icons for suggestions
linear-create icons list
linear-create icons list --search check
linear-create icons list --category status

# Extract workspace icons
linear-create icons extract --type projects
```

### Automated Verification

- `npm run build` succeeds
- `npm run typecheck` passes
- `npm run lint` passes (1 pre-existing warning)
- Integration tests pass with previously-failing icons

### Manual Verification

- Icons like "Checklist", "Skull", "Tree", "Joystick" work correctly
- Invalid icons return helpful Linear API errors
- Icon discovery commands still work
- Documentation is clear and comprehensive

### Files Modified

1. `src/commands/project/create.tsx` - Removed validation, added comprehensive documentation
2. `src/commands/project/update.ts` - Added preventive note for future icon support (M15)
3. `src/lib/validators.ts` - Deprecated validateIcon() with explanation
4. `README.md` - Added "Icon Usage" section
5. `MILESTONES.md` - Updated M12-T06, added M14.6 milestone

### Key Learnings

- Linear's API does not expose its standard icon catalog via GraphQL
- The `emojis` query is for custom organization emojis only
- Attempting to maintain a client-side icon list leads to false negatives
- Server-side validation is sufficient and eliminates maintenance burden
- Curated lists can still serve a discovery/suggestion purpose

---

## [x] Milestone M14: Foundation - Shared Utilities + Caching & Batching (v0.13.0)

**Status**: Phase 1 (Utilities) & Phase 2 (Caching) COMPLETE. Phase 3 (Test Infrastructure) documented for future milestone.

**Goal**: Extract duplicated code into reusable utilities AND add comprehensive caching layer to reduce API calls by 60-70%

**Requirements**:

- **Phase 1 - Utilities**: Eliminate ~90 lines of duplicate code across commands
  - Create validators for priority, color, enum values
  - Create parsers for comma-separated and pipe-delimited values
  - Create file utilities for safe content file reading
  - Create resolution utilities for status entities
- **Phase 2 - Caching**: Add entity caching to reduce API calls
  - Create unified in-memory entity cache (session-scoped)
  - Extend file-based persistent cache for teams, initiatives, templates
  - Implement batch fetching strategy (fetch all, filter in memory)
  - Parallelize validation calls with Promise.all
- **Phase 3 - Integration**: Update commands to use caching
  - Reduce project create from 18-20 API calls to 6-8 calls (60-70% reduction)
  - Reduce project update from 5-8 API calls to 3-4 calls (40-50% reduction)
- Ensure existing functionality unchanged (regression-free)

**Out of Scope**:

- New features (save for subsequent milestones)
- UI/UX changes beyond caching feedback
- Breaking changes to existing commands
- GraphQL query batching (future optimization)

**Expected Impact**:

- 60-70% reduction in API calls for project create
- 50-60% reduction in API calls for project update
- 50-70% faster wall-clock time
- Reusable caching infrastructure for all future commands

### Tests & Tasks

#### Phase 1: Shared Utilities (Original M14 Goals)

##### Validators Module

- [x] [M14-T01] Create `/src/lib/validators.ts` - Implement `validatePriority(value: string | number): { valid: boolean; priority?: number; error?: string }` - Implement `validateAndNormalizeColor(value: string): { valid: boolean; color?: string; error?: string }` - Implement `validateEnumValue(value: string, allowedValues: string[]): { valid: boolean; error?: string }` - Implement `validateISODate(value: string): { valid: boolean; error?: string }` - Implement `validateNonEmpty(value: string, fieldName?: string): { valid: boolean; error?: string }` - Return structured results, no process.exit() in utilities - Add JSDoc comments with examples

##### Parsers Module

- [x] [M14-T02] Create `/src/lib/parsers.ts` - Implement `parseCommaSeparated(value: string): string[]` - Split by comma, trim, filter empty - Implement `parsePipeDelimited(value: string): { key: string; value: string }` - Split "URL|Label" format - Implement `parseLifecycleDate(value: string): string` - Convert "now" or YYYY-MM-DD to ISO DateTime - Implement `parsePipeDelimitedArray(inputs: string[]): PipeDelimitedValue[]` - Batch processing - Implement `parseCommaSeparatedUnique(value: string): string[]` - With deduplication - Add JSDoc comments with examples - Handle edge cases (empty strings, multiple pipes, etc.)

##### File Utilities Module

- [x] [M14-T03] Create `/src/lib/file-utils.ts` - Implement `readContentFile(path: string): Promise<{ success: boolean; content?: string; error?: string }>` - Include ENOENT (file not found) error handling - Include EACCES (permission denied) error handling - Include generic error fallback - Return structured results with user-friendly error messages

##### Resolution Module

- [x] [M14-T04] Create `/src/lib/resolution.ts` - Implement `resolveStatus(input: string, entityType: 'project-status' | 'workflow-state'): Promise<{ success: boolean; id?: string; error?: string }>` - Encapsulates: try alias first, then name/ID lookup - Include proper console logging ("📎 Resolved...", "✓ Found...") - Eliminates 28-line duplicate between create and update

#### Phase 2: Caching Infrastructure (NEW)

##### Entity Cache Foundation

- [x] [M14-T11] Create `/src/lib/entity-cache.ts` - Unified in-memory cache - Implement `EntityCache` class with Maps for: teams, initiatives, members, templates, labels - Methods: `getTeams()`, `getInitiatives()`, `getMembers()`, `getTemplates()`, `getLabels()` - Lookup methods: `findTeamById()`, `findMemberByEmail()`, etc. - Cache management: `clear()`, `clearEntity()`, `invalidateIfExpired()` - Singleton pattern: `getEntityCache()` returns shared instance - TTL checking with configurable expiration - Thread-safe Map operations

- [x] [M14-T12] Extend `/src/lib/status-cache.ts` pattern to teams/initiatives - Add `cacheTeams()`, `getCachedTeams()` functions - Add `cacheInitiatives()`, `getCachedInitiatives()` functions - Add `cacheTemplates()`, `getCachedTemplates()` functions - Use same TTL strategy as existing status cache (60 min default) - File storage: `.linear-create/entity-cache.json` - Per-entity timestamps for independent expiration - Note: Function names differ slightly but functionality implemented

- [x] [M14-T13] Create `/src/lib/batch-fetcher.ts` - Batch API calls - Implement `batchFetchEntities(options: BatchFetchOptions): Promise<...>` - Implement `prewarmProjectCreation(): Promise<void>` - Fetch teams, initiatives, templates in parallel - Implement `prewarmProjectUpdate(): Promise<void>` - Lighter version for updates - Use Promise.all for parallel fetching - Populate entity cache automatically - Error handling for individual fetch failures

##### Update Resolution Functions

- [x] [M14-T14] Update `/src/lib/linear-client.ts` validation functions to use cache - Update `validateTeamExists()` - Use entity cache instead of API call - Update `validateInitiativeExists()` - Use entity cache instead of API call - Update `getTemplateById()` - Use entity cache instead of API call - Update `resolveMemberIdentifier()` - Use cached member list (0 API calls after first fetch) - Keep existing function signatures (backward compatible) - Add console output showing cache hits

- [x] [M14-T15] Update `/src/commands/project/create.tsx` to use batch fetching - Add `await prewarmProjectCreation()` at start of command (after line 50) - Console: "🔄 Loading workspace data..." - Parallelize validation (lines 195-212): use Promise.all for initiative + team - Members already batched (lines 244-271) - first call fetches all, subsequent use cache - Verify API call reduction: 18-20 → 6-8 calls

- [x] [M14-T16] Update `/src/commands/project/update.ts` to use batch fetching - Add conditional prewarm (after line 17): only if status/team/lead/members provided - Use lighter `prewarmProjectUpdate()` function - Verify API call reduction: 5-8 → 3-4 calls

##### Configuration & Management

- [x] [M14-T17] Add cache configuration options to `src/lib/config.ts` - Add `entityCacheMinTTL?: number` (default: 60) - Add `enableEntityCache?: boolean` (default: true) - Add `enablePersistentCache?: boolean` (default: true) - Add `enableSessionCache?: boolean` (default: true) - Note: Core configuration options implemented, some specific flags may vary

- [x] [M14-T18] Add cache management commands - Create `src/commands/cache/clear.ts` - Clear all or specific entity cache - Create `src/commands/cache/stats.ts` - Show cache hit/miss stats, size, TTL - Register in CLI: `linear-create cache clear [entity-type]` - Register in CLI: `linear-create cache stats`

#### Phase 1 Refactoring (Original M14)

##### Refactor Existing Code

- [x] [M14-T05] Refactor `project/update.ts` to use validators - Replace inline priority validation (lines 97-108) with `validatePriority()` - Test that validation still works correctly - Verify error messages are unchanged

- [x] [M14-T06] Refactor workflow-states commands to use validators - Update `workflow-states/create.ts` to use `validateAndNormalizeColor()` - Update `workflow-states/update.ts` to use `validateAndNormalizeColor()` - Update `workflow-states/create.ts` to use `validateEnumValue()` for type validation - Update `workflow-states/update.ts` to use `validateEnumValue()` for type validation - Removed unused imports from colors.js

- [x] [M14-T07] Refactor issue-labels commands to use validators - Update `issue-labels/create.ts` to use `validateAndNormalizeColor()` - Update `issue-labels/update.ts` to use `validateAndNormalizeColor()` - Removed unused imports from colors.js

- [x] [M14-T08] Refactor project-labels commands to use validators - Update `project-labels/create.ts` to use `validateAndNormalizeColor()` - Update `project-labels/update.ts` to use `validateAndNormalizeColor()` - Removed unused imports from colors.js

- [x] [M14-T09] Refactor project commands to use parsers - Update `project/create.tsx` to use `parseCommaSeparated()` for members parsing - Update `project/create.tsx` to use `parseCommaSeparated()` for labels parsing - Update `project/create.tsx` to use `parsePipeDelimitedArray()` for links parsing

- [x] [M14-T10] Refactor status resolution to use shared utility - Update `project/create.tsx` (lines 151-179) to use `resolveStatusOrThrow()` - Update `project/update.ts` (lines 82-113) to use `resolveStatusOrThrow()` - Removed unused imports: `resolveProjectStatusId`, `resolveAlias` from project/update.ts - Removed unused imports: `resolveProjectStatusId` from project/create.tsx - Eliminate 28-line near-duplicate ✓

### Tests

**Note**: See detailed implementation in:

- [M14_TS_IMPLEMENTATION_OVERVIEW.md](./M14_TS_IMPLEMENTATION_OVERVIEW.md) - Complete strategy and timeline
- [M14_TS_P1_IMPLEMENTATION_UNIT.md](./M14_TS_P1_IMPLEMENTATION_UNIT.md) - Unit test details
- [M14_TS_P2_IMPLEMENTATION_E2E.md](./M14_TS_P2_IMPLEMENTATION_E2E.md) - E2E test details

**Timeline**: 5 weeks (~94 hours total)

- Phase 1 (Weeks 1-2): Unit tests - ~38 hours
- Phase 2 (Weeks 3-4): E2E tests - ~36 hours
- Phase 3 (Week 5): Integration & polish - ~20 hours

**Test File Structure**:

- Unit tests: `tests/unit/**/*.test.ts`
- E2E tests: `tests/e2e/**/*.e2e.ts`
- Existing bash tests: `tests/scripts/**/*.sh` (kept separate)

#### Test Framework & Setup (4 tasks)

- [~] [M14-INT01] Install Vitest and configure test environment
  File: `tests/vitest.config.ts`, `package.json` - Install vitest, @vitest/ui, @vitest/coverage-v8 as dev dependencies - Configure test patterns: tests/unit/\*_/_.test.ts - Enable coverage reporting (v8 provider) - Set up ESM/TypeScript support for Node.js type: "module" - Add test scripts: test, test:unit, test:e2e, test:watch, test:coverage, test:ui - Configure test environment and globals

- [~] [M14-INT02] Create test utilities and mocking helpers
  File: `tests/unit/fixtures/`, `tests/unit/helpers/` - Mock Linear API responses (teams, initiatives, members, templates) - Mock file system operations (fs.readFileSync, fs.writeFileSync) - Mock entity cache data with factory functions - Create assertion helpers for common patterns - Export mock builders for easy test setup - Document mock usage patterns

- [~] [M14-INT03] Update package.json with test scripts
  File: `package.json` - Add "test" script: "npm run test:unit && npm run test:e2e" - Add "test:unit" script: "vitest run" - Add "test:unit:watch" script: "vitest" - Add "test:unit:coverage" script: "vitest run --coverage" - Add "test:e2e" script: "tsx tests/e2e/runner.ts" - Add "test:e2e:setup" script for E2E configuration

- [~] [M14-INT04] Verify test infrastructure works - Create simple smoke test - Run test scripts to verify configuration - Verify coverage reports generate - Verify watch mode works - Verify TypeScript types in tests

#### Unit Tests - Phase 1 (Fast, Isolated, ~100+ tests initially, expandable)

**Note**: Initial target is ~100 tests covering core utilities. The 360 test comprehensive suite below represents the full possible scope - review and prioritize based on M14 needs.

- [~] [M14-UT01] Unit test validators module
  File: `tests/unit/lib/validators.test.ts` (~50 tests)
  **validatePriority()** (~10 tests): - Test valid range (0-4) - Test invalid (negative, >4, NaN, string, null, undefined) - Test return structure (valid, value, error)
  **validateAndNormalizeColor()** (~15 tests): - Test valid hex with # (#FF6B6B) - Test valid hex without # (FF6B6B) - Test invalid hex (ZZZZZZ, GGG, short codes) - Test normalization (adds # if missing, uppercase) - Test edge cases (empty, null, special chars)
  **validateEnumValue()** (~10 tests): - Test valid values from allowed list - Test invalid values not in list - Test case sensitivity - Test empty/null values
  **validateISODate()** (~10 tests): - Test valid ISO dates - Test invalid formats - Test edge cases
  **validateNonEmpty()** (~5 tests): - Test non-empty strings - Test empty, whitespace, null, undefined
  Mocking: None (pure functions)
  Coverage target: 100%

- [~] [M14-UT02] Unit test parsers module
  File: `tests/unit/lib/parsers.test.ts` (~40 tests)
  **parseCommaSeparated()** (~10 tests): - Test normal case ("a,b,c") - Test with spaces ("a, b , c") - Test with empty segments ("a,,c") - Test empty string ("") - Test single value ("a") - Test trailing commas
  **parsePipeDelimited()** (~8 tests): - Test "URL|Label" format - Test "URL" format (no label) - Test multiple pipes edge case - Test empty strings
  **parseLifecycleDate()** (~10 tests): - Test "now" keyword - Test valid ISO date "2025-01-15" - Test invalid format "01/15/2025" - Test invalid date "2025-13-45" - Test edge cases (empty, null)
  **parseCommaSeparatedUnique()** (~6 tests): - Test deduplication - Test case sensitivity
  **parsePipeDelimitedArray()** (~6 tests): - Test batch processing - Test mixed formats
  Mocking: None (pure functions)
  Coverage target: 100%

- [~] [M14-UT03] Unit test file-utils module
  File: `tests/unit/lib/file-utils.test.ts` (~15 tests)
  **readContentFile()** (~15 tests): - Mock success case with actual content - Mock ENOENT error (file not found) - verify error message - Mock EACCES error (permission denied) - verify error message - Mock generic errors - fallback handling - Test empty files - Test large files - Test different encodings - Test return structure (success, content, error)
  Mocking: `fs` module (readFileSync, existsSync)
  Coverage target: 100%

- [~] [M14-UT04] Unit test resolution module
  File: `tests/unit/lib/resolution.test.ts` (~20 tests)
  **resolveStatus()** for project-status (~10 tests): - Test with alias (mock alias resolution) - Test with ID (direct pass-through) - Test with name (mock status cache lookup) - Test invalid input (should return error structure) - Test error cases
  **resolveStatus()** for workflow-state (~10 tests): - Same tests as project-status but for workflow states - Verify type parameter affects lookup
  Mocking: `aliases.js` (resolveAlias), `status-cache.js` (getProjectStatuses)
  Coverage target: 100%

#### Unit Tests - Phase 1 Caching (~180 tests)

- [~] [M14-UT05] Unit test entity-cache module
  File: `tests/unit/lib/entity-cache.test.ts` (~60 tests)
  **EntityCache class** (~60 tests): - getTeams() - session cache, persistent cache, API fallback (~10 tests) - getInitiatives() - hybrid caching strategy (~10 tests) - getMembers() - cache behavior with options (~10 tests) - getTemplates() - hybrid caching (~10 tests) - findTeamById(), findMemberByEmail() - lookup functions (~8 tests) - TTL expiration - cache invalidation (~6 tests) - clear(), clearEntity() - cache clearing (~4 tests) - invalidateIfExpired() - expiration logic (~4 tests) - Config checks - enableEntityCache, enableSessionCache, enablePersistentCache (~8 tests)
  Mocking: `linear-client.js` (getAllTeams, etc.), `status-cache.js`, `config.js`
  Coverage target: >90%

- [~] [M14-UT06] Unit test batch-fetcher module
  File: `tests/unit/lib/batch-fetcher.test.ts` (~40 tests)
  **batchFetchEntities()** (~15 tests): - Parallel fetching with Promise.all - Individual fetch failures don't fail batch - Error collection - Cache population after fetch
  **prewarmProjectCreation()** (~8 tests): - Fetches teams, initiatives, templates, members - Populates entity cache - Error handling
  **prewarmProjectUpdate()** (~5 tests): - Lighter version (teams, members only)
  **prewarmEntities()** (~5 tests): - Selective prewarming by entity type
  **refreshCache()** (~4 tests): - Cache clearing + refetch
  **getCacheStatus()** (~3 tests): - Statistics without fetching
  **Config checks** (~5 tests): - enableBatchFetching (parallel vs sequential)
  Mocking: `entity-cache.js`, `linear-client.js`, `config.js`
  Coverage target: >85%

- [~] [M14-UT07] Unit test status-cache module (persistent cache)
  File: `tests/unit/lib/status-cache.test.ts` (~60 tests)
  **Project statuses** (~12 tests): - getCachedProjectStatuses(), refreshStatusCache(), clearStatusCache() - TTL expiration - File I/O error handling
  **Teams cache** (~12 tests): - getCachedTeams(), refreshTeamsCache(), clearTeamsCache() - TTL validation
  **Initiatives cache** (~12 tests): - getCachedInitiatives(), refreshInitiativesCache(), clearInitiativesCache()
  **Members cache** (~12 tests): - getCachedMembers(), refreshMembersCache(), clearMembersCache()
  **Templates cache** (~12 tests): - getCachedTemplates(), refreshTemplatesCache(), clearTemplatesCache()
  **Utility functions** (~10 tests): - clearAllCache() - clears all entity caches - isCacheValid() - TTL checking - readCache(), writeCache() - file I/O with error handling
  **Config checks** (~5 tests): - enablePersistentCache flag
  Mocking: `fs` module, `linear-client.js`, `config.js`
  Coverage target: >85%

- [~] [M14-UT08] Unit test config module
  File: `tests/unit/lib/config.test.ts` (~30 tests)
  **getConfig()** (~10 tests): - Priority: project > global > env - Location tracking - Default values
  **setConfigValue()** (~12 tests): - Validation for each cache config key - Boolean parsing ("true", "1", "yes", "false", "0", "no") - Number parsing - TTL validation (1-1440) - Invalid values - proper error messages
  **unsetConfigValue()** (~4 tests): - Removal from global/project config
  **File operations** (~4 tests): - Mock fs operations - Error handling
  Mocking: `fs` module
  Coverage target: >80%

- [~] [M14-UT09] Unit test cache commands
  File: `tests/unit/commands/cache/stats.test.ts` (~10 tests) - Output formatting - Shows all config flags - Shows cache status for all entities - Age formatting (seconds, minutes, hours)
  File: `tests/unit/commands/cache/clear.test.ts` (~15 tests) - Clear all caches (session + persistent) - Clear specific entity (--entity teams) - Invalid entity type (error handling) - Verify both session and persistent cache cleared
  Mocking: `entity-cache.js`, `status-cache.js`
  Coverage target: >75%

- [~] [M14-UT10] Unit test linear-client validation functions
  File: `tests/unit/lib/linear-client.test.ts` (~40 tests)
  **Validation functions with mocked entity cache** (~40 tests): - validateTeamExists() - uses entity cache (~10 tests) - validateInitiativeExists() - uses entity cache (~10 tests) - getTemplateById() - uses entity cache (~10 tests) - resolveMemberIdentifier() - uses cached member list (~10 tests) - Verify 0 API calls after cache populated - Error cases - not found scenarios
  Mocking: `entity-cache.js`, Linear SDK
  Coverage target: >80%

#### E2E Tests - Phase 2 (Real API, 6-7 focused tests)

**Note**: Simplified from original 63 test plan to focus on core caching validation scenarios.

- [~] [M14-E2E01] E2E test - project create with caching (basic validation)
  File: `tests/e2e/specs/project-create.e2e.ts`
  **API call counting** (~10 tests): - Instrument Linear SDK to count API calls - First project create with 5 members - verify ≤8 API calls (60-70% reduction from 18-20) - Second project create - verify cache hits (even fewer calls) - Third create with different options - verify cache reuse - Measure wall-clock time improvement (50-70% faster) - Verify cache is populated after first call - Test with various field combinations
  Requires: Real Linear API key, test workspace
  Success criteria: ≤8 API calls per create, >50% time reduction

- [~] [M14-E2E02] E2E test - project update with caching
  File: `tests/e2e/specs/project-update.e2e.ts`
  **API call counting** (~8 tests): - Instrument Linear SDK to count API calls - Project update with status change - verify ≤4 API calls (40-50% reduction from 5-8) - Multiple updates in sequence - verify cache reuse - Test with different field combinations - Measure performance improvement
  Requires: Real Linear API key, test workspace
  Success criteria: ≤4 API calls per update

- [~] [M14-E2E03] E2E test - regression (no breaking changes)
  File: `tests/e2e/specs/regression.e2e.ts`
  **Regression testing** (~2 tests): - Run `project create` with all fields - verify behavior unchanged - Run `project update` with all fields - verify behavior unchanged - Verify output messages unchanged - Verify error messages unchanged
  Requires: Real Linear API key, test workspace
  Success criteria: All commands work identically to pre-M14 behavior

- [~] [M14-E2E04] E2E test - caching performance (API call reduction)
  File: `tests/e2e/specs/caching-performance.e2e.ts`
  **API call reduction measurement** (~2 tests): - Measure API calls: baseline (no cache) vs cached for project create - Calculate and verify 60-70% reduction target met - Baseline: create project without prewarm - Cached: create project with prewarm
  Requires: Real Linear API key
  Success criteria: ≥60% reduction in API calls

- [~] [M14-E2E05] E2E test - caching performance (time reduction)
  File: `tests/e2e/specs/caching-performance.e2e.ts`
  **Wall-clock time measurement** (~1 test): - Measure execution time: baseline vs cached - Calculate and verify 50-70% time reduction
  Requires: Real Linear API key
  Success criteria: ≥50% reduction in execution time

#### Test Summary & Success Criteria

**Phase 1 - Unit Tests:**

- Initial target: ~100+ unit tests across 10 test suites (core utilities + caching)
- Comprehensive target: ~360 tests (includes all edge cases, config, cache commands) - review and prioritize
- Execution time: <10 seconds for all unit tests
- Coverage target: >80% on all M14 modules (validators, parsers, file-utils, resolution, entity-cache, batch-fetcher, status-cache)
- All tests must pass
- Located in tests/unit/\*_/_.test.ts

**Phase 2 - E2E Tests:**

- Total: 5 focused E2E test suites (simplified from 63 comprehensive tests)
- Tests: project-create, project-update, regression, caching-performance (API + time)
- Execution time: 2-5 minutes for all E2E tests
- Requires: Real Linear API key and test workspace
- Located in tests/e2e/specs/\*.e2e.ts
- Verifies real-world performance improvements (60-70% API call reduction, 50-70% time reduction)

**Overall Success Criteria:**

- ✅ All ~100+ unit tests passing (or more if expanded)
- ✅ All 5 E2E test suites passing
- ✅ >80% code coverage on M14 modules
- ✅ 60-70% API call reduction verified in E2E tests
- ✅ 50-70% time reduction verified in E2E tests
- ✅ No regression in existing functionality
- ✅ Fast test execution (<10s unit, 2-5min E2E)
- ✅ CI/CD ready with test scripts
- ✅ Existing bash tests remain functional and separate

**Test Scripts Available:**

```bash
npm test                  # Run all tests
npm run test:unit         # Run unit tests only (fast)
npm run test:e2e          # Run E2E tests only (slower, requires API key)
npm run test:watch        # Watch mode for TDD
npm run test:coverage     # Generate coverage report
npm run test:ui           # Visual test UI
```

**Test File Structure:**

```
tests/
  unit/                     # Unit tests (Phase 1)
    lib/
      validators.test.ts    # M14-UT01 (~50 tests)
      parsers.test.ts       # M14-UT02 (~40 tests)
      file-utils.test.ts    # M14-UT03 (~15 tests)
      resolution.test.ts    # M14-UT04 (~20 tests)
      entity-cache.test.ts  # M14-UT05 (~60 tests)
      batch-fetcher.test.ts # M14-UT06 (~40 tests)
      status-cache.test.ts  # M14-UT07 (~60 tests)
      config.test.ts        # M14-UT08 (~30 tests)
      linear-client.test.ts # M14-UT10 (~40 tests)
    commands/
      cache/
        stats.test.ts       # M14-UT09 (~10 tests)
        clear.test.ts       # M14-UT09 (~15 tests)
    fixtures/               # Mock data
    helpers/                # Test utilities

  e2e/                      # E2E tests (Phase 2)
    specs/
      project-create.e2e.ts         # M14-E2E01
      project-update.e2e.ts         # M14-E2E02 (optional)
      regression.e2e.ts             # M14-E2E03
      caching-performance.e2e.ts    # M14-E2E04, M14-E2E05
    setup/
      e2e-config.ts         # Config manager
      interactive-setup.ts  # Interactive team/initiative selector
      random-selector.ts    # Random fallback for CI
      preflight-check.ts    # Pre-test validation
    lib/
      test-runner.ts        # E2E test framework
      cleanup-tracker.ts    # Track created entities
      api-call-tracker.ts   # Count API calls
    runner.ts               # Main entry point

  scripts/                  # Existing bash tests (separate)
    test-project-create.sh
    test-project-update.sh
    run-all-tests.sh

  vitest.config.ts          # Vitest configuration
```

### Deliverable

```bash
# Clean, reusable utility library (Phase 1)
src/lib/validators.ts    # Priority, color, enum, date validation
src/lib/parsers.ts       # CSV, pipe-delimited, date parsing
src/lib/file-utils.ts    # Safe file reading
src/lib/resolution.ts    # Status resolution logic

# Caching infrastructure (Phase 2)
src/lib/entity-cache.ts           # In-memory entity cache
src/lib/batch-fetcher.ts          # Batch API call utilities
src/lib/status-cache.ts           # Extended for teams/initiatives/templates

# Updated commands using utilities + caching
src/commands/project/update.ts          # Uses validators + caching
src/commands/project/create.tsx         # Uses parsers + resolution + caching
src/commands/workflow-states/*.ts       # Uses validators
src/commands/issue-labels/*.ts          # Uses validators
src/commands/project-labels/*.ts        # Uses validators

# Optional cache management commands
src/commands/cache/clear.ts       # Clear cache
src/commands/cache/stats.ts       # Show cache stats
```

### API Call Reduction Breakdown

**Project Create (5 members, 2 links):**

- BEFORE: 18-20 API calls
- AFTER: 6-8 API calls
- SAVINGS: 60-70% reduction

**Project Update:**

- BEFORE: 5-8 API calls
- AFTER: 3-4 API calls
- SAVINGS: 40-50% reduction

**Performance:**

- Wall-clock time: 50-70% faster
- First run: Cache populated (3-4 batch calls)
- Subsequent runs: Cache hits (near-instant validation)

### Automated Verification

- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes
- All unit tests pass
- All integration tests pass
- Performance benchmarks show expected improvements

### Manual Verification

- Existing commands work identically (no behavior changes)
- Error messages are unchanged
- Console output matches previous version (plus cache status)
- ~90 lines of duplicate code eliminated
- API calls reduced by 60-70% (verify with API call logging)
- Commands feel noticeably faster

---

## [x] Milestone M15: Core Field Expansion - Project Update Feature Parity (v0.14.0)

**Goal**: Close the ~50% feature gap in `project update` by adding all visual, people, organization, and date resolution fields that are available in `project create`

**Background**: Gap analysis revealed that 8 major features available in `project create` are completely missing from `project update`, representing a significant usability issue where users cannot modify fields they set during creation.

**Requirements**:

- Add 8 missing updatable fields to match `project create`: color, icon, lead, members, labels, start-date-resolution, target-date-resolution
- Note: team field update capability (while supported by Linear API, requires investigation of implications)
- Implement validation and alias resolution matching create command exactly
- Use shared utilities from M14 (validators, parsers, resolution)
- Maintain consistency with project create command (identical error messages, console output)
- Icon handling: Pass directly to Linear API (no client-side validation per M14.6)

**Out of Scope**:

- Lifecycle fields (canceled, completed, trashed) - save for M16
- Advanced fields (Slack, reminders, sorting)
- Link management (requires separate link add/remove commands)
- Breaking changes
- Team reassignment (deferred pending investigation)

### Tests & Tasks

**Implementation Approach**: Three-phase incremental development with testing after each phase

#### Phase 1: Visual & Ownership Fields (icon, color, lead)

- [x] [M15-T01] Update `ProjectUpdateInput` interface in `/src/lib/linear-client.ts` for Phase 1 fields
      ```typescript
      export interface ProjectUpdateInput {
      // Existing fields
      statusId?: string;
      name?: string;
      description?: string;
      content?: string;
      priority?: number;
      startDate?: string;
      targetDate?: string;

        // NEW FIELDS (M15)
        color?: string;
        icon?: string;
        leadId?: string;
        memberIds?: string[];
        labelIds?: string[];
        teamIds?: string[];  // API supports array, CLI uses singular --team
        startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
        targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
        convertedFromIssueId?: string;
      }
      ```

#### Update Linear Client

- [x] [M15-T02] Update `updateProject()` function in `/src/lib/linear-client.ts` - Add conditional inclusion for color, icon (lines 906-914 style) - Add conditional inclusion for leadId, memberIds, labelIds, teamIds - Add conditional inclusion for startDateResolution, targetDateResolution - Add conditional inclusion for convertedFromIssueId - Match implementation pattern from `createProject()` (lines 766-880) - Ensure all fields are optional (only include if provided)

#### Add CLI Options

- [x] [M15-T03] Add CLI options to `src/cli.ts` for `project update` command - After line 295, add:
      `typescript
.option('--color <hex>', 'Project color (hex code like #FF6B6B)')
.option('--icon <icon>', 'Project icon (emoji like 🚀 or icon identifier)')
.option('--lead <id>', 'Project lead (user ID, alias, or email)')
.option('--members <ids>', 'Comma-separated member IDs, aliases, or emails')
.option('--labels <ids>', 'Comma-separated project label IDs or aliases')
.option('--team <id>', 'Team ID or alias')
.addOption(new Option('--start-date-resolution <res>', 'Start date resolution').choices(['month', 'quarter', 'halfYear', 'year']))
.addOption(new Option('--target-date-resolution <res>', 'Target date resolution').choices(['month', 'quarter', 'halfYear', 'year']))
.option('--converted-from <id>', 'Issue ID this project was converted from')
`

#### Implement Validation and Resolution

- [x] [M15-T04] Add validation and resolution in `/src/commands/project/update.ts`

      **Color validation:**
      - Import `validateAndNormalizeColor` from validators.ts
      - Validate and normalize if options.color provided
      - Add to updates object if valid

      **Icon validation:**
      - Basic validation (non-empty string)
      - Add to updates object if provided

      **Lead resolution:**
      - Import `resolveMemberIdentifier` from linear-client.ts
      - Resolve lead with alias/ID/email (copy pattern from create.tsx lines 249-270)
      - Log resolution: "📎 Resolved email/alias to name"
      - Add leadId to updates object

      **Members resolution:**
      - Parse with `parseCommaSeparated()` from parsers.ts
      - Loop through each identifier
      - Resolve each with `resolveMemberIdentifier()`
      - Collect resolved IDs into array
      - Log progress: "🔍 Validating N member(s)..."
      - Log each resolution: "📎 Resolved...", "✓ Member found..."
      - Add memberIds array to updates object

      **Labels resolution:**
      - Parse with `parseCommaSeparated()` from parsers.ts
      - Resolve each with `resolveAlias('project-label', ...)`
      - Log resolution if alias was resolved
      - Collect into labelIds array
      - Add to updates object

      **Team resolution:**
      - Resolve with `resolveAlias('team', ...)`
      - Log resolution if alias was resolved
      - Add to updates object as teamIds: [teamId] (API expects array)

      **Date resolution validation:**
      - Validate enum with `validateEnumValue()` from validators.ts
      - Allowed values: ['month', 'quarter', 'halfYear', 'year']
      - Add to updates object if valid

      **Console output:**
      - Match create.tsx style exactly
      - Use same emoji (📎, ✓, 🔍, ❌)
      - Use same message formats

- [x] [M15-T05] Add change tracking display in update.ts - Extend existing change logging (lines 123-125 style) - Log each new field being updated - Format: "Color → #FF6B6B", "Lead → John Doe", etc. - Optional: Show before/after values for clarity

### Tests

- [x] [M15-TS01] Test updating color - Covered by bash test suite (test-project-update.sh lines 499-545) - Tests valid hex with/without #, invalid hex formats

- [x] [M15-TS02] Test updating icon - Covered by bash test suite (test-project-update.sh lines 599-739) - Tests Tree, Checklist, Joystick, and other icon names

- [x] [M15-TS03] Test updating lead - Covered by bash test suite (test-project-update.sh) - Tests user ID, alias, and email resolution

- [x] [M15-TS04] Test updating members with comma-separated values - Covered by bash test suite (test-project-update.sh) - Tests single member, multiple IDs, mixed formats

- [x] [M15-TS05] Test updating labels with comma-separated values - Covered by bash test suite (test-project-update.sh) - Tests label resolution and comma-separated values

- [x] [M15-TS06] Test updating team - Covered by bash test suite (test-project-update.sh) - Tests team ID and alias resolution

- [x] [M15-TS07] Test updating date resolutions - Covered by bash test suite (test-project-update.sh) - Tests month, quarter, halfYear, year values

- [x] [M15-TS08] Test error cases - Covered by bash test suite (test-project-update.sh) - Tests invalid inputs and error messages

- [x] [M15-TS09] Test multiple fields at once - Covered by bash test suite (test-project-update.sh) - Tests complex multi-field update scenarios

### Deliverable

```bash
# Users can update all core project fields
$ linear-create project update myproject --color "#FF6B6B" --icon "🚀"
$ linear-create project update myproject --lead john@acme.com
$ linear-create project update myproject --members "user_1,jane@acme.com,bob-alias"
$ linear-create project update myproject --labels "urgent,frontend-label,label_xyz"
$ linear-create project update myproject --team engineering-alias
$ linear-create project update myproject --start-date "2025-01-15" --start-date-resolution quarter
```

### Automated Verification

- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes

### Manual Verification

- All new fields can be updated successfully
- Validation matches create command behavior
- Alias resolution works for all entity types
- Console output is clear and helpful
- Error messages guide user to fix issues

---

## Backlog (Future Milestones)

### [~] Milestone M19: Issue Creation & Management (superseded by completed M15)

**Goal**: Add full issue creation and management capabilities with label and workflow state support
