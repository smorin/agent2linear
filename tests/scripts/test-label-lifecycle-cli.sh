#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NODE_BIN="$(node -p process.execPath)"
CLI=("$NODE_BIN" "$REPO_ROOT/dist/index.js")
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/a2l-m33-offline.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

export HOME="$TEST_ROOT/home"
export XDG_CONFIG_HOME="$TEST_ROOT/config"
export XDG_CACHE_HOME="$TEST_ROOT/cache"
export XDG_STATE_HOME="$TEST_ROOT/state"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_STATE_HOME"
unset LINEAR_API_KEY

PASSED=0
FAILED=0

pass() {
  PASSED=$((PASSED + 1))
  printf 'PASS: %s\n' "$1"
}

fail() {
  FAILED=$((FAILED + 1))
  printf 'FAIL: %s\n' "$1" >&2
}

contains() {
  local name="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    pass "$name"
  else
    fail "$name (missing: $needle)"
  fi
}

status_is() {
  local name="$1"
  local expected="$2"
  shift 2
  set +e
  "$@" >"$TEST_ROOT/stdout" 2>"$TEST_ROOT/stderr"
  local status=$?
  set -e
  if [[ "$status" -eq "$expected" ]]; then
    pass "$name"
  else
    fail "$name (expected $expected, got $status)"
  fi
}

if [[ ! -f "$REPO_ROOT/dist/index.js" ]]; then
  printf 'Build first: npm run build\n' >&2
  exit 1
fi

ISSUE_HELP="$("${CLI[@]}" issue-labels list --help)"
PROJECT_HELP="$("${CLI[@]}" project-labels list --help)"
ISSUE_MUTATION_HELP="$("${CLI[@]}" issue-labels retire --help)"
PROJECT_MUTATION_HELP="$("${CLI[@]}" project-labels restore --help)"
PROJECT_UPDATE_HELP="$("${CLI[@]}" project update --help)"
ISSUE_ALIAS_HELP="$("${CLI[@]}" ilbl ls --help)"
PROJECT_ALIAS_HELP="$("${CLI[@]}" plbl ls --help)"

for flag in '--limit <number>' '--after <cursor>' '--include-retired' '-a, --all' '--no-cursor-history'; do
  contains "issue list help $flag" "$ISSUE_HELP" "$flag"
  contains "project list help $flag" "$PROJECT_HELP" "$flag"
done
contains 'issue list canonical output' "$ISSUE_HELP" '-o, --output <table|json|tsv>'
contains 'issue list JSON shorthand' "$ISSUE_HELP" '--json'
contains 'project list canonical output' "$PROJECT_HELP" '-o, --output <table|json|tsv>'
contains 'project list JSON shorthand' "$PROJECT_HELP" '--json'
contains 'issue alias routes' "$ISSUE_ALIAS_HELP" 'issue-labels list|ls'
contains 'project alias routes' "$PROJECT_ALIAS_HELP" 'project-labels list|ls'
contains 'issue mutation output' "$ISSUE_MUTATION_HELP" '-o, --output <table|json>'
contains 'issue mutation JSON' "$ISSUE_MUTATION_HELP" '--json'
contains 'project mutation dry-run' "$PROJECT_MUTATION_HELP" '--dry-run'
contains 'project update trash' "$PROJECT_UPDATE_HELP" '--trash'
contains 'project update untrash' "$PROJECT_UPDATE_HELP" '--untrash'
contains 'project update no-input' "$PROJECT_UPDATE_HELP" '--no-input'

status_is 'issue rejects zero limit before API access' 2 "${CLI[@]}" issue-labels list --limit 0 --json
status_is 'project rejects fractional limit before API access' 2 "${CLI[@]}" project-labels list --limit 1.5 --json
status_is 'issue rejects removed format selector' 2 "${CLI[@]}" issue-labels list --format json
status_is 'project rejects removed format selector' 2 "${CLI[@]}" project-labels list -f json
status_is 'issue rejects conflicting JSON output' 2 "${CLI[@]}" issue-labels list --json --output table
status_is 'issue rejects numeric pages' 2 "${CLI[@]}" issue-labels list --page 2
status_is 'project rejects cursor alias' 2 "${CLI[@]}" project-labels list --cursor raw
status_is 'issue rejects archived scope' 2 "${CLI[@]}" issue-labels list --include-archived
status_is 'project rejects redundant unused scope' 2 "${CLI[@]}" project-labels list --include-unused
status_is 'mutation rejects conflicting JSON output' 2 "${CLI[@]}" issue-labels create --name x --dry-run --json --output table
status_is 'project rejects trash/untrash together' 2 "${CLI[@]}" project update project-1 --trash --untrash

set +e
"${CLI[@]}" labels list >"$TEST_ROOT/shim-out" 2>"$TEST_ROOT/shim-err"
SHIM_STATUS=$?
set -e
if [[ "$SHIM_STATUS" -eq 0 ]]; then
  pass 'labels shim remains successful'
else
  fail "labels shim exit (got $SHIM_STATUS)"
fi
contains 'labels shim issue replacement' "$(cat "$TEST_ROOT/shim-out")" 'a2l issue-labels list'
contains 'labels shim project replacement' "$(cat "$TEST_ROOT/shim-out")" 'a2l project-labels list'
contains 'labels shim deprecation warning' "$(cat "$TEST_ROOT/shim-err")" 'removed in v2.0.0'

TOTAL=$((PASSED + FAILED))
printf '\nPassed: %s\nFailed: %s\nTotal: %s\n' "$PASSED" "$FAILED" "$TOTAL"
[[ "$FAILED" -eq 0 ]]
