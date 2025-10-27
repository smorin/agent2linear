# linear-create Milestones

**Note**: For completed milestones M01-M13, see [archive/MILESTONES_01.md](archive/MILESTONES_01.md)

**Legend:**
- `[x]` Completed
- `[-]` In Progress
- `[ ]` Not Started
- `[~]` Won't fix / Invalid / False positive

---

## [-] Milestone M12: Metadata Commands - Labels, Workflow States, Icons & Colors (v0.12.0)
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
- [x] [M12-T01] Update type definitions for new entity types
      - Add WorkflowState, IssueLabel, ProjectLabel, Color, Icon interfaces to types.ts
      - Add 'issue-label', 'project-label', 'workflow-state' to AliasEntityType
      - Update Aliases interface with issueLabels, projectLabels, workflowStates maps
      - Update ResolvedAliases for new entity location tracking

- [x] [M12-T02] Extend alias system to support new entity types
      - Update getEmptyAliases() with new entity maps
      - Update readAliasesFile() to ensure all keys exist
      - Extend normalizeEntityType() for label and workflow-state variants
      - Update getAliasesKey() mapping for new types
      - Update loadAliases() to merge new entity aliases
      - Extend looksLikeLinearId() for label_ and workflow_ prefixes
      - Update validateAllAliases() to check new entity types

- [ ] [M12-T03] Add Linear API client methods for workflow states
      - Add getAllWorkflowStates(teamId?: string) to linear-client.ts
      - Add getWorkflowStateById(id: string) for single state fetch
      - Add createWorkflowState(input: WorkflowStateCreateInput)
      - Add updateWorkflowState(id: string, input: WorkflowStateUpdateInput)
      - Add deleteWorkflowState(id: string)
      - Define WorkflowStateCreateInput and WorkflowStateUpdateInput types
      - Handle team-scoped workflow states

- [ ] [M12-T04] Add Linear API client methods for issue labels
      - Add getAllIssueLabels(teamId?: string) to linear-client.ts
      - Add getIssueLabelById(id: string)
      - Add createIssueLabel(input: IssueLabelCreateInput)
      - Add updateIssueLabel(id: string, input: IssueLabelUpdateInput)
      - Add deleteIssueLabel(id: string)
      - Support both workspace-level and team-level labels
      - Filter by team when teamId provided

- [ ] [M12-T05] Add Linear API client methods for project labels
      - Add getAllProjectLabels() to linear-client.ts
      - Add getProjectLabelById(id: string)
      - Add createProjectLabel(input: ProjectLabelCreateInput)
      - Add updateProjectLabel(id: string, input: ProjectLabelUpdateInput)
      - Add deleteProjectLabel(id: string)
      - Note: Project labels are workspace-level only

- [ ] [M12-T06] Create icons library with curated list
      - Create src/lib/icons.ts
      - Define CURATED_ICONS array with emoji, unicode, name, category
      - Implement searchIcons(query: string) for filtering
      - Implement getIconsByCategory(category: string)
      - Implement extractIconsFromEntities() to get workspace icons
      - Support filtering and searching icon list

- [ ] [M12-T07] Create colors library with curated palette
      - Create src/lib/colors.ts
      - Define CURATED_COLORS with Linear's standard palette
      - Implement searchColors(hex: string)
      - Implement extractColorsFromEntities() to get workspace colors
      - Implement getColorUsage(hex: string) for usage count
      - Support both curated and extracted color sources

- [ ] [M12-T08] Implement workflow-states list command
      - Create src/commands/workflow-states/list.tsx
      - Default to defaultTeam from config if set
      - Support --team flag for filtering
      - Support --type filter (triage/backlog/unstarted/started/completed/canceled)
      - Support --color filter (hex code)
      - Support -I/--interactive, --web, -f/--format flags
      - Display: ID, Name, Type, Color (with visual indicator), Position, Team

- [ ] [M12-T09] Implement workflow-states view command
      - Create src/commands/workflow-states/view.ts
      - Resolve by name, ID, or alias
      - Display full details with color preview
      - Show usage tip for using in commands
      - Support --web flag to open team settings

- [ ] [M12-T10] Implement workflow-states create command
      - Create src/commands/workflow-states/create.tsx
      - Require --team flag (or use defaultTeam)
      - Support -I/--interactive mode with prompts
      - Non-interactive flags: --name, --type, --color, --icon, --position
      - Validate all inputs
      - Show success with created state details

- [ ] [M12-T11] Implement workflow-states update command
      - Create src/commands/workflow-states/update.ts
      - Resolve state by name, ID, or alias
      - Support partial updates (only specified fields)
      - Flags: --name, --type, --color, --icon, --position
      - Show before/after summary

- [ ] [M12-T12] Implement workflow-states delete command
      - Create src/commands/workflow-states/delete.ts
      - Resolve state by name, ID, or alias
      - Require confirmation unless --yes flag
      - Check if state is in use (warn if so)
      - Show success message

- [ ] [M12-T13] Implement workflow-states sync-aliases command
      - Create src/commands/workflow-states/sync-aliases.ts
      - Fetch all workflow states for team (or all teams)
      - Generate slug from name (lowercase, hyphens)
      - Support --global, --project, --dry-run, --force flags
      - Show preview of aliases to be created
      - Handle conflicts appropriately

- [ ] [M12-T14] Implement issue-labels list command
      - Create src/commands/issue-labels/list.tsx
      - Default to defaultTeam if set, otherwise workspace-level
      - Support --team, --workspace flags for filtering
      - Support --color, --icon filters
      - Support -I/--interactive, --web, -f/--format flags
      - Display: ID, Name, Color, Icon, Team (if team-scoped)

- [ ] [M12-T15] Implement issue-labels view command
      - Create src/commands/issue-labels/view.ts
      - Resolve by name, ID, or alias
      - Display full details with color/icon preview
      - Show scope (workspace vs team)
      - Support --web flag

- [ ] [M12-T16] Implement issue-labels create command
      - Create src/commands/issue-labels/create.tsx
      - Support -I/--interactive mode
      - Non-interactive flags: --name, --description, --color, --icon, --team
      - Omit --team for workspace-level label
      - Validate inputs
      - Show success message

- [ ] [M12-T17] Implement issue-labels update command
      - Create src/commands/issue-labels/update.ts
      - Resolve label by name, ID, or alias
      - Support partial updates
      - Flags: --name, --description, --color, --icon
      - Show before/after summary

- [ ] [M12-T18] Implement issue-labels delete command
      - Create src/commands/issue-labels/delete.ts
      - Require confirmation unless --yes
      - Check usage count (warn if in use)
      - Support --force to delete anyway

- [ ] [M12-T19] Implement issue-labels sync-aliases command
      - Create src/commands/issue-labels/sync-aliases.ts
      - Follow workflow-states sync pattern
      - Support team filtering
      - Generate slugs from label names

- [ ] [M12-T20] Implement project-labels list command
      - Create src/commands/project-labels/list.tsx
      - No team filtering (workspace-only)
      - Support --color, --icon filters
      - Support -I/--interactive, --web, -f/--format flags
      - Display: ID, Name, Color, Icon, Description

- [ ] [M12-T21] Implement project-labels view command
      - Create src/commands/project-labels/view.ts
      - Resolve by name, ID, or alias
      - Display full details
      - Support --web flag

- [ ] [M12-T22] Implement project-labels create command
      - Create src/commands/project-labels/create.tsx
      - Support -I/--interactive mode
      - Non-interactive flags: --name, --description, --color, --icon
      - Validate inputs
      - Show success message

- [ ] [M12-T23] Implement project-labels update command
      - Create src/commands/project-labels/update.ts
      - Support partial updates
      - Show before/after summary

- [ ] [M12-T24] Implement project-labels delete command
      - Create src/commands/project-labels/delete.ts
      - Require confirmation
      - Check usage

- [ ] [M12-T25] Implement project-labels sync-aliases command
      - Create src/commands/project-labels/sync-aliases.ts
      - Follow same sync pattern as other entities

- [ ] [M12-T26] Implement icons list command
      - Create src/commands/icons/list.tsx
      - Default to curated list
      - Support --search flag for filtering
      - Support --category flag
      - Support --palette flag (default | workspace)
      - Support -f/--format with grid option for visual display
      - Display: Name, Emoji, Unicode, Category

- [ ] [M12-T27] Implement icons view command
      - Create src/commands/icons/view.ts
      - Display icon details
      - Show usage examples
      - Show where icon is used in workspace

- [ ] [M12-T28] Implement icons extract command
      - Create src/commands/icons/extract.ts
      - Extract from labels, workflow states, projects
      - Support --type flag to filter source
      - Show unique icons with usage count
      - Support output formats

- [ ] [M12-T29] Implement colors list command
      - Create src/commands/colors/list.tsx
      - Default to curated palette
      - Support --palette flag (default | workspace | both)
      - Support --search for hex filtering
      - Support -f/--format with grid option
      - Display: Hex, Name, Usage Count (if extracted)
      - Visual color blocks in terminal output

- [ ] [M12-T30] Implement colors view command
      - Create src/commands/colors/view.ts
      - Display color details
      - Show usage count in workspace
      - Show which entities use this color

- [ ] [M12-T31] Implement colors extract command
      - Create src/commands/colors/extract.ts
      - Extract from labels, workflow states, projects
      - Support --type flag to filter source
      - Show unique colors with usage count
      - Support output formats

- [ ] [M12-T32] Register all new commands in cli.ts
      - Add workflow-states command group (alias: wstate, ws)
      - Add issue-labels command group (alias: ilbl)
      - Add project-labels command group (alias: plbl)
      - Add icons command group
      - Add colors command group
      - Register all subcommands for each group
      - Add comprehensive help text with examples
      - Update main CLI help to show new commands

- [ ] [M12-T33] Build and test all new commands
      - Run npm run build
      - Run npm run lint
      - Run npm run typecheck
      - Test each command group help text
      - Test basic functionality of each command
      - Verify aliases work correctly

- [ ] [M12-TS01] Test workflow-states CRUD operations
      - Create workflow state with all fields
      - List workflow states with filters
      - Update workflow state
      - Delete workflow state
      - Sync aliases for workflow states

- [ ] [M12-TS02] Test issue-labels CRUD operations
      - Create workspace-level label
      - Create team-level label
      - List labels with team filtering
      - Update label properties
      - Delete label with confirmation
      - Sync aliases for labels

- [ ] [M12-TS03] Test project-labels CRUD operations
      - Create project label
      - List all project labels
      - Update label
      - Delete label
      - Sync aliases

- [ ] [M12-TS04] Test icons commands
      - List curated icons
      - Search icons by name
      - Extract icons from workspace
      - View icon details
      - Verify grid format works

- [ ] [M12-TS05] Test colors commands
      - List curated colors
      - List workspace colors
      - Extract colors from entities
      - View color details
      - Search colors by hex

- [ ] [M12-TS06] Test alias integration
      - Create aliases for labels
      - Create aliases for workflow states
      - Use aliases in other commands
      - Validate alias resolution
      - Test sync-aliases for all types

- [ ] [M12-TS07] Test filtering capabilities
      - Filter by team
      - Filter by color
      - Filter by icon
      - Filter by type
      - Combine multiple filters

- [ ] [M12-TS08] Test defaultTeam behavior
      - issue-labels list uses defaultTeam
      - workflow-states list uses defaultTeam
      - Commands work without defaultTeam
      - Override defaultTeam with --team flag

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
- [x] [M13-T01] Fix Bug #1: Add alias resolution for team filter in issue-labels
      - Update src/commands/issue-labels/sync-aliases.ts to resolve team aliases
      - Follow pattern from workflow-states/sync-aliases.ts (lines 19-21)
      - Add resolveAlias('team', teamId) call before getAllIssueLabels()
      - Test with team alias to verify resolution works
      - Committed: 9d2f0e9

- [x] [M13-T02] Fix Bug #2: Track and report failures in sync summary
      - Add `failed` counter in src/lib/sync-aliases.ts
      - Increment counter when alias creation fails (excluding "already points to")
      - Update summary message to show failures with warning emoji
      - Show success only when failed === 0
      - Test with simulated failure to verify counter
      - Committed: 44515a2

- [x] [M13-T03] Fix Bug #3: Add duplicate detection for labels
      - Add detectDuplicates: true in issue-labels/sync-aliases.ts
      - Add detectDuplicates: true in project-labels/sync-aliases.ts
      - Test by creating labels with duplicate names
      - Verify duplicates are detected and skipped
      - Committed: 87f4003

- [x] [M13-T04] Fix Bug #4: Validate empty slugs
      - Add empty slug check in sync-aliases.ts after generateSlug()
      - Skip entities with empty slugs and show warning
      - Add empty alias validation in aliases.ts addAlias() function
      - Return error if alias is empty or whitespace-only
      - Test with entity name containing only special characters
      - Committed: c6f27eb

- [x] [M13-T05] Fix Bug #5: Warn users about corrupted aliases file
      - Update readAliasesFile() catch block in aliases.ts
      - Add console.warn when file exists but cannot be parsed
      - Include error message and recovery guidance
      - Only warn if file exists (not just missing)
      - Test by corrupting aliases.json and running command
      - Committed: 6659614

- [x] [M13-TS01] Regression test: Verify existing functionality
      - Test team sync-aliases with valid team ID
      - Test workflow-state sync-aliases
      - Test issue-label sync-aliases with --team flag
      - Test project-label sync-aliases
      - Verify npm run build succeeds ✅
      - Verify npm run lint passes ✅
      - Verify npm run typecheck passes ✅

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

## [ ] Milestone M14: Foundation - Shared Utilities (v0.13.0)

**Goal**: Extract duplicated code into reusable utilities before adding new features

**Requirements**:
- Eliminate ~90 lines of duplicate code across commands
- Create validators for priority, color, enum values
- Create parsers for comma-separated and pipe-delimited values
- Create file utilities for safe content file reading
- Create resolution utilities for status entities
- Ensure existing functionality unchanged (regression-free)

**Out of Scope**:
- New features (save for subsequent milestones)
- UI/UX changes
- Breaking changes to existing commands

### Tests & Tasks

#### Validators Module
- [ ] [M14-T01] Create `/src/lib/validators.ts`
      - Implement `validatePriority(value: string | number): { valid: boolean; priority?: number; error?: string }`
      - Implement `validateAndNormalizeColor(value: string): { valid: boolean; color?: string; error?: string }`
      - Implement `validateEnumValue(value: string, allowedValues: string[]): { valid: boolean; error?: string }`
      - Return structured results, no process.exit() in utilities
      - Add JSDoc comments with examples

#### Parsers Module
- [ ] [M14-T02] Create `/src/lib/parsers.ts`
      - Implement `parseCommaSeparated(value: string): string[]` - Split by comma, trim, filter empty
      - Implement `parsePipeDelimited(value: string): { key: string; value: string }` - Split "URL|Label" format
      - Add JSDoc comments with examples
      - Handle edge cases (empty strings, multiple pipes, etc.)

#### File Utilities Module
- [ ] [M14-T03] Create `/src/lib/file-utils.ts`
      - Implement `readContentFile(path: string): Promise<{ success: boolean; content?: string; error?: string }>`
      - Include ENOENT (file not found) error handling
      - Include EACCES (permission denied) error handling
      - Include generic error fallback
      - Return structured results with user-friendly error messages

#### Resolution Module
- [ ] [M14-T04] Create `/src/lib/resolution.ts`
      - Implement `resolveStatus(input: string, entityType: 'project-status' | 'workflow-state'): Promise<{ success: boolean; id?: string; error?: string }>`
      - Encapsulates: try alias first, then name/ID lookup
      - Include proper console logging ("📎 Resolved...", "✓ Found...")
      - Eliminates 28-line duplicate between create and update

#### Refactor Existing Code
- [ ] [M14-T05] Refactor `project/update.ts` to use validators
      - Replace inline priority validation (lines 97-108) with `validatePriority()`
      - Test that validation still works correctly
      - Verify error messages are unchanged

- [ ] [M14-T06] Refactor workflow-states commands to use validators
      - Update `workflow-states/create.ts` to use `validateAndNormalizeColor()`
      - Update `workflow-states/update.ts` to use `validateAndNormalizeColor()`
      - Update `workflow-states/create.ts` to use `validateEnumValue()` for type validation
      - Update `workflow-states/update.ts` to use `validateEnumValue()` for type validation

- [ ] [M14-T07] Refactor issue-labels commands to use validators
      - Update `issue-labels/create.ts` to use `validateAndNormalizeColor()`
      - Update `issue-labels/update.ts` to use `validateAndNormalizeColor()`

- [ ] [M14-T08] Refactor project-labels commands to use validators
      - Update `project-labels/create.ts` to use `validateAndNormalizeColor()`
      - Update `project-labels/update.ts` to use `validateAndNormalizeColor()`

- [ ] [M14-T09] Refactor project commands to use parsers
      - Update `project/create.tsx` to use `parseCommaSeparated()` for members parsing
      - Update `project/create.tsx` to use `parseCommaSeparated()` for labels parsing
      - Update `project/create.tsx` to use `parsePipeDelimited()` for links parsing (if applicable)

- [ ] [M14-T10] Refactor status resolution to use shared utility
      - Update `project/create.tsx` (lines 151-179) to use `resolveStatus()`
      - Update `project/update.ts` (lines 82-113) to use `resolveStatus()`
      - Verify console output matches previous behavior
      - Eliminate 28-line near-duplicate

### Tests
- [ ] [M14-TS01] Unit test `validatePriority()` with valid/invalid values
      - Test valid range (0-4)
      - Test invalid (negative, >4, NaN, string)
      - Test return structure

- [ ] [M14-TS02] Unit test `validateAndNormalizeColor()` with/without # prefix
      - Test valid hex with # (#FF6B6B)
      - Test valid hex without # (FF6B6B)
      - Test invalid hex (ZZZZZZ, short codes)
      - Test normalization (adds # if missing)

- [ ] [M14-TS03] Unit test `parseCommaSeparated()` with various inputs
      - Test normal case ("a,b,c")
      - Test with spaces ("a, b , c")
      - Test with empty segments ("a,,c")
      - Test empty string ("")
      - Test single value ("a")

- [ ] [M14-TS04] Unit test `parsePipeDelimited()` for link format
      - Test "URL|Label" format
      - Test "URL" format (no label)
      - Test multiple pipes edge case
      - Test empty strings

- [ ] [M14-TS05] Unit test `readContentFile()` with missing file, permission errors
      - Mock ENOENT error (file not found)
      - Mock EACCES error (permission denied)
      - Mock success case
      - Verify error message quality

- [ ] [M14-TS06] Integration test `resolveStatus()` with project-status
      - Test with alias (should resolve)
      - Test with ID (should use directly)
      - Test with name (should lookup)
      - Test with invalid (should return error)

- [ ] [M14-TS07] Regression test - create/update still work after refactor
      - Run `project create` with all options
      - Run `project update` with all options
      - Run `workflow-states create` with color
      - Run `issue-labels create` with color
      - Verify no behavior changes

### Deliverable
```bash
# Clean, reusable utility library
src/lib/validators.ts    # Priority, color, enum validation
src/lib/parsers.ts       # CSV and pipe-delimited parsing
src/lib/file-utils.ts    # Safe file reading
src/lib/resolution.ts    # Status resolution logic

# Refactored commands using utilities
src/commands/project/update.ts          # Uses validators
src/commands/project/create.tsx         # Uses parsers, resolution
src/commands/workflow-states/*.ts       # Uses validators
src/commands/issue-labels/*.ts          # Uses validators
src/commands/project-labels/*.ts        # Uses validators
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes
- All unit tests pass

### Manual Verification
- Existing commands work identically (no behavior changes)
- Error messages are unchanged
- Console output matches previous version
- ~90 lines of duplicate code eliminated

---

## [ ] Milestone M15: Core Field Expansion (v0.14.0)

**Goal**: Add visual, people, organization, and date resolution fields to update command

**Requirements**:
- Add 9 new updatable fields: color, icon, lead, members, labels, team, date resolutions, convertedFrom
- Implement validation and alias resolution matching create command
- Use shared utilities from M14
- Maintain consistency with project create command

**Out of Scope**:
- Lifecycle fields (canceled, completed, trashed) - save for M16
- Advanced fields (Slack, reminders, sorting)
- Breaking changes

### Tests & Tasks

#### Update TypeScript Interfaces
- [ ] [M15-T01] Update `ProjectUpdateInput` interface in `/src/lib/linear-client.ts`
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
- [ ] [M15-T02] Update `updateProject()` function in `/src/lib/linear-client.ts`
      - Add conditional inclusion for color, icon (lines 906-914 style)
      - Add conditional inclusion for leadId, memberIds, labelIds, teamIds
      - Add conditional inclusion for startDateResolution, targetDateResolution
      - Add conditional inclusion for convertedFromIssueId
      - Match implementation pattern from `createProject()` (lines 766-880)
      - Ensure all fields are optional (only include if provided)

#### Add CLI Options
- [ ] [M15-T03] Add CLI options to `src/cli.ts` for `project update` command
      - After line 295, add:
      ```typescript
      .option('--color <hex>', 'Project color (hex code like #FF6B6B)')
      .option('--icon <icon>', 'Project icon (emoji like 🚀 or icon identifier)')
      .option('--lead <id>', 'Project lead (user ID, alias, or email)')
      .option('--members <ids>', 'Comma-separated member IDs, aliases, or emails')
      .option('--labels <ids>', 'Comma-separated project label IDs or aliases')
      .option('--team <id>', 'Team ID or alias')
      .addOption(new Option('--start-date-resolution <res>', 'Start date resolution').choices(['month', 'quarter', 'halfYear', 'year']))
      .addOption(new Option('--target-date-resolution <res>', 'Target date resolution').choices(['month', 'quarter', 'halfYear', 'year']))
      .option('--converted-from <id>', 'Issue ID this project was converted from')
      ```

#### Implement Validation and Resolution
- [ ] [M15-T04] Add validation and resolution in `/src/commands/project/update.ts`

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

- [ ] [M15-T05] Add change tracking display in update.ts
      - Extend existing change logging (lines 123-125 style)
      - Log each new field being updated
      - Format: "Color → #FF6B6B", "Lead → John Doe", etc.
      - Optional: Show before/after values for clarity

### Tests
- [ ] [M15-TS01] Test updating color
      - Valid hex with # (#FF6B6B) → succeeds
      - Valid hex without # (FF6B6B) → normalized to #FF6B6B
      - Invalid hex (ZZZZ) → error with helpful message

- [ ] [M15-TS02] Test updating icon
      - Emoji (🚀) → succeeds
      - Icon identifier (icon-name) → succeeds
      - Empty string → error

- [ ] [M15-TS03] Test updating lead
      - With user ID (user_abc123) → succeeds
      - With alias (john) → resolves and succeeds
      - With email (john@acme.com) → resolves and succeeds
      - Not found → error with helpful message

- [ ] [M15-TS04] Test updating members with comma-separated values
      - Single member (user_123) → succeeds
      - Multiple IDs (user_1,user_2) → succeeds
      - Mixed format (user_123,john@acme.com,jane-alias) → resolves all, succeeds
      - One not found → error identifying which member

- [ ] [M15-TS05] Test updating labels with comma-separated values
      - Single label (label_abc) → succeeds
      - Multiple IDs (label_1,label_2) → succeeds
      - Mixed IDs and aliases (label_123,urgent-alias) → resolves aliases, succeeds
      - Invalid label → error

- [ ] [M15-TS06] Test updating team
      - With team ID (team_abc123) → succeeds
      - With alias (frontend) → resolves and succeeds
      - Invalid team → error

- [ ] [M15-TS07] Test updating date resolutions
      - Valid value (month, quarter, halfYear, year) → succeeds
      - Invalid value (weekly) → error with allowed values
      - With corresponding dates → verify both fields update

- [ ] [M15-TS08] Test error cases
      - Invalid color format → clear error
      - Member not found → shows which member, suggests members list
      - Label not found → shows which label
      - Team not found → clear error

- [ ] [M15-TS09] Test multiple fields at once
      - Update color + lead + members together → all succeed
      - Verify all changes are logged
      - Verify all fields updated in Linear

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

## [ ] Milestone M16: Lifecycle Fields (v0.15.0)

**Goal**: Add project state management and lifecycle control

**Requirements**:
- Add 3 lifecycle fields: canceledAt, completedAt, trashed
- Support "now" keyword for timestamp fields
- Support ISO date format (YYYY-MM-DD)
- Use shared utilities from M14

**Out of Scope**:
- Advanced state transitions
- Workflow automation
- Approval workflows

### Tests & Tasks

#### Update TypeScript Interfaces
- [ ] [M16-T01] Update `ProjectUpdateInput` interface in `/src/lib/linear-client.ts`
      ```typescript
      export interface ProjectUpdateInput {
        // ... existing fields from M14 + M15

        // NEW LIFECYCLE FIELDS (M16)
        canceledAt?: string;  // ISO DateTime
        completedAt?: string;  // ISO DateTime
        trashed?: boolean;
      }
      ```

#### Add CLI Options
- [ ] [M16-T02] Add CLI options to `src/cli.ts` for `project update`
      ```typescript
      .option('--canceled-at <date>', 'Date when project was canceled (YYYY-MM-DD or "now")')
      .option('--completed-at <date>', 'Date when project was completed (YYYY-MM-DD or "now")')
      .option('--trashed', 'Mark project as trashed')
      .option('--no-trashed', 'Unmark project as trashed')
      ```

#### Implement Date Parsing
- [ ] [M16-T03] Add date parsing to `/src/lib/parsers.ts`
      - Implement `parseLifecycleDate(value: string): string`
      - Convert "now" to current ISO DateTime
      - Validate YYYY-MM-DD format
      - Convert YYYY-MM-DD to ISO DateTime
      - Return formatted string for Linear API

#### Update Command Logic
- [ ] [M16-T04] Update `/src/commands/project/update.ts` to handle lifecycle fields
      - Parse canceledAt with `parseLifecycleDate()` if provided
      - Parse completedAt with `parseLifecycleDate()` if provided
      - Handle trashed boolean (options.trashed === true/false)
      - Add to updates object conditionally
      - Log changes: "Canceled At → 2025-01-15", "Completed At → now", "Trashed → true"

- [ ] [M16-T05] Update `updateProject()` function in linear-client.ts
      - Add conditional inclusion for canceledAt, completedAt, trashed
      - Match pattern from other optional fields

### Tests
- [ ] [M16-TS01] Test --completed-at "now"
      - Should use current date/time
      - Should format as ISO DateTime
      - Should update project successfully

- [ ] [M16-TS02] Test --completed-at "2025-01-15"
      - Should parse as midnight on 2025-01-15
      - Should convert to ISO DateTime
      - Should update project successfully

- [ ] [M16-TS03] Test --canceled-at with valid ISO date
      - Should accept YYYY-MM-DD format
      - Should update project successfully
      - Should display in change log

- [ ] [M16-TS04] Test --trashed (mark as trashed)
      - Should set trashed: true
      - Should update project successfully

- [ ] [M16-TS05] Test --no-trashed (unmark as trashed)
      - Should set trashed: false
      - Should update project successfully

- [ ] [M16-TS06] Test invalid date formats
      - Invalid format (01/15/2025) → error
      - Invalid keyword (yesterday) → error
      - Malformed ISO date → error
      - Error message suggests correct format

- [ ] [M16-TS07] Test lifecycle combinations
      - Set completed and trashed together → succeeds
      - Set canceled and completed together → succeeds (Linear decides priority)

### Deliverable
```bash
# Mark project as completed
$ linear-create project update myproject --completed-at now

# Mark project as canceled on specific date
$ linear-create project update myproject --canceled-at "2025-01-15"

# Trash a project
$ linear-create project update myproject --trashed

# Untrash a project
$ linear-create project update myproject --no-trashed

# Combined lifecycle update
$ linear-create project update myproject --completed-at now --trashed
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes

### Manual Verification
- Projects can be marked as completed/canceled
- "now" keyword works correctly
- ISO dates are parsed correctly
- Trashed status can be toggled
- Changes are reflected in Linear

---

## [ ] Milestone M17: Consistency & Validation Parity (v0.16.0)

**Goal**: Ensure create and update commands have identical conventions and validation

**Requirements**:
- Option names match exactly between create and update
- Alias resolution behaves identically
- Validation logic is shared (no divergence)
- Error messages are word-for-word identical
- Console output follows same patterns

**Out of Scope**:
- New features
- Documentation (save for M18)
- UI/UX changes

### Tests & Tasks

#### Option Name Audit
- [ ] [M17-T01] Create option comparison spreadsheet
      - List all options in create command
      - List all options in update command
      - Mark: match / mismatch / create-only / update-only
      - Create table in markdown for documentation

      Expected results:
      - Both use `--team` (singular)
      - Both use `--lead` (singular)
      - Both use `--members` (comma-separated)
      - Both use `--labels` (comma-separated)
      - Both use `--priority` (0-4 range)
      - Both use `--status` (alias/ID/name resolution)
      - Create-only: `--initiative`, `--template`, `--state`
      - Update-only: `--canceled-at`, `--completed-at`, `--trashed`

- [ ] [M17-T02] Fix option name discrepancies
      - Verify all descriptions match word-for-word
      - Verify all format hints match (e.g., "format: team_xxx")
      - Update any mismatches to use create as source of truth

#### Alias Resolution Audit
- [ ] [M17-T03] Verify alias resolution consistency

      **Team resolution:**
      - Both use `resolveAlias('team', ...)`
      - Console output matches ("📎 Resolved team alias...")

      **Status resolution:**
      - Both use `resolveStatus()` utility from M14
      - Try alias first, then name/ID lookup
      - Console output matches exactly

      **Lead resolution:**
      - Both use `resolveMemberIdentifier()`
      - Try alias, then ID, then email
      - Console output matches ("📎 Resolved email...", "✓ Lead found...")

      **Members resolution:**
      - Both use `parseCommaSeparated()` + `resolveMemberIdentifier()` loop
      - Console output matches ("🔍 Validating N member(s)...", "📎 Resolved...", "✓ Member found...")

      **Labels resolution:**
      - Both use `parseCommaSeparated()` + `resolveAlias('project-label', ...)`
      - Console output matches

- [ ] [M17-T04] Fix resolution discrepancies
      - Update any console.log messages to match exactly
      - Update any error messages to match exactly
      - Ensure emoji usage is identical

#### Validation Audit
- [ ] [M17-T05] Verify validation consistency

      **Priority validation:**
      - Both use `validatePriority()` from validators.ts
      - Same error message: "Priority must be a number between 0 and 4:\n  0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low"
      - Same emoji: ❌

      **Color validation:**
      - Both use `validateAndNormalizeColor()` from validators.ts
      - Same error message for invalid hex
      - Same normalization (adds # if missing)

      **Date validation:**
      - Both validate ISO 8601 format (YYYY-MM-DD)
      - Same error message for invalid dates

      **Date resolution validation:**
      - Both use `validateEnumValue()` for choices
      - Same allowed values: ['month', 'quarter', 'halfYear', 'year']
      - Same error message showing allowed values

- [ ] [M17-T06] Fix validation discrepancies
      - Update error messages to match exactly
      - Ensure shared validators are used (no inline validation)
      - Verify validation happens in same order

#### Optional: Extract Member Resolution (if needed)
- [ ] [M17-T07] Evaluate member resolution duplication
      - Count lines of member resolution code in create vs update
      - If >30 lines duplicated, extract to `resolveMemberList()` in resolution.ts
      - Otherwise, keep inline for clarity

      Decision criteria:
      - Extract if: logic has diverged or >30 lines duplicated
      - Keep inline if: logic is identical and <30 lines

### Tests
- [ ] [M17-TS01] Side-by-side: priority validation
      - Create with invalid priority → error message
      - Update with invalid priority → error message
      - Verify messages are identical (word-for-word)

- [ ] [M17-TS02] Side-by-side: color validation
      - Create with invalid color → error message
      - Update with invalid color → error message
      - Verify messages are identical
      - Verify both normalize hex (add #)

- [ ] [M17-TS03] Side-by-side: member resolution
      - Create with members "user_1,email@example.com,alias"
      - Update with members "user_1,email@example.com,alias"
      - Verify resolution logic is identical
      - Verify console output is identical

- [ ] [M17-TS04] Side-by-side: error messages
      - Create with member not found → error
      - Update with member not found → error
      - Verify error messages match exactly
      - Verify suggestions match ("Tip: Use linear-create members list...")

- [ ] [M17-TS05] Regression test
      - Run full create command with all options
      - Run full update command with all options
      - Verify all existing functionality unchanged

### Deliverable
```markdown
# Option Comparison Table

| Option              | Create | Update | Notes                    |
|---------------------|--------|--------|--------------------------|
| --title / --name    | ✅     | ✅     | title in create, name in update |
| --description       | ✅     | ✅     | Match                    |
| --team              | ✅     | ✅     | Match (singular)         |
| --initiative        | ✅     | ❌     | Create-only              |
| --template          | ✅     | ❌     | Create-only              |
| --status            | ✅     | ✅     | Match                    |
| --lead              | ✅     | ✅     | Match                    |
| --members           | ✅     | ✅     | Match (comma-separated)  |
| --labels            | ✅     | ✅     | Match (comma-separated)  |
| --priority          | ✅     | ✅     | Match (0-4)              |
| --color             | ✅     | ✅     | Match                    |
| --icon              | ✅     | ✅     | Match                    |
| --start-date        | ✅     | ✅     | Match                    |
| --target-date       | ✅     | ✅     | Match                    |
| --*-date-resolution | ✅     | ✅     | Match                    |
| --canceled-at       | ❌     | ✅     | Update-only              |
| --completed-at      | ❌     | ✅     | Update-only              |
| --trashed           | ❌     | ✅     | Update-only              |
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes

### Manual Verification
- All shared options behave identically
- Error messages match word-for-word
- Console output patterns match
- Validation is consistent

---

## [ ] Milestone M18: Enhanced Help Documentation (v0.17.0)

**Goal**: Crystal-clear documentation with comprehensive examples

**Requirements**:
- Help text shows all options with examples
- Input format reference tables for quick lookup
- Examples cover all use cases (basic, advanced, mixed)
- Cross-references between related commands
- Examples are copy-pasteable and work correctly

**Out of Scope**:
- External documentation (README, wiki)
- Video tutorials
- Interactive tutorials

### Tests & Tasks

#### Update `project create` Help
- [ ] [M18-T01] Update `project create` help text in `src/cli.ts` (lines 205-264)

      **Structure:**
      1. Basic Examples (single values, common use cases)
      2. Using Aliases (team/initiative/status/template resolution)
      3. Multiple Values (members, labels, links with comma-separated and repeatable)
      4. Complete Example (all options together for reference)
      5. Input Formats Reference (table for quick lookup)

      **Examples must include:**
      - Basic: `--title "My Project" --team engineering`
      - Aliases: `--team frontend-alias --initiative q1-goals`
      - Multiple members: `--members "user_123,john@acme.com,jane-alias"`
      - Multiple labels: `--labels "urgent,frontend-label,label_xyz"`
      - Multiple links: `--link "https://example.com" --link "https://github.com/repo|GitHub Repo"`
      - Mixed resolution: aliases + IDs + emails in same command
      - Link pipe syntax: both "URL" and "URL|Label" formats
      - Complete: All options in one command for reference

      **Input Formats Reference Table:**
      ```
      --team            Single: alias OR team_xxx
      --initiative      Single: alias OR init_xxx
      --status          Single: alias OR status_xxx OR status name
      --lead            Single: alias OR user_xxx OR email
      --members         Comma-separated: alias,user_xxx,email (mixed OK)
      --labels          Comma-separated: alias,label_xxx (mixed OK)
      --link            Repeatable: "URL" or "URL|Label" (use --link multiple times)
      --priority        Number: 0-4 (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
      ```

#### Update `project update` Help
- [ ] [M18-T02] Update `project update` help text in `src/cli.ts` (lines 296-307)

      **Structure:**
      1. Basic Examples (update single field)
      2. Multiple Fields (update several at once)
      3. Using Different Identifiers (name/ID/alias for project)
      4. Lifecycle Management (completed/canceled/trashed)
      5. People & Organization (lead, members, labels, team)
      6. Input Formats Reference (table for quick lookup)

      **Examples must include:**
      - Single field: `project update "My Project" --status "In Progress"`
      - Multiple fields: `project update myproject --status done --priority 2 --target-date 2025-03-31`
      - By name: `project update "Exact Project Name" --color "#FF6B6B"`
      - By ID: `project update proj_abc123 --lead john@acme.com`
      - By alias: `project update myalias --members "user_1,jane@acme.com"`
      - Lifecycle: `project update myproject --completed-at now --trashed`
      - People: `project update myproject --lead sarah@acme.com --members "user_1,user_2"`
      - Complete: Multiple field update showing common workflow

      **Input Formats Reference Table:**
      ```
      <name-or-id>      Project: "exact name" OR proj_xxx OR alias
      --status          Status: "name" OR alias OR status_xxx
      --lead            Member: alias OR user_xxx OR email
      --members         Comma-separated: alias,user_xxx,email (mixed OK)
      --labels          Comma-separated: alias,label_xxx (mixed OK)
      --team            Single: alias OR team_xxx
      --priority        Number: 0-4 (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
      --canceled-at     ISO date: YYYY-MM-DD or "now"
      --completed-at    ISO date: YYYY-MM-DD or "now"
      --color           Hex code: #FF6B6B or FF6B6B
      --icon            Emoji or icon identifier: 🚀 or icon-name
      ```

#### Add Cross-References
- [ ] [M18-T03] Add cross-references between commands
      - In create help: "Note: See 'project update --help' for updating existing projects"
      - In update help: "Note: Options match 'project create' for consistency"
      - List fields only in create: `--team`, `--initiative`, `--template` (cannot change after creation)
      - List fields only in update: `--canceled-at`, `--completed-at`, `--trashed` (lifecycle only)

#### Add Common Pitfalls (optional)
- [ ] [M18-T04] Add common pitfalls section (if space allows)
      - Comma-separated vs repeatable arguments (--members vs --link)
      - When to use quotes (names with spaces, pipe syntax in --link)
      - Alias not found errors (suggestion: `linear-create alias list [type]`)
      - Member not found errors (suggestion: `linear-create members list`)

### Tests
- [ ] [M18-TS01] Manual: Run `project create --help`
      - Verify all examples are present and formatted correctly
      - Verify table is aligned and readable
      - Verify no typos or formatting issues

- [ ] [M18-TS02] Manual: Run `project update --help`
      - Verify all examples are present and formatted correctly
      - Verify table is aligned and readable
      - Verify no typos or formatting issues

- [ ] [M18-TS03] Manual: Copy/paste examples from create help
      - Test basic example
      - Test alias example
      - Test multiple members example
      - Test multiple labels example
      - Test multiple links example
      - Test complete example
      - Verify all work correctly (no errors)

- [ ] [M18-TS04] Manual: Copy/paste examples from update help
      - Test single field update
      - Test multiple field update
      - Test by name/ID/alias
      - Test lifecycle examples
      - Test people/organization examples
      - Verify all work correctly

- [ ] [M18-TS05] Peer review: Unfamiliar user test
      - Have someone unfamiliar with the tool read help
      - Ask them to complete common tasks using only help text
      - Gather feedback on clarity
      - Update based on feedback

### Deliverable
```bash
# Clear, comprehensive help for project create
$ linear-create project create --help

Examples:
  Basic usage:
  $ linear-create project create --title "My Project" --team engineering

  Using aliases:
  $ linear-create project create --title "New Feature" --team frontend --initiative q1-goals

  Multiple members (comma-separated, supports IDs/aliases/emails):
  $ linear-create project create --title "Team Project" --team eng \
      --members "user_abc123,john@acme.com,jane,bob@company.com"

  Multiple labels (comma-separated, supports IDs/aliases):
  $ linear-create project create --title "Launch" --team eng \
      --labels "urgent,frontend,label_xyz789"

  Multiple external links (repeatable --link, use pipe | for labels):
  $ linear-create project create --title "Docs Update" --team eng \
      --link "https://docs.example.com" \
      --link "https://github.com/org/repo|GitHub Repo" \
      --link "https://linear.app/issue/ABC-123|Related Issue"

  Complete example:
  $ linear-create project create \
      --title "Q1 Website Redesign" \
      --team frontend \
      --initiative q1-objectives \
      --state started \
      --status in-progress \
      --lead sarah@acme.com \
      --members "user_123,john@acme.com,designer-alias" \
      --labels "urgent,frontend,label_abc" \
      --priority 2 \
      --start-date "2025-01-15" \
      --target-date "2025-03-31" \
      --icon "🎨" \
      --color "#FF6B6B" \
      --link "https://figma.com/file/xyz|Design Mockups" \
      --link "https://docs.google.com/doc/abc|Requirements Doc"

Input Format Reference:
  --team            Single: alias OR team_xxx
  --initiative      Single: alias OR init_xxx
  --template        Single: alias OR template_xxx
  --status          Single: alias OR status_xxx OR status name
  --lead            Single: alias OR user_xxx OR email
  --members         Comma-separated: alias,user_xxx,email (mixed OK)
  --labels          Comma-separated: alias,label_xxx (mixed OK)
  --link            Repeatable: "URL" or "URL|Label" (use --link multiple times)
  --priority        Number: 0-4 (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
  --color           Hex code: #FF6B6B or FF6B6B
  --icon            Emoji or icon identifier: 🚀 or icon-name

Note: See 'project update --help' for updating existing projects

# Clear, comprehensive help for project update
$ linear-create project update --help

Examples:
  Update single field:
  $ linear-create project update "My Project" --status "In Progress"
  $ linear-create project update proj_abc --status done --priority 3
  $ linear-create project update myalias --name "New Name"

  Update multiple fields:
  $ linear-create project update "Q1 Goals" \
      --status completed \
      --priority 1 \
      --target-date 2025-03-31

  Using different identifier types (name/ID/alias):
  $ linear-create project update "Exact Project Name" --status done
  $ linear-create project update proj_abc123 --name "New Name"
  $ linear-create project update my-project-alias --description "Updated"

  Lifecycle management:
  $ linear-create project update myproject --completed-at now
  $ linear-create project update myproject --canceled-at "2025-01-15"
  $ linear-create project update myproject --trashed
  $ linear-create project update myproject --no-trashed

  People & organization:
  $ linear-create project update myproject --lead sarah@acme.com
  $ linear-create project update myproject --members "user_1,jane@acme.com"
  $ linear-create project update myproject --labels "urgent,frontend-label"
  $ linear-create project update myproject --team engineering-alias

  Visual updates:
  $ linear-create project update myproject --color "#FF6B6B" --icon "🎨"

Input Format Reference:
  <name-or-id>      Project: "exact name" OR proj_xxx OR alias
  --status          Status: "name" OR alias OR status_xxx
  --lead            Member: alias OR user_xxx OR email
  --members         Comma-separated: alias,user_xxx,email (mixed OK)
  --labels          Comma-separated: alias,label_xxx (mixed OK)
  --team            Single: alias OR team_xxx
  --priority        Number: 0-4 (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
  --canceled-at     ISO date: YYYY-MM-DD or "now"
  --completed-at    ISO date: YYYY-MM-DD or "now"
  --color           Hex code: #FF6B6B or FF6B6B
  --icon            Emoji or icon identifier: 🚀 or icon-name

Note: Options match 'project create' for consistency
Fields only in create: --team, --initiative, --template (cannot change after creation)
Fields only in update: --canceled-at, --completed-at, --trashed (lifecycle only)
```

### Automated Verification
- `npm run build` succeeds
- Help text renders correctly in terminal
- Tables are aligned properly

### Manual Verification
- All examples work when copy-pasted
- Help text is clear and comprehensive
- Users can complete tasks using only help
- No typos or formatting issues

---

## Backlog (Future Milestones)

### [ ] Milestone M19: Issue Creation & Management (v0.18.0)
**Goal**: Add full issue creation and management capabilities with label and workflow state support

### [ ] Milestone M20: Bulk Operations & Advanced Filtering (v0.19.0)
**Goal**: Bulk operations and advanced filtering support for all entity types

### [ ] Milestone M21: Workflow Automation (v1.0.0)
**Goal**: Automated workflows, hooks, and integrations
