#!/bin/bash
#
# Comprehensive Test Suite for: linear-create project create
#
# This script tests all permutations and combinations of the project create command
# including aliases, multi-value fields, content handling, and error cases.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - linear-create must be built (npm run build)
#   - You should have at least one team in your Linear workspace
#
# Usage:
#   ./test-project-create.sh [OPTIONS]
#
# Options:
#   --test N        Run only test #N
#   --start N       Run tests starting from #N
#   --end N         Run tests up to #N
#   --range N-M     Run tests from #N to #M
#   --help, -h      Show help message
#
# Examples:
#   ./test-project-create.sh              # Run all tests
#   ./test-project-create.sh --test 5     # Run only test #5
#   ./test-project-create.sh --start 20   # Run tests 20 and above
#   ./test-project-create.sh --range 10-20 # Run tests 10-20
#
# Output:
#   - Creates test projects in Linear (prefixed with TEST_)
#   - Generates cleanup-create-projects.sh for manual cleanup
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
TEST_PREFIX="TEST_$(date +%Y%m%d_%H%M%S)"
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
            echo "  $0 --start 10 --end 15  # Run tests 10 through 15"
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
echo "  PROJECT CREATE - COMPREHENSIVE TEST SUITE"
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

# Get test data (team, etc.)
echo "Fetching test data from Linear..."
TEAMS_JSON=$($CLI_CMD teams list --format json)
TEST_TEAM_ID=$(echo "$TEAMS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const teams=JSON.parse(data); console.log(teams[0]?.id || '')")

if [ -z "$TEST_TEAM_ID" ]; then
    echo -e "${RED}ERROR: No teams found in workspace${NC}"
    exit 1
fi

echo "Using test team: $TEST_TEAM_ID"
echo ""

# Try to get initiative (optional)
INITIATIVES_JSON=$($CLI_CMD initiatives list --format json 2>/dev/null || echo "[]")
TEST_INITIATIVE_ID=$(echo "$INITIATIVES_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const inits=JSON.parse(data); console.log(inits[0]?.id || '')")

if [ -n "$TEST_INITIATIVE_ID" ]; then
    echo "Using test initiative: $TEST_INITIATIVE_ID"
else
    echo "No initiatives found (will skip initiative tests)"
fi
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

            # Try to extract project ID from output
            local project_id=$(echo "$output" | grep -oE 'ID: [a-f0-9-]+' | head -1 | cut -d' ' -f2)
            if [ -n "$project_id" ]; then
                PROJECTS_CREATED+=("$project_id")
                PROJECT_NAMES+=("$description")
                echo "Project ID: $project_id"
            fi

            # Show abbreviated output
            echo "$output" | grep -E '(✅|Name:|ID:|URL:)' || true
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

    # Create test aliases for initiative (if available)
    if [ -n "$TEST_INITIATIVE_ID" ]; then
        $CLI_CMD alias add initiative test-init "$TEST_INITIATIVE_ID" --skip-validation 2>/dev/null || true
    fi

    # Get project statuses and create aliases
    local statuses_json=$($CLI_CMD project-status list --format json 2>/dev/null || echo "[]")
    local status_id=$(echo "$statuses_json" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const statuses=JSON.parse(data); console.log(statuses[0]?.id || '')")
    if [ -n "$status_id" ]; then
        $CLI_CMD alias add project-status test-status "$status_id" --skip-validation 2>/dev/null || true
    fi

    # Get members and create alias
    local members_json=$($CLI_CMD members list --org-wide --format json 2>/dev/null || echo "[]")
    local member_id=$(echo "$members_json" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.id || '')")
    if [ -n "$member_id" ]; then
        $CLI_CMD alias add member test-member "$member_id" --skip-validation 2>/dev/null || true
    fi

    echo "Test aliases created"
    echo ""
}

cleanup_test_aliases() {
    echo "=================================================="
    echo "CLEANUP: Removing test aliases"
    echo "=================================================="

    $CLI_CMD alias remove team test-team 2>/dev/null || true
    $CLI_CMD alias remove initiative test-init 2>/dev/null || true
    $CLI_CMD alias remove project-status test-status 2>/dev/null || true
    $CLI_CMD alias remove member test-member 2>/dev/null || true

    echo "Test aliases removed"
    echo ""
}

generate_cleanup_script() {
    local script_name="cleanup-create-projects.sh"

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
TEST_CONTENT_FILE="/tmp/test-content-$TEST_PREFIX.md"
cat > "$TEST_CONTENT_FILE" <<'EOF_CONTENT'
# Test Project Content

This is **test content** from a file.

## Features
- Feature 1
- Feature 2

## Timeline
Q1 2025
EOF_CONTENT

echo "Created test content file: $TEST_CONTENT_FILE"
echo ""

# ============================================================
# SUCCESS TESTS - BASIC CREATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Basic Creation"
echo "=========================================="
echo ""

run_test \
    "Basic: Minimal (title + team)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Basic_Minimal' --team $TEST_TEAM_ID"

run_test \
    "Basic: With description" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Basic_Desc' --team $TEST_TEAM_ID --description 'Test project description'"

if [ -n "$TEST_INITIATIVE_ID" ]; then
    run_test \
        "Basic: With initiative" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Basic_Initiative' --team $TEST_TEAM_ID --initiative $TEST_INITIATIVE_ID"
fi

run_test \
    "Basic: Title + team + description combined" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Basic_Combined' --team $TEST_TEAM_ID --description 'Combined test description'"

# ============================================================
# SUCCESS TESTS - ALIAS RESOLUTION
# ============================================================

echo "=========================================="
echo "CATEGORY: Alias Resolution"
echo "=========================================="
echo ""

run_test \
    "Alias: Team via alias" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Team' --team test-team"

if [ -n "$TEST_INITIATIVE_ID" ]; then
    run_test \
        "Alias: Initiative via alias" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Initiative' --team $TEST_TEAM_ID --initiative test-init"

    run_test \
        "Alias: Team + Initiative aliases combined" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Combined' --team test-team --initiative test-init"
fi

run_test \
    "Alias: Status via alias" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Status' --team $TEST_TEAM_ID --status test-status"

run_test \
    "Alias: Lead via alias" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Lead' --team $TEST_TEAM_ID --lead test-member"

run_test \
    "Alias: Multiple aliases (team + status + lead)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Alias_Multi' --team test-team --status test-status --lead test-member"

# ============================================================
# SUCCESS TESTS - CONTENT HANDLING
# ============================================================

echo "=========================================="
echo "CATEGORY: Content Handling"
echo "=========================================="
echo ""

run_test \
    "Content: Inline markdown" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Content_Inline' --team $TEST_TEAM_ID --content '# Test\\nThis is **inline** content'"

run_test \
    "Content: From file" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Content_File' --team $TEST_TEAM_ID --content-file $TEST_CONTENT_FILE"

run_test \
    "Content: With special characters" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Content_Special' --team $TEST_TEAM_ID --content '# Special: @mentions, \`code\`, **bold**, [link](url)'"

run_test \
    "Content: Empty (valid)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Content_Empty' --team $TEST_TEAM_ID --content ''"

# ============================================================
# SUCCESS TESTS - LEAD ASSIGNMENT
# ============================================================

echo "=========================================="
echo "CATEGORY: Lead Assignment"
echo "=========================================="
echo ""

run_test \
    "Lead: Auto-assign (default)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Lead_Auto' --team $TEST_TEAM_ID"

run_test \
    "Lead: Explicit --no-lead flag" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Lead_None' --team $TEST_TEAM_ID --no-lead"

run_test \
    "Lead: Via alias" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Lead_Alias' --team $TEST_TEAM_ID --lead test-member"

# Get a member email for testing
MEMBER_EMAIL=$($CLI_CMD members list --org-wide --format json 2>/dev/null | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.email || '')")

if [ -n "$MEMBER_EMAIL" ]; then
    run_test \
        "Lead: Via email" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Lead_Email' --team $TEST_TEAM_ID --lead '$MEMBER_EMAIL'"
fi

# ============================================================
# SUCCESS TESTS - DATES & PRIORITY
# ============================================================

echo "=========================================="
echo "CATEGORY: Dates & Priority"
echo "=========================================="
echo ""

run_test \
    "Dates: Start date only" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Date_Start' --team $TEST_TEAM_ID --start-date 2025-01-15"

run_test \
    "Dates: Target date only" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Date_Target' --team $TEST_TEAM_ID --target-date 2025-03-31"

run_test \
    "Dates: Both with resolutions" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Date_Both' --team $TEST_TEAM_ID --start-date 2025-01-01 --start-date-resolution quarter --target-date 2025-12-31 --target-date-resolution year"

run_test \
    "Priority: Level 0 (None)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Priority_0' --team $TEST_TEAM_ID --priority 0"

run_test \
    "Priority: Level 1 (Urgent)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Priority_1' --team $TEST_TEAM_ID --priority 1"

run_test \
    "Priority: Level 2 (High)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Priority_2' --team $TEST_TEAM_ID --priority 2"

run_test \
    "Priority: Combined with dates and status" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Date_Priority_Status' --team $TEST_TEAM_ID --start-date 2025-01-01 --target-date 2025-06-30 --priority 2 --status test-status"

# ============================================================
# SUCCESS TESTS - VISUAL PROPERTIES
# ============================================================

echo "=========================================="
echo "CATEGORY: Visual Properties"
echo "=========================================="
echo ""

run_test \
    "Visual: Icon (emoji)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Visual_Icon' --team $TEST_TEAM_ID --icon 'Joystick'"

run_test \
    "Visual: Color (hex)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Visual_Color' --team $TEST_TEAM_ID --color '#FF6B6B'"

run_test \
    "Visual: Icon + Color combined" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Visual_Both' --team $TEST_TEAM_ID --icon 'Tree' --color '#4ECDC4'"

# ============================================================
# SUCCESS TESTS - EXTERNAL LINKS
# ============================================================

echo "=========================================="
echo "CATEGORY: External Links"
echo "=========================================="
echo ""

run_test \
    "Links: Single URL" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Link_Single' --team $TEST_TEAM_ID --link 'https://example.com'"

run_test \
    "Links: Single URL with label" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Link_Labeled' --team $TEST_TEAM_ID --link 'https://example.com|Documentation'"

run_test \
    "Links: Multiple links" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Link_Multiple' --team $TEST_TEAM_ID --link 'https://example.com' --link 'https://github.com|GitHub'"

run_test \
    "Links: Mixed (with and without labels)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Link_Mixed' --team $TEST_TEAM_ID --link 'https://example.com' --link 'https://docs.example.com|Docs' --link 'https://api.example.com|API'"

# ============================================================
# SUCCESS TESTS - MULTI-VALUE FIELDS
# ============================================================

echo "=========================================="
echo "CATEGORY: Multi-value Fields"
echo "=========================================="
echo ""

# Get project labels
LABELS_JSON=$($CLI_CMD project-labels list --format json 2>/dev/null || echo "[]")
LABEL_1=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[0]?.id || '')")
LABEL_2=$(echo "$LABELS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const labels=JSON.parse(data); console.log(labels[1]?.id || '')")

if [ -n "$LABEL_1" ]; then
    run_test \
        "Labels: Single label" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Label_Single' --team $TEST_TEAM_ID --labels '$LABEL_1'"

    if [ -n "$LABEL_2" ]; then
        run_test \
            "Labels: Multiple labels (comma-separated)" \
            "$CLI_CMD project create --title '${TEST_PREFIX}_Label_Multi' --team $TEST_TEAM_ID --labels '$LABEL_1,$LABEL_2'"
    fi
fi

# Get multiple members
MEMBERS_JSON=$($CLI_CMD members list --org-wide --format json 2>/dev/null || echo "[]")
MEMBER_1=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[0]?.id || '')")
MEMBER_2=$(echo "$MEMBERS_JSON" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const members=JSON.parse(data); console.log(members[1]?.id || '')")

if [ -n "$MEMBER_1" ]; then
    run_test \
        "Members: Single member" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Member_Single' --team $TEST_TEAM_ID --members '$MEMBER_1'"

    if [ -n "$MEMBER_2" ]; then
        run_test \
            "Members: Multiple members (comma-separated)" \
            "$CLI_CMD project create --title '${TEST_PREFIX}_Member_Multi' --team $TEST_TEAM_ID --members '$MEMBER_1,$MEMBER_2'"
    fi
fi

# ============================================================
# SUCCESS TESTS - COMPLEX COMBINATIONS
# ============================================================

echo "=========================================="
echo "CATEGORY: Complex Combinations"
echo "=========================================="
echo ""

run_test \
    "Combo: All text fields" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Combo_Text' --team $TEST_TEAM_ID --description 'Full description' --content '# Content\\nDetailed content'"

if [ -n "$TEST_INITIATIVE_ID" ]; then
    run_test \
        "Combo: All ID fields" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Combo_IDs' --team $TEST_TEAM_ID --initiative $TEST_INITIATIVE_ID --status test-status --lead test-member"
fi

run_test \
    "Combo: Dates + Priority + Visual" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Combo_DatesPriority' --team $TEST_TEAM_ID --start-date 2025-01-01 --target-date 2025-12-31 --priority 2 --icon 'Skull' --color '#FFA500'"

run_test \
    "Combo: Content + Links + Labels" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Combo_Content' --team $TEST_TEAM_ID --content '# Project Plan' --link 'https://example.com|Docs' --labels '$LABEL_1'"

# Kitchen sink test
KITCHEN_SINK_CMD="$CLI_CMD project create --title '${TEST_PREFIX}_KitchenSink' --team $TEST_TEAM_ID --description 'Everything combined'"
if [ -n "$TEST_INITIATIVE_ID" ]; then
    KITCHEN_SINK_CMD="$KITCHEN_SINK_CMD --initiative $TEST_INITIATIVE_ID"
fi
KITCHEN_SINK_CMD="$KITCHEN_SINK_CMD --content '# Complete\\nAll fields' --icon 'Checklist' --color '#FF0000' --status test-status --lead test-member --priority 1 --start-date 2025-01-01 --target-date 2025-12-31 --link 'https://example.com|Link'"

run_test \
    "Combo: Kitchen Sink (maximum fields)" \
    "$KITCHEN_SINK_CMD"

# ============================================================
# ERROR TESTS - VALIDATION
# ============================================================

echo "=========================================="
echo "CATEGORY: Error Tests - Validation"
echo "=========================================="
echo ""

run_test \
    "Error: Missing required --title" \
    "$CLI_CMD project create --team $TEST_TEAM_ID" \
    "true"

# Test missing --team requires temporarily clearing default config
# Save current defaults
SAVED_DEFAULT_TEAM=$($CLI_CMD config get defaultTeam 2>/dev/null || echo "")
SAVED_DEFAULT_INITIATIVE=$($CLI_CMD config get defaultInitiative 2>/dev/null || echo "")

# Clear defaults temporarily
if [ -n "$SAVED_DEFAULT_TEAM" ]; then
    $CLI_CMD config unset defaultTeam 2>/dev/null || true
fi
if [ -n "$SAVED_DEFAULT_INITIATIVE" ]; then
    $CLI_CMD config unset defaultInitiative 2>/dev/null || true
fi

run_test \
    "Error: Missing required --team" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Error_NoTeam'" \
    "true"

# Restore defaults
if [ -n "$SAVED_DEFAULT_TEAM" ]; then
    $CLI_CMD config set defaultTeam "$SAVED_DEFAULT_TEAM" 2>/dev/null || true
fi
if [ -n "$SAVED_DEFAULT_INITIATIVE" ]; then
    $CLI_CMD config set defaultInitiative "$SAVED_DEFAULT_INITIATIVE" 2>/dev/null || true
fi

run_test \
    "Error: Title too short (<3 chars)" \
    "$CLI_CMD project create --title 'AB' --team $TEST_TEAM_ID" \
    "true"

run_test \
    "Error: Invalid team ID" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Error_InvalidTeam' --team invalid_team_id" \
    "true"

if [ -n "$TEST_INITIATIVE_ID" ]; then
    run_test \
        "Error: Invalid initiative ID" \
        "$CLI_CMD project create --title '${TEST_PREFIX}_Error_InvalidInit' --team $TEST_TEAM_ID --initiative invalid_init_id" \
        "true"
fi

run_test \
    "Error: Both --content and --content-file (mutual exclusion)" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Error_BothContent' --team $TEST_TEAM_ID --content 'Test' --content-file $TEST_CONTENT_FILE" \
    "true"

run_test \
    "Error: Invalid priority value" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Error_InvalidPriority' --team $TEST_TEAM_ID --priority 5" \
    "true"

run_test \
    "Error: Non-existent content file" \
    "$CLI_CMD project create --title '${TEST_PREFIX}_Error_NoFile' --team $TEST_TEAM_ID --content-file /nonexistent/file.md" \
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
echo "Cleanup script generated: cleanup-create-projects.sh"
echo "Run ./cleanup-create-projects.sh to remove test projects"
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
