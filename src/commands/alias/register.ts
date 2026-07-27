import { Argument,Command } from 'commander';

import { addAliasCommand } from './add.js';
import { clearAliasCommand } from './clear.js';
import { editAlias } from './edit.js';
import { getAliasCommand } from './get.js';
import { listAliasCommand } from './list.js';
import { removeAliasCommand } from './remove.js';
import { aliasSyncCommand } from './sync.js';

export function registerAliasCommands(cli: Command): void {
  const alias = cli
    .command('alias')
    .description('Manage aliases for initiatives, teams, projects, project statuses, templates, and members');

  alias
    .command('add')
    .addArgument(
      new Argument('<type>', 'Entity type')
        .choices(['initiative', 'team', 'project', 'project-status', 'issue-template', 'project-template', 'member', 'user', 'issue-label', 'project-label', 'workflow-state'])
    )
    .addArgument(new Argument('<alias>', 'Alias name (no spaces)'))
    .addArgument(new Argument('[id]', 'Linear ID (optional if using --email or --name for members)'))
    .description('Add a new alias')
    .option('-g, --global', 'Save to global config (default)')
    .option('-p, --project', 'Save to project config')
    .option('--skip-validation', 'Skip entity validation (faster)')
    .option('--email <email>', 'Look up member by email (exact or partial match, member/user only)')
    .option('--name <name>', 'Look up member by name (partial match, member/user only)')
    .option('-I, --interactive', 'Enable interactive selection when multiple matches found')
    .addHelpText('after', `
Examples:
  Basic (with ID):
  $ agent2linear alias add initiative backend init_abc123xyz
  $ agent2linear alias add team frontend team_def456uvw --project
  $ agent2linear alias add project api proj_ghi789rst
  $ agent2linear alias add project-status in-progress status_abc123
  $ agent2linear alias add issue-template bug-report template_abc123
  $ agent2linear alias add project-template sprint-template template_xyz789
  $ agent2linear alias add issue-label bug label_abc123def
  $ agent2linear alias add project-label release label_ghi456jkl
  $ agent2linear alias add workflow-state done state_mno789pqr
  $ agent2linear alias add member john user_abc123def

  Member by exact email (auto-select):
  $ agent2linear alias add member john --email john.doe@acme.com
  $ agent2linear alias add user jane --email jane@acme.com

  Member by partial email (error if multiple matches):
  $ agent2linear alias add member john --email @acme.com
  # Error: Multiple members found. Use --interactive to select.

  Member by email with interactive selection:
  $ agent2linear alias add member john --email @acme.com --interactive
  $ agent2linear alias add member john --email john@ --interactive

  Member by name with interactive selection:
  $ agent2linear alias add member john --name John --interactive
  $ agent2linear alias add member jane --name "Jane Smith" --interactive

Note: --email, --name, and --interactive flags are only valid for member/user type
`)
    .action(async (type: string, alias: string, id: string | undefined, options) => {
      await addAliasCommand(type, alias, id, options);
    });

  alias
    .command('list [type]')
    .alias('ls')
    .description('List all aliases or aliases for a specific type')
    .option('--validate', 'Validate that aliases point to existing entities')
    .addHelpText('after', `
Examples:
  $ agent2linear alias list                    # List all aliases
  $ agent2linear alias ls                      # Same as 'list' (alias)
  $ agent2linear alias list initiative         # List only initiative aliases
  $ agent2linear alias list team               # List only team aliases
  $ agent2linear alias list project            # List only project aliases
  $ agent2linear alias list project-status     # List only project status aliases
  $ agent2linear alias list issue-template     # List only issue template aliases
  $ agent2linear alias list project-template   # List only project template aliases
  $ agent2linear alias list issue-label        # List only issue label aliases
  $ agent2linear alias list project-label      # List only project label aliases
  $ agent2linear alias list workflow-state     # List only workflow state aliases
  $ agent2linear alias list member             # List only member aliases
  $ agent2linear alias list user               # List only user/member aliases
  $ agent2linear alias list --validate         # Validate all aliases
`)
    .action(async (type?: string, options?: { validate?: boolean }) => {
      await listAliasCommand(type, options);
    });

  alias
    .command('remove')
    .alias('rm')
    .addArgument(
      new Argument('<type>', 'Entity type')
        .choices(['initiative', 'team', 'project', 'project-status', 'issue-template', 'project-template', 'member', 'user', 'issue-label', 'project-label', 'workflow-state'])
    )
    .addArgument(new Argument('<alias>', 'Alias name to remove'))
    .description('Remove an alias')
    .option('-g, --global', 'Remove from global config (default)')
    .option('-p, --project', 'Remove from project config')
    .addHelpText('after', `
Examples:
  $ agent2linear alias remove initiative backend
  $ agent2linear alias rm team frontend --project
  $ agent2linear alias remove project-status in-progress
  $ agent2linear alias remove issue-template bug-report
  $ agent2linear alias rm project-template sprint-template
  $ agent2linear alias remove issue-label bug
  $ agent2linear alias remove project-label release
  $ agent2linear alias remove workflow-state done
  $ agent2linear alias remove member john
  $ agent2linear alias rm user jane
`)
    .action((type: string, alias: string, options) => {
      removeAliasCommand(type, alias, options);
    });

  alias
    .command('get')
    .addArgument(
      new Argument('<type>', 'Entity type')
        .choices(['initiative', 'team', 'project', 'project-status', 'issue-template', 'project-template', 'member', 'user', 'issue-label', 'project-label', 'workflow-state'])
    )
    .addArgument(new Argument('<alias>', 'Alias name'))
    .description('Get the ID for an alias')
    .addHelpText('after', `
Examples:
  $ agent2linear alias get initiative backend
  $ agent2linear alias get team frontend
  $ agent2linear alias get project-status in-progress
  $ agent2linear alias get issue-template bug-report
  $ agent2linear alias get project-template sprint-template
  $ agent2linear alias get issue-label bug
  $ agent2linear alias get project-label release
  $ agent2linear alias get workflow-state done
  $ agent2linear alias get member john
  $ agent2linear alias get user jane
`)
    .action((type: string, alias: string) => {
      getAliasCommand(type, alias);
    });

  alias
    .command('edit')
    .description('Interactively edit aliases (add, rename, change ID, or delete)')
    .option('-g, --global', 'Edit global aliases')
    .option('-p, --project', 'Edit project aliases')
    .addHelpText('after', `
This is an interactive command that guides you through editing aliases.

Supported entity types:
  - Initiatives       - Teams              - Projects
  - Project Statuses  - Issue Templates    - Project Templates
  - Members/Users     - Issue Labels       - Project Labels
  - Workflow States

Available operations:
  - Add new alias: Create a new alias by selecting from available entities
  - Rename alias: Change the alias name while keeping the same entity ID
  - Change ID: Update the entity ID that an alias points to
  - Delete alias: Remove an alias entirely

Examples:
  $ agent2linear alias edit           # Interactive mode (choose scope interactively)
  $ agent2linear alias edit --global  # Edit global aliases directly
  $ agent2linear alias edit --project # Edit project aliases directly

Note: This command is fully interactive. For non-interactive editing,
      use 'alias add' and 'alias remove' commands instead.
`)
    .action(async (options) => {
      await editAlias(options);
    });

  alias
    .command('clear')
    .addArgument(
      new Argument('<type>', 'Entity type')
        .choices(['initiative', 'team', 'project', 'project-status', 'issue-template', 'project-template', 'member', 'user', 'issue-label', 'project-label', 'workflow-state'])
    )
    .description('Clear all aliases of a specific type')
    .option('-g, --global', 'Clear from global config (default)')
    .option('-p, --project', 'Clear from project config')
    .option('-y, --yes', 'Supply confirmation consent')
    .option('--dry-run', 'Preview what would be cleared without actually clearing')
    .addHelpText('after', `
Examples:
  # Preview what would be cleared
  $ agent2linear alias clear team --dry-run
  $ agent2linear alias clear member --project --dry-run

  # Clear with confirmation
  $ agent2linear alias clear team --global
  $ agent2linear alias clear project-status --project

  # Clear without confirmation
  $ agent2linear alias clear initiative --yes
  $ agent2linear alias clear member --project --yes

Warning: This will remove ALL aliases of the specified type from the chosen scope.
         Use --dry-run first to preview what will be removed.
`)
    .action(async (type: string, options) => {
      await clearAliasCommand(type, options);
    });

  aliasSyncCommand(alias);
}
