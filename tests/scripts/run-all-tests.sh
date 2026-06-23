#!/bin/bash
#
# Run All Tests (Project + Issue Commands)
#
# This script runs both project and issue test suites and provides
# a combined summary report.
#
# Usage:
#   ./run-all-tests.sh
#   ./run-all-tests.sh --project-only   # Run only project tests
#   ./run-all-tests.sh --issue-only     # Run only issue tests
#

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
RUN_PROJECT=true
RUN_ISSUE=true

if [ "$1" = "--project-only" ]; then
  RUN_ISSUE=false
elif [ "$1" = "--issue-only" ]; then
  RUN_PROJECT=false
fi

# Variables
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_TESTS=0
START_TIME=$(date +%s)
SUITE_COUNT=0

echo ""
echo "=========================================="
echo "  RUNNING ALL TEST SUITES"
echo "=========================================="
echo "Start time: $(date)"
echo ""

# Check prerequisites
if [ -z "$LINEAR_API_KEY" ]; then
    echo -e "${RED}ERROR: LINEAR_API_KEY environment variable not set${NC}"
    echo "Please set your Linear API key:"
    echo "  export LINEAR_API_KEY=lin_api_xxx..."
    exit 1
fi

if [ ! -f "../../dist/index.js" ]; then
    echo -e "${RED}ERROR: ../../dist/index.js not found${NC}"
    echo "Please build the project first:"
    echo "  npm run build"
    exit 1
fi

# Function to extract test results from output
extract_results() {
    local output="$1"
    local passed=$(echo "$output" | grep -oE 'Passed:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' | tail -1 || echo "0")
    local failed=$(echo "$output" | grep -oE 'Failed:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' | tail -1 || echo "0")
    local total=$(echo "$output" | grep -oE 'Total:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' | tail -1 || echo "0")

    echo "$passed $failed $total"
}

# ============================================================
# CONFIG OVERRIDES (M29 — offline/hermetic, runs regardless of scope)
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] CONFIG OVERRIDES${NC}"
echo ""

OVERRIDES_OUTPUT_FILE="/tmp/test-config-overrides-output-$$.log"

if ./test-config-overrides.sh 2>&1 | tee "$OVERRIDES_OUTPUT_FILE"; then
    OVERRIDES_EXIT=0
else
    OVERRIDES_EXIT=$?
fi

read OVERRIDES_PASSED OVERRIDES_FAILED OVERRIDES_TOTAL <<< $(extract_results "$(cat "$OVERRIDES_OUTPUT_FILE")")

TOTAL_PASSED=$((TOTAL_PASSED + OVERRIDES_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + OVERRIDES_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + OVERRIDES_TOTAL))

echo ""
echo -e "${BLUE}Config Overrides Results:${NC}"
echo -e "  Passed: ${GREEN}$OVERRIDES_PASSED${NC}"
echo -e "  Failed: ${RED}$OVERRIDES_FAILED${NC}"
echo -e "  Total:  $OVERRIDES_TOTAL"

if [ $OVERRIDES_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

# ============================================================
# PROJECT TESTS
# ============================================================

if [ "$RUN_PROJECT" = true ]; then

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         PROJECT TEST SUITES            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ============================================================
# RUN TEST SUITE 1: PROJECT CREATE
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] PROJECT CREATE${NC}"
echo ""

CREATE_OUTPUT_FILE="/tmp/test-create-output-$$.log"

if ./test-project-create.sh 2>&1 | tee "$CREATE_OUTPUT_FILE"; then
    CREATE_EXIT=0
else
    CREATE_EXIT=$?
fi

# Extract results
read CREATE_PASSED CREATE_FAILED CREATE_TOTAL <<< $(extract_results "$(cat "$CREATE_OUTPUT_FILE")")

TOTAL_PASSED=$((TOTAL_PASSED + CREATE_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + CREATE_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + CREATE_TOTAL))

echo ""
echo -e "${BLUE}Project Create Results:${NC}"
echo -e "  Passed: ${GREEN}$CREATE_PASSED${NC}"
echo -e "  Failed: ${RED}$CREATE_FAILED${NC}"
echo -e "  Total:  $CREATE_TOTAL"

if [ $CREATE_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

# ============================================================
# RUN TEST SUITE 2: PROJECT UPDATE
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] PROJECT UPDATE${NC}"
echo ""

UPDATE_OUTPUT_FILE="/tmp/test-update-output-$$.log"

if ./test-project-update.sh 2>&1 | tee "$UPDATE_OUTPUT_FILE"; then
    UPDATE_EXIT=0
else
    UPDATE_EXIT=$?
fi

# Extract results
read UPDATE_PASSED UPDATE_FAILED UPDATE_TOTAL <<< $(extract_results "$(cat "$UPDATE_OUTPUT_FILE")")

TOTAL_PASSED=$((TOTAL_PASSED + UPDATE_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + UPDATE_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + UPDATE_TOTAL))

echo ""
echo -e "${BLUE}Project Update Results:${NC}"
echo -e "  Passed: ${GREEN}$UPDATE_PASSED${NC}"
echo -e "  Failed: ${RED}$UPDATE_FAILED${NC}"
echo -e "  Total:  $UPDATE_TOTAL"

if [ $UPDATE_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

fi  # End PROJECT tests

# ============================================================
# ISSUE TESTS
# ============================================================

if [ "$RUN_ISSUE" = true ]; then

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          ISSUE TEST SUITES             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ============================================================
# RUN TEST SUITE 3: ISSUE VIEW
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] ISSUE VIEW${NC}"
echo ""

ISSUE_VIEW_OUTPUT="/tmp/test-issue-view-output-$$.log"

if ./test-issue-view.sh 2>&1 | tee "$ISSUE_VIEW_OUTPUT"; then
    ISSUE_VIEW_EXIT=0
else
    ISSUE_VIEW_EXIT=$?
fi

read VIEW_PASSED VIEW_FAILED VIEW_TOTAL <<< $(extract_results "$(cat "$ISSUE_VIEW_OUTPUT")")

TOTAL_PASSED=$((TOTAL_PASSED + VIEW_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + VIEW_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + VIEW_TOTAL))

echo ""
echo -e "${BLUE}Issue View Results:${NC}"
echo -e "  Passed: ${GREEN}$VIEW_PASSED${NC}"
echo -e "  Failed: ${RED}$VIEW_FAILED${NC}"
echo -e "  Total:  $VIEW_TOTAL"

if [ $ISSUE_VIEW_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

# ============================================================
# RUN TEST SUITE 4: ISSUE CREATE
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] ISSUE CREATE${NC}"
echo ""

ISSUE_CREATE_OUTPUT="/tmp/test-issue-create-output-$$.log"

if ./test-issue-create.sh 2>&1 | tee "$ISSUE_CREATE_OUTPUT"; then
    ISSUE_CREATE_EXIT=0
else
    ISSUE_CREATE_EXIT=$?
fi

read ICREATE_PASSED ICREATE_FAILED ICREATE_TOTAL <<< $(extract_results "$(cat "$ISSUE_CREATE_OUTPUT")")

TOTAL_PASSED=$((TOTAL_PASSED + ICREATE_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + ICREATE_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + ICREATE_TOTAL))

echo ""
echo -e "${BLUE}Issue Create Results:${NC}"
echo -e "  Passed: ${GREEN}$ICREATE_PASSED${NC}"
echo -e "  Failed: ${RED}$ICREATE_FAILED${NC}"
echo -e "  Total:  $ICREATE_TOTAL"

if [ $ISSUE_CREATE_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

# ============================================================
# RUN TEST SUITE 5: ISSUE UPDATE
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] ISSUE UPDATE${NC}"
echo ""

ISSUE_UPDATE_OUTPUT="/tmp/test-issue-update-output-$$.log"

if ./test-issue-update.sh 2>&1 | tee "$ISSUE_UPDATE_OUTPUT"; then
    ISSUE_UPDATE_EXIT=0
else
    ISSUE_UPDATE_EXIT=$?
fi

read IUPDATE_PASSED IUPDATE_FAILED IUPDATE_TOTAL <<< $(extract_results "$(cat "$ISSUE_UPDATE_OUTPUT")")

TOTAL_PASSED=$((TOTAL_PASSED + IUPDATE_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + IUPDATE_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + IUPDATE_TOTAL))

echo ""
echo -e "${BLUE}Issue Update Results:${NC}"
echo -e "  Passed: ${GREEN}$IUPDATE_PASSED${NC}"
echo -e "  Failed: ${RED}$IUPDATE_FAILED${NC}"
echo -e "  Total:  $IUPDATE_TOTAL"

if [ $ISSUE_UPDATE_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

# ============================================================
# RUN TEST SUITE 6: ISSUE LIST
# ============================================================

echo ""
echo -e "${BLUE}[Suite $((++SUITE_COUNT))] ISSUE LIST${NC}"
echo ""

ISSUE_LIST_OUTPUT="/tmp/test-issue-list-output-$$.log"

if ./test-issue-list.sh 2>&1 | tee "$ISSUE_LIST_OUTPUT"; then
    ISSUE_LIST_EXIT=0
else
    ISSUE_LIST_EXIT=$?
fi

read ILIST_PASSED ILIST_FAILED ILIST_TOTAL <<< $(extract_results "$(cat "$ISSUE_LIST_OUTPUT")")

TOTAL_PASSED=$((TOTAL_PASSED + ILIST_PASSED))
TOTAL_FAILED=$((TOTAL_FAILED + ILIST_FAILED))
TOTAL_TESTS=$((TOTAL_TESTS + ILIST_TOTAL))

echo ""
echo -e "${BLUE}Issue List Results:${NC}"
echo -e "  Passed: ${GREEN}$ILIST_PASSED${NC}"
echo -e "  Failed: ${RED}$ILIST_FAILED${NC}"
echo -e "  Total:  $ILIST_TOTAL"

if [ $ISSUE_LIST_EXIT -eq 0 ]; then
    echo -e "  Status: ${GREEN}✅ PASSED${NC}"
else
    echo -e "  Status: ${RED}❌ FAILED${NC}"
fi

fi  # End ISSUE tests

# ============================================================
# COMBINED SUMMARY
# ============================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "=========================================="
echo "  COMBINED TEST SUMMARY"
echo "=========================================="
echo ""

if [ "$RUN_PROJECT" = true ] && [ "$RUN_ISSUE" = true ]; then
    echo -e "${BLUE}Test Suites Run:${NC}"
    echo "  Project: Create, Update"
    echo "  Issue:   View, Create, Update, List"
elif [ "$RUN_PROJECT" = true ]; then
    echo -e "${BLUE}Test Suites Run:${NC}"
    echo "  Project: Create, Update"
elif [ "$RUN_ISSUE" = true ]; then
    echo -e "${BLUE}Test Suites Run:${NC}"
    echo "  Issue:   View, Create, Update, List"
fi

echo ""
echo -e "${BLUE}Combined Results:${NC}"
echo -e "  Total Tests:  $TOTAL_TESTS"
echo -e "  Passed:       ${GREEN}$TOTAL_PASSED${NC}"
echo -e "  Failed:       ${RED}$TOTAL_FAILED${NC}"

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((TOTAL_PASSED * 100 / TOTAL_TESTS))
    echo -e "  Pass Rate:    ${PASS_RATE}%"
fi

echo ""
echo -e "${BLUE}Execution Time:${NC}  ${MINUTES}m ${SECONDS}s"
echo ""

if [ "$RUN_PROJECT" = true ]; then
    echo -e "${BLUE}Project Test Cleanup Scripts:${NC}"
    echo "  - cleanup-create-projects.sh"
    echo "  - cleanup-update-projects.sh"
    echo ""
fi

if [ "$RUN_ISSUE" = true ]; then
    echo -e "${BLUE}Issue Test Cleanup Scripts:${NC}"
    echo "  - cleanup-issue-view.sh (if generated)"
    echo "  - cleanup-issue-create.sh (if generated)"
    echo "  - cleanup-issue-update.sh (if generated)"
    echo ""
fi

# Final status
if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ ALL TESTS PASSED!                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    FINAL_EXIT=0
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ SOME TESTS FAILED                  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Review the logs in /tmp/ for details"
    FINAL_EXIT=1
fi

echo ""

# Cleanup temp files
rm -f /tmp/test-*-output-$$.log 2>/dev/null || true

exit $FINAL_EXIT
