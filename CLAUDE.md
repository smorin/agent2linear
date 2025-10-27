# linear-create - Linear CLI Tool

  ## Project Overview
  **linear-create** is a TypeScript-based command-line tool for creating and managing Linear projects, issues, labels, workflow states, and other entities via the Linear GraphQL API.

  **Technology Stack:**
  - TypeScript (ES2022, ESNext modules)
  - Commander.js (CLI framework)
  - Ink (React-based terminal UI for interactive modes)
  - Linear SDK (@linear/sdk)
  - Build: tsup (TypeScript bundler)
  - Task runner: turbo

  ## Prerequisites & Setup

  ### Required Environment Variables
  ```bash
  export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx

  Installation & Build

  npm install
  npm run build

  Running the CLI

  # After build
  linear-create --help

  # Or via node directly
  node dist/index.js --help

  Development Workflow

  Build Commands

  npm run build        # Production build (tsup)
  npm run dev          # Watch mode for development
  npm run lint         # ESLint check
  npm run typecheck    # TypeScript type checking
  npm run format       # Prettier formatting

  Architecture

  - Entry point: src/index.ts → compiles to dist/index.js (with shebang)
  - CLI definition: src/cli.ts - all command registration
  - Commands: src/commands/<entity>/<action>.ts(x) (.tsx for Ink components)
  - Libraries: src/lib/ - shared utilities (aliases, config, linear-client, etc.)
  - Types: src/lib/types.ts - TypeScript interfaces for all entities

  Testing

  Test Suite Location

  All tests are in tests/scripts/ directory.

  Test Philosophy

  Integration tests using real Linear API, NOT unit tests.

  Tests create actual Linear entities with TEST_<timestamp>_ prefix and generate cleanup scripts (since delete commands aren't fully implemented yet).

  Running Tests

  Prerequisites

  1. LINEAR_API_KEY environment variable must be set
  2. Project must be built: npm run build
  3. Linear workspace should have at least one team

  Run All Tests

  cd tests/scripts
  ./run-all-tests.sh

  Run Individual Test Suites

  # Project create tests (~45 test cases)
  ./test-project-create.sh

  # Project update tests (~35 test cases)
  ./test-project-update.sh

  # Run specific test range
  ./test-project-create.sh --test 5      # Run only test #5
  ./test-project-create.sh --range 10-20 # Run tests 10-20

  Test Coverage

  - ✅ All CLI flags and options
  - ✅ Alias resolution for all entity types (teams, initiatives, statuses, members, labels)
  - ✅ Multi-value fields (labels, members, links)
  - ✅ Content handling (inline vs file)
  - ✅ Date/priority/visual properties
  - ✅ Complex multi-field combinations
  - ✅ Error validation and edge cases
  - ✅ Project resolution (name/ID/alias)

  Test Output & Cleanup

  Tests create real Linear projects but do not auto-delete them. After running tests:

  # Cleanup scripts are auto-generated
  ./cleanup-create-projects.sh  # Lists projects to delete
  ./cleanup-update-projects.sh  # Lists updated projects
  ./cleanup-all-projects.sh     # Combined cleanup

  # Note: Currently requires manual deletion via Linear UI
  # (Waiting for 'project delete' command implementation)

  Verification Process

  When implementing new features or fixing bugs:
  1. Build: npm run build must succeed
  2. Type Check: npm run typecheck must pass
  3. Lint: npm run lint must pass (no new errors)
  4. Integration Tests: Run relevant test suite
  5. Manual Testing: Test interactive modes (-I flag) manually

  Project Milestones

  Active Milestones

  See MILESTONES.md for current and future milestones.

  Completed Milestones

  See archive/MILESTONES_01.md for milestones M01-M13 (v0.1.0 through v0.13.1).

  Milestone Format

  Each milestone follows this structure:
  - Status: [x] Completed, [-] In Progress, [ ] Not Started, [~] Won't fix
  - Goal: What functionality is being delivered
  - Requirements: Detailed requirements
  - Out of Scope: Explicitly excluded items
  - Tests & Tasks: Individual tasks with IDs (e.g., M12-T01, M12-TS01)
  - Deliverable: Example CLI usage
  - Automated Verification: Build, lint, typecheck requirements
  - Manual Verification: Human testing checklist

  Current Version

  v0.13.1 - Bug fixes from analysis

  In Progress

  M12: Metadata Commands - Labels, workflow states, icons & colors (v0.12.0)

  Key Features

  Aliases System

  Aliases allow using simple names instead of Linear IDs:
  - Storage: ~/.config/linear-create/aliases.json (global) or .linear-create/aliases.json (project)
  - Supported entities: teams, initiatives, project-statuses, members, workflow-states, issue-labels, project-labels
  - Commands: alias add/list/remove/get/edit/sync
  - Usage: Aliases can be used anywhere an ID is expected

  Milestone Templates

  Reusable milestone templates for projects:
  - Storage: ~/.config/linear-create/milestone-templates.json (global) or .linear-create/milestone-templates.json (project)
  - Format: JSON with name, description, milestones array
  - Commands: milestone-templates create/list/view/edit/remove
  - Application: project add-milestones <project> --template <name>

  Configuration

  Persistent defaults for common values:
  - Storage: ~/.config/linear-create/config.json
  - Supported: defaultTeam, defaultInitiative, defaultMilestoneTemplate
  - Commands: config list/get/set/unset/edit

  Common Commands

  Project Creation

  # Minimal
  linear-create project create --title "My Project" --team <team-id>

  # With aliases
  linear-create project create --title "API Redesign" --team backend --initiative q1-goals

  # Full featured
  linear-create project create \
    --title "Mobile App" \
    --team mobile \
    --initiative product-2025 \
    --description "iOS and Android app" \
    --content-file docs/mobile-spec.md \
    --status planned \
    --priority 1 \
    --start-date 2025-02-01 \
    --target-date 2025-06-30 \
    --icon "Smartphone" \
    --color "#4ECDC4" \
    --labels "label_1,label_2" \
    --members "user_1,user_2" \
    --link "https://github.com/org/mobile|GitHub"

  Testing New Commands

  When implementing new commands:
  # 1. Build
  npm run build

  # 2. Test command directly
  node dist/index.js <command> --help
  node dist/index.js <command> <args>

  # 3. Run relevant test suite (if exists)
  cd tests/scripts
  ./<relevant-test>.sh

  # 4. Test interactive mode manually
  node dist/index.js <command> --interactive

  # 5. Verify build & type checking
  npm run typecheck
  npm run lint

  Release Process

  1. Complete all tasks in milestone
  2. Update MILESTONES.md - mark tasks as [x] completed
  3. Run verification:
  npm run build
  npm run typecheck
  npm run lint
  cd tests/scripts && ./run-all-tests.sh
  4. Update version in package.json and src/cli.ts
  5. Commit with milestone message
  6. Tag release: git tag v0.X.Y
  7. Push: git push && git push --tags
  8. Move completed milestone to archive/MILESTONES_XX.md if needed

  Important Notes for AI Assistants

  Alias Resolution

  When implementing commands that accept entity IDs:
  1. Always use resolveAlias(entityType, idOrAlias) from src/lib/aliases.ts
  2. Entity types: 'team', 'initiative', 'project-status', 'member', 'workflow-state', 'issue-label', 'project-label'
  3. Resolution happens in command logic, not in the CLI argument parsing

  Error Handling

  - Validate inputs early (before API calls)
  - Provide helpful error messages with context
  - Use Linear SDK error types where applicable

  Interactive vs Non-Interactive

  - Use .tsx extension for components with Ink UI (interactive)
  - Use .ts extension for pure command logic (non-interactive)
  - Always support both modes where applicable with -I, --interactive flag

  Testing Strategy

  - Write integration tests in tests/scripts/ using bash
  - Test both success and error cases
  - Use real Linear API (not mocks)
  - Generate cleanup scripts for manual deletion
  - Test with aliases, not just IDs

  Code Style

  - TypeScript strict mode enabled
  - ESM modules (.js extensions in imports)
  - Prefer async/await over promises
  - Use commander.js Option/Argument classes for type-safe options