#!/bin/bash

echo "=== Test 1: Create a project with lastAppliedTemplateId ==="
echo ""

curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "mutation CreateProject($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name url lastAppliedTemplate { id name } } } }",
    "variables": {
      "input": {
        "name": "cURL_Test_Template",
        "teamIds": ["2df5f813-6fa7-44ba-a828-04b04a92efd3"],
        "lastAppliedTemplateId": "8c081f36-6df5-4a2e-a709-35ca25408d2a"
      }
    }
  }' | python3 -m json.tool

echo ""
echo "=== Test 2: Query the project details (replace PROJECT_ID with ID from above) ==="
echo ""
echo "Run this command with the project ID from step 1:"
echo ""
echo 'curl -X POST https://api.linear.app/graphql \'
echo '  -H "Authorization: $LINEAR_API_KEY" \'
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo '    "query": "query GetProject($id: String!) { project(id: $id) { id name lastAppliedTemplate { id name } projectMilestones { nodes { id name } } issues { nodes { id identifier title } } } }",'
echo '    "variables": { "id": "YOUR_PROJECT_ID_HERE" }'
echo "  }' | python3 -m json.tool"

