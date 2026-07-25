import type { Command } from 'commander';

import { runLabelView } from '../labels/runner.js';

export function viewIssueLabel(program: Command): void {
  program
    .command('view <id>')
    .description('View an active or retired issue label')
    .action(async (id: string) => {
      await runLabelView('issue', id);
    });
}
