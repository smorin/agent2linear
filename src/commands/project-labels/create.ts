import type { Command } from 'commander';

import { type LabelCreateOptions,runLabelCreate } from '../labels/runner.js';

export function createProjectLabelCommand(program: Command): void {
  program
    .command('create')
    .description('Create a project label')
    .option('-n, --name <name>', 'Label name (required)')
    .option('-c, --color <hex>', 'Color (hex code)', '#5E6AD2')
    .option('-d, --description <text>', 'Description; an empty string is allowed')
    .option('--dry-run', 'Validate and print the plan without mutating Linear')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('-y, --yes', 'Consent to any required workspace confirmation')
    .option('--no-input', 'Never prompt; fail if explicit consent is required')
    .action(async (options: LabelCreateOptions, command: Command) => {
      await runLabelCreate('project', {
        ...options,
        outputSource: command.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default',
      });
    });
}
