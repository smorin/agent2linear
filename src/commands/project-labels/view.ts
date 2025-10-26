import { Command } from 'commander';
import { getProjectLabelById } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';

export function viewProjectLabel(program: Command) {
  program
    .command('view <id>')
    .description('View project label details')
    .option('-w, --web', 'Open label in browser')
    .action(async (id: string, options) => {
      try {
        const resolvedId = resolveAlias('project-label', id);
        const label = await getProjectLabelById(resolvedId);
        if (!label) {
          console.error('❌ Project label not found');
          process.exit(1);
        }

        if (options.web) {
          const open = await import('open');
          await open.default('https://linear.app/settings/labels');
          return;
        }

        console.log('');
        console.log(`🏷️  Project Label: ${label.name}`);
        console.log(`   ID: ${label.id}`);
        console.log(`   Color: ${label.color} ${formatColorPreview(label.color)}`);
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
