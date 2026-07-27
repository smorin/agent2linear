import { type Command, Option } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { RuntimeError, UsageError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import type { CursorHistoryJsonValue, CursorHistoryWorkspace } from '../../lib/cursor-history.js';
import {
  buildCursorCommands,
  type CanonicalCommandOption,
  type CursorCommands,
  type CursorHistoryResult,
  recordCursorContinuation,
} from '../../lib/cursor-history-adapter.js';
import { getEntityCache } from '../../lib/entity-cache.js';
import { resolveIssueIdentifier } from '../../lib/issue-resolver.js';
import { getIssueListPage, type IssueListPageResult } from '../../lib/linear-client.js';
import { logger } from '../../lib/logger.js';
import { filterColumns, formatContentPreview, sanitizeTsvCell } from '../../lib/output.js';
import { type OutputMode, resolveOutputMode } from '../../lib/output-mode.js';
import {
  PaginationInputError,
  PaginationRuntimeError,
  parsePageLimit,
  validateRawCursor,
} from '../../lib/pagination.js';
import { resolveProjectId } from '../../lib/project-resolver.js';
import type { IssueListFilters, IssueListItem, WorkspaceResolution } from '../../lib/types.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { workspaceCacheKey } from '../../lib/xdg-paths.js';

export interface IssueListCommandOptions {
  limit?: string;
  all?: boolean;
  after?: string;
  cursorHistory?: boolean;
  assignee?: string;
  allAssignees?: boolean;
  team?: string;
  project?: string;
  state?: string;
  priority?: string;
  active?: boolean;
  completed?: boolean;
  canceled?: boolean;
  allStates?: boolean;
  archived?: boolean;
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
  output?: string;
  json?: boolean;
  format?: string;
  web?: boolean;
  desc?: boolean;
  descLength?: string;
  descFull?: boolean;
  columns?: string;
}

export interface IssueListRunnerDependencies {
  getIssueListPage: typeof getIssueListPage;
  recordCursorContinuation: typeof recordCursorContinuation;
  resolveActiveWorkspace: typeof resolveActiveWorkspace;
  openInBrowser: typeof openInBrowser;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

function defaultRunnerDependencies(): IssueListRunnerDependencies {
  return {
    getIssueListPage,
    recordCursorContinuation,
    resolveActiveWorkspace,
    openInBrowser,
    stdout: value => process.stdout.write(value),
    stderr: value => process.stderr.write(value),
  };
}

async function buildDefaultFilters(options: IssueListCommandOptions): Promise<IssueListFilters> {
  const config = getConfig();
  const filters: IssueListFilters = {};

  if (!options.allAssignees) {
    if (options.assignee) {
      filters.assigneeId = resolveAlias('member', options.assignee);
    } else {
      const cache = getEntityCache();
      const currentUser = await cache.getCurrentUser();
      filters.assigneeId = currentUser.id;
    }
  }

  const teamId = options.team || config.defaultTeam;
  if (teamId) {
    filters.teamId = resolveAlias('team', teamId);
  }

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
  filters.includeArchived = options.archived === true;

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
    if (Number.isNaN(priority) || priority < 0 || priority > 4) {
      throw new UsageError('priority must be a number between 0 (None) and 4 (Low)');
    }
    filters.priority = priority;
  }

  if (options.label) {
    const labels = Array.isArray(options.label) ? options.label : [options.label];
    filters.labelIds = labels.map(label => resolveAlias('issue-label', label));
  }

  if (options.parent && options.rootOnly) {
    throw new UsageError('cannot specify both --parent and --root-only');
  }
  if (options.parent) {
    const parentResult = await resolveIssueIdentifier(options.parent);
    if (!parentResult) {
      throw new RuntimeError(`parent issue not found: ${options.parent}`);
    }
    filters.parentId = parentResult.issueId;
  } else if (options.rootOnly) {
    filters.hasParent = false;
  }

  if (options.cycle) {
    filters.cycleId = resolveAlias('cycle', options.cycle);
  }
  if (options.search) {
    filters.search = options.search;
  }
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

  const validSortFields = ['priority', 'created', 'updated', 'due'] as const;
  if (options.sort && !validSortFields.includes(options.sort as (typeof validSortFields)[number])) {
    throw new UsageError(
      `invalid sort field '${options.sort}'; expected one of: ${validSortFields.join(', ')}`
    );
  }
  filters.sortField = (options.sort ?? 'priority') as IssueListFilters['sortField'];

  const validOrders = ['asc', 'desc'] as const;
  if (options.order && !validOrders.includes(options.order as (typeof validOrders)[number])) {
    throw new UsageError(`invalid sort order '${options.order}'; expected one of: asc, desc`);
  }
  filters.sortOrder = (options.order ?? 'desc') as IssueListFilters['sortOrder'];

  return filters;
}

function writeLine(write: (value: string) => void, value = ''): void {
  write(`${value}\n`);
}

function formatTableOutput(
  issues: IssueListItem[],
  write: (value: string) => void,
  descConfig?: { show: boolean; length?: number; full?: boolean }
): void {
  if (issues.length === 0) {
    writeLine(write, 'No issues found.');
    return;
  }

  const showDesc = descConfig?.show || false;
  writeLine(
    write,
    showDesc
      ? 'Identifier\tTitle\tState\tPriority\tAssignee\tTeam\tDescription'
      : 'Identifier\tTitle\tState\tPriority\tAssignee\tTeam'
  );

  for (const issue of issues) {
    const identifier = issue.identifier;
    const title = issue.title.substring(0, 50);
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
    writeLine(write, row);
  }
}

function formatTsvOutput(
  issues: IssueListItem[],
  write: (value: string) => void,
  descConfig?: { show: boolean; length?: number; full?: boolean }
): void {
  const showDesc = descConfig?.show || false;
  writeLine(
    write,
    showDesc
      ? 'identifier\ttitle\tstate\tpriority\tassignee\tteam\turl\tdescription'
      : 'identifier\ttitle\tstate\tpriority\tassignee\tteam\turl'
  );

  for (const issue of issues) {
    const cells: unknown[] = [
      issue.identifier,
      issue.title,
      issue.state?.name || '',
      issue.priority !== undefined ? issue.priority.toString() : '',
      issue.assignee?.email || '',
      issue.team?.key || '',
      issue.url,
    ];

    if (showDesc) {
      const desc = descConfig?.full
        ? issue.description || ''
        : formatContentPreview(issue.description, descConfig?.length);
      cells.push(desc);
    }
    writeLine(write, cells.map(sanitizeTsvCell).join('\t'));
  }
}

function formatPriority(priority?: number): string {
  if (priority === undefined) return 'None';
  switch (priority) {
    case 0:
      return 'None';
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Normal';
    case 4:
      return 'Low';
    default:
      return 'Unknown';
  }
}

async function buildLinearWebUrl(
  filters: IssueListFilters,
  options: IssueListCommandOptions
): Promise<string> {
  let url = 'https://linear.app';

  if (filters.teamId && options.team) {
    url += `/team/${options.team}`;
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

function issueOutputMode(options: IssueListCommandOptions): OutputMode {
  if (options.output === undefined) {
    return resolveOutputMode({ json: options.json });
  }
  return resolveOutputMode({
    output: options.output,
    outputSource: 'explicit',
    json: options.json,
  });
}

function issuePageLimit(value: string | undefined): number {
  try {
    return parsePageLimit(value);
  } catch (error) {
    if (error instanceof PaginationInputError) {
      throw new UsageError(error.message, { cause: error });
    }
    throw error;
  }
}

function issueRawCursor(value: string | undefined): string | undefined {
  try {
    return validateRawCursor(value);
  } catch (error) {
    if (error instanceof PaginationInputError) {
      throw new UsageError(error.message, { cause: error });
    }
    throw error;
  }
}

function selectedColumns(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(',').map(column => column.trim());
}

function flattenIssues(issues: IssueListItem[]): Array<Record<string, unknown>> {
  return issues.map(issue => ({
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
}

function canonicalCommandOptions(
  filters: IssueListFilters,
  options: IssueListCommandOptions,
  outputMode: OutputMode,
  columns: string[] | undefined
): CanonicalCommandOption[] {
  const result: CanonicalCommandOption[] = [];
  const pushValue = (flag: string, value: string | number | undefined): void => {
    if (value !== undefined) result.push({ flag, value });
  };

  if (filters.assigneeId) {
    pushValue('--assignee', filters.assigneeId);
  } else {
    result.push({ flag: '--all-assignees' });
  }
  pushValue('--team', filters.teamId);
  pushValue('--project', filters.projectId);
  pushValue('--state', filters.stateId);
  pushValue('--priority', filters.priority);
  for (const labelId of filters.labelIds ?? []) {
    pushValue('--label', labelId);
  }
  pushValue('--parent', filters.parentId);
  if (filters.hasParent === false) {
    result.push({ flag: '--root-only' });
  }
  pushValue('--cycle', filters.cycleId);
  pushValue('--search', filters.search);
  pushValue('--created-after', filters.createdAfter);
  pushValue('--created-before', filters.createdBefore);
  pushValue('--updated-after', filters.updatedAfter);
  pushValue('--updated-before', filters.updatedBefore);

  if (filters.includeCompleted && filters.includeCanceled) {
    result.push({ flag: '--all-states' });
  } else if (filters.includeCompleted) {
    result.push({ flag: '--completed' });
  } else if (filters.includeCanceled) {
    result.push({ flag: '--canceled' });
  }
  if (filters.includeArchived) {
    result.push({ flag: '--archived' });
  }

  pushValue('--sort', filters.sortField);
  pushValue('--order', filters.sortOrder);
  pushValue('--output', outputMode);

  if (options.descFull) {
    result.push({ flag: '--desc-full' });
  } else if (options.descLength !== undefined) {
    pushValue('--desc-length', options.descLength);
  } else if (options.desc) {
    result.push({ flag: '--desc' });
  }
  if (columns) {
    pushValue('--columns', columns.join(','));
  }
  if (options.cursorHistory === false) {
    result.push({ flag: '--no-cursor-history' });
  }

  return result;
}

function historyFilters(filters: IssueListFilters): Record<string, CursorHistoryJsonValue> {
  const result: Record<string, CursorHistoryJsonValue> = {};
  const orderingKeys = new Set(['sortField', 'sortOrder', 'limit', 'fetchAll']);

  for (const [key, value] of Object.entries(filters)) {
    if (orderingKeys.has(key) || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = [...value];
    }
  }

  return result;
}

function safeWorkspace(resolver: () => WorkspaceResolution): CursorHistoryWorkspace {
  try {
    const resolution = resolver();
    return {
      key: resolution.key ? workspaceCacheKey(resolution.key) : null,
      id: null,
      name: resolution.name ?? resolution.profile ?? null,
    };
  } catch {
    return { key: null, id: null, name: null };
  }
}

function orderDeclaration(result: IssueListPageResult): string {
  return result.orderBy.direction === null
    ? result.orderBy.field
    : `${result.orderBy.field}:${result.orderBy.direction}`;
}

function historySummary(result: CursorHistoryResult): {
  status: CursorHistoryResult['status'];
  entryId: string | null;
} {
  return { status: result.status, entryId: result.entryId };
}

function historyFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `warning: failed to record cursor history: ${detail}\n`;
}

function renderCursorFooter(
  write: (value: string) => void,
  returnedCount: number,
  commands: CursorCommands,
  history: CursorHistoryResult
): void {
  writeLine(write);
  writeLine(write, `Showing ${returnedCount} issue(s); more are available.`);
  writeLine(write);
  writeLine(write, 'Next page:');
  writeLine(write, `  ${commands.nextCommand}`);
  writeLine(write);
  writeLine(write, 'All remaining:');
  writeLine(write, `  ${commands.allRemainingCommand}`);
  writeLine(write);

  if (history.status === 'recorded') {
    writeLine(write, `Cursor history: ${history.entryId}`);
  } else if (history.status === 'disabled') {
    writeLine(write, 'Cursor history: disabled');
  } else if (history.status === 'failed') {
    writeLine(write, 'Cursor history: unavailable (recording failed)');
  } else {
    writeLine(write, 'Cursor history: not applicable');
  }
}

function renderCustomColumns(
  write: (value: string) => void,
  rows: Array<Record<string, unknown>>,
  columns: string[],
  sanitizeCells = false
): void {
  const cell = sanitizeCells ? sanitizeTsvCell : (value: unknown) => String(value ?? '');
  writeLine(write, columns.map(cell).join('\t'));
  for (const row of rows) {
    writeLine(write, columns.map(column => cell(row[column])).join('\t'));
  }
}

export async function runIssueList(
  options: IssueListCommandOptions,
  dependencyOverrides: Partial<IssueListRunnerDependencies> = {}
): Promise<void> {
  if (options.format !== undefined) {
    throw new UsageError('Legacy -f/--format has been removed; use -o/--output <table|json|tsv>');
  }
  const outputMode = issueOutputMode(options);
  if (options.web && outputMode !== 'table') {
    throw new UsageError('--web cannot be combined with machine-readable output');
  }
  const limit = issuePageLimit(options.limit);
  const after = issueRawCursor(options.after);
  if (options.all && options.limit !== undefined) {
    logger.debug('--all ignores --limit and fetches every remaining issue');
  }
  const dependencies = { ...defaultRunnerDependencies(), ...dependencyOverrides };
  const filters = await buildDefaultFilters(options);

  if (options.web) {
    const url = await buildLinearWebUrl(filters, options);
    writeLine(dependencies.stdout, `Opening Linear in browser: ${url}`);
    await dependencies.openInBrowser(url);
    return;
  }

  let result: IssueListPageResult;
  try {
    result = await dependencies.getIssueListPage(filters, {
      limit,
      after,
      fetchAll: options.all === true,
    });
  } catch (error) {
    if (error instanceof PaginationInputError) {
      throw new UsageError(error.message, { cause: error });
    }
    if (error instanceof PaginationRuntimeError) {
      throw new RuntimeError(error.message, { cause: error });
    }
    throw error;
  }

  const columns = selectedColumns(options.columns);
  const filteredRows = columns ? filterColumns(flattenIssues(result.items), columns) : undefined;
  const outputIssues: unknown[] = filteredRows ?? result.items;
  const truncated = result.pageInfo.hasNextPage && result.pageInfo.endCursor !== null;
  let commands: CursorCommands | null = null;
  let history: CursorHistoryResult;

  if (truncated) {
    commands = buildCursorCommands({
      commandPath: ['issue', 'list'],
      options: canonicalCommandOptions(filters, options, outputMode, columns),
      limit,
      startingAfter: after,
      emittedCursor: result.pageInfo.endCursor as string,
    });

    if (options.cursorHistory === false) {
      history = { status: 'disabled', entryId: null };
    } else {
      try {
        history = await dependencies.recordCursorContinuation({
          disabled: false,
          pageInfo: result.pageInfo,
          entry: {
            workspace: safeWorkspace(dependencies.resolveActiveWorkspace),
            commandPath: 'issue list',
            resource: 'issue',
            target: null,
            filters: historyFilters(filters),
            orderBy: orderDeclaration(result),
            limit,
            commands,
          },
        });
      } catch (error) {
        history = { status: 'failed', entryId: null, error };
      }
    }
  } else {
    history =
      options.cursorHistory === false
        ? { status: 'disabled', entryId: null }
        : { status: 'not_applicable', entryId: null };
  }

  if (history.status === 'failed') {
    dependencies.stderr(historyFailureMessage(history.error));
  }

  const showDesc = options.desc || options.descFull || !!options.descLength;
  const descConfig = showDesc
    ? {
        show: true,
        length: options.descLength ? parseInt(options.descLength, 10) : undefined,
        full: options.descFull,
      }
    : undefined;

  if (outputMode === 'json') {
    dependencies.stdout(
      `${JSON.stringify(
        {
          issues: outputIssues,
          pageInfo: result.pageInfo,
          cursorHistory: historySummary(history),
        },
        null,
        2
      )}\n`
    );
    return;
  }

  if (columns && filteredRows) {
    renderCustomColumns(dependencies.stdout, filteredRows, columns, outputMode === 'tsv');
  } else if (outputMode === 'tsv') {
    formatTsvOutput(result.items, dependencies.stdout, descConfig);
  } else {
    formatTableOutput(result.items, dependencies.stdout, descConfig);
  }

  if (outputMode === 'table') {
    writeLine(dependencies.stdout);
    writeLine(dependencies.stdout, `Total: ${result.items.length} issue(s)`);
    if (truncated && commands) {
      renderCursorFooter(dependencies.stdout, result.pageInfo.returnedCount, commands, history);
    }
  } else if (truncated) {
    const historyHint = history.entryId
      ? ` continuation is in cursor-history entry ${history.entryId};`
      : '';
    dependencies.stderr(
      `warning: more issues are available;${historyHint} rerun with --output json or inspect cursor-history for continuation details\n`
    );
  }
}

export function registerIssueListCommand(program: Command): void {
  program
    .command('list')
    .description('List issues with smart defaults, filtering, and multiple output formats')
    .option('-l, --limit <number>', 'Maximum number of issues to return (default: 50, max: 250)')
    .option('-a, --all', 'Fetch every remaining issue using pagination')
    .option('--after <cursor>', 'Resume after the exact raw Linear cursor')
    .option('--no-cursor-history', 'Do not persist an emitted continuation cursor')
    .option('--assignee <id|alias|email>', 'Filter by assignee (overrides default "me")')
    .option('--all-assignees', 'Show issues for all assignees (removes default "me" filter)')
    .option('--team <id|alias>', 'Filter by team (overrides defaultTeam from config)')
    .option('--project <id|alias|name>', 'Filter by project')
    .option('--state <id|alias>', 'Filter by workflow state')
    .option('--priority <0-4>', 'Filter by priority (0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)')
    .option(
      '--active',
      'Show only active issues (triage, backlog, unstarted, started) - default behavior'
    )
    .option('--completed', 'Show only completed issues')
    .option('--canceled', 'Show only canceled issues')
    .option('--all-states', 'Show issues in all states (active, completed, canceled)')
    .option('--archived', 'Include archived issues (default: exclude archived)')
    .option('--label <id|alias>', 'Filter by label (repeatable for multiple labels)', collect, [])
    .option('--parent <identifier>', 'Show sub-issues of a parent issue (ENG-123 or UUID)')
    .option('--root-only', 'Show only root issues (no parent)')
    .option('--cycle <id|alias>', 'Filter by cycle')
    .option('--search <query>', 'Full-text search in issue title and description')
    .option('--created-after <date>', 'Filter issues created after date (YYYY-MM-DD)')
    .option('--created-before <date>', 'Filter issues created before date (YYYY-MM-DD)')
    .option('--updated-after <date>', 'Filter issues updated after date (YYYY-MM-DD)')
    .option('--updated-before <date>', 'Filter issues updated before date (YYYY-MM-DD)')
    .option('--sort <field>', 'Sort by field: priority, created, updated, due (default: priority)')
    .option('--order <direction>', 'Sort order: asc or desc (default: desc)')
    .addOption(new Option('-f, --format <type>').hideHelp())
    .option('-o, --output <table|json|tsv>', 'Output format: table, json, or tsv (default: table)')
    .option('--json', 'Equivalent to --output json')
    .option('-w, --web', 'Open Linear in browser with filters applied instead of listing')
    .option('--desc', 'Show description preview column (default 80 chars)')
    .option('--desc-length <n>', 'Description preview length in characters (implies --desc)')
    .option('--desc-full', 'Show full description column (no truncation)')
    .option('--no-desc', 'Hide description column')
    .option(
      '--columns <fields>',
      'Comma-separated list of columns to display (e.g., "identifier,title,state")'
    )
    .addHelpText(
      'after',
      `
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

Pagination:
  • The default returns at most 50 issues and prints a continuation when more exist
  • Copy the displayed --after cursor to request the next page
  • --all fetches every remaining issue, including after --after
  • --no-cursor-history keeps the cursor out of local history

Examples:
  $ agent2linear issue list
  $ agent2linear issue list --all-assignees
  $ agent2linear issue list --team backend --completed
  $ agent2linear issue list --assignee john@company.com --priority 1
  $ agent2linear issue list --project "Q1 Goals" --all-states
  $ agent2linear issue list --label bug --label urgent
  $ agent2linear issue list --parent ENG-123
  $ agent2linear issue list --root-only --state todo
  $ agent2linear issue list --search "authentication"
  $ agent2linear issue list --cycle current
  $ agent2linear issue list --sort due --order asc
  $ agent2linear issue list --output json | jq '.issues[] | {id, title, priority}'
  $ agent2linear issue list --output tsv | cut -f1,2
  $ agent2linear issue list --limit 50 --after '<raw-linear-cursor>'
  $ agent2linear issue list --after '<raw-linear-cursor>' --all
  $ agent2linear issue list --team backend --priority 1 --web
  $ agent2linear issue list --desc
  $ agent2linear issue list --desc-length 40
  $ agent2linear issue list --desc-full

Set defaults with:
  $ agent2linear config set defaultTeam <team-id>
`
    )
    .action((options: IssueListCommandOptions) => runIssueList(options));
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
