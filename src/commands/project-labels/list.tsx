import type { Command } from 'commander';

import { type LabelListOptions, runLabelList } from '../labels/runner.js';

export function listProjectLabels(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List project labels with raw-cursor pagination')
    .option('--color <hex>', 'Filter by normalized color')
    .option('-o, --output <table|json|tsv>', 'Output format: table (default), json, or tsv')
    .option('--json', 'Exact shorthand for --output json')
    .option('--limit <number>', 'Maximum matching labels to return (default: 50, max: 250)', '50')
    .option('--after <cursor>', 'Resume after the exact raw Linear cursor')
    .option('--include-retired', 'Include retired labels; archived labels remain excluded')
    .option('-a, --all', 'Fetch every remaining page; overrides --limit')
    .option('--no-cursor-history', 'Do not persist an emitted continuation cursor')
    .action(async (options: LabelListOptions, command: Command) => {
      await runLabelList('project', {
        ...options,
        outputSource:
          command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
        limitSource: command.getOptionValueSource('limit') === 'cli' ? 'explicit' : 'default',
      });
    });
}
