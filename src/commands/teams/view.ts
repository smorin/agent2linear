import { getTeamById } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { showResolvedAlias, showEntityNotFound } from '../../lib/output.js';
import { openInBrowser } from '../../lib/browser.js';

export async function viewTeam(id: string, options: { web?: boolean } = {}) {
  try {
    // Resolve alias to ID if needed
    const resolvedId = resolveAlias('team', id);
    if (resolvedId !== id) {
      console.log();
      showResolvedAlias(id, resolvedId);
    }

    console.log(`\n🔍 Fetching team ${resolvedId}...\n`);

    const team = await getTeamById(resolvedId);

    if (!team) {
      showEntityNotFound('team', resolvedId);
      console.error(`   Use 'linear-create teams list' to see available teams\n`);
      process.exit(1);
    }

    // Handle --web flag
    if (options.web) {
      console.log(`🌐 Opening in browser: ${team.name}`);
      await openInBrowser(team.url);
      console.log(`✓ Browser opened to ${team.url}`);
      process.exit(0);
    }

    // Display team details
    console.log(`📋 Team: ${team.name}`);
    console.log(`   ID: ${team.id}`);
    console.log(`   Key: ${team.key}`);

    if (team.description) {
      console.log(`   Description: ${team.description}`);
    }

    console.log(`   URL: ${team.url}`);

    // Add helpful tip about using team in commands
    console.log(`\n💡 Use this team in commands:`);
    console.log(`   $ linear-create project create --team ${team.id}`);
    console.log(`   $ linear-create teams set ${team.id}\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
