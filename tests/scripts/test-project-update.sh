#!/bin/bash
#
# Comprehensive Test Suite for: linear-create project update
#
# This script tests all permutations and combinations of the project update command
# including project resolution (name/ID/alias), field updates, and error cases.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - linear-create must be built (npm run build)
#   - You should have at least one team in your Linear workspace
#   - This script will create test projects to update
#
# Usage:
#   ./test-project-update.sh [OPTIONS]
#
# Options:
#   --test N        Run only test #N
#   --start N       Run tests starting from #N
#   --end N         Run tests up to #N
#   --range N-M     Run tests from #N to #M
#   --no-setup      Skip creating test projects (assumes they exist)
#   --help, -h      Show help message
#
# Examples:
#   ./test-project-update.sh                # Run all tests (with setup)
#   ./test-project-update.sh --test 5       # Run only test #5 (with setup)
#   ./test-project-update.sh --start 15     # Run tests 15 and above (with setup)
#   ./test-project-update.sh --range 10-20  # Run tests 10-20 (with setup)
#   ./test-project-update.sh --test 5 --no-setup  # Rerun test #5 without setup
#
# Output:
#   - Creates test projects in Linear (prefixed with TEST_UPDATE_)
#   - Updates those projects with various combinations
#   - Generates cleanup-update-projects.sh for manual cleanup
#   - Prints summary of passed/failed/skipped tests
#

set -e  # Exit on first error
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_PREFIX="TEST_UPDATE_$(date +%Y%m%d_%H%M%S)"
PROJECTS_CREATED=()
PROJECT_NAMES=()
PASSED=0
FAILED=0
SKIPPED=0
TEST_COUNT=0
CLI_CMD="node dist/index.js"

# Test range configuration (can be overridden by command-line args)
START_TEST=1
END_TEST=999999
SKIP_SETUP=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --test)
            START_TEST="$2"
            END_TEST="$2"
            shift 2
            ;;
        --start)
            START_TEST="$2"
            shift 2
            ;;
        --end)
            END_TEST="$2"
            shift 2
            ;;
        --range)
            IFS='-' read -r START_TEST END_TEST <<< "$2"
            shift 2
            ;;
        --no-setup)
            SKIP_SETUP=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --test N        Run only test #N"
            echo "  --start N       Run tests starting from #N"
            echo "  --end N         Run tests up to #N"
            echo "  --range N-M     Run tests from #N to #M"
            echo "  --no-setup      Skip creating test projects (assumes they exist)"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests (with setup)"
            echo "  $0 --test 5           # Run only test #5 (with setup)"
            echo "  $0 --start 15         # Run tests 15 and above (with setup)"
            echo "  $0 --range 10-20      # Run tests 10 through 20 (with setup)"
            echo "  $0 --test 5 --no-setup  # Run test #5 without recreating projects"
            echo ""
            echo "Note: Setup (creating test projects) runs by default. Use --no-setup"
            echo "      to skip it when rerunning tests against existing projects."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Trap to ensure cleanup script is always generated
trap generate_cleanup_script EXIT

echo "=================================================="
echo "  PROJECT UPDATE - COMPREHENSIVE TEST SUITE"
echo "=================================================="
echo "Test prefix: $TEST_PREFIX"
echo "CLI command: $CLI_CMD"
if [ "$START_TEST" -ne 1 ] || [ "$END_TEST" -ne 999999 ]; then
    echo "Test range: #$START_TEST to #$END_TEST"
fi
if [ "$SKIP_SETUP" = "true" ]; then
    echo "Setup: SKIPPED (--no-setup)"
else
    echo "Setup: Will create test projects"
fi
echo ""

# Check prerequisites
if [ -z "$LINEAR_API_KEY" ]; then
    echo -e "${RED}ERROR: LINEAR_API_KEY environment variable not set${NC}"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}ERROR: dist/index.js not found. Run 'npm run build' first${NC}"
    exit 1
fi

# Get test data
echo "Fetching test data from Linear..."
TEAMS_JSON=$($CLI_CMD teams list --format json)
TEST_TEAM_ID=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.id || '')")

if [ -z "$TEST_TEAM_ID" ]; then
    echo -e "${RED}ERROR: No teams found in workspace${NC}"
    exit 1
fi

echo "Using test team: $TEST_TEAM_ID"
echo ""

# ============================================================
# HELPER FUNCTIONS
# ============================================================

run_test() {
    local description="$1"
    local command="$2"
    local should_fail="${3:-false}"

    ((TEST_COUNT++))

    # Check if test should be skipped based on range
    if [ "$TEST_COUNT" -lt "$START_TEST" ] || [ "$TEST_COUNT" -gt "$END_TEST" ]; then
        echo "=================================================="
        echo -e "${YELLOW}TEST #${TEST_COUNT}: ${description}${NC}"
        echo -e "${YELLOW}⊘ SKIPPED (outside test range)${NC}"
        echo ""
        ((SKIPPED++))
        return 0
    fi

    echo "=================================================="
    echo -e "${BLUE}TEST #${TEST_COUNT}: ${description}${NC}"
    echo "COMMAND: $command"
    echo "--------------------------------------------------"

    if [ "$should_fail" = "true" ]; then
        # This test should fail
        if eval "$command" 2>&1; then
            echo -e "${RED}❌ FAILED (expected to fail but succeeded)${NC}"
            ((FAILED++))
        else
            echo -e "${GREEN}✅ PASSED (failed as expected)${NC}"
            ((PASSED++))
        fi
    else
        # This test should succeed
        local output
        if output=$(eval "$command" 2>&1); then
            echo -e "${GREEN}✅ PASSED${NC}"
            ((PASSED++))

            # Show abbreviated output
            echo "$output" | grep -E '(✅|Name:|ID:|URL:|Updated)' || true
        else
            echo -e "${RED}❌ FAILED${NC}"
            echo "Error output:"
            echo "$output"
            ((FAILED++))
        fi
    fi

    echo ""
}

create_test_project() {
    local name="$1"
    local description="${2:-Test project for update}"

    # Redirect status messages to stderr so they don't get captured by command substitution
    echo -n "Creating test project: $name... " >&2

    local output
    if output=$($CLI_CMD project create --title "$name" --team "$TEST_TEAM_ID" --description "$description" 2>&1); then
        local project_id=$(echo "$output" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)

        if [ -n "$project_id" ]; then
            PROJECTS_CREATED+=("$project_id")
            PROJECT_NAMES+=("$name")
            echo "✅ Created ($project_id)" >&2
            # Only output the project ID to stdout (for capture)
            echo "$project_id"
            return 0
        else
            echo "❌ Failed (couldn't extract ID)" >&2
            return 1
        fi
    else
        echo "❌ Failed to create" >&2
        echo "$output" >&2
        return 1
    fi
}

setup_test_aliases() {
    echo "=================================================="
    echo "SETUP: Creating test aliases"
    echo "=================================================="

    # Create test aliases for project statuses
    local statuses_json=$($CLI_CMD project-status list --format json 2>/dev/null || echo "[]")
    local status_id=$(echo "$statuses_json" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const statuses=JSON.parse(data); console.log(statuses[0]?.id || '')")
    local status_name=$(echo "$statuses_json" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const statuses=JSON.parse(data); console.log(statuses[0]?.name || '')")

    if [ -n "$status_id" ]; then
        $CLI_CMD alias add project-status test-update-status "$status_id" --skip-validation 2>/dev/null || true
        TEST_STATUS_ALIAS="test-update-status"
        TEST_STATUS_NAME="$status_name"
        echo "Created status alias: $TEST_STATUS_ALIAS -> $status_id ($status_name)"
    fi

    echo "Test aliases created"
    echo ""
}

cleanup_test_aliases() {
    echo "=================================================="
    echo "CLEANUP: Removing test aliases"
    echo "=================================================="

    $CLI_CMD alias remove project-status test-update-status 2>/dev/null || true
    $CLI_CMD alias remove project test-update-proj 2>/dev/null || true

    echo "Test aliases removed"
    echo ""
}

generate_cleanup_script() {
    local script_name="cleanup-update-projects.sh"

    echo "=================================================="
    echo "Generating cleanup script: $script_name"
    echo "=================================================="

    cat > "$script_name" <<'EOF_OUTER'
#!/bin/bash
#
# Auto-generated cleanup script for test projects
# Generated: $(date)
#
# This script will help you delete test projects created during testing.
# Review the list below and run this script to clean them up.
#

set -e

EOF_OUTER

    echo "# Projects created: ${#PROJECTS_CREATED[@]}" >> "$script_name"
    echo "" >> "$script_name"
    echo "PROJECTS=(" >> "$script_name"

    for i in "${!PROJECTS_CREATED[@]}"; do
        echo "    \"${PROJECTS_CREATED[$i]}\"  # $((i+1)). ${PROJECT_NAMES[$i]}" >> "$script_name"
    done

    echo ")" >> "$script_name"
    echo "" >> "$script_name"

    cat >> "$script_name" <<'EOF_SCRIPT'

echo "=========================================="
echo "  CLEANUP TEST PROJECTS"
echo "=========================================="
echo "This will delete ${#PROJECTS[@]} test projects"
echo ""
echo "Projects to delete:"
for i in "${!PROJECTS[@]}"; do
    echo "  $((i+1)). ${PROJECTS[$i]}"
done
echo ""
read -p "Continue with deletion? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting projects..."
DELETED=0
FAILED=0

for project_id in "${PROJECTS[@]}"; do
    echo -n "Deleting $project_id... "

    # Note: You'll need to implement project delete command or use Linear UI
    # For now, this just lists the IDs
    echo "⚠️  DELETE NOT IMPLEMENTED - Please delete via Linear UI"
    echo "   Project URL: https://linear.app/project/$project_id"

    # Uncomment when delete command is available:
    # if node dist/index.js project delete "$project_id" --yes 2>/dev/null; then
    #     echo "✅ Deleted"
    #     ((DELETED++))
    # else
    #     echo "❌ Failed"
    #     ((FAILED++))
    # fi
done

echo ""
echo "=========================================="
echo "Deletion Summary:"
echo "  Total:   ${#PROJECTS[@]}"
echo "  Deleted: $DELETED"
echo "  Failed:  $FAILED"
echo "=========================================="
EOF_SCRIPT

    chmod +x "$script_name"
    echo "Created: $script_name"
    echo ""
}

# ============================================================
# SETUP
# ============================================================

setup_test_aliases

# Create test content file
TEST_CONTENT_FILE="/tmp/test-update-content-$TEST_PREFIX.md"
cat > "$TEST_CONTENT_FILE" <<'EOF_CONTENT'
# Updated Project Content

This is **updated content** from a file.

## Updated Features
- New Feature 1
- New Feature 2

## Updated Timeline
Q2 2025
EOF_CONTENT

echo "Created test content file: $TEST_CONTENT_FILE"
echo ""

# ============================================================
# CREATE TEST PROJECTS FOR UPDATE TESTS
# ============================================================

if [ "$SKIP_SETUP" = "false" ]; then
    echo "=================================================="
    echo "CREATING TEST PROJECTS"
    echo "=================================================="
    echo ""

    # Temporarily disable exit-on-error for project creation
    # This allows the script to continue even if some projects fail to create
    set +e

    # Create projects for different update scenarios
    PROJ_BY_NAME=$(create_test_project "${TEST_PREFIX}_UpdateByName" "Project to update by name")
    PROJ_BY_ID=$(create_test_project "${TEST_PREFIX}_UpdateById" "Project to update by ID")
    PROJ_BY_ALIAS=$(create_test_project "${TEST_PREFIX}_UpdateByAlias" "Project to update by alias")
    PROJ_STATUS=$(create_test_project "${TEST_PREFIX}_UpdateStatus" "Project for status update")
    PROJ_NAME=$(create_test_project "${TEST_PREFIX}_UpdateName" "Project for name update")
    PROJ_DESC=$(create_test_project "${TEST_PREFIX}_UpdateDescription" "Project for description update")
    PROJ_PRIORITY=$(create_test_project "${TEST_PREFIX}_UpdatePriority" "Project for priority update")
    PROJ_DATES=$(create_test_project "${TEST_PREFIX}_UpdateDates" "Project for date updates")
    PROJ_CONTENT_INLINE=$(create_test_project "${TEST_PREFIX}_UpdateContentInline" "Project for inline content update")
    PROJ_CONTENT_FILE=$(create_test_project "${TEST_PREFIX}_UpdateContentFile" "Project for file content update")
    PROJ_MULTI1=$(create_test_project "${TEST_PREFIX}_UpdateMulti1" "Project for multi-field update 1")
    PROJ_MULTI2=$(create_test_project "${TEST_PREFIX}_UpdateMulti2" "Project for multi-field update 2")
    PROJ_MULTI3=$(create_test_project "${TEST_PREFIX}_UpdateMulti3" "Project for multi-field update 3")
    PROJ_MULTI4=$(create_test_project "${TEST_PREFIX}_UpdateMulti4" "Project for multi-field update 4")
    PROJ_KITCHEN=$(create_test_project "${TEST_PREFIX}_UpdateKitchenSink" "Project for kitchen sink update")

    # Re-enable exit-on-error
    set -e

    # Create alias for one project
    if [ -n "$PROJ_BY_ALIAS" ]; then
        $CLI_CMD alias add project test-update-proj "$PROJ_BY_ALIAS" --skip-validation 2>/dev/null || true
        echo "Created project alias: test-update-proj -> $PROJ_BY_ALIAS"
    fi

    echo ""
    echo "Test projects created: ${#PROJECTS_CREATED[@]}"
    echo ""
else
    echo "=================================================="
    echo "SKIPPING SETUP (--no-setup flag provided)"
    echo "=================================================="
    echo "Assuming test projects already exist from a previous run."
    echo "If tests fail, remove --no-setup to recreate projects."
    echo ""
fi

# ============================================================
# SUCCESS TESTS - PROJECT RESOLUTION
# ============================================================

echo "=========================================="
echo "CATEGORY: Project Resolution"
echo "=========================================="
echo ""

run_test \
    "Resolution: Update by exact name" \
    "$CLI_CMD project update '${TEST_PREFIX}_UpdateByName' --description 'Updated via name'"

run_test \
    "Resolution: Update by project ID" \
    "$CLI_CMD project update '$PROJ_BY_ID' --description 'Updated via ID'"

run_test \
    "Resolution: Update by alias" \
    "$CLI_CMD project update 'test-update-proj' --description 'Updated via alias'"

# ============================================================
# SUCCESS TESTS - SINGLE FIELD UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Single Field Updates"
echo "=========================================="
echo ""

if [ -n "$TEST_STATUS_NAME" ]; then
    run_test \
        "Single Field: Status via name" \
        "$CLI_CMD project update '$PROJ_STATUS' --status '$TEST_STATUS_NAME'"
fi

if [ -n "$TEST_STATUS_ALIAS" ]; then
    run_test \
        "Single Field: Status via alias" \
        "$CLI_CMD project update '$PROJ_STATUS' --status '$TEST_STATUS_ALIAS'"
fi

run_test \
    "Single Field: Name only" \
    "$CLI_CMD project update '$PROJ_NAME' --name '${TEST_PREFIX}_UpdateName_RENAMED'"

run_test \
    "Single Field: Description only" \
    "$CLI_CMD project update '$PROJ_DESC' --description 'This description has been updated via CLI'"

run_test \
    "Single Field: Priority only (level 2)" \
    "$CLI_CMD project update '$PROJ_PRIORITY' --priority 2"

run_test \
    "Single Field: Start date only" \
    "$CLI_CMD project update '$PROJ_DATES' --start-date 2025-02-01"

run_test \
    "Single Field: Target date only" \
    "$CLI_CMD project update '$PROJ_DATES' --target-date 2025-06-30"

# ============================================================
# SUCCESS TESTS - CONTENT UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Content Updates"
echo "=========================================="
echo ""

run_test \
    "Content: Inline markdown update" \
    "$CLI_CMD project update '$PROJ_CONTENT_INLINE' --content '# Updated Content\\nThis is **updated** inline content with [links](https://example.com)'"

run_test \
    "Content: Update from file" \
    "$CLI_CMD project update '$PROJ_CONTENT_FILE' --content-file $TEST_CONTENT_FILE"

run_test \
    "Content: Clear content (empty string)" \
    "$CLI_CMD project update '$PROJ_CONTENT_FILE' --content ''"

# ============================================================
# SUCCESS TESTS - MULTI-FIELD UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Multi-field Updates"
echo "=========================================="
echo ""

if [ -n "$TEST_STATUS_ALIAS" ]; then
    run_test \
        "Multi-field: Status + Priority" \
        "$CLI_CMD project update '$PROJ_MULTI1' --status '$TEST_STATUS_ALIAS' --priority 1"
fi

run_test \
    "Multi-field: Name + Description" \
    "$CLI_CMD project update '$PROJ_MULTI2' --name '${TEST_PREFIX}_Multi2_RENAMED' --description 'Updated name and description together'"

run_test \
    "Multi-field: All date fields" \
    "$CLI_CMD project update '$PROJ_MULTI3' --start-date 2025-01-15 --target-date 2025-12-15"

if [ -n "$TEST_STATUS_ALIAS" ]; then
    run_test \
        "Multi-field: Status + Dates + Priority" \
        "$CLI_CMD project update '$PROJ_MULTI4' --status '$TEST_STATUS_ALIAS' --start-date 2025-03-01 --target-date 2025-09-01 --priority 2"
fi

run_test \
    "Multi-field: Content + Description" \
    "$CLI_CMD project update '$PROJ_MULTI1' --description 'Combined description' --content '# Combined\\nContent and description updated'"

if [ -n "$TEST_STATUS_ALIAS" ]; then
    run_test \
        "Multi-field: Name + Content + Status" \
        "$CLI_CMD project update '$PROJ_MULTI2' --name '${TEST_PREFIX}_Multi2_FINAL' --content '# Final Update' --status '$TEST_STATUS_ALIAS'"
fi

# Kitchen sink - all possible update fields
KITCHEN_CMD="$CLI_CMD project update '$PROJ_KITCHEN' --name '${TEST_PREFIX}_KitchenSink_UPDATED' --description 'All fields updated' --content '# Complete Update' --priority 1 --start-date 2025-01-01 --target-date 2025-12-31"

if [ -n "$TEST_STATUS_ALIAS" ]; then
    KITCHEN_CMD="$KITCHEN_CMD --status '$TEST_STATUS_ALIAS'"
fi

run_test \
    "Multi-field: Kitchen Sink (all update fields)" \
    "$KITCHEN_CMD"

# ============================================================
# SUCCESS TESTS - ALIAS COMBINATIONS
# ============================================================

echo "=========================================="
echo "CATEGORY: Alias Combinations"
echo "=========================================="
echo ""

if [ -n "$TEST_STATUS_ALIAS" ]; then
    run_test \
        "Alias Combo: Project via alias + Status via alias" \
        "$CLI_CMD project update 'test-update-proj' --status '$TEST_STATUS_ALIAS' --priority 3"

    run_test \
        "Alias Combo: Project via alias + Status via name" \
        "$CLI_CMD project update 'test-update-proj' --status '$TEST_STATUS_NAME' --description 'Updated via mixed resolution'"

    run_test \
        "Alias Combo: Project via ID + Status via alias" \
        "$CLI_CMD project update '$PROJ_BY_ID' --status '$TEST_STATUS_ALIAS' --priority 2"
fi

# ============================================================
# ERROR TESTS - VALIDATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Error Tests - Validation"
echo "=========================================="
echo ""

run_test \
    "Error: Project not found" \
    "$CLI_CMD project update 'NonExistentProject123456' --description 'Should fail'" \
    "true"

run_test \
    "Error: Status not found" \
    "$CLI_CMD project update '$PROJ_STATUS' --status 'NonExistentStatus123'" \
    "true"

run_test \
    "Error: Invalid priority value (too high)" \
    "$CLI_CMD project update '$PROJ_PRIORITY' --priority 5" \
    "true"

run_test \
    "Error: Invalid priority value (negative)" \
    "$CLI_CMD project update '$PROJ_PRIORITY' --priority -1" \
    "true"

run_test \
    "Error: Both --content and --content-file (mutual exclusion)" \
    "$CLI_CMD project update '$PROJ_CONTENT_INLINE' --content 'Test' --content-file $TEST_CONTENT_FILE" \
    "true"

run_test \
    "Error: No update fields provided" \
    "$CLI_CMD project update '$PROJ_BY_NAME'" \
    "true"

run_test \
    "Error: Invalid date format" \
    "$CLI_CMD project update '$PROJ_DATES' --start-date '2025/01/15'" \
    "true"

run_test \
    "Error: Non-existent content file" \
    "$CLI_CMD project update '$PROJ_CONTENT_FILE' --content-file /nonexistent/update-file.md" \
    "true"

# ============================================================
# CLEANUP
# ============================================================

cleanup_test_aliases

# Clean up test content file
rm -f "$TEST_CONTENT_FILE"

# ============================================================
# FINAL SUMMARY
# ============================================================

echo "=========================================="
echo "  TEST SUITE COMPLETE"
echo "=========================================="
if [ "$START_TEST" -ne 1 ] || [ "$END_TEST" -ne 999999 ]; then
    echo -e "${BLUE}Test Range:${NC}    #$START_TEST to #$END_TEST"
fi
echo -e "${BLUE}Total Tests:${NC}   $TEST_COUNT"
echo -e "${GREEN}Passed:${NC}        $PASSED"
echo -e "${RED}Failed:${NC}        $FAILED"
if [ $SKIPPED -gt 0 ]; then
    echo -e "${YELLOW}Skipped:${NC}       $SKIPPED"
fi
echo ""
echo -e "${YELLOW}Projects Created:${NC} ${#PROJECTS_CREATED[@]}"
echo ""
echo "Cleanup script generated: cleanup-update-projects.sh"
echo "Run ./cleanup-update-projects.sh to remove test projects"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠️  Some tests failed. Review output above.${NC}"
    exit 1
else
    if [ $SKIPPED -gt 0 ]; then
        echo -e "${GREEN}✅ All selected tests passed!${NC}"
    else
        echo -e "${GREEN}✅ All tests passed!${NC}"
    fi
    exit 0
fi
