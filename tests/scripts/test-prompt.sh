#!/usr/bin/env bash
#
# End-to-end smoke test for M30 configurable prompt templates (Phases 1-2).
#
# Exercises the REAL built CLI (dist/index.js) to confirm the general prompt
# skeleton: `config set defaultPrompt` (valid + unknown-name rejection),
# `prompt get` (raw + --json), `prompt get <name>` exact lookup, the
# unknown-name / no-prompt-configured errors (exit 1), and that
# `config get/list` surface `defaultPrompt`.
#
# Phase 2 (tests 14-17): location-aware selection — `defaultPrompt` resolved by
# an `overrides[]` path rule, so `prompt get -C <subdir>` returns the location
# prompt, `-C <repo-root>` the general one, and `config explain` shows it.
#
# Hermeticity: overrides HOME + XDG dirs to fresh temp directories and cleans
# them up via `trap ... EXIT`. It never touches the real ~/.config and does NOT
# require LINEAR_API_KEY — every command here is offline (no Linear API call).
#
# Usage:
#   npm run build && bash tests/scripts/test-prompt.sh
#   bash tests/scripts/test-prompt.sh --test 5
#   bash tests/scripts/test-prompt.sh --range 3-7

set -uo pipefail

# --- arg parsing: optional --test N / --range A-B ------------------------------
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --test|--range)
      if [ $# -lt 2 ]; then
        echo "Error: $1 requires a value (e.g. --test 5 or --range 3-7)" >&2
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
unset LINEAR_API_KEY 2>/dev/null || true

cli() { node "$CLI_JS" "$@"; }

# --- fixtures -----------------------------------------------------------------
# Global prompts.json: one inline body + one bodyFile (relative, anchored to the
# declaring prompts.json directory).
mkdir -p "$XDG_CONFIG_HOME/agent2linear/prompts"
cat > "$XDG_CONFIG_HOME/agent2linear/prompts.json" <<'EOF'
{
  "prompts": {
    "general": { "description": "Default issue prompt", "body": "## Title\nWrite a clear title.\n" },
    "payments-issue": { "description": "Payments convention", "bodyFile": "prompts/payments.md" }
  }
}
EOF
printf '# Payments Issue\n\nFollow the payments convention.\n' \
  > "$XDG_CONFIG_HOME/agent2linear/prompts/payments.md"

# --- counters + helpers -------------------------------------------------------
PASS=0; FAIL=0; TOTAL=0
run_test() { TOTAL=$((TOTAL + 1)); echo "Test $1: $2"; }
pass_test() { PASS=$((PASS + 1)); echo "  ✓ PASS"; }
fail_test() { FAIL=$((FAIL + 1)); echo "  ✗ FAIL: $1"; }
assert_contains() { # haystack needle msg
  if printf '%s' "$1" | grep -qF "$2"; then pass_test; else fail_test "$3 — expected to contain '$2', got: $1"; fi
}
assert_not_contains() { # haystack needle msg
  if printf '%s' "$1" | grep -qF "$2"; then fail_test "$3 — did NOT expect '$2', got: $1"; else pass_test; fi
}
assert_eq() { # actual expected msg
  if [ "$1" = "$2" ]; then pass_test; else fail_test "$3 — expected '$2', got '$1'"; fi
}

echo "=================================================="
echo "  M30 PROMPT TEMPLATES — Phases 1-2 (offline smoke)"
echo "=================================================="
echo ""

# Test 1: prompt list shows both authored prompts (stdout).
if should_run 1; then
  run_test 1 "prompt list shows authored prompt names"
  OUT="$(cli prompt list 2>/dev/null)"
  if printf '%s' "$OUT" | grep -qF 'general' && printf '%s' "$OUT" | grep -qF 'payments-issue'; then
    pass_test
  else
    fail_test "expected 'general' and 'payments-issue' in: $OUT"
  fi
fi

# Test 2: prompt get <name> (inline body) emits raw markdown to stdout.
if should_run 2; then
  run_test 2 "prompt get general — raw inline body"
  OUT="$(cli prompt get general 2>/dev/null)"
  assert_contains "$OUT" "## Title" "raw inline body"
fi

# Test 3: prompt get <name> (bodyFile) emits the file's markdown.
if should_run 3; then
  run_test 3 "prompt get payments-issue — bodyFile body"
  OUT="$(cli prompt get payments-issue 2>/dev/null)"
  assert_contains "$OUT" "Follow the payments convention." "bodyFile body"
fi

# Test 4: unknown name → error, exit 1.
if should_run 4; then
  run_test 4 "prompt get <unknown> exits 1"
  cli prompt get does-not-exist >/dev/null 2>&1
  assert_eq "$?" "1" "unknown name exit code"
fi

# Test 5: no defaultPrompt configured → error, exit 1.
if should_run 5; then
  run_test 5 "prompt get with no defaultPrompt exits 1"
  cli prompt get >/dev/null 2>&1
  assert_eq "$?" "1" "no-prompt-configured exit code"
fi

# Test 6: config set defaultPrompt <valid> succeeds.
if should_run 6; then
  run_test 6 "config set defaultPrompt general (valid)"
  cli config set defaultPrompt general >/dev/null 2>&1
  assert_eq "$?" "0" "valid set exit code"
fi

# Test 7: config set defaultPrompt <unknown> is rejected (exit 1).
if should_run 7; then
  run_test 7 "config set defaultPrompt <unknown> exits 1"
  cli config set defaultPrompt no-such-prompt >/dev/null 2>&1
  assert_eq "$?" "1" "unknown set exit code"
fi

# Test 8: with defaultPrompt set, bare `prompt get` returns the general body.
if should_run 8; then
  run_test 8 "prompt get (general default) emits the configured body"
  OUT="$(cli prompt get 2>/dev/null)"
  assert_contains "$OUT" "## Title" "general default body"
fi

# Test 9: --json emits a single envelope with the expected shape.
if should_run 9; then
  run_test 9 "prompt get --json envelope shape (jq)"
  JSON="$(cli prompt get --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  SRC="$(printf '%s' "$JSON" | jq -r '.source')"
  HASBODY="$(printf '%s' "$JSON" | jq -r 'has("body")')"
  if [ "$SEL" = "general" ] && [ "$NAME" = "general" ] && [ "$SRC" = "global" ] && [ "$HASBODY" = "true" ]; then
    pass_test
  else
    fail_test "envelope: selection=$SEL name=$NAME source=$SRC hasBody=$HASBODY"
  fi
fi

# Test 10: prompt get <name> --json reports selection=explicit.
if should_run 10; then
  run_test 10 "prompt get <name> --json selection=explicit"
  JSON="$(cli prompt get payments-issue --json 2>/dev/null)"
  SEL="$(printf '%s' "$JSON" | jq -r '.selection')"
  assert_eq "$SEL" "explicit" "explicit selection"
fi

# Test 11: config get defaultPrompt surfaces the value.
if should_run 11; then
  run_test 11 "config get defaultPrompt surfaces the value"
  OUT="$(cli config get defaultPrompt 2>/dev/null)"
  assert_contains "$OUT" "general" "config get value"
fi

# Test 12: config list surfaces a Default Prompt row.
if should_run 12; then
  run_test 12 "config list shows the Default Prompt row"
  OUT="$(cli config list 2>/dev/null)"
  assert_contains "$OUT" "Default Prompt:" "config list row"
fi

# Test 13: --json error path emits nothing on stdout and exits 1.
if should_run 13; then
  run_test 13 "prompt get <unknown> --json: empty stdout, exit 1"
  STDOUT="$(cli prompt get does-not-exist --json 2>/dev/null)"; CODE=$?
  if [ -z "$STDOUT" ] && [ "$CODE" = "1" ]; then
    pass_test
  else
    fail_test "expected empty stdout + exit 1, got stdout='$STDOUT' exit=$CODE"
  fi
fi

# ==============================================================================
#  Phase 2 — location-aware selection (defaultPrompt via overrides[])
# ==============================================================================
# A project repo whose .agent2linear/config.json sets a general defaultPrompt
# plus a path-scoped override. The project prompts.json provides both bodies.
# `prompt get -C <subdir>` must return the location prompt; `-C <repo-root>`
# the general one; and `config explain <subdir>` must surface the override.
PROJ="$SANDBOX/proj"
mkdir -p "$PROJ/.agent2linear" "$PROJ/apps/mobile"
cat > "$PROJ/.agent2linear/config.json" <<'EOF'
{
  "defaultPrompt": "general",
  "overrides": [
    { "when": { "path": "apps/mobile/**" }, "defaultPrompt": "mobile-issue" }
  ]
}
EOF
cat > "$PROJ/.agent2linear/prompts.json" <<'EOF'
{
  "prompts": {
    "general": { "body": "## General Issue\nWrite a clear title.\n" },
    "mobile-issue": { "body": "## Mobile Issue\nDescribe device + OS version.\n" }
  }
}
EOF

# Test 14: prompt get -C <subdir> returns the path-override (location) prompt.
if should_run 14; then
  run_test 14 "prompt get -C <subdir> returns the location prompt"
  OUT="$(cli -C "$PROJ/apps/mobile" prompt get 2>/dev/null)"
  assert_contains "$OUT" "## Mobile Issue" "location prompt body"
fi

# Test 15: prompt get -C <repo-root> returns the general prompt.
if should_run 15; then
  run_test 15 "prompt get -C <repo-root> returns the general prompt"
  OUT="$(cli -C "$PROJ" prompt get 2>/dev/null)"
  if printf '%s' "$OUT" | grep -qF "## General Issue" && ! printf '%s' "$OUT" | grep -qF "## Mobile Issue"; then
    pass_test
  else
    fail_test "expected general (not mobile) body, got: $OUT"
  fi
fi

# Test 16: --json at the subdir reports name=mobile-issue (override-resolved).
if should_run 16; then
  run_test 16 "prompt get -C <subdir> --json resolves the override name"
  JSON="$(cli -C "$PROJ/apps/mobile" prompt get --json 2>/dev/null)"
  NAME="$(printf '%s' "$JSON" | jq -r '.name')"
  assert_eq "$NAME" "mobile-issue" "override-resolved prompt name"
fi

# Test 17: config explain <subdir> shows defaultPrompt resolved by the override.
if should_run 17; then
  run_test 17 "config explain <subdir> shows the defaultPrompt override"
  JSON="$(cli config explain "$PROJ/apps/mobile" --json 2>/dev/null)"
  VAL="$(printf '%s' "$JSON" | jq -r '.resolved.defaultPrompt.value')"
  SRC="$(printf '%s' "$JSON" | jq -r '.resolved.defaultPrompt.source')"
  if [ "$VAL" = "mobile-issue" ] && [ "$SRC" = "override" ]; then
    pass_test
  else
    fail_test "explain defaultPrompt: value=$VAL source=$SRC"
  fi
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
