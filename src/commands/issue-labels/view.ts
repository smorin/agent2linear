import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { formatColorPreview } from '../../lib/colors.js';
import { getIssueLabelById } from '../../lib/linear-client.js';

export function viewIssueLabel(program: Command) {
  program
    .command('view <id>')
    .description('View issue label details')
    .action(async (id: string) => {
      try {
        const resolvedId = resolveAlias('issue-label', id);
        if (resolvedId !== id) {
          console.log(`📎 Resolved alias "${id}" to ${resolvedId}`);
        }

        const label = await getIssueLabelById(resolvedId);
        if (!label) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('issue label', id, 'issue-labels list'));
          process.exit(1);
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
