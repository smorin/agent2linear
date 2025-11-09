# Project Commands Output Format Analysis

> **ARCHIVED:** This analysis has been superseded by OUTPUT_STREAMS_PROPOSAL.md.
> Key findings from this document have been merged into the proposal's "Current State Analysis" section (1.3 Format Machine-Readability Analysis).
> Archived: 2025-11-09

---

## Executive Summary

**Current State:** Only `project list` supports machine-readable output formats (JSON, TSV). Other commands (`view`, `update`, `create`, dependency commands) use human-friendly formatted output only.

**Key Finding:** TSV is **NOT 100% machine-readable** due to inconsistencies with the default table format. JSON is **fully machine-readable**.

---

## 1. Commands with Format Support

### ✅ `project list` - Full Format Support

**Location:** `src/commands/project/list.tsx`

**Supported Formats:**
```bash
a2l project list                    # Default: table format (human-friendly)
a2l project list --format table     # Explicit table format
a2l project list --format json      # JSON format (machine-readable)
a2l project list --format tsv       # TSV format (supposedly machine-readable)
```

**Registration:** `list.tsx:352`
```typescript
.option('-f, --format <type>', 'Output format: table (default), json, tsv', 'table')
```

---

### ❌ Commands WITHOUT Format Support

| Command | File | Output Type |
|---------|------|-------------|
| `project view` | `view.ts` | Human-formatted console output only |
| `project update` | `update.ts` | Human-formatted via `showSuccess()` |
| `project create` | `create.tsx` | Human-formatted via `displaySuccess()` |
| `project add-milestones` | `add-milestones.ts` | Human-formatted via `showSuccess()` |
| `project dependencies add` | `dependencies/add.ts` | Human-formatted via `showSuccess()` |
| `project dependencies remove` | `dependencies/remove.ts` | Human-formatted via `showSuccess()` |
| `project dependencies list` | `dependencies/list.ts` | Plain console output |
| `project dependencies clear` | `dependencies/clear.ts` | Human-formatted via `showSuccess()` |

**Impact:** These commands cannot be used in automated scripts without fragile text parsing.

---

## 2. Machine-Readability Analysis

### 📊 Comparison Table

| Aspect | Default (Table) | TSV | JSON |
|--------|----------------|-----|------|
| **Machine-Readable** | ❌ No | ⚠️ Partial | ✅ Yes |
| **Field Truncation** | ✅ Yes (Status/Team/Lead) | ❌ No truncation | ❌ No truncation |
| **Summary Line** | ✅ Yes | ❌ No | ❌ No |
| **Header Row** | ✅ Yes | ✅ Yes | ❌ N/A |
| **Preview Truncation** | ✅ 60 chars | ✅ 60 chars | ✅ 60 chars |
| **Structured Data** | ❌ No | ❌ No | ✅ Yes |
| **Parseable by Standard Tools** | ❌ No | ⚠️ Partial | ✅ Yes (jq, etc.) |
| **Consistent Schema** | ❌ No | ⚠️ Partial | ✅ Yes |

---

## 3. Output Format Examples

### Example Data Setup

Assume we have 2 projects:
1. **Project A:** Long status name "In Progress - Development Phase", Long team "Platform Engineering Team", Long lead "Christopher Anderson"
2. **Project B:** Normal status "Planned", Normal team "Design", Normal lead "Jane"

---

### 3.1 Default (Table) Format

**Command:**
```bash
a2l project list
```

**Output:**
```
ID                  Title                   Status      Team           Lead              Preview
proj_abc123         API Redesign            In Progress Platform Engi  Christopher Anders  This is a preview of the project content truncated...
proj_xyz789         Website Refresh         Planned     Design         Jane              Redesign the entire website to use modern framew...

Total: 2 projects
```

**Characteristics:**
- **Field Truncation:** Status (11 chars), Team (14 chars), Lead (19 chars)
- **Summary Line:** "Total: 2 projects"
- **Preview:** Truncated at 60 chars
- **Machine-Readable:** ❌ **NO** - Inconsistent field widths, summary line breaks parsing

**Code Reference:** `list.tsx:186-188`
```typescript
const status = (project.status?.name || project.state || '').substring(0, 11);
const team = (project.team?.name || '').substring(0, 14);
const lead = (project.lead?.name || '').substring(0, 19);
```

---

### 3.2 TSV Format

**Command:**
```bash
a2l project list --format tsv
```

**Output:**
```
ID	Title	Status	Team	Lead	Preview
proj_abc123	API Redesign	In Progress - Development Phase	Platform Engineering Team	Christopher Anderson	This is a preview of the project content truncated...
proj_xyz789	Website Refresh	Planned	Design	Jane	Redesign the entire website to use modern framew...
```

**Characteristics:**
- **NO Field Truncation:** Full names for Status/Team/Lead
- **NO Summary Line:** Clean TSV output
- **Preview:** Still truncated at 60 chars (same as table)
- **Machine-Readable:** ⚠️ **PARTIAL** - Standard TSV, but inconsistent with table format

**Code Reference:** `list.tsx:227-229`
```typescript
const status = project.status?.name || project.state || '';
const team = project.team?.name || '';
const lead = project.lead?.name || '';
```

**Why Only Partial Machine-Readability?**

1. **Preview Content Truncation:** Content is still limited to 60 characters (same function used)
   - Code: `list.tsx:160-163`
   ```typescript
   return cleaned.length > 60
     ? cleaned.substring(0, 57) + '...'
     : cleaned;
   ```

2. **Tab Characters in Data:** If project title or description contains tabs, TSV parsing breaks
   - No escaping/quoting mechanism implemented
   - Standard TSV parsers would fail

3. **Inconsistency with Table Format:** Different field lengths mean you can't use the same parser for both

---

### 3.3 JSON Format

**Command:**
```bash
a2l project list --format json
```

**Output:**
```json
[
  {
    "id": "proj_abc123",
    "name": "API Redesign",
    "state": "active",
    "status": {
      "name": "In Progress - Development Phase"
    },
    "team": {
      "name": "Platform Engineering Team"
    },
    "lead": {
      "name": "Christopher Anderson"
    },
    "description": "This is a preview of the project content truncated at 60 characters...",
    "content": "This is a preview of the project content truncated at 60 characters...",
    "dependsOnCount": 0,
    "blocksCount": 0
  },
  {
    "id": "proj_xyz789",
    "name": "Website Refresh",
    "state": "active",
    "status": {
      "name": "Planned"
    },
    "team": {
      "name": "Design"
    },
    "lead": {
      "name": "Jane"
    },
    "description": "Redesign the entire website to use modern frameworks and improve UX",
    "content": "Redesign the entire website to use modern frameworks and improve UX",
    "dependsOnCount": 1,
    "blocksCount": 2
  }
]
```

**Characteristics:**
- **NO Truncation:** Full field values (except preview - same 60 char limit)
- **NO Summary Line:** Pure JSON array
- **Structured Data:** Nested objects for status/team/lead
- **Machine-Readable:** ✅ **YES** - 100% parseable with standard JSON tools

**Code Reference:** `list.tsx:210-211`
```typescript
function formatJSONOutput(projects: ProjectListItem[]): void {
  console.log(JSON.stringify(projects, null, 2));
}
```

**Why 100% Machine-Readable?**

1. **Standard Format:** Valid JSON parseable by any JSON library
2. **Consistent Schema:** Every project has the same structure
3. **Type Safety:** Objects have predictable fields
4. **No Summary Line:** Pure data output
5. **Pipeable:** Works with `jq`, `jd`, and other JSON tools

**Example Usage:**
```bash
# Count projects
a2l project list --format json | jq 'length'

# Get project IDs
a2l project list --format json | jq -r '.[].id'

# Filter by team
a2l project list --format json | jq '.[] | select(.team.name == "Engineering")'

# Extract specific fields
a2l project list --format json | jq '.[] | {id, name, status: .status.name}'
```

---

## 4. Critical Inconsistencies

### 4.1 Field Truncation Mismatch

**Problem:** Table format truncates fields, TSV doesn't.

**Code Comparison:**

**Table Format (`list.tsx:186-188`):**
```typescript
const status = (project.status?.name || project.state || '').substring(0, 11);
const team = (project.team?.name || '').substring(0, 14);
const lead = (project.lead?.name || '').substring(0, 19);
```

**TSV Format (`list.tsx:227-229`):**
```typescript
const status = project.status?.name || project.state || '';
const team = project.team?.name || '';
const lead = project.lead?.name || '';
```

**Impact:**
- Same header names, different data lengths
- Parser expecting 11-char status gets 30-char status in TSV
- Inconsistent behavior confuses users and breaks automation

**Example:**
```bash
# Table output
Status: "In Progress"  # Truncated at 11 chars

# TSV output
Status: "In Progress - Development Phase"  # Full name
```

---

### 4.2 Summary Line Only in Table Format

**Table Format (`list.tsx:204`):**
```typescript
console.log(`\nTotal: ${projects.length} project${projects.length !== 1 ? 's' : ''}`);
```

**TSV/JSON Format:**
No summary line.

**Impact:**
- Scripts parsing table output must skip the summary line
- TSV parsers will fail if they encounter the summary line
- Inconsistent behavior across formats

---

### 4.3 Code Duplication Between Table and TSV

**Problem:** ~70% of code is duplicated between `formatTableOutput()` and `formatTSVOutput()`.

**Duplicated Logic:**
- Header generation (`list.tsx:176-180` vs `219-223`)
- Dependency column handling (`list.tsx:191-196` vs `232-237`)
- Loop structure (`list.tsx:183-202` vs `226-243`)

**Only Difference:**
- Field truncation (3 lines of code)

**Maintenance Risk:**
- Changes to output format require updating 2 functions
- Easy to introduce bugs by forgetting to sync both
- Already inconsistent (summary line)

---

## 5. What We're Doing Today

### Current Implementation

**Supported:** `project list` only

**Default Behavior:**
```bash
# Human-friendly table with truncation and summary
a2l project list
```

**Machine-Readable Options:**
```bash
# JSON - fully machine-readable
a2l project list --format json | jq '.[] | .id'

# TSV - partially machine-readable (no truncation, but still issues)
a2l project list --format tsv | cut -f1,2
```

**Pain Points:**

1. **Limited Command Support:**
   - Only `list` has format options
   - `view`, `update`, `create` output human-formatted text only
   - Dependency commands output human-formatted text only

2. **TSV Ambiguity:**
   - Called "TSV" but has same header as "table"
   - Different field lengths than table
   - Not truly machine-readable due to potential tab characters in data

3. **JSON Excellence:**
   - Perfect for automation
   - But only available for `list` command

4. **Inconsistent User Experience:**
   - Users expect `--format json` to work on all commands
   - Only works on `list`

---

## 6. How This SHOULD Work (Recommended)

### 6.1 Extend Format Support to All Read Commands

**Target Commands:**
- ✅ `project list` (already done)
- 🎯 `project view` (needs format support)
- 🎯 `project dependencies list` (needs format support)

**Example:**
```bash
# View project in JSON
a2l project view proj_abc123 --format json

# List dependencies in JSON
a2l project dependencies list proj_abc123 --format json
```

---

### 6.2 Fix TSV Format Issues

**Option A: True TSV (Recommended)**
- Escape/quote tab characters in data
- Use RFC 4180-style quoting
- Make it truly parseable

**Option B: Rename to "Text" Format**
- Rename `--format tsv` to `--format text`
- Clarify it's for human consumption, not parsing
- Keep JSON for machines

**Option C: Remove TSV Entirely**
- Only support `table` (human) and `json` (machine)
- Simpler mental model
- Less maintenance

---

### 6.3 Consolidate Table/TSV Code

**Current:** Duplicate functions `formatTableOutput()` and `formatTSVOutput()`

**Recommended:** Single function with parameter
```typescript
function formatTabularOutput(
  projects: ProjectListItem[],
  options: {
    truncate: boolean;      // true for table, false for TSV
    showSummary: boolean;   // true for table, false for TSV
    showDependencies: boolean;
  }
): void {
  // Unified implementation
}
```

---

### 6.4 Define Clear Format Contracts

**Human-Friendly Format (Table):**
- Field truncation for readability
- Summary line with counts
- Pretty spacing
- **Use Case:** Terminal viewing by humans

**Machine-Readable Format (JSON):**
- No truncation
- No summary lines
- Valid JSON structure
- **Use Case:** Scripting, automation, API integration

**TSV Format (If Kept):**
- Proper escaping
- No truncation
- No summary line
- RFC 4180 compliant
- **Use Case:** Import into spreadsheets, data analysis

---

## 7. Recommendations

### Immediate (Fix Current Issues)

1. **Document TSV Limitations:**
   - Add help text warning about tab characters in data
   - Note that preview is still truncated
   - Clarify difference from table format

2. **Fix Code Duplication:**
   - Consolidate `formatTableOutput()` and `formatTSVOutput()`
   - Reduce maintenance burden

3. **Add Format Validation:**
   - Validate `--format` values in CLI option
   - Show error for invalid formats
   - Suggest valid options

### Short-Term (Improve Machine-Readability)

4. **Extend JSON Support:**
   - Add `--format json` to `project view`
   - Add `--format json` to `project dependencies list`
   - Consistent experience across commands

5. **Fix TSV Issues:**
   - Implement proper tab escaping
   - Add quotes around fields containing tabs/newlines
   - Make it RFC 4180 compliant

6. **Remove Summary Lines from TSV:**
   - TSV should be pure data
   - No human-friendly extras

### Long-Term (Strategic)

7. **Define Format Strategy:**
   - **Option A:** Support `table` and `json` only (simplest)
   - **Option B:** Support `table`, `json`, and proper `csv` (most useful)
   - **Option C:** Support `table`, `json`, `tsv`, and `csv` (most complex)

8. **Add Format Support to Mutation Commands:**
   - `project create --format json` → Output created project as JSON
   - `project update --format json` → Output updated project as JSON
   - Useful for automation workflows

9. **Add Streaming Support:**
   - `--format ndjson` (newline-delimited JSON)
   - One project per line
   - Useful for processing large lists

---

## 8. Answer to User Questions

### Q1: Does TSV/JSON make commands 100% machine-readable vs default?

**Answer:**

**JSON:** ✅ **YES** - 100% machine-readable
- Standard format, parseable by any JSON library
- No truncation, no summary lines
- Structured data with predictable schema
- Works perfectly with `jq`, `jd`, and other tools

**TSV:** ⚠️ **NO** - Only ~80% machine-readable
- **Issues:**
  - No escaping of tab characters in data (breaks parsers)
  - Content still truncated at 60 chars
  - Inconsistent with table format (different field lengths)
- **Works for:** Simple cases without tabs in data
- **Breaks for:** Projects with tabs in titles/descriptions

**Default (Table):** ❌ **NO** - Not machine-readable
- Field truncation makes data lossy
- Summary line breaks parsers
- Designed for human consumption

---

### Q2: What are we doing today vs how this would work?

**Today:**

```bash
# Only 'list' command supports formats
a2l project list --format json          # ✅ Works
a2l project list --format tsv           # ⚠️ Works but has issues
a2l project view proj_123 --format json # ❌ Doesn't work
a2l project update proj_123 ... --format json # ❌ Doesn't work
```

**Usage:**
```bash
# Automation today (limited to list)
PROJECT_ID=$(a2l project list --format json | jq -r '.[0].id')

# Manual parsing needed for other commands
a2l project view $PROJECT_ID | grep "State:" | cut -d: -f2
```

**How It SHOULD Work:**

```bash
# All read commands support formats
a2l project list --format json          # ✅ Works (already)
a2l project view proj_123 --format json # ✅ Should work
a2l project dependencies list proj_123 --format json # ✅ Should work

# Mutation commands output structured data
a2l project create --title "Test" --team eng --format json # ✅ Should work
a2l project update proj_123 --title "New" --format json    # ✅ Should work
```

**Ideal Usage:**
```bash
# Create project and extract ID
PROJECT_ID=$(a2l project create --title "API v2" --team eng --format json | jq -r '.id')

# Get project details
a2l project view $PROJECT_ID --format json | jq '.status.name'

# Update and verify
a2l project update $PROJECT_ID --status planned --format json | jq '.status.name'

# List dependencies
a2l project dependencies list $PROJECT_ID --format json | jq '.[].name'
```

---

## 9. Implementation Checklist

If implementing recommended changes:

### Phase 1: Fix Current Issues
- [ ] Document TSV limitations in help text and README
- [ ] Consolidate `formatTableOutput()` and `formatTSVOutput()`
- [ ] Add format validation to CLI option
- [ ] Add tests for invalid format values

### Phase 2: Improve TSV
- [ ] Implement tab escaping in TSV output
- [ ] Add quoting for fields with special characters
- [ ] Remove summary line from TSV output
- [ ] Update tests to verify proper escaping

### Phase 3: Extend JSON Support
- [ ] Add `--format json` to `project view`
- [ ] Add `--format json` to `project dependencies list`
- [ ] Consider adding `--format json` to mutation commands
- [ ] Update integration tests

### Phase 4: Documentation
- [ ] Update README with format examples
- [ ] Add format comparison table
- [ ] Document automation use cases
- [ ] Add jq examples for common tasks

---

## 10. Code References

| Feature | File | Lines |
|---------|------|-------|
| Format option registration | `list.tsx` | 352 |
| Format routing logic | `list.tsx` | 398-420 |
| Table output function | `list.tsx` | 169-205 |
| TSV output function | `list.tsx` | 217-244 |
| JSON output function | `list.tsx` | 210-212 |
| Field truncation (table) | `list.tsx` | 186-188 |
| Field full length (TSV) | `list.tsx` | 227-229 |
| Content preview truncation | `list.tsx` | 160-163 |
| Summary line (table only) | `list.tsx` | 204 |
| Header duplication | `list.tsx` | 176-180 vs 219-223 |

---

## Appendix: Test Commands

```bash
# Compare outputs
a2l project list > table.txt
a2l project list --format tsv > tsv.txt
a2l project list --format json > json.txt

# Verify JSON validity
a2l project list --format json | jq '.' > /dev/null && echo "Valid JSON"

# Test TSV parsing
a2l project list --format tsv | cut -f1,2 | head -5

# Test for tabs in data (will break TSV)
a2l project create --title "Test	Project" --team eng  # Tab character
a2l project list --format tsv | grep "Test.*Project"  # Will split incorrectly
```
