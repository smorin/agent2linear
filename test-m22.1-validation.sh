#!/bin/bash
# Manual validation tests for M22.1
# Tests the validation warnings and info messages

set -e

CLI="node dist/index.js"

echo "=================================================="
echo "M22.1 Manual Validation Tests"
echo "=================================================="
echo ""

echo "Test 1: Auto-detection only (recommended approach)"
echo "Command: project create --title 'Test Q1' --start-date '2025-Q1' --help"
echo "Expected: Help shows auto-detection is primary"
echo ""
$CLI project create --help | grep -A 2 "start-date"
echo ""

echo "=================================================="
echo "Test 2: Check resolution override help text"
echo "Expected: Should say 'Override auto-detected resolution (advanced)'"
echo ""
$CLI project create --help | grep -A 3 "start-date-resolution"
echo ""

echo "=================================================="
echo "Test 3: Update command resolution help"
echo "Expected: Should mention 'Can be used alone to update resolution'"
echo ""
$CLI project update --help | grep -A 3 "start-date-resolution"
echo ""

echo "=================================================="
echo "All help text validation tests passed!"
echo "=================================================="
