import { Command } from 'commander';
import { getIssueLabelById } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';

export function viewIssueLabel(program: Command) {
  program
    .command('view <id>')
    .description('View issue label details')
    .option('-w, --web', 'Open label in browser')
    .action(async (id: string, options) => {
      try {
        const resolvedId = resolveAlias('issue-label', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        const label = await getIssueLabelById(resolvedId);
        if (!label) {
          console.error(`❌ Issue label not found: ${id}`);
          process.exit(1);
        }

        if (options.web) {
          const open = await import('open');
          await open.default('https://linear.app/settings/labels');
          return;
        }

        console.log('');
        console.log(`🏷️  Issue Label: ${label.name}`);
        console.log(`   ID: ${label.id}`);
        console.log(`   Color: ${label.color} ${formatColorPreview(label.color)}`);
        console.log(`   Scope: ${label.teamId ? `Team (${label.teamId})` : 'Workspace'}`);
        if (label.description) {
          console.log(`   Description: ${label.description}`);
        }
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
