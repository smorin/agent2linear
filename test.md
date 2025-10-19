# Testing linear-create CLI

This guide shows how to manually test the CLI without installing it globally.

## Option 1: Direct Node Execution (Simplest)

After building, run the compiled output directly:

```bash
# Build first
npm run build

# Then run commands
node dist/index.js --help
node dist/index.js config show
node dist/index.js initiatives list

# With environment variable
LINEAR_API_KEY=lin_api_your_key_here node dist/index.js config show
```

## Option 2: npm link (Most Convenient)

Create a local symlink to test as if it were installed:

```bash
# In the project directory, create symlink
npm link

# Now you can use it like a real command
linear-create --help
linear-create config show

# When done testing, remove the symlink
npm unlink -g linear-create
```

## Option 3: Add a Test Script (Recommended)

Add this to package.json scripts:
```json
"start": "node dist/index.js"
```

Then you can use:
```bash
npm run build
npm start -- --help
npm start -- config show
npm start -- initiatives list
```

## Option 4: Development Mode with Watch

For active development, use the dev script with watch mode:

```bash
# Terminal 1: Keep this running to auto-rebuild on changes
npm run dev

# Terminal 2: Test your changes
node dist/index.js config show
```

## Testing Configuration Files

To test the config system:

```bash
# 1. Test with environment variable
LINEAR_API_KEY=lin_api_test123 node dist/index.js config show

# 2. Create a global config
mkdir -p ~/.config/linear-create
echo '{"defaultInitiative": "init_abc123", "apiKey": "lin_api_globalkey"}' > ~/.config/linear-create/config.json
node dist/index.js config show

# 3. Create a project config (overrides global for initiative)
mkdir -p .linear-create
echo '{"defaultInitiative": "init_project456"}' > .linear-create/config.json
node dist/index.js config show

# 4. Env var should override config file API key
LINEAR_API_KEY=lin_api_envkey node dist/index.js config show

# Clean up test configs
rm -rf ~/.config/linear-create .linear-create
```

## Testing Config Set/Unset Commands

Test the new config management commands:

```bash
# 1. Show config help
node dist/index.js config

# 2. Test invalid key validation
node dist/index.js config set invalidKey test123
# Should show error: Invalid configuration key

# 3. Test API key format validation
node dist/index.js config set apiKey invalid_format
# Should show error: Invalid API key format

# 4. Set API key with validation (requires real key)
export LINEAR_API_KEY=lin_api_your_actual_key_here
node dist/index.js config set apiKey $LINEAR_API_KEY --global
# Should validate and save to global config

# 5. Set initiative with validation (requires real Linear account)
node dist/index.js config set defaultInitiative init_your_initiative_id --project
# Should verify initiative exists and save to project config

# 6. Set team with validation (requires real Linear account)
node dist/index.js config set defaultTeam team_your_team_id --global
# Should verify team exists and save to global config

# 7. View current config
node dist/index.js config show

# 8. Unset a value
node dist/index.js config unset defaultTeam --global
# Should remove defaultTeam from global config

# 9. Try to unset from non-existent config
node dist/index.js config unset apiKey --project
# Should show error if no project config exists

# Clean up
rm -rf ~/.config/linear-create .linear-create
```

## Testing Initiatives Commands

Test initiative browsing and selection:

```bash
# 1. Set up Linear API key first
export LINEAR_API_KEY=lin_api_your_actual_key_here

# 2. Test initiatives list (interactive)
node dist/index.js initiatives list
# Should show list of initiatives with keyboard navigation
# Use arrow keys to select, Enter to confirm
# Selected initiative saved to global config by default

# 3. Test initiatives list with project scope
node dist/index.js initiatives list --project
# Saves selected initiative to project config instead

# 4. Test initiatives set (non-interactive)
node dist/index.js initiatives set init_your_initiative_id
# Should validate initiative exists and save to config

# 5. Test with invalid initiative ID
node dist/index.js initiatives set invalid_id_123
# Should show error: Initiative not found

# 6. Verify initiative was saved
node dist/index.js config show
# Should show defaultInitiative in output
```

## Testing Project Creation - Interactive Mode

Test the interactive project creation workflow:

```bash
# 1. Set up API key and defaults (optional but recommended)
export LINEAR_API_KEY=lin_api_your_actual_key_here
node dist/index.js config set defaultInitiative init_your_initiative_id
node dist/index.js config set defaultTeam team_your_team_id

# 2. Test interactive project creation
node dist/index.js project create
# Should prompt for:
#   - Title (validates min 3 chars)
#   - Description (optional, can press Enter to skip)
#   - State (shows dropdown: planned, started, paused, completed, canceled)
# Then creates project and shows success with URL

# 3. Test with very short title (validation)
node dist/index.js project create
# Enter title: "ab"
# Should show error: Title must be at least 3 characters

# 4. Test cancellation
node dist/index.js project create
# Press Ctrl+C during prompts
# Should exit cleanly

# 5. Verify project was created in Linear
# Check the URL displayed in success message
```

## Testing Project Creation - Non-Interactive Mode

Test project creation with CLI flags:

```bash
# 1. Basic project creation with title only
node dist/index.js project create --title "Test Project"
# Should create project with default state (planned)

# 2. Full project creation with all flags
node dist/index.js project create \
  --title "My New Project" \
  --description "This is a test project" \
  --state started \
  --initiative init_your_initiative_id \
  --team team_your_team_id
# Should create project with all specified details

# 3. Test with config defaults
node dist/index.js config set defaultInitiative init_abc123
node dist/index.js config set defaultTeam team_def456
node dist/index.js project create --title "Quick Project"
# Should use defaults from config for initiative and team

# 4. Test title validation (too short)
node dist/index.js project create --title "ab"
# Should show error: Title must be at least 3 characters

# 5. Test duplicate project name
node dist/index.js project create --title "Existing Project Name"
# Should check for duplicates and show error if exists

# 6. Test invalid initiative ID
node dist/index.js project create \
  --title "Test Project" \
  --initiative invalid_id_123
# Should show error: Initiative not found

# 7. Test invalid team ID
node dist/index.js project create \
  --title "Test Project" \
  --team invalid_team_id
# Should show error: Team not found

# 8. Test all states
for state in planned started paused completed canceled; do
  node dist/index.js project create \
    --title "Project $state" \
    --state $state
done
# Should create 5 projects with different states

# 9. Test --no-interactive flag explicitly
node dist/index.js project create \
  --title "Non Interactive Project" \
  --no-interactive
# Should skip all prompts
```

## Testing Project Creation - Edge Cases

Test various edge cases and error conditions:

```bash
# 1. Missing API key
unset LINEAR_API_KEY
node dist/index.js project create --title "Test"
# Should show error: Linear API key not found

# 2. Invalid API key format
node dist/index.js config set apiKey invalid_format
node dist/index.js project create --title "Test"
# Should show error: Invalid API key format

# 3. Network error simulation (disconnect internet)
node dist/index.js project create --title "Test Project"
# Should show helpful error message

# 4. Project without initiative or team
node dist/index.js config unset defaultInitiative
node dist/index.js config unset defaultTeam
node dist/index.js project create --title "Standalone Project"
# Should create project successfully without linking

# 5. Very long title
node dist/index.js project create \
  --title "This is a very long project title that tests the maximum length handling of the Linear API and our validation"
# Should create successfully (Linear handles length limits)

# 6. Special characters in title
node dist/index.js project create --title "Test: Project [2024] - Phase #1"
# Should handle special characters correctly

# 7. Empty description
node dist/index.js project create \
  --title "Test Project" \
  --description ""
# Should create without description (treated as undefined)
```

## Testing Complete Workflow

Test the full end-to-end workflow:

```bash
# 1. Setup: Configure API key
export LINEAR_API_KEY=lin_api_your_actual_key_here
node dist/index.js config set apiKey $LINEAR_API_KEY

# 2. Browse and select default initiative
node dist/index.js initiatives list
# Select an initiative interactively

# 3. Set default team
node dist/index.js config set defaultTeam team_your_team_id

# 4. Verify configuration
node dist/index.js config show
# Should show API key (masked), default initiative, default team

# 5. Create project using defaults
node dist/index.js project create --title "Workflow Test Project"
# Should use default initiative and team

# 6. Create another project with override
node dist/index.js project create \
  --title "Override Test Project" \
  --initiative different_initiative_id
# Should use different initiative, keep default team

# 7. Create project interactively
node dist/index.js project create
# Fill in all prompts, verify defaults are shown

# 8. Clean up (optional)
rm -rf ~/.config/linear-create .linear-create
```

## Testing with Real Linear API

Complete setup and testing with a real Linear workspace:

```bash
# 1. Get your Linear API key from https://linear.app/settings/api
# 2. Set it using config set (with validation)
node dist/index.js config set apiKey lin_api_your_actual_key_here

# 3. Or use environment variable
export LINEAR_API_KEY=lin_api_your_actual_key_here

# 4. Test the config show command
node dist/index.js config show

# 5. You should see your masked API key displayed

# 6. List your actual initiatives
node dist/index.js initiatives list
# Should show real initiatives from your workspace

# 7. Create a real project
node dist/index.js project create \
  --title "[TEST] CLI Test Project" \
  --description "Created via linear-create CLI for testing" \
  --state planned
# Check Linear to verify project was created

# 8. Clean up test projects in Linear UI if needed
```

## Recommended Testing Workflow

**For quick iteration:**
```bash
# Terminal 1 - Watch mode
npm run dev

# Terminal 2 - Test commands
node dist/index.js config show
```

**For realistic testing:**
```bash
npm link
linear-create --help
linear-create config show
# ... test other commands
npm unlink -g linear-create
```

## Verifying Build & Code Quality

```bash
# Build the project
npm run build

# Run linter
npm run lint

# Run type checker
npm run typecheck

# Format code
npm run format
```
