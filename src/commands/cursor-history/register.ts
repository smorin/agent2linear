import { Command } from 'commander';

import { runCursorHistoryClear } from './clear.js';
import { runCursorHistoryList } from './list.js';
import { type CursorHistoryCommandDependencies, mergeCursorHistoryDependencies } from './shared.js';
import { runCursorHistoryView } from './view.js';

function outputWasExplicit(command: Command): boolean {
  return command.getOptionValueSource('output') === 'cli';
}

export function registerCursorHistoryCommands(
  cli: Command,
  dependencyOverrides: Partial<CursorHistoryCommandDependencies> = {}
): void {
  const dependencies = mergeCursorHistoryDependencies(dependencyOverrides);
  const history = cli
    .command('cursor-history')
    .description('Inspect and clear locally stored raw cursor history')
    .addHelpText(
      'after',
      `
Examples:
  $ a2l cursor-history list
  $ a2l cursor-history view <entry-id>
  $ a2l cursor-history clear --dry-run

These commands inspect local XDG state and never authenticate with Linear.
`
    );

  history
    .command('list')
    .description('List retained cursor history newest first (local; no authentication)')
    .option('--limit <number>', 'Return at most 1–1000 entries (default: 50)')
    .option('--cursor <cursor>', 'Filter by an exact raw cursor')
    .option('-o, --output <table|json>', 'Select human or machine-readable output')
    .option('--json', 'Equivalent to --output json')
    .action((options, command: Command) => {
      runCursorHistoryList(
        { ...options, outputExplicit: outputWasExplicit(command) },
        dependencies
      );
    })
    .addHelpText(
      'after',
      `
Examples:
  $ a2l cursor-history list
  $ a2l cursor-history list --limit 20 --output json
  $ a2l cursor-history list --cursor '<raw-linear-cursor>'
`
    );

  history
    .command('view <entry-id>')
    .description('View one retained cursor history entry (local; no authentication)')
    .option('-o, --output <table|json>', 'Select human or machine-readable output')
    .option('--json', 'Equivalent to --output json')
    .action((id: string, options, command: Command) => {
      runCursorHistoryView(
        id,
        { ...options, outputExplicit: outputWasExplicit(command) },
        dependencies
      );
    })
    .addHelpText(
      'after',
      `
Examples:
  $ a2l cursor-history view <entry-id>
  $ a2l cursor-history view <entry-id> --json
`
    );

  history
    .command('clear')
    .description('Clear retained cursor history only')
    .option('--dry-run', 'Show what would be cleared without prompting or writing')
    .option('-y, --yes', 'Confirm clearing without prompting')
    .option('--no-input', 'Never prompt; requires --yes unless --dry-run')
    .option('-o, --output <table|json>', 'Select human or machine-readable output')
    .option('--json', 'Equivalent to --output json')
    .action(async (options, command: Command) => {
      await runCursorHistoryClear(
        { ...options, outputExplicit: outputWasExplicit(command) },
        dependencies
      );
    })
    .addHelpText(
      'after',
      `
Examples:
  $ a2l cursor-history clear --dry-run
  $ a2l cursor-history clear --yes
  $ a2l cursor-history clear --yes --json
`
    );
}
