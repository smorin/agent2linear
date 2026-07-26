import type { Command } from 'commander';

import { type LabelLifecycleOptions,runLabelLifecycle } from '../labels/runner.js';

export function restoreIssueLabelCommand(program: Command): void {
  program
    .command('restore <id>')
    .description('Restore a retired issue label')
    .option('--dry-run', 'Preview restoration without mutating Linear')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('-y, --yes', 'Consent to any required workspace confirmation')
    .option('--no-input', 'Never prompt; fail if workspace confirmation is required')
    .action(async (id: string, options: LabelLifecycleOptions, command: Command) => {
      await runLabelLifecycle('issue', 'restore', id, {
        ...options,
        outputSource: command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
      });
    });
}
