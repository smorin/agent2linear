#!/bin/bash
#
# Comprehensive Test Suite for: agent2linear issue create (M15.3)
#
# This script tests all permutations and combinations of the issue create command
# including aliases, multi-value fields, auto-assignment, validation, and error cases.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - agent2linear must be built (npm run build)
#   - You should have at least one team in your Linear workspace
#
# Usage:
#   ./test-issue-create.sh [OPTIONS]
#
# Options:
#   --test N        Run only test #N
#   --start N       Run tests starting from #N
#   --end N         Run tests up to #N
#   --range N-M     Run tests from #N to #M
#   --help, -h      Show help message
#
# Examples:
#   ./test-issue-create.sh              # Run all tests
#   ./test-issue-create.sh --test 5     # Run only test #5
#   ./test-issue-create.sh --start 20   # Run tests 20 and above
#   ./test-issue-create.sh --range 10-20 # Run tests 10-20
#
# Output:
#   - Creates test issues in Linear (prefixed with TEST_ISSUE_)
#   - Generates cleanup-issue-create.sh for cleanup
#   - Prints summary of passed/failed/skipped tests
#

set -e  # Exit on first error
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script identification
SCRIPT_NAME=$(basename "$0")
TIMESTAMP=$(date +%s)

# Print runtime header
echo ""
echo -e "${YELLOW}==========================================${NC}"
echo -e "${YELLOW}TEST SUITE: ${BOLD}${SCRIPT_NAME}${NC}"
echo -e "${YELLOW}Description: Issue Create Tests${NC}"
echo -e "${YELLOW}Timestamp: ${TIMESTAMP}${NC}"
echo -e "${YELLOW}==========================================${NC}"
echo ""

# Configuration
TEST_PREFIX="TEST_ISSUE_$(date +%Y%m%d_%H%M%S)"
ISSUES_CREATED=()
ISSUE_IDENTIFIERS=()
ISSUE_NAMES=()
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
            echo "  $0 --start 20         # Run tests 20 and above"
            echo "  $0 --range 10-20      # Run tests 10 through 20"
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
echo "  ISSUE CREATE - COMPREHENSIVE TEST SUITE (M15.3)"
echo "=================================================="
echo "Test prefix: $TEST_PREFIX"
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

# Get test data (team, workflow states, labels, members, etc.)
echo "Fetching test data from Linear..."
TEAMS_JSON=$($CLI_CMD teams list --format json)
TEST_TEAM_ID=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.id || '')")
TEST_TEAM_KEY=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.key || '')")

if [ -z "$TEST_TEAM_ID" ]; then
    echo -e "${RED}ERROR: No teams found in workspace${NC}"
    exit 1
fi

echo "Using test team: $TEST_TEAM_ID (key: $TEST_TEAM_KEY)"

# Get workflow states for the team (filtered by team to avoid team mismatch)
STATES_JSON=$($CLI_CMD workflow-states list --team "$TEST_TEAM_ID" --format json 2>/dev/null || echo "[]")
TEST_STATE_ID=$(echo "$STATES_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const states=JSON.parse(data); console.log(states[0]?.id || '')")

if [ -n "$TEST_STATE_ID" ]; then
    echo "Using test state: $TEST_STATE_ID"
fi

# Get issue labels (filtered by team to avoid team mismatch)
LABELS_JSON=$($CLI_CMD issue-labels list --team "$TEST_TEAM_ID" --json 2>/dev/null || echo "[]")
TEST_LABEL_ID=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[0]?.id || '')")
TEST_LABEL2_ID=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[1]?.id || '')")

if [ -n "$TEST_LABEL_ID" ]; then
    echo "Using test label: $TEST_LABEL_ID"
fi

# Get members
MEMBERS_JSON=$($CLI_CMD members list --org-wide --format json 2>/dev/null || echo "[]")
TEST_MEMBER_ID=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.id || '')")
TEST_MEMBER_EMAIL=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.email || '')")

if [ -n "$TEST_MEMBER_ID" ]; then
    echo "Using test member: $TEST_MEMBER_ID ($TEST_MEMBER_EMAIL)"
fi

# Try to get a project (optional)
PROJECTS_JSON=$($CLI_CMD project list --format json 2>/dev/null || echo "[]")
TEST_PROJECT_ID=$(echo "$PROJECTS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const projects=JSON.parse(data); console.log(projects[0]?.id || '')")

if [ -n "$TEST_PROJECT_ID" ]; then
    echo "Using test project: $TEST_PROJECT_ID"
else
    echo "No projects found (will skip project tests)"
fi

echo ""

# Create test file for description-file tests
TEST_DESC_FILE="/tmp/test-issue-desc-$$.md"
cat > "$TEST_DESC_FILE" <<'EOF'
# Test Description

This is a test description read from a file.

## Features
- Feature 1
- Feature 2

**Bold text** and *italic text*.
EOF

echo "Created test description file: $TEST_DESC_FILE"
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

            # Try to extract issue identifier and ID from output
            local issue_id=$(echo "$output" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
            local issue_identifier=$(echo "$output" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

            if [ -n "$issue_id" ]; then
                ISSUES_CREATED+=("$issue_id")
                ISSUE_IDENTIFIERS+=("${issue_identifier:-unknown}")
                ISSUE_NAMES+=("$description")
                echo "Issue: $issue_identifier (ID: $issue_id)"
            fi

            # Show abbreviated output
            echo "$output" | grep -E '(✅|Identifier:|ID:|URL:|assigned)' || true
        else
            echo -e "${RED}❌ FAILED${NC}"
            echo "Error output:"
            echo "$output"
            ((FAILED++))
        fi
    fi

    echo ""
}

setup_test_aliases() {
    echo "=================================================="
    echo "SETUP: Creating test aliases"
    echo "=================================================="

    # Create test aliases for team
    $CLI_CMD alias add team test-team "$TEST_TEAM_ID" --skip-validation 2>/dev/null || true

    # Create test alias for workflow state
    if [ -n "$TEST_STATE_ID" ]; then
        $CLI_CMD alias add workflow-state test-state "$TEST_STATE_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test alias for label
    if [ -n "$TEST_LABEL_ID" ]; then
        $CLI_CMD alias add issue-label test-label "$TEST_LABEL_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test alias for member
    if [ -n "$TEST_MEMBER_ID" ]; then
        $CLI_CMD alias add member test-member "$TEST_MEMBER_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test alias for project
    if [ -n "$TEST_PROJECT_ID" ]; then
        $CLI_CMD alias add project test-project "$TEST_PROJECT_ID" --skip-validation 2>/dev/null || true
    fi

    echo "Test aliases created"
    echo ""
}

cleanup_test_aliases() {
    echo "=================================================="
    echo "CLEANUP: Removing test aliases"
    echo "=================================================="

    $CLI_CMD alias remove team test-team 2>/dev/null || true
    $CLI_CMD alias remove workflow-state test-state 2>/dev/null || true
    $CLI_CMD alias remove issue-label test-label 2>/dev/null || true
    $CLI_CMD alias remove member test-member 2>/dev/null || true
    $CLI_CMD alias remove project test-project 2>/dev/null || true

    echo "Test aliases removed"
    echo ""
}

generate_cleanup_script() {
    local script_name="cleanup-issue-create.sh"
    echo "=================================================="
    echo "Generating cleanup script: $script_name"
    echo "=================================================="

    cat > "$script_name" <<'EOF_OUTER'
#!/bin/bash
#
# Auto-generated cleanup script for test issues
# Generated: $(date)
#
# This script lists test issues created during testing.
# To delete them, use the Linear web interface or implement issue delete command.
#
set -e

EOF_OUTER

    echo "# Issues created: ${#ISSUES_CREATED[@]}" >> "$script_name"
    echo "" >> "$script_name"
    echo "echo \"Test issues created during M15.3 testing:\"" >> "$script_name"
    echo "echo \"\"" >> "$script_name"

    for i in "${!ISSUES_CREATED[@]}"; do
        echo "echo \"$((i+1)). ${ISSUE_IDENTIFIERS[$i]} - ${ISSUE_NAMES[$i]}\"" >> "$script_name"
        echo "echo \"   ID: ${ISSUES_CREATED[$i]}\"" >> "$script_name"
    done

    echo "echo \"\"" >> "$script_name"
    echo "echo \"To delete these issues, use the Linear web interface.\"" >> "$script_name"
    echo "echo \"Issue delete command will be implemented in a future milestone.\"" >> "$script_name"

    chmod +x "$script_name"

    echo "Cleanup script generated: $script_name"
    echo "Total issues created: ${#ISSUES_CREATED[@]}"

    # Clean up test file
    rm -f "$TEST_DESC_FILE" 2>/dev/null || true
}

# ============================================================
# SETUP
# ============================================================

setup_test_aliases

# ============================================================
# SUCCESS TESTS - GROUP 1: REQUIRED / CORE
# ============================================================

echo "=========================================="
echo "CATEGORY: Required / Core"
echo "=========================================="
echo ""

run_test \
    "Core: Minimal (title + team)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_01_Minimal' --team $TEST_TEAM_ID"

run_test \
    "Core: With description (inline)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_02_WithDesc' --team $TEST_TEAM_ID --description 'Test issue description'"

run_test \
    "Core: Team via alias" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_03_TeamAlias' --team test-team"

run_test \
    "Core: Auto-assignment (default behavior)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_04_AutoAssign' --team $TEST_TEAM_ID"

# ============================================================
# SUCCESS TESTS - GROUP 2: CONTENT HANDLING
# ============================================================

echo "=========================================="
echo "CATEGORY: Content Handling"
echo "=========================================="
echo ""

run_test \
    "Content: Description from file" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_05_DescFile' --team $TEST_TEAM_ID --description-file $TEST_DESC_FILE"

run_test \
    "Content: Description with markdown" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_06_Markdown' --team $TEST_TEAM_ID --description '# Heading\n\n**Bold** and *italic*'"

run_test \
    "Content: Description with special chars" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_07_Special' --team $TEST_TEAM_ID --description 'Test with @mention and \`code\`'"

# ============================================================
# SUCCESS TESTS - GROUP 3: PRIORITY & ESTIMATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Priority & Estimation"
echo "=========================================="
echo ""

run_test \
    "Priority: None (0)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_08_Pri0' --team $TEST_TEAM_ID --priority 0"

run_test \
    "Priority: Urgent (1)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_09_Pri1' --team $TEST_TEAM_ID --priority 1"

run_test \
    "Priority: High (2)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_10_Pri2' --team $TEST_TEAM_ID --priority 2"

run_test \
    "Priority: Normal (3)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_11_Pri3' --team $TEST_TEAM_ID --priority 3"

run_test \
    "Priority: Low (4)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_12_Pri4' --team $TEST_TEAM_ID --priority 4"

run_test \
    "Estimate: Story points" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_13_Estimate' --team $TEST_TEAM_ID --estimate 8"

run_test \
    "Priority + Estimate combined" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_14_PriEst' --team $TEST_TEAM_ID --priority 2 --estimate 5"

# ============================================================
# SUCCESS TESTS - GROUP 4: WORKFLOW STATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Workflow States"
echo "=========================================="
echo ""

if [ -n "$TEST_STATE_ID" ]; then
    run_test \
        "State: By ID" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_15_StateID' --team $TEST_TEAM_ID --state $TEST_STATE_ID"

    run_test \
        "State: By alias" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_16_StateAlias' --team $TEST_TEAM_ID --state test-state"
else
    echo "Skipping state tests (no states available)"
    ((SKIPPED+=2))
fi

# ============================================================
# SUCCESS TESTS - GROUP 5: DATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Dates"
echo "=========================================="
echo ""

run_test \
    "Date: Valid ISO date" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_17_Date' --team $TEST_TEAM_ID --due-date 2025-12-31"

run_test \
    "Date: Near future" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_18_DateFuture' --team $TEST_TEAM_ID --due-date 2025-11-15"

# ============================================================
# SUCCESS TESTS - GROUP 6: ASSIGNMENT
# ============================================================

echo "=========================================="
echo "CATEGORY: Assignment"
echo "=========================================="
echo ""

run_test \
    "Assignment: No assignee flag" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_19_NoAssignee' --team $TEST_TEAM_ID --no-assignee"

if [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Assignment: Assignee by ID" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_20_AssignID' --team $TEST_TEAM_ID --assignee $TEST_MEMBER_ID"

    run_test \
        "Assignment: Assignee by alias" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_21_AssignAlias' --team $TEST_TEAM_ID --assignee test-member"

    if [ -n "$TEST_MEMBER_EMAIL" ]; then
        run_test \
            "Assignment: Assignee by email" \
            "$CLI_CMD issue create --title '${TEST_PREFIX}_22_AssignEmail' --team $TEST_TEAM_ID --assignee $TEST_MEMBER_EMAIL"
    fi

    run_test \
        "Assignment: Single subscriber" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_23_Sub1' --team $TEST_TEAM_ID --subscribers $TEST_MEMBER_ID"

    run_test \
        "Assignment: Assignee + subscriber" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_24_AssignSub' --team $TEST_TEAM_ID --assignee $TEST_MEMBER_ID --subscribers $TEST_MEMBER_ID"
else
    echo "Skipping assignment tests (no members available)"
    ((SKIPPED+=6))
fi

# ============================================================
# SUCCESS TESTS - GROUP 7: ORGANIZATION (PROJECT/LABELS)
# ============================================================

echo "=========================================="
echo "CATEGORY: Organization"
echo "=========================================="
echo ""

if [ -n "$TEST_PROJECT_ID" ]; then
    run_test \
        "Organization: Project by ID" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_25_Project' --team $TEST_TEAM_ID --project $TEST_PROJECT_ID"

    run_test \
        "Organization: Project by alias" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_26_ProjectAlias' --team $TEST_TEAM_ID --project test-project"
else
    echo "Skipping project tests (no projects available)"
    ((SKIPPED+=2))
fi

if [ -n "$TEST_LABEL_ID" ]; then
    run_test \
        "Organization: Single label by ID" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_27_Label' --team $TEST_TEAM_ID --labels $TEST_LABEL_ID"

    run_test \
        "Organization: Label by alias" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_28_LabelAlias' --team $TEST_TEAM_ID --labels test-label"

    if [ -n "$TEST_LABEL2_ID" ]; then
        run_test \
            "Organization: Multiple labels" \
            "$CLI_CMD issue create --title '${TEST_PREFIX}_29_MultiLabel' --team $TEST_TEAM_ID --labels $TEST_LABEL_ID,$TEST_LABEL2_ID"
    fi
else
    echo "Skipping label tests (no labels available)"
    ((SKIPPED+=3))
fi

# ============================================================
# SUCCESS TESTS - GROUP 8: TEMPLATE OPTIONS
# ============================================================

echo "=========================================="
echo "CATEGORY: Template Options"
echo "=========================================="
echo ""

# Note: Template tests require templates to exist in workspace
# These will be skipped if no templates are available
TEMPLATE_LIST=$($CLI_CMD templates list --json 2>/dev/null || echo "[]")
TEST_TEMPLATE_ID=$(echo "$TEMPLATE_LIST" | grep -oE '"id":"[^"]+' | head -1 | cut -d'"' -f4)

if [ -n "$TEST_TEMPLATE_ID" ]; then
    run_test \
        "Template: Apply template by ID" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_Template_ID' --team $TEST_TEAM_ID --template $TEST_TEMPLATE_ID"

    # Try to get template name for alias test
    TEST_TEMPLATE_NAME=$(echo "$TEMPLATE_LIST" | grep -oE '"name":"[^"]+' | head -1 | cut -d'"' -f4)

    if [ -n "$TEST_TEMPLATE_NAME" ]; then
        # Create temporary alias for template
        $CLI_CMD alias add template test-template "$TEST_TEMPLATE_ID" --skip-validation 2>/dev/null || true

        run_test \
            "Template: Apply template by alias" \
            "$CLI_CMD issue create --title '${TEST_PREFIX}_Template_Alias' --team $TEST_TEAM_ID --template test-template"

        # Cleanup template alias
        $CLI_CMD alias remove template test-template 2>/dev/null || true
    else
        echo "Skipping template alias test (no template name available)"
        ((SKIPPED++))
    fi
else
    echo "Skipping template tests (no templates available in workspace)"
    ((SKIPPED+=2))
fi

echo ""

# ============================================================
# SUCCESS TESTS - GROUP 9: COMPLEX COMBINATIONS
# ============================================================

echo "=========================================="
echo "CATEGORY: Complex Combinations"
echo "=========================================="
echo ""

run_test \
    "Complex: Title + description + priority + estimate" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_30_Complex1' --team $TEST_TEAM_ID --description 'Complex test' --priority 2 --estimate 8"

if [ -n "$TEST_STATE_ID" ] && [ -n "$TEST_LABEL_ID" ]; then
    run_test \
        "Complex: State + priority + labels" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_31_Complex2' --team $TEST_TEAM_ID --state $TEST_STATE_ID --priority 1 --labels $TEST_LABEL_ID"
fi

if [ -n "$TEST_PROJECT_ID" ] && [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Complex: Project + assignee + priority + estimate" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_32_Complex3' --team $TEST_TEAM_ID --project $TEST_PROJECT_ID --assignee $TEST_MEMBER_ID --priority 2 --estimate 5"
fi

run_test \
    "Complex: Kitchen sink (all available options)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_33_KitchenSink' --team $TEST_TEAM_ID --description 'Full test' --priority 1 --estimate 13 --due-date 2025-12-01"

# ============================================================
# ERROR TESTS - GROUP 10: VALIDATION ERRORS
# ============================================================

echo "=========================================="
echo "CATEGORY: Error Cases (should fail)"
echo "=========================================="
echo ""

run_test \
    "Error: Missing title" \
    "$CLI_CMD issue create --team $TEST_TEAM_ID" \
    "true"

# Check if defaultTeam is configured in config
if grep -q '"defaultTeam"' ~/.config/agent2linear/config.json 2>/dev/null; then
    echo ""
    echo "=================================================="
    echo -e "${BLUE}TEST #35: Error: Missing team (no default configured)${NC}"
    echo "COMMAND: (skipped - defaultTeam is configured)"
    echo "--------------------------------------------------"
    echo -e "${YELLOW}⊘ SKIPPED (defaultTeam is configured in ~/.config/agent2linear/config.json)${NC}"
    ((SKIPPED++))
else
    run_test \
        "Error: Missing team (no default configured)" \
        "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_NoTeam'" \
        "true"
fi

run_test \
    "Error: Invalid priority (out of range)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_Priority' --team $TEST_TEAM_ID --priority 5" \
    "true"

run_test \
    "Error: Invalid date format" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_Date' --team $TEST_TEAM_ID --due-date '2025-13-01'" \
    "true"

run_test \
    "Error: Invalid calendar date (Feb 30)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_CalDate' --team $TEST_TEAM_ID --due-date '2025-02-30'" \
    "true"

run_test \
    "Error: Description and description-file (mutual exclusivity)" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_Mutex' --team $TEST_TEAM_ID --description 'test' --description-file $TEST_DESC_FILE" \
    "true"

run_test \
    "Error: Description-file doesn't exist" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_NoFile' --team $TEST_TEAM_ID --description-file /nonexistent/file.md" \
    "true"

run_test \
    "Error: Invalid team ID" \
    "$CLI_CMD issue create --title '${TEST_PREFIX}_Error_Team' --team invalid_team_id" \
    "true"

# ============================================================
# CLEANUP & SUMMARY
# ============================================================

cleanup_test_aliases

echo "=================================================="
echo "  TEST SUMMARY"
echo "=================================================="
echo -e "${GREEN}✅ PASSED: $PASSED${NC}"
echo -e "${RED}❌ FAILED: $FAILED${NC}"
echo -e "${YELLOW}⊘ SKIPPED: $SKIPPED${NC}"
echo "TOTAL TESTS: $TEST_COUNT"
echo "=================================================="
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
