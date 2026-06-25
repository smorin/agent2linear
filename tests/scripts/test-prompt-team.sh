#!/usr/bin/env bash
#
# End-to-end smoke test for M30 Phase 3 — the prompt team layer + precedence.
#
# Exercises the REAL built CLI (dist/index.js) against a hermetic project repo:
#   - a `promptRules` team match selects the team prompt;
#   - a path override (location) outranks a matching team rule;
#   - an explicit `--team X` with no matching rule exits 1;
#   - a derived `defaultTeam` with no matching rule falls through to the general
#     defaultPrompt (no error).
#
# Hermeticity: overrides HOME + XDG dirs to fresh temp directories and cleans
# them up via `trap ... EXIT`. It never touches the real ~/.config and does NOT
# require LINEAR_API_KEY — every command here is offline (no Linear API call).
# `-C <dir>` is the targeting lever (git-style chdir), so the project repo lives
# under HOME and is discovered by walking up from the targeted directory.
#
# Usage:
#   npm run build && bash tests/scripts/test-prompt-team.sh
#   bash tests/scripts/test-prompt-team.sh --test 2
#   bash tests/scripts/test-prompt-team.sh --range 1-3

set -uo pipefail

# --- arg parsing: optional --test N / --range A-B ------------------------------
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --test|--range)
      if [ $# -lt 2 ]; then
        echo "Error: $1 requires a value (e.g. --test 2 or --range 1-3)" >&2
        exit 2
      fi
      ONLY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

should_run() { # $1 = test number
  [ -z "$ONLY" ] && return 0
  case "$ONLY" in
    *-*) [ "$1" -ge "${ONLY%-*}" ] && [ "$1" -le "${ONLY#*-}" ] ;;
    *) [ "$1" = "$ONLY" ] ;;
  esac
}

# --- locate the built CLI (absolute, before any cd) ---------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_JS="$REPO_ROOT/dist/index.js"
[ -f "$CLI_JS" ] || { echo "FAIL: built CLI not found at $CLI_JS (run 'npm run build' first)"; exit 1; }

# --- hermetic sandbox ---------------------------------------------------------
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX/home"; mkdir -p "$HOME"
export XDG_CONFIG_HOME="$SANDBOX/xdgcfg"
export XDG_CACHE_HOME="$SANDBOX/xdgcache"
unset AGENT2LINEAR_WORKSPACE 2>/dev/null || true
unset AGENT2LINEAR_CWD 2>/dev/null || true
unset LINEAR_API_KEY 2>/dev/null || true

cli() { node "$CLI_JS" "$@"; }

# --- fixtures -----------------------------------------------------------------
# A project repo under HOME with:
#   - config.json: a general defaultPrompt + a defaultTeam + a path override
#   - prompts.json: the bodies + promptRules keyed on the team (alias + id)
#   - aliases.json (global): "payments" → team_pay (alias/id equivalence)
PROJ="$HOME/work/repo"
mkdir -p "$PROJ/.agent2linear" "$PROJ/apps/mobile"

mkdir -p "$XDG_CONFIG_HOME/agent2linear"
cat > "$XDG_CONFIG_HOME/agent2linear/aliases.json" <<'EOF'
{ "teams": { "payments": "team_pay" } }
EOF

cat > "$PROJ/.agent2linear/config.json" <<'EOF'
{
  "defaultPrompt": "general",
  "defaultTeam": "team_pay",
  "overrides": [
    { "when": { "path": "apps/mobile/**" }, "defaultPrompt": "mobile-issue" }
  ]
}
EOF

cat > "$PROJ/.agent2linear/prompts.json" <<'EOF'
{
  "prompts": {
    "general":      { "body": "## General Issue\nWrite a clear title.\n" },
    "mobile-issue": { "body": "## Mobile Issue\nDescribe device + OS version.\n" },
    "pay-issue":    { "body": "## Payments Issue\nFollow the payments convention.\n" }
  },
  "promptRules": [
    { "when": { "team": "payments" }, "prompt": "pay-issue" }
  ]
}
EOF

# --- counters + helpers -------------------------------------------------------
PASS=0; FAIL=0; TOTAL=0
run_test() { TOTAL=$((TOTAL + 1)); echo "Test $1: $2"; }
pass_test() { PASS=$((PASS + 1)); echo "  ✓ PASS"; }
fail_test() { FAIL=$((FAIL + 1)); echo "  ✗ FAIL: $1"; }
assert_contains() { # haystack needle msg
  if printf '%s' "$1" | grep -qF "$2"; then pass_test; else fail_test "$3 — expected to contain '$2', got: $1"; fi
}
assert_eq() { # actual expected msg
  if [ "$1" = "$2" ]; then pass_test; else fail_test "$3 — expected '$2', got '$1'"; fi
}

echo "=================================================="
echo "  M30 PROMPT TEMPLATES — Phase 3 team layer (offline)"
echo "=================================================="
echo ""

# Test 1: at the repo root, the derived defaultTeam selects the team prompt.
if should_run 1; then
  run_test 1 "promptRule team match selects the team prompt (derived defaultTeam)"
  OUT="$(cli -C "$PROJ" prompt get 2>/dev/null)"
  assert_contains "$OUT" "## Payments Issue" "team prompt body"
fi

# Test 2: --json at the repo root reports selection=team, name=pay-issue.
if should_run 2; then
  run_test 2 "prompt get --json reports selection=team for the derived team"
  JSON="$(cli -C "$PROJ" prompt get --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  if [ "$SEL" = "team" ] && [ "$NAME" = "pay-issue" ]; then pass_test; else
    fail_test "envelope: selection=$SEL name=$NAME"
  fi
fi

# Test 3: a path override (location) outranks the matching team rule.
if should_run 3; then
  run_test 3 "a path override outranks a matching team rule (location wins)"
  JSON="$(cli -C "$PROJ/apps/mobile" prompt get --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  if [ "$SEL" = "location" ] && [ "$NAME" = "mobile-issue" ]; then pass_test; else
    fail_test "envelope: selection=$SEL name=$NAME (expected location/mobile-issue)"
  fi
fi

# Test 4: explicit --team with a matching rule (id form) returns the team prompt.
if should_run 4; then
  run_test 4 "explicit --team <id> with a matching rule returns the team prompt"
  OUT="$(cli -C "$PROJ" prompt get --team team_pay 2>/dev/null)"
  assert_contains "$OUT" "## Payments Issue" "explicit team-by-id body"
fi

# Test 5: explicit --team via the ALIAS resolves to the same team prompt.
if should_run 5; then
  run_test 5 "explicit --team <alias> resolves the same team prompt (alias/id equivalence)"
  OUT="$(cli -C "$PROJ" prompt get --team payments 2>/dev/null)"
  assert_contains "$OUT" "## Payments Issue" "explicit team-by-alias body"
fi

# Test 6: explicit --team with NO matching rule exits 1 (strict).
if should_run 6; then
  run_test 6 "explicit --team <unmatched> exits 1"
  cli -C "$PROJ" prompt get --team team_nope >/dev/null 2>&1
  assert_eq "$?" "1" "unmatched explicit team exit code"
fi

# Test 7: explicit --team unmatched --json emits nothing on stdout and exits 1.
if should_run 7; then
  run_test 7 "explicit --team <unmatched> --json: empty stdout, exit 1"
  STDOUT="$(cli -C "$PROJ" prompt get --team team_nope --json 2>/dev/null)"; CODE=$?
  if [ -z "$STDOUT" ] && [ "$CODE" = "1" ]; then pass_test; else
    fail_test "expected empty stdout + exit 1, got stdout='$STDOUT' exit=$CODE"
  fi
fi

# Test 8: a DERIVED defaultTeam with no matching rule falls through to general.
if should_run 8; then
  run_test 8 "derived defaultTeam with no matching rule falls through to general"
  # A second repo whose defaultTeam has no promptRule.
  PROJ2="$HOME/work/repo2"
  mkdir -p "$PROJ2/.agent2linear"
  cat > "$PROJ2/.agent2linear/config.json" <<'EOF'
{ "defaultPrompt": "general", "defaultTeam": "team_unmatched" }
EOF
  cat > "$PROJ2/.agent2linear/prompts.json" <<'EOF'
{
  "prompts": { "general": { "body": "## General Issue\nWrite a clear title.\n" } },
  "promptRules": [ { "when": { "team": "team_pay" }, "prompt": "pay-issue" } ]
}
EOF
  JSON="$(cli -C "$PROJ2" prompt get --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  if [ "$SEL" = "general" ] && [ "$NAME" = "general" ]; then pass_test; else
    fail_test "envelope: selection=$SEL name=$NAME (expected general/general)"
  fi
fi

# Test 9: a `when: { team }` in a config overrides[] is warn-skipped (config
# byte-identical) — config resolution must NOT honor the team matcher.
if should_run 9; then
  run_test 9 "a when:{team} in config overrides[] is ignored by config resolution"
  PROJ3="$HOME/work/repo3"
  mkdir -p "$PROJ3/.agent2linear"
  cat > "$PROJ3/.agent2linear/config.json" <<'EOF'
{
  "defaultPrompt": "general",
  "defaultTeam": "team_pay",
  "overrides": [
    { "when": { "team": "team_pay" }, "defaultPrompt": "should-not-win" }
  ]
}
EOF
  cat > "$PROJ3/.agent2linear/prompts.json" <<'EOF'
{ "prompts": { "general": { "body": "## General Issue\n" }, "should-not-win": { "body": "WRONG\n" } } }
EOF
  # config explain must report defaultPrompt as the top-level general (NOT the
  # team-keyed override, which is an unsupported when key for config resolution).
  JSON="$(cli config explain "$PROJ3" --json 2>/dev/null)"
  VAL="$(printf '%s' "$JSON" | jq -r '.resolved.defaultPrompt.value')"
  SRC="$(printf '%s' "$JSON" | jq -r '.resolved.defaultPrompt.source')"
  if [ "$VAL" = "general" ] && [ "$SRC" != "override" ]; then pass_test; else
    fail_test "config explain defaultPrompt: value=$VAL source=$SRC (expected general, not override)"
  fi
fi

# Test 10: --force + explicit --team with a matching rule BEATS an in-scope
# location override (in apps/mobile the path override would otherwise win).
if should_run 10; then
  run_test 10 "--force + --team <matching> beats an in-scope location override"
  JSON="$(cli -C "$PROJ/apps/mobile" prompt get --team team_pay --force --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  if [ "$SEL" = "team" ] && [ "$NAME" = "pay-issue" ]; then pass_test; else
    fail_test "envelope: selection=$SEL name=$NAME (expected team/pay-issue)"
  fi
fi

# Test 11: --force + explicit --team with NO matching rule exits 1 even where a
# location override (and a general default) would otherwise resolve.
if should_run 11; then
  run_test 11 "--force + --team <unmatched> exits 1 despite an in-scope location override"
  cli -C "$PROJ/apps/mobile" prompt get --team team_nope --force >/dev/null 2>&1
  assert_eq "$?" "1" "forced unmatched team exit code (location override bypassed)"
fi

# --- summary ------------------------------------------------------------------
echo ""
echo "=================================================="
echo "  RESULTS"
echo "=================================================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $TOTAL"
echo ""

[ "$FAIL" -eq 0 ]
