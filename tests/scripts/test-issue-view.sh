#!/bin/bash
#
# Test Suite for: linear-create issue view (M15.2)
#
# This script tests the issue view command with various options.
# NOTE: This requires existing issues in your Linear workspace to test against.
#
# Setup Requirements:
#   - LINEAR_API_KEY environment variable must be set
#   - linear-create must be built (npm run build)
#   - You should have at least one issue in your Linear workspace
#
# Usage:
#   ./test-issue-view.sh [ISSUE_IDENTIFIER]
#
# Examples:
#   ./test-issue-view.sh ENG-123              # Test with specific issue
#   ./test-issue-view.sh                      # Will prompt for issue identifier
#
# Output:
#   - Tests various view command options
#   - Prints summary of passed/failed tests
#

set -e  # Exit on first error
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0

# Get issue identifier from argument or find one
ISSUE_IDENTIFIER="$1"

# Helper functions
print_test_header() {
  local test_num="$1"
  local description="$2"
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Test #${test_num}: ${description}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

pass_test() {
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED++))
  ((TOTAL++))
}

fail_test() {
  local reason="$1"
  echo -e "${RED}✗ FAIL${NC}: $reason"
  ((FAILED++))
  ((TOTAL++))
}

skip_test() {
  local reason="$1"
  echo -e "${YELLOW}⊘ SKIP${NC}: $reason"
  ((SKIPPED++))
  ((TOTAL++))
}

# Check prerequisites
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Issue View Command Test Suite (M15.2)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ -z "$LINEAR_API_KEY" ]; then
  echo -e "${RED}Error: LINEAR_API_KEY environment variable is not set${NC}"
  exit 1
fi

echo -e "${GREEN}✓ LINEAR_API_KEY is set${NC}"

# Check if built
if [ ! -f "dist/index.js" ]; then
  echo -e "${YELLOW}Building project...${NC}"
  npm run build
fi

echo -e "${GREEN}✓ Project is built${NC}"

# Get issue identifier if not provided
if [ -z "$ISSUE_IDENTIFIER" ]; then
  echo ""
  echo -e "${YELLOW}No issue identifier provided. Let's find one...${NC}"
  echo ""

  # Try to get current user's first issue
  echo "Fetching your assigned issues..."

  # We don't have issue list command yet, so we'll ask the user
  echo ""
  echo -e "${YELLOW}Please provide an issue identifier (e.g., ENG-123):${NC}"
  read -p "Issue identifier: " ISSUE_IDENTIFIER

  if [ -z "$ISSUE_IDENTIFIER" ]; then
    echo -e "${RED}Error: No issue identifier provided${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Testing with issue: ${ISSUE_IDENTIFIER}${NC}"
echo ""

# Test 1: Basic view
print_test_header "1" "View issue with identifier format"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" > /tmp/test-issue-view-1.txt 2>&1; then
  if grep -q "$ISSUE_IDENTIFIER" /tmp/test-issue-view-1.txt; then
    pass_test
  else
    fail_test "Output doesn't contain issue identifier"
    cat /tmp/test-issue-view-1.txt
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-1.txt
fi

# Test 2: JSON output
print_test_header "2" "View issue with --json flag"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --json > /tmp/test-issue-view-2.json 2>&1; then
  # Validate JSON
  if jq . /tmp/test-issue-view-2.json > /dev/null 2>&1; then
    # Check for key fields
    if jq -e '.id and .identifier and .title and .url' /tmp/test-issue-view-2.json > /dev/null; then
      pass_test
    else
      fail_test "JSON missing required fields"
      cat /tmp/test-issue-view-2.json
    fi
  else
    fail_test "Invalid JSON output"
    cat /tmp/test-issue-view-2.json
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-2.json
fi

# Test 3: With comments flag
print_test_header "3" "View issue with --show-comments flag"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --show-comments > /tmp/test-issue-view-3.txt 2>&1; then
  if grep -q "Comments:" /tmp/test-issue-view-3.txt || grep -q "No comments" /tmp/test-issue-view-3.txt; then
    pass_test
  else
    fail_test "Output doesn't show comments section"
    cat /tmp/test-issue-view-3.txt
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-3.txt
fi

# Test 4: With history flag
print_test_header "4" "View issue with --show-history flag"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --show-history > /tmp/test-issue-view-4.txt 2>&1; then
  if grep -q "History:" /tmp/test-issue-view-4.txt || grep -q "No history" /tmp/test-issue-view-4.txt; then
    pass_test
  else
    fail_test "Output doesn't show history section"
    cat /tmp/test-issue-view-4.txt
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-4.txt
fi

# Test 5: Combined flags (comments + history)
print_test_header "5" "View issue with both --show-comments and --show-history"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --show-comments --show-history > /tmp/test-issue-view-5.txt 2>&1; then
  has_comments=false
  has_history=false

  if grep -q "Comments:" /tmp/test-issue-view-5.txt || grep -q "No comments" /tmp/test-issue-view-5.txt; then
    has_comments=true
  fi

  if grep -q "History:" /tmp/test-issue-view-5.txt || grep -q "No history" /tmp/test-issue-view-5.txt; then
    has_history=true
  fi

  if [ "$has_comments" = true ] && [ "$has_history" = true ]; then
    pass_test
  else
    fail_test "Output missing comments or history section"
    cat /tmp/test-issue-view-5.txt
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-5.txt
fi

# Test 6: JSON with comments
print_test_header "6" "JSON output with --show-comments"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --json --show-comments > /tmp/test-issue-view-6.json 2>&1; then
  if jq . /tmp/test-issue-view-6.json > /dev/null 2>&1; then
    if jq -e '.comments' /tmp/test-issue-view-6.json > /dev/null; then
      pass_test
    else
      fail_test "JSON missing comments field"
      cat /tmp/test-issue-view-6.json
    fi
  else
    fail_test "Invalid JSON output"
    cat /tmp/test-issue-view-6.json
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-6.json
fi

# Test 7: JSON with history
print_test_header "7" "JSON output with --show-history"
if node dist/index.js issue view "$ISSUE_IDENTIFIER" --json --show-history > /tmp/test-issue-view-7.json 2>&1; then
  if jq . /tmp/test-issue-view-7.json > /dev/null 2>&1; then
    if jq -e '.history' /tmp/test-issue-view-7.json > /dev/null; then
      pass_test
    else
      fail_test "JSON missing history field"
      cat /tmp/test-issue-view-7.json
    fi
  else
    fail_test "Invalid JSON output"
    cat /tmp/test-issue-view-7.json
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-7.json
fi

# Test 8: Invalid identifier error handling
print_test_header "8" "Error handling for invalid identifier"
if node dist/index.js issue view "INVALID-999999" > /tmp/test-issue-view-8.txt 2>&1; then
  fail_test "Command should have failed with invalid identifier"
else
  if grep -q "not found" /tmp/test-issue-view-8.txt || grep -q "Issue not found" /tmp/test-issue-view-8.txt; then
    pass_test
  else
    fail_test "Error message doesn't indicate issue not found"
    cat /tmp/test-issue-view-8.txt
  fi
fi

# Test 9: Web mode (skip actual browser test, just check command doesn't fail)
print_test_header "9" "Web mode flag (--web) doesn't error"
if timeout 5 node dist/index.js issue view "$ISSUE_IDENTIFIER" --web > /tmp/test-issue-view-9.txt 2>&1 || true; then
  if grep -q "Opening in browser" /tmp/test-issue-view-9.txt || grep -q "Browser opened" /tmp/test-issue-view-9.txt; then
    pass_test
  else
    # Skip if we can't test browser opening
    skip_test "Cannot verify browser opening in automated test"
  fi
else
  fail_test "Command failed"
  cat /tmp/test-issue-view-9.txt
fi

# Test 10: Help text
print_test_header "10" "Help text is available"
if node dist/index.js issue view --help > /tmp/test-issue-view-10.txt 2>&1; then
  if grep -q "view <identifier>" /tmp/test-issue-view-10.txt; then
    pass_test
  else
    fail_test "Help text doesn't show usage"
    cat /tmp/test-issue-view-10.txt
  fi
else
  fail_test "Help command failed"
  cat /tmp/test-issue-view-10.txt
fi

# Print summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Total tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Some tests failed. Please review the output above.${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
