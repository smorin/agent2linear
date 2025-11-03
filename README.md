# linear-create

Command-line tool for creating Linear issues and projects with support for initiatives.

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your Linear API key as an environment variable:

```bash
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
```

## Usage

```bash
# Show help
linear-create --help

# List initiatives (interactive)
linear-create initiatives list

# Set default initiative
linear-create initiatives set <id>

# Create a project (interactive)
linear-create project create

# Create a project (non-interactive)
linear-create project create --title "My Project" --description "Description" --state planned

# Show configuration
linear-create config show
```

## Issue Commands

Create and manage Linear issues with comprehensive options and smart defaults.

### Issue Create

Create issues with auto-assignment, full field support, and intelligent validation.

**Basic Examples:**
```bash
# Minimal (auto-assigns to you, uses defaultTeam if configured)
linear-create issue create --title "Fix login bug"

# Standard creation
linear-create issue create \
  --title "Add OAuth support" \
  --team backend \
  --priority 2 \
  --estimate 8

# Full-featured
linear-create issue create \
  --title "Implement auth" \
  --team backend \
  --description "Add OAuth2 providers" \
  --priority 1 \
  --assignee john@company.com \
  --labels "feature,security" \
  --project "Q1 Goals" \
  --due-date 2025-02-15
```

**Key Features:**
- **Auto-assignment**: Issues are assigned to you by default (use `--no-assignee` to override)
- **Member resolution**: Supports ID, alias, email, or display name
- **Project resolution**: Supports ID, alias, or name lookup
- **Config defaults**: Use `defaultTeam` and `defaultProject` to simplify creation
- **Validation**: Team-aware validation for states and projects

For full documentation: `linear-create issue create --help`

### Issue View

View comprehensive issue details in terminal or browser.

```bash
# View by identifier
linear-create issue view ENG-123

# View with JSON output
linear-create issue view ENG-123 --json

# Open in browser
linear-create issue view ENG-123 --web
```

### Issue Update

Update existing issues with comprehensive field support and smart validation.

**Basic Examples:**
```bash
# Update single field
linear-create issue update ENG-123 --title "New title"
linear-create issue update ENG-123 --priority 1
linear-create issue update ENG-123 --state done

# Update multiple fields
linear-create issue update ENG-123 \
  --title "Updated title" \
  --priority 2 \
  --estimate 5 \
  --due-date 2025-12-31
```

**Advanced Examples:**
```bash
# Change assignment
linear-create issue update ENG-123 --assignee john@company.com
linear-create issue update ENG-123 --no-assignee

# Label management (3 modes)
linear-create issue update ENG-123 --labels "bug,urgent"           # Replace all
linear-create issue update ENG-123 --add-labels "feature"          # Add to existing
linear-create issue update ENG-123 --remove-labels "wontfix"       # Remove specific
linear-create issue update ENG-123 --add-labels "new" --remove-labels "old"  # Both

# Subscriber management (3 modes)
linear-create issue update ENG-123 --subscribers "user1,user2"     # Replace all
linear-create issue update ENG-123 --add-subscribers "user3"       # Add to existing
linear-create issue update ENG-123 --remove-subscribers "user1"    # Remove specific

# Clear fields
linear-create issue update ENG-123 --no-assignee --no-due-date --no-estimate
linear-create issue update ENG-123 --no-project --no-cycle --no-parent

# Parent relationship
linear-create issue update ENG-123 --parent ENG-100     # Make sub-issue
linear-create issue update ENG-123 --no-parent          # Make root issue

# Move between teams
linear-create issue update ENG-123 --team frontend --state todo

# Lifecycle operations
linear-create issue update ENG-123 --trash              # Move to trash
linear-create issue update ENG-123 --untrash            # Restore from trash
```

**Key Features:**
- **33+ update options**: Comprehensive field coverage including add/remove patterns
- **Smart validation**: Team-aware state validation, compatibility checks
- **Flexible updates**: Update one field or many at once
- **Clearing operations**: Use `--no-*` flags to clear fields (assignee, dates, etc.)
- **Label/subscriber patterns**: Replace, add, or remove items with distinct flags
- **Mutual exclusivity**: Prevents conflicting flag combinations with helpful errors

For full documentation: `linear-create issue update --help`

### Issue List

List and filter issues with smart defaults, extensive filtering, sorting, and multiple output formats.

**Basic Examples:**
```bash
# Smart defaults: your assigned issues
linear-create issue list

# Limit results
linear-create issue list --limit 10

# Filter by team
linear-create issue list --team backend

# Filter by state
linear-create issue list --state "in progress"
```

**Advanced Filtering:**
```bash
# Multiple filters
linear-create issue list \
  --team backend \
  --priority 1 \
  --state "in progress" \
  --assignee steve@company.com

# Project and labels
linear-create issue list \
  --project "Q1 Goals" \
  --labels "bug,urgent"

# Date filters
linear-create issue list --due-before 2025-12-31
linear-create issue list --created-after 2025-01-01

# Parent/sub-issue filters
linear-create issue list --has-parent        # Only sub-issues
linear-create issue list --no-parent         # Only root issues
```

**Sorting and Output:**
```bash
# Sort options
linear-create issue list --sort priority     # By priority (high to low)
linear-create issue list --sort created      # By creation date (newest first)
linear-create issue list --sort updated      # By update date
linear-create issue list --sort identifier   # By identifier (ENG-1, ENG-2...)

# Output formats
linear-create issue list --format table      # Table view (default)
linear-create issue list --format compact    # Compact view
linear-create issue list --format json       # JSON output
linear-create issue list --format urls       # URLs only (for scripting)
```

**Key Features:**
- **Smart defaults**: Shows your assigned issues by default
- **Extensive filters**: Team, state, priority, assignee, labels, project, dates, parent, and more
- **Flexible sorting**: By priority, dates, identifier, or other fields
- **Multiple formats**: Table, compact, JSON, or URLs for scripting
- **Performance optimized**: Batch fetching eliminates N+1 queries (11x+ API call reduction)

For full documentation: `linear-create issue list --help`

## Project List & Search

List and search projects with smart defaults and extensive filtering. The `project list` command provides intelligent defaults for common workflows while supporting comprehensive filtering options.

### Smart Defaults

By default, `project list` filters to show projects where **you are the lead**, in your **default team and initiative** (if configured):

```bash
# Smart defaults: projects I lead in my default team/initiative
linear-create project list

# Equivalent to (if you have defaults configured):
# --lead <current-user-id> --team <default-team> --initiative <default-initiative>
```

### Override Flags

Use these flags to bypass smart defaults and see more projects:

```bash
# Show ALL projects (any lead) in default team/initiative
linear-create project list --all-leads

# Show projects I lead across ALL teams
linear-create project list --all-teams

# Show projects I lead across ALL initiatives
linear-create project list --all-initiatives

# Override everything - show ALL projects everywhere
linear-create project list --all-leads --all-teams --all-initiatives
```

### Filter Options

**Core Filters:**
```bash
# Filter by team
linear-create project list --team backend
linear-create project list -t backend

# Filter by initiative
linear-create project list --initiative q1-goals
linear-create project list -i q1-goals

# Filter by project status
linear-create project list --status planned
linear-create project list -s started

# Filter by priority (0-4)
linear-create project list --priority 1
linear-create project list -p 2

# Filter by specific project lead
linear-create project list --lead alice@company.com
linear-create project list -l alice

# Filter by member (projects where someone is assigned)
linear-create project list --member bob
linear-create project list -m alice,bob  # Multiple members

# Filter by label
linear-create project list --label urgent
linear-create project list --label urgent,critical  # Multiple labels

# Search in project name, description, or content
linear-create project list --search "API"
linear-create project list --search "mobile redesign"
```

**Date Range Filters:**
```bash
# Projects starting in Q1 2025
linear-create project list --start-after 2025-01-01 --start-before 2025-03-31

# Projects targeting after June 2025
linear-create project list --target-after 2025-06-01

# Projects targeting before end of year
linear-create project list --target-before 2025-12-31
```

### Output Formats

**Table Format (default):**
```bash
linear-create project list
```
Output:
```
ID           Title                          Status      Team           Lead                 Preview
-----------------------------------------------------------------------------------------------------------------------
bf2e1a8a9b   Mobile App Redesign            Started     Mobile         Alice Johnson        Complete redesign of iOS...
a9c3d4e5f6   API v2 Migration               Planned     Backend        Bob Smith            Migrate all endpoints...
c1d2e3f4g5   Customer Dashboard             Completed   Frontend       Carol Davis          New dashboard for customer...

Total: 3 projects
```

**JSON Format:**
```bash
# Machine-readable format for scripting
linear-create project list --format json
linear-create project list -f json

# Example with filtering
linear-create project list --team backend --status started --format json
```

**TSV Format:**
```bash
# Tab-separated values for data processing
linear-create project list --format tsv
linear-create project list -f tsv > projects.tsv
```

**Interactive Mode:**
```bash
# Ink UI with rich formatting
linear-create project list --interactive
linear-create project list -I
```

### Complex Filter Examples

```bash
# Backend team projects, started status, high priority
linear-create project list --team backend --status started --priority 1

# Projects led by specific person in any team
linear-create project list --lead alice@company.com --all-teams

# Projects where Bob is assigned (as member)
linear-create project list --member bob --all-leads

# Search for "API" projects in backend team (any lead)
linear-create project list --search "API" --team backend --all-leads

# Urgent projects targeting Q1 2025
linear-create project list --label urgent --target-after 2025-01-01 --target-before 2025-03-31

# All projects with multiple filters
linear-create project list \
  --team backend \
  --status started \
  --priority 1 \
  --lead alice \
  --label critical

# Export all projects to JSON
linear-create project list --all-teams --all-leads --all-initiatives --format json > all-projects.json
```

### Alias Support

All entity filters support aliases:

```bash
# Use team alias instead of ID
linear-create project list --team backend

# Use initiative alias
linear-create project list --initiative q1-goals

# Use member alias
linear-create project list --lead alice

# Use label alias
linear-create project list --label urgent,critical
```

### Setting Defaults

Configure default values to streamline your workflow:

```bash
# Set default team
linear-create config set defaultTeam backend

# Set default initiative
linear-create config set defaultInitiative q1-goals

# Now simple list uses your defaults:
linear-create project list
# Shows: projects you lead in 'backend' team within 'q1-goals' initiative
```

## Milestone Templates

Milestone templates allow you to quickly set up project milestones using predefined templates. Templates are stored locally in JSON files and can be customized for your workflows.

### Creating Templates

You can create milestone templates using the CLI (recommended) or by manually editing JSON files.

**Using the CLI (Interactive):**
```bash
# Interactive mode - guided wizard
linear-create milestone-templates create --interactive
linear-create mtmpl create -I

# Interactive mode with project scope
linear-create milestone-templates create --project --interactive
```

**Using the CLI (Non-Interactive):**
```bash
# Create a template with milestones
linear-create milestone-templates create my-sprint \
  --description "Custom 2-week sprint" \
  --milestone "Planning:+1d:Define sprint goals and tasks" \
  --milestone "Development:+10d:Implementation phase" \
  --milestone "Review:+14d:Code review and deployment"

# Create in project scope
linear-create milestone-templates create team-workflow \
  --project \
  --milestone "Kickoff::Team alignment meeting" \
  --milestone "Execution:+7d:Complete assigned tasks" \
  --milestone "Retrospective:+14d:Review and improve"
```

**Milestone Spec Format:** `name:targetDate:description`
- `name` - Required
- `targetDate` - Optional (+7d, +2w, +1m, or ISO date)
- `description` - Optional (supports markdown)

**Manual Template File Creation:**

Templates are stored at:
- **Global**: `~/.config/linear-create/milestone-templates.json` - Available across all projects
- **Project**: `.linear-create/milestone-templates.json` - Project-specific templates

**Example Template File:**
```json
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
```

**Managing Templates:**
```bash
# Edit a template (interactive)
linear-create milestone-templates edit basic-sprint

# Remove a template
linear-create milestone-templates remove basic-sprint
linear-create mtmpl rm old-template --yes  # Skip confirmation
```

### Using Milestone Templates

```bash
# List all templates
linear-create milestone-templates list
linear-create mtmpl ls                # Short alias

# View template details
linear-create milestone-templates view basic-sprint

# Add milestones to a project
linear-create project add-milestones PRJ-123 --template basic-sprint

# Set default template
linear-create config set defaultMilestoneTemplate basic-sprint

# Use default when creating milestones
linear-create project add-milestones PRJ-123  # Uses default template
```

### Date Offset Format

Target dates support relative formats:
- `+7d` - 7 days from now
- `+2w` - 2 weeks from now
- `+1m` - 1 month from now
- `2025-12-31` - Absolute ISO date

## Aliases

Aliases allow you to use simple, memorable names instead of long Linear IDs. For example, use "backend" instead of "init_abc123xyz". This is especially useful for AI assistants that have difficulty tracking long IDs.

### Managing Aliases

```bash
# Add an alias
linear-create alias add initiative backend init_abc123xyz
linear-create alias add team frontend team_def456uvw --project
linear-create alias add project api proj_ghi789rst

# List all aliases
linear-create alias list

# List aliases for a specific type
linear-create alias list initiatives
linear-create alias list teams

# Get the ID for an alias
linear-create alias get initiative backend

# Edit aliases interactively
linear-create alias edit           # Interactive mode - select scope, type, and alias to edit
linear-create alias edit --global  # Edit global aliases
linear-create alias edit --project # Edit project aliases

# Remove an alias
linear-create alias remove initiative backend
linear-create alias rm team frontend --project

# Validate all aliases
linear-create alias list --validate
```

### Using Aliases

Once configured, aliases can be used anywhere an ID is accepted:

```bash
# Use initiative alias
linear-create initiatives set backend
linear-create initiatives view backend

# Use team and initiative aliases in project creation
linear-create project create --title "New API" --team backend --initiative backend-init

# Use team alias in selection
linear-create teams select --id frontend
```

### Storage Locations

- **Global aliases**: `~/.config/linear-create/aliases.json` - Available across all projects
- **Project aliases**: `.linear-create/aliases.json` - Project-specific, can be version controlled

Project aliases take precedence over global aliases, allowing you to override global settings per-project.

### Alias Scope

Aliases are scoped by entity type, meaning you can use the same alias name for different types:

```bash
# "backend" can refer to both an initiative and a team
linear-create alias add initiative backend init_abc123
linear-create alias add team backend team_xyz789
```

## Icon Usage

### Supported Icons

linear-create supports Linear's standard icon catalog for projects. Icons can be specified by name (e.g., "Checklist", "Tree", "Joystick") and are validated by Linear's API.

**Note on Icon Validation**: This tool does NOT validate icons client-side. Icons are passed directly to Linear's API for server-side validation. This design decision was made after investigation revealed:

1. **No API catalog endpoint**: Linear's GraphQL API does not expose an endpoint to fetch the complete standard icon catalog
2. **Emojis query limitation**: The `emojis` query only returns custom organization emojis (user-uploaded), not Linear's built-in icons
3. **Maintenance burden**: Maintaining a hardcoded list would be incomplete and quickly outdated

### Icon Discovery

```bash
# View curated icon suggestions (for discovery only, not exhaustive)
linear-create icons list

# Search for specific icons
linear-create icons list --search rocket

# View icons by category
linear-create icons list --category status

# Extract icons currently used in your workspace
linear-create icons extract --type projects
```

### Using Icons

```bash
# Icon names are capitalized (Linear's format)
linear-create project create --title "My Project" --team eng --icon "Checklist"
linear-create project create --title "API" --team backend --icon "Joystick"
linear-create project create --title "Design" --team frontend --icon "Tree"

# If an invalid icon is provided, Linear API will return a helpful error
linear-create project create --title "Test" --team eng --icon "InvalidIcon"
# Error: Icon not found (from Linear API)
```

### Icon Resources

- The `linear-create icons list` command shows ~67 curated icons for discovery
- Linear supports hundreds of standard icons beyond this curated list
- Invalid icons will be rejected by Linear's API with clear error messages

## Date Formats

linear-create supports flexible date formats for project `--start-date` and `--target-date` options, making it easy to specify dates naturally without manually calculating start-of-quarter or start-of-month dates.

### Supported Formats

**Quarters:**
```bash
linear-create project create --title "Q1 Initiative" --start-date "2025-Q1"
linear-create project create --title "Q2 Goals" --start-date "Q2 2025"
linear-create project create --title "Q3 Project" --start-date "q3-2025"  # Case-insensitive
```

**Half-Years:**
```bash
linear-create project create --title "H1 Strategy" --start-date "2025-H1"
linear-create project create --title "H2 Plan" --start-date "H2 2025"
```

**Months:**
```bash
# Numeric format
linear-create project create --title "January Sprint" --start-date "2025-01"

# Short month names
linear-create project create --title "Feb Release" --start-date "Feb 2025"

# Full month names
linear-create project create --title "March Update" --start-date "March 2025"
```

**Years:**
```bash
linear-create project create --title "2025 Roadmap" --start-date "2025"
```

**ISO Dates (specific dates):**
```bash
linear-create project create --title "Sprint 1" --start-date "2025-01-15"
```

### How It Works

The date parser automatically:
- Converts flexible formats to ISO dates (YYYY-MM-DD)
- Detects and sets the appropriate resolution (quarter, month, year)
- Shows confirmation messages with the parsed format

**Example output:**
```bash
$ linear-create project create --title "Q1 Initiative" --start-date "2025-Q1"
📅 Start date: Q1 2025 (2025-01-01, resolution: quarter)
✅ Created project: Q1 Initiative
```

### Date Resolution

Linear projects support date resolutions to indicate time granularity:
- **quarter**: Project spans a quarter (Q1-Q4)
- **month**: Project spans a month
- **halfYear**: Project spans half a year (H1 or H2)
- **year**: Project spans an entire year
- *(none)*: Specific date without resolution

#### Auto-Detection (Recommended)

The parser **automatically sets the resolution** based on your input format:
```bash
# ✅ Recommended: Let the parser auto-detect resolution
linear-create project create --start-date "2025-Q1"      # Auto: resolution = quarter
linear-create project create --start-date "Jan 2025"     # Auto: resolution = month
linear-create project create --start-date "2025"         # Auto: resolution = year
linear-create project create --start-date "2025-01-15"   # Auto: no resolution (specific date)
```

#### Explicit Override (Advanced)

For advanced use cases, you can explicitly override the resolution with `--start-date-resolution` or `--target-date-resolution`:

**When to use explicit override:**
- Mid-period dates with specific resolution (e.g., mid-month representing a quarter)
- Resolution-only updates (update command only)

```bash
# ⚙️ Advanced: Override auto-detection
# Mid-month date representing Q1
linear-create project create --start-date "2025-01-15" --start-date-resolution quarter

# Resolution-only update (update command)
linear-create project update myproject --start-date-resolution quarter
```

**Validation warnings:**
```bash
# ⚠️ Conflicting format and explicit flag
$ linear-create project create --start-date "2025-Q1" --start-date-resolution month
⚠️  Warning: Date format '2025-Q1' implies quarter resolution, but --start-date-resolution
    is set to 'month'. Using explicit value (month).
```

**Best practice:** Use auto-detection for 95% of cases. Only use explicit flags when the date format doesn't match your intent.

### Error Handling

Invalid dates are caught with helpful error messages:

```bash
$ linear-create project create --title "Test" --start-date "2025-Q5"
❌ Invalid start date: Invalid quarter: Q5

Quarter must be Q1, Q2, Q3, or Q4. Examples:
  --start-date "2025-Q1"     → Q1 2025 (Jan 1 - Mar 31)
  --start-date "Q2 2025"     → Q2 2025 (Apr 1 - Jun 30)
  --start-date "Q3 2025"     → Q3 2025 (Jul 1 - Sep 30)
  --start-date "Q4 2025"     → Q4 2025 (Oct 1 - Dec 31)
```

## Development

```bash
# Build the project
npm run build

# Run in development mode (watch)
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck

# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with web UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Testing

This project uses [Vitest](https://vitest.dev/) for unit testing with comprehensive coverage of core utilities.

**Test Structure:**
- Unit tests: `src/**/*.test.ts` - Fast, isolated tests for utilities and parsers
- Integration tests: `tests/scripts/*.sh` - End-to-end tests with real Linear API

**Running Tests:**
```bash
# Run all unit tests once (recommended for CI/CD and verification)
npm run test

# Watch mode - auto-run tests on file changes (best for active development)
npm run test:watch

# Interactive web UI for test exploration (debugging and visual analysis)
npm run test:ui

# Generate coverage report (check test completeness)
npm run test:coverage
```

**Running Specific Tests:**
```bash
# Run only date parser tests (104 tests)
npx vitest run src/lib/date-parser.test.ts

# Run tests matching a pattern
npx vitest run -t "Quarter formats"

# Run with verbose output
npx vitest run --reporter=verbose
```

**Test Files:**
- `src/lib/smoke.test.ts` - 4 basic sanity tests
- `src/lib/date-parser.test.ts` - 104 comprehensive date parser tests

**Date Parser Test Coverage (104 tests):**
- Quarter formats (15 tests) - All Q1-Q4 variants, case sensitivity, validation
- Half-year formats (10 tests) - H1/H2 variants, edge cases
- Month formats - Numeric (10 tests) - YYYY-MM format with validation
- Month formats - Named (20 tests) - Jan/January, all 12 months, case sensitivity
- Year formats (5 tests) - 4-digit years with range validation
- ISO date formats (10 tests) - YYYY-MM-DD with leap year validation
- Resolution detection (8 tests) - Auto-detection verification
- Parser priority (12 tests) - Format precedence rules
- Error messages (10 tests) - User-friendly error handling
- Edge cases (4 tests) - Whitespace, mixed case, boundaries

**Helper Function Tests (20 tests):**
- `getQuarterStartDate()` - 6 tests
- `getHalfYearStartDate()` - 4 tests
- `getMonthStartDate()` - 5 tests
- `parseMonthName()` - 5 tests

**Coverage:**
- Target: 95%+ coverage for core utilities
- Current: `date-parser.ts` has **99.10%** coverage
  - Statements: 99.10%
  - Branches: 98.07%
  - Functions: 100%
  - Lines: 99.04%
- Coverage reports available in `coverage/` directory after running `npm run test:coverage`

## Project Status

See [MILESTONES.md](./MILESTONES.md) for detailed project milestones and progress.

**Current Version**: v0.1.0 - Project Foundation

## License

MIT
