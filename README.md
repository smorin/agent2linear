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
