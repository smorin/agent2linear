import type { Command } from 'commander';

import { type LabelUpdateOptions,runLabelUpdate } from '../labels/runner.js';

export function updateIssueLabelCommand(program: Command): void {
  program
    .command('update <id>')
    .description('Update an issue label')
    .option('--name <name>', 'New nonblank name')
    .option('--color <hex>', 'New color (hex code)')
    .option('--description <text>', 'New description; pass an empty string to clear')
    .option('--dry-run', 'Validate and print the plan without mutating Linear')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('-y, --yes', 'Consent to any required workspace confirmation')
    .option('--no-input', 'Never prompt; fail if explicit consent is required')
    .action(async (id: string, options: LabelUpdateOptions, command: Command) => {
      await runLabelUpdate('issue', id, {
        ...options,
        outputSource: command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
      });
    });
}
