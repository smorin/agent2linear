import { Argument, Command } from 'commander';

import { runPromptGet } from '../prompt/get.js';
import { commentIssueCommand } from './comment.js';
import { createIssueCommand } from './create.js';
import { registerIssueListCommand } from './list.js';
import { updateIssueCommand } from './update.js';
import { viewIssue } from './view.js';

export function registerIssueCommands(cli: Command): void {
  const issue = cli
    .command('issue')
    .description('Manage Linear issues')
    .action(() => {
      issue.help();
    });

  issue
    .command('view <identifier>')
    .description('View an issue by identifier (e.g., ENG-123) or UUID')
    .option('--json', 'Output in JSON format')
    .option('-w, --web', 'Open issue in web browser')
    .option('--show-comments', 'Display issue comments')
    .option('--show-history', 'Display issue history')
    .option('--desc', 'Show truncated description preview (default 80 chars)')
    .option('--desc-length <n>', 'Description preview length in characters (implies --desc)')
    .option('--desc-full', 'Show full description (default behavior, explicit)')
    .option('--no-desc', 'Hide description from output')
    .addHelpText('after', `
Examples:
  $ agent2linear issue view ENG-123                    # View issue by identifier
  $ agent2linear issue view <uuid>                     # View issue by UUID
  $ agent2linear issue view ENG-123 --json             # Output as JSON
  $ agent2linear issue view ENG-123 --web              # Open in browser
  $ agent2linear issue view ENG-123 --show-comments    # Include comments
  $ agent2linear issue view ENG-123 --show-history     # Include history
  $ agent2linear issue view ENG-123 --desc             # Show 80-char description preview
  $ agent2linear issue view ENG-123 --no-desc          # Hide description
  $ agent2linear issue view ENG-123 --desc-length 120  # Show 120-char description preview

The view command displays comprehensive issue information including:
  • Core details: title, description, status, priority
  • Assignment: assignee, subscribers
  • Organization: team, project, cycle, labels
  • Dates: created, updated, due, completed
  • Relationships: parent issue, sub-issues
  • Creator information

Use --show-comments to see all comments on the issue.
Use --show-history to see the change history.
`)
    .action(async (identifier, options) => {
      await viewIssue(identifier, options);
    });

  issue
    .command('create')
    .description('Create a new Linear issue')
    .option('--title <string>', 'Issue title (required)')
    .option('--team <id|alias>', 'Team ID or alias (required unless defaultTeam configured)')
    .option('--description <string>', 'Issue description (markdown)')
    .option('--description-file <path>', 'Read description from file (mutually exclusive with --description)')
    .option('--priority <0-4>', 'Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low')
    .option('--estimate <number>', 'Story points or time estimate')
    .option('--state <id|alias>', 'Workflow state ID or alias (must belong to team)')
    .option('--due-date <YYYY-MM-DD>', 'Due date in ISO format')
    .option('--assignee <id|alias|email|name>', 'Assign to user (ID, alias, email, or display name)')
    .option('--no-assignee', 'Create unassigned (overrides default auto-assignment)')
    .option('--subscribers <list>', 'Comma-separated list of subscriber IDs, aliases, or emails')
    .option('--project <id|alias|name>', 'Project ID, alias, or name (must belong to same team)')
    .option('--cycle <uuid|alias>', 'Cycle UUID or alias')
    .option('--parent <identifier>', 'Parent issue identifier (ENG-123 or UUID) for sub-issues')
    .option('--labels <list>', 'Comma-separated list of label IDs or aliases')
    .option('--template <id|alias>', 'Issue template ID or alias')
    .option('-w, --web', 'Open created issue in browser')
    .option('--dry-run', 'Preview the payload without creating the issue')
    .option('--json', 'Output the created issue + active workspace as JSON')
    .option('-y, --yes', 'Skip the auto-detected-workspace confirmation prompt')
    .addHelpText('after', `
Examples:
  # Minimal (uses defaultTeam, auto-assigns to you)
  $ agent2linear issue create --title "Fix login bug"

  # Standard creation
  $ agent2linear issue create \\
      --title "Add OAuth support" \\
      --team backend \\
      --priority 2 \\
      --estimate 8

  # Full-featured creation
  $ agent2linear issue create \\
      --title "Implement authentication" \\
      --team backend \\
      --description "Add OAuth2 with Google and GitHub providers" \\
      --priority 1 \\
      --estimate 13 \\
      --state in-progress \\
      --assignee john@company.com \\
      --subscribers "jane@company.com,bob@company.com" \\
      --labels "feature,security" \\
      --project "Q1 Goals" \\
      --due-date 2025-02-15 \\
      --web

  # Create sub-issue
  $ agent2linear issue create \\
      --title "Write unit tests" \\
      --parent ENG-123 \\
      --team backend

  # Read description from file
  $ agent2linear issue create \\
      --title "API Documentation" \\
      --team backend \\
      --description-file docs/api-spec.md

  # Create unassigned
  $ agent2linear issue create \\
      --title "Research task" \\
      --team backend \\
      --no-assignee

Field Details:
  • Title: Required. The issue title.
  • Team: Required (unless defaultTeam configured). The team this issue belongs to.
  • Auto-assignment: By default, issues are assigned to you. Use --assignee to assign
    to someone else, or --no-assignee to create an unassigned issue.
  • Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  • State: Must belong to the same team. Use workflow state ID or alias.
  • Project: Must belong to the same team. Supports ID, alias, or name lookup.
  • Cycle: Must be a valid UUID or cycle alias.
  • Labels: Comma-separated list. Supports label IDs or aliases.
  • Subscribers: Comma-separated list. Supports member IDs, aliases, emails, or display names.
  • Parent: Creates a sub-issue. Use issue identifier (ENG-123) or UUID.

Member Resolution:
  The --assignee and --subscribers options support multiple resolution methods:
    • Linear ID: user_abc123
    • Alias: john (from your aliases.json)
    • Email: john@company.com (exact match lookup)
    • Display name: "John Doe" (with disambiguation if multiple matches)

Config Defaults:
  • defaultTeam: If set, team becomes optional
  • defaultProject: Used if --project not specified (must belong to same team)

  Set defaults with:
    $ agent2linear config set defaultTeam <team-id>
    $ agent2linear config set defaultProject <project-id>
`)
    .action(async (options) => {
      await createIssueCommand(options);
    });

  issue
    .command('update <identifier>')
    .description('Update an existing Linear issue by identifier (ENG-123) or UUID')
    .option('--title <string>', 'Update issue title')
    .option('--description <string>', 'Update description (markdown)')
    .option('--description-file <path>', 'Read description from file (mutually exclusive with --description)')
    .option('--priority <0-4>', 'Update priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low', parseInt)
    .option('--estimate <number>', 'Update estimate', parseFloat)
    .option('--no-estimate', 'Clear estimate')
    .option('--state <id|alias>', 'Update workflow state (must belong to team)')
    .option('--due-date <YYYY-MM-DD>', 'Set/update due date')
    .option('--no-due-date', 'Clear due date')
    .option('--assignee <id|alias|email|name>', 'Change assignee')
    .option('--no-assignee', 'Remove assignee')
    .option('--team <id|alias>', 'Move to different team (requires compatible state)')
    .option('--project <id|alias|name>', 'Assign to project')
    .option('--no-project', 'Remove from project')
    .option('--cycle <uuid|alias>', 'Assign to cycle')
    .option('--no-cycle', 'Remove from cycle')
    .option('--parent <identifier>', 'Set/change parent issue (ENG-123 or UUID)')
    .option('--no-parent', 'Remove parent (make root issue)')
    .option('--labels <list>', 'Replace ALL labels (comma-separated)')
    .option('--add-labels <list>', 'Add labels (comma-separated)')
    .option('--remove-labels <list>', 'Remove labels (comma-separated)')
    .option('--subscribers <list>', 'Replace ALL subscribers (comma-separated)')
    .option('--add-subscribers <list>', 'Add subscribers (comma-separated)')
    .option('--remove-subscribers <list>', 'Remove subscribers (comma-separated)')
    .option('--trash', 'Move issue to trash')
    .option('--untrash', 'Restore issue from trash')
    .option('-w, --web', 'Open updated issue in browser')
    .option('--dry-run', 'Preview the payload without updating the issue')
    .option('--bulk <identifiers>', 'Apply same update to multiple issues (comma-separated identifiers)')
    .option('--json', 'Output the updated issue + active workspace as JSON')
    .option('-y, --yes', 'Skip the auto-detected-workspace confirmation prompt')
    .addHelpText('after', `
Examples:
  # Update single field
  $ agent2linear issue update ENG-123 --title "New title"
  $ agent2linear issue update ENG-123 --priority 1
  $ agent2linear issue update ENG-123 --state done

  # Update multiple fields
  $ agent2linear issue update ENG-123 \\
      --title "Updated title" \\
      --priority 2 \\
      --estimate 5 \\
      --due-date 2025-12-31

  # Change assignment
  $ agent2linear issue update ENG-123 --assignee john@company.com
  $ agent2linear issue update ENG-123 --no-assignee

  # Label management (3 modes)
  $ agent2linear issue update ENG-123 --labels "bug,urgent"           # Replace all
  $ agent2linear issue update ENG-123 --add-labels "feature"          # Add to existing
  $ agent2linear issue update ENG-123 --remove-labels "wontfix"       # Remove specific
  $ agent2linear issue update ENG-123 --add-labels "new" --remove-labels "old"  # Add + remove

  # Subscriber management (3 modes)
  $ agent2linear issue update ENG-123 --subscribers "user1,user2"     # Replace all
  $ agent2linear issue update ENG-123 --add-subscribers "user3"       # Add to existing
  $ agent2linear issue update ENG-123 --remove-subscribers "user1"    # Remove specific

  # Clear fields
  $ agent2linear issue update ENG-123 --no-assignee --no-due-date --no-estimate
  $ agent2linear issue update ENG-123 --no-project --no-cycle --no-parent

  # Parent relationship
  $ agent2linear issue update ENG-123 --parent ENG-100     # Make sub-issue
  $ agent2linear issue update ENG-123 --no-parent          # Make root issue

  # Move between teams
  $ agent2linear issue update ENG-123 --team frontend --state todo

  # Lifecycle operations
  $ agent2linear issue update ENG-123 --trash              # Move to trash
  $ agent2linear issue update ENG-123 --untrash            # Restore from trash

Field Details:
  • Identifier: Use issue identifier (ENG-123) or UUID
  • At least one update field required (--web alone is not enough)
  • Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  • State: Must belong to the issue's team (or new team if also using --team)

Mutual Exclusivity Rules:
  • Cannot use --description with --description-file
  • Cannot use --labels with --add-labels or --remove-labels
  • Cannot use --subscribers with --add-subscribers or --remove-subscribers
  • Cannot use --assignee with --no-assignee
  • Cannot use --due-date with --no-due-date
  • Cannot use --estimate with --no-estimate
  • Cannot use --project with --no-project
  • Cannot use --cycle with --no-cycle
  • Cannot use --parent with --no-parent
  • Cannot use --trash with --untrash

Label/Subscriber Patterns:
  • Replace mode: --labels or --subscribers replaces ALL items
  • Add mode: --add-labels or --add-subscribers adds to existing
  • Remove mode: --remove-labels or --remove-subscribers removes specific items
  • Add + Remove: Can use --add-labels AND --remove-labels together (add first, then remove)

Team Changes:
  When changing teams (--team), the workflow state must be compatible:
    • If also providing --state, it must belong to the NEW team
    • If NOT providing --state, current state must be compatible with new team
    • Linear will reject invalid team-state combinations

Member Resolution:
  --assignee and --subscribers support multiple resolution methods:
    • Linear ID: user_abc123
    • Alias: john (from aliases.json)
    • Email: john@company.com
    • Display name: "John Doe"
`)
    .action(async (identifier, options) => {
      await updateIssueCommand(identifier, options);
    });

  // Register issue list command (M15.5 Phase 1)
  registerIssueListCommand(issue);

  // Issue prompt alias (M30): a thin alias for `prompt get`, so an agent about to
  // create an issue can fetch the applicable prompt under the `issue` group. Same
  // flags as `prompt get` (--team, --force, --json) and the same shared action.
  issue
    .command('prompt')
    .addArgument(new Argument('[name]', 'Exact prompt name to fetch (highest precedence)'))
    .description('Print the applicable issue prompt (alias for `prompt get`)')
    .option('--team <id|alias>', 'Select the team layer (a promptRule for this team must exist)')
    .option('--force', 'With an explicit --team, take the team prompt first (outranks a location override); error if no rule matches')
    .option('--json', 'Output a machine-readable { name, source, selection, body, context } envelope')
    .addHelpText('after', `
Alias for \`agent2linear prompt get\` — see that command for full selection precedence.

Examples:
  $ agent2linear issue prompt                       # the prompt that applies for the current dir
  $ agent2linear issue prompt payments-issue        # an exact prompt by unique name
  $ agent2linear issue prompt --team payments       # the team-layer prompt for the payments team
  $ agent2linear issue prompt --json                # structured envelope (for agents)
`)
    .action(async (name: string | undefined, options: { json?: boolean; team?: string; force?: boolean }) => {
      await runPromptGet(name, options);
    });

  // Issue comment subcommand
  issue
    .command('comment <identifier>')
    .description('Add a comment to an issue')
    .option('--body <text>', 'Comment body (markdown)')
    .option('--body-file <path>', 'Read comment body from file')
    .addHelpText('after', `
Examples:
  $ agent2linear issue comment ENG-123 --body "This is done"
  $ agent2linear issue comment ENG-123 --body-file notes.md

The identifier can be an issue identifier (ENG-123) or UUID.
Comment body supports markdown formatting.
`)
    .action(async (identifier, options) => {
      await commentIssueCommand(identifier, options);
    });
}
