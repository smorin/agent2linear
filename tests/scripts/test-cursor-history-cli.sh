#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="${REPO_ROOT}/dist/index.js"
NODE_BIN="$(node -p 'process.execPath')"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/a2l-cursor-history.XXXXXX")"
trap 'rm -rf "${TEST_ROOT}"' EXIT

export HOME="${TEST_ROOT}/home"
export XDG_CONFIG_HOME="${TEST_ROOT}/config"
export XDG_CACHE_HOME="${TEST_ROOT}/cache"
export XDG_STATE_HOME="${TEST_ROOT}/state"
unset LINEAR_API_KEY AGENT2LINEAR_WORKSPACE AGENT2LINEAR_CWD

if [[ ! -f "${CLI}" ]]; then
  echo "built CLI missing: ${CLI}" >&2
  exit 1
fi

HISTORY_DIR="${XDG_STATE_HOME}/agent2linear"
HISTORY_FILE="${HISTORY_DIR}/cursor-history.json"
mkdir -p "${HISTORY_DIR}"
chmod 700 "${HISTORY_DIR}"

ENTRY_ID="00000000-0000-4000-8000-000000000001"
"${NODE_BIN}" --input-type=module -e '
  import { writeFileSync } from "node:fs";
  const [path, id] = process.argv.slice(1);
  const entry = {
    id,
    cursor: "raw cursor /+=🙂",
    createdAt: "2026-07-24T12:00:00.000Z",
    workspace: { key: "safe-hash", id: null, name: "ConceptM" },
    commandPath: "issue list",
    resource: "issue",
    target: null,
    filters: { team: "ENG" },
    orderBy: "priority:desc",
    limit: 50,
    sourceCommand: "a2l issue list --team '\''ENG'\'' --limit '\''50'\''",
    nextCommand: "a2l issue list --team '\''ENG'\'' --limit '\''50'\'' --after '\''raw cursor /+=🙂'\''",
    allRemainingCommand: "a2l issue list --team '\''ENG'\'' --after '\''raw cursor /+=🙂'\'' --all"
  };
  writeFileSync(path, JSON.stringify({ version: 1, entries: [entry] }) + "\n", { mode: 0o600 });
' "${HISTORY_FILE}" "${ENTRY_ID}"

"${NODE_BIN}" "${CLI}" cursor-history list --json >"${TEST_ROOT}/list.json" 2>"${TEST_ROOT}/list.err"
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  const value = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (value.returnedCount !== 1 || value.retainedCount !== 1 || value.entries[0].id !== process.argv[2]) process.exit(1);
' "${TEST_ROOT}/list.json" "${ENTRY_ID}"
[[ ! -s "${TEST_ROOT}/list.err" ]]

"${NODE_BIN}" "${CLI}" cursor-history view "${ENTRY_ID}" --output json >"${TEST_ROOT}/view.json" 2>"${TEST_ROOT}/view.err"
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  const value = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (value.cursor !== "raw cursor /+=🙂") process.exit(1);
' "${TEST_ROOT}/view.json"
[[ ! -s "${TEST_ROOT}/view.err" ]]

"${NODE_BIN}" "${CLI}" cursor-history clear --dry-run --json >"${TEST_ROOT}/dry.json" 2>"${TEST_ROOT}/dry.err"
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  const value = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (!value.ok || !value.dryRun || value.deletedCount !== 1) process.exit(1);
' "${TEST_ROOT}/dry.json"
[[ -f "${HISTORY_FILE}" ]]

set +e
"${NODE_BIN}" "${CLI}" cursor-history list --limit 1.5 --json >"${TEST_ROOT}/bad.out" 2>"${TEST_ROOT}/bad.err"
BAD_STATUS=$?
"${NODE_BIN}" "${CLI}" cursor-history clear --no-input --json >"${TEST_ROOT}/consent.out" 2>"${TEST_ROOT}/consent.err"
CONSENT_STATUS=$?
"${NODE_BIN}" "${CLI}" cursor-history >"${TEST_ROOT}/group.out" 2>"${TEST_ROOT}/group.err"
GROUP_STATUS=$?
set -e

[[ "${BAD_STATUS}" -eq 2 ]]
[[ "${CONSENT_STATUS}" -eq 2 ]]
[[ "${GROUP_STATUS}" -eq 2 ]]
[[ ! -s "${TEST_ROOT}/bad.out" ]]
[[ ! -s "${TEST_ROOT}/consent.out" ]]
[[ ! -s "${TEST_ROOT}/group.out" ]]
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  for (const path of process.argv.slice(1)) {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value.error.code !== "usage") process.exit(1);
  }
' "${TEST_ROOT}/bad.err" "${TEST_ROOT}/consent.err"
grep -q "Usage: agent2linear cursor-history" "${TEST_ROOT}/group.err"

"${NODE_BIN}" "${CLI}" cursor-history clear --yes --json >"${TEST_ROOT}/clear.json" 2>"${TEST_ROOT}/clear.err"
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  const value = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (!value.ok || value.dryRun || value.deletedCount !== 1) process.exit(1);
' "${TEST_ROOT}/clear.json"
[[ ! -e "${HISTORY_FILE}" ]]
[[ ! -s "${TEST_ROOT}/clear.err" ]]

"${NODE_BIN}" "${CLI}" cursor-history list --json >"${TEST_ROOT}/empty.json" 2>"${TEST_ROOT}/empty.err"
"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  const value = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (value.returnedCount !== 0 || value.retainedCount !== 0) process.exit(1);
' "${TEST_ROOT}/empty.json"

echo "cursor-history offline lifecycle: PASS"
