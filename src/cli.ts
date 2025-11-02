import { Command, Option, Argument } from 'commander';
import { listConfig } from './commands/config/list.js';
import { getConfigValue } from './commands/config/get.js';
import type { ConfigKey } from './lib/config.js';
import { setConfig } from './commands/config/set.js';
import { unsetConfig } from './commands/config/unset.js';
import { editConfig } from './commands/config/edit.js';
import { listInitiatives } from './commands/initiatives/list.js';
import { viewInitiative } from './commands/initiatives/view.js';
import { selectInitiative } from './commands/initiatives/select.js';
import { setInitiative } from './commands/initiatives/set.js';
import { syncInitiativeAliases } from './commands/initiatives/sync-aliases.js';
import { createProjectCommand } from './commands/project/create.js';
import { viewProject } from './commands/project/view.js';
import { updateProjectCommand } from './commands/project/update.js';
import { listProjectsCommand } from './commands/project/list.js';
import { listTeams } from './commands/teams/list.js';
import { selectTeam } from './commands/teams/select.js';
import { setTeam } from './commands/teams/set.js';
import { viewTeam } from './commands/teams/view.js';
import { syncTeamAliases } from './commands/teams/sync-aliases.js';
import { listProjectStatuses } from './commands/project-status/list.js';
import { viewProjectStatus } from './commands/project-status/view.js';
import { syncProjectStatusAliases } from './commands/project-status/sync-aliases.js';
import { addAliasCommand } from './commands/alias/add.js';
import { listAliasCommand } from './commands/alias/list.js';
import { removeAliasCommand } from './commands/alias/remove.js';
import { getAliasCommand } from './commands/alias/get.js';
import { editAlias } from './commands/alias/edit.js';
import { aliasSyncCommand } from './commands/alias/sync.js';
import { clearAliasCommand } from './commands/alias/clear.js';
import { listTemplates } from './commands/templates/list.js';
import { viewTemplate } from './commands/templates/view.js';
import { listMembers } from './commands/members/list.js';
import { syncMemberAliases } from './commands/members/sync-aliases.js';
import { listMilestoneTemplates } from './commands/milestone-templates/list.js';
import { viewMilestoneTemplate } from './commands/milestone-templates/view.js';
import { createTemplate } from './commands/milestone-templates/create.js';
import { createTemplateInteractive } from './commands/milestone-templates/create-interactive.js';
import { removeTemplate } from './commands/milestone-templates/remove.js';
import { editTemplateInteractive } from './commands/milestone-templates/edit-interactive.js';
import { addMilestones } from './commands/project/add-milestones.js';
import { listWorkflowStates } from './commands/workflow-states/list.js';
import { viewWorkflowState } from './commands/workflow-states/view.js';
import { createWorkflowStateCommand } from './commands/workflow-states/create.js';
import { updateWorkflowStateCommand } from './commands/workflow-states/update.js';
import { deleteWorkflowStateCommand } from './commands/workflow-states/delete.js';
import { syncWorkflowStateAliases } from './commands/workflow-states/sync-aliases.js';
import { listIssueLabels } from './commands/issue-labels/list.js';
import { viewIssueLabel } from './commands/issue-labels/view.js';
import { createIssueLabelCommand } from './commands/issue-labels/create.js';
import { updateIssueLabelCommand } from './commands/issue-labels/update.js';
import { deleteIssueLabelCommand } from './commands/issue-labels/delete.js';
import { syncIssueLabelAliases } from './commands/issue-labels/sync-aliases.js';
import { listProjectLabels } from './commands/project-labels/list.js';
import { viewProjectLabel } from './commands/project-labels/view.js';
import { createProjectLabelCommand } from './commands/project-labels/create.js';
import { updateProjectLabelCommand } from './commands/project-labels/update.js';
import { deleteProjectLabelCommand } from './commands/project-labels/delete.js';
import { syncProjectLabelAliases } from './commands/project-labels/sync-aliases.js';
import { listIcons } from './commands/icons/list.js';
import { viewIcon } from './commands/icons/view.js';
import { extractIcons } from './commands/icons/extract.js';
import { listColors } from './commands/colors/list.js';
import { viewColor } from './commands/colors/view.js';
import { extractColors } from './commands/colors/extract.js';
import { showCacheStats } from './commands/cache/stats.js';
import { clearCache } from './commands/cache/clear.js';
import { setup } from './commands/setup.js';
import { viewIssue } from './commands/issue/view.js';
import { createIssueCommand } from './commands/issue/create.js';
import { updateIssueCommand } from './commands/issue/update.js';
import { registerIssueListCommand } from './commands/issue/list.js';

const cli = new Command();

cli
  .name('linear-create')
  .description('Command-line tool for creating Linear issues and projects')
  .version('0.24.0-rc.1')
  .action(() => {
    cli.help();
  });

// Initiatives commands
const initiatives = cli
  .command('initiatives')
  .alias('init')
  .description('Manage Linear initiatives')
  .action(() => {
    initiatives.help();
  });

initiatives
  .command('list')
  .alias('ls')
  .description('List all initiatives')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear in browser to view initiatives')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives list              # Print list to stdout (default TSV)
  $ linear-create init ls                        # Same as 'list' (alias)
  $ linear-create initiatives list --interactive # Browse interactively
  $ linear-create initiatives list --web         # Open in browser
  $ linear-create initiatives list --format json # Output as JSON
  $ linear-create initiatives list --format tsv  # Output as TSV (explicit)
  $ linear-create init list -f json | jq '.[0]'  # Pipe to jq
`)
  .action(async (options) => {
    await listInitiatives(options);
  });

initiatives
  .command('view [id]')
  .description('View details of a specific initiative (format: init_xxx)')
  .option('-I, --interactive', 'Use interactive mode to select initiative')
  .option('-w, --web', 'Open initiative in browser instead of displaying in terminal')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives view init_abc123
  $ linear-create init view init_abc123
  $ linear-create initiatives view init_abc123 --web
  $ linear-create init view myalias --web
  $ linear-create init view --interactive        # Select from list
  $ linear-create init view -I                   # Select and view in terminal
  $ linear-create init view -I --web             # Select and open in browser
`)
  .action(async (id: string | undefined, options) => {
    await viewInitiative(id, options);
  });

initiatives
  .command('select')
  .description('Interactively select a default initiative')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives select                # Interactive selection
  $ linear-create initiatives select --project      # Save to project config
`)
  .action(async (options) => {
    await selectInitiative(options);
  });

initiatives
  .command('set <id>')
  .description('Set default initiative by ID (non-interactive)')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .addHelpText('after', `
Examples:
  $ linear-create initiatives set init_abc123
  $ linear-create initiatives set backend        # Using alias
  $ linear-create initiatives set init_xyz789 --project
`)
  .action(async (id: string, options) => {
    await setInitiative(id, options);
  });

syncInitiativeAliases(initiatives);

// Project commands
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
  .addHelpText('after', `
Examples:
  Basic (auto-assigns you as lead):
  $ linear-create project create --title "My Project" --team team_xyz789
  $ linear-create proj new --title "Quick Project" --team team_xyz789  # Same as 'create' (alias)
  $ linear-create project create --title "Q1 Goals" --initiative init_abc123 --team team_xyz789

  With template:
  $ linear-create project create --title "API Project" --template template_abc123 --team team_xyz789

  Lead assignment (by default, you are auto-assigned as lead):
  $ linear-create project create --title "My Project" --team team_xyz789
      # Auto-assigns current user as lead

  $ linear-create project create --title "My Project" --team team_xyz789 --lead user_abc123
      # Assign specific user as lead

  $ linear-create project create --title "My Project" --team team_xyz789 --no-lead
      # No lead assignment

  $ linear-create config set defaultAutoAssignLead false
      # Disable auto-assign globally

  With additional fields:
  $ linear-create project create --title "Website Redesign" --team team_abc123 \\
      --icon "Tree" --color "#FF6B6B" --lead user_xyz789 \\
      --start-date "2025-01-15" \\
      --target-date "2025-03-31" \\
      --priority 2

  Date formats (flexible, auto-detected resolution):
  $ linear-create project create --title "Q1 Initiative" --team team_abc123 --start-date "2025-Q1"
      # Creates project with start date: 2025-01-01, resolution: quarter

  $ linear-create project create --title "January Sprint" --team team_abc123 --start-date "Jan 2025"
      # Creates project with start date: 2025-01-01, resolution: month

  $ linear-create project create --title "2025 Strategy" --team team_abc123 \\
      --start-date "2025" --target-date "2025-Q4"
      # Start: 2025-01-01 (year), Target: 2025-10-01 (quarter)

  With content and labels:
  $ linear-create project create --title "Q1 Planning" --team team_abc123 \\
      --content "# Goals\\n- Improve performance\\n- Add features" \\
      --labels "label_1,label_2"

  With content from file:
  $ linear-create project create --title "API Project" --team team_abc123 \\
      --content-file ./project-plan.md

  With dependencies (simple mode):
  $ linear-create project create --title "Frontend App" --team team_abc123 \\
      --depends-on "api-backend,infrastructure" \\
      --blocks "testing,deployment"

  With dependencies (advanced mode - custom anchors):
  $ linear-create project create --title "API v2" --team team_abc123 \\
      --dependency "backend-infra:end:start" \\
      --dependency "database-migration:start:end"

  Interactive mode:
  $ linear-create project create --interactive

  Open in browser:
  $ linear-create project create --web

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
  $ linear-create config set defaultProjectTemplate template_abc123
  $ linear-create config set defaultAutoAssignLead true  # Enable auto-assign (default)
  $ linear-create config set defaultAutoAssignLead false  # Disable auto-assign
  $ linear-create teams select  # Set default team
`)
  .action(async options => {
    await createProjectCommand(options);
  });

project
  .command('view <name-or-id>')
  .description('View details of a specific project (by name, ID, or alias)')
  .option('-w, --web', 'Open project in browser instead of displaying in terminal')
  .option('-a, --auto-alias', 'Automatically create an alias if resolving by name')
  .addHelpText('after', `
Examples:
  $ linear-create project view PRJ-123                    # By ID
  $ linear-create proj view "My Project Name"             # By exact name
  $ linear-create project view proj_abc123 --web          # By ID, open in browser
  $ linear-create proj view myalias --web                 # By alias
  $ linear-create proj view "Project X" --auto-alias      # Create alias automatically
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
  .addHelpText('after', `
Examples:
  $ linear-create project update "My Project" --status "In Progress"
  $ linear-create proj update proj_abc --status done --priority 3
  $ linear-create proj update myalias --name "New Name"

  Update content from file:
  $ linear-create proj update "My Project" --content-file ./updated-plan.md

  Update with flexible date formats:
  $ linear-create proj update "Q1 Goals" --status in-progress --priority 2 --target-date "2025-Q1"
  $ linear-create proj update "My Project" --start-date "Jan 2025" --target-date "2025-H1"
  $ linear-create proj update "Annual Plan" --start-date "2025" --target-date "2025-12-31"

  Manage external links:
  $ linear-create proj update "My Project" --link "https://github.com/org/repo|GitHub"
  $ linear-create proj update "My Project" --remove-link "https://old-link.com"
  $ linear-create proj update "My Project" --link "https://new.com|New" --remove-link "https://old.com"

  Manage dependencies:
  $ linear-create proj update "My Project" --depends-on "api-backend,infrastructure"
  $ linear-create proj update "My Project" --blocks "frontend-app"
  $ linear-create proj update "My Project" --remove-depends-on "old-dep"
  $ linear-create proj update "My Project" --dependency "backend:end:start" --remove-depends-on "old-project"

  Open in browser after update:
  $ linear-create proj update "My Project" --priority 1 --web
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
  $ linear-create project add-milestones PRJ-123 --template basic-sprint
  $ linear-create proj add-milestones "My Project" --template product-launch
  $ linear-create project add-milestones proj_abc123 -t basic-sprint
  $ linear-create project add-milestones myalias  # Uses default template from config

Note: Set default template with:
  $ linear-create config set defaultMilestoneTemplate basic-sprint
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
  $ linear-create project dependencies add "My Project" --depends-on "backend,database"
  $ linear-create proj deps add PRJ-123 --blocks "frontend,mobile"

  Advanced mode (custom anchors):
  $ linear-create project deps add "API v2" --dependency "backend:end:start" --dependency "db:start:end"

  Mixed mode:
  $ linear-create proj deps add myproject --depends-on "backend" --dependency "db:start:start"

Note:
  - --depends-on: Creates end→start relation (my end waits for their start)
  - --blocks: Creates start→end relation (their end waits for my start)
  - --dependency: Custom anchors (start|end)
  - Supports project IDs, names, and aliases
  - Self-referential dependencies are automatically skipped
`)
  .action(async (nameOrId: string, options) => {
    const { addProjectDependencies } = await import('./commands/project/dependencies/add.js');
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
  $ linear-create project dependencies remove "My Project" --depends-on "backend"
  $ linear-create proj deps remove PRJ-123 --blocks "frontend,mobile"

  Remove by relation ID:
  $ linear-create proj deps remove "API v2" --relation-id "rel_abc123"

  Remove all relations with a project:
  $ linear-create project deps remove myproject --with "backend"

  Mixed removal:
  $ linear-create proj deps remove PRJ-123 --depends-on "backend" --blocks "frontend"

Note:
  - Provide at least one flag (--depends-on, --blocks, --relation-id, or --with)
  - Use "list" command to find relation IDs
`)
  .action(async (nameOrId: string, options) => {
    const { removeProjectDependencies } = await import('./commands/project/dependencies/remove.js');
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
  $ linear-create project dependencies list "My Project"
  $ linear-create proj deps ls PRJ-123

  Filter by direction:
  $ linear-create proj deps list "API v2" --direction depends-on
  $ linear-create project deps ls myproject --direction blocks

Output:
  Shows both "depends-on" and "blocks" relations with:
  - Related project names and IDs
  - Anchor types (start/end)
  - Semantic descriptions
  - Relation IDs (for removal)
`)
  .action(async (nameOrId: string, options) => {
    const { listProjectDependencies } = await import('./commands/project/dependencies/list.js');
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
  $ linear-create project dependencies clear "My Project"
  $ linear-create proj deps clear PRJ-123

  Clear specific direction:
  $ linear-create proj deps clear "API v2" --direction depends-on
  $ linear-create project deps clear myproject --direction blocks

  Skip confirmation:
  $ linear-create proj deps clear PRJ-123 --yes
  $ linear-create project deps clear myproject --direction depends-on -y

Warning:
  This permanently deletes dependency relations. Use with caution.
  Confirmation prompt shown unless --yes flag is provided.
`)
  .action(async (nameOrId: string, options) => {
    const { clearProjectDependencies } = await import('./commands/project/dependencies/clear.js');
    await clearProjectDependencies(nameOrId, options);
  });

// Register project list command (M20)
listProjectsCommand(project);

// Issues commands (stub - coming in v0.5.0)
const issues = cli
  .command('issues')
  .alias('iss')
  .description('Manage Linear issues [Coming Soon]')
  .action(() => {
    issues.help();
  });

issues
  .command('create')
  .alias('new')
  .description('Create a new issue [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

issues
  .command('list')
  .alias('ls')
  .description('List issues [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

// Teams commands
const teams = cli
  .command('teams')
  .alias('team')
  .description('Manage Linear teams')
  .action(() => {
    teams.help();
  });

teams
  .command('list')
  .alias('ls')
  .description('List all teams')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear in browser to view teams')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .addHelpText('after', `
Examples:
  $ linear-create teams list              # Print list to stdout (formatted)
  $ linear-create team ls                 # Same as 'list' (alias)
  $ linear-create teams list --interactive # Browse interactively
  $ linear-create teams list --web        # Open in browser
  $ linear-create teams list --format json # Output as JSON
  $ linear-create teams list --format tsv  # Output as TSV
  $ linear-create team list -f tsv | cut -f1  # Get just team IDs
`)
  .action(async (options) => {
    await listTeams(options);
  });

teams
  .command('select')
  .description('Interactively select a default team')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .addHelpText('after', `
Examples:
  $ linear-create teams select                # Interactive selection
  $ linear-create teams select --project      # Save to project config
`)
  .action(async (options) => {
    await selectTeam(options);
  });

teams
  .command('set <id>')
  .description('Set default team by ID (non-interactive)')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .addHelpText('after', `
Examples:
  $ linear-create teams set team_abc123
  $ linear-create teams set eng              # Using alias
  $ linear-create teams set team_abc123 --project
`)
  .action(async (id: string, options) => {
    await setTeam(id, options);
  });

teams
  .command('view <id>')
  .description('View details of a specific team')
  .option('-w, --web', 'Open team in browser instead of displaying in terminal')
  .addHelpText('after', `
Examples:
  $ linear-create teams view team_abc123
  $ linear-create team view team_abc123
  $ linear-create teams view team_abc123 --web
  $ linear-create team view eng --web
`)
  .action(async (id: string, options) => {
    await viewTeam(id, options);
  });

syncTeamAliases(teams);

// Members commands
const members = cli
  .command('members')
  .alias('users')
  .description('Manage Linear members/users')
  .action(() => {
    members.help();
  });

members
  .command('list')
  .alias('ls')
  .description('List members in your organization or team')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear members page in browser')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .option('--team <id>', 'Filter by team (uses default team if not specified)')
  .option('--org-wide', 'List all organization members (ignore team filter)')
  .option('--name <search>', 'Filter by name')
  .option('--email <search>', 'Filter by email')
  .option('--active', 'Show only active members')
  .option('--inactive', 'Show only inactive members')
  .option('--admin', 'Show only admin users')
  .addHelpText('after', `
Examples:
  $ linear-create members list                    # List default team members
  $ linear-create users ls                        # Same as 'list' (alias)
  $ linear-create members list --org-wide         # List all organization members
  $ linear-create members list --team team_abc123 # List specific team members
  $ linear-create members list --name John        # Filter by name
  $ linear-create members list --email @acme.com  # Filter by email domain
  $ linear-create members list --active           # Show only active members
  $ linear-create members list --admin            # Show only admins
  $ linear-create members list --interactive      # Browse interactively
  $ linear-create members list --web              # Open in browser
  $ linear-create members list --format json      # Output as JSON
  $ linear-create members list --format tsv       # Output as TSV
  $ linear-create members list -f tsv | cut -f1   # Get just member IDs

Note: By default, uses your configured default team. Use --org-wide to see all members.
  $ linear-create config set defaultTeam team_xxx  # Set default team
`)
  .action(async (options) => {
    await listMembers(options);
  });

syncMemberAliases(members);

// Project Status commands
const projectStatus = cli
  .command('project-status')
  .alias('pstatus')
  .description('Manage Linear project statuses')
  .action(() => {
    projectStatus.help();
  });

projectStatus
  .command('list')
  .alias('ls')
  .description('List all project statuses')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear project settings in browser')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .addHelpText('after', `
Examples:
  $ linear-create project-status list              # Print list to stdout (formatted)
  $ linear-create pstatus ls                       # Same as 'list' (alias)
  $ linear-create project-status list --interactive # Browse interactively
  $ linear-create project-status list --web        # Open in browser
  $ linear-create project-status list --format json # Output as JSON
  $ linear-create project-status list --format tsv  # Output as TSV
  $ linear-create pstatus list -f tsv | cut -f1    # Get just status IDs
`)
  .action(async (options) => {
    await listProjectStatuses(options);
  });

projectStatus
  .command('view <name-or-id>')
  .description('View details of a specific project status')
  .option('-w, --web', 'Open project settings in browser instead of displaying in terminal')
  .addHelpText('after', `
Examples:
  $ linear-create project-status view "In Progress"
  $ linear-create pstatus view status_abc123
  $ linear-create project-status view planned --web
  $ linear-create pstatus view active-status --web  # Using alias
`)
  .action(async (nameOrId: string, options) => {
    await viewProjectStatus(nameOrId, options);
  });

projectStatus
  .command('sync-aliases')
  .description('Create aliases for all org project statuses')
  .option('-g, --global', 'Save to global config (default)')
  .option('-p, --project', 'Save to project config')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--force', 'Override existing aliases')
  .addHelpText('after', `
Examples:
  $ linear-create project-status sync-aliases           # Create global aliases
  $ linear-create pstatus sync-aliases --project        # Create project-local aliases
  $ linear-create project-status sync-aliases --dry-run # Preview changes
  $ linear-create pstatus sync-aliases --force          # Force override existing

This command will create aliases for all project statuses in your workspace,
using the status name converted to lowercase with hyphens (e.g., "In Progress" → "in-progress").
`)
  .action(async (options) => {
    await syncProjectStatusAliases(options);
  });

// Alias commands
const alias = cli
  .command('alias')
  .description('Manage aliases for initiatives, teams, projects, project statuses, templates, and members')
  .action(() => {
    alias.help();
  });

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
  $ linear-create alias add initiative backend init_abc123xyz
  $ linear-create alias add team frontend team_def456uvw --project
  $ linear-create alias add project api proj_ghi789rst
  $ linear-create alias add project-status in-progress status_abc123
  $ linear-create alias add issue-template bug-report template_abc123
  $ linear-create alias add project-template sprint-template template_xyz789
  $ linear-create alias add issue-label bug label_abc123def
  $ linear-create alias add project-label release label_ghi456jkl
  $ linear-create alias add workflow-state done state_mno789pqr
  $ linear-create alias add member john user_abc123def

  Member by exact email (auto-select):
  $ linear-create alias add member john --email john.doe@acme.com
  $ linear-create alias add user jane --email jane@acme.com

  Member by partial email (error if multiple matches):
  $ linear-create alias add member john --email @acme.com
  # Error: Multiple members found. Use --interactive to select.

  Member by email with interactive selection:
  $ linear-create alias add member john --email @acme.com --interactive
  $ linear-create alias add member john --email john@ --interactive

  Member by name with interactive selection:
  $ linear-create alias add member john --name John --interactive
  $ linear-create alias add member jane --name "Jane Smith" --interactive

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
  $ linear-create alias list                    # List all aliases
  $ linear-create alias ls                      # Same as 'list' (alias)
  $ linear-create alias list initiative         # List only initiative aliases
  $ linear-create alias list team               # List only team aliases
  $ linear-create alias list project            # List only project aliases
  $ linear-create alias list project-status     # List only project status aliases
  $ linear-create alias list issue-template     # List only issue template aliases
  $ linear-create alias list project-template   # List only project template aliases
  $ linear-create alias list issue-label        # List only issue label aliases
  $ linear-create alias list project-label      # List only project label aliases
  $ linear-create alias list workflow-state     # List only workflow state aliases
  $ linear-create alias list member             # List only member aliases
  $ linear-create alias list user               # List only user/member aliases
  $ linear-create alias list --validate         # Validate all aliases
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
  $ linear-create alias remove initiative backend
  $ linear-create alias rm team frontend --project
  $ linear-create alias remove project-status in-progress
  $ linear-create alias remove issue-template bug-report
  $ linear-create alias rm project-template sprint-template
  $ linear-create alias remove issue-label bug
  $ linear-create alias remove project-label release
  $ linear-create alias remove workflow-state done
  $ linear-create alias remove member john
  $ linear-create alias rm user jane
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
  $ linear-create alias get initiative backend
  $ linear-create alias get team frontend
  $ linear-create alias get project-status in-progress
  $ linear-create alias get issue-template bug-report
  $ linear-create alias get project-template sprint-template
  $ linear-create alias get issue-label bug
  $ linear-create alias get project-label release
  $ linear-create alias get workflow-state done
  $ linear-create alias get member john
  $ linear-create alias get user jane
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
  $ linear-create alias edit           # Interactive mode (choose scope interactively)
  $ linear-create alias edit --global  # Edit global aliases directly
  $ linear-create alias edit --project # Edit project aliases directly

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
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--dry-run', 'Preview what would be cleared without actually clearing')
  .addHelpText('after', `
Examples:
  # Preview what would be cleared
  $ linear-create alias clear team --dry-run
  $ linear-create alias clear member --project --dry-run

  # Clear with confirmation
  $ linear-create alias clear team --global
  $ linear-create alias clear project-status --project

  # Clear without confirmation
  $ linear-create alias clear initiative --force
  $ linear-create alias clear member --project --force

Warning: This will remove ALL aliases of the specified type from the chosen scope.
         Use --dry-run first to preview what will be removed.
`)
  .action(async (type: string, options) => {
    await clearAliasCommand(type, options);
  });

aliasSyncCommand(alias);

// Milestones commands (stub - future release)
const milestones = cli
  .command('milestones')
  .alias('mile')
  .description('Manage project milestones [Coming Soon]')
  .action(() => {
    milestones.help();
  });

milestones
  .command('list')
  .alias('ls')
  .description('List milestones [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

// Labels commands (stub - future release)
const labels = cli
  .command('labels')
  .alias('lbl')
  .description('Manage issue labels [Coming Soon]')
  .action(() => {
    labels.help();
  });

labels
  .command('list')
  .alias('ls')
  .description('List labels [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

// Milestone Templates commands
const milestoneTemplates = cli
  .command('milestone-templates')
  .alias('mtmpl')
  .description('Manage milestone templates for projects')
  .action(() => {
    milestoneTemplates.help();
  });

milestoneTemplates
  .command('list')
  .alias('ls')
  .description('List all available milestone templates')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .addHelpText('after', `
Examples:
  $ linear-create milestone-templates list              # List all templates (grouped by source)
  $ linear-create mtmpl ls                               # Same as 'list' (alias)
  $ linear-create milestone-templates list --format json # Output as JSON (flat list)
  $ linear-create milestone-templates list --format tsv  # Output as TSV (flat list)
  $ linear-create mtmpl list -f tsv | cut -f1            # Get just template names
`)
  .action(async (options?: { format?: 'tsv' | 'json' }) => {
    await listMilestoneTemplates(options || {});
  });

milestoneTemplates
  .command('view <name>')
  .description('View details of a specific milestone template')
  .addHelpText('after', `
Examples:
  $ linear-create milestone-templates view basic-sprint
  $ linear-create mtmpl view product-launch
`)
  .action(async (name: string) => {
    await viewMilestoneTemplate(name);
  });

milestoneTemplates
  .command('create [name]')
  .description('Create a new milestone template')
  .option('-g, --global', 'Create in global scope (default)')
  .option('-p, --project', 'Create in project scope')
  .option('-d, --description <text>', 'Template description')
  .option('-m, --milestone <spec>', 'Milestone spec (name:targetDate:description)', (value, previous: string[] = []) => [...previous, value], [])
  .option('-I, --interactive', 'Use interactive mode')
  .addHelpText('after', `
Examples:
  # Interactive mode (recommended) - name collected interactively
  $ linear-create milestone-templates create --interactive
  $ linear-create mtmpl create -I

  # Non-interactive mode - name required as argument
  $ linear-create milestone-templates create basic-sprint \\
      --description "Simple 2-week sprint" \\
      --milestone "Planning:+1d:Define sprint goals" \\
      --milestone "Development:+10d:Implementation phase" \\
      --milestone "Review:+14d:Code review and deployment"

  # Project scope
  $ linear-create milestone-templates create --project --interactive

Note: Milestone spec format is "name:targetDate:description"
  - name: Required
  - targetDate: Optional (+7d, +2w, +1m, or ISO date)
  - description: Optional (markdown supported)
`)
  .action(async (name: string | undefined, options) => {
    if (options.interactive) {
      // In interactive mode, name is collected interactively
      await createTemplateInteractive(options);
    } else {
      if (!name) {
        console.error('❌ Error: Template name is required in non-interactive mode\n');
        console.error('Provide a name:');
        console.error('  $ linear-create milestone-templates create my-template --milestone ...\n');
        console.error('Or use interactive mode:');
        console.error('  $ linear-create milestone-templates create --interactive\n');
        process.exit(1);
      }
      await createTemplate(name, options);
    }
  });

milestoneTemplates
  .command('edit <name>')
  .description('Edit an existing milestone template (interactive only)')
  .option('-g, --global', 'Edit in global scope')
  .option('-p, --project', 'Edit in project scope')
  .addHelpText('after', `
Examples:
  $ linear-create milestone-templates edit basic-sprint
  $ linear-create mtmpl edit product-launch --global

Note: If no scope is specified, the template will be edited in its current scope.
`)
  .action(async (name: string, options) => {
    await editTemplateInteractive(name, options);
  });

milestoneTemplates
  .command('remove <name>')
  .alias('rm')
  .description('Remove a milestone template')
  .option('-g, --global', 'Remove from global scope')
  .option('-p, --project', 'Remove from project scope')
  .option('-y, --yes', 'Skip confirmation prompt')
  .addHelpText('after', `
Examples:
  $ linear-create milestone-templates remove basic-sprint
  $ linear-create mtmpl rm product-launch --yes
  $ linear-create milestone-templates remove my-sprint --project

Note: If no scope is specified, the template will be removed from its current scope.
`)
  .action(async (name: string, options) => {
    await removeTemplate(name, options);
  });

// Templates commands
const templates = cli
  .command('templates')
  .alias('tmpl')
  .description('Manage Linear templates')
  .action(() => {
    templates.help();
  });

templates
  .command('list [type]')
  .alias('ls')
  .description('List all templates or filter by type (issue/project)')
  .option('-I, --interactive', 'Use interactive mode for browsing')
  .option('-w, --web', 'Open Linear templates page in browser')
  .option('-f, --format <type>', 'Output format: tsv, json')
  .addHelpText('after', `
Examples:
  $ linear-create templates list              # List all templates (grouped by type)
  $ linear-create tmpl ls                      # Same as 'list' (alias)
  $ linear-create templates list issues        # List only issue templates
  $ linear-create templates list projects      # List only project templates
  $ linear-create templates list --interactive # Browse interactively
  $ linear-create templates list --web         # Open in browser
  $ linear-create templates list --format json # Output as JSON (flat list)
  $ linear-create templates list --format tsv  # Output as TSV (flat list)
  $ linear-create tmpl list -f tsv | grep issue  # Filter issue templates
`)
  .action(async (type?: string, options?: { interactive?: boolean; web?: boolean; format?: 'tsv' | 'json' }) => {
    await listTemplates(type, options || {});
  });

templates
  .command('view <id>')
  .description('View details of a specific template')
  .option('-w, --web', 'Open templates page in browser (templates do not have individual URLs)')
  .addHelpText('after', `
Examples:
  $ linear-create templates view template_abc123
  $ linear-create tmpl view template_xyz789
  $ linear-create templates view template_abc123 --web
  $ linear-create tmpl view mytemplate --web
`)
  .action(async (id: string, options) => {
    await viewTemplate(id, options);
  });

// Config commands
const config = cli
  .command('config')
  .alias('cfg')
  .description('Manage configuration settings for linear-create')
  .addHelpText('before', `
Current respected settings:
- \`apiKey\`: Linear API authentication key (get yours at linear.app/settings/api)
- \`defaultInitiative\`: Default initiative ID for project creation (format: init_xxx)
- \`defaultTeam\`: Default team ID for project creation (format: team_xxx)
- \`defaultIssueTemplate\`: Default template ID for issue creation (format: template_xxx)
- \`defaultProjectTemplate\`: Default template ID for project creation (format: template_xxx)
- \`defaultMilestoneTemplate\`: Default milestone template name for project milestones
- \`projectCacheMinTTL\`: Cache time-to-live in minutes (default: 60, range: 1-1440)

Configuration files:
- Global:  ~/.config/linear-create/config.json
- Project: .linear-create/config.json
- Priority: environment > project > global (for apiKey)
            project > global (for other settings)
`)
  .addHelpText('after', `
Related Commands:
  $ linear-create initiatives select   # Interactive initiative picker
  $ linear-create teams select         # Interactive team picker

Learn More:
  Get your Linear API key at: https://linear.app/settings/api
`)
  .action(() => {
    config.help();
  });

config
  .command('list')
  .alias('show')
  .description('List all configuration values')
  .addHelpText('after', `
Examples:
  $ linear-create config list  # Display all config values and sources
  $ linear-create cfg show     # Same as 'list' (alias for backward compatibility)
`)
  .action(async () => {
    await listConfig();
  });

config
  .command('get')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL'])
  )
  .description('Get a single configuration value')
  .addHelpText('after', `
Examples:
  $ linear-create config get apiKey
  $ linear-create cfg get defaultInitiative
  $ linear-create cfg get defaultProjectTemplate
  $ linear-create cfg get defaultMilestoneTemplate
  $ linear-create cfg get projectCacheMinTTL
`)
  .action(async (key: string) => {
    await getConfigValue(key as ConfigKey);
  });

config
  .command('set')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL'])
  )
  .addArgument(new Argument('<value>', 'Configuration value'))
  .description('Set a configuration value')
  .option('-g, --global', 'Set in global config (default)')
  .option('-p, --project', 'Set in project config')
  .addHelpText('after', `
Examples:
  $ linear-create config set apiKey lin_api_xxx...
  $ linear-create config set defaultInitiative init_abc123 --global
  $ linear-create config set defaultTeam team_xyz789 --project
  $ linear-create config set defaultProjectTemplate template_abc123
  $ linear-create config set defaultMilestoneTemplate basic-sprint
  $ linear-create config set projectCacheMinTTL 120  # Cache for 2 hours
`)
  .action(async (key: string, value: string, options) => {
    await setConfig(key, value, options);
  });

config
  .command('unset')
  .addArgument(
    new Argument('<key>', 'Configuration key')
      .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL'])
  )
  .description('Remove a configuration value')
  .option('-g, --global', 'Remove from global config (default)')
  .option('-p, --project', 'Remove from project config')
  .addHelpText('after', `
Examples:
  $ linear-create config unset apiKey --global
  $ linear-create config unset defaultTeam --project
  $ linear-create config unset defaultProjectTemplate
  $ linear-create config unset defaultMilestoneTemplate
  $ linear-create config unset projectCacheMinTTL
`)
  .action(async (key: string, options) => {
    await unsetConfig(key, options);
  });

config
  .command('edit')
  .description('Edit configuration interactively')
  .option('-g, --global', 'Edit global config (skip scope prompt)')
  .option('-p, --project', 'Edit project config (skip scope prompt)')
  .option('--key <key>', 'Configuration key to edit (non-interactive)')
  .option('--value <value>', 'Configuration value (requires --key, non-interactive)')
  .addHelpText('after', `
Examples:
  $ linear-create config edit                      # Interactive multi-value editing
  $ linear-create config edit --global             # Edit global config interactively
  $ linear-create config edit --key apiKey --value lin_api_xxx  # Non-interactive single value
  $ linear-create cfg edit                         # Same as 'config edit' (alias)
`)
  .action(async (options) => {
    await editConfig(options);
  });

// Workflow States commands
const workflowStates = cli
  .command('workflow-states')
  .alias('wstate')
  .alias('ws')
  .description('Manage workflow states (issue statuses)');

listWorkflowStates(workflowStates);
viewWorkflowState(workflowStates);
createWorkflowStateCommand(workflowStates);
updateWorkflowStateCommand(workflowStates);
deleteWorkflowStateCommand(workflowStates);
syncWorkflowStateAliases(workflowStates);

// Issue Labels commands
const issueLabels = cli
  .command('issue-labels')
  .alias('ilbl')
  .description('Manage issue labels');

listIssueLabels(issueLabels);
viewIssueLabel(issueLabels);
createIssueLabelCommand(issueLabels);
updateIssueLabelCommand(issueLabels);
deleteIssueLabelCommand(issueLabels);
syncIssueLabelAliases(issueLabels);

// Project Labels commands
const projectLabels = cli
  .command('project-labels')
  .alias('plbl')
  .description('Manage project labels');

listProjectLabels(projectLabels);
viewProjectLabel(projectLabels);
createProjectLabelCommand(projectLabels);
updateProjectLabelCommand(projectLabels);
deleteProjectLabelCommand(projectLabels);
syncProjectLabelAliases(projectLabels);

// Icons commands
const icons = cli
  .command('icons')
  .description('Browse and manage icons');

listIcons(icons);
viewIcon(icons);
extractIcons(icons);

// Colors commands
const colors = cli
  .command('colors')
  .description('Browse and manage colors');

listColors(colors);
viewColor(colors);
extractColors(colors);

// Cache commands
const cache = cli
  .command('cache')
  .description('Manage entity cache')
  .addHelpText('before', `
The cache system reduces API calls by storing frequently accessed entities in memory:
- Teams
- Initiatives
- Members
- Templates
- Issue Labels
- Project Labels

Cache configuration can be managed via config commands:
- \`entityCacheMinTTL\`: Cache time-to-live in minutes (default: 60)
- \`enableEntityCache\`: Enable/disable entity caching (default: true)
- \`enableSessionCache\`: Enable/disable in-memory cache (default: true)
- \`enableBatchFetching\`: Enable/disable parallel API calls (default: true)
- \`prewarmCacheOnCreate\`: Auto-prewarm on project create (default: true)
`)
  .addHelpText('after', `
Examples:
  $ linear-create cache stats             # View cache statistics
  $ linear-create cache clear             # Clear all cached entities
  $ linear-create cache clear --entity teams  # Clear specific entity type

Related Commands:
  $ linear-create config set entityCacheMinTTL 120  # Set 2-hour cache TTL
  $ linear-create config set enableEntityCache false  # Disable caching
`)
  .action(() => {
    cache.help();
  });

cache
  .command('stats')
  .description('Show cache statistics')
  .addHelpText('after', `
Examples:
  $ linear-create cache stats  # Display cache status and configuration

This will show:
  • Cache configuration (enabled/disabled features)
  • Entity cache status (cached items, age)
  • Cache TTL settings
`)
  .action(async () => {
    await showCacheStats();
  });

cache
  .command('clear')
  .description('Clear cached entities')
  .option('--entity <type>', 'Clear specific entity type (teams, initiatives, members, templates, issue-labels, project-labels)')
  .addHelpText('after', `
Examples:
  $ linear-create cache clear                 # Clear all cached entities
  $ linear-create cache clear --entity teams  # Clear only teams cache

Cache will be automatically repopulated on next access.
`)
  .action(async (options) => {
    await clearCache(options);
  });

// Issue commands (M15.2)
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
  .addHelpText('after', `
Examples:
  $ linear-create issue view ENG-123                    # View issue by identifier
  $ linear-create issue view <uuid>                     # View issue by UUID
  $ linear-create issue view ENG-123 --json             # Output as JSON
  $ linear-create issue view ENG-123 --web              # Open in browser
  $ linear-create issue view ENG-123 --show-comments    # Include comments
  $ linear-create issue view ENG-123 --show-history     # Include history

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
  .addHelpText('after', `
Examples:
  # Minimal (uses defaultTeam, auto-assigns to you)
  $ linear-create issue create --title "Fix login bug"

  # Standard creation
  $ linear-create issue create \\
      --title "Add OAuth support" \\
      --team backend \\
      --priority 2 \\
      --estimate 8

  # Full-featured creation
  $ linear-create issue create \\
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
  $ linear-create issue create \\
      --title "Write unit tests" \\
      --parent ENG-123 \\
      --team backend

  # Read description from file
  $ linear-create issue create \\
      --title "API Documentation" \\
      --team backend \\
      --description-file docs/api-spec.md

  # Create unassigned
  $ linear-create issue create \\
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
    $ linear-create config set defaultTeam <team-id>
    $ linear-create config set defaultProject <project-id>
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
  .addHelpText('after', `
Examples:
  # Update single field
  $ linear-create issue update ENG-123 --title "New title"
  $ linear-create issue update ENG-123 --priority 1
  $ linear-create issue update ENG-123 --state done

  # Update multiple fields
  $ linear-create issue update ENG-123 \\
      --title "Updated title" \\
      --priority 2 \\
      --estimate 5 \\
      --due-date 2025-12-31

  # Change assignment
  $ linear-create issue update ENG-123 --assignee john@company.com
  $ linear-create issue update ENG-123 --no-assignee

  # Label management (3 modes)
  $ linear-create issue update ENG-123 --labels "bug,urgent"           # Replace all
  $ linear-create issue update ENG-123 --add-labels "feature"          # Add to existing
  $ linear-create issue update ENG-123 --remove-labels "wontfix"       # Remove specific
  $ linear-create issue update ENG-123 --add-labels "new" --remove-labels "old"  # Add + remove

  # Subscriber management (3 modes)
  $ linear-create issue update ENG-123 --subscribers "user1,user2"     # Replace all
  $ linear-create issue update ENG-123 --add-subscribers "user3"       # Add to existing
  $ linear-create issue update ENG-123 --remove-subscribers "user1"    # Remove specific

  # Clear fields
  $ linear-create issue update ENG-123 --no-assignee --no-due-date --no-estimate
  $ linear-create issue update ENG-123 --no-project --no-cycle --no-parent

  # Parent relationship
  $ linear-create issue update ENG-123 --parent ENG-100     # Make sub-issue
  $ linear-create issue update ENG-123 --no-parent          # Make root issue

  # Move between teams
  $ linear-create issue update ENG-123 --team frontend --state todo

  # Lifecycle operations
  $ linear-create issue update ENG-123 --trash              # Move to trash
  $ linear-create issue update ENG-123 --untrash            # Restore from trash

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

// Setup command
cli
  .command('setup')
  .description('Interactive first-time setup wizard')
  .addHelpText('after', `
Examples:
  $ linear-create setup    # Run interactive setup wizard

This command will guide you through:
  • Setting up your Linear API key
  • Selecting your default team
  • Configuring optional defaults
  • Learning about key commands
`)
  .action(async () => {
    await setup();
  });

export { cli };
