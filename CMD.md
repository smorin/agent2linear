# Command Structure Rules and Standards

This document defines the standardized structure, naming conventions, and help documentation rules for the `linear-create` CLI tool.

## Table of Contents

- [GitHub CLI Comparison](#github-cli-comparison)
- [Command Structure Pattern](#command-structure-pattern)
- [Command Aliases](#command-aliases)
- [Interactive vs Non-Interactive Mode](#interactive-vs-non-interactive-mode)
- [Help Behavior Standards](#help-behavior-standards)
- [Option and Argument Standards](#option-and-argument-standards)
- [Validation Approach](#validation-approach)
- [Examples and Help Text](#examples-and-help-text)
- [Naming Conventions](#naming-conventions)
- [Implementation Checklist](#implementation-checklist)

---

## GitHub CLI Comparison

This document outlines how `linear-create` aligns with GitHub CLI (`gh`) patterns while maintaining its own design philosophy.

### Command Structure Alignment

| Aspect | `gh` | `linear-create` | Match Status |
|--------|------|-----------------|--------------|
| **Pattern** | `gh <resource> <action>` | `linear-create <resource> <action>` | ✅ Identical |
| **Example** | `gh issue create` | `linear-create project create` | ✅ Same pattern |

### CRUD Operations Comparison

| Operation | `gh` Command | `linear-create` Command | Status |
|-----------|--------------|-------------------------|--------|
| **Create** | `gh issue create` | `linear-create project create` | ✅ Implemented (v0.4.0) |
| **Read (list)** | `gh issue list` | `linear-create init list` | ✅ Implemented (v0.3.0) |
| **Read (view)** | `gh issue view <id>` | `linear-create init view <id>` | ✅ **NEW in v0.5.0** |
| **Update** | `gh issue edit <id>` | `linear-create proj edit <id>` | ⏳ Planned (v0.6.0) |
| **Delete** | `gh issue delete <id>` | `linear-create proj delete <id>` | ⏳ Planned (v0.7.0) |
| **Config List** | `gh config list` | `linear-create cfg list` | ✅ **NEW in v0.5.0** |
| **Config Get** | `gh config get <key>` | `linear-create cfg get <key>` | ✅ **NEW in v0.5.0** |

### Action Aliases

| Action | Primary Command | Alias | Status |
|--------|----------------|-------|--------|
| **create** | `project create` | `project new` | ✅ **NEW in v0.5.0** |
| **create** | `issues create` | `issues new` | ✅ **NEW in v0.5.0** |
| **list** | `initiatives list` | `initiatives ls` | ✅ **NEW in v0.5.0** |
| **list** | `config list` | `config show` | ✅ **NEW in v0.5.0** (backward compat) |

### Interactive Mode Philosophy

| Aspect | `gh` | `linear-create` | Rationale |
|--------|------|-----------------|-----------|
| **Default behavior** | Interactive (prompts if no flags) | Non-interactive (requires all args) | Better for scripting/CI-CD |
| **Without flags** | Prompts for input | Errors with helpful message | Explicit over implicit |
| **Enable interactive** | Default | `--interactive` / `-I` flag | Opt-in for interactive UX |
| **Web fallback** | `--web` opens browser | `--web` opens Linear | ✅ **NEW in v0.5.0** |

**Why Non-Interactive by Default?**
- ✅ **Scriptability**: Works in CI/CD pipelines without modification
- ✅ **Predictability**: Same input always produces same output
- ✅ **Explicit**: Clear error messages guide users
- ✅ **Automation-friendly**: No hanging prompts in scripts

### Flag Conventions Comparison

| Flag | `gh` Usage | `linear-create` Usage | Match? |
|------|-----------|----------------------|---------|
| `-t, --title` | Issue/PR title | Project title | ✅ Consistent |
| `-b, --body` | Issue/PR body | (planned v0.6.0) | ⏳ Planned |
| `-d, --description` | N/A | Project description | Different naming |
| `-w, --web` | Open in browser | Open Linear in browser | ✅ **NEW in v0.5.0** |
| `-I, --interactive` | N/A | Enable interactive mode | Unique to linear-create |
| `-a, --assignee` | Assign user | (planned v0.6.0) | ⏳ Planned |
| `-l, --label` | Add labels | (planned v0.6.0) | ⏳ Planned |

### Command Examples Comparison

**Creating Resources:**
```bash
# gh (interactive by default)
$ gh issue create
? Title: My issue
? Body: Description
✓ Created issue #123

# linear-create (non-interactive by default)
$ linear-create proj create
❌ Error: --title is required

$ linear-create proj create --title "My Project"
✅ Project created successfully!

# Both support web fallback (v0.5.0)
$ gh issue create --web               # Opens GitHub
$ linear-create proj create --web     # Opens Linear
```

**Viewing Resources (NEW in v0.5.0):**
```bash
# Both use 'view <id>' pattern
$ gh issue view 123
$ linear-create proj view PRJ-123

$ gh pr view 456
$ linear-create init view init_abc123
```

**Listing Resources:**
```bash
# Both use 'list' command
$ gh issue list
$ linear-create init list

# Both support 'ls' alias (v0.5.0)
$ gh issue list
$ linear-create init ls
```

**Configuration:**
```bash
# gh pattern
$ gh config list
$ gh config get editor

# linear-create (aligned in v0.5.0)
$ linear-create cfg list       # NEW: renamed from 'show'
$ linear-create cfg get apiKey # NEW command
$ linear-create cfg show       # Still works (alias)
```

### Hybrid Approach (Best of Both Worlds)

`linear-create` adopts a **hybrid approach** that combines:

✅ **From `gh`**: CRUD verb consistency, action aliases, `--web` flag
✅ **From `linear-create`**: Non-interactive default, resource aliases, explicit opt-in

This approach provides:
- **Familiarity** for `gh` users (same command patterns)
- **Scriptability** for automation (non-interactive by default)
- **Flexibility** for different workflows (interactive mode available)
- **Consistency** across resource types (initiatives, projects, issues)

---

## Command Structure Pattern

### Resource-Action Pattern

All commands follow the **resource-action** pattern:

```
linear-create <resource> <action> [arguments] [options]
```

**Examples:**
```bash
# Long form
linear-create initiatives list
linear-create initiatives set <id>
linear-create project create
linear-create config show
linear-create config set <key> <value>

# Short form (using aliases)
linear-create init list
linear-create init set <id>
linear-create proj create
linear-create cfg show
linear-create cfg set <key> <value>
```

### Command Hierarchy

```
linear-create (root)
├── initiatives|init (resource)
│   ├── list|ls (action) ✨ v0.5.0: added 'ls' alias
│   ├── view <id> (action) ✨ NEW in v0.5.0
│   ├── select (action)
│   └── set <id> (action)
├── project|proj (resource)
│   ├── create|new (action) ✨ v0.5.0: added 'new' alias
│   └── view <id> (action) ✨ NEW in v0.5.0
├── issues|iss (resource) [Coming Soon]
│   ├── create|new (stub) ✨ v0.5.0: added 'new' alias
│   └── list|ls (stub) ✨ v0.5.0: added 'ls' alias
├── teams|team (resource) [Coming Soon]
│   └── list|ls (stub) ✨ v0.5.0: added 'ls' alias
├── milestones|mile (resource) [Coming Soon]
│   └── list|ls (stub) ✨ v0.5.0: added 'ls' alias
├── labels|lbl (resource) [Coming Soon]
│   └── list|ls (stub) ✨ v0.5.0: added 'ls' alias
└── config|cfg (resource)
    ├── list|show (action) ✨ v0.5.0: renamed from 'show', kept as alias
    ├── get <key> (action) ✨ NEW in v0.5.0
    ├── set <key> <value> (action)
    └── unset <key> (action)
```

---

## Command Aliases

### Short Command Names

All resource commands have short aliases for faster typing. Both the long and short forms are always available and work identically.

**Alias Scheme: Natural Abbreviations (3-4 characters)**

| Resource | Alias | Length | Status | Rationale |
|----------|-------|--------|--------|-----------|
| `initiatives` | `init` | 4 chars | ✅ Available | Natural first syllable, commonly used abbreviation |
| `project` | `proj` | 4 chars | ✅ Available | Standard abbreviation for "project" |
| `config` | `cfg` | 3 chars | ✅ Available | Industry-standard abbreviation for "configuration" |
| `issues` | `iss` | 3 chars | 🚧 Stub | Natural abbreviation, plural form |
| `teams` | `team` | 4 chars | 🚧 Stub | Singular form (already short) |
| `milestones` | `mile` | 4 chars | 🚧 Stub | Natural word break at syllable |
| `labels` | `lbl` | 3 chars | 🚧 Stub | Common abbreviation for "label" |

### Usage Examples

**Both forms work identically:**

```bash
# Long form
linear-create initiatives list
linear-create project create --title "My Project"
linear-create config show

# Short form (aliases)
linear-create init list
linear-create proj create --title "My Project"
linear-create cfg show
```

### Help Output

When you run `--help`, both forms are displayed together:

```
Commands:
  initiatives|init    Manage Linear initiatives
  project|proj        Manage Linear projects
  issues|iss          Manage Linear issues [Coming Soon]
  teams|team          Manage Linear teams [Coming Soon]
  milestones|mile     Manage project milestones [Coming Soon]
  labels|lbl          Manage issue labels [Coming Soon]
  config|cfg          Manage configuration
```

### Stub Commands

Commands marked with `[Coming Soon]` are **stubs** - they are registered in the CLI but not yet fully implemented. Running stub commands will display a helpful message indicating:
- The command is not yet implemented
- A reference to MILESTONES.md for planned features and timeline

**Example:**
```bash
$ linear-create issues create
⚠️  This command is not yet implemented.
   See MILESTONES.md for planned features and timeline.
```

**Purpose of stubs:**
- Reserve command names and aliases early
- Allow users to discover planned features
- Prevent breaking changes when features are added
- Provide consistent help output across all planned commands

### Alias Naming Rules

**For future commands, follow these guidelines:**

1. **Length**: Aim for 3-4 characters
2. **Natural breaks**: Use natural syllable boundaries or word breaks
3. **Industry standards**: Prefer commonly-used abbreviations where they exist
4. **No conflicts**: Ensure alias doesn't conflict with existing or planned commands
5. **Memorable**: Choose abbreviations that are easy to remember and type

### Implementation Pattern

**Use Commander.js `.alias()` method:**

```typescript
const resource = cli
  .command('resource')
  .alias('short')  // Add alias here
  .description('Manage resource')
  .action(() => { resource.help(); });
```

---

## Interactive vs Non-Interactive Mode

### Philosophy: Non-Interactive by Default

**All commands default to non-interactive mode unless explicitly requested otherwise.**

This convention ensures:
- ✅ **Scriptability**: Commands work in CI/CD, scripts, and automation
- ✅ **Predictability**: Same input always produces same output
- ✅ **Clear errors**: Missing arguments show helpful error messages
- ✅ **Opt-in interactivity**: Users choose when they want prompts

### Rule: Non-Interactive is the Default

**Default Behavior (No Flags):**
1. Command executes without prompts
2. All required arguments must be provided
3. Missing arguments result in clear error messages with suggestions
4. Output goes to stdout/stderr for piping and redirection
5. Exit code 1 on error, 0 on success

**Example:**
```bash
$ linear-create proj create
❌ Error: --title is required

Provide the title:
  linear-create proj create --title "My Project"

Or use interactive mode:
  linear-create proj create --interactive
```

### Rule: Interactive Mode is Opt-In

**When to Support Interactive Mode:**
- Create/modify commands that need multiple fields
- Browse/select commands that benefit from keyboard navigation
- Commands where visual presentation helps decision-making

**How to Enable Interactive Mode:**
- Use `-I` or `--interactive` flag
- Must be explicitly specified by user
- Cannot be default behavior

**Example:**
```bash
# Non-interactive (default)
$ linear-create proj create --title "My Project" --state started

# Interactive (opt-in)
$ linear-create proj create --interactive
? Project title: _
? Description:
? State: [Use arrows to select]
  > planned
    started
    paused
```

### Command Categories

#### Category 1: Create/Modify Commands

**Purpose:** Create or modify resources

**Examples:** `project create`, `issues create`, `config set`

**Non-Interactive Mode (Default):**
- All required arguments must be provided via flags
- Error with helpful message if arguments missing
- Validates input and shows specific errors

**Interactive Mode (--interactive):**
- Form-based input with prompts
- Shows helpful defaults from config
- Inline validation with error messages
- Can be cancelled with Ctrl+C

**Implementation Pattern:**
```typescript
export async function createCommand(options: CreateOptions = {}) {
  if (options.interactive) {
    // Interactive mode: render Ink form
    render(<InteractiveForm options={options} />);
  } else {
    // Non-interactive mode: validate required args
    if (!options.title) {
      console.error('❌ Error: --title is required\n');
      console.error('Provide the title:');
      console.error('  command --title "Title"\n');
      console.error('Or use interactive mode:');
      console.error('  command --interactive\n');
      process.exit(1);
    }
    await createNonInteractive(options);
  }
}
```

#### Category 2: List/Browse Commands

**Purpose:** Display or browse resources (view only, does not save)

**Examples:** `initiatives list`, `issues list`, `teams list`

**Non-Interactive Mode (Default):**
- Output formatted list to stdout
- Support filtering via flags
- Machine-readable output (JSON with --json flag)

**Interactive Mode (--interactive):**
- Browse with keyboard navigation
- Live search/filter
- Preview pane with details
- **Note:** Browsing only - does not save selections. Use `select` commands to save choices.

**Implementation Pattern:**
```typescript
export async function listCommand(options: ListOptions = {}) {
  const items = await fetchItems(options);

  if (options.interactive) {
    // Interactive mode: browseable list
    render(<InteractiveList items={items} options={options} />);
  } else {
    // Non-interactive mode: print to stdout
    items.forEach(item => {
      console.log(`${item.id}\t${item.name}`);
    });
  }
}
```

#### Category 3: Select Commands

**Purpose:** Interactive selection from a list

**Examples:** `initiatives select`

**Behavior:**
- Always interactive (that's the purpose)
- May support `--id` flag for non-interactive use
- Validates selection and saves result

**Implementation Pattern:**
```typescript
export async function selectCommand(options: SelectOptions = {}) {
  if (options.id) {
    // Non-interactive with --id flag
    await validateAndSave(options.id);
  } else {
    // Interactive selection (default for select commands)
    const items = await fetchItems();
    render(<SelectList items={items} onSelect={handleSelect} />);
  }
}
```

#### Category 4: Read-Only Commands

**Purpose:** Display information

**Examples:** `config show`

**Behavior:**
- Only non-interactive mode exists
- No interactive mode needed
- Just displays formatted output

### Flag Conventions

**Interactive Mode Flags:**
- `-I` (short form, uppercase to avoid conflicts)
- `--interactive` (long form)
- Both should be supported

**Non-Interactive Mode Flags:**
- No flag needed (it's the default)
- Do NOT use `--no-interactive` (redundant)

**Example CLI Definitions:**
```typescript
.command('create')
  .option('-I, --interactive', 'Use interactive mode')
  .option('-t, --title <title>', 'Project title')
  .action(async (options) => {
    await createCommand(options);
  });
```

### Error Messages for Missing Arguments

**Template:**
```
❌ Error: <argument-name> is required

Provide <argument-name>:
  <command> <argument-flag> <example-value>

Or use interactive mode:
  <command> --interactive
```

**Example:**
```bash
$ linear-create proj create
❌ Error: --title is required

Provide the title:
  linear-create proj create --title "My Project"

Or use interactive mode:
  linear-create proj create --interactive
```

### Examples by Command

**project create:**
```bash
# Non-interactive (default) - ERROR if args missing
$ linear-create proj create
❌ Error: --title is required...

# Non-interactive with args
$ linear-create proj create --title "Q1 Planning"

# Interactive mode
$ linear-create proj create --interactive
```

**initiatives list:**
```bash
# Non-interactive list (default)
$ linear-create init list
init_abc123    Q1 2024
init_def456    Q2 2024
init_ghi789    H2 2024

# Interactive browse
$ linear-create init list --interactive
```

**initiatives select:**
```bash
# Interactive selection (default for select commands)
$ linear-create init select
> Q1 2024 (init_abc123)
  Q2 2024 (init_def456)

# Non-interactive with ID
$ linear-create init select --id init_abc123
```

**config show:**
```bash
# Non-interactive only (read-only command)
$ linear-create cfg show
📋 Linear Create Configuration
...
```

---

## Help Behavior Standards

### Rule 1: All Parent Commands Show Help

**Every parent command (resource) must have an explicit `.action()` that displays help when called without a subcommand.**

**Implementation:**
```typescript
const resource = cli
  .command('resource')
  .description('Manage resource')
  .action(() => {
    resource.help();
  });
```

**Required for:**
- Root command (`linear-create`)
- All resource commands (`initiatives`, `project`, `config`)

**Testing:**
```bash
$ linear-create              # Shows root help
$ linear-create config       # Shows config subcommands
$ linear-create initiatives  # Shows initiatives subcommands
$ linear-create project      # Shows project subcommands
```

### Rule 2: All Commands Include Examples

**Every action command must include practical examples using `.addHelpText('after', ...)`**

**Example:**
```typescript
.addHelpText('after', `
Examples:
  $ linear-create project create --title "My Project" --state started
  $ linear-create project create   # Interactive mode
`)
```

---

## Option and Argument Standards

### Rule 3: Use `.choices()` for Constrained Values

**For options with a fixed set of valid values, use `new Option().choices([...])`**

**Benefits:**
- Automatic validation by Commander.js
- Clearer help output showing all valid options
- Prevents invalid input with helpful error messages

**Example:**
```typescript
.addOption(
  new Option('-s, --state <state>', 'Project state')
    .choices(['planned', 'started', 'paused', 'completed', 'canceled'])
    .default('planned')
)
```

**Help Output:**
```
-s, --state <state>  Project state (choices: "planned", "started", "paused", "completed", "canceled", default: "planned")
```

### Rule 4: Use `.addArgument()` for Constrained Arguments

**For positional arguments with a fixed set of valid values, use `new Argument().choices([...])`**

**Example:**
```typescript
.command('set')
.addArgument(
  new Argument('<key>', 'Configuration key')
    .choices(['apiKey', 'defaultInitiative', 'defaultTeam'])
)
.addArgument(new Argument('<value>', 'Configuration value'))
```

**Help Output:**
```
Arguments:
  key      Configuration key (choices: "apiKey", "defaultInitiative", "defaultTeam")
  value    Configuration value
```

### Rule 5: Include Format Hints in Descriptions

**For IDs and structured values, include format hints in the description**

**Examples:**
```typescript
.option('-i, --initiative <id>', 'Initiative ID to link project to (format: init_xxx)')
.option('--team <id>', 'Team ID to assign project to (format: team_xxx)')
.option('-t, --title <title>', 'Project title (minimum 3 characters)')
.command('set <id>')
.description('Set default initiative by ID (format: init_xxx)')
```

### Rule 6: Document Defaults Clearly

**When options have default values, specify them in both `.default()` and description**

**Example:**
```typescript
.option('-g, --global', 'Save to global config (default)')
.option('-p, --project', 'Save to project config')
```

---

## Validation Approach

### Two-Tier Validation Strategy

1. **Commander.js Validation (Immediate)**
   - Use `.choices()` for options
   - Use `.addArgument()` with `.choices()` for arguments
   - Commander automatically rejects invalid values
   - Provides clear error messages

2. **Application Validation (Runtime)**
   - API key format validation (`lin_api_xxx`)
   - API key authentication test (Linear API connection)
   - Initiative/Team existence validation (Linear API query)
   - Project name duplication check (Linear API query)
   - Title length validation (minimum 3 characters)

**Example Flow:**
```
User Input → Commander Validation → Application Logic → Linear API Validation → Success/Error
```

### Validation Error Messages

**Format:**
```
❌ Error: <clear description of what went wrong>
   <optional: suggestion for how to fix>
```

**Examples:**
```
❌ Error: Title must be at least 3 characters
❌ Error: A project named "My Project" already exists
   Please choose a different name
❌ Error: Invalid API key format. API keys should start with "lin_api_"
❌ Error: Initiative with ID "init_invalid" not found
```

---

## Examples and Help Text

### Rule 7: Provide Complete Examples

**Every command must have at least one example showing typical usage**

**Guidelines:**
- Show the most common use case first
- Include examples for all major options/flags
- Include both interactive and non-interactive modes (if applicable)
- Use realistic but fictional data (init_abc123, team_xyz789)
- Add inline comments for clarity (using `#`)

**Template:**
```typescript
.addHelpText('after', `
Examples:
  $ linear-create <command> <basic-usage>
  $ linear-create <command> <with-options> --flag value
  $ linear-create <command>   # Special mode/note
`)
```

### Rule 8: Help Text Formatting

**Consistent formatting for help text:**
- Use 2-space indentation for examples
- Include the `$` prompt prefix
- Add blank line before "Examples:" section
- Add inline comments after `#` for explanation
- Keep examples concise (one line when possible)

---

## Naming Conventions

### Commands and Subcommands

- **Lowercase:** All command names use lowercase
- **Kebab-case:** Multi-word commands use hyphens (e.g., `linear-create`)
- **Verbs for actions:** Action commands use verbs (list, set, create, show, unset)
- **Nouns for resources:** Resource commands use nouns (initiatives, project, config)

### Options and Flags

- **Long form:** `--option-name` (kebab-case)
- **Short form:** `-o` (single letter, common options only)
- **Boolean flags:** Use `--flag` for true, `--no-flag` for false
- **Value options:** Use `--option <value>` format

**Common Flags:**
```
-g, --global     # Apply to global config
-p, --project    # Apply to project config
-t, --title      # Title value
-d, --description # Description value
-s, --state      # State value
-i, --initiative # Initiative ID
-h, --help       # Show help (auto-added by Commander)
-V, --version    # Show version (auto-added by Commander)
```

### Arguments

- **Required:** `<argument>`
- **Optional:** `[argument]`
- **Variadic:** `<argument...>` or `[argument...]`
- **Descriptive:** Use clear names (id, key, value, title)

### ID Formats

Linear API uses prefixed IDs:
- **Initiatives:** `init_` prefix (e.g., `init_abc123`)
- **Teams:** `team_` prefix (e.g., `team_xyz789`)
- **Projects:** `PRJ-` prefix (e.g., `PRJ-123`)
- **API Keys:** `lin_api_` prefix (e.g., `lin_api_xxx...`)

---

## Implementation Checklist

When adding a new command, ensure:

### Command Definition
- [ ] Follows resource-action pattern
- [ ] Uses `.description()` with clear, concise text
- [ ] Parent commands have `.action(() => { command.help(); })`

### Options and Arguments
- [ ] Constrained values use `.choices()`
- [ ] All options have clear descriptions
- [ ] Format hints included where applicable (init_xxx, team_xxx)
- [ ] Defaults documented in both `.default()` and description
- [ ] Required vs optional clearly indicated

### Validation
- [ ] Commander validation for constrained values
- [ ] Application validation for formats and business logic
- [ ] Clear error messages with suggestions
- [ ] Handles edge cases gracefully

### Help and Examples
- [ ] `.addHelpText('after', ...)` with examples
- [ ] At least one example per major use case
- [ ] Examples show realistic but fictional data
- [ ] Inline comments for clarity
- [ ] Consistent formatting (2-space indent, `$` prefix)

### Testing
- [ ] `--help` flag works correctly
- [ ] Parent command shows help without subcommand
- [ ] Invalid choices rejected with clear error
- [ ] Examples in help text actually work
- [ ] Edge cases handled

---

## Commander.js Reference

### Imports
```typescript
import { Command, Option, Argument } from 'commander';
```

### Creating Commands
```typescript
const cmd = cli.command('name').description('...');
```

### Adding Options with Choices
```typescript
.addOption(
  new Option('-f, --flag <value>', 'Description')
    .choices(['option1', 'option2'])
    .default('option1')
)
```

### Adding Arguments with Choices
```typescript
.addArgument(
  new Argument('<arg>', 'Description')
    .choices(['choice1', 'choice2'])
)
```

### Adding Help Examples
```typescript
.addHelpText('after', `
Examples:
  $ command example
`)
```

### Adding Default Action for Help
```typescript
.action(() => {
  commandName.help();
})
```

---

## Version History

- **v0.5.0** - GitHub CLI pattern alignment (2025)
  - Added `view <id>` commands for initiatives and projects
  - Added action aliases (`new`→`create`, `ls`→`list`)
  - Added `--web` flag for browser fallback
  - Standardized config commands (`list` + `get`)
  - Comprehensive gh CLI comparison documentation
- **v0.4.0** - Project creation with interactive and non-interactive modes (2024)
- **v0.3.0** - Initiative listing and selection (2024)
- **v0.2.0** - Configuration management (2024)
- **v0.1.0** - Initial CLI foundation (2024)

---

## Roadmap

For planned features, upcoming versions, and future enhancements, see [MILESTONES.md](./MILESTONES.md).

---

## Future Considerations

### Planned Enhancements
- Tab completion support
- Shell aliases and shortcuts
- Command output formatting (JSON, YAML, table)
- Verbosity levels (`--verbose`, `--quiet`)
- Confirmation prompts for destructive actions
- Progress indicators for long-running operations

### Consistency Guidelines for Future Commands
- Follow this document strictly
- Update this document when patterns evolve
- Add examples to test.md for all new commands
- Document breaking changes in MILESTONES.md
- Test help output thoroughly
