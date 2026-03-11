import { Command, Option } from 'commander';

import { addMilestones } from './add-milestones.js';
import { createProjectCommand } from './create.js';
import { listProjectsCommand } from './list.js';
import { updateProjectCommand } from './update.js';
import { viewProject } from './view.js';

export function registerProjectCommands(cli: Command): void {
  const project = cli
    .command('project')
    .alias('proj')
    .description('Manage Linear projects')
    .action(() => {
      project.help();
    });

  project
    .command('create')
    .alias('new')
    .description('Create a new project')
    .option('-I, --interactive', 'Use interactive mode')
    .option('-w, --web', 'Open Linear in browser to create project')
    .option('-t, --title <title>', 'Project title (minimum 3 characters)')
    .option('-d, --description <description>', 'Project description')
    .option('-i, --initiative <id>', 'Initiative ID to link project to (format: init_xxx)')
    .option('--team <id>', 'Team ID to assign project to (format: team_xxx)')
    .option('--template <id>', 'Template ID to use for project creation (format: template_xxx)')
    .option('--status <id>', 'Project status ID (format: status_xxx)')
    .option('--content <markdown>', 'Project content as markdown')
    .option('--content-file <path>', 'Path to file containing project content (markdown)')
    .option('--icon <icon>', 'Project icon name (e.g., "Joystick", "Tree", "Skull" - capitalized)')
    .option('--color <hex>', 'Project color (hex code like #FF6B6B)')
    .option('--lead <id>', 'Project lead user ID (format: user_xxx)')
    .option('--no-lead', 'Do not assign a project lead (overrides auto-assign)')
    .option('--labels <ids>', 'Comma-separated project label IDs (e.g., label_1,label_2)')
    .option('--link <url-and-label>', 'External link as "URL" or "URL|Label" (can be specified multiple times)', (value, previous: string[] = []) => [...previous, value], [])
    .option('--converted-from <id>', 'Issue ID this project was converted from (format: issue_xxx)')
    .option('--start-date <date>', 'Planned start date. Formats: YYYY-MM-DD, Quarter (2025-Q1, Q1 2025), Month (2025-01, Jan 2025), Half-year (2025-H1), Year (2025). Resolution auto-detected from format.')
    .addOption(
      new Option('--start-date-resolution <resolution>', 'Override auto-detected resolution (advanced). Only needed when date format doesn\'t match your intent. Example: --start-date 2025-01-15 --start-date-resolution quarter (mid-month date representing Q1)')
        .choices(['month', 'quarter', 'halfYear', 'year'])
    )
    .option('--target-date <date>', 'Target completion date. Formats: YYYY-MM-DD, Quarter (2025-Q1, Q1 2025), Month (2025-01, Jan 2025), Half-year (2025-H1), Year (2025). Resolution auto-detected from format.')
    .addOption(
      new Option('--target-date-resolution <resolution>', 'Override auto-detected resolution (advanced). Only needed when date format doesn\'t match your intent. Example: --target-date 2025-01-15 --target-date-resolution quarter (mid-month date representing Q1)')
        .choices(['month', 'quarter', 'halfYear', 'year'])
    )
    .addOption(
      new Option('--priority <priority>', 'Project priority')
        .choices(['0', '1', '2', '3', '4'])
        .argParser(parseInt)
    )
    .option('--members <ids>', 'Comma-separated member user IDs (e.g., user_1,user_2)')
    .option('--depends-on <projects>', 'Projects this depends on (comma-separated IDs/aliases) - end→start anchor')
    .option('--blocks <projects>', 'Projects this blocks (comma-separated IDs/aliases) - creates dependencies where other projects depend on this')
    .option('--dependency <spec>', 'Advanced: "project:myAnchor:theirAnchor" (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .option('--dry-run', 'Preview the payload without creating the project')
    .addHelpText('after', `
Examples:
  Basic (auto-assigns you as lead):
  $ agent2linear project create --title "My Project" --team team_xyz789
  $ agent2linear proj new --title "Quick Project" --team team_xyz789  # Same as 'create' (alias)
  $ agent2linear project create --title "Q1 Goals" --initiative init_abc123 --team team_xyz789

  With template:
  $ agent2linear project create --title "API Project" --template template_abc123 --team team_xyz789

  Lead assignment (by default, you are auto-assigned as lead):
  $ agent2linear project create --title "My Project" --team team_xyz789
      # Auto-assigns current user as lead

  $ agent2linear project create --title "My Project" --team team_xyz789 --lead user_abc123
      # Assign specific user as lead

  $ agent2linear project create --title "My Project" --team team_xyz789 --no-lead
      # No lead assignment

  $ agent2linear config set defaultAutoAssignLead false
      # Disable auto-assign globally

  With additional fields:
  $ agent2linear project create --title "Website Redesign" --team team_abc123 \\
      --icon "Tree" --color "#FF6B6B" --lead user_xyz789 \\
      --start-date "2025-01-15" \\
      --target-date "2025-03-31" \\
      --priority 2

  Date formats (flexible, auto-detected resolution):
  $ agent2linear project create --title "Q1 Initiative" --team team_abc123 --start-date "2025-Q1"
      # Creates project with start date: 2025-01-01, resolution: quarter

  $ agent2linear project create --title "January Sprint" --team team_abc123 --start-date "Jan 2025"
      # Creates project with start date: 2025-01-01, resolution: month

  $ agent2linear project create --title "2025 Strategy" --team team_abc123 \\
      --start-date "2025" --target-date "2025-Q4"
      # Start: 2025-01-01 (year), Target: 2025-10-01 (quarter)

  With content and labels:
  $ agent2linear project create --title "Q1 Planning" --team team_abc123 \\
      --content "# Goals\\n- Improve performance\\n- Add features" \\
      --labels "label_1,label_2"

  With content from file:
  $ agent2linear project create --title "API Project" --team team_abc123 \\
      --content-file ./project-plan.md

  With dependencies (simple mode):
  $ agent2linear project create --title "Frontend App" --team team_abc123 \\
      --depends-on "api-backend,infrastructure" \\
      --blocks "testing,deployment"

  With dependencies (advanced mode - custom anchors):
  $ agent2linear project create --title "API v2" --team team_abc123 \\
      --dependency "backend-infra:end:start" \\
      --dependency "database-migration:start:end"

  Interactive mode:
  $ agent2linear project create --interactive

  Open in browser:
  $ agent2linear project create --web

Field Value Formats:
  --status          status_xxx (Linear status ID)
  --content         Inline markdown text
  --content-file    Path to markdown file (mutually exclusive with --content)
  --icon            Capitalized icon name like "Joystick", "Tree", "Skull", "Email", "Checklist"
  --color           #FF6B6B (hex color code)
  --lead            user_xxx (Linear user ID)
  --no-lead         Flag to disable lead assignment
  --labels          label_1,label_2,label_3 (comma-separated)
  --members         user_1,user_2 (comma-separated)
  --priority        0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  --depends-on      proj1,proj2 (my end waits for their start)
  --blocks          proj1,proj2 (their end waits for my start)
  --dependency      project:myAnchor:theirAnchor (advanced: start|end)

Date Formats (--start-date, --target-date):
  Quarters:         2025-Q1, Q1 2025, q1-2025 (case-insensitive)
                    → Q1: 2025-01-01, Q2: 2025-04-01, Q3: 2025-07-01, Q4: 2025-10-01
  Half-years:       2025-H1, H1 2025, h1-2025
                    → H1: 2025-01-01 (Jan-Jun), H2: 2025-07-01 (Jul-Dec)
  Months:           2025-01, Jan 2025, January 2025, 2025-Dec
                    → First day of month (2025-01-01, 2025-12-01)
  Years:            2025
                    → First day of year (2025-01-01)
  ISO dates:        2025-01-15, 2025-03-31
                    → Specific day (no auto-detected resolution)

  Note: Resolution is auto-detected from format. The --*-resolution flags are optional
        and only needed for advanced use cases where you want to override the auto-detection.

Note: Set defaults with config:
  $ agent2linear config set defaultProjectTemplate template_abc123
  $ agent2linear config set defaultAutoAssignLead true  # Enable auto-assign (default)
  $ agent2linear config set defaultAutoAssignLead false  # Disable auto-assign
  $ agent2linear teams select  # Set default team
`)
    .action(async options => {
      await createProjectCommand(options);
    });

  project
    .command('view <name-or-id>')
    .description('View details of a specific project (by name, ID, or alias)')
    .option('-w, --web', 'Open project in browser instead of displaying in terminal')
    .option('-a, --auto-alias', 'Automatically create an alias if resolving by name')
    .option('--desc', 'Show description preview (default 80 chars)')
    .option('--desc-length <n>', 'Description preview length in characters (implies --desc)')
    .option('--desc-full', 'Show full description (no truncation)')
    .option('--no-desc', 'Hide description')
    .addHelpText('after', `
Examples:
  $ agent2linear project view PRJ-123                    # By ID
  $ agent2linear proj view "My Project Name"             # By exact name
  $ agent2linear project view proj_abc123 --web          # By ID, open in browser
  $ agent2linear proj view myalias --web                 # By alias
  $ agent2linear proj view "Project X" --auto-alias      # Create alias automatically
  $ agent2linear project view PRJ-123 --desc             # Show 80-char description preview
  $ agent2linear project view PRJ-123 --desc-full        # Show full description
`)
    .action(async (nameOrId: string, options) => {
      await viewProject(nameOrId, options);
    });

  project
    .command('update <name-or-id>')
    .description('Update project properties')
    .option('--status <name-or-id>', 'Project status (name, ID, or alias)')
    .option('--name <name>', 'Rename project')
    .option('--description <text>', 'Update description')
    .option('--content <markdown>', 'Update content as markdown')
    .option('--content-file <path>', 'Path to file containing project content (markdown)')
    .option('--priority <0-4>', 'Priority level (0-4)', parseInt)
    .option('--target-date <date>', 'Target completion date. Formats: YYYY-MM-DD, Quarter (2025-Q1, Q1 2025), Month (2025-01, Jan 2025), Half-year (2025-H1), Year (2025). Resolution auto-detected from format.')
    .option('--start-date <date>', 'Estimated start date. Formats: YYYY-MM-DD, Quarter (2025-Q1, Q1 2025), Month (2025-01, Jan 2025), Half-year (2025-H1), Year (2025). Resolution auto-detected from format.')
    .option('--color <hex>', 'Project color (hex code like #FF6B6B)')
    .option('--icon <icon>', 'Project icon name (passed directly to Linear API)')
    .option('--lead <id>', 'Project lead (user ID, alias, or email)')
    .option('--members <ids>', 'Comma-separated member IDs, aliases, or emails')
    .option('--labels <ids>', 'Comma-separated project label IDs or aliases')
    .addOption(new Option('--start-date-resolution <resolution>', 'Override auto-detected resolution (advanced). Can be used alone to update resolution without changing date. Example: --start-date 2025-01-15 --start-date-resolution quarter').choices(['month', 'quarter', 'halfYear', 'year']))
    .addOption(new Option('--target-date-resolution <resolution>', 'Override auto-detected resolution (advanced). Can be used alone to update resolution without changing date. Example: --target-date 2025-01-15 --target-date-resolution quarter').choices(['month', 'quarter', 'halfYear', 'year']))
    .option('--link <url-and-label>', 'Add external link as "URL" or "URL|Label" (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .option('--remove-link <url>', 'Remove external link by exact URL match (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .option('--depends-on <projects>', 'Add "depends on" relations (comma-separated IDs/aliases)')
    .option('--blocks <projects>', 'Add "blocks" relations (comma-separated IDs/aliases)')
    .option('--dependency <spec>', 'Add dependency: "project:myAnchor:theirAnchor" (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .option('--remove-depends-on <projects>', 'Remove "depends on" relations (comma-separated IDs/aliases)')
    .option('--remove-blocks <projects>', 'Remove "blocks" relations (comma-separated IDs/aliases)')
    .option('--remove-dependency <project>', 'Remove all dependencies with project (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .option('-w, --web', 'Open project in browser after update')
    .option('--dry-run', 'Preview the payload without updating the project')
    .addHelpText('after', `
Examples:
  $ agent2linear project update "My Project" --status "In Progress"
  $ agent2linear proj update proj_abc --status done --priority 3
  $ agent2linear proj update myalias --name "New Name"

  Update content from file:
  $ agent2linear proj update "My Project" --content-file ./updated-plan.md

  Update with flexible date formats:
  $ agent2linear proj update "Q1 Goals" --status in-progress --priority 2 --target-date "2025-Q1"
  $ agent2linear proj update "My Project" --start-date "Jan 2025" --target-date "2025-H1"
  $ agent2linear proj update "Annual Plan" --start-date "2025" --target-date "2025-12-31"

  Manage external links:
  $ agent2linear proj update "My Project" --link "https://github.com/org/repo|GitHub"
  $ agent2linear proj update "My Project" --remove-link "https://old-link.com"
  $ agent2linear proj update "My Project" --link "https://new.com|New" --remove-link "https://old.com"

  Manage dependencies:
  $ agent2linear proj update "My Project" --depends-on "api-backend,infrastructure"
  $ agent2linear proj update "My Project" --blocks "frontend-app"
  $ agent2linear proj update "My Project" --remove-depends-on "old-dep"
  $ agent2linear proj update "My Project" --dependency "backend:end:start" --remove-depends-on "old-project"

  Open in browser after update:
  $ agent2linear proj update "My Project" --priority 1 --web
`)
    .action(async (nameOrId: string, options) => {
      await updateProjectCommand(nameOrId, options);
    });

  project
    .command('add-milestones <name-or-id>')
    .description('Add milestones to a project using a milestone template')
    .option('-t, --template <name>', 'Milestone template name')
    .addHelpText('after', `
Examples:
  $ agent2linear project add-milestones PRJ-123 --template basic-sprint
  $ agent2linear proj add-milestones "My Project" --template product-launch
  $ agent2linear project add-milestones proj_abc123 -t basic-sprint
  $ agent2linear project add-milestones myalias  # Uses default template from config

Note: Set default template with:
  $ agent2linear config set defaultMilestoneTemplate basic-sprint
`)
    .action(async (projectId: string, options) => {
      await addMilestones(projectId, options);
    });

  // M23: Project Dependencies subcommands
  const projectDeps = project
    .command('dependencies')
    .alias('deps')
    .description('Manage project dependencies (depends-on/blocks relations)')
    .action(() => {
      projectDeps.help();
    });

  projectDeps
    .command('add <name-or-id>')
    .description('Add dependency relations to a project')
    .option('--depends-on <projects>', 'Projects this depends on (comma-separated IDs/aliases) - end→start anchor')
    .option('--blocks <projects>', 'Projects this blocks (comma-separated IDs/aliases) - start→end anchor')
    .option('--dependency <spec>', 'Advanced: "project:myAnchor:theirAnchor" (repeatable)', (value, previous: string[] = []) => [...previous, value], [])
    .addHelpText('after', `
Examples:
  Simple mode (default anchors):
  $ agent2linear project dependencies add "My Project" --depends-on "backend,database"
  $ agent2linear proj deps add PRJ-123 --blocks "frontend,mobile"

  Advanced mode (custom anchors):
  $ agent2linear project deps add "API v2" --dependency "backend:end:start" --dependency "db:start:end"

  Mixed mode:
  $ agent2linear proj deps add myproject --depends-on "backend" --dependency "db:start:start"

Note:
  - --depends-on: Creates end→start relation (my end waits for their start)
  - --blocks: Creates start→end relation (their end waits for my start)
  - --dependency: Custom anchors (start|end)
  - Supports project IDs, names, and aliases
  - Self-referential dependencies are automatically skipped
`)
    .action(async (nameOrId: string, options) => {
      const { addProjectDependencies } = await import('./dependencies/add.js');
      await addProjectDependencies(nameOrId, options);
    });

  projectDeps
    .command('remove <name-or-id>')
    .description('Remove dependency relations from a project')
    .option('--depends-on <projects>', 'Remove "depends on" relations (comma-separated IDs/aliases)')
    .option('--blocks <projects>', 'Remove "blocks" relations (comma-separated IDs/aliases)')
    .option('--relation-id <id>', 'Remove by specific relation ID')
    .option('--with <project>', 'Remove all relations with specified project')
    .addHelpText('after', `
Examples:
  Remove by direction:
  $ agent2linear project dependencies remove "My Project" --depends-on "backend"
  $ agent2linear proj deps remove PRJ-123 --blocks "frontend,mobile"

  Remove by relation ID:
  $ agent2linear proj deps remove "API v2" --relation-id "rel_abc123"

  Remove all relations with a project:
  $ agent2linear project deps remove myproject --with "backend"

  Mixed removal:
  $ agent2linear proj deps remove PRJ-123 --depends-on "backend" --blocks "frontend"

Note:
  - Provide at least one flag (--depends-on, --blocks, --relation-id, or --with)
  - Use "list" command to find relation IDs
`)
    .action(async (nameOrId: string, options) => {
      const { removeProjectDependencies } = await import('./dependencies/remove.js');
      await removeProjectDependencies(nameOrId, options);
    });

  projectDeps
    .command('list <name-or-id>')
    .alias('ls')
    .description('List all dependency relations for a project')
    .option('--direction <type>', 'Filter by direction: depends-on | blocks')
    .addHelpText('after', `
Examples:
  List all dependencies:
  $ agent2linear project dependencies list "My Project"
  $ agent2linear proj deps ls PRJ-123

  Filter by direction:
  $ agent2linear proj deps list "API v2" --direction depends-on
  $ agent2linear project deps ls myproject --direction blocks

Output:
  Shows both "depends-on" and "blocks" relations with:
  - Related project names and IDs
  - Anchor types (start/end)
  - Semantic descriptions
  - Relation IDs (for removal)
`)
    .action(async (nameOrId: string, options) => {
      const { listProjectDependencies } = await import('./dependencies/list.js');
      await listProjectDependencies(nameOrId, options);
    });

  projectDeps
    .command('clear <name-or-id>')
    .description('Remove all dependency relations from a project')
    .option('--direction <type>', 'Clear only specified direction: depends-on | blocks')
    .option('-y, --yes', 'Skip confirmation prompt')
    .addHelpText('after', `
Examples:
  Clear all dependencies (with confirmation):
  $ agent2linear project dependencies clear "My Project"
  $ agent2linear proj deps clear PRJ-123

  Clear specific direction:
  $ agent2linear proj deps clear "API v2" --direction depends-on
  $ agent2linear project deps clear myproject --direction blocks

  Skip confirmation:
  $ agent2linear proj deps clear PRJ-123 --yes
  $ agent2linear project deps clear myproject --direction depends-on -y

Warning:
  This permanently deletes dependency relations. Use with caution.
  Confirmation prompt shown unless --yes flag is provided.
`)
    .action(async (nameOrId: string, options) => {
      const { clearProjectDependencies } = await import('./dependencies/clear.js');
      await clearProjectDependencies(nameOrId, options);
    });

  // Register project list command (M20)
  listProjectsCommand(project);
}
