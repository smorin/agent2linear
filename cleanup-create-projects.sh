#!/bin/bash
#
# Auto-generated cleanup script for test projects
# Generated: $(date)
#
# This script will help you delete test projects created during testing.
# Review the list below and run this script to clean them up.
#

set -e

# Projects created: 40

PROJECTS=(
    "fa443d6c-ad10-41bd-9bad-fffefd7046e6"  # 1. Basic: Minimal (title + team)
    "0dcb83a3-c4b4-450d-8b9f-ffb11946f427"  # 2. Basic: With description
    "7f7324c5-d3a4-49d1-a3f8-e5a65a985fef"  # 3. Basic: With initiative
    "0f418999-5ceb-49f8-8a4d-3e149fbb09dc"  # 4. Basic: Title + team + description combined
    "cb53f2d2-42b2-4e9d-adb1-56763951e7da"  # 5. Alias: Team via alias
    "3b8fe022-a56e-4ba4-85f1-d86a2c48ea48"  # 6. Alias: Initiative via alias
    "83c052a3-9803-4076-99f5-7810892eff4f"  # 7. Alias: Team + Initiative aliases combined
    "dcb444a8-0bbb-4b98-b8d1-28552628b06a"  # 8. Alias: Status via alias
    "74fd47bd-0998-472e-9536-62655f531d43"  # 9. Alias: Lead via alias
    "33cba175-e756-4519-80c3-9635b4dc0bc1"  # 10. Alias: Multiple aliases (team + status + lead)
    "da376f08-8cbf-4792-a534-8f1e6766e0f8"  # 11. Content: Inline markdown
    "d33e9db5-ded3-40d3-93cf-5ecebe32168c"  # 12. Content: From file
    "71f65a70-8256-4f98-ba45-6f01a402e552"  # 13. Content: With special characters
    "d4d010be-28f4-4103-85c5-2de107533d58"  # 14. Content: Empty (valid)
    "88450765-dc95-4956-9a85-7d2604f72956"  # 15. Lead: Auto-assign (default)
    "f0c1f5a3-a093-42b6-ab95-741b70acf790"  # 16. Lead: Explicit --no-lead flag
    "2156038c-d9bd-49df-aad8-087273d09a37"  # 17. Lead: Via alias
    "ebec4d8e-19c5-45d4-99a3-66b5b0aa19c5"  # 18. Lead: Via email
    "ffd831d3-5552-42a0-b9e2-c8f328f1a122"  # 19. Dates: Start date only
    "946df335-af2d-482c-b83c-4bcc054cc3e5"  # 20. Dates: Target date only
    "ce0556ef-64f6-4cb8-94a4-1df7768b6c77"  # 21. Dates: Both with resolutions
    "04ea353e-ffbf-41af-8035-222283ba38c5"  # 22. Priority: Level 0 (None)
    "bd1bc7f0-6e7f-47eb-886f-0a89736d8702"  # 23. Priority: Level 1 (Urgent)
    "85cdf777-f357-4f60-a3e3-bb794e364ae9"  # 24. Priority: Level 2 (High)
    "6b294412-1951-468f-9a50-8304c35ebc11"  # 25. Priority: Combined with dates and status
    "5ae2449a-60ef-4806-8d5c-d4755cf4ecff"  # 26. Visual: Icon (emoji)
    "bf89158a-4560-4206-853a-f52064c1db31"  # 27. Visual: Color (hex)
    "654edc3e-b917-41f7-b59d-90f2119e9399"  # 28. Visual: Icon + Color combined
    "d59d5176-b9b0-4113-80d1-5dd6fbde9364"  # 29. Links: Single URL
    "6d5b4eab-5f6f-41ee-aac2-f318478f2603"  # 30. Links: Single URL with label
    "0f74f6b9-b7b9-49ad-a841-92172b80ae24"  # 31. Links: Multiple links
    "8fdba89d-60f2-4100-b54a-15d87805330a"  # 32. Links: Mixed (with and without labels)
    "d4339dec-f00a-4379-b738-4d09197a1f17"  # 33. Labels: Single label
    "fd1f0477-2f45-4cc3-855f-e2d5126e0da8"  # 34. Members: Single member
    "33528c95-c7f9-45d2-9456-76f2abbbfd71"  # 35. Members: Multiple members (comma-separated)
    "fae47963-4811-46eb-8088-5612c13ef0d8"  # 36. Combo: All text fields
    "e6aa9edc-06ce-423a-baa9-8811f5132ea9"  # 37. Combo: All ID fields
    "76067011-3afa-451e-8db8-d247f9ef3b0d"  # 38. Combo: Dates + Priority + Visual
    "9360c0ed-ca1d-4ed3-a415-9fc195416810"  # 39. Combo: Content + Links + Labels
    "04123a3c-647d-4c2a-8d13-953fa79a2d34"  # 40. Combo: Kitchen Sink (maximum fields)
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
