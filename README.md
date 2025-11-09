# agent2linear

**agent2linear** is a command-line interface for Linear designed to work seamlessly with both humans and AI agents. Unlike Linear's web interface or standard APIs, agent2linear is built to **minimize token usage and context window waste** - critical for AI workflows where every token counts.

**Why it exists**: Linear uses long UUIDs (`team_9b2e5f8a-c3d1-4e6f-8a9b-2c3d4e5f6a7b`) that consume tokens and confuse agents. agent2linear replaces them with memorable aliases (`--team backend`), persistent config defaults (global or project-local), and natural date formats (`Q1 2025`). Set your `defaultTeam`, `defaultInitiative`, and other preferences once, then create issues and projects without repeating the same parameters. The result: **10x fewer tokens** for the same operations, cleaner agent prompts, and workflows that just work.

**Use `agent2linear` or the short `a2l` alias - both commands work identically.**

---

## 🎯 Why Aliases? (The Killer Feature)

**The Problem**: Linear uses UUIDs everywhere. They're impossible to remember and painful for both humans and AI agents.

**The Solution**: agent2linear lets you use friendly aliases instead of UUIDs.

### Before vs After

```bash
# ❌ Without aliases (UUID Hell)
a2l project create \
  --title "Mobile Redesign" \
  --team team_9b2e5f8a-c3d1-4e6f-8a9b-2c3d4e5f6a7b \
  --initiative init_4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a \
  --status status_3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f

# ✅ With aliases (Clean & Readable)
a2l project create \
  --title "Mobile Redesign" \
  --team mobile \
  --initiative q2-product \
  --status planned
```

### Benefits

**For Humans:**
- 🧠 **Memorable**: `--team backend` vs `--team team_9b2e5f8a...`
- 📖 **Self-documenting**: Commands are readable without looking up IDs
- ⚡ **Faster**: Type less, work faster

**For AI Agents (Why this tool exists!):**
- 💭 **Context persistence**: AI remembers "backend" across conversations, not UUIDs
- 🎯 **Fewer errors**: Less likely to corrupt "backend" than a 36-character UUID
- 🪙 **Token efficient**: Aliases save tokens in AI context windows
- 🗣️ **Natural language**: Maps to how humans describe things

### What You Can Alias

Create aliases for **11 entity types**: `team`, `initiative`, `project`, `member`, `workflow-state`, `project-status`, `issue-label`, `project-label`, `issue-template`, `project-template`, `cycle`

### Quick Start with Aliases

The setup wizard automatically creates helpful aliases:

```bash
a2l setup
# Auto-creates aliases for:
#   - Workflow states (todo, in-progress, done, canceled)
#   - Project statuses (planned, started, completed, paused)
#   - Team members (john-smith, jane-doe)
```

**Manual alias management:**

```bash
# Add aliases
a2l alias add team backend team_abc123

# Bulk sync (auto-generates from names)
a2l teams sync-aliases

# List aliases
a2l alias list
a2l alias list teams
```

**💡 Learn more**: See the [Aliases](#aliases) section for full documentation.

---

## ⚡ Quick Start (5 minutes)

Get up and running with agent2linear in 3 easy steps:

### Step 1: Install (or use with npx)

**Option A: Global Install** (recommended for frequent use)
```bash
npm install -g agent2linear
```

**Option B: Use with npx** (no installation needed - great for trying it out!)
```bash
npx agent2linear --version
```

Both methods work identically. Examples below use the short alias `a2l` for convenience.

### Step 2: Run the Setup Wizard

```bash
agent2linear setup
```

**Or with npx:**
```bash
npx agent2linear setup
```

The interactive setup wizard will:
- ✅ Guide you to get your Linear API key → https://linear.app/settings/api
- ✅ Validate your connection to Linear
- ✅ Help you select your default team
- ✅ Optionally create helpful aliases (workflow states, members, project statuses)
- ✅ Walk you through key features with a 7-screen tutorial

**That's it!** The wizard configures everything for you.

### Step 3: Start Working

```bash
# Create your first issue (auto-assigned to you!)
a2l issue create --title "My first issue"

# List YOUR assigned issues (the default - most common command!)
a2l issue list

# List all issues in your team
a2l issue list --all

# Create a project
a2l project create --title "Q1 Goals"

# Get help anytime
a2l issue create --help
```

**🎉 You're now productive!** Explore the full documentation below for advanced features.

💡 **Tip:** The setup wizard created helpful aliases for you. Try `a2l alias list` to see them.

---

## Installation

### For End Users

**Global Install** (recommended for regular use):

```bash
npm install -g agent2linear

# Verify installation
agent2linear --version
a2l --version
```

**Use with npx** (no installation needed):

```bash
# Try it out without installing
npx agent2linear --help
npx agent2linear setup

# Both commands work: agent2linear and a2l
npx agent2linear issue list
```

**Which should you choose?**
- Install globally if you'll use agent2linear frequently
- Use npx for trying it out or one-off usage
- Both methods provide identical functionality

### For Development

```bash
git clone https://github.com/smorin/agent2linear.git
cd agent2linear
npm install
npm run build
```

## Configuration

### Recommended: Use the Setup Wizard

The easiest way to configure agent2linear is with the interactive setup wizard:

```bash
agent2linear setup
```

The wizard will:
- Guide you to get your Linear API key from https://linear.app/settings/api
- Let you choose between saving to config file or using an environment variable
- Validate your API key by connecting to Linear
- Help you select your default team interactively
- Optionally create helpful aliases for workflow states, members, and project statuses
- Provide a guided tour of features

### Alternative: Manual Configuration

If you prefer manual setup, you can set your Linear API key as an environment variable:

```bash
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
```

Or use the interactive config editor:

```bash
agent2linear config edit
```

**Configuration files:**
- Global: `~/.config/agent2linear/config.json`
- Project: `.agent2linear/config.json`

**See also:** Run `agent2linear config --help` for all configuration options.

## Usage

The CLI provides two command names that work identically:
- `agent2linear` - Full command name
- `a2l` - Short alias (used in most examples for brevity)

### Common Commands

```bash
# Get help
a2l --help
a2l issue --help
a2l issue create --help

# Work with issues (most common workflows)
a2l issue list                           # List YOUR assigned issues
a2l issue list --all                     # List all team issues
a2l issue create --title "Fix bug"       # Create issue (auto-assigned to you)
a2l issue view ENG-123                   # View issue details
a2l issue update ENG-123 --state done    # Update issue

# Work with projects
a2l project create --title "Q1 Goals"    # Create project
a2l project list                         # List all projects
a2l project view "My Project"            # View project by name

# Configuration
a2l config list                          # Show current config
a2l config edit                          # Interactive config editor
a2l setup                                # Run setup wizard again
```

**💡 Tip:** Most examples in this README use the short `a2l` alias for convenience. You can use `agent2linear` anywhere you see `a2l`.

## Issue Commands

Create and manage Linear issues with comprehensive options and smart defaults.

### Issue Create

Create issues with auto-assignment, full field support, and intelligent validation.

**Basic Examples:**
```bash
# Minimal (auto-assigns to you, uses defaultTeam if configured)
agent2linear issue create --title "Fix login bug"

# Standard creation
agent2linear issue create \
  --title "Add OAuth support" \
  --team backend \
  --priority 2 \
  --estimate 8

# Full-featured
agent2linear issue create \
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

For full documentation: `agent2linear issue create --help`

### Issue View

View comprehensive issue details in terminal or browser.

```bash
# View by identifier
agent2linear issue view ENG-123

# View with JSON output
agent2linear issue view ENG-123 --json

# Open in browser
agent2linear issue view ENG-123 --web
```

### Issue Update

Update existing issues with comprehensive field support and smart validation.

**Basic Examples:**
```bash
# Update single field
agent2linear issue update ENG-123 --title "New title"
agent2linear issue update ENG-123 --priority 1
agent2linear issue update ENG-123 --state done

# Update multiple fields
agent2linear issue update ENG-123 \
  --title "Updated title" \
  --priority 2 \
  --estimate 5 \
  --due-date 2025-12-31
```

**Advanced Examples:**
```bash
# Change assignment
agent2linear issue update ENG-123 --assignee john@company.com
agent2linear issue update ENG-123 --no-assignee

# Label management (3 modes)
agent2linear issue update ENG-123 --labels "bug,urgent"           # Replace all
agent2linear issue update ENG-123 --add-labels "feature"          # Add to existing
agent2linear issue update ENG-123 --remove-labels "wontfix"       # Remove specific
agent2linear issue update ENG-123 --add-labels "new" --remove-labels "old"  # Both

# Subscriber management (3 modes)
agent2linear issue update ENG-123 --subscribers "user1,user2"     # Replace all
agent2linear issue update ENG-123 --add-subscribers "user3"       # Add to existing
agent2linear issue update ENG-123 --remove-subscribers "user1"    # Remove specific

# Clear fields
agent2linear issue update ENG-123 --no-assignee --no-due-date --no-estimate
agent2linear issue update ENG-123 --no-project --no-cycle --no-parent

# Parent relationship
agent2linear issue update ENG-123 --parent ENG-100     # Make sub-issue
agent2linear issue update ENG-123 --no-parent          # Make root issue

# Move between teams
agent2linear issue update ENG-123 --team frontend --state todo

# Lifecycle operations
agent2linear issue update ENG-123 --trash              # Move to trash
agent2linear issue update ENG-123 --untrash            # Restore from trash
```

**Key Features:**
- **33+ update options**: Comprehensive field coverage including add/remove patterns
- **Smart validation**: Team-aware state validation, compatibility checks
- **Flexible updates**: Update one field or many at once
- **Clearing operations**: Use `--no-*` flags to clear fields (assignee, dates, etc.)
- **Label/subscriber patterns**: Replace, add, or remove items with distinct flags
- **Mutual exclusivity**: Prevents conflicting flag combinations with helpful errors

For full documentation: `agent2linear issue update --help`

### Issue List

List and filter issues with smart defaults, extensive filtering, sorting, and multiple output formats.

**Basic Examples:**
```bash
# Smart defaults: your assigned issues
agent2linear issue list

# Limit results
agent2linear issue list --limit 10

# Filter by team
agent2linear issue list --team backend

# Filter by state
agent2linear issue list --state "in progress"
```

**Advanced Filtering:**
```bash
# Multiple filters
agent2linear issue list \
  --team backend \
  --priority 1 \
  --state "in progress" \
  --assignee steve@company.com

# Project and labels
agent2linear issue list \
  --project "Q1 Goals" \
  --labels "bug,urgent"

# Date filters
agent2linear issue list --due-before 2025-12-31
agent2linear issue list --created-after 2025-01-01

# Parent/sub-issue filters
agent2linear issue list --has-parent        # Only sub-issues
agent2linear issue list --no-parent         # Only root issues
```

**Sorting and Output:**
```bash
# Sort options
agent2linear issue list --sort priority     # By priority (high to low)
agent2linear issue list --sort created      # By creation date (newest first)
agent2linear issue list --sort updated      # By update date
agent2linear issue list --sort identifier   # By identifier (ENG-1, ENG-2...)

# Output formats
agent2linear issue list --format table      # Table view (default)
agent2linear issue list --format compact    # Compact view
agent2linear issue list --format json       # JSON output
agent2linear issue list --format urls       # URLs only (for scripting)
```

**Key Features:**
- **Smart defaults**: Shows your assigned issues by default
- **Extensive filters**: Team, state, priority, assignee, labels, project, dates, parent, and more
- **Flexible sorting**: By priority, dates, identifier, or other fields
- **Multiple formats**: Table, compact, JSON, or URLs for scripting
- **Performance optimized**: Batch fetching eliminates N+1 queries (11x+ API call reduction)

For full documentation: `agent2linear issue list --help`

## Project List & Search

List and search projects with smart defaults and extensive filtering. The `project list` command provides intelligent defaults for common workflows while supporting comprehensive filtering options.

### Smart Defaults

By default, `project list` filters to show projects where **you are the lead**, in your **default team and initiative** (if configured):

```bash
# Smart defaults: projects I lead in my default team/initiative
agent2linear project list

# Equivalent to (if you have defaults configured):
# --lead <current-user-id> --team <default-team> --initiative <default-initiative>
```

### Override Flags

Use these flags to bypass smart defaults and see more projects:

```bash
# Show ALL projects (any lead) in default team/initiative
agent2linear project list --all-leads

# Show projects I lead across ALL teams
agent2linear project list --all-teams

# Show projects I lead across ALL initiatives
agent2linear project list --all-initiatives

# Override everything - show ALL projects everywhere
agent2linear project list --all-leads --all-teams --all-initiatives
```

### Filter Options

**Core Filters:**
```bash
# Filter by team
agent2linear project list --team backend
agent2linear project list -t backend

# Filter by initiative
agent2linear project list --initiative q1-goals
agent2linear project list -i q1-goals

# Filter by project status
agent2linear project list --status planned
agent2linear project list -s started

# Filter by priority (0-4)
agent2linear project list --priority 1
agent2linear project list -p 2

# Filter by specific project lead
agent2linear project list --lead alice@company.com
agent2linear project list -l alice

# Filter by member (projects where someone is assigned)
agent2linear project list --member bob
agent2linear project list -m alice,bob  # Multiple members

# Filter by label
agent2linear project list --label urgent
agent2linear project list --label urgent,critical  # Multiple labels

# Search in project name, description, or content
agent2linear project list --search "API"
agent2linear project list --search "mobile redesign"
```

**Date Range Filters:**
```bash
# Projects starting in Q1 2025
agent2linear project list --start-after 2025-01-01 --start-before 2025-03-31

# Projects targeting after June 2025
agent2linear project list --target-after 2025-06-01

# Projects targeting before end of year
agent2linear project list --target-before 2025-12-31
```

### Output Formats

**Table Format (default):**
```bash
agent2linear project list
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
agent2linear project list --format json
agent2linear project list -f json

# Example with filtering
agent2linear project list --team backend --status started --format json
```

**TSV Format:**
```bash
# Tab-separated values for data processing
agent2linear project list --format tsv
agent2linear project list -f tsv > projects.tsv
```

**Interactive Mode:**
```bash
# Ink UI with rich formatting
agent2linear project list --interactive
agent2linear project list -I
```

### Complex Filter Examples

```bash
# Backend team projects, started status, high priority
agent2linear project list --team backend --status started --priority 1

# Projects led by specific person in any team
agent2linear project list --lead alice@company.com --all-teams

# Projects where Bob is assigned (as member)
agent2linear project list --member bob --all-leads

# Search for "API" projects in backend team (any lead)
agent2linear project list --search "API" --team backend --all-leads

# Urgent projects targeting Q1 2025
agent2linear project list --label urgent --target-after 2025-01-01 --target-before 2025-03-31

# All projects with multiple filters
agent2linear project list \
  --team backend \
  --status started \
  --priority 1 \
  --lead alice \
  --label critical

# Export all projects to JSON
agent2linear project list --all-teams --all-leads --all-initiatives --format json > all-projects.json
```

### Alias Support

All entity filters support aliases:

```bash
# Use team alias instead of ID
agent2linear project list --team backend

# Use initiative alias
agent2linear project list --initiative q1-goals

# Use member alias
agent2linear project list --lead alice

# Use label alias
agent2linear project list --label urgent,critical
```

### Setting Defaults

Configure default values to streamline your workflow:

```bash
# Set default team
agent2linear config set defaultTeam backend

# Set default initiative
agent2linear config set defaultInitiative q1-goals

# Now simple list uses your defaults:
agent2linear project list
# Shows: projects you lead in 'backend' team within 'q1-goals' initiative
```

## Milestone Templates

Milestone templates allow you to quickly set up project milestones using predefined templates. Templates are stored locally in JSON files and can be customized for your workflows.

### Creating Templates

You can create milestone templates using the CLI (recommended) or by manually editing JSON files.

**Using the CLI (Interactive):**
```bash
# Interactive mode - guided wizard
agent2linear milestone-templates create --interactive
agent2linear mtmpl create -I

# Interactive mode with project scope
agent2linear milestone-templates create --project --interactive
```

**Using the CLI (Non-Interactive):**
```bash
# Create a template with milestones
agent2linear milestone-templates create my-sprint \
  --description "Custom 2-week sprint" \
  --milestone "Planning:+1d:Define sprint goals and tasks" \
  --milestone "Development:+10d:Implementation phase" \
  --milestone "Review:+14d:Code review and deployment"

# Create in project scope
agent2linear milestone-templates create team-workflow \
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
- **Global**: `~/.config/agent2linear/milestone-templates.json` - Available across all projects
- **Project**: `.agent2linear/milestone-templates.json` - Project-specific templates

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
agent2linear milestone-templates edit basic-sprint

# Remove a template
agent2linear milestone-templates remove basic-sprint
agent2linear mtmpl rm old-template --yes  # Skip confirmation
```

### Using Milestone Templates

```bash
# List all templates
agent2linear milestone-templates list
agent2linear mtmpl ls                # Short alias

# View template details
agent2linear milestone-templates view basic-sprint

# Add milestones to a project
agent2linear project add-milestones PRJ-123 --template basic-sprint

# Set default template
agent2linear config set defaultMilestoneTemplate basic-sprint

# Use default when creating milestones
agent2linear project add-milestones PRJ-123  # Uses default template
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
agent2linear alias add initiative backend init_abc123xyz
agent2linear alias add team frontend team_def456uvw --project
agent2linear alias add project api proj_ghi789rst

# List all aliases
agent2linear alias list

# List aliases for a specific type
agent2linear alias list initiatives
agent2linear alias list teams

# Get the ID for an alias
agent2linear alias get initiative backend

# Edit aliases interactively
agent2linear alias edit           # Interactive mode - select scope, type, and alias to edit
agent2linear alias edit --global  # Edit global aliases
agent2linear alias edit --project # Edit project aliases

# Remove an alias
agent2linear alias remove initiative backend
agent2linear alias rm team frontend --project

# Validate all aliases
agent2linear alias list --validate
```

### Using Aliases

Once configured, aliases can be used anywhere an ID is accepted:

```bash
# Use initiative alias
agent2linear initiatives set backend
agent2linear initiatives view backend

# Use team and initiative aliases in project creation
agent2linear project create --title "New API" --team backend --initiative backend-init

# Use team alias in selection
agent2linear teams select --id frontend
```

### Storage Locations

- **Global aliases**: `~/.config/agent2linear/aliases.json` - Available across all projects
- **Project aliases**: `.agent2linear/aliases.json` - Project-specific, can be version controlled

Project aliases take precedence over global aliases, allowing you to override global settings per-project.

### Alias Scope

Aliases are scoped by entity type, meaning you can use the same alias name for different types:

```bash
# "backend" can refer to both an initiative and a team
agent2linear alias add initiative backend init_abc123
agent2linear alias add team backend team_xyz789
```

## Icon Usage

### Supported Icons

agent2linear supports Linear's standard icon catalog for projects. Icons can be specified by name (e.g., "Checklist", "Tree", "Joystick") and are validated by Linear's API.

**Note on Icon Validation**: This tool does NOT validate icons client-side. Icons are passed directly to Linear's API for server-side validation. This design decision was made after investigation revealed:

1. **No API catalog endpoint**: Linear's GraphQL API does not expose an endpoint to fetch the complete standard icon catalog
2. **Emojis query limitation**: The `emojis` query only returns custom organization emojis (user-uploaded), not Linear's built-in icons
3. **Maintenance burden**: Maintaining a hardcoded list would be incomplete and quickly outdated

### Icon Discovery

```bash
# View curated icon suggestions (for discovery only, not exhaustive)
agent2linear icons list

# Search for specific icons
agent2linear icons list --search rocket

# View icons by category
agent2linear icons list --category status

# Extract icons currently used in your workspace
agent2linear icons extract --type projects
```

### Using Icons

```bash
# Icon names are capitalized (Linear's format)
agent2linear project create --title "My Project" --team eng --icon "Checklist"
agent2linear project create --title "API" --team backend --icon "Joystick"
agent2linear project create --title "Design" --team frontend --icon "Tree"

# If an invalid icon is provided, Linear API will return a helpful error
agent2linear project create --title "Test" --team eng --icon "InvalidIcon"
# Error: Icon not found (from Linear API)
```

### Icon Resources

- The `agent2linear icons list` command shows ~67 curated icons for discovery
- Linear supports hundreds of standard icons beyond this curated list
- Invalid icons will be rejected by Linear's API with clear error messages

## Date Formats

agent2linear supports flexible date formats for project `--start-date` and `--target-date` options, making it easy to specify dates naturally without manually calculating start-of-quarter or start-of-month dates.

### Supported Formats

**Quarters:**
```bash
agent2linear project create --title "Q1 Initiative" --start-date "2025-Q1"
agent2linear project create --title "Q2 Goals" --start-date "Q2 2025"
agent2linear project create --title "Q3 Project" --start-date "q3-2025"  # Case-insensitive
```

**Half-Years:**
```bash
agent2linear project create --title "H1 Strategy" --start-date "2025-H1"
agent2linear project create --title "H2 Plan" --start-date "H2 2025"
```

**Months:**
```bash
# Numeric format
agent2linear project create --title "January Sprint" --start-date "2025-01"

# Short month names
agent2linear project create --title "Feb Release" --start-date "Feb 2025"

# Full month names
agent2linear project create --title "March Update" --start-date "March 2025"
```

**Years:**
```bash
agent2linear project create --title "2025 Roadmap" --start-date "2025"
```

**ISO Dates (specific dates):**
```bash
agent2linear project create --title "Sprint 1" --start-date "2025-01-15"
```

### How It Works

The date parser automatically:
- Converts flexible formats to ISO dates (YYYY-MM-DD)
- Detects and sets the appropriate resolution (quarter, month, year)
- Shows confirmation messages with the parsed format

**Example output:**
```bash
$ agent2linear project create --title "Q1 Initiative" --start-date "2025-Q1"
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
agent2linear project create --start-date "2025-Q1"      # Auto: resolution = quarter
agent2linear project create --start-date "Jan 2025"     # Auto: resolution = month
agent2linear project create --start-date "2025"         # Auto: resolution = year
agent2linear project create --start-date "2025-01-15"   # Auto: no resolution (specific date)
```

#### Explicit Override (Advanced)

For advanced use cases, you can explicitly override the resolution with `--start-date-resolution` or `--target-date-resolution`:

**When to use explicit override:**
- Mid-period dates with specific resolution (e.g., mid-month representing a quarter)
- Resolution-only updates (update command only)

```bash
# ⚙️ Advanced: Override auto-detection
# Mid-month date representing Q1
agent2linear project create --start-date "2025-01-15" --start-date-resolution quarter

# Resolution-only update (update command)
agent2linear project update myproject --start-date-resolution quarter
```

**Validation warnings:**
```bash
# ⚠️ Conflicting format and explicit flag
$ agent2linear project create --start-date "2025-Q1" --start-date-resolution month
⚠️  Warning: Date format '2025-Q1' implies quarter resolution, but --start-date-resolution
    is set to 'month'. Using explicit value (month).
```

**Best practice:** Use auto-detection for 95% of cases. Only use explicit flags when the date format doesn't match your intent.

### Error Handling

Invalid dates are caught with helpful error messages:

```bash
$ agent2linear project create --title "Test" --start-date "2025-Q5"
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

## Publishing

This project uses [np](https://github.com/sindresorhus/np) for automated publishing to npm.

**Prerequisites:**
- npm account with publish access
- Logged in: `npm whoami`
- Clean git working directory

**Release Process:**

```bash
# Interactive release with np (recommended)
npm run release

# np will automatically:
# 1. Run tests and build (via prepublishOnly)
# 2. Bump version in package.json
# 3. Create git tag
# 4. Push to GitHub
# 5. Publish to npm
# 6. Create GitHub release
```

**Manual Publishing (not recommended):**

```bash
# Ensure everything is ready
npm run typecheck
npm run lint
npm run build
npm run test

# Publish to npm
npm publish

# Tag and push
git tag v0.24.0
git push origin main --tags
```

**After Publishing:**

```bash
# Verify package is available
npm view agent2linear

# Test installation
npx agent2linear --version
npx a2l --version
```

## Project Status

See [MILESTONES.md](./MILESTONES.md) for detailed project milestones and progress.

**Current Version**: v0.1.0 - Project Foundation

## License

MIT
