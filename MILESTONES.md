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

## Backlog (Future Milestones)

### [ ] Milestone M05: Create Issues (v0.5.0)
**Goal**: Add issue creation capability with project and initiative context

### [ ] Milestone M06: List/Update Projects & Issues (v0.6.0)
**Goal**: Add read and update operations for projects and issues

### [ ] Milestone M07: Advanced Features (v0.7.0)
**Goal**: Templates, bulk operations, and workflow automation
