#!/bin/bash
#
# Run All Project Tests
#
# This script runs both the project create and project update test suites
# and provides a combined summary report.
#
# Usage:
#   ./run-all-tests.sh
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

# Variables
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_TESTS=0
START_TIME=$(date +%s)

echo ""
echo "=========================================="
echo "  RUNNING ALL PROJECT TEST SUITES"
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

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}ERROR: dist/index.js not found${NC}"
    echo "Please build the project first:"
    echo "  npm run build"
    exit 1
fi

# Function to extract test results from output
extract_results() {
    local output="$1"
    local passed=$(echo "$output" | grep -oE 'Passed:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' || echo "0")
    local failed=$(echo "$output" | grep -oE 'Failed:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' || echo "0")
    local total=$(echo "$output" | grep -oE 'Total Tests:[[:space:]]+[0-9]+' | grep -oE '[0-9]+' || echo "0")

    echo "$passed $failed $total"
}

# ============================================================
# RUN TEST SUITE 1: PROJECT CREATE
# ============================================================

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   TEST SUITE 1: PROJECT CREATE         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
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
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   TEST SUITE 2: PROJECT UPDATE         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
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
echo -e "${BLUE}Test Suites:${NC}"
echo "  1. Project Create"
echo "  2. Project Update"
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
echo -e "${BLUE}Cleanup Scripts:${NC}"
echo "  - cleanup-create-projects.sh"
echo "  - cleanup-update-projects.sh"
echo ""

# Generate combined cleanup script
cat > cleanup-all-projects.sh <<'EOF'
#!/bin/bash
#
# Combined cleanup script - runs both cleanup scripts
#

echo "=========================================="
echo "  CLEANUP ALL TEST PROJECTS"
echo "=========================================="
echo ""

if [ -f cleanup-create-projects.sh ]; then
    echo "Running cleanup-create-projects.sh..."
    ./cleanup-create-projects.sh
    echo ""
fi

if [ -f cleanup-update-projects.sh ]; then
    echo "Running cleanup-update-projects.sh..."
    ./cleanup-update-projects.sh
    echo ""
fi

echo "Cleanup complete!"
EOF

chmod +x cleanup-all-projects.sh
echo "Combined cleanup script created: cleanup-all-projects.sh"
echo ""

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
    echo "Review the logs for details:"
    echo "  - $CREATE_OUTPUT_FILE"
    echo "  - $UPDATE_OUTPUT_FILE"
    FINAL_EXIT=1
fi

echo ""

# Cleanup temp files
rm -f "$CREATE_OUTPUT_FILE" "$UPDATE_OUTPUT_FILE"

exit $FINAL_EXIT
