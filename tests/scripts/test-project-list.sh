#!/bin/bash
#
# Test Suite for: linear-create project list
#
# This script tests the project list command with various filter combinations,
# smart defaults, override flags, and output formats.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - linear-create must be built (npm run build)
#   - You should have at least one team in your Linear workspace
#   - Existing projects in Linear workspace (uses real data, no test project creation)
#
# Usage:
#   ./test-project-list.sh [OPTIONS]
#
# Options:
#   --test N        Run only test #N
#   --start N       Run tests starting from #N
#   --end N         Run tests up to #N
#   --range N-M     Run tests from #N to #M
#   --help, -h      Show help message
#
# Examples:
#   ./test-project-list.sh                # Run all tests
#   ./test-project-list.sh --test 5       # Run only test #5
#   ./test-project-list.sh --range 1-5    # Run tests 1-5
#
# Output:
#   - Tests against existing Linear projects
#   - No cleanup needed (read-only operations)
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
PASSED=0
FAILED=0
SKIPPED=0
TEST_COUNT=0
CLI_CMD="node dist/index.js"

# Test range configuration (can be overridden by command-line args)
START_TEST=1
END_TEST=999999

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
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --test N        Run only test #N"
            echo "  --start N       Run tests starting from #N"
            echo "  --end N         Run tests up to #N"
            echo "  --range N-M     Run tests from #N to #M"
            echo "  --help, -h      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all tests"
            echo "  $0 --test 5           # Run only test #5"
            echo "  $0 --start 5          # Run tests 5 and above"
            echo "  $0 --range 1-5        # Run tests 1 through 5"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "=================================================="
echo "  PROJECT LIST - TEST SUITE"
echo "=================================================="
echo "CLI command: $CLI_CMD"
if [ "$START_TEST" -ne 1 ] || [ "$END_TEST" -ne 999999 ]; then
    echo "Test range: #$START_TEST to #$END_TEST"
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
TEAMS_JSON=$($CLI_CMD teams list --format json 2>/dev/null || echo "[]")
TEST_TEAM_ID=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.id || '')")

if [ -z "$TEST_TEAM_ID" ]; then
    echo -e "${RED}ERROR: No teams found in workspace${NC}"
    exit 1
fi

TEST_TEAM_NAME=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.name || '')")

echo "Using test team: $TEST_TEAM_NAME ($TEST_TEAM_ID)"
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
        if eval "$command" 2>&1 > /dev/null; then
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
            # Show first few lines of output for verification
            echo "$output" | head -5
        else
            echo -e "${RED}❌ FAILED${NC}"
            echo "Error output:"
            echo "$output"
            ((FAILED++))
        fi
    fi

    echo ""
}

# ============================================================
# TEST SUITE
# ============================================================

echo "Starting tests..."
echo ""

# ============================================================
# Test 1: Default behavior (smart defaults)
# ============================================================
run_test \
    "Default list (smart defaults: lead=me + config team/initiative)" \
    "$CLI_CMD project list"

# ============================================================
# Test 2: Override all defaults
# ============================================================
run_test \
    "List all projects (override all defaults)" \
    "$CLI_CMD project list --all-leads --all-teams --all-initiatives"

# ============================================================
# Test 3: Filter by team
# ============================================================
run_test \
    "Filter by specific team" \
    "$CLI_CMD project list --team $TEST_TEAM_ID --all-leads"

# ============================================================
# Test 4: Override only leads (show all leads)
# ============================================================
run_test \
    "Override leads only (keep default team/initiative)" \
    "$CLI_CMD project list --all-leads"

# ============================================================
# Test 5: Search functionality
# ============================================================
run_test \
    "Search for 'test' in project name/description/content" \
    "$CLI_CMD project list --search test --all-teams --all-leads --all-initiatives"

# ============================================================
# Test 6: JSON output format
# ============================================================
run_test \
    "JSON output format with all projects" \
    "$CLI_CMD project list --format json --all-teams --all-leads --all-initiatives | head -20"

# ============================================================
# Test 7: TSV output format
# ============================================================
run_test \
    "TSV output format with all projects" \
    "$CLI_CMD project list --format tsv --all-teams --all-leads --all-initiatives | head -5"

# ============================================================
# Test 8: Filter by status
# ============================================================
run_test \
    "Filter by status (backlog) in specific team" \
    "$CLI_CMD project list --team $TEST_TEAM_ID --status backlog --all-leads"

# ============================================================
# Test 9: Filter by priority
# ============================================================
run_test \
    "Filter by priority (0=none) with all teams" \
    "$CLI_CMD project list --priority 0 --all-teams --all-leads --all-initiatives"

# ============================================================
# Test 10: Complex filter combination
# ============================================================
run_test \
    "Complex filter: team + search + all-leads" \
    "$CLI_CMD project list --team $TEST_TEAM_ID --search project --all-leads"

# ============================================================
# SUMMARY
# ============================================================

echo "=================================================="
echo "  TEST SUMMARY"
echo "=================================================="
echo -e "Total tests: $TEST_COUNT"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
