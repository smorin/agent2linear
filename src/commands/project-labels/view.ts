import type { Command } from 'commander';

import { runLabelView } from '../labels/runner.js';

export function viewProjectLabel(program: Command): void {
  program
    .command('view <id>')
    .description('View an active or retired project label')
    .action(async (id: string) => {
      await runLabelView('project', id);
    });
}
