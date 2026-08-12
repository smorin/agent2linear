#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="${REPO_ROOT}/dist/index.js"
NODE_BIN="$(node -p 'process.execPath')"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/a2l-comments.XXXXXX")"
trap 'rm -rf "${TEST_ROOT}"' EXIT

export XDG_CONFIG_HOME="${TEST_ROOT}/config"
export XDG_CACHE_HOME="${TEST_ROOT}/cache"
export XDG_STATE_HOME="${TEST_ROOT}/state"
export AGENT2LINEAR_CWD="${TEST_ROOT}/repo"
unset LINEAR_API_KEY AGENT2LINEAR_WORKSPACE
mkdir -p "${XDG_CONFIG_HOME}" "${XDG_CACHE_HOME}" "${XDG_STATE_HOME}" "${AGENT2LINEAR_CWD}"

if [[ ! -f "${CLI}" ]]; then
  echo "built CLI missing: ${CLI}" >&2
  exit 1
fi

help_commands=(
  "issue comment"
  "issue comment add"
  "issue comment list"
  "project comment"
  "project comment add"
  "project comment list"
)
for command in "${help_commands[@]}"; do
  # shellcheck disable=SC2086
  "${NODE_BIN}" "${CLI}" ${command} --help >"${TEST_ROOT}/help.out" 2>"${TEST_ROOT}/help.err"
  grep -q "Usage:" "${TEST_ROOT}/help.out"
  grep -q "Examples:" "${TEST_ROOT}/help.out"
done
grep -q -- "--after <cursor>" "${TEST_ROOT}/help.out"
grep -q -- "--no-cursor-history" "${TEST_ROOT}/help.out"

set +e
"${NODE_BIN}" "${CLI}" issue comment ENG-123 --body "hello world" >"${TEST_ROOT}/legacy.out" 2>"${TEST_ROOT}/legacy.err"
LEGACY_STATUS=$?
"${NODE_BIN}" "${CLI}" issue comment list ENG-123 --limit 0 --json >"${TEST_ROOT}/limit.out" 2>"${TEST_ROOT}/limit.err"
LIMIT_STATUS=$?
"${NODE_BIN}" "${CLI}" issue comment add ENG-123 --body x --json --output table >"${TEST_ROOT}/output.out" 2>"${TEST_ROOT}/output.err"
OUTPUT_STATUS=$?
"${NODE_BIN}" "${CLI}" project comment add nowhere --body x --body-file note.md >"${TEST_ROOT}/xor.out" 2>"${TEST_ROOT}/xor.err"
XOR_STATUS=$?
printf '%s\n' "lin_api_fake" | "${NODE_BIN}" "${CLI}" --api-key-file - issue comment add ENG-123 >"${TEST_ROOT}/stdin-key.out" 2>"${TEST_ROOT}/stdin-key.err"
STDIN_KEY_STATUS=$?
printf '%s\n' "body" | "${NODE_BIN}" "${CLI}" issue comment add malformed >"${TEST_ROOT}/stdin-body.out" 2>"${TEST_ROOT}/stdin-body.err"
STDIN_BODY_STATUS=$?
"${NODE_BIN}" "${CLI}" project comment list nowhere --page 2 >"${TEST_ROOT}/page.out" 2>"${TEST_ROOT}/page.err"
PAGE_STATUS=$?
"${NODE_BIN}" "${CLI}" project comment >"${TEST_ROOT}/group.out" 2>"${TEST_ROOT}/group.err"
GROUP_STATUS=$?
set -e

for status in   "${LEGACY_STATUS}" "${LIMIT_STATUS}" "${OUTPUT_STATUS}" "${XOR_STATUS}"   "${STDIN_KEY_STATUS}" "${STDIN_BODY_STATUS}" "${PAGE_STATUS}" "${GROUP_STATUS}"; do
  [[ "${status}" -eq 2 ]]
done

for output in legacy limit output xor stdin-key stdin-body page group; do
  [[ ! -s "${TEST_ROOT}/${output}.out" ]]
done

grep -Fq "legacy comment syntax has been removed" "${TEST_ROOT}/legacy.err"
grep -Fq "try: a2l issue comment add 'ENG-123' --body 'hello world'" "${TEST_ROOT}/legacy.err"
grep -Fq "stdin cannot supply both --api-key-file - and a comment body" "${TEST_ROOT}/stdin-key.err"
grep -Fq "Invalid issue identifier format" "${TEST_ROOT}/stdin-body.err"
grep -Fq "unknown option '--page'" "${TEST_ROOT}/page.err"
grep -q "Usage: agent2linear project comment" "${TEST_ROOT}/group.err"

"${NODE_BIN}" --input-type=module -e '
  import { readFileSync } from "node:fs";
  for (const path of process.argv.slice(1)) {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value.error.code !== "usage") process.exit(1);
  }
' "${TEST_ROOT}/limit.err" "${TEST_ROOT}/output.err"

echo "comments offline CLI contract: PASS"
