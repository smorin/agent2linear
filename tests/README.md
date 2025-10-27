# Testing Documentation

This directory contains comprehensive test suites for the `linear-create` project.

## Directory Structure

```
tests/
├── README.md           # This file
└── scripts/            # Test scripts
    ├── test-project-create.sh   # Project create command tests (~45 test cases)
    ├── test-project-update.sh   # Project update command tests (~35 test cases)
    └── run-all-tests.sh         # Runs all test suites
```

## Overview

The test suite provides comprehensive coverage of the `project create` and `project update` commands, including:

- ✅ All CLI flags and options
- ✅ Alias resolution for all entity types
- ✅ Multi-value fields (labels, members, links)
- ✅ Content inline vs file
- ✅ Date/priority/visual properties
- ✅ Complex multi-field combinations
- ✅ Error validation and edge cases
- ✅ Project resolution (name/ID/alias)

## Prerequisites

Before running the tests, ensure you have:

1. **Linear API Key**: Set the `LINEAR_API_KEY` environment variable
   ```bash
   export LINEAR_API_KEY=lin_api_xxx...
   ```

2. **Build the project**: Ensure `dist/index.js` exists
   ```bash
   npm run build
   ```

3. **Linear workspace data**: At least one team in your Linear workspace
   - For full coverage, you should also have:
     - One or more initiatives (optional)
     - Project statuses configured
     - Project labels (optional)
     - Team members

## Running Tests

### Run All Tests (Recommended)

```bash
cd tests/scripts
./run-all-tests.sh
```

This will:
1. Run all project create tests
2. Run all project update tests
3. Generate combined summary report
4. Create cleanup scripts for all test projects

### Run Individual Test Suites

**Project Create Tests:**
```bash
cd tests/scripts
./test-project-create.sh
```

**Project Update Tests:**
```bash
cd tests/scripts
./test-project-update.sh
```

## Test Coverage

### Project Create Tests (~45 test cases)

#### Success Tests (39 tests)
1. **Basic Creation** (4 tests)
   - Minimal (title + team)
   - With description
   - With initiative
   - Combined fields

2. **Alias Resolution** (6 tests)
   - Team via alias
   - Initiative via alias
   - Status via alias
   - Lead via alias
   - Multiple aliases combined

3. **Content Handling** (4 tests)
   - Inline markdown
   - From file
   - Special characters
   - Empty content

4. **Lead Assignment** (4 tests)
   - Auto-assign (default)
   - Explicit --no-lead
   - Via alias
   - Via email

5. **Dates & Priority** (7 tests)
   - Start date only
   - Target date only
   - Both dates with resolutions
   - Priority levels (0-4)
   - Combined

6. **Visual Properties** (3 tests)
   - Icon (emoji)
   - Color (hex)
   - Combined

7. **External Links** (4 tests)
   - Single URL
   - URL with label
   - Multiple links
   - Mixed formats

8. **Multi-value Fields** (4 tests)
   - Labels (single & multiple)
   - Members (single & multiple)

9. **Complex Combinations** (5 tests)
   - All text fields
   - All ID fields
   - Dates + priority + visual
   - Content + links + labels
   - Kitchen sink (maximum fields)

#### Error Tests (8 tests)
- Missing required fields (title, team)
- Title too short
- Invalid IDs (team, initiative)
- Mutual exclusion (--content vs --content-file)
- Invalid priority
- Non-existent files

### Project Update Tests (~35 test cases)

#### Success Tests (27 tests)
1. **Project Resolution** (3 tests)
   - By exact name
   - By project ID
   - By alias

2. **Single Field Updates** (7 tests)
   - Status (via name & alias)
   - Name, description, priority
   - Start date, target date

3. **Content Updates** (3 tests)
   - Inline markdown
   - From file
   - Clear content

4. **Multi-field Updates** (8 tests)
   - Status + priority
   - Name + description
   - All dates
   - Status + dates + priority
   - Content + description
   - Name + content + status
   - Kitchen sink (all fields)

5. **Alias Combinations** (3 tests)
   - Project via alias + status via alias
   - Mixed resolution methods
   - Various combinations

#### Error Tests (8 tests)
- Project not found
- Status not found
- Invalid priority values
- Mutual exclusion errors
- No update fields provided
- Invalid date format
- Non-existent files

## Test Behavior

### What Tests Do

1. **Create test aliases** for teams, initiatives, statuses, members
2. **Create test projects** with prefix `TEST_[TIMESTAMP]_`
3. **Run all test cases** sequentially
4. **Track pass/fail** for each test
5. **Generate cleanup scripts** listing all created projects

### What Tests DON'T Do

- ❌ Tests **do not delete** projects automatically
- ❌ Tests **do not modify** existing projects (except those created during testing)
- ❌ Tests **do not delete** aliases (removed at end of test run)

### Cleanup

After running tests, you'll have cleanup scripts:

```bash
# Individual cleanup scripts
./cleanup-create-projects.sh
./cleanup-update-projects.sh

# Combined cleanup (created by run-all-tests.sh)
./cleanup-all-projects.sh
```

⚠️ **Note**: The cleanup scripts currently list project IDs but don't delete them automatically (since `project delete` command isn't implemented yet). You'll need to manually delete via Linear UI or wait for the delete command.

## Output Format

Each test displays:
- Test number and description
- Command being executed
- Pass/fail status with visual indicators (✅/❌)
- Key output fields (ID, Name, URL)

Example output:
```
==================================================
TEST #1: Basic: Minimal (title + team)
COMMAND: node dist/index.js project create --title 'TEST_...' --team team_xxx
--------------------------------------------------
✅ PASSED
Project ID: abc123-def456-ghi789
   Name: TEST_20251026_123456_Basic_Minimal
   ID: abc123-def456-ghi789
   URL: https://linear.app/project/abc123
```

## Test Summary

At the end of each test run:
```
==========================================
  TEST SUITE COMPLETE
==========================================
Total Tests:   45
Passed:        43
Failed:        2

Projects Created: 37

Cleanup script generated: cleanup-create-projects.sh
Run ./cleanup-create-projects.sh to remove test projects
```

## Troubleshooting

### Tests fail with "LINEAR_API_KEY not set"
```bash
export LINEAR_API_KEY=lin_api_xxx...
```

### Tests fail with "dist/index.js not found"
```bash
cd ../..
npm run build
cd tests/scripts
```

### Tests fail with "No teams found"
Ensure your Linear workspace has at least one team configured.

### Individual test failures
- Review the test output for specific error messages
- Check that your workspace has the required entities (teams, statuses, etc.)
- Verify API key has correct permissions

## Contributing

When adding new tests:

1. Add test cases to appropriate category in the scripts
2. Update this README with new test coverage
3. Ensure tests follow the existing pattern (success tests first, then error tests)
4. Update the test count in documentation

## Future Enhancements

- [ ] Add `project delete` command and enable auto-cleanup
- [ ] Add tests for `project add-milestones` command
- [ ] Add tests for template application
- [ ] Add performance benchmarks
- [ ] Add CI/CD integration
- [ ] Add test for `--web` and `--interactive` flags (currently manual)
