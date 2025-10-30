/**
 * Issue List Command (M15.5 Phase 2)
 *
 * PHASE 2 SCOPE:
 * - Smart defaults (assignee=me, defaultTeam, defaultInitiative, active only)
 * - Override flags (--all-assignees, etc.)
 * - Primary filters (team, assignee, project, initiative, state, priority)
 * - Status filters (active, completed, canceled, all-states, archived)
 * - Filter precedence logic
 */

import type { Command } from 'commander';
import { getAllIssues } from '../../lib/linear-client.js';
import { showError } from '../../lib/output.js';
import { getConfig } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';
import { resolveProjectId } from '../../lib/project-resolver.js';
import { getEntityCache } from '../../lib/entity-cache.js';
import type { IssueListFilters, IssueListItem } from '../../lib/types.js';

// ========================================
// HELPER: Build filters with smart defaults
// ========================================
async function buildDefaultFilters(options: any): Promise<IssueListFilters> {
  const config = getConfig();
  const filters: IssueListFilters = {};

  // ========================================
  // ASSIGNEE FILTER (default: current user "me")
  // ========================================
  // Precedence:
  // 1. If --all-assignees provided: no filter (show all)
  // 2. If explicit --assignee provided: use it (overrides "me")
  // 3. Otherwise: default to current user ("me")
  if (!options.allAssignees) {
    if (options.assignee) {
      // Explicit assignee specified - resolve it
      const assigneeId = resolveAlias('member', options.assignee);
      filters.assigneeId = assigneeId;
    } else {
      // Default: current user is the assignee (cached)
      const cache = getEntityCache();
      const currentUser = await cache.getCurrentUser();
      filters.assigneeId = currentUser.id;
    }
  }
  // If --all-assignees: don't set assigneeId filter (show all assignees)

  // ========================================
  // TEAM FILTER (default: config.defaultTeam)
  // ========================================
  // Precedence:
  // 1. If explicit --team provided: use it (overrides defaultTeam)
  // 2. Otherwise: use defaultTeam from config (if set)
  const teamId = options.team || config.defaultTeam;
  if (teamId) {
    filters.teamId = resolveAlias('team', teamId);
  }

  // ========================================
  // INITIATIVE FILTER (deferred to Phase 3)
  // ========================================
  // Note: Linear's IssueFilter doesn't support direct initiative filtering
  // We would need to fetch projects in initiative first, then filter by projectIds
  // For Phase 2, we'll skip this and add in Phase 3 if needed
  // const initiativeId = options.initiative || config.defaultInitiative;

  // ========================================
  // ACTIVE FILTER (default: active issues only)
  // ========================================
  // Active = workflow states with type: triage, backlog, unstarted, started
  // Excludes: completed, canceled
  // Note: Archived issues handled separately
  //
  // Status filter precedence:
  // 1. If --completed: show only completed
  // 2. If --canceled: show only canceled
  // 3. If --all-states: show all states (no filter)
  // 4. If --active or no status flag: show active only (default)
  if (options.completed) {
    // Only completed issues
    filters.includeCompleted = true;
    filters.includeCanceled = false;
  } else if (options.canceled) {
    // Only canceled issues
    filters.includeCompleted = false;
    filters.includeCanceled = true;
  } else if (options.allStates) {
    // All states (no filtering by state type)
    filters.includeCompleted = true;
    filters.includeCanceled = true;
  } else {
    // Default: active only (triage, backlog, unstarted, started)
    filters.includeCompleted = false;
    filters.includeCanceled = false;
  }

  // Archived filter (separate from state type)
  if (options.archived) {
    filters.includeArchived = true;
  } else {
    filters.includeArchived = false;
  }

  // ========================================
  // EXPLICIT FILTERS (no defaults, only if specified)
  // ========================================

  if (options.project) {
    // Project can be ID, alias, or name - use resolver
    const projectId = await resolveProjectId(options.project);
    if (projectId) {
      filters.projectId = projectId;
    }
  }

  if (options.state) {
    filters.stateId = resolveAlias('workflow-state', options.state);
  }

  if (options.priority !== undefined) {
    const priority = parseInt(options.priority, 10);
    if (isNaN(priority) || priority < 0 || priority > 4) {
      throw new Error('Priority must be a number between 0 (None) and 4 (Low)');
    }
    filters.priority = priority;
  }

  return filters;
}

// ========================================
// HELPER: Format table output
// ========================================
function formatTableOutput(issues: IssueListItem[]): void {
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }

  // Header - tab-separated
  console.log('Identifier\tTitle\tState\tPriority\tAssignee\tTeam');

  // Rows - tab-separated
  for (const issue of issues) {
    const identifier = issue.identifier;
    const title = issue.title.substring(0, 50); // Truncate long titles
    const state = issue.state?.name || '';
    const priority = formatPriority(issue.priority);
    const assignee = issue.assignee?.name || 'Unassigned';
    const team = issue.team?.key || '';

    console.log(
      `${identifier}\t${title}\t${state}\t${priority}\t${assignee}\t${team}`
    );
  }
}

// ========================================
// HELPER: Format priority
// ========================================
function formatPriority(priority?: number): string {
  if (priority === undefined) return 'None';
  switch (priority) {
    case 0: return 'None';
    case 1: return 'Urgent';
    case 2: return 'High';
    case 3: return 'Normal';
    case 4: return 'Low';
    default: return 'Unknown';
  }
}

// ========================================
// COMMAND HANDLER
// ========================================
async function listIssues(options: {
  // Pagination
  limit?: string;
  all?: boolean;

  // Smart defaults with overrides
  assignee?: string;
  allAssignees?: boolean;
  team?: string;

  // Primary filters
  project?: string;
  state?: string;
  priority?: string;

  // Status filters
  active?: boolean;
  completed?: boolean;
  canceled?: boolean;
  allStates?: boolean;
  archived?: boolean;
}): Promise<void> {
  try {
    // Build filters with smart defaults
    const filters = await buildDefaultFilters(options);

    // Pagination options
    if (options.all) {
      filters.fetchAll = true;
      filters.limit = 250; // Use max page size for --all
    } else if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit < 1) {
        throw new Error('Limit must be a positive number');
      }
      if (limit > 250) {
        throw new Error('Limit cannot exceed 250 (Linear API maximum)');
      }
      filters.limit = limit;
    } else {
      filters.limit = 50; // Default
    }

    // Fetch issues
    const issues = await getAllIssues(filters);

    // Output
    formatTableOutput(issues);

    // Summary
    console.log(`\nTotal: ${issues.length} issue(s)`);

  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// ========================================
// COMMAND REGISTRATION
// ========================================
export function registerIssueListCommand(program: Command): void {
  program
    .command('list')
    .description('List issues with smart defaults and filtering')

    // Pagination
    .option('-l, --limit <number>', 'Maximum number of issues to return (default: 50, max: 250)')
    .option('-a, --all', 'Fetch all issues using pagination (may take longer)')

    // Smart defaults with overrides
    .option('--assignee <id|alias|email>', 'Filter by assignee (overrides default "me")')
    .option('--all-assignees', 'Show issues for all assignees (removes default "me" filter)')
    .option('--team <id|alias>', 'Filter by team (overrides defaultTeam from config)')

    // Primary filters
    .option('--project <id|alias|name>', 'Filter by project')
    .option('--state <id|alias>', 'Filter by workflow state')
    .option('--priority <0-4>', 'Filter by priority (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)')

    // Status filters
    .option('--active', 'Show only active issues (triage, backlog, unstarted, started) - default behavior')
    .option('--completed', 'Show only completed issues')
    .option('--canceled', 'Show only canceled issues')
    .option('--all-states', 'Show issues in all states (active, completed, canceled)')
    .option('--archived', 'Include archived issues (default: exclude archived)')

    .addHelpText('after', `
Smart Defaults (applied automatically unless overridden):
  • Assignee: Current user ("me") - override with --assignee or --all-assignees
  • Team: defaultTeam from config - override with --team
  • Status: Active issues only (triage, backlog, unstarted, started)
  • Archived: Excluded by default - include with --archived

Filter Precedence:
  • Explicit --assignee overrides "me" default (no --all-assignees needed)
  • Explicit --team overrides defaultTeam from config
  • --all-assignees removes assignee filter entirely

Active Filter Definition:
  "Active" issues include workflow states with type:
    • triage (e.g., "Triage", "Needs Review")
    • backlog (e.g., "Backlog", "Icebox")
    • unstarted (e.g., "Todo", "Planned")
    • started (e.g., "In Progress", "In Review")

  "Active" explicitly excludes:
    • completed (e.g., "Done", "Shipped")
    • canceled (e.g., "Canceled", "Duplicate")

Examples:
  $ linear-create issue list
  # Shows: Your active issues in default team

  $ linear-create issue list --all-assignees
  # Shows: All users' active issues in default team

  $ linear-create issue list --team backend --completed
  # Shows: Completed issues in backend team

  $ linear-create issue list --assignee john@company.com --priority 1
  # Shows: Urgent issues assigned to john@company.com

  $ linear-create issue list --project "Q1 Goals" --all-states
  # Shows: All issues in "Q1 Goals" project (any state)

  $ linear-create issue list --state in-progress --limit 100
  # Shows: Up to 100 issues in "in-progress" state

Set defaults with:
  $ linear-create config set defaultTeam <team-id>
`)
    .action(listIssues);
}
