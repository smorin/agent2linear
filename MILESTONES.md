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

## [x] Milestone M05.2: Interactive Config Management (v0.5.2)
**Goal**: Add interactive config editing and enhance help documentation following GitHub CLI patterns

**Requirements**:
- Add `config edit` command for interactive multi-value configuration editing
- Support both interactive (default) and non-interactive modes with flags
- Ask for scope (global/project) once at session start
- Integrate with existing initiative and team selectors
- Enhance config help text to show available settings (following gh pattern)

**Out of Scope**:
- Encrypted config storage (future)
- Config validation on startup (future)
- Config migration tools (future)

### Tests & Tasks
- [x] [M05.2-T01] Create config edit command with interactive UI
      - Create src/commands/config/edit.tsx
      - Build multi-step Ink component
      - Prompt for scope (global/project) if not specified via flag
      - For each setting: show current value, offer keep/change/clear options
      - Integrate with InitiativeList and TeamList components

- [x] [M05.2-T02] Support non-interactive mode with flags
      - Add --key and --value flags for direct editing
      - Add --global and --project flags for scope selection
      - Validate values before saving (reuse existing validation)
      - Show appropriate error messages

- [x] [M05.2-T03] Enhance config command help text
      - Add "Current respected settings" section (gh style)
      - Document configuration files and priority
      - Add examples for all subcommands including edit
      - Link to Linear API key page
      - Add related commands section

- [x] [M05.2-T04] Register command and update CLI
      - Import editConfig in src/cli.ts
      - Register config edit command with all flags
      - Update config group help text
      - Add comprehensive examples

- [x] [M05.2-TS01] Test interactive mode
      - Full multi-step flow works
      - Scope selection (or skip with flag)
      - API key editing with validation
      - Initiative selection integration
      - Team selection integration
      - Changes saved correctly

- [x] [M05.2-TS02] Test non-interactive mode
      - --key and --value flags work
      - Validation errors shown appropriately
      - Works with --global and --project
      - Error when --value missing with --key

- [x] [M05.2-TS03] Regression test
      - All existing config commands still work
      - Build succeeds
      - Lint and typecheck pass
      - Help text displays correctly

### Deliverable
```bash
# Interactive mode
$ linear-create config edit
? Configuration scope for this session: global
? API Key [lin_***_xyz]:
  > Keep current
    Change API key
    Clear API key
? Default Initiative [Q1 2024]:
  > Keep current
    Change (select from list)
    Clear
? Default Team [Engineering]:
  > Keep current
    Change (select from list)
    Clear
✓ Configuration updated (global)

# Non-interactive mode
$ linear-create config edit --global --key apiKey --value lin_api_new123
🔍 Validating apiKey...
   Testing API connection...
   ✓ API key is valid

✅ API Key updated (global config)

# Enhanced help
$ linear-create config --help
Manage configuration settings for linear-create.

Current respected settings:
- `apiKey`: Linear API authentication key (get yours at linear.app/settings/api)
- `defaultInitiative`: Default initiative ID for project creation (format: init_xxx)
- `defaultTeam`: Default team ID for project creation (format: team_xxx)
...
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` and `npm run typecheck` pass
- config edit command shows in help

### Manual Verification
- Run interactive mode and edit multiple config values
- Test scope selection
- Test integration with initiative/team selectors
- Test non-interactive mode with various flags
- Verify help text matches gh style

---

## [x] Milestone M06: Entity Aliases System (v0.6.0)
**Goal**: Add transparent aliasing system for initiatives, teams, and projects to simplify working with long Linear IDs

**Requirements**:
- Support both global (`~/.config/linear-create/aliases.json`) and project-level (`.linear-create/aliases.json`) alias storage
- Create dedicated alias management commands (add, list, remove, get)
- Aliases are scoped by entity type (same alias can be used for initiative and team)
- Transparent resolution: aliases work wherever IDs are accepted, no special syntax required
- Validation on alias creation to ensure target entities exist
- Optional validation command to check for broken aliases

**Out of Scope**:
- Command aliases (like `gh alias`) - planned for M08
- Auto-suggestion of aliases when using IDs
- Bulk alias operations

### Tests & Tasks
- [x] [M06-T01] Create alias types and core infrastructure
      - Add AliasEntityType, AliasMap, Aliases types to types.ts
      - Create lib/aliases.ts with core functions
      - Implement loadAliases() with precedence (project > global)
      - Implement resolveAlias() for transparent resolution

- [x] [M06-T02] Implement alias add command
      - Create commands/alias/add.ts
      - Validate entity exists via Linear API
      - Support --global and --project flags
      - Check for duplicate aliases
      - Display success with entity name

- [x] [M06-T03] Implement alias list command
      - Create commands/alias/list.ts
      - Display all aliases grouped by type
      - Support filtering by entity type
      - Show location (global vs project) for each alias
      - Add --validate flag to check broken aliases

- [x] [M06-T04] Implement alias remove and get commands
      - Create commands/alias/remove.ts
      - Create commands/alias/get.ts
      - Support scope flags for removal
      - Display helpful error messages

- [x] [M06-T05] Register alias commands in CLI
      - Add alias command group to cli.ts
      - Register add, list, remove, get subcommands
      - Add comprehensive help text with examples

- [x] [M06-T06] Integrate resolver into initiatives commands
      - Update initiatives/set.ts to resolve aliases
      - Update initiatives/view.ts to resolve aliases
      - Display message when alias is resolved

- [x] [M06-T07] Integrate resolver into project and team commands
      - Update project/create.tsx for --initiative and --team flags
      - Update teams/select.tsx to resolve team aliases
      - Handle alias resolution in both interactive and non-interactive modes

- [x] [M06-TS01] Test alias creation and resolution
      - Build succeeds with all new code
      - Alias commands registered and functional
      - Help text displays correctly
      - List shows "no aliases" message when empty

- [x] [M06-TS02] Test transparent resolution
      - Aliases work in place of IDs
      - Non-aliases (actual IDs) still work
      - Resolution messages display correctly
      - Both global and project aliases work

- [x] [M06-TS03] Update documentation
      - Add alias section to README.md
      - Document all alias commands with examples
      - Explain storage locations and precedence
      - Show usage examples in various commands

### Deliverable
```bash
# Add aliases
$ linear-create alias add initiative backend init_abc123xyz
✅ Alias added successfully!
   Alias: backend
   Initiative ID: init_abc123xyz
   Name: Backend Infrastructure
   Scope: global

$ linear-create alias add team engineering team_def456uvw --project
✅ Alias added successfully!

# List aliases
$ linear-create alias list
Initiative Aliases (2):
  [global]  backend              → init_abc123xyz
  [project] frontend             → init_def456uvw

Team Aliases (1):
  [project] engineering          → team_ghi789rst

Total: 3 alias(es)

# Use aliases transparently
$ linear-create initiatives set backend
📎 Resolved alias "backend" to init_abc123xyz
🔍 Validating initiative ID: init_abc123xyz...
   ✓ Initiative found: Backend Infrastructure
✅ Default initiative set to: Backend Infrastructure

$ linear-create project create --title "Test" --team engineering --initiative backend
📎 Resolved team alias "engineering" to team_ghi789rst
📎 Resolved initiative alias "backend" to init_abc123xyz
🚀 Creating project...
✅ Project created successfully!

# Validate aliases
$ linear-create alias list --validate
✅ All 3 aliases are valid!

# Get alias details
$ linear-create alias get initiative backend
Alias: backend
ID: init_abc123xyz
Type: initiative
Location: global
```

### Automated Verification
- `npm run build` succeeds with all alias functionality
- `npm run lint` and `npm run typecheck` pass
- All alias commands registered in help output
- Transparent resolution works in all integrated commands

### Manual Verification
- Create aliases for initiatives, teams, and projects
- Use aliases in place of IDs in various commands
- Test precedence: project aliases override global aliases
- Verify validation catches non-existent entities
- Test with AI agents to confirm simplified ID tracking

---

## [x] Milestone M06.1: Interactive Alias Edit Command (v0.6.1)
**Goal**: Add interactive alias editing command for easier bulk management, mirroring config edit pattern

**Requirements**:
- Interactive-only command with multi-step flow for editing aliases
- Support scope pre-selection with --global/--project flags
- Actions: Keep / Change ID / Rename / Delete
- Real-time validation with Linear API
- Can edit multiple aliases in one session

**Out of Scope**:
- Non-interactive mode (use existing alias add/remove for that)
- Bulk operations across multiple aliases simultaneously
- Auto-migration of broken aliases

### Tests & Tasks
- [x] [M06.1-T01] Create src/commands/alias/edit.tsx with React/Ink components
      - Implement AliasEditor component with multi-step flow
      - Steps: scope selection → entity type → display aliases → select alias → choose action
      - Show current alias name and ID when editing
      - Actions: Keep / Change ID / Rename alias / Delete
      - Real-time validation with Linear API

- [x] [M06.1-T02] Add helper functions to lib/aliases.ts
      - Add updateAliasId(type, alias, newId, scope) - change what an alias points to
      - Add renameAlias(type, oldName, newName, scope) - change the alias name itself
      - Both include validation

- [x] [M06.1-T03] Register command in cli.ts
      - Add edit subcommand to alias command group
      - Support --global/--project flags for pre-selecting scope
      - Add comprehensive help text with examples
      - Note in help: For non-interactive use, use alias remove + alias add

- [x] [M06.1-T04] Update documentation
      - Add examples to README.md
      - Update MILESTONES.md with completion

- [x] [M06.1-TS01] Test interactive mode
      - Build and lint succeed
      - Can edit multiple aliases in one session
      - Validation catches errors properly
      - Scope pre-selection works with flags

### Deliverable
```bash
# Interactive mode - edit multiple aliases
$ linear-create alias edit
Select alias scope to edit:
> Global (~/.config/linear-create/aliases.json)
  Project (.linear-create/aliases.json)

Select entity type:
> Initiative aliases
  Team aliases
  Project aliases

Select alias to edit (global initiative):
> backend → init_abc123xyz
  frontend → init_def456uvw

What would you like to do with "backend"?
> Keep "backend" (edit another)
  Change ID (currently: init_abc123xyz)
  Rename alias (currently: backend)
  Delete alias "backend"

# Pre-select scope
$ linear-create alias edit --project
```

### Automated Verification
- `npm run build` succeeds with all alias edit functionality
- `npm run lint` and `npm run typecheck` pass
- Edit command registered in help output
- Interactive flow works correctly

### Manual Verification
- Edit aliases interactively with all actions (change ID, rename, delete)
- Edit multiple aliases in one session
- Test scope pre-selection with flags
- Verify validation catches errors properly

---

## [x] Milestone M07: Templates Management (v0.7.0)
**Goal**: Add template browsing and configuration support for issues and projects

**Requirements**:
- List all templates from Linear API (issue templates)
- View template details
- Configure default templates for issue and project creation
- Integration with config system for default templates
- Support template filtering by type

**Out of Scope**:
- Template creation/editing (managed in Linear web app)
- Project templates (not yet available in Linear SDK)
- Custom local templates

### Tests & Tasks
- [x] [M07-T01] Add Template types to lib/types.ts
      - Add Template interface with id, name, type, description
      - Update Config interface with defaultIssueTemplate and defaultProjectTemplate
      - Update ResolvedConfig with template location tracking

- [x] [M07-T02] Add template API methods to linear-client.ts
      - Implement getAllTemplates() to fetch templates from Linear
      - Implement getTemplateById() to fetch single template
      - Support type filtering (issue/project)
      - Handle API differences between issue and project templates

- [x] [M07-T03] Create templates list command
      - Create commands/templates/list.tsx
      - Support non-interactive, interactive, and web modes
      - Filter by template type (issues/projects)
      - Display template details in formatted output

- [x] [M07-T04] Create templates view command
      - Create commands/templates/view.ts
      - Display template details (name, type, description)
      - Show usage tips for setting as default

- [x] [M07-T05] Update config system for templates
      - Add defaultIssueTemplate and defaultProjectTemplate to config
      - Update config get/set/unset commands
      - Add validation for template types

- [x] [M07-T06] Register templates command group
      - Add templates command group with alias 'tmpl'
      - Register list and view subcommands
      - Add comprehensive help text with examples

- [x] [M07-T07] Integrate templates with project create
      - Add --template flag to project create command
      - Support default template from config
      - Validate template type matches

- [x] [M07-TS01] Test build and verify functionality
      - Build succeeds
      - All template commands show in help
      - Config commands support template keys

### Deliverable
```bash
# List templates
$ linear-create templates list
Issue Templates (3):
  template_abc123  - Bug Report - Standard bug report template
  template_def456  - Feature Request - New feature template
  template_ghi789  - Spike - Research spike template

# View template
$ linear-create templates view template_abc123
📋 Template: Bug Report
   ID: template_abc123
   Type: issue
   Description: Standard bug report template

💡 Use this template:
   $ linear-create issues create --template template_abc123

   Set as default:
   $ linear-create config set defaultIssueTemplate template_abc123

# Set default template
$ linear-create config set defaultProjectTemplate template_xyz789
🔍 Validating defaultProjectTemplate...
   ✓ Template found: Standard Project (project)
✅ Default Project Template saved to global config

# Create project with template
$ linear-create project create --title "New API" --template template_xyz789 --team team_abc
📎 Resolved team alias "team_abc" to team_123abc
🔍 Validating template: template_xyz789...
   ✓ Template found: Standard Project
✅ Project created successfully!
```

### Automated Verification
- `npm run build` succeeds
- Templates command registered and functional
- Config commands support template keys
- Help text displays correctly

### Manual Verification
- List templates from Linear workspace
- View template details
- Set default templates in config
- Use templates when creating projects (when supported)

### Notes
- Project templates are not yet available in the Linear SDK (as of v61.0.0)
- Template code includes placeholders for future project template support
- Currently only issue templates are functional via the API

---

## [x] Milestone M07.1: Template Alias Support (v0.7.0)
**Goal**: Add full alias support for issue and project templates with same capabilities as other entity types

**Requirements**:
- Support both issue-template and project-template as separate alias entity types
- Full CRUD operations (add, remove, get, list, validate, update, rename)
- Interactive edit support with entity selection
- Template type validation (ensure issue templates only alias issue templates, etc.)
- Complete parity with existing alias functionality

**Out of Scope**:
- Template creation/editing (managed in Linear web app)
- Bulk alias operations
- Alias import/export

### Tests & Tasks
- [x] [M07.1-T01] Update type definitions in src/lib/types.ts
      - Add 'issue-template' and 'project-template' to AliasEntityType
      - Add issueTemplates and projectTemplates to Aliases interface
      - Update ResolvedAliases to include template alias locations

- [x] [M07.1-T02] Update core alias library in src/lib/aliases.ts
      - Update getEmptyAliases() to include template alias maps
      - Extend normalizeEntityType() to handle template variants
      - Add getAliasesKey() cases for both template types
      - Update loadAliases() to merge and track template alias locations
      - Extend looksLikeLinearId() to recognize template_ prefix
      - Add template validation using getTemplateById()
      - Validate template type matches alias type
      - Update validateAllAliases() to check template aliases

- [x] [M07.1-T03] Update CLI command definitions in src/cli.ts
      - Add template types to alias add command choices
      - Add template types to alias remove command choices
      - Add template types to alias get command choices
      - Update help text with template examples
      - Update alias description to mention templates

- [x] [M07.1-T04] Update interactive edit component in src/commands/alias/edit.tsx
      - Import getAllTemplates and getTemplateById
      - Add template state management (templates, loading, error)
      - Add "Issue Template aliases" and "Project Template aliases" to type menu
      - Update handleIdSubmit to validate template IDs
      - Update handleNewAliasNameSubmit to fetch templates by type
      - Update entity selection to display templates
      - Update key resolution logic in all handlers
      - Support all CRUD operations for template aliases

- [x] [M07.1-TS01] Build and verify functionality
      - Build succeeds without errors
      - Help text displays template options
      - All commands accept template types

### Deliverable
```bash
# Add template aliases
$ linear-create alias add issue-template bug-report template_abc123
🔍 Adding alias "bug-report" for issue-template...
   Validating issue-template ID: template_abc123...

✅ Alias added successfully!
   Alias: bug-report
   Issue-template ID: template_abc123
   Name: Bug Report Template
   Scope: global

💡 Use this alias in place of the issue-template ID in any command

$ linear-create alias add project-template sprint template_xyz789 --project

# List template aliases
$ linear-create alias list issue-templates

Issue Template Aliases (2):

  bug-report → template_abc123
    Bug Report Template (template_abc123) (from global)
  feature → template_def456
    Feature Template (template_def456) (from global)

$ linear-create alias list project-templates

Project Template Aliases (1):

  sprint → template_xyz789
    Sprint Template (template_xyz789) (from project)

# Interactive edit
$ linear-create alias edit
Select alias scope to edit:
  Global (~/.config/linear-create/aliases.json)
  Project (.linear-create/aliases.json)

Select entity type:
  Initiative aliases
  Team aliases
  Project aliases
  Issue Template aliases
  Project Template aliases

# Use template alias in commands
$ linear-create config set defaultIssueTemplate bug-report
📋 Resolved alias "bug-report" to template_abc123
✅ Default Issue Template saved to global config

$ linear-create config set defaultProjectTemplate sprint
📋 Resolved alias "sprint" to template_xyz789
✅ Default Project Template saved to project config
```

### Automated Verification
- `npm run build` succeeds without errors
- All alias commands support template types
- Interactive edit includes template options
- Template validation works correctly

### Manual Verification
- Add issue template aliases
- Add project template aliases
- List template aliases separately
- Edit template aliases interactively
- Validate template type matching
- Use template aliases in config commands

### Notes
- Template aliases support both issue and project templates as separate types
- Template type validation ensures issue templates only alias issue templates
- All existing alias operations work seamlessly with templates
- Template aliases can be used anywhere template IDs are accepted

---

## [ ] Milestone M08: Extended CRUD Operations & Flags (v0.8.0)
**Goal**: Add update (edit) operations and common flags from gh CLI pattern

**Requirements**:
- Add `edit <id>` commands for updating resources
- Add common flags: `--body`, `--assignee`, `--label`
- Enhanced field editing for projects and initiatives
- Support partial updates (only specified fields changed)

**Out of Scope**:
- Delete operations (M09)
- Bulk operations (M09)
- Custom workflows (M10)

### Tests & Tasks
- [ ] [M08-T01] Add `project edit <id>` command
      - Create commands/project/edit.ts
      - Support flags: --title, --description, --state, --initiative, --team
      - Partial updates (only change specified fields)
      - Add help text and examples

- [ ] [M08-T02] Add common flags to create commands
      - Add --body as alias for --description
      - Add --assignee flag (when Linear API supports)
      - Add --label flag for tagging
      - Maintain backward compatibility

- [ ] [M08-T03] Add updateProject() to linear-client.ts
      - Implement partial update logic
      - Validate fields before update
      - Return updated project details

- [ ] [M08-TS01] Test edit commands with various field combinations
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

## [ ] Milestone M09: Delete Operations & Advanced Features (v0.9.0)
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
- [ ] [M08-T01] Add `project delete <id>` command
      - Create commands/project/delete.ts
      - Add confirmation prompt (skip with --force)
      - Display success/error messages
      - Add help text

- [ ] [M08-T02] Add command alias system (like gh alias)
      - Create command alias management commands
      - Support alias create/list/delete
      - Store command aliases in config
      - Expand aliases at runtime
      - Note: Different from entity aliases in M06

- [ ] [M08-T03] Add tab completion support
      - Generate completion scripts for bash/zsh/fish
      - Support command and flag completion
      - Support ID completion from recent items

- [ ] [M08-T04] Add output formatting options
      - Add --json flag for machine-readable output
      - Add --format for custom templates
      - Support piping to other commands

- [ ] [M08-TS01] Test delete operations
      - Confirmation prompt works
      - --force skips confirmation
      - Proper error handling

- [ ] [M08-TS02] Test command alias system
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

### [ ] Milestone M10: Issue Creation & Management (v0.10.0)
**Goal**: Add full issue creation and management capabilities

### [ ] Milestone M11: Bulk Operations & Advanced Filtering (v0.11.0)
**Goal**: Bulk operations and advanced filtering support

### [ ] Milestone M12: Workflow Automation (v1.0.0)
**Goal**: Automated workflows, hooks, and integrations
