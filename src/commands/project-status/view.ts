import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { isAuthenticationError } from '../../lib/cli-error.js';
import { getProjectStatusById } from '../../lib/linear-client.js';
import { showEntityNotFound,showResolvedAlias } from '../../lib/output.js';
import { resolveProjectStatusId } from '../../lib/status-cache.js';

export async function viewProjectStatus(nameOrId: string, options: { web?: boolean } = {}) {
  try {
    // Step 1: Try alias resolution
    const resolvedFromAlias = resolveAlias('project-status', nameOrId);
    let statusId: string | null = null;

    if (resolvedFromAlias !== nameOrId) {
      // Alias was resolved
      statusId = resolvedFromAlias;
      console.log();
      showResolvedAlias(nameOrId, statusId);
    } else {
      // Step 2: Try name or ID lookup via cache
      statusId = await resolveProjectStatusId(nameOrId);

      if (!statusId) {
        showEntityNotFound('project status', nameOrId);
        console.error(`   Use 'agent2linear project-status list' to see available statuses\n`);
        process.exit(1);
      }

      if (statusId !== nameOrId) {
        console.log(`\n✓ Resolved status "${nameOrId}" to ID: ${statusId}`);
      }
    }

    console.log(`\n🔍 Fetching project status ${statusId}...\n`);

    const status = await getProjectStatusById(statusId);

    if (!status) {
      showEntityNotFound('project status', statusId);
      console.error(`   Use 'agent2linear project-status list' to see available statuses\n`);
      process.exit(1);
    }

    // Handle --web flag
    if (options.web) {
      console.log(`🌐 Opening project settings in browser...`);
      await openInBrowser('https://linear.app/settings/projects');
      console.log(`✓ Browser opened to project settings`);
      process.exit(0);
    }

    // Display status details
    console.log(`📊 Project Status: ${status.name}`);
    console.log(`   ID: ${status.id}`);
    console.log(`   Type: ${status.type}`);
    console.log(`   Color: ${status.color}`);
    console.log(`   Position: ${status.position}`);

    if (status.description) {
      console.log(`   Description: ${status.description}`);
    }

    // Add helpful tip about using status in commands
    console.log(`\n💡 Use this status in commands:`);
    console.log(`   $ agent2linear project update <project> --status "${status.name}"`);
    console.log(`   $ agent2linear project update <project> --status ${status.id}\n`);
  } catch (error) {
    if (isAuthenticationError(error)) throw error;
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
