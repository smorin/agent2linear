# Icons Extract - Bug Fix & Team Scoping

## Current Issue

The `icons extract` command has two problems:

### Problem 1: ❌ Extracting from wrong field
**Current (WRONG):**
```typescript
// src/lib/icons.ts:191-210
if (!type || type === 'projects') {
  const { getAllProjects } = await import('./linear-client.js');
  const projects = await getAllProjects();
  for (const project of projects) {
    const emojis = extractEmoji(project.name);  // ❌ WRONG - extracting from NAME
    // ...
  }
}
```

**Expected (CORRECT):**
```typescript
if (!type || type === 'projects') {
  const { getAllProjects } = await import('./linear-client.js');
  const projects = await getAllProjects();
  for (const project of projects) {
    // ✅ CORRECT - use the icon field directly
    if (project.icon) {
      const existing = iconMap.get(project.icon);
      if (existing) {
        existing.usageCount++;
        existing.entities.push(project.name);
      } else {
        iconMap.set(project.icon, {
          emoji: project.icon,
          usageCount: 1,
          entities: [project.name],
        });
      }
    }
  }
}
```

### Problem 2: ❌ No team filtering
The command always searches entire workspace with no way to filter by team, inconsistent with other commands like `issue-labels list`.

## Validation

### ✅ Confirmed: Projects have `icon` field

**Evidence:**
- Linear GraphQL schema includes `icon: String` field on Project type
- `src/lib/linear-client.ts:578` includes `icon?: string` in `ProjectCreateInput`
- `src/lib/linear-client.ts:702` passes icon to API: `...(input.icon && { icon: input.icon })`
- Linear SDK exposes `project.icon` field

**Test result:**
```bash
$ node dist/index.js icons extract --type projects
Found 0 unique icons  # ❌ Because it's looking at names, not icon field
```

## Fix Plan

### 1. Fix Icon Extraction Logic

**File: `src/lib/icons.ts`**

**Current code (lines 191-210):**
```typescript
if (!type || type === 'projects') {
  // Extract from projects (workspace-wide)
  const { getAllProjects } = await import('./linear-client.js');
  const projects = await getAllProjects();
  for (const project of projects) {
    const emojis = extractEmoji(project.name);  // ❌ WRONG
    for (const emoji of emojis) {
      const existing = iconMap.get(emoji);
      if (existing) {
        existing.usageCount++;
        existing.entities.push(project.name);
      } else {
        iconMap.set(emoji, {
          emoji,
          usageCount: 1,
          entities: [project.name],
        });
      }
    }
  }
}
```

**Fixed code:**
```typescript
if (!type || type === 'projects') {
  // Extract from projects (workspace-wide or team-scoped)
  const { getAllProjects } = await import('./linear-client.js');
  const projects = await getAllProjects(teamId);  // Add team filtering

  for (const project of projects) {
    // ✅ Use the icon field directly (not project name)
    if (project.icon) {
      const existing = iconMap.get(project.icon);
      if (existing) {
        existing.usageCount++;
        existing.entities.push(project.name);
      } else {
        iconMap.set(project.icon, {
          emoji: project.icon,
          usageCount: 1,
          entities: [project.name],
        });
      }
    }
  }
}
```

### 2. Update Type Definition

**File: `src/lib/linear-client.ts`**

The `Project` interface (line 199-203) needs to include the `icon` field:

**Current:**
```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
}
```

**Fixed:**
```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string;  // ✅ Add this
}
```

### 3. Update getAllProjects to Return Icon Field

**File: `src/lib/linear-client.ts`**

Ensure the query fetches the icon field (line 538-563):

**Current:**
```typescript
export async function getAllProjects(): Promise<Project[]> {
  try {
    const client = getLinearClient();
    const projects = await client.projects();

    const result: Project[] = [];
    for await (const project of projects.nodes) {
      result.push({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
      });
    }
    // ...
  }
}
```

**Fixed:**
```typescript
export async function getAllProjects(teamId?: string): Promise<Project[]> {
  try {
    const client = getLinearClient();

    // Add team filter if specified
    const projects = teamId
      ? await client.projects({
          filter: {
            teams: { some: { id: { eq: teamId } } }
          }
        })
      : await client.projects();

    const result: Project[] = [];
    for await (const project of projects.nodes) {
      result.push({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        icon: project.icon || undefined,  // ✅ Add this
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    // ... error handling
  }
}
```

### 4. Add Team Scoping to Command

**File: `src/commands/icons/extract.ts`**

Add `--team` and `--workspace` options following the established pattern:

**Current:**
```typescript
export function extractIcons(program: Command) {
  program
    .command('extract')
    .description('Extract icons from workspace entities')
    .option('--type <type>', 'Entity type (labels|workflow-states|projects)')
    .option('-f, --format <format>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      try {
        console.log('🔍 Extracting icons from workspace...');
        const icons = await extractIconsFromEntities(options.type as any);
        // ...
      }
    });
}
```

**Fixed:**
```typescript
export function extractIcons(program: Command) {
  program
    .command('extract')
    .description('Extract icons from workspace entities')
    .option('--type <type>', 'Entity type (labels|workflow-states|projects)')
    .option('-t, --team <id>', 'Filter by team (ID, name, or alias)')
    .option('-w, --workspace', 'Search entire workspace (ignore defaultTeam)')
    .option('-f, --format <format>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      try {
        let resolvedTeamId: string | undefined;

        // Determine team scope (same pattern as issue-labels list)
        if (!options.workspace) {
          if (options.team) {
            // Resolve team alias
            const { resolveAlias } = await import('../../lib/aliases.js');
            resolvedTeamId = resolveAlias('team', options.team);

            // Validate team exists
            const { validateTeamExists } = await import('../../lib/linear-client.js');
            const teamCheck = await validateTeamExists(resolvedTeamId);
            if (!teamCheck.valid) {
              console.error(`❌ ${teamCheck.error}`);
              process.exit(1);
            }
            console.log(`📎 Using team: ${teamCheck.name}`);
          } else {
            // Use defaultTeam from config
            const { getConfig } = await import('../../lib/config.js');
            const config = getConfig();
            if (config.defaultTeam) {
              resolvedTeamId = config.defaultTeam;
              console.log(`📎 Using default team: ${resolvedTeamId}`);
            }
          }
        }

        const scope = options.workspace ? 'workspace' : (resolvedTeamId ? 'team' : 'workspace');
        console.log(`🔍 Extracting icons from ${scope}...`);

        const icons = await extractIconsFromEntities(options.type as any, resolvedTeamId);
        console.log(`   Found ${icons.length} unique icons`);
        // ... rest of output formatting
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
```

### 5. Update extractIconsFromEntities Signature

**File: `src/lib/icons.ts`**

Update function signature to accept teamId:

**Current:**
```typescript
export async function extractIconsFromEntities(
  type?: 'labels' | 'workflow-states' | 'projects'
): Promise<Array<{ emoji: string; usageCount: number; entities: string[] }>>
```

**Fixed:**
```typescript
export async function extractIconsFromEntities(
  type?: 'labels' | 'workflow-states' | 'projects',
  teamId?: string  // ✅ Add this parameter
): Promise<Array<{ emoji: string; usageCount: number; entities: string[] }>>
```

Then use `teamId` when calling `getAllIssueLabels(teamId)`, `getAllWorkflowStates(teamId)`, and `getAllProjects(teamId)`.

## Team Scoping Pattern

Following the established pattern from `issue-labels list`:

### Behavior:
1. **No flags**: Uses `defaultTeam` from config (if set), otherwise workspace-wide
2. **`--team <id>`**: Uses specified team (supports aliases)
3. **`--workspace`**: Explicitly searches entire workspace (ignores defaultTeam)

### Examples:
```bash
# Uses defaultTeam from config
linear-create icons extract --type projects

# Specific team by ID
linear-create icons extract --type projects --team team_abc123

# Specific team by alias
linear-create icons extract --type projects --team eng

# Entire workspace
linear-create icons extract --type projects --workspace

# All types, default team
linear-create icons extract
```

## Expected Output After Fix

### Before (current - BROKEN):
```bash
$ linear-create icons extract --type projects
🔍 Extracting icons from workspace...
   Found 0 unique icons  # ❌ Looking at names, not icon field

Icon  Usage  Entities
────  ─────  ────────
```

### After (fixed - CORRECT):
```bash
$ linear-create icons extract --type projects
📎 Using default team: team_abc123
🔍 Extracting icons from team...
   Found 5 unique icons

Icon  Usage  Entities
────  ─────  ────────
🚀     3      LP-01 Landing Page, Feature X, Initiative Y
📊     2      Analytics Dashboard, Metrics View
🎨     1      Design System
```

## Testing Checklist

- [ ] Extract from project `icon` field (not name)
- [ ] Extract with no flags (uses defaultTeam)
- [ ] Extract with `--team <id>` (uses specific team)
- [ ] Extract with `--team <alias>` (resolves alias)
- [ ] Extract with `--workspace` (ignores defaultTeam)
- [ ] Extract labels with team filter
- [ ] Extract workflow-states with team filter
- [ ] Verify icons from all three entity types
- [ ] Test with projects that have icons vs those without
- [ ] Test output formats: default, json, tsv

## Files to Change

### Required Changes:
1. ✅ `src/lib/icons.ts` - Fix extraction logic, add teamId parameter
2. ✅ `src/lib/linear-client.ts` - Add icon field to Project interface, add team filtering to getAllProjects
3. ✅ `src/commands/icons/extract.ts` - Add --team and --workspace options

### Optional (same pattern for colors):
4. ⏳ `src/lib/colors.ts` - Add teamId parameter to extractColorsFromEntities
5. ⏳ `src/commands/colors/extract.ts` - Add --team and --workspace options

## Summary

**Main Issue**: `icons extract` is extracting from project **names** instead of the `icon` **field**.

**Fix**:
1. Change extraction to use `project.icon` field directly
2. Add `icon` field to Project interface
3. Fetch icon field in getAllProjects
4. Add team filtering for consistency

**Result**: Properly extract icons from Linear's native icon field, with consistent team/workspace scoping pattern.
