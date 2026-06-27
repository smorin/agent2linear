#!/usr/bin/env bash
#
# End-to-end smoke test for the M31 `config override` (`config ov`) CLI.
#
# Exercises the REAL built CLI (dist/index.js) to confirm the full authoring
# lifecycle — add → list → get → edit → move → remove — round-trips through
# config.json, and that `config explain` names the winning rule by its LABEL
# (M31 4a) and annotates every rule ✓/✗ for the context (M31 4b lite).
#
# Hermeticity: overrides HOME + XDG dirs to fresh temp directories and cleans them
# up via `trap ... EXIT`. It never touches the real ~/.config and does NOT require
# LINEAR_API_KEY — every command here is an offline read-modify-write or a config
# resolution QUERY. The API-backed alias path is covered by manual verification.
#
# Usage:
#   npm run build && bash tests/scripts/test-config-override-cli.sh
#   bash tests/scripts/test-config-override-cli.sh --range 1-7   # prefix range — stop early
#   bash tests/scripts/test-config-override-cli.sh --test 1      # a self-contained early case
#
# SEQUENTIAL by design: this is a stateful LIFECYCLE suite (add -> list -> get -> edit ->
# move -> remove -> explain) where every case runs in source order against ONE shared
# sandbox (test 1 creates the rule later cases build on). Run the FULL suite, or use
# --range starting at 1 (e.g. --range 1-7) to stop early. `--test N` / `--range A-B` for a
# LATER, non-prefix slice will report false failures because the fixtures created by the
# earlier tests never ran — that is expected, not a bug. (The Vitest unit tests in
# src/**/*.test.ts are the parallel, per-file-isolated suite; see README "Testing".)

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

# A project sandbox with a discoverable .agent2linear/ so `--project` writes land
# under it and `config explain <dir>` resolves the same config.
PROJ="$SANDBOX/proj"
mkdir -p "$PROJ/.agent2linear" "$PROJ/cli/sub" "$PROJ/apps/web"
PROJ_CFG="$PROJ/.agent2linear/config.json"

# Run the CLI from inside the project dir so cwd-based discovery finds it.
cli() { ( cd "$PROJ" && node "$CLI_JS" "$@" ); }

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

echo "=========================================="
echo "M31 config override CLI — smoke"
echo "=========================================="

# 1. add a labeled project rule (round-trips to config.json)
if should_run 1; then
  run_test 1 "add a labeled project rule"
  out="$(cli config ov add cli-team --when-path 'cli/**' --set defaultTeam=cli-eng --project --json 2>&1)"
  assert_contains "$out" '"label": "cli-team"' "add --json label"
fi

# 2. the rule is persisted under the discovered project .agent2linear/
if should_run 2; then
  run_test 2 "add persists under the project config.json"
  assert_contains "$(cat "$PROJ_CFG" 2>&1)" '"id": "cli-team"' "config.json carries the rule"
fi

# 3. dry-run writes nothing
if should_run 3; then
  run_test 3 "--dry-run prints but does not write"
  cli config ov add ghost --when-path 'ghost/**' --set defaultTeam=ghost --project --dry-run >/dev/null 2>&1
  assert_not_contains "$(cat "$PROJ_CFG" 2>&1)" '"id": "ghost"' "dry-run left no trace"
fi

# 4. add a second rule, then list both (context-independent inventory)
if should_run 4; then
  run_test 4 "add a second rule + list shows both with tags"
  cli config ov add apps-team --when-path 'apps/**' --set defaultTeam=apps --project >/dev/null 2>&1
  out="$(cli config ov list --project 2>&1)"
  assert_contains "$out" "cli-team [path]" "list shows cli-team + tier tag"
fi

# 5. list --json emits an ARRAY (the locked array-output convention for list)
if should_run 5; then
  run_test 5 "list --json emits a JSON array"
  out="$(cli config ov list --project --json 2>&1)"
  # A bare-object single-item envelope starts with '{'; the list array starts with '['.
  first="$(printf '%s' "$out" | tr -d '[:space:]' | cut -c1)"
  if [ "$first" = "[" ]; then pass_test; else fail_test "expected a top-level array, got: $out"; fi
fi

# 6. get one rule by label (bare object)
if should_run 6; then
  run_test 6 "get by label returns the full rule"
  out="$(cli config ov get cli-team --project --json 2>&1)"
  assert_contains "$out" '"defaultTeam": "cli-eng"' "get carries the value side"
fi

# 7. apiKey can never be set via an override (structural invariant)
if should_run 7; then
  run_test 7 "--set apiKey=... is rejected"
  if cli config ov add bad --when-path 'x/**' --set apiKey=lin_x --project >/dev/null 2>&1; then
    fail_test "expected --set apiKey to be rejected (exit != 0)"
  else
    pass_test
  fi
fi

# 8. duplicate label in the same scope is hard-blocked
if should_run 8; then
  run_test 8 "duplicate label is hard-blocked"
  if cli config ov add cli-team --when-path 'cli/**' --set defaultTeam=dup --project >/dev/null 2>&1; then
    fail_test "expected a duplicate-label add to fail"
  else
    pass_test
  fi
fi

# 9. edit: merge a new field onto an existing rule
if should_run 9; then
  run_test 9 "edit --set merges a field"
  cli config ov edit cli-team --set defaultInitiative=q3 --project >/dev/null 2>&1
  assert_contains "$(cli config ov get cli-team --project --json 2>&1)" '"defaultInitiative": "q3"' "edit added a field"
fi

# 10. edit: --unset removes a field
if should_run 10; then
  run_test 10 "edit --unset removes a field"
  cli config ov edit cli-team --unset defaultInitiative --project >/dev/null 2>&1
  assert_not_contains "$(cli config ov get cli-team --project --json 2>&1)" "defaultInitiative" "edit removed the field"
fi

# 11. edit: assign a label to a legacy #<index> rule
if should_run 11; then
  run_test 11 "edit assigns a label to an unlabeled rule"
  # Hand-write an unlabeled rule directly into the project config, then label it.
  node -e '
    const fs=require("fs");const p=process.argv[1];
    const c=JSON.parse(fs.readFileSync(p,"utf8"));
    c.overrides.push({when:{path:"legacy/**"},defaultTeam:"legacy-team"});
    fs.writeFileSync(p,JSON.stringify(c,null,2));
  ' "$PROJ_CFG"
  idx=$(node -e 'const c=require(process.argv[1]);console.log(c.overrides.length-1)' "$PROJ_CFG")
  cli config ov edit "#$idx" --id legacy-team --project >/dev/null 2>&1
  assert_contains "$(cli config ov get legacy-team --project --json 2>&1)" '"id": "legacy-team"' "legacy rule is now addressable by label"
fi

# 12. move: reorder a rule within the scope (controls tie-break)
if should_run 12; then
  run_test 12 "move --before reorders the array"
  cli config ov move apps-team --before cli-team --project >/dev/null 2>&1
  # apps-team should now precede cli-team in array order.
  order="$(node -e 'const c=require(process.argv[1]);console.log(c.overrides.map(r=>r.id||"").join(","))' "$PROJ_CFG")"
  case "$order" in
    apps-team,*) pass_test ;;
    *) fail_test "expected apps-team first, got order: $order" ;;
  esac
fi

# 13. remove: delete a rule
if should_run 13; then
  run_test 13 "remove deletes a rule"
  cli config ov rm apps-team --project >/dev/null 2>&1
  assert_not_contains "$(cli config ov list --project 2>&1)" "apps-team" "apps-team gone from list"
fi

# 14. config explain names the winning rule by its LABEL (4a, text)
if should_run 14; then
  run_test 14 "config explain shows the winning rule's label"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" 2>&1)"
  assert_contains "$out" "repo override cli-team" "explain provenance uses the label"
fi

# 15. config explain --json carries ruleId on the resolved field (4a, JSON)
if should_run 15; then
  run_test 15 "config explain --json carries ruleId"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" --json 2>&1)"
  assert_contains "$out" '"ruleId": "cli-team"' "explain --json provenance ruleId"
fi

# 16. config explain annotates EVERY rule ✓/✗ for the context (4b lite, text)
if should_run 16; then
  run_test 16 "config explain lists all rules with ✓/✗ match status"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" 2>&1)"
  assert_contains "$out" "✓ cli-team" "matching rule annotated ✓"
fi

# 17. a non-matching rule is annotated ✗ and echoes its `when` (4b lite)
if should_run 17; then
  run_test 17 "a non-matching rule is annotated ✗ with its when"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" 2>&1)"
  # legacy-team's path (legacy/**) does not match the cli/sub context.
  assert_contains "$out" "✗ legacy-team" "non-matching rule annotated ✗"
fi

# 18. config explain --json carries a top-level rules[] array (4b lite, JSON)
if should_run 18; then
  run_test 18 "config explain --json carries a rules[] array"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" --json 2>&1)"
  ok="$(printf '%s' "$out" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const j=JSON.parse(s);
      const cli=(j.rules||[]).find(r=>r.label==="cli-team");
      process.stdout.write(Array.isArray(j.rules)&&cli&&cli.matched===true&&cli.winsFields.includes("defaultTeam")?"yes":"no");
    });
  ')"
  if [ "$ok" = "yes" ]; then pass_test; else fail_test "rules[] missing/incorrect; got: $out"; fi
fi

# 19. a global rule + list with no scope flag shows BOTH scopes
if should_run 19; then
  run_test 19 "global add + list (no scope) shows both scopes"
  cli config ov add owner-acme --when-owner acme --set defaultTeam=acme-eng --global >/dev/null 2>&1
  out="$(cli config ov list 2>&1)"
  assert_contains "$out" "global overrides:" "list groups the global scope"
fi

# 20. config explain annotates rules from BOTH scopes (cross-scope concat, 4b).
# The global owner:acme rule cannot match the cli/sub context (no git remote there),
# so it is present in rules[] with scope=global, matched=false — exercising the global
# annotation branch + the scope-keyed aggregation alongside the project rules.
if should_run 20; then
  run_test 20 "config explain rules[] spans both scopes (global rule annotated ✗)"
  out="$(node "$CLI_JS" config explain "$PROJ/cli/sub" --json 2>&1)"
  ok="$(printf '%s' "$out" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const j=JSON.parse(s);
      const g=(j.rules||[]).find(r=>r.label==="owner-acme"&&r.scope==="global");
      const p=(j.rules||[]).find(r=>r.scope==="project");
      process.stdout.write(g&&g.matched===false&&g.winsFields.length===0&&p?"yes":"no");
    });
  ')"
  if [ "$ok" = "yes" ]; then pass_test; else fail_test "expected a global+project rules[] span; got: $out"; fi
fi

# 21. a config with NO overrides behaves byte-identically (additivity)
if should_run 21; then
  run_test 21 "a plain (no-overrides) config is unaffected"
  PLAIN="$SANDBOX/plain"; mkdir -p "$PLAIN/.agent2linear"
  echo '{ "defaultTeam": "plain-team" }' > "$PLAIN/.agent2linear/config.json"
  out="$(node "$CLI_JS" config explain "$PLAIN" 2>&1)"
  assert_contains "$out" "(no override rule supplied a value for this context)" "no-overrides explain note"
fi

echo "=========================================="
echo "Passed: $PASS   Failed: $FAIL   Total: $TOTAL"
echo "=========================================="
[ "$FAIL" -eq 0 ]
