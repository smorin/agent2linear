# Output Streams & Format Standardization Proposal

## Executive Summary

**Problem:** Current implementation mixes human-readable messages with machine-readable data on stdout, making automation difficult. Progress messages, success confirmations, and data output all go to the same stream.

**Proposal:** Separate concerns by routing human messages to stderr and structured data to stdout, following Unix conventions and best practices from tools like `kubectl`, `gh`, `jq`, and `aws-cli`.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
   - 1.1 [Current Output Library](#11-current-output-library)
   - 1.2 [Current Format Support](#12-current-format-support)
   - 1.3 [Format Machine-Readability Analysis](#13-format-machine-readability-analysis)
   - 1.4 [Current Output Examples](#14-current-output-examples)
2. [The Problem: Mixed Output Streams](#2-the-problem-mixed-output-streams)
3. [Best Practices from Major CLIs](#3-best-practices-from-major-clis)
4. [Proposed Solution: Stream Separation](#4-proposed-solution-stream-separation)
5. [Default Format Strategy](#5-default-format-strategy)
6. [Implementation Guidelines](#6-implementation-guidelines)
7. [Migration Path](#7-migration-path)
8. [Examples & Use Cases](#8-examples--use-cases)
9. [Backward Compatibility](#9-backward-compatibility)
10. [Technical Implementation](#10-technical-implementation)

---

## 1. Current State Analysis

### 1.1 Current Output Library

**Location:** `src/lib/output.ts`

**Current Stream Usage:**

| Function | Output Stream | Current Use | Issue |
|----------|--------------|-------------|-------|
| `showSuccess()` | **stdout** (`console.log`) | Success messages with emojis | ❌ Pollutes data output |
| `showError()` | **stderr** (`console.error`) | Error messages | ✅ Correct |
| `showInfo()` | **stdout** (`console.log`) | Informational tips | ❌ Pollutes data output |
| `showWarning()` | **stdout** (`console.log`) | Warning messages | ❌ Should be stderr |
| `showValidating()` | **stdout** (`console.log`) | Progress messages | ❌ Pollutes data output |
| `showResolvedAlias()` | **stdout** (`console.log`) | Alias resolution | ❌ Pollutes data output |

**Code References:**
- `output.ts:26` - `showResolvedAlias()` uses `console.log`
- `output.ts:39` - `showValidating()` uses `console.log`
- `output.ts:73` - `showSuccess()` uses `console.log`
- `output.ts:94` - `showError()` uses `console.error` ✅
- `output.ts:110` - `showInfo()` uses `console.log`
- `output.ts:122` - `showWarning()` uses `console.log`

---

### 1.2 Current Format Support

**Commands with Format Support:**
- ✅ `project list` - Supports `--format table|json|tsv` (`list.tsx:352`)

**Commands without Format Support:**
- ❌ `project view` (`view.ts`) - Human-formatted console output only
- ❌ `project create` (`create.tsx`) - Human-formatted via `displaySuccess()`
- ❌ `project update` (`update.ts`) - Human-formatted via `showSuccess()`
- ❌ `project add-milestones` (`add-milestones.ts`) - Human-formatted via `showSuccess()`
- ❌ `project dependencies list` (`dependencies/list.ts`) - Plain console output
- ❌ `project dependencies add/remove/clear` - Human-formatted via `showSuccess()`
- ❌ All other entity commands (issues, teams, initiatives, etc.)

**Impact:** These commands cannot be used in automated scripts without fragile text parsing.

---

### 1.3 Format Machine-Readability Analysis

**Key Finding:** TSV is **NOT 100% machine-readable** due to inconsistencies with the default table format.

**Comparison Table:**

| Aspect | Default (Table) | TSV | JSON |
|--------|----------------|-----|------|
| **Machine-Readable** | ❌ No | ⚠️ Partial (80%) | ✅ Yes (100%) |
| **Field Truncation** | ✅ Yes (Status/Team/Lead) | ❌ No truncation | ❌ No truncation |
| **Summary Line** | ✅ Yes (`Total: N projects`) | ❌ No | ❌ No |
| **Header Row** | ✅ Yes | ✅ Yes | ❌ N/A |
| **Preview Truncation** | ✅ 60 chars | ✅ 60 chars | ✅ 60 chars |
| **Tab Escaping** | ❌ N/A | ❌ **MISSING** | ✅ N/A (JSON) |
| **Structured Data** | ❌ No | ❌ No | ✅ Yes |
| **Parseable by Standard Tools** | ❌ No | ⚠️ Partial | ✅ Yes (jq, etc.) |
| **Consistent Schema** | ❌ No | ⚠️ Partial | ✅ Yes |

**TSV Issues (Why Only 80% Machine-Readable):**

1. **No Tab Escaping:** If project title or description contains tab characters, TSV parsing breaks
   - No escaping/quoting mechanism implemented
   - Standard TSV parsers would fail or misalign columns

2. **Content Truncation:** Preview content still limited to 60 characters (same as table format)
   - Code: `list.tsx:160-163`
   ```typescript
   return cleaned.length > 60
     ? cleaned.substring(0, 57) + '...'
     : cleaned;
   ```

3. **Field Length Inconsistency:** Table truncates fields, TSV doesn't
   - **Table format** (`list.tsx:186-188`):
     ```typescript
     const status = (project.status?.name || '').substring(0, 11);
     const team = (project.team?.name || '').substring(0, 14);
     const lead = (project.lead?.name || '').substring(0, 19);
     ```
   - **TSV format** (`list.tsx:227-229`):
     ```typescript
     const status = project.status?.name || '';
     const team = project.team?.name || '';
     const lead = project.lead?.name || '';
     ```
   - **Impact:** Same headers, different data lengths; parsers expecting 11-char status get 30-char status

4. **Code Duplication:** ~70% of code duplicated between `formatTableOutput()` and `formatTSVOutput()`
   - Header generation: `list.tsx:176-180` vs `219-223`
   - Dependency column handling: `list.tsx:191-196` vs `232-237`
   - Loop structure: `list.tsx:183-202` vs `226-243`
   - **Maintenance Risk:** Changes require updating 2 functions; easy to introduce bugs

**JSON Excellence (100% Machine-Readable):**
- ✅ Standard format, parseable by any JSON library
- ✅ No truncation (except preview - same 60 char limit as others)
- ✅ No summary lines, pure data output
- ✅ Structured data with nested objects for status/team/lead
- ✅ Works perfectly with `jq`, `jd`, and other JSON tools

**Example Usage:**
```bash
# Count projects
a2l project list --format json | jq 'length'

# Get project IDs
a2l project list --format json | jq -r '.[].id'

# Filter by team
a2l project list --format json | jq '.[] | select(.team.name == "Engineering")'
```

---

### 1.4 Current Output Examples

**Example 1: `project create` (mixed output)**
```bash
$ a2l project create --title "Test" --team eng
🔍 Validating team ID: eng...
   ✓ Team found: Engineering
📎 Resolved alias "eng" to team_abc123

✅ Project created successfully!
   Name: Test
   ID: proj_xyz789
   URL: https://linear.app/myorg/project/test-123
   State: planned
   Team: Engineering
```

**Problem:** Cannot extract just the project ID for automation:
```bash
# This fails - gets emojis and labels mixed in
PROJECT_ID=$(a2l project create --title "Test" --team eng | grep "ID:" | cut -d: -f2)
```

**Example 2: `project list --format json` (clean output)**
```bash
$ a2l project list --format json
[
  {
    "id": "proj_abc123",
    "name": "Test Project",
    ...
  }
]
```

**Success:** Clean JSON output, but only available for `list` command.

---

## 2. The Problem: Mixed Output Streams

### 2.1 What Goes Wrong

**Scenario: Create project and get ID**

```bash
# User wants to automate project creation and extract ID
PROJECT_ID=$(a2l project create --title "API v2" --team eng | grep "ID:" | cut -d: -f2)

echo "Created project: $PROJECT_ID"
# Output: Created project:  proj_xyz789
#                           ^ Extra space from formatting

# But if we add more validation messages later, this breaks:
# Output: Created project:  eng...
#                           ^ Grabbed wrong line!
```

**Why It Fails:**
1. Progress messages on stdout (`🔍 Validating team ID: eng...`)
2. Success message on stdout (`✅ Project created successfully!`)
3. Data mixed with labels (`   ID: proj_xyz789`)
4. No machine-readable format option

---

### 2.2 Impact on Automation

**Current Workarounds (Fragile):**

```bash
# Fragile: Depends on emoji, label format, line order
a2l project create ... | grep "ID:" | awk '{print $2}'

# Fragile: Depends on line position
a2l project view proj_123 | sed -n '3p' | cut -d: -f2

# Fragile: Can't filter out progress messages
a2l project list | tail -n +2 | grep -v "Total:"
```

**What Users Want (Robust):**

```bash
# Clean: Only data on stdout, structured format
PROJECT_ID=$(a2l project create --title "Test" --team eng --format json | jq -r '.id')

# Clean: Pipe JSON directly
a2l project list --format json | jq '.[] | select(.team.name == "Engineering")'

# Clean: TSV for processing
a2l project list --format tsv | cut -f1,2 | while IFS=$'\t' read id name; do
  echo "Processing $name ($id)"
done
```

---

## 3. Best Practices from Major CLIs

### 3.1 Unix Philosophy

**Standard Practice:**
- **stdout** = Data output (structured, machine-readable)
- **stderr** = Human messages (progress, errors, warnings)

**Rationale:**
> "Write programs that do one thing and do it well. Write programs to work together."
> — Doug McIlroy, Unix Philosophy

Separating data from messages allows composition:
```bash
command1 | command2 | command3    # Data flows through pipeline
                                   # Messages appear on terminal
```

---

### 3.2 Examples from Popular CLIs

#### kubectl (Kubernetes CLI)

**Stream Separation:**
```bash
# Data goes to stdout
$ kubectl get pods -o json
{"items": [...]}

# Progress/status goes to stderr
$ kubectl apply -f deployment.yaml
deployment.apps/myapp created        # stderr
deployment.apps/myapp configured      # stderr

# Verify: Redirect stderr to suppress messages
$ kubectl apply -f deployment.yaml 2>/dev/null
# (no output - all messages were on stderr)
```

**Format Options:**
- `-o json` - Full JSON output
- `-o yaml` - YAML output
- `-o name` - Simple name output
- `-o wide` - Wide table format
- Default: Human-readable table

---

#### gh (GitHub CLI)

**Stream Separation:**
```bash
# Data goes to stdout
$ gh pr list --json number,title
[{"number": 123, "title": "Fix bug"}]

# Progress goes to stderr
$ gh pr create --title "Fix" --body "Description"
Creating pull request for branch fix-123     # stderr
https://github.com/org/repo/pull/456         # stdout (URL only)

# Quiet mode: Only data, no messages
$ gh pr list --json number,title --jq '.[0].number'
123
```

**Format Options:**
- `--json <fields>` - JSON output with specified fields
- `--jq <expression>` - JSON + jq filter in one command
- `--template <template>` - Custom Go template
- Default: Human-readable table

---

#### aws-cli (AWS CLI)

**Stream Separation:**
```bash
# Data goes to stdout
$ aws ec2 describe-instances --output json
{"Reservations": [...]}

# Errors go to stderr
$ aws ec2 describe-instances --invalid-param
An error occurred (InvalidParameterValue)...  # stderr

# Progress indicators (if enabled) go to stderr
$ aws s3 cp file.zip s3://bucket/ --progress
Completed 1.0 MiB/10.0 MiB (10.0%)            # stderr
```

**Format Options:**
- `--output json` - JSON output (default)
- `--output text` - Tab-separated text
- `--output table` - ASCII table
- `--query <jmespath>` - Filter JSON output

---

#### jq (JSON processor)

**Stream Separation:**
```bash
# Data goes to stdout
$ echo '{"name": "test"}' | jq '.name'
"test"

# Parse errors go to stderr
$ echo '{invalid}' | jq '.'
parse error: Invalid JSON at line 1, column 2  # stderr

# Redirect stderr to hide errors
$ jq '.field' file.json 2>/dev/null
```

**Key Insight:** All data on stdout, all diagnostics on stderr. Enables clean pipelines.

---

### 3.3 Common Patterns

**Pattern 1: Default Human-Readable, Opt-in Machine-Readable**

```bash
# Default: Human-friendly table
$ kubectl get pods
NAME                    READY   STATUS    RESTARTS   AGE
myapp-123456789-abc12   1/1     Running   0          10m

# Opt-in: Machine-readable JSON
$ kubectl get pods -o json
{"apiVersion": "v1", "items": [...]}
```

**Pattern 2: Progress on stderr, Data on stdout**

```bash
# All progress/status on stderr
$ gh pr create --title "Fix"
Creating pull request...              # stderr
✓ Created pull request #123           # stderr
https://github.com/org/repo/pull/123  # stdout

# Pipeline works - URL passes through
$ gh pr create --title "Fix" | xargs curl -I
# (progress messages appear on terminal, URL pipes to curl)
```

**Pattern 3: Quiet/Silent Modes**

```bash
# Suppress all non-error messages
$ kubectl apply -f file.yaml --quiet
# (no output unless error occurs)

# Suppress stderr for clean piping
$ command 2>/dev/null
# (only stdout data remains)
```

---

## 4. Proposed Solution: Stream Separation

### 4.1 Core Principle

**RULE: Separate Data from Messages**

| Output Type | Stream | When | Examples |
|-------------|--------|------|----------|
| **Data** | stdout | Always, when format specified | JSON, TSV, IDs, URLs |
| **Progress** | stderr | During operations | "Validating...", "Creating..." |
| **Success** | stderr | After operations | "✅ Project created" |
| **Errors** | stderr | On failure | "❌ Team not found" |
| **Warnings** | stderr | Issues detected | "⚠️ Deprecated flag" |
| **Info/Tips** | stderr | Helpful hints | "💡 Use --help" |

---

### 4.2 Updated Output Library

**Proposed Changes to `src/lib/output.ts`:**

```typescript
/**
 * All human-readable messages go to stderr
 * Only structured data goes to stdout
 */

// CHANGE: console.log → console.error (uses stderr)
export function showResolvedAlias(alias: string, id: string): void {
  console.error(`📎 Resolved alias "${alias}" to ${id}`);
}

// CHANGE: console.log → console.error (uses stderr)
export function showValidating(entityType: string, id: string): void {
  console.error(`🔍 Validating ${entityType} ID: ${id}...`);
}

// CHANGE: console.log → console.error (uses stderr)
export function showValidated(entityType: string, name: string): void {
  console.error(`   ✓ ${capitalize(entityType)} found: ${name}`);
}

// CHANGE: console.log → console.error (uses stderr)
export function showSuccess(message: string, details?: Record<string, string>): void {
  console.error(`\n✅ ${message}`);
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.error(`   ${key}: ${value}`);
    }
  }
  console.error();
}

// ALREADY CORRECT: Uses console.error
export function showError(message: string, hint?: string): void {
  console.error(`❌ ${message}`);
  if (hint) {
    console.error(`   ${hint}`);
  }
}

// CHANGE: console.log → console.error (uses stderr)
export function showInfo(message: string): void {
  console.error(`\n💡 ${message}\n`);
}

// CHANGE: console.log → console.error (uses stderr)
export function showWarning(message: string): void {
  console.error(`⚠️  ${message}`);
}
```

**Summary of Changes:**
- 6 functions need updates: `showResolvedAlias`, `showValidating`, `showValidated`, `showSuccess`, `showInfo`, `showWarning`
- 1 function already correct: `showError`

---

### 4.3 Command Output Strategy

**Strategy:**

```typescript
/**
 * Command output follows this pattern:
 *
 * 1. If --format specified (json|tsv):
 *    - Write ONLY structured data to stdout
 *    - Write ALL messages to stderr
 *
 * 2. If --format not specified (default):
 *    - Write human-friendly output to stdout (for backward compatibility)
 *    - Or write to stderr (for future mode)
 *
 * 3. If --quiet flag:
 *    - Suppress all non-error messages (no progress, no success)
 *    - Still write data to stdout if format specified
 *    - Still write errors to stderr
 */
```

**Implementation Pattern:**

```typescript
export async function createProjectCommand(options: CreateOptions) {
  try {
    // Progress messages → stderr (or suppressed if --quiet)
    if (!options.quiet) {
      showValidating('team', teamId);
      showValidated('team', team.name);
    }

    // Create project
    const project = await linearClient.createProject({...});

    // Output result based on format
    if (options.format === 'json') {
      // Data → stdout (clean JSON)
      console.log(JSON.stringify(project, null, 2));
    } else if (options.format === 'tsv') {
      // Data → stdout (clean TSV)
      console.log(`${project.id}\t${project.name}\t${project.url}`);
    } else {
      // Default: Human-friendly → stdout (backward compatible)
      // OR → stderr (future mode)
      showSuccess('Project created successfully!', {
        'Name': project.name,
        'ID': project.id,
        'URL': project.url,
      });
    }

  } catch (error) {
    // Errors → stderr (always)
    showError(error.message);
    process.exit(1);
  }
}
```

---

## 5. Default Format Strategy

### 5.1 Proposed Default Behavior

**Question:** What should the default format be when no `--format` flag is specified?

**Recommendation:** **Human-Readable Table/Text (Current Behavior)**

**Rationale:**
1. **User Experience:** Most users run commands interactively and want pretty output
2. **Backward Compatibility:** Existing scripts/users expect current format
3. **Progressive Enhancement:** Users opt into machine-readable formats
4. **Industry Standard:** Matches `kubectl`, `gh`, `aws-cli` behavior

**Format Hierarchy:**

```
Default (No flag)  →  Human-readable (table/text with emojis)
                      - Easy to read
                      - Pretty formatting
                      - Colored output (if TTY)

--format table     →  Human-readable table (explicit)
                      - Tab-separated for easy parsing
                      - Still readable by humans
                      - No emojis (cleaner)

--format json      →  Machine-readable JSON
                      - Valid JSON
                      - Pipeable to jq
                      - Full data structure

--format tsv       →  Machine-readable TSV
                      - Tab-separated values
                      - Proper escaping
                      - Import to Excel/scripts
```

---

### 5.2 Format Decision Tree

```
User runs command
    │
    ├─ No --format flag
    │   └─> Output: Human-readable (emojis, formatting)
    │       Stream: stdout (backward compatible)
    │       Messages: stderr (progress, success, errors)
    │
    ├─ --format json
    │   └─> Output: Valid JSON
    │       Stream: stdout (data only)
    │       Messages: stderr (progress, success, errors)
    │
    ├─ --format tsv
    │   └─> Output: Tab-separated values (with escaping)
    │       Stream: stdout (data only)
    │       Messages: stderr (progress, success, errors)
    │
    └─ --format table
        └─> Output: Clean table (no emojis)
            Stream: stdout (data only)
            Messages: stderr (progress, success, errors)
```

---

### 5.3 Special Flags

**`--quiet` / `-q` Flag:**
- Suppress all non-error messages (progress, success, info)
- Still output data to stdout
- Still output errors to stderr

```bash
# Normal: Progress messages on stderr
$ a2l project create --title "Test" --team eng --format json
🔍 Validating team ID: eng...         # stderr
   ✓ Team found: Engineering          # stderr
{"id": "proj_123", "name": "Test"}    # stdout

# Quiet: No progress messages
$ a2l project create --title "Test" --team eng --format json --quiet
{"id": "proj_123", "name": "Test"}    # stdout (only)
```

**`--verbose` / `-v` Flag:**
- Show additional debug information
- All debug messages go to stderr
- Useful for troubleshooting

```bash
# Normal: Basic messages
$ a2l project create --title "Test" --team eng
🔍 Validating team ID: eng...
✅ Project created successfully!

# Verbose: Additional details
$ a2l project create --title "Test" --team eng --verbose
🔍 Validating team ID: eng...
   API call: GET /teams/team_123     # stderr (debug)
   Response: 200 OK                   # stderr (debug)
   ✓ Team found: Engineering
🔍 Creating project...
   API call: POST /projects           # stderr (debug)
   Request: {...}                     # stderr (debug)
   Response: 201 Created              # stderr (debug)
✅ Project created successfully!
```

**`--no-progress` Flag:**
- Suppress progress indicators only
- Keep success/error messages
- Useful for logging

```bash
# Normal: Shows progress
$ a2l project create --title "Test" --team eng
🔍 Validating team ID: eng...          # progress (stderr)
✅ Project created successfully!        # success (stderr)

# No progress: Only final result
$ a2l project create --title "Test" --team eng --no-progress
✅ Project created successfully!        # success (stderr)
```

---

## 6. Implementation Guidelines

### 6.1 Command Structure Template

**Every command should follow this pattern:**

```typescript
import { showSuccess, showError, showValidating } from '../../lib/output.js';

interface CommandOptions {
  format?: 'json' | 'tsv' | 'table';  // Output format
  quiet?: boolean;                     // Suppress non-error messages
  verbose?: boolean;                   // Show debug info
  // ... other command-specific options
}

export async function myCommand(options: CommandOptions) {
  try {
    // 1. VALIDATION PHASE
    // Progress messages → stderr (unless --quiet)
    if (!options.quiet) {
      showValidating('team', options.team);
    }

    // Validation logic
    const team = await validateTeam(options.team);

    if (!options.quiet) {
      showValidated('team', team.name);
    }

    // 2. OPERATION PHASE
    // Progress messages → stderr (unless --quiet)
    if (!options.quiet && options.verbose) {
      console.error('🔧 Creating project...');
    }

    const result = await performOperation();

    // 3. OUTPUT PHASE
    // Data → stdout (based on format)
    // Messages → stderr

    if (options.format === 'json') {
      // JSON: Only data on stdout
      console.log(JSON.stringify(result, null, 2));
    } else if (options.format === 'tsv') {
      // TSV: Only data on stdout (with header)
      console.log('id\tname\turl');
      console.log(`${result.id}\t${result.name}\t${result.url}`);
    } else {
      // Default: Human-friendly output
      if (!options.quiet) {
        showSuccess('Operation completed!', {
          'ID': result.id,
          'Name': result.name,
          'URL': result.url,
        });
      }
    }

  } catch (error) {
    // Errors → stderr (always, even with --quiet)
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
```

---

### 6.2 Format Implementation Checklist

For each command that returns data:

**Required:**
- [ ] Add `--format <type>` option to command definition
- [ ] Support `json` format (minimum requirement)
- [ ] Route all human messages to stderr
- [ ] Route all data to stdout (when format specified)
- [ ] Handle errors on stderr

**Recommended:**
- [ ] Support `tsv` format for tabular data
- [ ] Support `table` format (explicit human-readable)
- [ ] Add `--quiet` flag to suppress messages
- [ ] Add `--verbose` flag for debug info

**Optional:**
- [ ] Support `--no-progress` flag
- [ ] Support `csv` format (like TSV but comma-separated)
- [ ] Support `yaml` format (for complex nested data)

---

### 6.3 TSV Format Requirements

**TSV must be properly escaped to be machine-readable:**

```typescript
function formatTSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  const str = String(value);

  // Escape tabs, newlines, carriage returns
  return str
    .replace(/\t/g, '\\t')   // Tab → \t
    .replace(/\n/g, '\\n')   // Newline → \n
    .replace(/\r/g, '\\r');  // CR → \r
}

function outputTSV(items: any[], fields: string[]): void {
  // Header row
  console.log(fields.join('\t'));

  // Data rows
  for (const item of items) {
    const row = fields.map(field => formatTSVField(item[field]));
    console.log(row.join('\t'));
  }
}
```

**Example Output:**

```bash
$ a2l project list --format tsv
id      name    description
proj_1  API     Redesign\nthe API
proj_2  Web     Mobile\tand\tDesktop
```

**Parsing (works correctly):**

```python
import csv
with open('output.tsv') as f:
    reader = csv.reader(f, delimiter='\t')
    for row in reader:
        print(row)
# ['id', 'name', 'description']
# ['proj_1', 'API', 'Redesign\\nthe API']      # \n escaped, not actual newline
# ['proj_2', 'Web', 'Mobile\\tand\\tDesktop']  # \t escaped, not actual tab
```

---

## 7. Migration Path

### 7.1 Phase 1: Add Format Support (Non-Breaking)

**Target:** Add `--format` to read commands without changing default behavior

**Commands to Update:**
1. ✅ `project list` (already done)
2. 🎯 `project view`
3. 🎯 `project dependencies list`
4. 🎯 `issue list` (if exists)
5. 🎯 `issue view` (if exists)
6. 🎯 Other list/view commands

**Changes:**
- Add `--format json|tsv|table` option
- When `--format` specified: Output data to stdout, messages to stderr
- When `--format` not specified: Keep current behavior (backward compatible)

**Example:**

```typescript
// Before: Only human-readable output
export async function viewProject(id: string) {
  const project = await getProject(id);
  console.log(`Name: ${project.name}`);
  console.log(`ID: ${project.id}`);
  // ...
}

// After: Support formats
export async function viewProject(id: string, options: { format?: string }) {
  const project = await getProject(id);

  if (options.format === 'json') {
    console.log(JSON.stringify(project, null, 2));
  } else if (options.format === 'tsv') {
    console.log('id\tname\turl');
    console.log(`${project.id}\t${project.name}\t${project.url}`);
  } else {
    // Default: Keep current behavior
    console.log(`Name: ${project.name}`);
    console.log(`ID: ${project.id}`);
  }
}
```

**Result:** Users can opt into machine-readable formats, existing scripts still work.

---

### 7.2 Phase 2: Move Messages to stderr (Non-Breaking)

**Target:** Route all human messages to stderr for commands that support `--format`

**Changes:**
- Update `output.ts` functions to use `console.error` instead of `console.log`
- Only affects commands with `--format` support
- When `--format` not specified: Messages still visible on terminal (stderr appears same as stdout for humans)

**Example:**

```typescript
// Before
export function showSuccess(message: string) {
  console.log(`✅ ${message}`);  // stdout
}

// After
export function showSuccess(message: string) {
  console.error(`✅ ${message}`);  // stderr
}
```

**User Impact:**
- **Terminal users:** No visible change (stderr and stdout both appear)
- **Script users:** Can now separate messages from data

```bash
# Before: Mixed output
$ a2l project list --format json
🔍 Loading projects...
[{"id": "proj_123"}]

# After: Clean separation
$ a2l project list --format json              # Terminal: See both messages and data
🔍 Loading projects...                         # stderr (visible)
[{"id": "proj_123"}]                           # stdout (visible)

$ a2l project list --format json 2>/dev/null  # Script: Hide messages
[{"id": "proj_123"}]                           # stdout only
```

**Result:** Automation works cleanly, humans see no difference.

---

### 7.3 Phase 3: Add Mutation Command Formats (Enhancement)

**Target:** Add `--format` to create/update commands

**Commands to Update:**
1. 🎯 `project create`
2. 🎯 `project update`
3. 🎯 `issue create`
4. 🎯 `issue update`
5. 🎯 Other mutation commands

**Changes:**
- Add `--format json|tsv` option
- Output created/updated entity in specified format
- Success messages go to stderr

**Example:**

```bash
# Before: Human-readable only
$ a2l project create --title "Test" --team eng
✅ Project created successfully!
   Name: Test
   ID: proj_123
   URL: https://linear.app/...

# After: Can extract ID for automation
$ PROJECT_ID=$(a2l project create --title "Test" --team eng --format json | jq -r '.id')
$ echo $PROJECT_ID
proj_123
```

**Result:** Full automation support for create/update workflows.

---

### 7.4 Phase 4: Add Global Flags (Enhancement)

**Target:** Add global flags for output control

**New Flags:**
- `--quiet` / `-q` - Suppress non-error messages
- `--verbose` / `-v` - Show debug information
- `--no-progress` - Suppress progress indicators

**Implementation:**

```typescript
// In src/cli.ts
program
  .option('-q, --quiet', 'Suppress non-error messages')
  .option('-v, --verbose', 'Show debug information')
  .option('--no-progress', 'Suppress progress indicators');
```

**Result:** Fine-grained control over output verbosity.

---

## 8. Examples & Use Cases

### 8.1 Interactive Use (Default Behavior)

**Scenario:** User creates a project interactively

```bash
$ a2l project create --title "Mobile App" --team mobile --initiative q1
🔍 Validating team ID: mobile...
   ✓ Team found: Mobile Team
🔍 Validating initiative ID: q1...
   ✓ Initiative found: Q1 2025 Goals

✅ Project created successfully!
   Name: Mobile App
   ID: proj_abc123
   URL: https://linear.app/myorg/project/mobile-app-abc123
   Team: Mobile Team
   Initiative: Q1 2025 Goals
```

**Experience:**
- Emojis and colors make it visually appealing
- Progress messages show what's happening
- Success message confirms completion
- All details clearly visible

---

### 8.2 Automation: Create and Use (JSON Format)

**Scenario:** Script creates a project and adds issues to it

```bash
#!/bin/bash

# Create project and extract ID
PROJECT_ID=$(a2l project create \
  --title "API v2" \
  --team backend \
  --format json \
  --quiet | jq -r '.id')

echo "Created project: $PROJECT_ID"

# Add issues to project
for issue in "Setup" "Implementation" "Testing"; do
  a2l issue create \
    --title "$issue" \
    --project "$PROJECT_ID" \
    --format json \
    --quiet > /dev/null
done

# Get project URL
PROJECT_URL=$(a2l project view "$PROJECT_ID" --format json | jq -r '.url')
echo "View project: $PROJECT_URL"
```

**Output:**

```
Created project: proj_abc123
View project: https://linear.app/myorg/project/api-v2-abc123
```

**Key Points:**
- `--format json` gives clean data on stdout
- `--quiet` suppresses all non-error messages
- `jq` extracts specific fields
- `2>/dev/null` suppresses any remaining stderr messages

---

### 8.3 Data Processing: Export to Spreadsheet (TSV Format)

**Scenario:** Export all projects to CSV for analysis

```bash
# Get all projects as TSV
$ a2l project list --all-teams --all-leads --format tsv > projects.tsv

# Preview first 5 rows
$ head -5 projects.tsv
id      name            status          team            lead            preview
proj_1  API Redesign    In Progress     Engineering     John Doe        Redesign the API...
proj_2  Mobile App      Planned         Mobile          Jane Smith      iOS and Android...
proj_3  Website         Active          Design          Bob Johnson     New homepage...
proj_4  DevOps          Active          Platform        Alice Chen      Infrastructure...

# Import to Excel (or open in Excel)
$ open projects.tsv

# Or process with awk
$ awk -F'\t' 'NR>1 && $3=="In Progress" {print $2}' projects.tsv
API Redesign
```

**Key Points:**
- TSV format is Excel-compatible
- No emojis or formatting to break parsing
- Header row for context
- Proper escaping prevents data corruption

---

### 8.4 Pipeline: Filter and Transform (JSON Format)

**Scenario:** Get all active projects for Engineering team, extract URLs

```bash
# Get projects, filter, transform
$ a2l project list \
  --team eng \
  --format json \
  2>/dev/null \
  | jq -r '.[] | select(.state == "active") | .url'

https://linear.app/myorg/project/api-v2-abc123
https://linear.app/myorg/project/mobile-app-xyz789
https://linear.app/myorg/project/infrastructure-def456
```

**Key Points:**
- JSON enables complex filtering with `jq`
- `2>/dev/null` hides progress messages
- Pipeline composition works cleanly

---

### 8.5 Error Handling

**Scenario:** Command fails, script needs to detect it

```bash
#!/bin/bash
set -e  # Exit on error

# Create project
PROJECT_JSON=$(a2l project create \
  --title "Test" \
  --team invalid_team \
  --format json \
  --quiet 2>&1)  # Capture both stdout and stderr

if [ $? -ne 0 ]; then
  echo "Error: Project creation failed"
  echo "$PROJECT_JSON"
  exit 1
fi

PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id')
echo "Success! Created project: $PROJECT_ID"
```

**Output (on error):**

```
Error: Project creation failed
❌ Team not found
   ID: invalid_team
```

**Key Points:**
- Errors go to stderr
- Exit codes indicate success/failure
- `2>&1` captures stderr for error messages

---

## 9. Backward Compatibility

### 9.1 Ensuring No Breaking Changes

**Goal:** Existing scripts and users should not break.

**Strategy:**

1. **Keep Default Behavior:**
   - When no `--format` flag: Output human-readable (current behavior)
   - Existing scripts without `--format` continue to work

2. **Additive Changes Only:**
   - New flags (`--format`, `--quiet`) are opt-in
   - No removal of existing output
   - No changes to exit codes

3. **Message Stream Changes Are Invisible:**
   - Moving messages from stdout to stderr is invisible to terminal users
   - Only affects users who explicitly redirect streams
   - Those users benefit from cleaner separation

---

### 9.2 Compatibility Testing

**Test Cases:**

```bash
# Test 1: Default behavior unchanged
$ a2l project list | wc -l
45  # Same line count as before

# Test 2: Filtering still works
$ a2l project list | grep "Engineering"
# (should still match project names)

# Test 3: New format flag works
$ a2l project list --format json | jq length
10  # Number of projects

# Test 4: Backward compatible piping
$ a2l project list | tail -n +2 | head -5
# (should still show projects)
```

---

### 9.3 Deprecation Strategy (If Needed)

**If we need to change default behavior later:**

1. **Announce deprecation:**
   - Add `showWarning()` for old behavior
   - Document new recommended approach
   - Provide migration timeline

2. **Add opt-in flag for new behavior:**
   - `--new-output-format` flag
   - Test with early adopters

3. **Switch default after grace period:**
   - Make new behavior default
   - Add `--legacy-output` flag to restore old behavior

4. **Remove legacy after longer period:**
   - Drop `--legacy-output` flag
   - Complete migration

**Timeline:**
- **v0.14:** Add `--format` support (Phase 1) ✅
- **v0.15:** Move messages to stderr (Phase 2)
- **v0.16:** Add mutation command formats (Phase 3)
- **v0.17:** Add global flags (Phase 4)
- **v1.0:** Consider changing defaults if needed

---

## 10. Technical Implementation

### 10.1 Updated Output Library

**File:** `src/lib/output.ts`

**Changes Required:**

```typescript
/**
 * CHANGE 1: Route all human messages to stderr
 */

export function showResolvedAlias(alias: string, id: string): void {
  console.error(`📎 Resolved alias "${alias}" to ${id}`);  // Changed: console.log → console.error
}

export function showValidating(entityType: string, id: string): void {
  console.error(`🔍 Validating ${entityType} ID: ${id}...`);  // Changed
}

export function showValidated(entityType: string, name: string): void {
  console.error(`   ✓ ${capitalize(entityType)} found: ${name}`);  // Changed
}

export function showSuccess(message: string, details?: Record<string, string>): void {
  console.error(`\n✅ ${message}`);  // Changed
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.error(`   ${key}: ${value}`);  // Changed
    }
  }
  console.error();  // Changed
}

export function showInfo(message: string): void {
  console.error(`\n💡 ${message}\n`);  // Changed
}

export function showWarning(message: string): void {
  console.error(`⚠️  ${message}`);  // Changed
}

// ALREADY CORRECT: showError() already uses console.error
export function showError(message: string, hint?: string): void {
  console.error(`❌ ${message}`);
  if (hint) {
    console.error(`   ${hint}`);
  }
}
```

**Total Changes:** 6 functions (change `console.log` → `console.error`)

---

### 10.2 New Helper Functions

**Add to `src/lib/output.ts`:**

```typescript
/**
 * ADDITION 1: Output formatted data to stdout
 */

export function outputJSON(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputTSV(items: any[], fields: string[]): void {
  // Header
  console.log(fields.join('\t'));

  // Rows
  for (const item of items) {
    const row = fields.map(field => formatTSVField(item[field]));
    console.log(row.join('\t'));
  }
}

function formatTSVField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Escape special characters
  return str
    .replace(/\\/g, '\\\\')  // Backslash → \\
    .replace(/\t/g, '\\t')   // Tab → \t
    .replace(/\n/g, '\\n')   // Newline → \n
    .replace(/\r/g, '\\r');  // CR → \r
}

/**
 * ADDITION 2: Conditional message output (respects --quiet)
 */

export function showMessage(
  message: string,
  options: { quiet?: boolean } = {}
): void {
  if (!options.quiet) {
    console.error(message);
  }
}

export function showProgress(
  message: string,
  options: { quiet?: boolean; noProgress?: boolean } = {}
): void {
  if (!options.quiet && !options.noProgress) {
    console.error(message);
  }
}

export function showDebug(
  message: string,
  options: { verbose?: boolean } = {}
): void {
  if (options.verbose) {
    console.error(`[DEBUG] ${message}`);
  }
}
```

---

### 10.3 Command Template

**Example: `project create` with format support**

```typescript
import {
  showSuccess,
  showError,
  showProgress,
  outputJSON,
  outputTSV
} from '../../lib/output.js';

interface CreateOptions {
  title: string;
  team: string;
  format?: 'json' | 'tsv';
  quiet?: boolean;
  verbose?: boolean;
  // ... other options
}

export async function createProject(options: CreateOptions) {
  try {
    // Validation phase
    showProgress('🔍 Validating team...', options);
    const team = await validateTeam(options.team);
    showProgress(`   ✓ Team found: ${team.name}`, options);

    // Creation phase
    showProgress('🔧 Creating project...', options);
    const project = await linearClient.createProject({
      title: options.title,
      teamId: team.id,
    });

    // Output phase
    if (options.format === 'json') {
      // JSON → stdout
      outputJSON(project);
    } else if (options.format === 'tsv') {
      // TSV → stdout
      outputTSV([project], ['id', 'name', 'url']);
    } else {
      // Human-readable → stderr (with success message)
      showSuccess('Project created successfully!', {
        'Name': project.name,
        'ID': project.id,
        'URL': project.url,
      });
    }

  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// CLI registration
export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new project')
    .requiredOption('-t, --title <title>', 'Project title')
    .requiredOption('--team <id>', 'Team ID or alias')
    .option('-f, --format <type>', 'Output format: json, tsv', undefined)
    .option('-q, --quiet', 'Suppress non-error messages')
    .option('-v, --verbose', 'Show debug information')
    .action(createProject);
}
```

---

### 10.4 Integration Test Updates

**Add tests for stream separation:**

```bash
#!/bin/bash
# tests/scripts/test-output-streams.sh

echo "Testing output stream separation..."

# Test 1: JSON output is clean (no messages on stdout)
OUTPUT=$(a2l project list --format json 2>/dev/null)
echo "$OUTPUT" | jq . > /dev/null || {
  echo "FAIL: JSON output is not valid JSON"
  exit 1
}
echo "PASS: JSON output is valid"

# Test 2: Progress messages go to stderr
STDERR=$(a2l project list --format json 2>&1 1>/dev/null)
if echo "$STDERR" | grep -q "🔍"; then
  echo "PASS: Progress messages on stderr"
else
  echo "INFO: No progress messages found (may be suppressed)"
fi

# Test 3: --quiet suppresses messages
OUTPUT_QUIET=$(a2l project list --format json --quiet 2>&1)
if echo "$OUTPUT_QUIET" | jq . > /dev/null 2>&1; then
  echo "PASS: --quiet mode works"
else
  echo "FAIL: --quiet mode produces non-JSON output"
  exit 1
fi

echo "All tests passed!"
```

---

## 11. Summary & Recommendations

### 11.1 Key Recommendations

**DO:**
1. ✅ **Separate streams:** Data on stdout, messages on stderr
2. ✅ **Default human-readable:** Keep current behavior as default
3. ✅ **Add format flags:** `--format json|tsv|table` for all read commands
4. ✅ **Support quiet mode:** `--quiet` flag to suppress messages
5. ✅ **Proper TSV escaping:** Escape tabs/newlines in TSV output
6. ✅ **Follow Unix conventions:** Match behavior of `kubectl`, `gh`, `aws-cli`

**DON'T:**
1. ❌ **Don't break backward compatibility:** Keep default behavior
2. ❌ **Don't mix streams:** No data on stderr, no messages on stdout (when format specified)
3. ❌ **Don't output summary lines in TSV/JSON:** Only pure data
4. ❌ **Don't truncate fields in machine-readable formats:** Full data only

---

### 11.2 Implementation Priority

**High Priority (Do First):**
1. Update `output.ts` to route messages to stderr (6 function changes)
2. Add `--format json` support to `project view` and `project dependencies list`
3. Fix TSV escaping in existing `project list` command
4. Add integration tests for stream separation

**Medium Priority (Do Next):**
5. Add `--format json` to `project create` and `project update`
6. Add `--quiet` flag as global option
7. Extend format support to issue commands
8. Add `--verbose` flag for debug output

**Low Priority (Nice to Have):**
9. Add `--format yaml` for complex nested data
10. Add `--format csv` as alternative to TSV
11. Add `--no-progress` flag
12. Add color output detection (auto-disable colors when piped)

---

### 11.3 Impact Assessment

**Changes Required:**

| File | Changes | Impact |
|------|---------|--------|
| `src/lib/output.ts` | 6 functions: `console.log` → `console.error` | Low risk |
| `src/commands/project/view.ts` | Add `--format` support | Medium effort |
| `src/commands/project/create.tsx` | Add `--format` support | Medium effort |
| `src/commands/project/update.ts` | Add `--format` support | Medium effort |
| `src/commands/project/list.tsx` | Fix TSV escaping | Low effort |
| `tests/scripts/*.sh` | Add stream separation tests | Low effort |

**Lines of Code:**
- Core changes: ~50 lines
- Command updates: ~100 lines per command
- Tests: ~50 lines
- **Total:** ~400 lines

**Estimated Time:**
- Phase 1 (output.ts + view/deps): 4-6 hours
- Phase 2 (create/update formats): 6-8 hours
- Phase 3 (testing): 2-3 hours
- **Total:** 12-17 hours

---

### 11.4 Next Steps

**Immediate Actions:**

1. **Review & Approve:**
   - Review this proposal
   - Discuss any concerns
   - Approve implementation plan

2. **Create Implementation Issues:**
   - Create milestone for "Output Format Standardization"
   - Break down into tasks
   - Assign priorities

3. **Start Implementation:**
   - Begin with Phase 1 (core output.ts changes)
   - Add format support to 2-3 commands
   - Test thoroughly
   - Release and gather feedback

---

## Appendix A: Stream Separation Examples

### Example 1: Normal Output (Terminal)

```bash
$ a2l project create --title "Test" --team eng
🔍 Validating team ID: eng...         # stderr (visible)
   ✓ Team found: Engineering          # stderr (visible)

✅ Project created successfully!       # stderr (visible)
   Name: Test                          # stderr (visible)
   ID: proj_123                        # stderr (visible)
```

**What User Sees:** Everything appears normally on terminal.

---

### Example 2: JSON Format (Terminal)

```bash
$ a2l project create --title "Test" --team eng --format json
🔍 Validating team ID: eng...         # stderr (visible)
   ✓ Team found: Engineering          # stderr (visible)
{                                      # stdout (visible)
  "id": "proj_123",
  "name": "Test",
  "url": "https://..."
}
```

**What User Sees:** Messages and JSON both appear, but JSON is parseable if piped.

---

### Example 3: Piped JSON (Script)

```bash
$ a2l project create --title "Test" --team eng --format json | jq '.id'
🔍 Validating team ID: eng...         # stderr (appears on terminal)
   ✓ Team found: Engineering          # stderr (appears on terminal)
"proj_123"                             # stdout (piped to jq)
```

**What Script Sees:** Only the JSON goes through pipe, messages appear on terminal.

---

### Example 4: Quiet Mode (Script)

```bash
$ a2l project create --title "Test" --team eng --format json --quiet | jq '.id'
"proj_123"                             # stdout (piped to jq)
```

**What Script Sees:** Only the JSON, no messages at all.

---

### Example 5: Redirect Stderr (Script)

```bash
$ a2l project create --title "Test" --team eng --format json 2>/dev/null | jq '.id'
"proj_123"                             # stdout (piped to jq)
```

**What Script Sees:** Only the JSON, stderr messages discarded.

---

## Appendix B: Comparison to Other CLIs

| CLI | Default Format | Machine Format | Message Stream | Quiet Flag |
|-----|----------------|----------------|----------------|------------|
| **kubectl** | Table | `-o json`, `-o yaml` | stderr | `--quiet` |
| **gh** | Table | `--json <fields>` | stderr | `--quiet` |
| **aws-cli** | JSON | `--output json\|text\|table` | stderr | `--quiet` |
| **jq** | JSON | (N/A - JSON only) | stderr | `--quiet` |
| **docker** | Table | `--format json` | stderr | `--quiet` |
| **terraform** | Text | `-json` | stderr | `-no-color` |
| **git** | Text | `--porcelain` | stderr | `--quiet` |
| **agent2linear (current)** | Text | `--format json` (list only) | **stdout** ❌ | ❌ Missing |
| **agent2linear (proposed)** | Text | `--format json\|tsv` (all) | **stderr** ✅ | `--quiet` ✅ |

**Key Insight:** All major CLIs route messages to stderr. agent2linear should follow this convention.
