#!/usr/bin/env node
import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: node check-template.mjs <project-id>');
  process.exit(1);
}

async function checkProject() {
  try {
    console.log(`\n🔍 Checking project: ${projectId}\n`);

    const project = await client.project(projectId);

    console.log(`📋 Project: ${project.name}`);
    console.log(`   State: ${project.state}`);

    // Check for last applied template
    const lastTemplate = await project.lastAppliedTemplate;
    if (lastTemplate) {
      console.log(`   Template: ${lastTemplate.name} (${lastTemplate.id})`);
    } else {
      console.log(`   Template: None`);
    }

    // Check for project milestones
    console.log(`\n📅 Milestones:`);
    const milestones = await project.projectMilestones();
    const milestoneList = await milestones.nodes;

    if (milestoneList.length === 0) {
      console.log(`   ❌ No milestones found`);
    } else {
      for (const milestone of milestoneList) {
        console.log(`   ✓ ${milestone.name}`);
      }
    }

    // Check for issues
    console.log(`\n📝 Issues:`);
    const issues = await project.issues();
    const issueList = await issues.nodes;

    if (issueList.length === 0) {
      console.log(`   ❌ No issues found`);
    } else {
      for (const issue of issueList) {
        console.log(`   ✓ ${issue.identifier}: ${issue.title}`);
      }
    }

    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProject();
