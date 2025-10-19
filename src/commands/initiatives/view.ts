import { getInitiativeById } from '../../lib/linear-client.js';

export async function viewInitiative(id: string) {
  try {
    console.log(`\n🔍 Fetching initiative ${id}...\n`);

    const initiative = await getInitiativeById(id);

    if (!initiative) {
      console.error(`❌ Error: Initiative with ID "${id}" not found`);
      process.exit(1);
    }

    // Display initiative details
    console.log(`📋 Initiative: ${initiative.name}`);
    console.log(`   ID: ${initiative.id}`);

    if (initiative.description) {
      console.log(`   Description: ${initiative.description}`);
    }

    console.log(`   URL: ${initiative.url}`);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
