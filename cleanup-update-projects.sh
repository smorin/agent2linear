#!/bin/bash
#
# Auto-generated cleanup script for test projects
# Generated: $(date)
#
# This script will help you delete test projects created during testing.
# Review the list below and run this script to clean them up.
#

set -e

# Projects created: 0

PROJECTS=(
)


echo "=========================================="
echo "  CLEANUP TEST PROJECTS"
echo "=========================================="
echo "This will delete ${#PROJECTS[@]} test projects"
echo ""
echo "Projects to delete:"
for i in "${!PROJECTS[@]}"; do
    echo "  $((i+1)). ${PROJECTS[$i]}"
done
echo ""
read -p "Continue with deletion? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting projects..."
DELETED=0
FAILED=0

for project_id in "${PROJECTS[@]}"; do
    echo -n "Deleting $project_id... "

    # Note: You'll need to implement project delete command or use Linear UI
    # For now, this just lists the IDs
    echo "⚠️  DELETE NOT IMPLEMENTED - Please delete via Linear UI"
    echo "   Project URL: https://linear.app/project/$project_id"

    # Uncomment when delete command is available:
    # if node dist/index.js project delete "$project_id" --yes 2>/dev/null; then
    #     echo "✅ Deleted"
    #     ((DELETED++))
    # else
    #     echo "❌ Failed"
    #     ((FAILED++))
    # fi
done

echo ""
echo "=========================================="
echo "Deletion Summary:"
echo "  Total:   ${#PROJECTS[@]}"
echo "  Deleted: $DELETED"
echo "  Failed:  $FAILED"
echo "=========================================="
