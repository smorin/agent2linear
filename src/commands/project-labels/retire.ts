import type { Command } from 'commander';

import { type LabelLifecycleOptions,runLabelLifecycle } from '../labels/runner.js';

export function retireProjectLabelCommand(program: Command): void {
  program
    .command('retire <id>')
    .description('Reversibly retire a project label')
    .option('-y, --yes', 'Supply retire and workspace confirmation consent')
    .option('--dry-run', 'Preview retirement without mutating Linear')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('--no-input', 'Never prompt; require --yes when consent is needed')
    .action(async (id: string, options: LabelLifecycleOptions, command: Command) => {
      await runLabelLifecycle('project', 'retire', id, {
        ...options,
        outputSource: command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
      });
    });
}
