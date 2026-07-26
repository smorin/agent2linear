import type { Command } from 'commander';

import { type LabelDeleteOptions,runLabelDelete } from '../labels/runner.js';

export function deleteProjectLabelCommand(program: Command): void {
  program
    .command('delete <id>')
    .description('Permanently delete a project label')
    .option('-y, --yes', 'Supply destructive and workspace confirmation consent')
    .option('--dry-run', 'Preview the deletion without mutating Linear')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('--no-input', 'Never prompt; require --yes when consent is needed')
    .action(async (id: string, options: LabelDeleteOptions, command: Command) => {
      await runLabelDelete('project', id, {
        ...options,
        outputSource: command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
      });
    });
}
