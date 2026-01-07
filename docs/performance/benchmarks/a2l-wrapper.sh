#!/bin/bash
#
# Wrapper to run agent2linear (a2l) command
# Uses installed version if available, otherwise uses local build
#

# Try installed a2l first
if command -v a2l &> /dev/null; then
  a2l "$@"
elif command -v agent2linear &> /dev/null; then
  agent2linear "$@"
else
  # Fall back to local build
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
  
  if [ -f "$PROJECT_ROOT/dist/index.js" ]; then
    node "$PROJECT_ROOT/dist/index.js" "$@"
  else
    echo "Error: agent2linear not found" >&2
    echo "Please either:" >&2
    echo "  1. Install globally: npm install -g agent2linear" >&2
    echo "  2. Build locally: npm run build" >&2
    exit 1
  fi
fi
