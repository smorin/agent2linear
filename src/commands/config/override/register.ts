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
    .option('--when-repo <glob>', 'Match repo "owner/name" glob (repeatable, comma = OR)', collect, [])
    .option('--when-owner <glob>', 'Match repo owner glob (repeatable, comma = OR)', collect, [])
    .option('--when-host <glob>', 'Match repo host glob (repeatable, comma = OR)', collect, [])
    .option(
      '--when-path <glob>',
      'Match path glob (relative = repo-anchored; ~/ or / = disk; repeatable, comma = OR)',
      collect,
      []
    )
    .option('--when-branch <glob>', 'Match branch glob (repeatable, comma = OR)', collect, [])
    .option('--when-remote <name>', 'Match remote selector (name, list, or "*"; repeatable)', collect, [])
    .option('--when-not-repo <glob>', 'Exclude a repo "owner/name" glob (repeatable)', collect, [])
    .option('--when-not-owner <glob>', 'Exclude a repo owner glob (repeatable)', collect, [])
    .option('--when-not-host <glob>', 'Exclude a repo host glob (repeatable)', collect, [])
    .option('--when-not-path <glob>', 'Exclude a path glob (repeatable)', collect, [])
    .option('--when-not-branch <glob>', 'Exclude a branch glob (repeatable)', collect, [])
    .option('--when-not-remote <name>', 'Exclude a remote selector (repeatable)', collect, [])
    .option('--when-json <json>', 'Provide the full `when` clause as JSON (escape hatch for nested trees)')
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
  $ agent2linear config ov add release --when-branch release/*,main --set defaultTeam=ship --global
  $ agent2linear config ov add nested --when-json '{"anyOf":[{"path":"cli/**"},{"branch":"main"}]}' --set defaultTeam=cli --global
  $ agent2linear config ov add catch-all --when-json '{}' --set defaultTeam=fallback --global
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
