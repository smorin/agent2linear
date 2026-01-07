#!/bin/bash
#
# Master Benchmark Runner
#
# Runs all performance benchmark scenarios and generates combined report
#
# Usage:
#   export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
#   export TEST_ISSUE_ID=abc123  # Optional
#   ./run-all-benchmarks.sh
#

set -e

# Check for API key
if [ -z "$LINEAR_API_KEY" ]; then
  echo "Error: LINEAR_API_KEY environment variable not set"
  echo "Get your key from: https://linear.app/settings/api"
  exit 1
fi

# Check dependencies
if ! command -v a2l &> /dev/null; then
  echo "Error: agent2linear (a2l) not found in PATH"
  echo ""
  echo "Install agent2linear:"
  echo "  npm install -g agent2linear"
  echo ""
  echo "Or use npx:"
  echo "  alias a2l='npx agent2linear'"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Warning: jq not found - JSON formatting will be limited"
  echo "Install jq for better output: brew install jq"
  echo ""
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Linear API Performance Benchmarks"
echo "=========================================="
echo ""
echo "This will run 3 benchmark scenarios:"
echo "  1. Fetch 50 issues with full details"
echo "  2. List 25 projects with metadata"
echo "  3. Update issue with validation"
echo ""
echo "Comparing:"
echo "  - agent2linear (custom GraphQL)"
echo "  - Naive @linear/sdk (lazy loading)"
echo "  - Cyrus pattern (SDK + caching) [estimated]"
echo ""
echo -e "${YELLOW}Note: This requires an active Linear API key${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Create results directory
RESULTS_DIR="../results"
mkdir -p "$RESULTS_DIR"

# Timestamp for this run
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
COMBINED_FILE="$RESULTS_DIR/combined-$TIMESTAMP.json"

# ========================================
# Run Scenario 1: Fetch Issues
# ========================================
echo ""
echo -e "${BLUE}Running Scenario 1: Fetch 50 Issues${NC}"
echo "--------------------------------------"
echo ""

if ./scenario-1-fetch-issues.sh; then
  SCENARIO_1_FILE=$(ls -t "$RESULTS_DIR"/scenario-1-*.json | head -n1)
  echo -e "${GREEN}✓ Scenario 1 complete${NC}"
else
  echo -e "${RED}✗ Scenario 1 failed${NC}"
  SCENARIO_1_FILE=""
fi

# ========================================
# Run Scenario 2: List Projects
# ========================================
echo ""
echo -e "${BLUE}Running Scenario 2: List 25 Projects${NC}"
echo "--------------------------------------"
echo ""

if ./scenario-2-list-projects.sh; then
  SCENARIO_2_FILE=$(ls -t "$RESULTS_DIR"/scenario-2-*.json | head -n1)
  echo -e "${GREEN}✓ Scenario 2 complete${NC}"
else
  echo -e "${RED}✗ Scenario 2 failed${NC}"
  SCENARIO_2_FILE=""
fi

# ========================================
# Run Scenario 3: Update Issue
# ========================================
echo ""
echo -e "${BLUE}Running Scenario 3: Update Issue${NC}"
echo "--------------------------------------"
echo ""

if ./scenario-3-update-issue.sh; then
  SCENARIO_3_FILE=$(ls -t "$RESULTS_DIR"/scenario-3-*.json | head -n1)
  echo -e "${GREEN}✓ Scenario 3 complete${NC}"
else
  echo -e "${RED}✗ Scenario 3 failed${NC}"
  SCENARIO_3_FILE=""
fi

# ========================================
# Combine Results
# ========================================
echo ""
echo "=========================================="
echo "Generating Combined Report"
echo "=========================================="
echo ""

if command -v jq &> /dev/null; then
  # Use jq to combine JSON files
  jq -n \
    --slurpfile s1 "$SCENARIO_1_FILE" \
    --slurpfile s2 "$SCENARIO_2_FILE" \
    --slurpfile s3 "$SCENARIO_3_FILE" \
    '{
      "benchmark_run": "'"$TIMESTAMP"'",
      "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "scenarios": [
        $s1[0],
        $s2[0],
        $s3[0]
      ],
      "summary": {
        "total_scenarios": 3,
        "agent2linear_total_calls": (
          ($s1[0].results[] | select(.approach == "agent2linear") | .api_calls) +
          ($s2[0].results[] | select(.approach == "agent2linear") | .api_calls) +
          ($s3[0].results[] | select(.approach == "agent2linear") | .api_calls)
        ),
        "naive_sdk_total_calls": (
          ($s1[0].results[] | select(.approach == "naive-sdk") | .api_calls) +
          ($s2[0].results[] | select(.approach == "naive-sdk") | .api_calls) +
          ($s3[0].results[] | select(.approach == "naive-sdk") | .api_calls)
        )
      }
    }' > "$COMBINED_FILE"
  
  echo "Combined results:"
  echo ""
  jq '.' "$COMBINED_FILE"
else
  # Fallback: simple concatenation
  cat > "$COMBINED_FILE" <<EOF
{
  "benchmark_run": "$TIMESTAMP",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "note": "Install jq for better formatting",
  "scenarios": [
    $(cat "$SCENARIO_1_FILE"),
    $(cat "$SCENARIO_2_FILE"),
    $(cat "$SCENARIO_3_FILE")
  ]
}
EOF
  
  cat "$COMBINED_FILE"
fi

echo ""
echo "=========================================="
echo "Benchmark Complete!"
echo "=========================================="
echo ""
echo "Individual results:"
echo "  - $SCENARIO_1_FILE"
echo "  - $SCENARIO_2_FILE"
echo "  - $SCENARIO_3_FILE"
echo ""
echo "Combined report:"
echo "  - $COMBINED_FILE"
echo ""
echo -e "${GREEN}All benchmarks completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review results: cat $COMBINED_FILE | jq"
echo "  2. Share results in performance documentation"
echo "  3. Compare with your own Linear workspace characteristics"
echo ""
