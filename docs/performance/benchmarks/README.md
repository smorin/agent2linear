# Performance Benchmarks

This directory contains reproducible benchmark scripts for comparing Linear API integration approaches.

## Quick Start

```bash
# Set your Linear API key
export LINEAR_API_KEY=lin_api_xxxxxxxxxxxx

# Run all benchmarks
cd docs/performance/benchmarks
./run-all-benchmarks.sh
```

## Individual Scenarios

### Scenario 1: Fetch 50 Issues
```bash
./scenario-1-fetch-issues.sh
```

Tests fetching 50 issues with full details (state, assignee, team, labels).

**Key Comparison:**
- agent2linear: 1 API call, ~850ms
- Naive SDK: 101 API calls, ~12,400ms
- **14.6x faster** with agent2linear

---

### Scenario 2: List 25 Projects
```bash
./scenario-2-list-projects.sh
```

Tests listing projects with metadata (teams, leads, member counts).

**Key Comparison:**
- agent2linear: 1 API call, ~650ms
- Naive SDK: 51 API calls, ~6,200ms
- **9.5x faster** with agent2linear

---

### Scenario 3: Update Issue with Validation
```bash
export TEST_ISSUE_ID=abc123  # Optional: specific issue to test
./scenario-3-update-issue.sh
```

Tests updating an issue while validating state/team compatibility.

**Key Comparison:**
- agent2linear: 2 API calls, ~950ms
- Naive SDK: 5 API calls, ~2,800ms
- **2.9x faster** with agent2linear

---

## Results

Benchmark results are saved to `../results/` as JSON files:

```bash
# View latest combined results
cat ../results/combined-*.json | jq

# View specific scenario
cat ../results/scenario-1-*.json | jq
```

### Example Output

```json
{
  "benchmark_run": "20260107-143022",
  "timestamp": "2026-01-07T22:30:22Z",
  "scenarios": [...],
  "summary": {
    "total_scenarios": 3,
    "agent2linear_total_calls": 4,
    "naive_sdk_total_calls": 157
  }
}
```

## Requirements

- **agent2linear** installed (`npm install -g agent2linear`)
- **@linear/sdk** installed (`npm install @linear/sdk`)
- **jq** for JSON formatting (optional, but recommended)
- **LINEAR_API_KEY** environment variable

## Methodology

Each benchmark:
1. Runs the same operation with different approaches
2. Measures API call count and latency
3. Saves detailed results to JSON
4. Provides summary comparison

**Approaches Tested:**
- **agent2linear**: Custom GraphQL with comprehensive queries
- **Naive SDK**: Direct @linear/sdk usage with lazy loading
- **Cyrus pattern**: SDK + caching (estimated values)

## Interpreting Results

### When agent2linear Excels
- ✅ Fetching lists with nested data (issues, projects, teams)
- ✅ One-time queries or infrequent operations
- ✅ AI agents needing token efficiency
- ✅ CLI tools with human-readable output

### When SDK + Caching Helps
- ✅ Long-running processes (servers, webhooks)
- ✅ Repeated access to same entities
- ✅ Write-heavy workflows with validation
- ✅ Real-time updates with Linear SDK subscriptions

### When Naive SDK Struggles
- ❌ Large result sets (50+ items)
- ❌ Deep nesting (issue → state → workflow)
- ❌ No caching layer
- ❌ Multiple lazy property accesses

## Contributing

To add new benchmark scenarios:

1. Create `scenario-N-description.sh`
2. Follow existing script structure
3. Save results to `../results/scenario-N-*.json`
4. Update `run-all-benchmarks.sh` to include new scenario
5. Document in this README

## Notes

- Benchmark times vary based on network latency and Linear workspace size
- Cyrus pattern values are estimated (no actual Cyrus instance required)
- Results represent typical workloads - YMMV based on use case
- See `../README.md` for detailed comparison and recommendations
