/**
 * Register the `config override` (alias `config ov`) command group (M31).
 *
 * A third-level group (`config` → `override` → verb), built by retaining the
 * intermediate `Command` and chaining verbs onto it — the `profile match` pattern.
 * Phase 1 wires `add` / `list` / `get`; Phase 3 appends `edit` / `remove` / `move`.
 */

import { Command } from 'commander';

import { runOverrideAdd } from './add.js';
import { runOverrideEdit } from './edit.js';
import { runOverrideGet } from './get.js';
import { runOverrideList } from './list.js';
import { runOverrideMove } from './move.js';
import { runOverrideRemove } from './remove.js';

/** Repeatable-flag collector: accumulates each --flag value into an array. */
function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerOverrideCommands(configCmd: Command): void {
  const override = configCmd
    .command('override')
    .alias('ov')
    .description('Manage context-aware override rules (M29 overrides[])');

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

  override
    .command('edit <selector>')
    .description('Modify an override rule (selector = <label> or #<index>)')
    .option('--when-repo <glob>', 'Replace `when`: match repo "owner/name" glob (repeatable, comma = OR)', collect, [])
    .option('--when-owner <glob>', 'Replace `when`: match repo owner glob (repeatable, comma = OR)', collect, [])
    .option('--when-host <glob>', 'Replace `when`: match repo host glob (repeatable, comma = OR)', collect, [])
    .option(
      '--when-path <glob>',
      'Replace `when`: match path glob (relative = repo-anchored; ~/ or / = disk; repeatable, comma = OR)',
      collect,
      []
    )
    .option('--when-branch <glob>', 'Replace `when`: match branch glob (repeatable, comma = OR)', collect, [])
    .option('--when-remote <name>', 'Replace `when`: match remote selector (name, list, or "*"; repeatable)', collect, [])
    .option('--when-not-repo <glob>', 'Replace `when`: exclude a repo "owner/name" glob (repeatable)', collect, [])
    .option('--when-not-owner <glob>', 'Replace `when`: exclude a repo owner glob (repeatable)', collect, [])
    .option('--when-not-host <glob>', 'Replace `when`: exclude a repo host glob (repeatable)', collect, [])
    .option('--when-not-path <glob>', 'Replace `when`: exclude a path glob (repeatable)', collect, [])
    .option('--when-not-branch <glob>', 'Replace `when`: exclude a branch glob (repeatable)', collect, [])
    .option('--when-not-remote <name>', 'Replace `when`: exclude a remote selector (repeatable)', collect, [])
    .option('--when-json <json>', 'Replace `when` with this full JSON clause (escape hatch for nested trees)')
    .option('--set <key=value>', 'Overwrite an overridable default (repeatable)', collect, [])
    .option('--unset <key>', 'Delete an overridable default (repeatable)', collect, [])
    .option('--alias <entity.name=id>', 'Set/overwrite a per-rule alias (repeatable)', collect, [])
    .option('--rm-alias <entity.name>', 'Remove a per-rule alias (repeatable)', collect, [])
    .option('--id <label>', 'Assign a stable label (e.g. to a legacy #<index> rule)')
    .option('-g, --global', 'Resolve in global config (default)')
    .option('-p, --project', 'Resolve in project config')
    .option('--dry-run', 'Print the resulting rule without writing')
    .option('--json', 'Output machine-readable JSON')
    .addHelpText('after', `
Examples:
  $ agent2linear config ov edit t1 --set defaultTeam=mobile --project
  $ agent2linear config ov edit t1 --unset defaultInitiative --project
  $ agent2linear config ov edit '#2' --id release --project
  $ agent2linear config ov edit t1 --when-json '{"repo":"acme/web","branch":"main"}' --project
`)
    .action((selector: string, options) => {
      runOverrideEdit(selector, options);
    });

  override
    .command('remove <selector>')
    .alias('rm')
    .description('Delete an override rule (selector = <label> or #<index>)')
    .option('-g, --global', 'Resolve in global config (default)')
    .option('-p, --project', 'Resolve in project config')
    .option('--json', 'Output machine-readable JSON')
    .action((selector: string, options) => {
      runOverrideRemove(selector, options);
    });

  override
    .command('move <selector>')
    .description('Reorder a rule within its scope (controls equal-specificity tie-break)')
    .option('--before <selector>', 'Move the rule immediately before this rule')
    .option('--after <selector>', 'Move the rule immediately after this rule')
    .option('-g, --global', 'Resolve in global config (default)')
    .option('-p, --project', 'Resolve in project config')
    .option('--json', 'Output machine-readable JSON')
    .addHelpText('after', `
Examples:
  $ agent2linear config ov move t1 --before t2 --project
  $ agent2linear config ov move '#3' --after catch-all --project
`)
    .action((selector: string, options) => {
      runOverrideMove(selector, options);
    });
}
