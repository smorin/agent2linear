# Bug & Inconsistency Analysis Report
**Generated:** 2025-10-26  
**Scope:** Create and Update Command Analysis  
**Project:** linear-create CLI tool

---

## Executive Summary

Analysis of create and update commands across the codebase revealed **1 critical bug**, **3 high-priority inconsistencies**, and **5 medium-priority issues**. The most severe issue is the silently ignored `--state` flag in project creation.

### Critical Issues Found
- 🔴 **CRITICAL**: `--state` flag accepted but completely ignored in project create
- 🔴 **HIGH**: Major field parity gaps between create and update operations (12+ fields)
- 🔴 **HIGH**: Missing validation in project update command
- 🟡 **MEDIUM**: Inconsistent error handling patterns across commands

---

## 🔴 CRITICAL BUG #1: Project State Flag Silently Ignored

### Description
The project create command accepts a `--state` option and even sets a default value of `'planned'`, but this value is **never used**. Only `statusId` is sent to the Linear API.

### Location
- **File**: [src/commands/project/create.tsx](file:///Users/stevemorin/c/linear-create/src/commands/project/create.tsx#L25)
- **Interface**: [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/src/lib/linear-client.ts#L648) (Line 648)
- **Function**: [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/src/lib/linear-client.ts#L766-L880) (createProject)

### Evidence
```typescript
// CreateOptions includes state (line 25)
state?: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';

// ProjectCreateInput includes state (line 648)
state?: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';

// projectData sets state (line 326)
const projectData: ProjectCreateInput = {
  name: title,
  state: options.state || 'planned',  // ← Set but never used!
  // ...
};

// BUT createProject never sends it (line 771-790)
const createInput = {
  name: input.name,
  description: input.description,
  ...(input.statusId && { statusId: input.statusId }),  // ← Only statusId is used
  // state is NOT in createInput
};
```

### Impact
- **Severity**: CRITICAL
- **User Impact**: Users providing `--state` expect it to work; it silently fails
- **Data Integrity**: Projects may be created in wrong state
- **Discoverability**: Error is silent, making it hard to detect

### Reproduction
```bash
# This command appears to work but --state is ignored
linear-create project create --title "Test" --team team_xxx --state started

# Result: Project created in default state, not "started"
```

### Recommendation
**Option A (Preferred)**: Map `state` to a `statusId`
1. When `--state` is provided without `--status`, look up a status with matching type
2. Use `getAllProjectStatuses()` to find status where `type === state`
3. Set `statusId` to the found status
4. If no matching status exists, fail with clear error

**Option B**: Remove the field entirely
1. Remove `state` from CreateOptions
2. Remove `state` from ProjectCreateInput
3. Remove `--state` from CLI help
4. Update documentation to only use `--status`

**Estimated Fix Time**: 1-2 hours

---

## 🔴 HIGH PRIORITY #1: Field Parity Between Create and Update

### Description
`ProjectCreateInput` has 16 fields; `ProjectUpdateInput` has only 7. Many fields that can be set on creation cannot be updated later.

### Missing Update Fields

| Field | Create | Update | Severity | Impact |
|-------|--------|--------|----------|---------|
| `leadId` | ✅ | ❌ | **HIGH** | Cannot change/assign project lead after creation |
| `startDateResolution` | ✅ | ❌ | **HIGH** | Cannot update date resolution granularity |
| `targetDateResolution` | ✅ | ❌ | **HIGH** | Cannot update date resolution granularity |
| `icon` | ✅ | ❌ | **MEDIUM** | Cannot change project icon |
| `color` | ✅ | ❌ | **MEDIUM** | Cannot change project color |
| `memberIds` | ✅ | ❌ | **MEDIUM** | Cannot manage project members via CLI |
| `teamId` | ✅ | ❌ | **MEDIUM** | Cannot reassign project to different team |
| `labelIds` | ✅ | ❌ | **MEDIUM** | Cannot update project labels |
| `initiativeId` | ✅ | ❌ | **MEDIUM** | Cannot change initiative association |
| `templateId` | ✅ | ❌ | **LOW** | Template is create-time only (acceptable) |
| `convertedFromIssueId` | ✅ | ❌ | **LOW** | Conversion is create-time only (acceptable) |

### Location
- **CreateInput**: [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/src/lib/linear-client.ts#L645-L666)
- **UpdateInput**: [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/ts#L885-L893)
- **Update Command**: [src/commands/project/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/project/update.ts)

### Recommendation

**Phase 1 (High Priority)**: Add critical fields
```typescript
// Add to ProjectUpdateInput
export interface ProjectUpdateInput {
  // Existing fields
  statusId?: string;
  name?: string;
  description?: string;
  content?: string;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  
  // NEW: High-priority additions
  leadId?: string;
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
}
```

**Phase 2 (Medium Priority)**: Add cosmetic fields
- Add `icon`, `color` to update

**Phase 3 (Lower Priority)**: Add relational fields
- Add `memberIds`, `labelIds`, `teamId` (requires additional SDK validation)

**Estimated Fix Time**: 
- Phase 1: 2-3 hours
- Phase 2: 1 hour
- Phase 3: 4-6 hours

---

## 🔴 HIGH PRIORITY #2: Missing Validation in Update

### Description
Create command validates inputs extensively; update command has minimal validation.

### Validation Gaps

| Validation | Create | Update | Risk |
|------------|--------|--------|------|
| Name minimum length (3 chars) | ✅ | ❌ | **HIGH** - Can set invalid names |
| Priority range (0-4) | ❌ | ✅ | **MEDIUM** - Create should validate |
| Priority type handling | Weak | Good | **MEDIUM** - Inconsistent parsing |
| Duplicate name check | ✅ | ❌ | **MEDIUM** - Can rename to duplicate |
| Field trimming | ✅ | ❌ | **LOW** - Whitespace issues |

### Locations
- **Create validation**: [src/commands/project/create.tsx](file:///Users/stevemorin/c/linear-create/src/commands/project/create.tsx#L98-L101)
- **Update validation**: [src/commands/project/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/project/update.ts#L132-L143)

### Examples

**Create has name validation:**
```typescript
// Line 98-101
if (title.length < 3) {
  console.error('❌ Error: Title must be at least 3 characters');
  process.exit(1);
}
```

**Update has priority validation (create doesn't):**
```typescript
// Line 132-143
if (options.priority !== undefined) {
  const priority = parseInt(options.priority, 10);
  if (isNaN(priority) || priority < 0 || priority > 4) {
    showError(
      'Invalid priority value',
      'Priority must be a number between 0 and 4:\n' +
      '  0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low'
    );
    process.exit(1);
  }
}
```

### Recommendation

1. **Add name validation to update**:
   ```typescript
   if (options.name) {
     const trimmedName = options.name.trim();
     if (trimmedName.length < 3) {
       showError('Name must be at least 3 characters');
       process.exit(1);
     }
     updates.name = trimmedName;
   }
   ```

2. **Add priority validation to create**:
   - Copy the priority validation logic from update to create
   - Ensure type consistency (parse as number, validate range)

3. **Add duplicate name check to update** (optional):
   ```typescript
   if (options.name && options.name !== resolved.project.name) {
     const exists = await getProjectByName(options.name);
     if (exists) {
       showError(`A project named "${options.name}" already exists`);
       process.exit(1);
     }
   }
   ```

**Estimated Fix Time**: 30-60 minutes

---

## 🟡 MEDIUM PRIORITY #1: Inconsistent Error Handling

### Description
Error handling patterns vary across commands, making UX inconsistent and code harder to maintain.

### Patterns Found

| Pattern | Files | Consistency |
|---------|-------|-------------|
| `showError()` from lib/output | project/update.ts | ✅ Good |
| `console.error()` direct | project/create.tsx, labels/* | ❌ Inconsistent |
| Mixed in same file | project/update.ts (file errors) | ❌ Inconsistent |

### Examples

**Update uses showError (good):**
```typescript
// Line 23-29
showError(
  'Cannot use both --content and --content-file',
  'Choose one:\n...'
);
```

**But file read errors use console.error (inconsistent):**
```typescript
// Line 39-48
console.error(`❌ Error reading file: ${options.contentFile}\n`);
if (error instanceof Error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error('   File not found. Please check the path and try again.');
  }
}
```

**Create always uses console.error:**
```typescript
// Line 55-59
console.error('❌ Error: Cannot use both --content and --content-file\n');
console.error('Choose one:');
console.error('  --content "markdown text"  (inline content)');
```

### Recommendation

1. **Standardize on `lib/output` utilities**:
   - Use `showError()` for all error messages
   - Use `showSuccess()` for all success messages
   - Use `showInfo()` for tips/hints

2. **Update create command** to use output utilities

3. **Create file-reading helper** in lib/output:
   ```typescript
   export function showFileReadError(path: string, error: Error) {
     const errno = (error as NodeJS.ErrnoException).code;
     let hint = '';
     if (errno === 'ENOENT') hint = 'File not found. Check the path.';
     else if (errno === 'EACCES') hint = 'Permission denied.';
     else hint = error.message;
     
     showError(`Error reading file: ${path}`, hint);
   }
   ```

**Estimated Fix Time**: 1-2 hours

---

## 🟡 MEDIUM PRIORITY #2: Label Update Inconsistencies

### Description
Issue labels and project labels have inconsistent update output.

### Issue Label Update
**File**: [src/commands/issue-labels/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/issue-labels/update.ts#L40-L44)

```typescript
// Shows before/after comparison (good UX)
console.log('✅ Issue label updated successfully!');
if (options.name) console.log(`   Name: ${currentLabel.name} → ${updatedLabel.name}`);
if (options.color) console.log(`   Color: ${currentLabel.color} → ${updatedLabel.color}`);
```

### Project Label Update
**File**: [src/commands/project-labels/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/project-labels/update.ts#L38)

```typescript
// No details shown (poor UX)
await updateProjectLabel(resolvedId, updateInput);
console.log('✅ Project label updated successfully!');
```

### Recommendation

**Make project-label update match issue-label pattern:**
```typescript
console.log('📝 Updating project label...');
const updatedLabel = await updateProjectLabel(resolvedId, updateInput);

console.log('');
console.log('✅ Project label updated successfully!');
if (options.name) console.log(`   Name: ${currentLabel.name} → ${updatedLabel.name}`);
if (options.color) console.log(`   Color: ${currentLabel.color} → ${updatedLabel.color}`);
console.log('');
```

**Estimated Fix Time**: 10 minutes

---

## 🟡 MEDIUM PRIORITY #3: Type Inconsistency in Priority

### Description
Priority is handled as `string` in update CLI options but should be `number` in both create and update.

### Evidence

**Update command** (inconsistent):
```typescript
// Line 14 - priority typed as string
interface UpdateOptions {
  priority?: string;  // ← String from CLI
}

// Line 132 - parsed to number with validation
const priority = parseInt(options.priority, 10);
```

**Create command** (inconsistent):
```typescript
// Line 45 - priority typed as number
interface CreateOptions {
  priority?: number;  // ← Assumed to be number, no validation
}

// Line 342 - used directly without validation
priority: options.priority,  // ← Not validated!
```

### Recommendation

**Standardize on string input with validation:**
```typescript
// Both commands should use
interface Options {
  priority?: string;  // Commander parses as string
}

// Both should validate the same way
function validatePriority(value: string): number {
  const priority = parseInt(value, 10);
  if (isNaN(priority) || priority < 0 || priority > 4) {
    showError(
      'Invalid priority value',
      'Priority must be 0-4: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low'
    );
    process.exit(1);
  }
  return priority;
}
```

**Estimated Fix Time**: 20 minutes

---

## 🟢 LOW PRIORITY ISSUES

### 1. Label Validation Asymmetry
- **Location**: [src/commands/project/create.tsx](file:///Users/stevemorin/c/linear-create/src/commands/project/create.tsx#L228-L240)
- **Issue**: Labels are alias-resolved but not validated for existence
- **Risk**: May cause API errors if label ID is invalid
- **Recommendation**: Add label existence validation or allow label names
- **Estimated Fix Time**: 1 hour

### 2. Error Swallowing in getProjectByName
- **Location**: [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/src/lib/linear-client.ts#L689-L697)
- **Issue**: Returns `false` on any error, may allow duplicate creation if API fails
- **Risk**: LOW - mostly safe, but could cause issues in edge cases
- **Recommendation**: Log errors in debug mode
- **Estimated Fix Time**: 15 minutes

### 3. React Effect with process.exit
- **Location**: [src/commands/project/create.tsx](file:///Users/stevemorin/c/linear-create/src/commands/project/create.tsx#L422)
- **Issue**: Calling `process.exit(1)` inside React effect is heavy-handed
- **Risk**: LOW - works but not idiomatic React
- **Recommendation**: Let timeout at line 443 handle all exits
- **Estimated Fix Time**: 10 minutes

---

## Summary Table

| ID | Issue | Severity | Impact | Effort | Priority |
|----|-------|----------|--------|--------|----------|
| BUG-1 | State flag ignored | 🔴 CRITICAL | Users misled | 1-2h | **P0** |
| INC-1 | Field parity (create vs update) | 🔴 HIGH | Missing functionality | 2-8h | **P1** |
| INC-2 | Missing validation in update | 🔴 HIGH | Data integrity | 30-60m | **P1** |
| INC-3 | Inconsistent error handling | 🟡 MEDIUM | UX consistency | 1-2h | **P2** |
| INC-4 | Label update output | 🟡 MEDIUM | UX inconsistency | 10m | **P2** |
| INC-5 | Priority type handling | 🟡 MEDIUM | Type safety | 20m | **P2** |
| LOW-1 | Label validation | 🟢 LOW | API errors | 1h | **P3** |
| LOW-2 | Error swallowing | 🟢 LOW | Edge case bugs | 15m | **P3** |
| LOW-3 | React effect pattern | 🟢 LOW | Code quality | 10m | **P3** |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (P0)
**Time**: 1-2 hours
1. Fix `--state` flag in project create
   - Either map to statusId or remove entirely
   - Update help text and documentation

### Phase 2: High Priority (P1)
**Time**: 3-4 hours
1. Add leadId, date resolutions to update
2. Add name validation to update
3. Add priority validation to create

### Phase 3: Medium Priority (P2)
**Time**: 2-3 hours
1. Standardize error handling across all commands
2. Fix project label update output
3. Standardize priority type handling

### Phase 4: Low Priority (P3)
**Time**: 1-2 hours
1. Add label validation
2. Improve error logging
3. Clean up React patterns

**Total Estimated Time**: 7-11 hours

---

## Testing Recommendations

After implementing fixes:

1. **Integration Tests**:
   ```bash
   # Test state mapping
   linear-create project create --title "Test" --team X --state started
   
   # Test update validations
   linear-create project update PROJECT-1 --name "ab"  # Should fail
   linear-create project update PROJECT-1 --priority 5  # Should fail
   
   # Test new update fields
   linear-create project update PROJECT-1 --lead user@example.com
   linear-create project update PROJECT-1 --start-date-resolution quarter
   ```

2. **Regression Tests**:
   - Ensure existing functionality still works
   - Test alias resolution in all commands
   - Verify error messages are helpful

3. **Build Verification**:
   ```bash
   npm run build
   npm run typecheck
   npm run lint
   ```

---

## Appendix: Files Analyzed

- ✅ [src/commands/project/create.tsx](file:///Users/stevemorin/c/linear-create/src/commands/project/create.tsx) (553 lines)
- ✅ [src/commands/project/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/project/update.ts) (174 lines)
- ✅ [src/commands/issue-labels/create.ts](file:///Users/stevemorin/c/linear-create/src/commands/issue-labels/create.ts) (53 lines)
- ✅ [src/commands/issue-labels/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/issue-labels/update.ts) (50 lines)
- ✅ [src/commands/project-labels/create.ts](file:///Users/stevemorin/c/linear-create/src/commands/project-labels/create.ts) (39 lines)
- ✅ [src/commands/project-labels/update.ts](file:///Users/stevemorin/c/linear-create/src/commands/project-labels/update.ts) (44 lines)
- ✅ [src/lib/linear-client.ts](file:///Users/stevemorin/c/linear-create/src/lib/linear-client.ts) (lines 645-950)

---

**Analysis completed**: 2025-10-26  
**Analyst**: Amp AI Assistant  
**Methodology**: Code review + Oracle analysis + pattern comparison
