#!/usr/bin/env bash
#
# End-to-end smoke test for M29 context-aware config overrides.
#
# Exercises the REAL built CLI (dist/index.js) to confirm `overrides[]` resolve by
# context — path, repo identity (origin), branch, the `-C/--cwd` lever +
# AGENT2LINEAR_CWD, and `config explain` / `config get [dir]` provenance.
#
# Hermeticity: overrides HOME + XDG dirs to fresh temp directories and cleans them
# up via `trap ... EXIT`. It never touches the real ~/.config and does NOT require
# LINEAR_API_KEY — every command here is a config-resolution QUERY (offline). The
# API-backed default-team→alias path is covered by manual verification.
#
# Usage:
#   npm run build && bash tests/scripts/test-config-overrides.sh
#   bash tests/scripts/test-config-overrides.sh --test 5
#   bash tests/scripts/test-config-overrides.sh --range 3-7

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
# Canonical (realpath) sandbox path: the resolver realpath-canonicalizes the context
# dir before matching (§5.7), so an ABSOLUTE `path` pattern must be written canonically
# too (on macOS /var -> /private/var). Relative patterns are unaffected.
SANDBOX_REAL="$(cd "$SANDBOX" && pwd -P)"
# HOME stays the raw (symlinked, on macOS /var->/private/var) temp path on purpose:
# the resolver canonicalizes $HOME for `~/` patterns, so test 17 matches even here.
export HOME="$SANDBOX/home"; mkdir -p "$HOME"
export XDG_CONFIG_HOME="$SANDBOX/xdgcfg"
export XDG_CACHE_HOME="$SANDBOX/xdgcache"
unset AGENT2LINEAR_WORKSPACE 2>/dev/null || true
unset LINEAR_API_KEY 2>/dev/null || true

cli() { node "$CLI_JS" "$@"; }

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

# --- fixtures -----------------------------------------------------------------
# Global config: a coarse identity fallback + a disk-absolute scratch rule.
mkdir -p "$XDG_CONFIG_HOME/agent2linear"
cat > "$XDG_CONFIG_HOME/agent2linear/config.json" <<EOF
{
  "overrides": [
    { "when": { "owner": "acme" }, "defaultTeam": "acme-eng" },
    { "when": { "path": "$SANDBOX_REAL/scratch/**" }, "defaultTeam": "personal" },
    { "when": { "path": "~/scratch-home/**" }, "defaultTeam": "home-team" }
  ]
}
EOF
mkdir -p "$SANDBOX/scratch/proj" "$HOME/scratch-home/proj"
# Symlink whose real target is under the /-absolute pattern above (canonicalization test).
ln -s "$SANDBOX_REAL/scratch" "$SANDBOX/scratch-link"

# A monorepo with path overrides (no git remote needed for path rules).
MONO="$SANDBOX/mono"
mkdir -p "$MONO/.agent2linear" "$MONO/cli/sub" "$MONO/apps/web/src" "$MONO/apps/sandbox"
cat > "$MONO/.agent2linear/config.json" <<'EOF'
{
  "defaultTeam": "platform",
  "defaultInitiative": "q3",
  "overrides": [
    { "when": { "path": "cli/**" }, "defaultTeam": "cli-team" },
    { "when": { "path": "apps/web/**" }, "defaultTeam": "web-team" },
    { "when": { "allOf": [ { "path": "apps/**" }, { "not": { "path": "apps/sandbox/**" } } ] }, "defaultInitiative": "apps-init" }
  ]
}
EOF

# A git repo for identity + branch matching (origin owner = acme).
GITREPO="$SANDBOX/acme-web"
git init -q -b release/1.0 "$GITREPO"
git -C "$GITREPO" config user.email t@t.co
git -C "$GITREPO" config user.name t
git -C "$GITREPO" remote add origin git@github.com:acme/web.git
git -C "$GITREPO" commit -q --allow-empty -m init
mkdir -p "$GITREPO/.agent2linear"
cat > "$GITREPO/.agent2linear/config.json" <<'EOF'
{
  "overrides": [
    { "when": { "branch": "release/*" }, "defaultInitiative": "hardening" }
  ]
}
EOF

echo "=========================================="
echo "M29 context-aware config overrides — smoke"
echo "=========================================="

# 1. path override under cli/**
if should_run 1; then
  run_test 1 "path override: cli/** -> cli-team"
  assert_contains "$(cli -C "$MONO/cli/sub" config get defaultTeam 2>&1)" "cli-team" "cli subtree"
fi

# 2. different path subtree
if should_run 2; then
  run_test 2 "path override: apps/web/** -> web-team"
  assert_contains "$(cli -C "$MONO/apps/web/src" config get defaultTeam 2>&1)" "web-team" "apps/web subtree"
fi

# 3. catch-all fallback at repo root
if should_run 3; then
  run_test 3 "repo root falls back to top-level (platform)"
  assert_contains "$(cli -C "$MONO" config get defaultTeam 2>&1)" "platform" "repo root catch-all"
fi

# 4. field inheritance: defaultInitiative still resolves from a different rule
if should_run 4; then
  run_test 4 "field inheritance: apps/** (not sandbox) -> apps-init"
  assert_contains "$(cli -C "$MONO/apps/web/src" config get defaultInitiative 2>&1)" "apps-init" "apps-init via allOf/not"
fi

# 5. not-exclusion: apps/sandbox is excluded from the apps-init rule
if should_run 5; then
  run_test 5 "not-exclusion: apps/sandbox keeps the catch-all initiative"
  assert_contains "$(cli -C "$MONO/apps/sandbox" config get defaultInitiative 2>&1)" "q3" "sandbox excluded -> q3"
fi

# 6. AGENT2LINEAR_CWD honored
if should_run 6; then
  run_test 6 "AGENT2LINEAR_CWD honored"
  assert_contains "$(AGENT2LINEAR_CWD="$MONO/cli" cli config get defaultTeam 2>&1)" "cli-team" "env cwd"
fi

# 7. --cwd beats AGENT2LINEAR_CWD (§5.7)
if should_run 7; then
  run_test 7 "--cwd beats AGENT2LINEAR_CWD"
  assert_contains "$(AGENT2LINEAR_CWD="$MONO" cli -C "$MONO/cli" config get defaultTeam 2>&1)" "cli-team" "flag wins"
fi

# 8. config explain [dir] (positional) shows the winning override
if should_run 8; then
  run_test 8 "config explain shows the winning override"
  assert_contains "$(cli config explain "$MONO/cli" 2>&1)" "repo override" "explain provenance"
fi

# 9. config explain --json is valid + carries the override source
if should_run 9; then
  run_test 9 "config explain --json carries override source"
  out="$(cli config explain "$MONO/cli" --json 2>&1)"
  assert_contains "$out" "\"source\": \"override\"" "json override source"
fi

# 10. absolute disk override (~/-style absolute path)
if should_run 10; then
  run_test 10 "absolute disk path override -> personal"
  assert_contains "$(cli -C "$SANDBOX/scratch/proj" config get defaultTeam 2>&1)" "personal" "scratch disk match"
fi

# 11. identity override via origin owner (global rule, git repo)
if should_run 11; then
  run_test 11 "identity: global owner:acme -> acme-eng (via origin)"
  assert_contains "$(cli -C "$GITREPO" config get defaultTeam 2>&1)" "acme-eng" "origin owner identity"
fi

# 12. branch override (release/* -> hardening)
if should_run 12; then
  run_test 12 "branch: release/* -> hardening"
  assert_contains "$(cli -C "$GITREPO" config get defaultInitiative 2>&1)" "hardening" "branch match"
fi

# 13. config explain shows the git remotes block
if should_run 13; then
  run_test 13 "config explain shows remotes + branch"
  out="$(cli config explain "$GITREPO" 2>&1)"
  assert_contains "$out" "acme/web" "remotes block"
fi

# 14. -C on a missing dir is a hard error (execute mode, §9)
if should_run 14; then
  run_test 14 "-C missing dir hard-errors (exit != 0)"
  if cli -C "$SANDBOX/nope" config get defaultTeam >/dev/null 2>&1; then
    fail_test "expected non-zero exit for a missing -C dir"
  else
    pass_test
  fi
fi

# 15. no-overrides repo behaves exactly as a plain config
if should_run 15; then
  run_test 15 "no-overrides config is unaffected"
  PLAIN="$SANDBOX/plain"; mkdir -p "$PLAIN/.agent2linear"
  echo '{ "defaultTeam": "plain-team" }' > "$PLAIN/.agent2linear/config.json"
  assert_contains "$(cli -C "$PLAIN" config get defaultTeam 2>&1)" "plain-team" "plain config"
fi

# 16. git-style -C chdir: cwd-relative ops (a project config write) follow -C (§5.7).
# Offline proxy for relative path-arg rebasing: `config set --project` writes under the
# write-target dir, which is cwd-based — so with -C it must land under <dir>, not $PWD.
if should_run 16; then
  run_test 16 "-C rebases cwd: config set --project writes under <dir>"
  CW="$SANDBOX/chdirproj"; mkdir -p "$CW"
  ( cd "$SANDBOX" && cli -C "$CW" config set --project projectCacheMinTTL 120 >/dev/null 2>&1 )
  if [ -f "$CW/.agent2linear/config.json" ]; then pass_test; else fail_test "expected $CW/.agent2linear/config.json to be written under the -C dir"; fi
fi

# 17. absolute `~/`-home pattern: expands via $HOME and matches a dir under it (§5.3).
if should_run 17; then
  run_test 17 "~/ home-absolute path override -> home-team"
  assert_contains "$(cli -C "$HOME/scratch-home/proj" config get defaultTeam 2>&1)" "home-team" "~/ home expansion"
fi

# 18. symlinked context dir is realpath-canonicalized before matching an absolute pattern (§5.7/§9).
if should_run 18; then
  run_test 18 "symlinked -C dir canonicalizes to match a /-absolute pattern"
  assert_contains "$(cli -C "$SANDBOX/scratch-link/proj" config get defaultTeam 2>&1)" "personal" "symlink -> real abs path"
fi

echo "=========================================="
echo "Passed: $PASS   Failed: $FAIL   Total: $TOTAL"
echo "=========================================="
[ "$FAIL" -eq 0 ]
