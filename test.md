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

## Testing with Real Linear API

To test with a real Linear API key:

```bash
# 1. Get your Linear API key from https://linear.app/settings/api
# 2. Set it using config set (with validation)
node dist/index.js config set apiKey lin_api_your_actual_key_here

# 3. Or use environment variable
export LINEAR_API_KEY=lin_api_your_actual_key_here

# 4. Test the config show command
node dist/index.js config show

# 5. You should see your masked API key displayed
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
