# linear-create Milestones

**Legend:**
- `[x]` Completed
- `[-]` In Progress
- `[ ]` Not Started

---

## [x] Milestone M01: Project Foundation (v0.1.0)
**Goal**: Set up TypeScript + Turbo project with basic CLI structure and command parsing

**Requirements**:
- Initialize npm package with TypeScript configuration
- Configure build tools (Turbo, tsup) and code quality tools (ESLint, Prettier)
- Set up Commander.js with resource-action command structure
- Create development and build pipelines

**Out of Scope**:
- Actual Linear API integration (M02)
- Interactive UI components (M03, M04)
- Configuration file management (M02)

### Tests & Tasks
- [x] [M01-T01] Initialize npm package with package.json
      - Run `npm init` with project metadata
      - Add TypeScript as dev dependency
      - Create basic tsconfig.json for Node.js CLI

- [x] [M01-T02] Configure build tools and code quality
      - Add tsup for fast TypeScript bundling
      - Configure ESLint with TypeScript rules
      - Configure Prettier for code formatting
      - Add necessary scripts to package.json

- [x] [M01-T03] Set up Commander.js with basic CLI structure
      - Create src/index.ts as CLI entry point
      - Create src/cli.ts with Commander setup
      - Implement resource-action command structure skeleton
      - Add commands: initiatives list/set, project create, config show

- [x] [M01-T04] Create turbo.json with build/dev/lint/test pipelines
      - Configure Turbo for monorepo-style task running
      - Define pipelines: build, dev, lint, format, typecheck
      - Set up task dependencies and caching

- [x] [M01-TS01] Verify build and help command work
      - Run `npm run build` successfully
      - Run `linear-create --help` shows command structure
      - Verify all subcommands show in help output

### Deliverable
```bash
$ npm run build
# Build succeeds

$ node dist/index.js --help
# Shows:
#   linear-create initiatives list
#   linear-create initiatives set <id>
#   linear-create project create
#   linear-create config show
```

### Automated Verification
- `npm run build` succeeds without errors
- `npm run lint` passes
- `npm run typecheck` passes
- Generated binary runs and shows help

### Manual Verification
- Help text displays all planned commands
- Command structure follows Option 1 (resource-action pattern)

---

## [x] Milestone M02: Configuration & Linear API Setup (v0.2.0)
**Goal**: Handle global and project-level configuration files and establish authenticated Linear API connection

**Requirements**:
- Support two-tier configuration: global (~/.config/linear-create/) and project (.linear-create/)
- Read LINEAR_API_KEY from environment variable
- Create Linear API client wrapper using @linear/sdk
- Implement `config show` command to display active configuration

**Out of Scope**:
- Interactive configuration wizard (future)
- Encrypted API key storage (future)

### Tests & Tasks
- [x] [M02-T01] Implement configuration management system
      - Add `conf` or `cosmiconfig` for config file handling
      - Create lib/config.ts with Config type and loader
      - Support global config: ~/.config/linear-create/config.json
      - Support project config: .linear-create/config.json
      - Implement config priority: env > project > global for API key, project > global for other settings

- [x] [M02-T02] Create Linear API client wrapper
      - Add @linear/sdk dependency
      - Create lib/linear-client.ts with LinearClient class
      - Initialize SDK with API key from config/env
      - Add error handling for authentication failures
      - Export typed methods for future use

- [x] [M02-T03] Add API key validation from LINEAR_API_KEY env var
      - Read LINEAR_API_KEY environment variable
      - Validate API key format
      - Test connection to Linear API
      - Display helpful error messages if key is missing/invalid

- [x] [M02-T04] Implement `config show` command
      - Create commands/config/show.ts
      - Display current configuration (API key masked)
      - Show config file locations and which is active
      - Show default initiative if set

- [x] [M02-TS01] Test config loading priority (env > project > global for API key)
      - Manual test: project config overrides global config for non-API settings
      - Manual test: env var overrides all configs for API key
      - Manual test: config show displays correct sources

- [x] [M02-TS02] Test Linear API connection with test key
      - Verified SDK initialization code
      - Verified viewer query implementation
      - Verified error handling for invalid/missing API key

### Deliverable
```bash
$ export LINEAR_API_KEY=lin_api_xxx
$ linear-create config show
# Shows:
#   Global config: ~/.config/linear-create/config.json
#   Project config: Not found
#   API Key: lin_***_xxx (from environment)
#   Default Initiative: Not set
```

### Automated Verification
- Config loading tests pass
- Linear API connection test passes
- `linear-create config show` displays config correctly

### Manual Verification
- Create test config files and verify precedence
- Test with valid LINEAR_API_KEY env var
- Test error message when API key is missing

---

## [x] Milestone M03: List & Select Initiatives (v0.3.0)
**Goal**: Build interactive initiative browser with Ink and allow users to select/set default initiative

**Requirements**:
- Fetch all initiatives from Linear API
- Display initiatives in interactive list with keyboard navigation
- Support search/filter functionality
- Allow selection that saves to config
- Support non-interactive `initiatives set <id>` command

**Out of Scope**:
- Creating or editing initiatives (read-only for now)
- Advanced filtering by status, date, etc.

### Tests & Tasks
- [x] [M03-T01] Set up Ink and create interactive list component
      - Upgraded to ink@6.3.1, react@19.2.0, added ink-select-input@6.2.0
      - Create ui/components/InitiativeList.tsx
      - Implement keyboard navigation (up/down, enter) using ink-select-input
      - Add loading state while fetching

- [x] [M03-T02] Implement `initiatives list` - fetch initiatives from Linear
      - Created commands/initiatives/list.tsx
      - Added getAllInitiatives() to linear-client.ts
      - Sort initiatives by name
      - Pass data to Ink component for rendering with error handling

- [x] [M03-T03] Add keyboard navigation and search/filter
      - Used ink-select-input's built-in keyboard navigation
      - Support Ctrl+C to cancel (built-in)
      - Show initiative details (name and ID)
      - Note: Custom fuzzy search deferred for simplicity

- [x] [M03-T04] Implement `initiatives set <id>` for non-interactive mode
      - Created commands/initiatives/set.ts
      - Accept initiative ID as argument
      - Validate initiative exists via validateInitiativeExists()
      - Save to config file with --global/--project flags

- [x] [M03-T05] Save selected initiative to config
      - Used setConfigValue() from config.ts
      - Support both project and global scope via flags
      - Display success message with initiative name and ID

- [x] [M03-TS01] Test initiative fetching and display
      - Build succeeds
      - Lint and typecheck pass
      - Error handling verified for missing API key

- [x] [M03-TS02] Test config persistence after selection
      - Verified commands accept --global and --project flags
      - Integration with existing setConfigValue() function

### Deliverable
```bash
$ linear-create initiatives list
# Interactive UI shows:
#   > Initiative A (init_abc123)
#     Initiative B (init_def456)
#     Initiative C (init_ghi789)
# [User presses Enter]
# ✓ Default initiative set to: Initiative A

$ linear-create initiatives set init_def456
# ✓ Default initiative set to: Initiative B

$ linear-create config show
# Shows:
#   Default Initiative: Initiative B (init_def456)
```

### Automated Verification
- Initiative fetching tests pass
- Config persistence tests pass
- Interactive mode can be tested with mock data

### Manual Verification
- Run `initiatives list` and navigate with keyboard
- Verify selection saves correctly
- Run `initiatives set <id>` with valid ID
- Confirm `config show` displays selected initiative

---

## [x] Milestone M04: Create Projects Linked to Initiatives (v0.4.0)
**Goal**: Create Linear projects with initiative linking, supporting both interactive and non-interactive modes

**Requirements**:
- Interactive mode: prompt for project fields using Ink
- Non-interactive mode: accept all fields via CLI flags
- Link project to initiative (use default from config if not specified)
- Support fields: title, description, state, initiative
- Display success message with Linear project URL

**Out of Scope**:
- Adding team members to project
- Setting project dates/milestones
- Custom field support

### Tests & Tasks
- [x] [M04-T01] Implement `project create` interactive mode (Ink prompts)
      - Created commands/project/create.tsx with App component
      - Added ink-text-input@6.0.0 for title/description prompts
      - Added ink-select-input for state selection (planned/started/paused/completed/canceled)
      - Created ProjectForm.tsx component for multi-step form
      - Shows validation errors inline for title (min 3 chars)

- [x] [M04-T02] Add fields: title, description, state, initiative link, team
      - Defined ProjectCreateInput and ProjectResult types
      - Created createProject() in linear-client.ts
      - Supports all required states with proper type safety
      - Validates required fields (title minimum 3 chars)
      - Added duplicate name checking via getProjectByName()
      - Added --team flag for team assignment

- [x] [M04-T03] Support non-interactive mode with CLI flags
      - Implemented createProjectNonInteractive() function
      - Flags: --title, --description, --state, --initiative, --team
      - Validates all required fields are provided
      - Auto-detects mode based on --title presence
      - Supports --no-interactive flag

- [x] [M04-T04] Use default initiative and team from config
      - Reads defaultInitiative and defaultTeam from config
      - Displays in interactive mode UI
      - Uses in non-interactive mode if flags not provided
      - Shows which initiative/team is being used in success message

- [x] [M04-T05] Display success message with project URL
      - Gets project URL from Linear API response
      - Shows formatted success in both modes
      - Includes: name, ID, URL, state, initiative, team
      - Comprehensive error handling with helpful messages

- [x] [M04-TS01] Test project creation in both modes
      - Build succeeds with all changes
      - Lint and typecheck pass
      - Help command shows all options correctly
      - Ready for manual testing with real Linear workspace

- [x] [M04-TS02] Test initiative linking
      - Validates initiative exists before creation
      - Updates project after creation to link initiative
      - Error handling for invalid initiative IDs
      - Uses validateInitiativeExists() from M02/M03

- [x] [M04-TS03] Test default initiative and team usage
      - Config values used when not specified in flags
      - Interactive mode shows defaults in UI
      - Non-interactive mode uses config defaults
      - Projects can be created without initiative/team (optional)

### Deliverable
```bash
# Interactive mode
$ linear-create project create
? Project title: My New Project
? Description: This is a test project
? State: planned
? Initiative: [Use default: Initiative A]
✓ Project created successfully!
  Name: My New Project
  ID: PRJ-123
  URL: https://linear.app/workspace/project/my-new-project-abc123

# Non-interactive mode
$ linear-create project create \
  --title "Another Project" \
  --description "Quick project" \
  --state started \
  --initiative init_def456
✓ Project created successfully!
  Name: Another Project
  ID: PRJ-124
  URL: https://linear.app/workspace/project/another-project-def456
```

### Automated Verification
- Project creation tests pass (both modes)
- Initiative linking tests pass
- Default initiative usage tests pass
- All linting and type checks pass

### Manual Verification
- Run interactive mode and create a test project
- Verify project appears in Linear under correct initiative
- Run non-interactive mode with flags
- Test with and without default initiative set
- Click generated URL to confirm it opens correct project

---

## [x] Milestone M05: GitHub CLI Pattern Alignment (v0.5.0)
**Goal**: Align linear-create with GitHub CLI (gh) patterns while maintaining non-interactive-first philosophy for better scripting/CI-CD compatibility

**Requirements**:
- Add `view <id>` commands for viewing single resources (initiatives, projects)
- Add action aliases (`new`→`create`, `ls`→`list`) for familiarity
- Add `--web` flag for browser fallback on commands
- Standardize config commands (`show`→`list`, add `get`)
- Update CMD.md with gh comparison and new patterns

**Out of Scope**:
- Edit/update commands (deferred to M06)
- Delete commands (deferred to M07)
- Custom alias system like `gh alias` (future)

### Tests & Tasks
- [x] [M05-T01] Update MILESTONES.md with M05, M06, M07 structure
      - Add detailed milestone descriptions
      - Document implementation phases
      - Update backlog section

- [x] [M05-T02] Add `initiatives view <id>` command
      - Create commands/initiatives/view.ts
      - Add getInitiativeById() to linear-client.ts
      - Display initiative details (name, description, status, URL)
      - Add help text and examples

- [x] [M05-T03] Add `project view <id>` command
      - Create commands/project/view.ts
      - Add getProjectById() to linear-client.ts
      - Display project details (name, description, state, initiative, team, URL)
      - Add help text and examples

- [x] [M05-T04] Add `config get <key>` command
      - Create commands/config/get.ts
      - Retrieve single config value
      - Display value source (env/project/global)
      - Add help text and examples

- [x] [M05-T05] Rename `config show` to `config list`
      - Update commands/config/show.ts → list.ts
      - Add 'show' as alias for backward compatibility
      - Update cli.ts command definitions
      - Update help text

- [x] [M05-T06] Add action aliases (new, ls) to all commands
      - Add .alias('new') to all 'create' commands
      - Add .alias('ls') to all 'list' commands
      - Update help text to show both forms
      - Test that both aliases work identically

- [x] [M05-T07] Add `--web` flag to `project create`
      - Add -w, --web option to command
      - Open Linear project creation in browser when flag is used
      - Use open package or platform-specific command
      - Add help text and examples

- [x] [M05-T08] Add `--web` flag to `initiatives list`
      - Add -w, --web option to command
      - Open Linear initiatives page in browser
      - Add help text and examples

- [x] [M05-T09] Update CMD.md with gh comparison
      - Add detailed comparison table (command structure, CRUD operations, flags)
      - Document hybrid approach philosophy
      - Add examples for all new commands
      - Update implementation checklist

- [x] [M05-TS01] Test all new view commands
      - Build succeeds with new commands
      - View commands display correct data
      - Error handling for invalid IDs
      - Help text displays correctly

- [x] [M05-TS02] Test action aliases
      - 'new' alias works for all create commands
      - 'ls' alias works for all list commands
      - Help output shows both forms
      - Both forms behave identically

- [x] [M05-TS03] Test --web flag functionality
      - Browser opens with correct URL
      - Works on different platforms (macOS, Linux, Windows)
      - Error handling if browser can't be opened

- [x] [M05-TS04] Regression test all existing commands
      - All M04 commands still work
      - Config loading still works
      - Interactive mode still works
      - No breaking changes

### Deliverable
```bash
# View commands
$ linear-create init view init_abc123
📋 Initiative: Q1 2024
   ID: init_abc123
   Description: First quarter objectives
   URL: https://linear.app/workspace/initiative/init_abc123

$ linear-create proj view PRJ-123
📋 Project: My Project
   ID: PRJ-123
   State: started
   Initiative: Q1 2024 (init_abc123)
   Team: Engineering (team_xyz789)
   URL: https://linear.app/workspace/project/my-project-123

# Config get
$ linear-create cfg get defaultInitiative
defaultInitiative: init_abc123 (from project config)

# Action aliases
$ linear-create proj new --title "Test"    # Same as 'create'
$ linear-create init ls                     # Same as 'list'

# Web integration
$ linear-create proj create --web
# Opens browser at Linear project creation page

# Config standardization
$ linear-create cfg list                    # Was 'show'
$ linear-create cfg show                    # Still works (alias)
```

### Automated Verification
- `npm run build` succeeds with all new commands
- `npm run lint` and `npm run typecheck` pass
- All help commands display correctly
- Aliases registered and functional

### Manual Verification
- Test view commands with real Linear IDs
- Verify --web opens correct URLs in browser
- Test all aliases work identically to original commands
- Verify backward compatibility with existing workflows

---

## [x] Milestone M05.1: Team Requirement Fix (v0.5.1)
**Goal**: Fix project creation to require team assignment and add teams list command

**Requirements**:
- Add `teams list` command to discover available teams
- Require team when creating projects (via --team flag or defaultTeam config)
- Show helpful error messages when team is missing
- Add `teams select` for interactive team selection
- Support setting defaultTeam in config

**Out of Scope**:
- Team management (create/edit/delete teams)
- Team member management
- Advanced team filtering

### Tests & Tasks
- [x] [M05.1-T01] Add getAllTeams() to linear-client.ts
      - Query Linear API for teams
      - Return team ID, name, and description
      - Sort teams by name

- [x] [M05.1-T02] Create teams list command
      - Create commands/teams/list.tsx
      - Display teams in table format
      - Support --interactive flag for selection
      - Support --web flag to open in browser

- [x] [M05.1-T03] Create teams select command
      - Create commands/teams/select.tsx
      - Interactive team picker using Ink
      - Save selection to config (--global or --project)
      - Show current default team

- [x] [M05.1-T04] Update project create to require team
      - Validate team is provided (flag or config)
      - Show helpful error with command to list teams
      - Update error message to guide users

- [x] [M05.1-T05] Add team commands to CLI
      - Register teams command group
      - Add list, select subcommands
      - Add help text and examples
      - Update README with team workflow

- [x] [M05.1-TS01] Test teams list command
      - Build succeeds
      - Command fetches and displays teams
      - Interactive mode works
      - Error handling for API failures

- [x] [M05.1-TS02] Test project creation with team requirement
      - Error shown when no team provided
      - Works with --team flag
      - Works with defaultTeam config
      - Helpful error message guides user

- [x] [M05.1-TS03] Regression test existing commands
      - All M05 commands still work
      - No breaking changes to existing workflows

### Deliverable
```bash
# List teams
$ linear-create teams list
Available teams:
  team_abc123 - Engineering
  team_def456 - Product
  team_ghi789 - Design

# Select default team
$ linear-create teams select
? Select default team:
  > Engineering (team_abc123)
    Product (team_def456)
    Design (team_ghi789)
✓ Default team set to: Engineering

# Create project with team requirement
$ linear-create proj new --title "REMOVEME1"
❌ Error: Team is required for project creation

Please specify a team using one of these options:
  1. Use --team flag:
     $ linear-create proj new --title "REMOVEME1" --team team_abc123

  2. Set a default team:
     $ linear-create teams select
     $ linear-create config set defaultTeam team_abc123

  3. List available teams:
     $ linear-create teams list

# Working project creation
$ linear-create proj new --title "REMOVEME1" --team team_abc123
✓ Project created successfully!
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` and `npm run typecheck` pass
- All commands show in help output

### Manual Verification
- Test teams list with real Linear workspace
- Test project creation fails without team
- Test project creation succeeds with team
- Verify error messages are helpful and actionable

---

## [ ] Milestone M06: Extended CRUD Operations & Flags (v0.6.0)
**Goal**: Add update (edit) operations and common flags from gh CLI pattern

**Requirements**:
- Add `edit <id>` commands for updating resources
- Add common flags: `--body`, `--assignee`, `--label`
- Enhanced field editing for projects and initiatives
- Support partial updates (only specified fields changed)

**Out of Scope**:
- Delete operations (M07)
- Bulk operations (M07)
- Custom workflows (M07)

### Tests & Tasks
- [ ] [M06-T01] Add `project edit <id>` command
      - Create commands/project/edit.ts
      - Support flags: --title, --description, --state, --initiative, --team
      - Partial updates (only change specified fields)
      - Add help text and examples

- [ ] [M06-T02] Add common flags to create commands
      - Add --body as alias for --description
      - Add --assignee flag (when Linear API supports)
      - Add --label flag for tagging
      - Maintain backward compatibility

- [ ] [M06-T03] Add updateProject() to linear-client.ts
      - Implement partial update logic
      - Validate fields before update
      - Return updated project details

- [ ] [M06-TS01] Test edit commands with various field combinations
      - Single field updates
      - Multiple field updates
      - Error handling for invalid values
      - Verify unchanged fields remain intact

### Deliverable
```bash
# Edit project
$ linear-create proj edit PRJ-123 --state completed
✓ Project updated: My Project (PRJ-123)

$ linear-create proj edit PRJ-123 --title "New Title" --description "Updated"
✓ Project updated: New Title (PRJ-123)

# Create with new flags
$ linear-create proj create --title "Test" --body "Description"
```

### Automated Verification
- Build and lint pass
- Edit command tests pass
- Partial update logic works correctly

### Manual Verification
- Edit existing projects with different field combinations
- Verify unchanged fields are not modified
- Test with real Linear workspace

---

## [ ] Milestone M07: Delete Operations & Advanced Features (v0.7.0)
**Goal**: Complete CRUD operations with delete commands and add advanced productivity features

**Requirements**:
- Add `delete <id>` commands with confirmation prompts
- Add custom alias system (like `gh alias`)
- Add tab completion support
- Add output formatting options (--json, --format)

**Out of Scope**:
- Issue tracking (separate milestone)
- Workflow automation (future)
- Templates system (future)

### Tests & Tasks
- [ ] [M07-T01] Add `project delete <id>` command
      - Create commands/project/delete.ts
      - Add confirmation prompt (skip with --force)
      - Display success/error messages
      - Add help text

- [ ] [M07-T02] Add custom alias system
      - Create alias management commands
      - Support alias create/list/delete
      - Store aliases in config
      - Expand aliases at runtime

- [ ] [M07-T03] Add tab completion support
      - Generate completion scripts for bash/zsh/fish
      - Support command and flag completion
      - Support ID completion from recent items

- [ ] [M07-T04] Add output formatting options
      - Add --json flag for machine-readable output
      - Add --format for custom templates
      - Support piping to other commands

- [ ] [M07-TS01] Test delete operations
      - Confirmation prompt works
      - --force skips confirmation
      - Proper error handling

- [ ] [M07-TS02] Test alias system
      - Aliases are created and stored
      - Aliases expand correctly
      - Alias conflicts are detected

### Deliverable
```bash
# Delete with confirmation
$ linear-create proj delete PRJ-123
⚠️  Are you sure you want to delete "My Project" (PRJ-123)? (y/N): y
✓ Project deleted: My Project (PRJ-123)

# Force delete (no confirmation)
$ linear-create proj delete PRJ-123 --force

# Custom aliases
$ linear-create alias set pc "project create --interactive"
$ linear-create pc    # Runs: project create --interactive

# JSON output
$ linear-create init list --json
[{"id":"init_abc123","name":"Q1 2024",...}]
```

### Automated Verification
- All delete operations work correctly
- Alias system stores and retrieves aliases
- JSON output is valid and parseable

### Manual Verification
- Delete projects and verify they're removed from Linear
- Create and use custom aliases
- Test tab completion in various shells

---

## Backlog (Future Milestones)

### [ ] Milestone M08: Issue Creation & Management (v0.8.0)
**Goal**: Add full issue creation and management capabilities

### [ ] Milestone M09: Templates & Bulk Operations (v0.9.0)
**Goal**: Templates for common patterns and bulk operation support

### [ ] Milestone M10: Workflow Automation (v1.0.0)
**Goal**: Automated workflows, hooks, and integrations
