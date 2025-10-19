import { getProjectById } from '../../lib/linear-client.js';

export async function viewProject(id: string) {
  try {
    console.log(`\n🔍 Fetching project ${id}...\n`);

    const project = await getProjectById(id);

    if (!project) {
      console.error(`❌ Error: Project with ID "${id}" not found`);
      process.exit(1);
    }

    // Display project details
    console.log(`📋 Project: ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   State: ${project.state}`);

    if (project.initiative) {
      console.log(`   Initiative: ${project.initiative.name} (${project.initiative.id})`);
    }

    if (project.team) {
      console.log(`   Team: ${project.team.name} (${project.team.id})`);
    }

    console.log(`   URL: ${project.url}`);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
