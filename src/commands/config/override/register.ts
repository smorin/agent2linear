/**
 * Register the `config override` (alias `config ov`) command group (M31).
 *
 * A third-level group (`config` → `override` → verb), built by retaining the
 * intermediate `Command` and chaining verbs onto it — the `profile match` pattern.
 * Phase 1 wires `add` / `list` / `get`; later phases append `edit` / `remove` /
 * `move` here.
 */

import { Command } from 'commander';

import { runOverrideAdd } from './add.js';
import { runOverrideGet } from './get.js';
import { runOverrideList } from './list.js';

/** Repeatable-flag collector: accumulates each --flag value into an array. */
function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerOverrideCommands(configCmd: Command): void {
  const override = configCmd
    .command('override')
    .alias('ov')
    .description('Manage context-aware override rules (M29 overrides[])')
    .action(() => {
      override.help();
    });

  override
    .command('add <label>')
    .description('Append a new override rule named <label>')
    .option('--when-repo <glob>', 'Match repo "owner/name" glob')
    .option('--when-owner <glob>', 'Match repo owner glob')
    .option('--when-host <glob>', 'Match repo host glob')
    .option('--when-path <glob>', 'Match path glob (relative = repo-anchored; ~/ or / = disk)')
    .option('--when-branch <glob>', 'Match branch glob')
    .option('--when-remote <name>', 'Match remote selector (name, list, or "*")')
    .option('--set <key=value>', 'Set an overridable default (repeatable)', collect, [])
    .option('--alias <entity.name=id>', 'Set a per-rule alias (repeatable)', collect, [])
    .option('-g, --global', 'Apply to global config (default)')
    .option('-p, --project', 'Apply to project config')
    .option('--dry-run', 'Print the resulting rule without writing')
    .option('--json', 'Output machine-readable JSON')
    .addHelpText('after', `
Examples:
  $ agent2linear config ov add t1 --when-repo acme/web --set defaultTeam=frontend --project
  $ agent2linear config ov add web-aliases --when-repo acme/web --alias team.frontend=team_123 --project
`)
    .action((label: string, options) => {
      runOverrideAdd(label, options);
    });

  override
    .command('list')
    .description('List override rules (both scopes by default; context-independent)')
    .option('-g, --global', 'List global config only')
    .option('-p, --project', 'List project config only')
    .option('--json', 'Output machine-readable JSON')
    .action((options) => {
      runOverrideList(options);
    });

  override
    .command('get <selector>')
    .description('Print one override rule in full (selector = <label> or #<index>)')
    .option('-g, --global', 'Resolve in global config (default)')
    .option('-p, --project', 'Resolve in project config')
    .option('--json', 'Output machine-readable JSON')
    .action((selector: string, options) => {
      runOverrideGet(selector, options);
    });
}
