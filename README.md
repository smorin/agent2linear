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
```

## Project Status

See [MILESTONES.md](./MILESTONES.md) for detailed project milestones and progress.

**Current Version**: v0.1.0 - Project Foundation

## License

MIT
