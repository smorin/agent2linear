#!/bin/bash
#
# Comprehensive Test Suite for: linear-create issue update (M15.4)
#
# This script tests all permutations and combinations of the issue update command
# including basic fields, priority, workflow, dates, assignments, labels/subscribers
# (with add/remove patterns), parent relationships, lifecycle operations, and error cases.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - linear-create must be built (npm run build)
#   - You should have at least one team in your Linear workspace
#
# Usage:
#   ./test-issue-update.sh [OPTIONS]
#
# Options:
#   --test N        Run only test #N
#   --start N       Run tests starting from #N
#   --end N         Run tests up to #N
#   --range N-M     Run tests from #N to #M
#   --help, -h      Show help message
#
# Examples:
#   ./test-issue-update.sh              # Run all tests
#   ./test-issue-update.sh --test 5     # Run only test #5
#   ./test-issue-update.sh --start 20   # Run tests 20 and above
#   ./test-issue-update.sh --range 10-20 # Run tests 10-20
#
# Output:
#   - Updates test issues in Linear
#   - Generates cleanup-issue-update.sh for tracking
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
BASE_ISSUES=()           # IDs of base issues we'll update
BASE_IDENTIFIERS=()      # Identifiers (ENG-123 format)
ISSUES_UPDATED=()        # Track which issues we updated
UPDATE_DESCRIPTIONS=()   # Track what was updated
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
echo "  ISSUE UPDATE - COMPREHENSIVE TEST SUITE (M15.4)"
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
TEST_TEAM2_ID=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[1]?.id || '')")

if [ -z "$TEST_TEAM_ID" ]; then
    echo -e "${RED}ERROR: No teams found in workspace${NC}"
    exit 1
fi

echo "Using test team: $TEST_TEAM_ID (key: $TEST_TEAM_KEY)"
if [ -n "$TEST_TEAM2_ID" ]; then
    echo "Using second team: $TEST_TEAM2_ID"
fi

# Get workflow states for the team
STATES_JSON=$($CLI_CMD workflow-states list --format json 2>/dev/null || echo "[]")
TEST_STATE_ID=$(echo "$STATES_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const states=JSON.parse(data); const s = states.find(st => st.teamId === '$TEST_TEAM_ID'); console.log(s?.id || states[0]?.id || '')")
TEST_STATE2_ID=$(echo "$STATES_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const states=JSON.parse(data); const filtered = states.filter(st => st.teamId === '$TEST_TEAM_ID'); console.log(filtered[1]?.id || states[1]?.id || '')")

if [ -n "$TEST_STATE_ID" ]; then
    echo "Using test state: $TEST_STATE_ID"
fi
if [ -n "$TEST_STATE2_ID" ]; then
    echo "Using second test state: $TEST_STATE2_ID"
fi

# Get issue labels
LABELS_JSON=$($CLI_CMD issue-labels list --format json 2>/dev/null || echo "[]")
TEST_LABEL_ID=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[0]?.id || '')")
TEST_LABEL2_ID=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[1]?.id || '')")
TEST_LABEL3_ID=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[2]?.id || '')")

if [ -n "$TEST_LABEL_ID" ]; then
    echo "Using test labels: $TEST_LABEL_ID, $TEST_LABEL2_ID, $TEST_LABEL3_ID"
fi

# Get members
MEMBERS_JSON=$($CLI_CMD members list --org-wide --format json 2>/dev/null || echo "[]")
TEST_MEMBER_ID=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.id || '')")
TEST_MEMBER_EMAIL=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.email || '')")
TEST_MEMBER2_ID=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[1]?.id || '')")
TEST_MEMBER2_EMAIL=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[1]?.email || '')")

if [ -n "$TEST_MEMBER_ID" ]; then
    echo "Using test members: $TEST_MEMBER_ID ($TEST_MEMBER_EMAIL), $TEST_MEMBER2_ID"
fi

# Try to get a project (optional)
PROJECTS_JSON=$($CLI_CMD project list --format json 2>/dev/null || echo "[]")
TEST_PROJECT_ID=$(echo "$PROJECTS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const projects=JSON.parse(data); console.log(projects[0]?.id || '')")
TEST_PROJECT2_ID=$(echo "$PROJECTS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const projects=JSON.parse(data); console.log(projects[1]?.id || '')")

if [ -n "$TEST_PROJECT_ID" ]; then
    echo "Using test projects: $TEST_PROJECT_ID, $TEST_PROJECT2_ID"
else
    echo "No projects found (will skip project tests)"
fi

echo ""

# Create test file for description-file tests
TEST_DESC_FILE="/tmp/test-issue-update-desc-$$.md"
cat > "$TEST_DESC_FILE" <<'EOF'
# Updated Description

This is an UPDATED description read from a file.

## Updated Features
- Updated Feature 1
- Updated Feature 2

**Updated content** for testing.
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

            # Try to extract issue identifier from output
            local issue_identifier=$(echo "$output" | grep -oE '[A-Z]+-[0-9]+' | head -1)

            if [ -n "$issue_identifier" ]; then
                ISSUES_UPDATED+=("$issue_identifier")
                UPDATE_DESCRIPTIONS+=("$description")
                echo "Updated: $issue_identifier"
            fi

            # Show abbreviated output
            echo "$output" | grep -E '(✅|Updated|Identifier:|ID:|URL:)' || true
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
    if [ -n "$TEST_STATE2_ID" ]; then
        $CLI_CMD alias add workflow-state test-state-2 "$TEST_STATE2_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test aliases for labels
    if [ -n "$TEST_LABEL_ID" ]; then
        $CLI_CMD alias add issue-label test-label "$TEST_LABEL_ID" --skip-validation 2>/dev/null || true
    fi
    if [ -n "$TEST_LABEL2_ID" ]; then
        $CLI_CMD alias add issue-label test-label-2 "$TEST_LABEL2_ID" --skip-validation 2>/dev/null || true
    fi
    if [ -n "$TEST_LABEL3_ID" ]; then
        $CLI_CMD alias add issue-label test-label-3 "$TEST_LABEL3_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test alias for member
    if [ -n "$TEST_MEMBER_ID" ]; then
        $CLI_CMD alias add member test-member "$TEST_MEMBER_ID" --skip-validation 2>/dev/null || true
    fi
    if [ -n "$TEST_MEMBER2_ID" ]; then
        $CLI_CMD alias add member test-member-2 "$TEST_MEMBER2_ID" --skip-validation 2>/dev/null || true
    fi

    # Create test alias for project
    if [ -n "$TEST_PROJECT_ID" ]; then
        $CLI_CMD alias add project test-project "$TEST_PROJECT_ID" --skip-validation 2>/dev/null || true
    fi
    if [ -n "$TEST_PROJECT2_ID" ]; then
        $CLI_CMD alias add project test-project-2 "$TEST_PROJECT2_ID" --skip-validation 2>/dev/null || true
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
    $CLI_CMD alias remove workflow-state test-state-2 2>/dev/null || true
    $CLI_CMD alias remove issue-label test-label 2>/dev/null || true
    $CLI_CMD alias remove issue-label test-label-2 2>/dev/null || true
    $CLI_CMD alias remove issue-label test-label-3 2>/dev/null || true
    $CLI_CMD alias remove member test-member 2>/dev/null || true
    $CLI_CMD alias remove member test-member-2 2>/dev/null || true
    $CLI_CMD alias remove project test-project 2>/dev/null || true
    $CLI_CMD alias remove project test-project-2 2>/dev/null || true

    echo "Test aliases removed"
    echo ""
}

create_base_issues() {
    echo "=================================================="
    echo "SETUP: Creating base test issues for updates"
    echo "=================================================="

    # Create base issue #1 - for basic field tests
    echo "Creating base issue #1..."
    local output1=$($CLI_CMD issue create --title "${TEST_PREFIX}_BASE_01" --team $TEST_TEAM_ID --description "Base issue for testing updates" 2>&1)
    local id1=$(echo "$output1" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
    local identifier1=$(echo "$output1" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

    if [ -n "$id1" ]; then
        BASE_ISSUES+=("$id1")
        BASE_IDENTIFIERS+=("$identifier1")
        echo "  Created: $identifier1 (ID: $id1)"
    else
        echo -e "${RED}  ERROR: Failed to create base issue #1${NC}"
        exit 1
    fi

    # Create base issue #2 - for label/subscriber tests
    echo "Creating base issue #2 (with labels)..."
    local labels_arg=""
    if [ -n "$TEST_LABEL_ID" ]; then
        labels_arg="--labels $TEST_LABEL_ID"
    fi

    local output2=$($CLI_CMD issue create --title "${TEST_PREFIX}_BASE_02_Labels" --team $TEST_TEAM_ID $labels_arg 2>&1)
    local id2=$(echo "$output2" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
    local identifier2=$(echo "$output2" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

    if [ -n "$id2" ]; then
        BASE_ISSUES+=("$id2")
        BASE_IDENTIFIERS+=("$identifier2")
        echo "  Created: $identifier2 (ID: $id2)"
    else
        echo -e "${RED}  ERROR: Failed to create base issue #2${NC}"
        exit 1
    fi

    # Create base issue #3 - for parent/child tests
    echo "Creating base issue #3 (parent)..."
    local output3=$($CLI_CMD issue create --title "${TEST_PREFIX}_BASE_03_Parent" --team $TEST_TEAM_ID 2>&1)
    local id3=$(echo "$output3" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
    local identifier3=$(echo "$output3" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

    if [ -n "$id3" ]; then
        BASE_ISSUES+=("$id3")
        BASE_IDENTIFIERS+=("$identifier3")
        echo "  Created: $identifier3 (ID: $id3)"
    else
        echo -e "${RED}  ERROR: Failed to create base issue #3${NC}"
        exit 1
    fi

    # Create base issue #4 - for subscriber tests
    echo "Creating base issue #4 (with subscribers)..."
    local subscribers_arg=""
    if [ -n "$TEST_MEMBER_ID" ]; then
        subscribers_arg="--subscribers $TEST_MEMBER_ID"
    fi

    local output4=$($CLI_CMD issue create --title "${TEST_PREFIX}_BASE_04_Subscribers" --team $TEST_TEAM_ID $subscribers_arg 2>&1)
    local id4=$(echo "$output4" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
    local identifier4=$(echo "$output4" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

    if [ -n "$id4" ]; then
        BASE_ISSUES+=("$id4")
        BASE_IDENTIFIERS+=("$identifier4")
        echo "  Created: $identifier4 (ID: $id4)"
    else
        echo -e "${RED}  ERROR: Failed to create base issue #4${NC}"
        exit 1
    fi

    # Create base issue #5 - for assignment/project/cycle tests
    echo "Creating base issue #5 (with assignment)..."
    local output5=$($CLI_CMD issue create --title "${TEST_PREFIX}_BASE_05_Assignment" --team $TEST_TEAM_ID --assignee $TEST_MEMBER_ID 2>&1)
    local id5=$(echo "$output5" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
    local identifier5=$(echo "$output5" | grep -oE 'Identifier: [A-Z]+-[0-9]+' | head -1 | cut -d' ' -f2)

    if [ -n "$id5" ]; then
        BASE_ISSUES+=("$id5")
        BASE_IDENTIFIERS+=("$identifier5")
        echo "  Created: $identifier5 (ID: $id5)"
    else
        echo -e "${RED}  ERROR: Failed to create base issue #5${NC}"
        exit 1
    fi

    echo ""
    echo "Base issues created: ${#BASE_ISSUES[@]}"
    for i in "${!BASE_ISSUES[@]}"; do
        echo "  $((i+1)). ${BASE_IDENTIFIERS[$i]} - ${BASE_ISSUES[$i]}"
    done
    echo ""
}

generate_cleanup_script() {
    local script_name="cleanup-issue-update.sh"
    echo "=================================================="
    echo "Generating cleanup script: $script_name"
    echo "=================================================="

    cat > "$script_name" <<'EOF_OUTER'
#!/bin/bash
#
# Auto-generated cleanup script for test issues (UPDATE tests)
# Generated: $(date)
#
# This script lists base test issues and updated issues from testing.
# To delete them, use the Linear web interface or implement issue delete command.
#
set -e

EOF_OUTER

    echo "# Base issues created: ${#BASE_ISSUES[@]}" >> "$script_name"
    echo "# Issues updated during tests: ${#ISSUES_UPDATED[@]}" >> "$script_name"
    echo "" >> "$script_name"
    echo "echo \"Base test issues created during M15.4 testing:\"" >> "$script_name"
    echo "echo \"\"" >> "$script_name"

    for i in "${!BASE_ISSUES[@]}"; do
        echo "echo \"$((i+1)). ${BASE_IDENTIFIERS[$i]} - ${TEST_PREFIX}_BASE_0$((i+1))\"" >> "$script_name"
        echo "echo \"   ID: ${BASE_ISSUES[$i]}\"" >> "$script_name"
    done

    echo "echo \"\"" >> "$script_name"
    echo "echo \"Total test updates performed: ${#ISSUES_UPDATED[@]}\"" >> "$script_name"
    echo "echo \"\"" >> "$script_name"
    echo "echo \"To delete these issues, use the Linear web interface.\"" >> "$script_name"
    echo "echo \"Issue delete command will be implemented in a future milestone.\"" >> "$script_name"

    chmod +x "$script_name"

    echo "Cleanup script generated: $script_name"
    echo "Total base issues created: ${#BASE_ISSUES[@]}"
    echo "Total updates performed: ${#ISSUES_UPDATED[@]}"

    # Clean up test file
    rm -f "$TEST_DESC_FILE" 2>/dev/null || true
}

# ============================================================
# SETUP
# ============================================================

setup_test_aliases
create_base_issues

# ============================================================
# SUCCESS TESTS - GROUP 1: BASIC FIELD UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Basic Field Updates"
echo "=========================================="
echo ""

run_test \
    "Basic: Update title only" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --title '${TEST_PREFIX}_01_Updated_Title'"

run_test \
    "Basic: Update description (inline)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --description 'Updated description text'"

run_test \
    "Basic: Update description from file" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --description-file $TEST_DESC_FILE"

# ============================================================
# SUCCESS TESTS - GROUP 2: PRIORITY & ESTIMATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Priority & Estimation"
echo "=========================================="
echo ""

run_test \
    "Priority: Change priority to 1 (Urgent)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --priority 1"

run_test \
    "Estimate: Set estimate to 5" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --estimate 5"

run_test \
    "Estimate: Change estimate to 8" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --estimate 8"

run_test \
    "Estimate: Clear estimate with --no-estimate" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --no-estimate"

run_test \
    "Combined: Priority + estimate together" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --priority 2 --estimate 3"

# ============================================================
# SUCCESS TESTS - GROUP 3: WORKFLOW UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Workflow Updates"
echo "=========================================="
echo ""

if [ -n "$TEST_STATE_ID" ]; then
    run_test \
        "Workflow: Change state by ID" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --state $TEST_STATE_ID"

    run_test \
        "Workflow: Change state by alias" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --state test-state"
fi

if [ -n "$TEST_STATE2_ID" ]; then
    run_test \
        "Workflow: Change to different state" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --state $TEST_STATE2_ID"
fi

# ============================================================
# SUCCESS TESTS - GROUP 4: DATE UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Date Updates"
echo "=========================================="
echo ""

run_test \
    "Date: Set due date" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --due-date 2025-12-31"

run_test \
    "Date: Change due date" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --due-date 2025-11-30"

run_test \
    "Date: Clear due date with --no-due-date" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --no-due-date"

# ============================================================
# SUCCESS TESTS - GROUP 5: ASSIGNMENT UPDATES
# ============================================================

echo "=========================================="
echo "CATEGORY: Assignment Updates"
echo "=========================================="
echo ""

if [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Assignment: Change assignee by ID" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --assignee $TEST_MEMBER_ID"

    run_test \
        "Assignment: Change assignee by email" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --assignee $TEST_MEMBER_EMAIL"

    run_test \
        "Assignment: Change assignee by alias" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --assignee test-member"
fi

run_test \
    "Assignment: Remove assignee with --no-assignee" \
    "$CLI_CMD issue update ${BASE_ISSUES[4]} --no-assignee"

# ============================================================
# SUCCESS TESTS - GROUP 6: PROJECT & ORGANIZATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Project & Organization"
echo "=========================================="
echo ""

if [ -n "$TEST_PROJECT_ID" ]; then
    run_test \
        "Project: Assign to project" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --project $TEST_PROJECT_ID"

    run_test \
        "Project: Change to different project" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --project test-project"

    run_test \
        "Project: Remove from project with --no-project" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --no-project"
fi

# ============================================================
# SUCCESS TESTS - GROUP 7: PARENT RELATIONSHIP
# ============================================================

echo "=========================================="
echo "CATEGORY: Parent Relationship"
echo "=========================================="
echo ""

run_test \
    "Parent: Set parent (make sub-issue)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --parent ${BASE_ISSUES[2]}"

run_test \
    "Parent: Change parent" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --parent ${BASE_ISSUES[1]}"

run_test \
    "Parent: Remove parent with --no-parent (make root)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --no-parent"

# ============================================================
# SUCCESS TESTS - GROUP 8: LABEL MANAGEMENT (3 MODES)
# ============================================================

echo "=========================================="
echo "CATEGORY: Label Management (3 modes)"
echo "=========================================="
echo ""

if [ -n "$TEST_LABEL_ID" ]; then
    run_test \
        "Labels: Replace all labels (--labels)" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels $TEST_LABEL_ID"

    if [ -n "$TEST_LABEL2_ID" ]; then
        run_test \
            "Labels: Replace with multiple labels" \
            "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels $TEST_LABEL_ID,$TEST_LABEL2_ID"
    fi

    if [ -n "$TEST_LABEL2_ID" ]; then
        run_test \
            "Labels: Add labels (--add-labels)" \
            "$CLI_CMD issue update ${BASE_ISSUES[1]} --add-labels $TEST_LABEL2_ID"
    fi

    if [ -n "$TEST_LABEL3_ID" ]; then
        run_test \
            "Labels: Add multiple labels by alias" \
            "$CLI_CMD issue update ${BASE_ISSUES[1]} --add-labels test-label-2,test-label-3"
    fi

    run_test \
        "Labels: Remove labels (--remove-labels)" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --remove-labels $TEST_LABEL_ID"

    if [ -n "$TEST_LABEL2_ID" ] && [ -n "$TEST_LABEL3_ID" ]; then
        run_test \
            "Labels: Add and remove in same command" \
            "$CLI_CMD issue update ${BASE_ISSUES[1]} --add-labels $TEST_LABEL_ID --remove-labels $TEST_LABEL2_ID"
    fi

    run_test \
        "Labels: Clear all labels (empty list)" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels ''"

    run_test \
        "Labels: Label alias resolution" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels test-label"

    run_test \
        "Labels: Remove label that doesn't exist (silent success)" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --remove-labels $TEST_LABEL3_ID"
fi

# ============================================================
# SUCCESS TESTS - GROUP 9: SUBSCRIBER MANAGEMENT (3 MODES)
# ============================================================

echo "=========================================="
echo "CATEGORY: Subscriber Management (3 modes)"
echo "=========================================="
echo ""

if [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Subscribers: Replace all subscribers" \
        "$CLI_CMD issue update ${BASE_ISSUES[3]} --subscribers $TEST_MEMBER_ID"

    if [ -n "$TEST_MEMBER2_ID" ]; then
        run_test \
            "Subscribers: Replace with multiple" \
            "$CLI_CMD issue update ${BASE_ISSUES[3]} --subscribers $TEST_MEMBER_ID,$TEST_MEMBER2_ID"

        run_test \
            "Subscribers: Add subscribers" \
            "$CLI_CMD issue update ${BASE_ISSUES[3]} --add-subscribers $TEST_MEMBER2_ID"

        run_test \
            "Subscribers: Remove subscribers" \
            "$CLI_CMD issue update ${BASE_ISSUES[3]} --remove-subscribers $TEST_MEMBER_ID"

        run_test \
            "Subscribers: Add and remove in same command" \
            "$CLI_CMD issue update ${BASE_ISSUES[3]} --add-subscribers $TEST_MEMBER_ID --remove-subscribers $TEST_MEMBER2_ID"
    fi
fi

# ============================================================
# SUCCESS TESTS - GROUP 10: LIFECYCLE OPERATIONS
# ============================================================

echo "=========================================="
echo "CATEGORY: Lifecycle Operations"
echo "=========================================="
echo ""

run_test \
    "Lifecycle: Move to trash (--trash)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --trash"

run_test \
    "Lifecycle: Restore from trash (--untrash)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --untrash"

# ============================================================
# COMPLEX SCENARIO TESTS
# ============================================================

echo "=========================================="
echo "CATEGORY: Complex Scenarios"
echo "=========================================="
echo ""

run_test \
    "Complex: Kitchen sink (many fields at once)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --title '${TEST_PREFIX}_Kitchen_Sink' --priority 1 --estimate 8 --due-date 2025-12-31"

if [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Complex: Multiple clearing flags" \
        "$CLI_CMD issue update ${BASE_ISSUES[4]} --no-assignee --no-due-date --no-estimate"
fi

if [ -n "$TEST_LABEL_ID" ] && [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Complex: Parent + labels + subscribers" \
        "$CLI_CMD issue update ${BASE_ISSUES[0]} --parent ${BASE_ISSUES[2]} --add-labels $TEST_LABEL_ID --add-subscribers $TEST_MEMBER_ID"
fi

# ============================================================
# ERROR TESTS - VALIDATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Error Cases - Validation"
echo "=========================================="
echo ""

run_test \
    "Error: Invalid identifier (not found)" \
    "$CLI_CMD issue update ENG-99999 --title 'Should fail'" \
    "true"

run_test \
    "Error: No update options provided (only identifier)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]}" \
    "true"

run_test \
    "Error: --web alone doesn't count as update" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --web" \
    "true"

run_test \
    "Error: Both --description and --description-file" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --description 'Test' --description-file $TEST_DESC_FILE" \
    "true"

run_test \
    "Error: Description file doesn't exist" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --description-file /nonexistent/file.md" \
    "true"

run_test \
    "Error: Invalid priority value (out of range)" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --priority 99" \
    "true"

# ============================================================
# ERROR TESTS - MUTUAL EXCLUSIVITY
# ============================================================

echo "=========================================="
echo "CATEGORY: Error Cases - Mutual Exclusivity"
echo "=========================================="
echo ""

if [ -n "$TEST_LABEL_ID" ]; then
    run_test \
        "Error: --labels and --add-labels together" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels $TEST_LABEL_ID --add-labels $TEST_LABEL2_ID" \
        "true"

    run_test \
        "Error: --labels and --remove-labels together" \
        "$CLI_CMD issue update ${BASE_ISSUES[1]} --labels $TEST_LABEL_ID --remove-labels $TEST_LABEL2_ID" \
        "true"
fi

if [ -n "$TEST_MEMBER_ID" ]; then
    run_test \
        "Error: --subscribers and --add-subscribers together" \
        "$CLI_CMD issue update ${BASE_ISSUES[3]} --subscribers $TEST_MEMBER_ID --add-subscribers $TEST_MEMBER2_ID" \
        "true"

    run_test \
        "Error: --subscribers and --remove-subscribers together" \
        "$CLI_CMD issue update ${BASE_ISSUES[3]} --subscribers $TEST_MEMBER_ID --remove-subscribers $TEST_MEMBER2_ID" \
        "true"
fi

run_test \
    "Error: --trash and --untrash together" \
    "$CLI_CMD issue update ${BASE_ISSUES[0]} --trash --untrash" \
    "true"

# ============================================================
# CLEANUP AND SUMMARY
# ============================================================

cleanup_test_aliases

echo "=================================================="
echo "                 TEST SUMMARY"
echo "=================================================="
echo -e "${GREEN}PASSED:  $PASSED${NC}"
echo -e "${RED}FAILED:  $FAILED${NC}"
echo -e "${YELLOW}SKIPPED: $SKIPPED${NC}"
echo "TOTAL:   $((PASSED + FAILED + SKIPPED))"
echo "=================================================="

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
