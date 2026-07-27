import { Command } from 'commander';

import { addProfileCommand } from './add.js';
import { editProfileCommand } from './edit.js';
import { excludeProfileCommand } from './exclude.js';
import { listProfileCommand } from './list.js';
import { profileMatchAddCommand } from './match/add.js';
import { profileMatchListCommand } from './match/list.js';
import { profileMatchRemoveCommand } from './match/remove.js';
import { removeProfileCommand } from './remove.js';

/** Repeatable-flag collector: accumulates each --flag value into an array. */
function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerProfileCommands(cli: Command): void {
  const profile = cli
    .command('profile')
    .alias('prof')
    .description('Manage profiles (workspace + defaults + detection rules)');

  profile
    .command('add <name>')
    .description('Create a profile pointing at a workspace, with optional defaults')
    .option('--default-team <id|alias>', 'Default team for this profile')
    .option('--default-initiative <id|alias>', 'Default initiative for this profile')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .addHelpText('after', `
The workspace this profile points at is given via the program-level --workspace
global (it shadows a same-named subcommand option), e.g.:

Examples:
  $ agent2linear profile add acme --workspace acme --default-team backend
  $ agent2linear profile add personal --workspace personal --global

A profile points at a workspace by NAME; the key lives in the secrets registry
(workspace add), so config.json stays safe to commit. Set a persisted default
with "agent2linear config set defaultProfile <name>".
`)
    .action((name: string, options) => {
      addProfileCommand(name, options);
    });

  profile
    .command('list')
    .alias('ls')
    .description('List registered profiles with workspace + defaults (offline)')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear profile list
  $ agent2linear prof ls --format json
`)
    .action((options?: { format?: 'tsv' | 'json' }) => {
      listProfileCommand(options || {});
    });

  profile
    .command('edit <name>')
    .description('Modify an existing profile (merges the given fields)')
    .option('--default-team <id|alias>', 'Change the default team')
    .option('--default-initiative <id|alias>', 'Change the default initiative')
    .option('-g, --global', 'Edit global config (default)')
    .option('-p, --project', 'Edit project config')
    .addHelpText('after', `
Use the program-level --workspace global to change the workspace this profile
points at. Only the fields you pass are changed; the rest are preserved.

Examples:
  $ agent2linear profile edit acme --default-team frontend
  $ agent2linear profile edit acme --workspace acme-prod --project
`)
    .action((name: string, options) => {
      editProfileCommand(name, options);
    });

  profile
    .command('remove <name>')
    .alias('rm')
    .description('Remove a profile')
    .option('-g, --global', 'Remove from global config (default)')
    .option('-p, --project', 'Remove from project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile remove acme
  $ agent2linear prof rm acme --project
`)
    .action((name: string, options) => {
      removeProfileCommand(name, options);
    });

  profile
    .command('exclude <name>')
    .description('Mark a profile off-limits (linear: false) — resolution refuses it')
    .option('-g, --global', 'Edit global config (default)')
    .option('-p, --project', 'Edit project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile exclude acme

Commands refuse to use an excluded profile unless forced with --workspace/--api-key-file.
`)
    .action((name: string, options) => {
      excludeProfileCommand(name, options);
    });

  // Nested detection-rule group (mirrors "project dependencies …").
  const match = profile
    .command('match')
    .description('Manage git-remote auto-detection rules (host/owner/repo/remote) for a profile');

  match
    .command('add <profile>')
    .description('Add git-remote match rules (host/owner/repo/remote) to a profile')
    .option(
      '--git-remote-host <host>',
      'Git remote host glob that maps to this profile, e.g. "github.com", "*.gitlab.example.com" (repeatable)',
      collect,
      []
    )
    .option(
      '--git-remote-owner <owner>',
      'Git remote owner glob that maps to this profile (repeatable)',
      collect,
      []
    )
    .option(
      '--git-remote-repo <owner/name>',
      'Git remote "owner/name" glob that maps to this profile, e.g. "my-org/secret-*" (repeatable)',
      collect,
      []
    )
    .option(
      '--remote <name>',
      'Which remote(s) identity reads: a name (e.g. "upstream"), or "*" for any (default: origin)',
      collect,
      []
    )
    .option('--case-sensitive', 'Match host/owner/repo case-sensitively (default: case-insensitive)')
    .option('-g, --global', 'Edit global config (default)')
    .option('-p, --project', 'Edit project config')
    .addHelpText('after', `
Within one rule, present identity fields (host/owner/repo) are AND'd and each list
ORs; globs match case-insensitively unless --case-sensitive is given. --remote
selects which remote(s) the identity reads (default: origin); a bare --remote with
no identity fields matches a repo that simply HAS that remote (the fork predicate).

Examples:
  $ agent2linear profile match add acme --git-remote-owner acme-co --git-remote-owner acme-labs
  $ agent2linear profile match add acme --git-remote-host '*.gitlab.example.com' --git-remote-owner acme
  $ agent2linear profile match add acme --git-remote-repo 'my-org/secret-*'
  # Fork case: route by the upstream owner even when origin is a personal fork.
  $ agent2linear profile match add acme --remote upstream --git-remote-owner acme

A repo whose selected remote(s) satisfy these globs auto-resolves to this profile.
`)
    .action((name: string, options) => {
      profileMatchAddCommand(name, options);
    });

  match
    .command('list <profile>')
    .alias('ls')
    .description('List a profile’s git-remote match rules (host/owner/repo/remote)')
    .action((name: string) => {
      profileMatchListCommand(name);
    });

  match
    .command('remove <profile>')
    .alias('rm')
    .description('Remove a git-remote match rule (host/owner/repo/remote) from a profile')
    .option('--git-remote-host <host>', 'Git remote host glob to remove')
    .option('--git-remote-owner <owner>', 'Git remote owner glob to remove')
    .option('--git-remote-repo <owner/name>', 'Git remote "owner/name" glob to remove')
    .option('--remote <name>', 'Remote selector value to remove (e.g. "upstream")')
    .option('-g, --global', 'Edit global config (default)')
    .option('-p, --project', 'Edit project config')
    .addHelpText('after', `
Examples:
  $ agent2linear profile match remove acme --git-remote-owner acme-labs
  $ agent2linear profile match remove acme --git-remote-host '*.gitlab.example.com'
  $ agent2linear profile match remove acme --remote upstream
`)
    .action((name: string, options) => {
      profileMatchRemoveCommand(name, options);
    });
}
