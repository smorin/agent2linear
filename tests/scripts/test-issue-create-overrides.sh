#!/usr/bin/env bash
#
# Real-API integration test: issue creation driven by M29 context-aware overrides.
#
# Each test CREATES A REAL ISSUE with NO `--team` flag — the team (and, for one case,
# a label) is supplied by an override rule resolved from CONTEXT (path / identity /
# branch / absolute path / ~/-home / symlinked dir / composite / alias overlay / the
# `-C` relative-path-arg fix). A successful create whose identifier carries the team's
# key proves the override supplied a valid team end-to-end.
#
# Requirements:
#   - LINEAR_API_KEY set (creates real issues in the active workspace's first team)
#   - npm run build (dist/index.js)
#
# Hermeticity: CONFIG is hermetic (temp HOME + XDG dirs, trap-cleaned) so the override
# fixtures never touch your real ~/.config. The Linear API is real. There is no
# `issue delete` CLI, so a cleanup LIST is generated (delete via the Linear UI).
#
# Usage:
#   npm run build && LINEAR_API_KEY=lin_api_xxx bash tests/scripts/test-issue-create-overrides.sh
#   ... --test 4      # run only test #4
#   ... --range 1-5   # run tests #1..#5

set -uo pipefail

# --- arg parsing --------------------------------------------------------------
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
should_run() {
  [ -z "$ONLY" ] && return 0
  case "$ONLY" in
    *-*) [ "$1" -ge "${ONLY%-*}" ] && [ "$1" -le "${ONLY#*-}" ] ;;
    *) [ "$1" = "$ONLY" ] ;;
  esac
}

# --- locate CLI + prerequisites ----------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_JS="$REPO_ROOT/dist/index.js"
[ -f "$CLI_JS" ] || { echo "FAIL: built CLI not found at $CLI_JS (run 'npm run build')"; exit 1; }
if [ -z "${LINEAR_API_KEY:-}" ]; then
  echo "ERROR: LINEAR_API_KEY not set (this test creates real issues)"; exit 1
fi

# --- hermetic CONFIG sandbox (real API key preserved) -------------------------
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
SANDBOX_REAL="$(cd "$SANDBOX" && pwd -P)"
mkdir -p "$SANDBOX/home"; export HOME="$(cd "$SANDBOX/home" && pwd -P)"
export XDG_CONFIG_HOME="$SANDBOX/xdg"; export XDG_CACHE_HOME="$SANDBOX/cache"
mkdir -p "$XDG_CONFIG_HOME/agent2linear"
unset AGENT2LINEAR_WORKSPACE 2>/dev/null || true

PREFIX="TEST_ISSUE_OVR_$(date +%Y%m%d_%H%M%S)"
PASS=0; FAIL=0; TOTAL=0
declare -a C_IDENT C_ID C_CASE

pass() { PASS=$((PASS + 1)); echo "  ✓ PASS — $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ FAIL — $1"; }

# Discover the active workspace's first team (workspace-agnostic) + first label.
TEAMS_JSON="$(node "$CLI_JS" teams list --format json 2>/dev/null || echo '[]')"
TEAM_ID="$(printf '%s' "$TEAMS_JSON" | node -e 'const t=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(t[0]?.id||"")')"
TEAM_KEY="$(printf '%s' "$TEAMS_JSON" | node -e 'const t=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(t[0]?.key||"")')"
[ -n "$TEAM_ID" ] || { echo "ERROR: no team found in workspace"; exit 1; }
LABELS_JSON="$(node "$CLI_JS" issue-labels list --team "$TEAM_ID" --json 2>/dev/null || echo '[]')"
LABEL_ID="$(printf '%s' "$LABELS_JSON" | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write((l[0]?.id)||"")')"
echo "Workspace team: $TEAM_KEY ($TEAM_ID); sample label: ${LABEL_ID:-<none>}"
echo "Issue prefix:   $PREFIX"
echo "=========================================="

# create_ovr <num> <case> <context-dir> [extra create args...]
# Creates a real issue with NO --team; asserts the identifier carries $TEAM_KEY
# (i.e., the override supplied a valid team). Returns the captured identifier in REPLY.
create_ovr() {
  local num="$1" case="$2" ctx="$3"; shift 3
  TOTAL=$((TOTAL + 1)); echo "Test $num: $case"
  local out ident id
  out="$(cd "$SANDBOX" && node "$CLI_JS" -C "$ctx" issue create --title "${PREFIX}_${case}" --json -y "$@" 2>/dev/null)"
  ident="$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const i=j.issue||j;process.stdout.write(i.identifier||"")}catch{process.stdout.write("")}})')"
  id="$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const i=j.issue||j;process.stdout.write(i.id||"")}catch{process.stdout.write("")}})')"
  REPLY=""
  if [ -z "$ident" ]; then fail "$case: create produced no issue"; return 1; fi
  C_IDENT+=("$ident"); C_ID+=("$id"); C_CASE+=("$case")
  REPLY="$ident"
  case "$ident" in
    "$TEAM_KEY"-*) pass "$ident created via override-resolved team ($TEAM_KEY)";;
    *) fail "$case: $ident not in expected team $TEAM_KEY";;
  esac
}

git_repo() { # <dir> <branch> <origin-url> [upstream-url]
  git init -q -b "$2" "$1"; git -C "$1" config user.email t@t.co; git -C "$1" config user.name t
  git -C "$1" remote add origin "$3"; [ $# -ge 4 ] && git -C "$1" remote add upstream "$4"
  git -C "$1" commit -q --allow-empty -m init
}

# ===== Fixtures ===============================================================
# Global config: identity + absolute + ~/-home overrides (defaultTeam fallback is bogus).
cat > "$XDG_CONFIG_HOME/agent2linear/config.json" <<EOF
{ "defaultTeam": "bogus-fallback",
  "overrides": [
    { "when": { "owner": "acme" }, "defaultTeam": "$TEAM_ID" },
    { "when": { "path": "$SANDBOX_REAL/abs/**" }, "defaultTeam": "$TEAM_ID" },
    { "when": { "path": "~/home-ovr/**" }, "defaultTeam": "$TEAM_ID" }
  ] }
EOF
mkdir -p "$SANDBOX_REAL/abs/sub" "$HOME/home-ovr/sub"
ln -s "$SANDBOX_REAL/abs" "$SANDBOX/abs-link"

# Monorepo: path override + per-rule label alias overlay under cli/**.
MONO="$SANDBOX/mono"; mkdir -p "$MONO/.agent2linear" "$MONO/cli"
cat > "$MONO/.agent2linear/config.json" <<EOF
{ "defaultTeam": "bogus-fallback",
  "overrides": [
    { "when": { "path": "cli/**" }, "defaultTeam": "$TEAM_ID",
      "aliases": { "issueLabels": { "flag": "${LABEL_ID:-no-label}" } } } ] }
EOF

git_repo "$SANDBOX/ident" main git@github.com:acme/web.git          # identity (global owner:acme)
git_repo "$SANDBOX/branchrepo" release/1.0 git@github.com:x/y.git    # branch
mkdir -p "$SANDBOX/branchrepo/.agent2linear"
echo "{ \"defaultTeam\":\"bogus\", \"overrides\":[ { \"when\":{\"branch\":\"release/*\"}, \"defaultTeam\":\"$TEAM_ID\" } ] }" > "$SANDBOX/branchrepo/.agent2linear/config.json"
git_repo "$SANDBOX/fork" main git@github.com:myuser/web.git git@github.com:acme/web.git  # fork anyOf
mkdir -p "$SANDBOX/fork/.agent2linear"
echo "{ \"overrides\":[ { \"when\":{\"anyOf\":[{\"owner\":\"acme\"},{\"remote\":\"upstream\",\"owner\":\"acme\"}]}, \"defaultTeam\":\"$TEAM_ID\" } ] }" > "$SANDBOX/fork/.agent2linear/config.json"

# Relative --description-file fixture (§5.7 -C rebasing).
RELF="$SANDBOX/relf"; mkdir -p "$RELF/.agent2linear"
echo "{ \"defaultTeam\":\"$TEAM_ID\" }" > "$RELF/.agent2linear/config.json"
printf 'Body read from a RELATIVE --description-file under the -C dir.\n' > "$RELF/spec.md"

# ===== Tests =================================================================
should_run 1 && create_ovr 1 "path"     "$MONO/cli"
should_run 2 && create_ovr 2 "identity" "$SANDBOX/ident"
should_run 3 && create_ovr 3 "branch"   "$SANDBOX/branchrepo"
should_run 4 && create_ovr 4 "abs"      "$SANDBOX_REAL/abs/sub"
should_run 5 && create_ovr 5 "home"     "$HOME/home-ovr/sub"
should_run 6 && create_ovr 6 "symlink"  "$SANDBOX/abs-link/sub"
should_run 7 && create_ovr 7 "anyOf"    "$SANDBOX/fork"

# 8. alias overlay: --labels <alias> remapped to a real label under cli/**; verify label on read-back.
if should_run 8; then
  if [ -n "$LABEL_ID" ]; then
    create_ovr 8 "label_overlay" "$MONO/cli" --labels flag
    if [ -n "$REPLY" ]; then
      got="$(node "$CLI_JS" issue view "$REPLY" --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const i=j.issue||j;process.stdout.write((i.labels||[]).map(l=>l.id||l).join(","))}catch{process.stdout.write("")}})')"
      case "$got" in *"$LABEL_ID"*) pass "label overlay applied ($REPLY has the mapped label)";; *) fail "label overlay: $REPLY labels=[$got] missing $LABEL_ID";; esac
      TOTAL=$((TOTAL + 1))
    fi
  else
    echo "Test 8: label_overlay — SKIPPED (no labels in workspace)"
  fi
fi

# 9. -C rebases a RELATIVE --description-file (§5.7): a successful create proves the
#    file was read from the -C dir (a missing file would abort the create).
should_run 9 && create_ovr 9 "relfile" "$RELF" --description-file spec.md

echo "=========================================="
echo "Passed: $PASS   Failed: $FAIL   Total: $TOTAL"
echo "=========================================="

# ===== Cleanup list ==========================================================
CLEAN="cleanup-issue-create-overrides.sh"
{
  echo "#!/usr/bin/env bash"
  echo "# Auto-generated $(date) — M29 override issue-create test created these REAL issues."
  echo "# No 'issue delete' CLI exists; delete via the Linear web UI."
  echo "echo 'Test issues created by test-issue-create-overrides.sh:'"
  for i in "${!C_IDENT[@]}"; do
    echo "echo '  ${C_IDENT[$i]}  (${C_CASE[$i]})  id=${C_ID[$i]}'"
  done
} > "$SCRIPT_DIR/$CLEAN"
chmod +x "$SCRIPT_DIR/$CLEAN"
echo "Cleanup list: $SCRIPT_DIR/$CLEAN  (${#C_IDENT[@]} issues — delete via Linear UI)"

[ "$FAIL" -eq 0 ]
