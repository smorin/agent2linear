#!/usr/bin/env bash
#
# End-to-end XDG Base Directory smoke test for agent2linear.
#
# Exercises the REAL built CLI (dist/index.js) to confirm config reads/writes
# honor $XDG_CONFIG_HOME end-to-end:
#   1. A global `config set` lands under $XDG_CONFIG_HOME/agent2linear/.
#   2. A relative (non-absolute) XDG_CONFIG_HOME is ignored and the write
#      falls back to $HOME/.config/agent2linear/ (XDG spec compliance).
#   3. A project-local `.agent2linear/config.json` is written under --project.
#   4. `config get` from a nested subdir walks up and reads the project value.
#
# Hermeticity: this test overrides HOME and XDG_CONFIG_HOME to fresh temp
# directories and cleans them up via `trap ... EXIT`. It never touches the
# real ~/.config. It does NOT require LINEAR_API_KEY: it uses the
# `projectCacheMinTTL` key, which is validated locally (offline) and exercises
# the identical path-resolution write path as API-validated keys.
#
# Note (CLI-syntax adaptation): the task brief's example used
# `config set defaultTeam team_x`, but that key triggers a server-side Linear
# API validation requiring an API key — which violates this test's hermetic,
# offline, no-API-key constraint. `projectCacheMinTTL` is the offline-safe
# substitute that exercises the same setConfigValue(key, value, scope) path code.
#
# Usage:
#   npm run build && bash tests/scripts/test-xdg-paths.sh
#
# Expected: all PASS lines, exit 0.

set -euo pipefail

# --- Locate the built CLI (absolute path, captured before any cd) ---------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_JS="$REPO_ROOT/dist/index.js"
NODE_BIN="$(node -p 'process.execPath')"

if [ ! -f "$CLI_JS" ]; then
  echo "FAIL: built CLI not found at $CLI_JS (run 'npm run build' first)"
  exit 1
fi

# --- Hermetic sandbox: temp HOME + temp XDG dirs, trap-cleaned ------------
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
export HOME="$ROOT/home"
mkdir -p "$HOME"
export XDG_CONFIG_HOME="$ROOT/xdgcfg"
export XDG_CACHE_HOME="$ROOT/xdgcache"
# Neutralize the env declarator so an ambient value can't change selection.
unset AGENT2LINEAR_WORKSPACE 2>/dev/null || true

# Convenience runner for the built CLI.
run_cli() {
  "$NODE_BIN" "$CLI_JS" "$@"
}

fail() {
  echo "FAIL: $1"
  exit 1
}

echo "Sandbox: $ROOT"
echo "  HOME=$HOME"
echo "  XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
echo

# --- Step 1: global write honors $XDG_CONFIG_HOME ------------------------
run_cli config set projectCacheMinTTL 120 --global >/dev/null 2>&1 \
  || fail "global 'config set' exited non-zero"

XDG_CONFIG_FILE="$XDG_CONFIG_HOME/agent2linear/config.json"
test -f "$XDG_CONFIG_FILE" \
  && echo "PASS: global config honored XDG_CONFIG_HOME ($XDG_CONFIG_FILE)" \
  || fail "config not written to XDG_CONFIG_HOME ($XDG_CONFIG_FILE)"

# --- Step 2: relative XDG_CONFIG_HOME ignored -> fall back to ~/.config ---
# Per the XDG spec, a non-absolute XDG_CONFIG_HOME must be ignored. Run this
# from inside the sandbox so that if the fallback ever regressed and wrote
# "relative/path/agent2linear/" relative to cwd, it would land in temp (and
# be trap-cleaned) rather than polluting the repo.
(
  cd "$ROOT"
  XDG_CONFIG_HOME="relative/path" run_cli config set projectCacheMinTTL 60 --global >/dev/null 2>&1
) || fail "'config set' with relative XDG_CONFIG_HOME exited non-zero"

HOME_CONFIG_FILE="$HOME/.config/agent2linear/config.json"
test -f "$HOME_CONFIG_FILE" \
  && echo "PASS: relative XDG_CONFIG_HOME ignored (fell back to ~/.config)" \
  || fail "relative XDG_CONFIG_HOME value not ignored (no file at $HOME_CONFIG_FILE)"

# Negative assertion: nothing should have been written under the literal
# relative path inside the sandbox.
! test -e "$ROOT/relative/path/agent2linear" \
  && echo "PASS: relative path was not created in cwd" \
  || fail "relative XDG_CONFIG_HOME leaked a write to $ROOT/relative/path/agent2linear"

# --- Step 3 & 4: project-local config + nested walk-up read --------------
PROJ="$ROOT/proj"
mkdir -p "$PROJ/.agent2linear" "$PROJ/nested/deep"

# Write a distinct project-scoped value from the project root.
(
  cd "$PROJ"
  run_cli config set projectCacheMinTTL 999 --project >/dev/null 2>&1
) || fail "project 'config set' exited non-zero"

PROJ_CONFIG_FILE="$PROJ/.agent2linear/config.json"
test -f "$PROJ_CONFIG_FILE" \
  && echo "PASS: project config written to .agent2linear/ ($PROJ_CONFIG_FILE)" \
  || fail "project config not written to $PROJ_CONFIG_FILE"

# Read from a nested subdir: should walk up and return the PROJECT value (999),
# not the global value (120).
GET_OUTPUT="$(cd "$PROJ/nested/deep" && run_cli config get projectCacheMinTTL 2>&1)"
echo "$GET_OUTPUT" | grep -q "999" \
  && echo "$GET_OUTPUT" | grep -q "project config" \
  && echo "PASS: nested 'config get' walked up and read project value (999)" \
  || fail "nested 'config get' did not read project value; got: $GET_OUTPUT"

# --- Step 5: workspace registry + offline resolution (multi-workspace P1) -
# Register a project-scoped workspace by piping the key via stdin (--api-key-file -),
# then confirm:
#   a) the gitignored secrets file is written under .agent2linear/
#   b) a .gitignore entry is added for the secrets file
#   c) `workspace current --workspace <name>` reports the right name + source:flag
# All offline — no LINEAR_API_KEY, no network.
WS_PROJ="$ROOT/wsproj"
mkdir -p "$WS_PROJ"

(
  cd "$WS_PROJ"
  echo "lin_api_acmekey" | run_cli workspace add acme --api-key-file - --project >/dev/null 2>&1
) || fail "'workspace add' (project, stdin key) exited non-zero"

WS_SECRETS_FILE="$WS_PROJ/.agent2linear/workspaces.local.json"
test -f "$WS_SECRETS_FILE" \
  && echo "PASS: project workspace secrets written ($WS_SECRETS_FILE)" \
  || fail "project workspace secrets not written to $WS_SECRETS_FILE"

WS_GITIGNORE="$WS_PROJ/.agent2linear/.gitignore"
test -f "$WS_GITIGNORE" && grep -q "workspaces.local.json" "$WS_GITIGNORE" \
  && echo "PASS: .gitignore refreshed for project secrets file" \
  || fail "secrets file not added to .gitignore ($WS_GITIGNORE)"

# Resolve the active workspace offline; must report name acme + source flag.
WS_CURRENT="$(cd "$WS_PROJ" && run_cli --workspace acme workspace current 2>&1)"
echo "$WS_CURRENT" | grep -q "acme" \
  && echo "$WS_CURRENT" | grep -qi "source:.*flag" \
  && echo "PASS: 'workspace current --workspace acme' reports acme + source flag (offline)" \
  || fail "'workspace current' did not report acme/source flag; got: $WS_CURRENT"

# --- Step 6: profile-as-scope defaults resolution (multi-workspace P2) ----
# Define a global profile carrying a defaultTeam, mark it the defaultProfile,
# then confirm `config get defaultTeam` from an unrelated repo resolves the
# value from the profile scope and reports `source: profile`. All offline —
# `profile add` and `config set defaultProfile` make no Linear API calls, and
# `config get` reads without contacting Linear.
run_cli profile add acme --workspace acme --default-team team_offline --global >/dev/null 2>&1 \
  || fail "'profile add' (global) exited non-zero"
run_cli config set defaultProfile acme --global >/dev/null 2>&1 \
  || fail "'config set defaultProfile' exited non-zero"

PROF_REPO="$ROOT/profrepo"
mkdir -p "$PROF_REPO"
PROF_GET="$(cd "$PROF_REPO" && run_cli config get defaultTeam 2>&1)"
echo "$PROF_GET" | grep -q "team_offline" \
  && echo "$PROF_GET" | grep -qi "profile" \
  && echo "PASS: 'config get defaultTeam' resolved from profile (source: profile, offline)" \
  || fail "'config get defaultTeam' did not resolve from profile; got: $PROF_GET"

# --- Step 7: git-remote auto-detection + no-match deny (multi-workspace P3) -
# Add a match rule to the acme profile and a second profile so >=2 exist, then:
#   a) a repo whose origin owner matches auto-resolves (source: auto-detect)
#   b) an unrelated repo under the default deny policy REFUSES (non-zero exit)
# Uses real `git init` + `git remote add origin`; still offline (no Linear calls).
if command -v git >/dev/null 2>&1; then
  run_cli profile match add acme --git-remote-owner acme-co --global >/dev/null 2>&1 \
    || fail "'profile match add' exited non-zero"
  run_cli profile add beta --workspace beta --global >/dev/null 2>&1 \
    || fail "'profile add beta' exited non-zero"

  # (a) matched repo -> auto-detect
  GITREPO_MATCH="$ROOT/gitrepo-acme"
  mkdir -p "$GITREPO_MATCH"
  ( cd "$GITREPO_MATCH" && git init -q && git remote add origin git@github.com:acme-co/widgets.git )
  MATCH_OUT="$(cd "$GITREPO_MATCH" && run_cli workspace current 2>&1)"
  echo "$MATCH_OUT" | grep -q "acme" \
    && echo "$MATCH_OUT" | grep -qi "auto-detect" \
    && echo "PASS: matching origin owner auto-resolves (source: auto-detect)" \
    || fail "auto-detect did not resolve acme; got: $MATCH_OUT"

  # (b) unmatched repo under deny -> refuse with non-zero exit
  GITREPO_NOMATCH="$ROOT/gitrepo-other"
  mkdir -p "$GITREPO_NOMATCH"
  ( cd "$GITREPO_NOMATCH" && git init -q && git remote add origin git@github.com:unrelated-org/repo.git )
  if NOMATCH_OUT="$(cd "$GITREPO_NOMATCH" && run_cli workspace current 2>&1)"; then
    NOMATCH_EXIT=0
  else
    NOMATCH_EXIT=$?
  fi
  { [ "$NOMATCH_EXIT" -ne 0 ] && echo "$NOMATCH_OUT" | grep -qi "no workspace resolved"; } \
    && echo "PASS: unmatched repo under deny refuses with non-zero exit" \
    || fail "unmatched deny did not refuse (exit=$NOMATCH_EXIT); got: $NOMATCH_OUT"
else
  echo "SKIP: git not available — skipping auto-detection step"
fi

# --- Step 8: regression — `profile add --workspace` persists the pointer ---
# The program-level --workspace global SHADOWS the subcommand option, so the
# profile's workspace pointer is sourced from the invocation context. This guards
# against the pointer being silently dropped (which left auto-detected profiles
# with no key to source). Runs the real binary, so it exercises the actual
# Commander parsing where the original bug lived.
run_cli profile add regress --workspace regress-ws-123 --global >/dev/null 2>&1 \
  || fail "'profile add --workspace' exited non-zero"
grep -q 'regress-ws-123' "$XDG_CONFIG_FILE" \
  && echo "PASS: 'profile add --workspace' persisted the workspace pointer (regression)" \
  || fail "profile add dropped the --workspace pointer; not found in $XDG_CONFIG_FILE"

# --- Step 9: named env var + per-profile env-file key sourcing (P4) -------
# A selected workspace sources its key from LINEAR_API_KEY_<NAME> (named env var),
# else the profile's envFile. Verified offline via the masked key value
# (mask = first4 + *** + last3). Uses a fresh XDG dir + empty cwd so earlier
# profiles / any project config don't interfere.
P4XDG="$ROOT/p4xdg"
P4CWD="$ROOT/p4cwd"
mkdir -p "$P4XDG/agent2linear" "$P4CWD"

# (a) named env var supplies the key for a bare --workspace selection
A_OUT="$(cd "$P4CWD" && LINEAR_API_KEY_ENVWS='lin_api_namedenv_eee' XDG_CONFIG_HOME="$P4XDG" \
  run_cli --workspace envws workspace current 2>&1)"
echo "$A_OUT" | grep -q 'eee' \
  && echo "PASS: key sourced from LINEAR_API_KEY_<NAME> (named env var)" \
  || fail "named env var not used; got: $A_OUT"

# (b) per-profile envFile supplies the key when the env var is unset
printf 'LINEAR_API_KEY_EFWS=lin_api_fromfile_fff\n' > "$P4XDG/efws.env"
printf '{ "profiles": { "penv": { "workspace": "efws", "envFile": "%s" } } }\n' \
  "$P4XDG/efws.env" > "$P4XDG/agent2linear/config.json"
B_OUT="$(cd "$P4CWD" && XDG_CONFIG_HOME="$P4XDG" run_cli --workspace penv workspace current 2>&1)"
echo "$B_OUT" | grep -q 'fff' \
  && echo "PASS: key sourced from the profile envFile (source: env-file)" \
  || fail "envFile not used; got: $B_OUT"

# --- Hermeticity assertion: real ~/.config was never touched -------------
# HOME is overridden to temp, so the user's real config dir cannot have been
# created or modified by this run. (Informational: the trap removes $ROOT.)
echo
echo "All XDG path smoke tests passed."
