# CMD.md Consistency Issues & Resolution Plan

This document outlines the inconsistencies found in CMD.md and provides resolution options for each issue.

---

## Issue 1: Command Name Mismatch - `set` vs `select`

### Problem
The Command Hierarchy (lines 50-52) shows `initiatives set` but throughout the document examples consistently reference `initiatives select`:
- Command Hierarchy shows: `└── set (action)`
- Migration section (line 394): "Use new `linear-create init select` for interactive selection"
- Category 3 section (lines 300-323): Full description of `initiatives select` command
- Examples section (lines 428-437): Shows `linear-create init select` usage

### Option 1: Rename command to `select`
**Change**: Update Command Hierarchy line 52 from `set` to `select`
**Evaluation**:
- ✅ Aligns with majority of document references (7+ mentions)
- ✅ More intuitive verb - "select an initiative" is clearer than "set an initiative"
- ✅ Consistent with the action's purpose (picking from a list)
- ✅ Minimal changes needed (only hierarchy section)
- ⚠️ May require code changes if `set` is already implemented

### Option 2: Rename all references to `set`
**Change**: Update all examples, migration section, and Category 3 to use `set` instead of `select`
**Evaluation**:
- ✅ Aligns with current Command Hierarchy
- ⚠️ "Set" is less clear for interactive selection - sounds like setting a value
- ⚠️ Requires changing 7+ locations throughout document
- ⚠️ Less intuitive for users ("set an initiative" vs "select an initiative")
- ⚠️ Conflicts with `config set` pattern (which sets key-value pairs)

### Option 3: Keep both as separate commands
**Change**: Add both `initiatives set <id>` (non-interactive) and `initiatives select` (interactive)
**Evaluation**:
- ✅ Provides both non-interactive and interactive modes as separate commands
- ✅ Follows pattern: `set` for direct ID setting, `select` for browsing
- ⚠️ Adds complexity - two commands for same outcome
- ⚠️ Requires updating hierarchy and adding `select` subcommand
- ⚠️ May confuse users about which to use

### Recommendation: **Option 1 - Rename to `select`**
**Rationale**: The command's purpose is interactive selection from a list, making "select" the most intuitive verb. The document was written with this intent throughout. Minimal documentation changes needed. The command name should match its primary use case.

---

## Issue 2: Timeline Ambiguity - Current vs Future Behavior

### Problem
Lines 166-225 describe non-interactive defaults as if they're current behavior, but lines 382-400 reveal these are breaking changes planned for v0.5.0. The document mixes prescriptive (future) and descriptive (current) without clear markers.

Current reality (v0.4.x):
- `project create` is interactive by default
- `initiatives list` provides interactive selection

Planned behavior (v0.5.0):
- Non-interactive by default
- Requires `--interactive` flag for prompts

### Option 1: Split into separate sections with clear version labels
**Change**: Create two major sections:
- "Current Behavior (v0.4.x)" - documents actual behavior now
- "Future Standards (v0.5.0+)" - documents planned changes
**Evaluation**:
- ✅ Crystal clear distinction between current and future
- ✅ Users can quickly find current documentation
- ✅ Maintains future standards as reference
- ⚠️ Creates duplicate content (same concepts explained twice)
- ⚠️ Requires maintaining two sets of documentation temporarily

### Option 2: Add version callouts inline throughout document
**Change**: Add version badges/notes inline like:
- `> ⚠️ **v0.5.0 Change**: This section describes future behavior`
- `> ℹ️ **Current (v0.4.x)**: Commands are interactive by default`
**Evaluation**:
- ✅ Keeps content flowing naturally
- ✅ Clear markers where behavior differs
- ⚠️ Can clutter the document with repeated warnings
- ⚠️ May confuse readers jumping between sections
- ⚠️ Hard to remove cleanly after v0.5.0 release

### Option 3: Document only current behavior, move future to MILESTONES.md
**Change**:
- CMD.md documents only actual current behavior
- Move v0.5.0 interactive mode changes to MILESTONES.md as planned work
- Update CMD.md only when v0.5.0 is released
**Evaluation**:
- ✅ CMD.md always reflects actual current implementation
- ✅ Single source of truth for current behavior
- ✅ Natural separation: CMD.md = standards, MILESTONES.md = roadmap
- ✅ No version callouts clutter
- ⚠️ Future standards not documented until implemented
- ⚠️ Requires writing migration section later

### Recommendation: **Option 3 - Document current behavior only**
**Rationale**: CMD.md should be a reference for how the tool works NOW, not how it will work. This follows standard documentation practices where current behavior lives in docs and planned changes live in roadmap/milestones. Clean separation of concerns. The "migration section" currently in CMD.md belongs in v0.5.0 milestone documentation or release notes.

---

## Issue 3: Version References Missing from Stub Commands

### Problem
Lines 55-63 show stub commands marked only as `[Coming Soon]` with no version numbers:
```
├── issues|iss (resource) [Coming Soon]
│   ├── create (stub)
```

But the stub command example (lines 130-133) shows version-specific messaging:
```
⚠️  This command is not yet implemented.
   Issue creation is planned for v0.5.0
```

Inconsistency: Hierarchy shows no version, but implementation example shows v0.5.0.

### Option 1: Add version numbers to hierarchy
**Change**: Update Command Hierarchy to show:
```
├── issues|iss (resource) [v0.5.0]
│   ├── create (stub)
│   └── list (stub)
├── teams|team (resource) [v0.6.0]
│   └── list (stub)
```
**Evaluation**:
- ✅ Clear roadmap visible in hierarchy
- ✅ Aligns with stub implementation example
- ✅ Users can see when features are coming
- ⚠️ Hierarchy becomes version-coupled (needs updates with schedule changes)
- ⚠️ May create pressure to meet version commitments

### Option 2: Remove version from stub example, keep generic
**Change**: Update stub implementation example to:
```
⚠️  This command is not yet implemented.
   See MILESTONES.md for details.
```
**Evaluation**:
- ✅ Generic message doesn't make version commitments
- ✅ Points users to single source of truth (MILESTONES.md)
- ✅ No updates needed if schedule changes
- ⚠️ Less immediate information for users
- ⚠️ Requires reading separate file to find timeline

### Option 3: Add version to both hierarchy and reference MILESTONES.md
**Change**: Update both locations:
- Hierarchy: `├── issues|iss (resource) [Planned: v0.5.0]`
- Stub message: Points to MILESTONES.md for details
**Evaluation**:
- ✅ Quick version reference in hierarchy
- ✅ Detailed planning in MILESTONES.md
- ✅ "Planned:" prefix indicates this may change
- ⚠️ Requires updating two places if schedule changes
- ⚠️ Partial duplication of information

### Recommendation: **Option 2 - Generic stub messages, defer to MILESTONES.md**
**Rationale**: Version numbers in CMD.md create maintenance burden and false expectations. CMD.md is a command structure reference, not a roadmap. MILESTONES.md is the authoritative source for version planning. Keep CMD.md clean and point users to the right place for roadmap information. Stub commands can include the MILESTONES.md reference directly.

---

## Issue 4: Migration Section References Non-Existent Flag

### Problem
Lines 396-399 document removal of `--no-interactive` flag:
```
3. **`--no-interactive` flag removed**
   - **Before:** `--no-interactive` flag available
   - **After:** Flag removed (non-interactive is default)
```

However, `--no-interactive` is never mentioned elsewhere in the document as current or past functionality. If it was never implemented or documented, why is it in the migration section?

### Option 1: Remove the `--no-interactive` migration item entirely
**Change**: Delete lines 396-399
**Evaluation**:
- ✅ Removes documentation of non-existent feature
- ✅ Cleaner migration guide
- ⚠️ If the flag actually exists in code (v0.4.x), users won't know it's deprecated
- ⚠️ Need to verify if flag exists in actual implementation

### Option 2: Keep it and add documentation for current behavior
**Change**:
- Add `--no-interactive` to current command options documentation (if it exists)
- Keep migration note documenting its removal
**Evaluation**:
- ✅ Complete documentation of all flags
- ✅ Proper migration path for existing users
- ⚠️ Only valid if flag actually exists in codebase
- ⚠️ Adds documentation for soon-to-be-removed feature

### Option 3: Replace with conditional statement
**Change**: Update to:
```
3. **`--no-interactive` flag (if present)**
   - If this flag exists in v0.4.x, it will be removed
   - Non-interactive is the default behavior; no flag needed
```
**Evaluation**:
- ✅ Honest about uncertainty
- ✅ Provides guidance if flag exists
- ⚠️ Looks unprofessional (unclear documentation)
- ⚠️ Should verify actual state instead of hedging

### Recommendation: **Option 1 - Remove the migration item** (pending verification)
**Rationale**: Documentation shouldn't reference features that don't exist. First, verify if `--no-interactive` exists in the actual codebase. If it doesn't exist, remove this migration item entirely. If it does exist, follow Option 2. The migration section should only document actual breaking changes, not hypothetical ones.

**Action Required**: Check `src/cli.ts` and related files to verify if `--no-interactive` flag currently exists.

---

## Issue 5: Version History Incomplete

### Problem
Version History (lines 767-774) ends at v0.4.1, but v0.5.0 is referenced 4+ times throughout the document:
- Line 131: "planned for v0.5.0"
- Line 385: "Breaking Changes in v0.5.0"
- Migration section extensively covers v0.5.0

Current version history:
```
- **v0.4.1** - Standardized help behavior and documentation (2024)
- **v0.4.0** - Project creation with interactive and non-interactive modes
```

### Option 1: Add v0.5.0 as "Planned" entry
**Change**: Add to version history:
```
- **v0.5.0** (Planned) - Non-interactive mode by default, breaking changes to command behavior
- **v0.4.1** - Standardized help behavior and documentation (2024)
```
**Evaluation**:
- ✅ Acknowledges v0.5.0 references in document
- ✅ Clearly marked as "Planned"
- ✅ Provides roadmap visibility
- ⚠️ Mixes actual history with future plans
- ⚠️ Will need to update when actually released

### Option 2: Move version history to MILESTONES.md
**Change**:
- Remove version history section from CMD.md
- Add note: "See MILESTONES.md for version history and roadmap"
- Maintain complete version history in MILESTONES.md
**Evaluation**:
- ✅ Single source of truth for versions
- ✅ Natural fit - milestones track versions
- ✅ CMD.md stays focused on command structure
- ⚠️ Users may expect version history in standards doc
- ⚠️ Removes convenient reference from CMD.md

### Option 3: Keep only released versions, add roadmap section
**Change**:
- Keep Version History with only released versions
- Add new section "Roadmap" that references MILESTONES.md
```
## Version History
- **v0.4.1** - Standardized help behavior and documentation (2024)
- **v0.4.0** - Project creation

## Roadmap
For planned features and upcoming versions, see MILESTONES.md.
```
**Evaluation**:
- ✅ Clear separation: history = past, roadmap = future
- ✅ Points to authoritative source for planning
- ✅ Version history remains factual
- ⚠️ Adds a new section to document

### Recommendation: **Option 3 - Keep history factual, add roadmap pointer**
**Rationale**: Version history should be factual record of what shipped. Planned versions don't belong in history - they belong in roadmap/milestones. This option maintains historical record while pointing users to the right place for future plans. Clean separation of concerns.

---

## Issue 6: Interactive Mode Category Conflicts

### Problem
**Category 2: List/Browse Commands** (lines 266-298) describes `initiatives list` as:
- Non-interactive mode (default): Output formatted list to stdout
- Interactive mode (--interactive): Browse with keyboard navigation

But **Migration section** (lines 391-395) says:
```
2. **`initiatives list`** - Now non-interactive list
   - **Before:** `linear-create init list` → Interactive selection
   - **Migration:** Use new `linear-create init select` for interactive selection
```

Conflict: Migration implies `list` previously did **selection** (Category 3 behavior), not **browsing** (Category 2 behavior).

### Option 1: Clarify that old `list` was actually `select`
**Change**: Update migration section to:
```
2. **`initiatives list` command split**
   - **Before (v0.4.x):** `linear-create init list` → Interactive selection (saves choice)
   - **After (v0.5.0):**
     - `linear-create init list` → Prints list to stdout
     - `linear-create init select` → Interactive selection (saves choice)
   - **Migration:** Use `init select` for interactive selection, `init list` for printing
```
**Evaluation**:
- ✅ Accurately describes the behavioral split
- ✅ Clear migration path for users
- ✅ Explains why two commands now exist
- ⚠️ Reveals that old `list` was really a `select` operation (naming issue)

### Option 2: Remove Category 2 interactive mode for `list`
**Change**:
- Update Category 2 to say `list` commands are **non-interactive only**
- Remove any mention of `list --interactive` browsing mode
- `list` outputs to stdout only, no interactive mode
**Evaluation**:
- ✅ Simplifies command model
- ✅ Clear separation: `list` = output, `select` = interactive
- ✅ Aligns with migration which splits these behaviors
- ⚠️ Loses potential browsing feature for lists
- ⚠️ Requires updating Category 2 description

### Option 3: Add three separate commands: list, browse, select
**Change**: Create distinct commands:
- `initiatives list` - Non-interactive stdout output
- `initiatives browse` - Interactive browsing (no action)
- `initiatives select` - Interactive selection (saves choice)
**Evaluation**:
- ✅ Each command has single clear purpose
- ✅ Maximum flexibility for users
- ⚠️ More commands = more complexity
- ⚠️ Three commands for viewing initiatives may be overkill
- ⚠️ Significant implementation work

### Recommendation: **Option 2 - Remove interactive mode from `list` commands**
**Rationale**: The migration section reveals the original design flaw - `list` was actually performing selection. The v0.5.0 plan correctly separates these into `list` (output data) and `select` (interactive choice). Category 2 should be updated to reflect this: `list` commands are non-interactive only. If users want interactive browsing without selection, that's a future enhancement, but the core separation is: `list` = data output, `select` = interactive choice. Keep it simple.

---

## Summary of Recommendations

| Issue | Recommendation | Impact |
|-------|---------------|--------|
| 1. Command name mismatch | **Option 1**: Rename to `select` | Low - Update hierarchy only |
| 2. Timeline ambiguity | **Option 3**: Document current behavior only | High - Major restructuring |
| 3. Stub version references | **Option 2**: Generic messages, defer to MILESTONES.md | Low - Update examples |
| 4. Non-existent flag | **Option 1**: Remove (after verification) | Low - Delete 4 lines |
| 5. Incomplete version history | **Option 3**: Keep factual, add roadmap pointer | Low - Add roadmap section |
| 6. Category conflicts | **Option 2**: Remove interactive mode from list | Medium - Update Category 2 |

---

## Implementation Order

**Phase 1: Verification** (Required before fixes)
1. Check codebase for `--no-interactive` flag existence (Issue 4)
2. Confirm current command is `set` or `select` (Issue 1)
3. Document actual current behavior of `initiatives list` (Issue 6)

**Phase 2: Quick Fixes** (Low impact)
1. Issue 4: Remove non-existent flag reference
2. Issue 5: Add roadmap section to version history
3. Issue 3: Update stub examples to generic messages

**Phase 3: Structural Changes** (Medium-High impact)
1. Issue 1: Rename command to `select` throughout
2. Issue 6: Update Category 2 to remove `list` interactive mode
3. Issue 2: Restructure document to show current behavior only

**Phase 4: Content Migration**
1. Move v0.5.0 planning to MILESTONES.md
2. Ensure CMD.md reflects v0.4.x behavior only
3. Update examples to match current implementation

---

---

## Resolution Summary

All issues have been resolved. Below is a summary of what was implemented:

### Issue 1: Command Name Mismatch ✅
**Resolution**: Option 1 - Updated hierarchy to show BOTH commands
**Changes**:
- Updated CMD.md line 52-53 to show both `select (action)` and `set <id> (action)`
- Both commands coexist and serve different use cases:
  - `select`: Interactive browsing with optional `--id` flag
  - `set <id>`: Direct non-interactive setting with positional argument

### Issue 2: Timeline Ambiguity ✅
**Resolution**: Option 3 - Document current behavior only
**Changes**:
- Removed "Migration from Current Behavior" section (lines 383-396) from CMD.md
- Section was outdated - described changes already implemented in v0.4.x
- Verified current code: `project create` and `initiatives list` already default to non-interactive
**Note**: No content moved to MILESTONES.md because the "migration" was describing past behavior, not future plans

### Issue 3: Version References in Stub Commands ✅
**Resolution**: Option 2 - Generic messages pointing to MILESTONES.md
**Changes**:
- Updated CMD.md stub example (line 133) to remove version number
- Updated all stub commands in src/cli.ts to use generic message:
  - `issues create`, `issues list`, `teams list`, `milestones list`, `labels list`
- New message: "See MILESTONES.md for planned features and timeline."

### Issue 4: Non-Existent `--no-interactive` Flag ✅
**Resolution**: Option 1 - Remove migration item entirely
**Changes**:
- Deleted lines 397-400 from CMD.md
- Verified flag does not exist in codebase (only `-I, --interactive` exists)

### Issue 5: Incomplete Version History ✅
**Resolution**: Option 3 - Keep factual history, add roadmap section
**Changes**:
- Added "Roadmap" section to CMD.md (line 773-775)
- Points to MILESTONES.md for planned features and upcoming versions
- Version History remains factual (only released versions)

### Issue 6: Interactive Mode Category Conflicts ✅
**Resolution**: Option 2 - Clarify list defaults to non-interactive
**Changes**:
- Updated Category 2 description (line 269, 282)
- Purpose now explicitly states: "Display or browse resources (view only, does not save)"
- Added note: "Browsing only - does not save selections. Use `select` commands to save choices."
- Clarifies distinction between `list` (browsing) and `select` (saving)

---

## Files Modified

1. **CMD.md**
   - Command hierarchy updated (Issue 1)
   - Migration section removed (Issue 2)
   - Stub example made generic (Issue 3)
   - Non-existent flag reference removed (Issue 4)
   - Roadmap section added (Issue 5)
   - Category 2 description clarified (Issue 6)

2. **src/cli.ts**
   - All stub command messages updated to generic format (Issue 3)
   - 5 stub commands updated: issues create/list, teams list, milestones list, labels list

3. **MILESTONES.md**
   - No changes needed (existing structure already appropriate)

---

## Verification

✅ CMD.md now documents current v0.4.x behavior only
✅ No references to future v0.5.0 behavior
✅ All stub commands use consistent generic messages
✅ Command hierarchy is complete and accurate
✅ Version history is factual
✅ Category descriptions are clear and unambiguous

---

## Key Discovery

The "Migration from Current Behavior" section was incorrectly describing future v0.5.0 changes. Verification of the actual codebase revealed:
- `project create` already defaults to non-interactive in v0.4.x (line 234 of create.tsx: "// Non-interactive mode (default)")
- `initiatives list` already defaults to non-interactive in v0.4.x (lines 76-93 of list.tsx)
- `initiatives select` command already exists (separate from `set`)

The described "breaking changes" were already implemented, making the migration section obsolete rather than future-looking.
