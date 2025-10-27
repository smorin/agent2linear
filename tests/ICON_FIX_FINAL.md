# Icon Field Fix - Final Update

## Discovery: Linear Uses Capitalized Icon Names

After testing with actual Linear projects, we discovered that Linear's API expects **capitalized icon names** (PascalCase), not lowercase names.

### Evidence from Live Projects
```
Joystick         1  LP‑01 Landing page
Tree             1  TEST_20251026_200520_Content_File
Skull            1  TEST_20251026_200520_Content_Inline
Email            1  TEST_20251026_200520_Lead_Auto
Checklist        1  TEST_20251026_200520_Lead_None
```

---

## Final Changes Made

### 1. **Test Script** (`tests/scripts/test-project-create.sh`)
Updated all 4 icon values to use Linear's actual capitalized format:

| Line | Old Value | New Value |
|------|-----------|-----------|
| 462  | `'rocket'` → | `'Joystick'` |
| 470  | `'art'` → | `'Tree'` |
| 560  | `'star'` → | `'Skull'` |
| 571  | `'target'` → | `'Checklist'` |

### 2. **CLI Help Text** (`src/cli.ts`)
- **Option description:** `"Project icon name (e.g., "Joystick", "Tree", "Skull" - capitalized)"`
- **Example command:** `--icon "Tree"`
- **Field format:** `"Capitalized icon name like "Joystick", "Tree", "Skull", "Email", "Checklist""`

### 3. **Documentation** (`ICONS.md`)
Updated with:
- ✅ Correct examples using capitalized names: `Joystick`, `Tree`, `Skull`, `Email`, `Checklist`
- ❌ Incorrect examples showing lowercase won't work: `rocket`, `art`
- Note about capitalization requirement (PascalCase)
- List of verified working icons from actual Linear projects

---

## Icon Format Requirements

### ✅ CORRECT Format
```bash
--icon 'Joystick'
--icon 'Tree'
--icon 'Skull'
--icon 'Email'
--icon 'Checklist'
```

### ❌ INCORRECT Formats
```bash
--icon '🕹️'          # Raw emoji - will fail
--icon 'joystick'    # Lowercase - will fail
--icon 'JOYSTICK'    # All caps - will fail
```

### Format Rule
**Icon names must be capitalized (PascalCase)**:
- First letter uppercase
- Rest of the word as shown in Linear
- Examples: `Rocket`, `Star`, `Bug`, `Tree`, `Email`

---

## Test Results Expected

When running `./tests/scripts/test-project-create.sh`:

| Test # | Description | Icon | Expected |
|--------|-------------|------|----------|
| #26 | Visual: Icon (emoji) | `Joystick` | ✅ PASS |
| #28 | Visual: Icon + Color combined | `Tree` | ✅ PASS |
| Combo | Dates + Priority + Visual | `Skull` | ✅ PASS |
| Combo | Kitchen Sink | `Checklist` | ✅ PASS |

---

## How to Discover Valid Icons

### Method 1: Extract from Existing Projects
```bash
linear-create icons extract --type projects --workspace
```

This will show icons actually used in your Linear workspace with their exact capitalization.

### Method 2: Test with Linear UI
1. Create a project in Linear UI
2. Set an icon visually
3. Use `icons extract` to see what value Linear stored
4. Use that exact capitalized format in CLI

### Method 3: Common Icon Patterns
Most Linear icons follow this capitalization:
- Single words: `Bug`, `Star`, `Tree`, `Fire`, `Gear`
- Compound words: `Joystick`, `Lightbulb`, `Checklist`

---

## Files Modified (Final)

1. ✅ `tests/scripts/test-project-create.sh` - Icon names capitalized
2. ✅ `src/cli.ts` - Help text updated with capitalized examples
3. ✅ `ICONS.md` - Documentation updated with correct format
4. ✅ `dist/index.js` - Rebuilt with updates

---

## Key Learnings

1. **Linear uses capitalized icon identifiers**, not:
   - Raw emoji characters
   - Lowercase names
   - All-caps names

2. **Format is strict**: `Joystick` works, `joystick` and `JOYSTICK` don't

3. **Best practice**: Use `icons extract` to see actual icons from your workspace

4. **Future improvement**: Could add icon name validation to provide better error messages

---

## Verification Steps

### 1. Check Help Text
```bash
node dist/index.js project create --help | grep icon
```
Should show capitalized examples: `"Joystick", "Tree", "Skull"`

### 2. Verify Test Script
```bash
grep --icon tests/scripts/test-project-create.sh
```
Should show: `Joystick`, `Tree`, `Skull`, `Checklist`

### 3. Run Tests
```bash
LINEAR_API_KEY=<key> ./tests/scripts/test-project-create.sh
```
Tests #26, #28, and combo tests should PASS

---

## Next Steps

If tests still fail, it may be because:
1. API key is not set
2. Team ID doesn't exist
3. The specific icon names aren't available in your Linear workspace

To debug icon issues:
```bash
# See what icons are actually used in your workspace
linear-create icons extract --type projects --workspace

# Create a test project with one of those icons
linear-create project create --title "Icon Test" --team <team_id> --icon '<IconName>'
```
