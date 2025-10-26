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

## [x] Milestone M07.2: Milestone Templates System (v0.7.2)
**Goal**: Add milestone template support to automatically create project milestones from local template definitions

**Requirements**:
- Define milestone templates in JSON config files (global and project-level)
- List and view available milestone templates
- Apply templates to projects via `project add-milestones` command
- Support template precedence (project overrides global)
- Configure default milestone template
- Support markdown descriptions for milestones
- Relative date offsets (+1d, +2w, +1m) for milestone dates

**Out of Scope**:
- Creating templates via CLI (M07.3)
- Template variables/substitution
- Milestone editing after creation
- Applying templates during project creation (deferred)

### Tests & Tasks
- [x] [M07.2-T01] Add milestone template types to src/lib/types.ts
      - Add MilestoneDefinition interface
      - Add MilestoneTemplate and MilestoneTemplates interfaces
      - Update Config to include defaultMilestoneTemplate
      - Update ResolvedConfig for milestone template location tracking

- [x] [M07.2-T02] Create src/lib/milestone-templates.ts with core functions
      - Implement loadMilestoneTemplates() with precedence
      - Implement getMilestoneTemplate(name)
      - Implement listMilestoneTemplateNames()
      - Implement validateMilestoneTemplate()
      - Implement parseDateOffset() for relative dates
      - Implement resolveMilestoneDates()

- [x] [M07.2-T03] Add milestone API methods to src/lib/linear-client.ts
      - Add validateProjectExists()
      - Add createProjectMilestone()
      - Add getProjectMilestones()
      - Define MilestoneCreateInput interface

- [x] [M07.2-T04] Create src/commands/milestone-templates/list.ts
      - List templates grouped by source (global vs project)
      - Support --format tsv and json
      - Show milestone count and descriptions

- [x] [M07.2-T05] Create src/commands/milestone-templates/view.ts
      - Display template details with all milestones
      - Show usage examples
      - Include helpful tips

- [x] [M07.2-T06] Create src/commands/project/add-milestones.ts
      - Accept project ID and template name
      - Support alias resolution for both
      - Load template and create milestones sequentially
      - Display progress and results

- [x] [M07.2-T07] Update config system for defaultMilestoneTemplate
      - Add to config/set.ts with validation
      - Add to config/list.ts for display
      - Update all config commands with new key

- [x] [M07.2-T08] Register milestone-templates command group in cli.ts
      - Add milestone-templates group with alias 'mtmpl'
      - Register list and view subcommands
      - Register project add-milestones command
      - Add comprehensive help text

- [x] [M07.2-TS01] Test template loading and precedence
      - Create sample templates in global config
      - Test list command with all formats
      - Test view command
      - Test config set/get for milestone templates

- [x] [M07.2-TS02] Build and verify functionality
      - Build succeeds
      - All commands show in help
      - Lint passes (no errors, only pre-existing warnings)

### Deliverable
```bash
# Create global template file
$ cat ~/.config/linear-create/milestone-templates.json
{
  "templates": {
    "basic-sprint": {
      "name": "Basic Sprint Template",
      "description": "Simple 2-week sprint structure",
      "milestones": [
        {
          "name": "Sprint Planning",
          "description": "Define sprint goals and tasks",
          "targetDate": "+1d"
        },
        {
          "name": "Development",
          "description": "Implementation phase",
          "targetDate": "+10d"
        },
        {
          "name": "Review & Deploy",
          "description": "Code review and deployment",
          "targetDate": "+14d"
        }
      ]
    }
  }
}

# List templates
$ linear-create milestone-templates list
Global Templates (1):
  basic-sprint         - 3 milestones - Simple 2-week sprint structure

# View template
$ linear-create mtmpl view basic-sprint
📋 Milestone Template: Basic Sprint Template
   Description: Simple 2-week sprint structure
   Source: global

   Milestones (3):
   1. Sprint Planning (+1d)
      Define sprint goals and tasks
   2. Development (+10d)
      Implementation phase
   3. Review & Deploy (+14d)
      Code review and deployment

# Set default
$ linear-create config set defaultMilestoneTemplate basic-sprint
🔍 Validating defaultMilestoneTemplate...
   ✓ Milestone template found: Basic Sprint Template (global)
✅ Default Milestone Template saved to global config

# Add milestones to project
$ linear-create project add-milestones PRJ-123 --template basic-sprint
🔍 Validating project: PRJ-123...
   ✓ Project found: My Project
🔍 Loading milestone template: basic-sprint...
   ✓ Template loaded (3 milestones)
🚀 Creating milestones...
   ✓ Created: Sprint Planning
   ✓ Created: Development
   ✓ Created: Review & Deploy
✅ Successfully created 3 milestones for project: My Project
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` passes (no errors)
- Template loading with precedence works
- All commands registered and functional

### Manual Verification
- Create template JSON files manually
- List and view templates
- Set default template in config
- Test with Linear API when available

### Notes
- Templates are stored in local JSON files (not in Linear)
- Template precedence: project overrides global by name
- Milestone `description` field supports full markdown

---

## [x] Milestone M07.3: Template Creation Commands (v0.7.3)
**Goal**: Add commands to create, edit, and manage milestone templates programmatically

**Requirements**:
- Create milestone templates via CLI (interactive and non-interactive)
- Edit existing milestone templates interactively
- Remove milestone templates with confirmation
- Auto-create config directories when needed
- Support markdown descriptions for milestones
- Validate template structure before saving

**Out of Scope**:
- Template variables/substitution
- Template import/export
- Bulk template operations
- Template versioning

### Tests & Tasks
- [x] [M07.3-T01] Add writeTemplatesFile() with auto-create directories to lib/milestone-templates.ts
      - Create parent directories if they don't exist
      - Use mkdirSync with recursive option
      - Write formatted JSON with 2-space indentation

- [x] [M07.3-T02] Add createMilestoneTemplate() function
      - Check for duplicate template names
      - Validate template structure
      - Save to specified scope (global/project)
      - Return success/error result

- [x] [M07.3-T03] Add updateMilestoneTemplate() function
      - Check template exists
      - Validate new template structure
      - Update and save template
      - Return success/error result

- [x] [M07.3-T04] Add removeMilestoneTemplate() function
      - Check template exists
      - Delete from templates object
      - Save updated file
      - Return success/error result

- [x] [M07.3-T05] Create src/commands/milestone-templates/create.ts (non-interactive)
      - Accept template name as argument
      - Parse --description flag
      - Parse multiple --milestone flags (name:date:description format)
      - Validate and create template
      - Show success message

- [x] [M07.3-T06] Create src/commands/milestone-templates/remove.ts
      - Accept template name as argument
      - Show confirmation unless --yes flag
      - Delete template from specified scope
      - Show success message

- [x] [M07.3-T07] Update src/commands/milestone-templates/view.ts for better markdown display
      - Already implemented in M07.2
      - Milestone descriptions display correctly
      - Shows source (global/project)

- [x] [M07.3-T08] Create src/commands/milestone-templates/create-interactive.tsx (interactive)
      - Multi-step React/Ink wizard
      - Prompt for template name and description
      - Scope inherited from flags (--global/--project)
      - Add milestones interactively (name, date, description)
      - Preview template before saving
      - Save and show confirmation

- [x] [M07.3-T09] Create src/commands/milestone-templates/edit-interactive.tsx (interactive)
      - Load existing template
      - Allow modifying template description
      - Allow adding/editing milestones
      - Menu-driven interface
      - Save and show confirmation

- [x] [M07.3-T10] Register commands in cli.ts
      - Add create command with --interactive flag
      - Add remove command with --yes flag
      - Add edit command (interactive only)
      - Update help text with examples

- [x] [M07.3-T11] Update README.md with template creation examples
      - Document non-interactive creation with flags
      - Document interactive creation workflow
      - Show example milestone format with markdown

- [x] [M07.3-TS01] Test template creation
      - Non-interactive mode creates templates
      - Milestones parsed correctly from spec format
      - Templates validated before saving
      - Directories auto-created

- [x] [M07.3-TS02] Test template usage
      - Created template appears in list
      - View command shows details
      - Remove command deletes template
      - Build succeeds with all changes

### Deliverable
```bash
# Non-interactive creation
$ linear-create milestone-templates create basic-sprint \
    --description "Simple 2-week sprint" \
    --milestone "Sprint Planning:+1d:Define goals and scope" \
    --milestone "Development:+10d:Build features and tests" \
    --milestone "Review & Deploy:+14d:Code review and deployment"
📝 Creating milestone template: basic-sprint...
✅ Milestone template created successfully!
   Name: basic-sprint
   Location: global
   Milestones: 3

# With markdown
$ linear-create mtmpl create detailed-sprint \
    --milestone "Planning:+1d:## Goals\n- Set objectives\n- Estimate effort"

# Interactive creation
$ linear-create milestone-templates create --interactive
Create Milestone Template
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Template name: agile-sprint
Description (optional): Standard 2-week agile sprint
Save to: Global

Milestone 1:
Name: Sprint Planning
Target date: +1d
Description (markdown): ## Planning\n- Review backlog\n- Set goals
✓ Added: Sprint Planning

Add another milestone? Yes
...

# Remove template
$ linear-create mtmpl remove old-template --force
✅ Template "old-template" removed from global config

# Edit template interactively
$ linear-create mtmpl edit basic-sprint
[Interactive wizard to modify template]
```

### Automated Verification
- `npm run build` succeeds
- All template creation commands work
- Templates validate before saving
- Directories auto-create

### Manual Verification
- Create templates via CLI
- Edit templates interactively
- Remove templates
- Use created templates with add-milestones
- Verify markdown renders in Linear

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

## [x] Milestone M08: Configurable Cache & Project Status Management (v0.8.0)
**Goal**: Make project cache configurable and add org-wide project status caching

**Requirements**:
- Configurable cache TTL in minutes (default: 60)
- Flat org-wide project status cache
- Status resolution by name, ID, or alias

**Out of Scope**:
- Team-scoped caching
- Multiple cache backends
- Cache warming strategies

### Tests & Tasks
- [x] [M08-T01] Add projectCacheMinTTL to Config type in types.ts
      - Add `projectCacheMinTTL?: number` to Config interface
      - Add to ResolvedConfig locations
      - Document default value (60 minutes)

- [x] [M08-T02] Update config.ts to handle projectCacheMinTTL
      - Add to VALID_CONFIG_KEYS array
      - Add location tracking in getConfig()
      - Implement default value (60)

- [x] [M08-T03] Modify project-resolver.ts to use configurable TTL
      - Replace CACHE_TTL_MS constant with dynamic config lookup
      - Convert minutes to milliseconds: `getConfig().projectCacheMinTTL * 60 * 1000`
      - Fallback to 60 minutes if not configured

- [x] [M08-T04] Add validation for projectCacheMinTTL in setConfig
      - Minimum: 1 minute
      - Maximum: 1440 minutes (24 hours)
      - Must be positive integer
      - Show error for invalid values

- [x] [M08-T05] Update CLI config commands to include projectCacheMinTTL
      - Add to config get/set/unset choices
      - Update help text documentation
      - Add examples in addHelpText

- [x] [M08-T06] Update config list to display TTL in human-readable format
      - Show as "60 minutes" not just "60"
      - Include in config list output

- [x] [M08-T07] Create status-cache.ts with flat array structure
      - Define ProjectStatusCacheEntry interface
      - Implement load/save functions
      - Implement findByName (case-insensitive)
      - Implement findById
      - Use projectCacheMinTTL for expiry

- [x] [M08-T08] Add getAllProjectStatuses() to linear-client.ts
      - Query: organization.projectStatuses
      - Return: id, name, type, color, position
      - Handle pagination if needed

- [x] [M08-T09] Implement resolveProjectStatus() function
      - Check if input is ID → return as-is
      - Check aliases → return resolved ID
      - Check cache by name → return ID
      - Refresh cache if expired
      - Return null if not found

- [x] [M08-TS01] Test cache uses configured TTL
- [x] [M08-TS02] Test validation rejects invalid TTL values
- [x] [M08-TS03] Test default is 60 minutes
- [x] [M08-TS04] Test status cache flat structure
- [x] [M08-TS05] Test case-insensitive name lookup

### Deliverable
```bash
$ linear-create config set projectCacheMinTTL 120
✅ projectCacheMinTTL updated (global config)

$ linear-create config list
📋 Configuration (merged from all sources)

   projectCacheMinTTL: 120 minutes (global)
   apiKey: lin_***_xyz (env)
   defaultTeam: team_abc123 (project)
```

### Automated Verification
- `npm run build` succeeds
- `npm run lint` passes
- Config validation works

### Manual Verification
- Set cache TTL and verify it's used
- Test status cache stores flat array
- Verify case-insensitive lookup works

---

## [x] Milestone M09: Project Update Command (v0.9.0)
**Goal**: Add project update command with status resolution

**Requirements**:
- Update project properties (status, name, description, priority, dates)
- Resolve project by name, ID, or alias
- Resolve status by name, ID, or alias
- Show before/after summary

**Out of Scope**:
- Bulk project updates
- Transaction rollback
- Update history tracking

### Tests & Tasks
- [x] [M09-T01] Create src/commands/project/update.ts
      - Resolve project using resolveProject()
      - Resolve status using resolveProjectStatus()
      - Validate at least one field provided
      - Call updateProject() with changes
      - Show before/after summary

- [x] [M09-T02] Add updateProject() to linear-client.ts
      - Define ProjectUpdateInput interface
      - Implement projectUpdate mutation
      - Support: statusId, name, description, priority, startDate, targetDate
      - Return updated project details

- [x] [M09-T03] Add project update CLI command
      - Command: `project update <name-or-id>`
      - Options: --status, --name, --description, --priority, --target-date, --start-date
      - Follow existing CLI patterns
      - Add comprehensive help text with examples

- [x] [M09-T04] Validate priority range (0-4)
- [x] [M09-T05] Show confirmation of changes

- [x] [M09-TS01] Test update status by name
- [x] [M09-TS02] Test update status by ID
- [x] [M09-TS03] Test update multiple fields
- [x] [M09-TS04] Test error when no fields provided
- [x] [M09-TS05] Test priority validation

### Deliverable
```bash
$ linear-create proj update "Q1 Goals" --status "In Progress" --priority 2

🔍 Resolving project "Q1 Goals"...
   ✓ Found project by name

🔍 Resolving status "In Progress"...
   ✓ Found status by name

📝 Updating project...
   Status: Backlog → In Progress
   Priority: 0 → 2

✅ Project updated successfully!
```

### Automated Verification
- `npm run build` succeeds
- Command appears in help text
- Validation works correctly

### Manual Verification
- Update various project properties
- Test status resolution by name
- Verify changes persist in Linear

---

## [x] Milestone M10: Project Status Resource Group (v0.9.0)
**Goal**: Add project-status commands following existing CLI patterns

**Requirements**:
- List all project statuses
- View specific status details
- Support --web, --format flags
- Follow teams/initiatives command structure

**Out of Scope**:
- Creating custom statuses (Linear UI only)
- Deleting statuses
- Reordering statuses

### Tests & Tasks
- [x] [M10-T01] Create src/commands/project-status/list.ts
      - Fetch via getAllProjectStatuses()
      - Display table: Name, Type, ID
      - Support --format tsv/json
      - Support --web to open settings

- [x] [M10-T02] Create src/commands/project-status/view.ts
      - Resolve status by ID or alias
      - Display full status details
      - Support --web flag

- [x] [M10-T03] Add project-status CLI group to cli.ts
      - Resource group: `project-status` (alias: `pstatus`)
      - Commands: list, view
      - Follow teams/initiatives pattern exactly
      - Add comprehensive help text

- [x] [M10-TS01] Test listing shows all statuses
- [x] [M10-TS02] Test JSON output format
- [x] [M10-TS03] Test TSV output format
- [x] [M10-TS04] Test view command

### Deliverable
```bash
$ linear-create project-status list

📋 Project Statuses (5)

   NAME            TYPE        ID
   Backlog         planned     status_abc123
   In Progress     started     status_def456
   In Review       started     status_ghi789
   Done            completed   status_jkl012
   Canceled        canceled    status_mno345

$ linear-create pstatus ls --format json | jq '.[0]'
{
  "id": "status_abc123",
  "name": "Backlog",
  "type": "planned"
}
```

### Automated Verification
- Commands appear in help
- Format options work
- Build succeeds

### Manual Verification
- List matches Linear UI
- View shows correct details
- Web flag opens Linear settings

---

## [x] Milestone M11: Sync Project Status Aliases (v0.10.0)
**Goal**: Auto-create aliases for all org project statuses

**Requirements**:
- Sync all statuses to aliases
- Default to dry-run preview
- Support --global, --project, --force flags
- Follow existing alias command patterns

**Out of Scope**:
- Selective sync (all or nothing)
- Custom alias naming rules
- Auto-sync on status changes

### Tests & Tasks
- [x] [M11-T01] Add projectStatuses to Aliases type
      - Add `projectStatuses: AliasMap` to types.ts
      - Update ResolvedAliases to include projectStatuses locations

- [x] [M11-T02] Update aliases.ts to handle project-status
      - Add 'project-status' to AliasEntityType
      - Update normalizeEntityType()
      - Update getAliasesKey() to map to 'projectStatuses'
      - Update loadAliases() to merge projectStatuses

- [x] [M11-T03] Create src/commands/project-status/sync-aliases.ts
      - Fetch all statuses via getAllProjectStatuses()
      - Generate slug: lowercase, spaces→hyphens
      - Check for existing aliases (warn unless --force)
      - Default to --dry-run if neither --global nor --project specified
      - Create aliases for each status
      - Show summary of created aliases

- [x] [M11-T04] Add sync-aliases CLI command
      - Add to project-status group
      - Options: --global, --project, --dry-run, --force
      - Comprehensive help with examples

- [x] [M11-T05] Update alias commands to include project-status
      - Add to all alias command type choices
      - Update help text
      - Update validation

- [x] [M11-TS01] Test slug generation
- [x] [M11-TS02] Test conflict detection
- [x] [M11-TS03] Test dry-run doesn't create
- [x] [M11-TS04] Test force overwrites
- [x] [M11-TS05] Test aliases work in project update

### Deliverable
```bash
$ linear-create pstatus sync-aliases

🔍 Fetching project statuses...
   Found 5 statuses

📋 Preview: The following aliases would be created
   (specify --global or --project to create):

   backlog      → status_abc123 (Backlog)
   in-progress  → status_def456 (In Progress)
   in-review    → status_ghi789 (In Review)
   done         → status_jkl012 (Done)
   canceled     → status_mno345 (Canceled)

⚠️  No conflicts detected

$ linear-create pstatus sync-aliases --global
✅ Created 5 project status aliases (global)

$ linear-create proj update "My Project" --status in-progress
🔍 Resolving status "in-progress"...
   ✓ Resolved alias: in-progress → status_def456
✅ Project updated
```

### Automated Verification
- Build succeeds
- Aliases created correctly
- Validation works

### Manual Verification
- Sync creates correct slugs
- Conflicts detected properly
- Aliases work in commands

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

## Backlog (Future Milestones)

### [ ] Milestone M13: Issue Creation & Management (v0.13.0)
**Goal**: Add full issue creation and management capabilities with label and workflow state support

### [ ] Milestone M14: Bulk Operations & Advanced Filtering (v0.14.0)
**Goal**: Bulk operations and advanced filtering support for all entity types

### [ ] Milestone M15: Workflow Automation (v1.0.0)
**Goal**: Automated workflows, hooks, and integrations
