# Codebase Bug Audit

**Date:** 2026-03-09
**Scope:** Full source audit of `src/` directory

---

## Bug 0: `createIssue` passes `templateId` to `createAsUser` API field

**File:** `src/lib/linear-client.ts:794`
**Priority:** HIGH | **Worth fixing:** YES

```typescript
const issue = await client.createIssue({
  // ...
  createAsUser: input.templateId, // BUG: templateId assigned to wrong field
});
```

The `templateId` from issue creation is passed as `createAsUser` (a deprecated field for user impersonation). The template is never actually applied. If the template ID happens to match a user ID, the issue would be created as if that user created it.

**Fix:** Pass `templateId` correctly (Linear SDK may support it as a direct field), or remove `createAsUser` and handle templates via a different mechanism.

| Pros | Cons |
|------|------|
| Fixes completely broken `--template` feature | Need to verify Linear SDK's template API |
| Prevents accidental user impersonation | |

---

## Bug 1: `validateISODate` timezone bug causes false rejections

**File:** `src/lib/validators.ts:183-195`
**Priority:** HIGH | **Worth fixing:** YES

```typescript
const date = new Date(value);                    // Parsed in LOCAL timezone
const isoString = date.toISOString().split('T')[0]; // Converted to UTC
if (isoString !== value) { /* rejects valid date */ }
```

`new Date("2025-01-15")` is parsed as midnight local time. In UTC-negative timezones (Americas, Pacific), this rolls back to the previous day in UTC. The comparison `isoString !== value` then incorrectly rejects a valid date.

The `date-parser.ts:384` already does this correctly with `new Date(Date.UTC(year, month - 1, day))`.

**Fix:** Use `new Date(value + 'T00:00:00Z')` or parse components and use `Date.UTC()`.

| Pros | Cons |
|------|------|
| Fixes real user-facing bug in western hemisphere | None - one-line fix |
| Inconsistency with `date-parser.ts` which does it right | |

---

## Bug 2: `issue update --priority` uses raw value instead of validated value

**File:** `src/commands/issue/update.ts:322`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
const priorityResult = validatePriority(options.priority);
if (!priorityResult.valid) { ... }
updates.priority = options.priority;  // BUG: should be priorityResult.value
```

`validatePriority` converts string `"2"` to number `2`, but the result is discarded. If Commander passes priority as a string, the Linear API receives a string instead of a number.

`issue create` (line 229) correctly uses `priority = priorityResult.value`.

| Pros | Cons |
|------|------|
| Fixes type mismatch with Linear API | None |
| Consistent with issue create behavior | |

---

## Bug 3: `addAlias` validates entity twice via API

**File:** `src/lib/aliases.ts:480-516`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
// First call (line 481) - result.name is discarded
const validation = await validateEntity(type, id);
// ... adds alias ...
// Second identical call (line 514) - just to get the name
const validation = await validateEntity(type, id);
entityName = validation.name;
```

Makes two identical API calls. The name from the first call should be saved and reused.

| Pros | Cons |
|------|------|
| Eliminates redundant API call, reduces latency | None |
| Reduces rate-limit pressure | |

---

## Bug 4: `updateAliasId` also validates entity twice

**File:** `src/lib/aliases.ts:782-798`
**Priority:** MEDIUM | **Worth fixing:** YES

Same pattern as Bug 3. First `validateEntity` at line 783, second at line 795.

---

## Bug 5: Incomplete cycle alias support (half-implemented feature)

**Files:** `src/lib/aliases.ts:91-141`
**Priority:** MEDIUM | **Worth fixing:** YES

`cycles` is added to `getEmptyAliases()`, `loadAliases()`, and location tracking, but:
- `normalizeEntityType()` doesn't handle `'cycle'`/`'cycles'` → returns `null`
- `getAliasesKey()` doesn't handle `'cycle'` → falls through to `return 'projects'` (silent data corruption)

Users cannot manage cycle aliases, and if they try, cycle data would corrupt the projects namespace.

| Pros | Cons |
|------|------|
| Completes partially implemented feature | None |
| Prevents silent data corruption via fallback | |

---

## Bug 6: `getAliasesKey` silent fallback to 'projects'

**File:** `src/lib/aliases.ts:140`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
function getAliasesKey(type: AliasEntityType): keyof Aliases {
  // ... if/if/if chain ...
  return 'projects'; // silent fallback
}
```

Any unhandled entity type silently corrupts the projects namespace. Should throw an error for exhaustive type checking.

| Pros | Cons |
|------|------|
| Makes missing cases immediately visible | Would throw at runtime instead of silently failing |
| Prevents data corruption | (this is actually better behavior) |

---

## Bug 7: `sync-aliases.ts` ignores `addAlias` return value

**File:** `src/lib/sync-aliases.ts:212-223`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
try {
  await addAlias(entityType, alias.slug, alias.id, scope!, { skipValidation: true });
  created++; // Always increments, even when addAlias returns { success: false }
} catch (error) {
  if (error instanceof Error && error.message.includes('already points to')) {
    continue; // Never reached - addAlias doesn't throw
  }
}
```

`addAlias()` returns `{ success: false, error: "..." }` on failure - it doesn't throw. The catch block is dead code. The `created` counter over-reports successes.

| Pros | Cons |
|------|------|
| Fixes incorrect sync reporting | None |
| Makes sync failures visible to users | |

---

## Bug 8: `index.ts` doesn't handle async rejections

**File:** `src/index.ts:3`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
cli.parse(process.argv);  // Returns promise, not awaited/caught
```

Should use `cli.parseAsync(process.argv).catch(...)` for user-friendly error messages on unhandled async rejections.

| Pros | Cons |
|------|------|
| Prevents ugly stack traces for async errors | Minimal change |
| Better user experience | |

---

## Bug 9: `project/list.tsx` missing `parseInt` NaN checks

**File:** `src/commands/project/list.tsx:66,378`
**Priority:** MEDIUM | **Worth fixing:** YES

```typescript
filters.priority = parseInt(options.priority, 10);  // No NaN check
filters.limit = parseInt(options.limit, 10);         // No NaN check
```

`issue/list.ts` correctly validates with `isNaN()` checks. Project list does not.

| Pros | Cons |
|------|------|
| Consistent validation across commands | None |
| Prevents confusing API errors | |

---

## Bug 10: `workflow-states create/update` missing `parseInt` NaN checks

**Files:** `src/commands/workflow-states/create.ts:75`, `src/commands/workflow-states/update.ts:69`
**Priority:** LOW | **Worth fixing:** YES

```typescript
position: parseInt(options.position, 10),  // NaN sent to API if non-numeric
```

| Pros | Cons |
|------|------|
| Better error messages for invalid input | None |

---

## Bug 11: Multi-team project compatibility check only checks first team

**File:** `src/commands/issue/create.ts:391-393`
**Priority:** LOW | **Worth fixing:** YES

```typescript
const teams = await project.teams();
const teamsList = await teams.nodes;
const projectTeam = teamsList && teamsList.length > 0 ? teamsList[0] : null;
// Only checks teamsList[0], ignores other teams
```

Linear projects can belong to multiple teams. Should check if `teamId` is in `teamsList` using `.some()` or `.find()`.

| Pros | Cons |
|------|------|
| Supports multi-team projects correctly | Slightly more complex check |

---

## Bug 12: Hardcoded `/` path separator (cross-platform)

**Files:** `src/lib/aliases.ts:81`, `src/lib/config.ts:30`, `src/lib/milestone-templates.ts:191`
**Priority:** LOW | **Worth fixing:** OPTIONAL

```typescript
const dir = path.substring(0, path.lastIndexOf('/'));
```

Should use `path.dirname()` for cross-platform correctness. On Windows with `path.join()` paths, `lastIndexOf('/')` returns `-1`.

| Pros | Cons |
|------|------|
| Cross-platform correctness | Tool likely not used on Windows |
| Simple fix using `path.dirname()` | |

---

## Bug 13: `project create` uses raw `readFileSync` instead of `readContentFile`

**File:** `src/commands/project/create.tsx:69`
**Priority:** LOW | **Worth fixing:** YES

Issue create uses the shared `readContentFile` utility. Project create directly calls `readFileSync` with custom error handling that misses `EISDIR` and other cases.

| Pros | Cons |
|------|------|
| Consistency with issue create | None |
| Better error messages | |

---

## Bug 14: `project create` calls `getConfig()` twice

**File:** `src/commands/project/create.tsx:107,331`
**Priority:** LOW | **Worth fixing:** YES

Two calls to `getConfig()` in the same function, each reading/parsing config files from disk. Second call should reuse the existing `config` variable.

| Pros | Cons |
|------|------|
| Eliminates redundant file I/O | None |

---

## Bug 15: `browser.ts` potential command injection

**File:** `src/lib/browser.ts:14-19`
**Priority:** LOW | **Worth fixing:** OPTIONAL

```typescript
command = `open "${url}"`;
```

URL is interpolated into a shell command. A URL containing `$(...)` or backticks could execute arbitrary commands. Should use `execFile` with array arguments instead of `exec` with string interpolation.

| Pros | Cons |
|------|------|
| Eliminates injection vector | URLs are mostly internally generated |
| Defense in depth | Low real-world risk |

---

## Bug 16: Write functions have no error handling

**Files:** `src/lib/aliases.ts:80-86`, `src/lib/config.ts:29-35`
**Priority:** LOW | **Worth fixing:** OPTIONAL

`writeAliasesFile` and `writeConfigFile` have no try/catch. A failed write (permissions, disk full) produces an ugly Node.js stack trace instead of a user-friendly error.

| Pros | Cons |
|------|------|
| Better UX on write failures | Adds try/catch boilerplate |

---

## Summary

| # | Bug | Priority | Fix? | Category |
|---|-----|----------|------|----------|
| 0 | `createIssue` templateId → createAsUser | HIGH | YES | Wrong API field |
| 1 | `validateISODate` timezone | HIGH | YES | Logic bug |
| 2 | `issue update --priority` raw value | MEDIUM | YES | Type bug |
| 3 | `addAlias` double API call | MEDIUM | YES | Performance |
| 4 | `updateAliasId` double API call | MEDIUM | YES | Performance |
| 5 | Incomplete cycle alias support | MEDIUM | YES | Missing feature |
| 6 | `getAliasesKey` silent fallback | MEDIUM | YES | Data corruption risk |
| 7 | `sync-aliases` ignores return | MEDIUM | YES | Silent failure |
| 8 | `index.ts` unhandled rejections | MEDIUM | YES | Error handling |
| 9 | `project/list.tsx` NaN checks | MEDIUM | YES | Input validation |
| 10 | `workflow-states` NaN checks | LOW | YES | Input validation |
| 11 | Multi-team project check | LOW | YES | Logic bug |
| 12 | Hardcoded `/` separator | LOW | Optional | Cross-platform |
| 13 | Project create `readFileSync` | LOW | YES | Consistency |
| 14 | Project create double `getConfig` | LOW | YES | Performance |
| 15 | `browser.ts` command injection | LOW | Optional | Security |
| 16 | Write functions no error handling | LOW | Optional | Error handling |

**Recommended fix order:** 0, 1, 2, 5+6, 7, 3+4, 8, 9, 11
