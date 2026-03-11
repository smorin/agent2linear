/**
 * Issue List Command (M15.5 Phase 3 - FINAL)
 *
 * PHASE 3 SCOPE (Final):
 * - Advanced filters: labels (repeatable), parent/no-parent, cycle, search
 * - Output formats: JSON, TSV (in addition to table)
 * - Sorting: --sort and --order options
 * - Web mode: --web flag
 * - Comprehensive error handling and validation
 */

import type { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { getConfig } from '../../lib/config.js';
import { getEntityCache } from '../../lib/entity-cache.js';
import { resolveIssueIdentifier } from '../../lib/issue-resolver.js';
import { getAllIssues } from '../../lib/linear-client.js';
import { filterColumns,formatContentPreview, showError } from '../../lib/output.js';
import { resolveProjectId } from '../../lib/project-resolver.js';
import type { IssueListFilters, IssueListItem } from '../../lib/types.js';

interface IssueListCommandOptions {
  allAssignees?: boolean;
  assignee?: string;
  team?: string;
  completed?: boolean;
  canceled?: boolean;
  allStates?: boolean;
  archived?: boolean;
  project?: string;
  state?: string;
  priority?: string;
  label?: string | string[];
  parent?: string;
  rootOnly?: boolean;
  cycle?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sort?: string;
  order?: string;
  limit?: string;
  format?: string;
  web?: boolean;
  columns?: string;
}

// ========================================
// HELPER: Build filters with smart defaults
// ========================================
async function buildDefaultFilters(options: IssueListCommandOptions): Promise<IssueListFilters> {
  const config = getConfig();
  const filters: IssueListFilters = {};

  // ========================================
  // ASSIGNEE FILTER (default: current user "me")
  // ========================================
  if (!options.allAssignees) {
    if (options.assignee) {
      const assigneeId = resolveAlias('member', options.assignee);
      filters.assigneeId = assigneeId;
    } else {
      const cache = getEntityCache();
      const currentUser = await cache.getCurrentUser();
      filters.assigneeId = currentUser.id;
    }
  }

  // ========================================
  // TEAM FILTER (default: config.defaultTeam)
  // ========================================
  const teamId = options.team || config.defaultTeam;
  if (teamId) {
    filters.teamId = resolveAlias('team', teamId);
  }

  // ========================================
  // ACTIVE FILTER (default: active issues only)
  // ========================================
  if (options.completed) {
    filters.includeCompleted = true;
    filters.includeCanceled = false;
  } else if (options.canceled) {
    filters.includeCompleted = false;
    filters.includeCanceled = true;
  } else if (options.allStates) {
    filters.includeCompleted = true;
    filters.includeCanceled = true;
  } else {
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
  // EXPLICIT FILTERS (Phase 2 & Phase 3)
  // ========================================

  if (options.project) {
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

  // ========================================
  // PHASE 3: ADVANCED FILTERS
  // ========================================

  // Labels (repeatable option)
  if (options.label) {
    const labels = Array.isArray(options.label) ? options.label : [options.label];
    filters.labelIds = labels.map((l: string) => resolveAlias('issue-label', l));
  }

  // Parent/child relationships
  if (options.parent && options.rootOnly) {
    throw new Error('Cannot specify both --parent and --root-only');
  }

  if (options.parent) {
    const parentResult = await resolveIssueIdentifier(options.parent);
    if (!parentResult) {
      throw new Error(`Parent issue not found: ${options.parent}`);
    }
    filters.parentId = parentResult.issueId;
  } else if (options.rootOnly) {
    filters.hasParent = false;
  }

  // Cycle filter
  if (options.cycle) {
    filters.cycleId = resolveAlias('cycle', options.cycle);
  }

  // Search (full-text)
  if (options.search) {
    filters.search = options.search;
  }

  // Date range filters
  if (options.createdAfter) {
    filters.createdAfter = options.createdAfter;
  }
  if (options.createdBefore) {
    filters.createdBefore = options.createdBefore;
  }
  if (options.updatedAfter) {
    filters.updatedAfter = options.updatedAfter;
  }
  if (options.updatedBefore) {
    filters.updatedBefore = options.updatedBefore;
  }

  // ========================================
  // PHASE 3: SORTING
  // ========================================
  if (options.sort) {
    const validSortFields = ['priority', 'created', 'updated', 'due'];
    if (!validSortFields.includes(options.sort)) {
      throw new Error(
        `Invalid sort field: ${options.sort}. Valid options: ${validSortFields.join(', ')}`
      );
    }
    filters.sortField = options.sort as IssueListFilters['sortField'];
  } else {
    // Default sort: priority descending
    filters.sortField = 'priority';
  }

  if (options.order) {
    const validOrders = ['asc', 'desc'];
    if (!validOrders.includes(options.order)) {
      throw new Error(`Invalid sort order: ${options.order}. Valid options: asc, desc`);
    }
    filters.sortOrder = options.order as 'asc' | 'desc';
  } else {
    // Default order: descending
    filters.sortOrder = 'desc';
  }

  return filters;
}

// ========================================
// HELPER: Format table output
// ========================================
function formatTableOutput(issues: IssueListItem[], descConfig?: { show: boolean; length?: number; full?: boolean }): void {
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }

  const showDesc = descConfig?.show || false;

  // Header - tab-separated
  const header = showDesc
    ? 'Identifier\tTitle\tState\tPriority\tAssignee\tTeam\tDescription'
    : 'Identifier\tTitle\tState\tPriority\tAssignee\tTeam';
  console.log(header);

  // Rows - tab-separated
  for (const issue of issues) {
    const identifier = issue.identifier;
    const title = issue.title.substring(0, 50); // Truncate long titles
    const state = issue.state?.name || '';
    const priority = formatPriority(issue.priority);
    const assignee = issue.assignee?.name || 'Unassigned';
    const team = issue.team?.key || '';

    let row = `${identifier}\t${title}\t${state}\t${priority}\t${assignee}\t${team}`;

    if (showDesc) {
      const desc = descConfig?.full
        ? (issue.description || '').replace(/\t/g, ' ').replace(/\n/g, ' ')
        : formatContentPreview(issue.description, descConfig?.length);
      row += `\t${desc}`;
    }

    console.log(row);
  }
}

// ========================================
// HELPER: Format JSON output
// ========================================
function formatJsonOutput(issues: IssueListItem[]): void {
  console.log(JSON.stringify(issues, null, 2));
}

// ========================================
// HELPER: Format TSV output
// ========================================
function formatTsvOutput(issues: IssueListItem[], descConfig?: { show: boolean; length?: number; full?: boolean }): void {
  const showDesc = descConfig?.show || false;

  // Header
  const header = showDesc
    ? 'identifier\ttitle\tstate\tpriority\tassignee\tteam\turl\tdescription'
    : 'identifier\ttitle\tstate\tpriority\tassignee\tteam\turl';
  console.log(header);

  // Rows
  for (const issue of issues) {
    const identifier = issue.identifier;
    const title = issue.title.replace(/\t/g, ' '); // Remove tabs from title
    const state = issue.state?.name || '';
    const priority = issue.priority !== undefined ? issue.priority.toString() : '';
    const assignee = issue.assignee?.email || '';
    const team = issue.team?.key || '';
    const url = issue.url;

    let row = `${identifier}\t${title}\t${state}\t${priority}\t${assignee}\t${team}\t${url}`;

    if (showDesc) {
      const desc = descConfig?.full
        ? (issue.description || '').replace(/\t/g, ' ').replace(/\n/g, ' ')
        : formatContentPreview(issue.description, descConfig?.length);
      row += `\t${desc}`;
    }

    console.log(row);
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
// HELPER: Build Linear web URL with filters
// ========================================
async function buildLinearWebUrl(filters: IssueListFilters, options: IssueListCommandOptions): Promise<string> {
  // For now, construct a basic URL to the team's active issues view
  // Linear's URL structure for filtered views is complex and not fully documented
  // We'll open to the team view which will show filtered results

  let url = 'https://linear.app';

  // If we have a team filter, we can be more specific
  if (filters.teamId && options.team) {
    // Use team key if available (from alias or direct input)
    url += `/team/${options.team}`;

    // Add filter hints in URL hash/query (Linear uses fragments)
    const params: string[] = [];

    if (filters.priority !== undefined) {
      params.push(`priority=${filters.priority}`);
    }

    if (filters.stateId) {
      params.push(`state=${options.state}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
  }

  return url;
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

  // Phase 3: Advanced filters
  label?: string | string[];
  parent?: string;
  rootOnly?: boolean;
  cycle?: string;
  search?: string;

  // Phase 3: Sorting
  sort?: string;
  order?: string;

  // Phase 3: Output format
  format?: string;

  // Phase 3: Web mode
  web?: boolean;

  // Description preview
  desc?: boolean;
  descLength?: string;
  descFull?: boolean;

  // Column selection
  columns?: string;
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

    // Web mode: open in browser instead of fetching
    if (options.web) {
      const url = await buildLinearWebUrl(filters, options);
      console.log(`Opening Linear in browser: ${url}`);
      await openInBrowser(url);
      return;
    }

    // Fetch issues
    const issues = await getAllIssues(filters);

    // Description display config
    const showDesc = options.desc || options.descFull || !!options.descLength;
    const descConfig = showDesc
      ? {
          show: true,
          length: options.descLength ? parseInt(options.descLength, 10) : undefined,
          full: options.descFull,
        }
      : undefined;

    // Column selection: flatten nested objects for filtering
    const format = options.format || 'table';

    if (options.columns) {
      const cols = options.columns.split(',').map(c => c.trim());
      // Flatten issues for column filtering
      const flattened = issues.map(issue => ({
        identifier: issue.identifier,
        title: issue.title,
        state: issue.state?.name || '',
        priority: issue.priority !== undefined ? formatPriority(issue.priority) : '',
        assignee: issue.assignee?.name || '',
        team: issue.team?.key || '',
        url: issue.url,
        description: issue.description || '',
        id: issue.id,
        estimate: issue.estimate,
        dueDate: issue.dueDate || '',
      }));
      const filtered = filterColumns(flattened, cols);

      if (format === 'json') {
        console.log(JSON.stringify(filtered, null, 2));
      } else {
        // TSV/table with custom columns
        console.log(cols.join('\t'));
        for (const row of filtered) {
          console.log(cols.map(c => String(row[c] ?? '')).join('\t'));
        }
        if (format === 'table') {
          console.log(`\nTotal: ${issues.length} issue(s)`);
        }
      }
      return;
    }

    // Output based on format
    switch (format) {
      case 'json':
        formatJsonOutput(issues);
        break;
      case 'tsv':
        formatTsvOutput(issues, descConfig);
        break;
      case 'table':
      default:
        formatTableOutput(issues, descConfig);
        // Summary only for table format
        console.log(`\nTotal: ${issues.length} issue(s)`);
        break;
    }

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
    .description('List issues with smart defaults, filtering, and multiple output formats')

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

    // Phase 3: Advanced filters
    .option('--label <id|alias>', 'Filter by label (repeatable for multiple labels)', collect, [])
    .option('--parent <identifier>', 'Show sub-issues of a parent issue (ENG-123 or UUID)')
    .option('--root-only', 'Show only root issues (no parent)')
    .option('--cycle <id|alias>', 'Filter by cycle')
    .option('--search <query>', 'Full-text search in issue title and description')

    // Date range filters
    .option('--created-after <date>', 'Filter issues created after date (YYYY-MM-DD)')
    .option('--created-before <date>', 'Filter issues created before date (YYYY-MM-DD)')
    .option('--updated-after <date>', 'Filter issues updated after date (YYYY-MM-DD)')
    .option('--updated-before <date>', 'Filter issues updated before date (YYYY-MM-DD)')

    // Phase 3: Sorting
    .option('--sort <field>', 'Sort by field: priority, created, updated, due (default: priority)')
    .option('--order <direction>', 'Sort order: asc or desc (default: desc)')

    // Phase 3: Output format
    .option('-f, --format <type>', 'Output format: table, json, or tsv (default: table)')

    // Phase 3: Web mode
    .option('-w, --web', 'Open Linear in browser with filters applied instead of listing')

    // Description preview
    .option('--desc', 'Show description preview column (default 80 chars)')
    .option('--desc-length <n>', 'Description preview length in characters (implies --desc)')
    .option('--desc-full', 'Show full description column (no truncation)')
    .option('--no-desc', 'Hide description column')
    .option('--columns <fields>', 'Comma-separated list of columns to display (e.g., "identifier,title,state")')

    .addHelpText('after', `
Smart Defaults (applied automatically unless overridden):
  • Assignee: Current user ("me") - override with --assignee or --all-assignees
  • Team: defaultTeam from config - override with --team
  • Status: Active issues only (triage, backlog, unstarted, started)
  • Archived: Excluded by default - include with --archived
  • Sort: Priority descending - override with --sort and --order

Filter Precedence:
  • Explicit --assignee overrides "me" default (no --all-assignees needed)
  • Explicit --team overrides defaultTeam from config
  • --all-assignees removes assignee filter entirely

Active Filter Definition:
  "Active" issues are those without completion or cancellation timestamps.
  This typically includes workflow states such as:
    • Triage (e.g., "Triage", "Needs Review")
    • Backlog (e.g., "Backlog", "Icebox")
    • Unstarted (e.g., "Todo", "Planned")
    • Started (e.g., "In Progress", "In Review")

  Excluded: Issues marked as completed or canceled

Examples:
  $ agent2linear issue list
  # Shows: Your active issues in default team, sorted by priority

  $ agent2linear issue list --all-assignees
  # Shows: All users' active issues in default team

  $ agent2linear issue list --team backend --completed
  # Shows: Completed issues in backend team

  $ agent2linear issue list --assignee john@company.com --priority 1
  # Shows: Urgent issues assigned to john@company.com

  $ agent2linear issue list --project "Q1 Goals" --all-states
  # Shows: All issues in "Q1 Goals" project (any state)

  $ agent2linear issue list --label bug --label urgent
  # Shows: Issues with both "bug" AND "urgent" labels

  $ agent2linear issue list --parent ENG-123
  # Shows: Sub-issues of ENG-123

  $ agent2linear issue list --root-only --state todo
  # Shows: Root-level Todo issues (no parent)

  $ agent2linear issue list --search "authentication"
  # Shows: Issues containing "authentication" in title or description

  $ agent2linear issue list --cycle current
  # Shows: Issues in the "current" cycle

  $ agent2linear issue list --sort due --order asc
  # Shows: Issues sorted by due date, earliest first

  $ agent2linear issue list --format json | jq '.[] | {id, title, priority}'
  # JSON output for scripting and parsing

  $ agent2linear issue list --format tsv | cut -f1,2
  # TSV output for shell scripting

  $ agent2linear issue list --team backend --priority 1 --web
  # Opens Linear in browser with filters applied

  $ agent2linear issue list --desc
  # Shows issues with a truncated description preview (80 chars)

  $ agent2linear issue list --desc-length 40
  # Shows issues with a shorter description preview (40 chars)

  $ agent2linear issue list --desc-full
  # Shows issues with the full description

Set defaults with:
  $ agent2linear config set defaultTeam <team-id>
`)
    .action(listIssues);
}

// Helper function for commander's repeatable option
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
