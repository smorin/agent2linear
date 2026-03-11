import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';
import { getProjectLabelById } from '../../lib/linear-client.js';

export function viewProjectLabel(program: Command) {
  program
    .command('view <id>')
    .description('View project label details')
    .action(async (id: string) => {
      try {
        const resolvedId = resolveAlias('project-label', id);
        const label = await getProjectLabelById(resolvedId);
        if (!label) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('project label', id, 'project-labels list'));
          process.exit(1);
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
