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

## [-] Milestone M13: Bug Fixes from Analysis (v0.13.1)
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

- [ ] [M13-TS01] Regression test: Verify existing functionality
      - Test team sync-aliases with valid team ID
      - Test workflow-state sync-aliases
      - Test issue-label sync-aliases with --team flag
      - Test project-label sync-aliases
      - Verify npm run build succeeds
      - Verify npm run lint passes
      - Verify npm run typecheck passes

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

## Backlog (Future Milestones)

### [ ] Milestone M14: Issue Creation & Management (v0.14.0)
**Goal**: Add full issue creation and management capabilities with label and workflow state support

### [ ] Milestone M15: Bulk Operations & Advanced Filtering (v0.15.0)
**Goal**: Bulk operations and advanced filtering support for all entity types

### [ ] Milestone M16: Workflow Automation (v1.0.0)
**Goal**: Automated workflows, hooks, and integrations
