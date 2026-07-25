import type { Command } from 'commander';

import { type LabelListOptions,runLabelList } from '../labels/runner.js';

export function listIssueLabels(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List issue labels with raw-cursor pagination')
    .option('-t, --team <id>', 'Filter by team ID, name, or alias')
    .option('-w, --workspace', 'Show only workspace-level labels')
    .option('--color <hex>', 'Filter by normalized color')
    .option('-f, --format <type>', 'Output format: default, json, or tsv', 'default')
    .option('--limit <number>', 'Maximum matching labels to return (default: 50, max: 250)', '50')
    .option('--after <cursor>', 'Resume after the exact raw Linear cursor')
    .option('--include-retired', 'Include retired labels; archived labels remain excluded')
    .option('-a, --all', 'Fetch every remaining page; overrides --limit')
    .option('--no-cursor-history', 'Do not persist an emitted continuation cursor')
    .action(async (options: LabelListOptions, command: Command) => {
      await runLabelList('issue', {
        ...options,
        limitSource: command.getOptionValueSource('limit') === 'cli' ? 'explicit' : 'default',
      });
    });
}
