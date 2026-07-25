import { type Command, Option } from 'commander';
import { Box, render, Text } from 'ink';
import React from 'react';

import { resolveAlias } from '../../lib/aliases.js';
import { RuntimeError, UsageError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import type { CursorHistoryJsonValue } from '../../lib/cursor-history.js';
import {
  buildCursorCommands,
  type CanonicalCommandOption,
  type CursorCommands,
  type CursorHistoryResult,
  recordCursorContinuation,
} from '../../lib/cursor-history-adapter.js';
import { getEntityCache } from '../../lib/entity-cache.js';
import { getProjectListPage, PROJECT_LIST_ORDER } from '../../lib/linear-client.js';
import { logger } from '../../lib/logger.js';
import { filterColumns, formatContentPreview } from '../../lib/output.js';
import { type OutputMode, resolveOutputMode } from '../../lib/output-mode.js';
import {
  type PageInfo,
  PaginationInputError,
  parsePageLimit,
  validateRawCursor,
} from '../../lib/pagination.js';
import type { ProjectListFilters, ProjectListItem } from '../../lib/types.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { workspaceCacheKey } from '../../lib/xdg-paths.js';

interface ProjectListCommandOptions {
  after?: string;
  all?: boolean;
  allInitiatives?: boolean;
  allLeads?: boolean;
  allTeams?: boolean;
  blocksOthers?: boolean;
  columns?: string;
  cursorHistory?: boolean;
  dependsOnOthers?: boolean;
  desc?: boolean;
  descFull?: boolean;
  descLength?: string;
  format?: string;
  hasDependencies?: boolean;
  initiative?: string;
  interactive?: boolean;
  json?: boolean;
  label?: string;
  lead?: string;
  limit?: string;
  member?: string;
  output?: string;
  priority?: string;
  search?: string;
  showDependencies?: boolean;
  startAfter?: string;
  startBefore?: string;
  status?: string;
  targetAfter?: string;
  targetBefore?: string;
  team?: string;
  web?: boolean;
  withoutDependencies?: boolean;
}

interface DescriptionConfig {
  full?: boolean;
  hide?: boolean;
  length?: number;
}

interface PublicCursorHistory {
  status: CursorHistoryResult['status'];
  entryId: string | null;
}

interface PaginationPresentation {
  commands: CursorCommands | null;
  cursorHistory: PublicCursorHistory;
}

interface DependencyFilterOptions {
  blocksOthers?: boolean;
  dependsOnOthers?: boolean;
  hasDependencies?: boolean;
  withoutDependencies?: boolean;
}

async function buildDefaultFilters(
  options: ProjectListCommandOptions
): Promise<ProjectListFilters> {
  const config = getConfig();
  const filters: ProjectListFilters = {};

  if (!options.allLeads) {
    if (options.lead) {
      filters.leadId = resolveAlias('member', options.lead);
    } else {
      const cache = getEntityCache();
      const currentUser = await cache.getCurrentUser();
      filters.leadId = currentUser.id;
    }
  }

  if (!options.allTeams) {
    const teamId = options.team || config.defaultTeam;
    if (teamId) filters.teamId = resolveAlias('team', teamId);
  }

  if (!options.allInitiatives) {
    const initiativeId = options.initiative || config.defaultInitiative;
    if (initiativeId) filters.initiativeId = resolveAlias('initiative', initiativeId);
  }

  if (options.status) {
    filters.statusId = resolveAlias('project-status', options.status);
  }
  if (options.priority !== undefined) {
    const priority = parseInt(options.priority, 10);
    if (isNaN(priority) || priority < 0 || priority > 4) {
      throw new UsageError('Priority must be a number between 0 (None) and 4 (Low)');
    }
    filters.priority = priority;
  }
  if (options.member) {
    filters.memberIds = options.member
      .split(',')
      .map(value => resolveAlias('member', value.trim()));
  }
  if (options.label) {
    filters.labelIds = options.label
      .split(',')
      .map(value => resolveAlias('project-label', value.trim()));
  }
  if (options.startAfter) filters.startDateAfter = options.startAfter;
  if (options.startBefore) filters.startDateBefore = options.startBefore;
  if (options.targetAfter) filters.targetDateAfter = options.targetAfter;
  if (options.targetBefore) filters.targetDateBefore = options.targetBefore;
  if (options.search) filters.search = options.search;
  return filters;
}

function projectMatchesDependencyFilters(
  project: ProjectListItem,
  options: DependencyFilterOptions
): boolean {
  const dependsOn = project.dependsOnCount || 0;
  const blocks = project.blocksCount || 0;
  if (options.hasDependencies && dependsOn + blocks === 0) return false;
  if (options.withoutDependencies && dependsOn + blocks > 0) return false;
  if (options.dependsOnOthers && dependsOn === 0) return false;
  if (options.blocksOthers && blocks === 0) return false;
  return true;
}

function hasDependencyFilter(options: DependencyFilterOptions): boolean {
  return Boolean(
    options.hasDependencies ||
      options.withoutDependencies ||
      options.dependsOnOthers ||
      options.blocksOthers
  );
}

function formatTableOutput(
  projects: ProjectListItem[],
  showDependencies = false,
  descConfig?: DescriptionConfig
): void {
  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  const showPreview = !descConfig?.hide;
  const baseHeader = showDependencies
    ? 'ID\tTitle\tStatus\tTeam\tLead\tDeps-On\tBlocks'
    : 'ID\tTitle\tStatus\tTeam\tLead';
  console.log(showPreview ? baseHeader + '\tPreview' : baseHeader);

  for (const project of projects) {
    const status = (project.status?.name || project.state || '').substring(0, 11);
    const team = (project.team?.name || '').substring(0, 14);
    const lead = (project.lead?.name || '').substring(0, 19);
    let row = project.id + '\t' + project.name + '\t' + status + '\t' + team + '\t' + lead;
    if (showDependencies) {
      row += '\t' + String(project.dependsOnCount ?? 0);
      row += '\t' + String(project.blocksCount ?? 0);
    }
    if (showPreview) {
      const text = project.description || project.content || '';
      const preview = descConfig?.full
        ? text.replace(/\t/g, ' ').replace(/\n/g, ' ')
        : formatContentPreview(text, descConfig?.length);
      row += '\t' + preview;
    }
    console.log(row);
  }

  console.log(
    '\nTotal: ' + String(projects.length) + ' project' + (projects.length !== 1 ? 's' : '')
  );
}

function formatTSVOutput(
  projects: ProjectListItem[],
  showDependencies = false,
  descConfig?: DescriptionConfig
): void {
  const showPreview = !descConfig?.hide;
  const baseHeader = showDependencies
    ? 'ID\tTitle\tStatus\tTeam\tLead\tDeps-On\tBlocks'
    : 'ID\tTitle\tStatus\tTeam\tLead';
  console.log(showPreview ? baseHeader + '\tPreview' : baseHeader);

  for (const project of projects) {
    const status = project.status?.name || project.state || '';
    const team = project.team?.name || '';
    const lead = project.lead?.name || '';
    let row = project.id + '\t' + project.name + '\t' + status + '\t' + team + '\t' + lead;
    if (showDependencies) {
      row += '\t' + String(project.dependsOnCount ?? 0);
      row += '\t' + String(project.blocksCount ?? 0);
    }
    if (showPreview) {
      const text = project.description || project.content || '';
      const preview = descConfig?.full
        ? text.replace(/\t/g, ' ').replace(/\n/g, ' ')
        : formatContentPreview(text, descConfig?.length);
      row += '\t' + preview;
    }
    console.log(row);
  }
}

function flattenProjects(projects: ProjectListItem[]): Array<Record<string, unknown>> {
  return projects.map(project => ({
    id: project.id,
    name: project.name,
    status: project.status?.name || project.state || '',
    team: project.team?.name || '',
    lead: project.lead?.name || '',
    description: project.description || '',
    priority: project.priority,
    url: project.url || '',
    dependsOnCount: project.dependsOnCount || 0,
    blocksCount: project.blocksCount || 0,
  }));
}

function formatColumnRows(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  includeTotal: boolean
): void {
  console.log(columns.join('\t'));
  for (const row of rows) {
    console.log(columns.map(column => String(row[column] ?? '')).join('\t'));
  }
  if (includeTotal) {
    console.log('\nTotal: ' + String(rows.length) + ' project' + (rows.length !== 1 ? 's' : ''));
  }
}

function resolveCommandOutputMode(
  options: ProjectListCommandOptions,
  command: Command
): OutputMode {
  const common = {
    allowedModes: ['table', 'json', 'tsv'] as const,
    json: options.json,
  };
  if (options.output === undefined) return resolveOutputMode(common);
  return resolveOutputMode({
    ...common,
    output: options.output,
    outputSource: command.getOptionValueSource('output') === 'default' ? 'default' : 'explicit',
  });
}

function canonicalCommandOptions(
  filters: ProjectListFilters,
  options: ProjectListCommandOptions,
  outputMode: OutputMode
): CanonicalCommandOption[] {
  const result: CanonicalCommandOption[] = [];
  const add = (flag: string, value?: string | number): void => {
    result.push(value === undefined ? { flag } : { flag, value });
  };

  if (filters.teamId) add('--team', filters.teamId);
  else add('--all-teams');
  if (filters.initiativeId) add('--initiative', filters.initiativeId);
  else add('--all-initiatives');
  if (filters.leadId) add('--lead', filters.leadId);
  else add('--all-leads');
  if (filters.statusId) add('--status', filters.statusId);
  if (filters.priority !== undefined) add('--priority', filters.priority);
  if (filters.memberIds?.length) add('--member', filters.memberIds.join(','));
  if (filters.labelIds?.length) add('--label', filters.labelIds.join(','));
  if (filters.startDateAfter) add('--start-after', filters.startDateAfter);
  if (filters.startDateBefore) add('--start-before', filters.startDateBefore);
  if (filters.targetDateAfter) add('--target-after', filters.targetDateAfter);
  if (filters.targetDateBefore) add('--target-before', filters.targetDateBefore);
  if (filters.search) add('--search', filters.search);
  if (options.showDependencies) add('--show-dependencies');
  if (options.hasDependencies) add('--has-dependencies');
  if (options.withoutDependencies) add('--without-dependencies');
  if (options.dependsOnOthers) add('--depends-on-others');
  if (options.blocksOthers) add('--blocks-others');
  if (options.desc === false) add('--no-desc');
  if (options.descLength) add('--desc-length', options.descLength);
  if (options.descFull) add('--desc-full');
  if (options.columns) add('--columns', options.columns);
  if (options.interactive) add('--interactive');
  if (options.cursorHistory === false) add('--no-cursor-history');
  add('--output', outputMode);
  return result;
}

function cursorHistoryFilters(
  filters: ProjectListFilters,
  dependencyOptions: DependencyFilterOptions
): Record<string, CursorHistoryJsonValue> {
  const result: Record<string, CursorHistoryJsonValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) result[key] = value as CursorHistoryJsonValue;
  }
  result.hasDependencies = dependencyOptions.hasDependencies === true;
  result.withoutDependencies = dependencyOptions.withoutDependencies === true;
  result.dependsOnOthers = dependencyOptions.dependsOnOthers === true;
  result.blocksOthers = dependencyOptions.blocksOthers === true;
  return result;
}

async function preparePaginationPresentation(
  pageInfo: PageInfo,
  filters: ProjectListFilters,
  options: ProjectListCommandOptions,
  outputMode: OutputMode,
  limit: number,
  after: string | undefined,
  dependencyOptions: DependencyFilterOptions
): Promise<PaginationPresentation> {
  const disabled = options.cursorHistory === false;
  if (!pageInfo.hasNextPage || pageInfo.endCursor === null) {
    return {
      commands: null,
      cursorHistory: {
        status: disabled ? 'disabled' : 'not_applicable',
        entryId: null,
      },
    };
  }

  const commands = buildCursorCommands({
    commandPath: ['project', 'list'],
    options: canonicalCommandOptions(filters, options, outputMode),
    limit,
    startingAfter: after,
    emittedCursor: pageInfo.endCursor,
  });
  let result: CursorHistoryResult;
  try {
    const workspace = disabled
      ? { key: null, id: null, name: null }
      : (() => {
          const resolution = resolveActiveWorkspace();
          return {
            key: workspaceCacheKey(resolution.key),
            id: null,
            name: resolution.name ?? null,
          };
        })();
    result = await recordCursorContinuation({
      disabled,
      pageInfo,
      entry: {
        workspace,
        commandPath: 'project list',
        resource: 'project',
        target: null,
        filters: cursorHistoryFilters(filters, dependencyOptions),
        orderBy: PROJECT_LIST_ORDER,
        limit,
        commands,
      },
    });
  } catch (error) {
    result = { status: 'failed', entryId: null, error };
  }

  if (result.status === 'failed') {
    const detail = result.error instanceof Error ? result.error.message : String(result.error);
    console.error('warning: failed to record cursor history: ' + detail);
  }
  return {
    commands,
    cursorHistory: { status: result.status, entryId: result.entryId },
  };
}

function printHumanPaginationFooter(presentation: PaginationPresentation): void {
  if (!presentation.commands) return;
  console.log('\nMore projects are available.');
  console.log('\nNext page:');
  console.log('  ' + presentation.commands.nextCommand);
  console.log('\nAll remaining:');
  console.log('  ' + presentation.commands.allRemainingCommand);

  if (presentation.cursorHistory.status === 'recorded') {
    console.log('\nCursor history:');
    console.log("  a2l cursor-history view '" + presentation.cursorHistory.entryId + "'");
  } else if (presentation.cursorHistory.status === 'disabled') {
    console.log('\nCursor history: disabled');
  } else if (presentation.cursorHistory.status === 'failed') {
    console.log('\nCursor history: not recorded');
  }
}

interface ProjectListProps {
  projects: ProjectListItem[];
  presentation: PaginationPresentation;
}

function ProjectList({ projects, presentation }: ProjectListProps): React.ReactElement {
  if (projects.length === 0) {
    return <Text color="yellow">No projects found matching your filters.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>
        Projects ({projects.length})
      </Text>
      <Text> </Text>
      {projects.map(project => (
        <Box key={project.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="cyan">
              {project.name}
            </Text>{' '}
            <Text dimColor>({project.id.substring(0, 8)}...)</Text>
          </Text>
          <Text>
            Status: <Text color="green">{project.status?.name || project.state}</Text>
            {' | '}Team: <Text color="blue">{project.team?.name || 'N/A'}</Text>
            {' | '}Lead: <Text color="magenta">{project.lead?.name || 'N/A'}</Text>
          </Text>
          {(project.description || project.content) && (
            <Text dimColor>
              {formatContentPreview(project.description || project.content || '')}
            </Text>
          )}
        </Box>
      ))}
      {presentation.commands && (
        <Box flexDirection="column">
          <Text>Next page:</Text>
          <Text>{presentation.commands.nextCommand}</Text>
          <Text>All remaining:</Text>
          <Text>{presentation.commands.allRemainingCommand}</Text>
        </Box>
      )}
    </Box>
  );
}

async function runProjectList(options: ProjectListCommandOptions, command: Command): Promise<void> {
  if (options.format !== undefined) {
    throw new UsageError('Legacy -f/--format has been removed; use -o/--output <table|json|tsv>');
  }

  let limit: number;
  let after: string | undefined;
  try {
    limit = parsePageLimit(options.limit);
    after = validateRawCursor(options.after);
  } catch (error) {
    if (error instanceof PaginationInputError) {
      throw new UsageError(error.message, { cause: error });
    }
    throw error;
  }
  const outputMode = resolveCommandOutputMode(options, command);
  if (options.all && command.getOptionValueSource('limit') === 'cli') {
    logger.debug('--all ignores --limit and fetches every remaining project');
  }

  if (options.hasDependencies && options.withoutDependencies) {
    throw new UsageError('Cannot use --has-dependencies and --without-dependencies together');
  }
  if (options.web) throw new RuntimeError('Web mode not yet implemented');

  const filters = await buildDefaultFilters(options);
  const dependencyOptions: DependencyFilterOptions = {
    hasDependencies: options.hasDependencies,
    withoutDependencies: options.withoutDependencies,
    dependsOnOthers: options.dependsOnOthers,
    blocksOthers: options.blocksOthers,
  };
  filters.includeDependencies = Boolean(
    options.showDependencies || hasDependencyFilter(dependencyOptions)
  );

  const matches = hasDependencyFilter(dependencyOptions)
    ? (item: ProjectListItem) => projectMatchesDependencyFilters(item, dependencyOptions)
    : undefined;
  const page = await getProjectListPage(
    filters,
    { limit, after, fetchAll: options.all === true },
    matches
  );
  const presentation = await preparePaginationPresentation(
    page.pageInfo,
    filters,
    options,
    outputMode,
    limit,
    after,
    dependencyOptions
  );
  const descConfig: DescriptionConfig = {
    length: options.descLength ? parseInt(options.descLength, 10) : undefined,
    full: options.descFull === true,
    hide: options.desc === false,
  };

  const columns = options.columns ? options.columns.split(',').map(column => column.trim()) : null;
  if (columns) {
    const outputProjects = filterColumns(flattenProjects(page.items), columns);
    if (outputMode === 'json') {
      console.log(
        JSON.stringify(
          {
            projects: outputProjects,
            pageInfo: page.pageInfo,
            cursorHistory: presentation.cursorHistory,
          },
          null,
          2
        )
      );
    } else {
      formatColumnRows(outputProjects, columns, outputMode === 'table');
      if (outputMode === 'table') printHumanPaginationFooter(presentation);
    }
  } else if (options.interactive) {
    render(<ProjectList projects={page.items} presentation={presentation} />);
  } else if (outputMode === 'json') {
    console.log(
      JSON.stringify(
        {
          projects: page.items,
          pageInfo: page.pageInfo,
          cursorHistory: presentation.cursorHistory,
        },
        null,
        2
      )
    );
  } else if (outputMode === 'tsv') {
    formatTSVOutput(page.items, options.showDependencies, descConfig);
  } else {
    formatTableOutput(page.items, options.showDependencies, descConfig);
    printHumanPaginationFooter(presentation);
  }

  if (outputMode === 'tsv' && page.pageInfo.hasNextPage) {
    console.error(
      'warning: more projects are available; continuation cursor: ' +
        String(page.pageInfo.endCursor)
    );
  }
}

export function listProjectsCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List projects with smart defaults and filtering')
    .option('-t, --team <id>', 'Filter by team (default: config.defaultTeam)')
    .option('-i, --initiative <id>', 'Filter by initiative (default: config.defaultInitiative)')
    .option('-s, --status <id>', 'Filter by project status')
    .option('-p, --priority <number>', 'Filter by priority (0-4)')
    .option('-l, --lead <id>', 'Filter by project lead (default: current user)')
    .option('-m, --member <id>', 'Filter by member (comma-separated for multiple)')
    .option('--label <id>', 'Filter by label (comma-separated for multiple)')
    .option('--search <query>', 'Search in project name, description, or content')
    .option('--start-after <date>', 'Filter projects starting after date (YYYY-MM-DD)')
    .option('--start-before <date>', 'Filter projects starting before date (YYYY-MM-DD)')
    .option('--target-after <date>', 'Filter projects targeting after date (YYYY-MM-DD)')
    .option('--target-before <date>', 'Filter projects targeting before date (YYYY-MM-DD)')
    .option('--all-leads', 'Show projects with any lead (overrides default: current user)')
    .option('--all-teams', 'Show projects from all teams (overrides default team)')
    .option(
      '--all-initiatives',
      'Show projects from all initiatives (overrides default initiative)'
    )
    .option('--limit <number>', 'Maximum number of matching results (default: 50, max: 250)', '50')
    .option('--after <cursor>', 'Resume after an exact raw Linear cursor')
    .option('-a, --all', 'Fetch all remaining matching projects')
    .option('--no-cursor-history', 'Do not persist an emitted continuation cursor')
    .option('-o, --output <table|json|tsv>', 'Output format: table (default), json, or tsv')
    .option('--json', 'Exact shorthand for --output json')
    .addOption(new Option('-f, --format <type>').hideHelp())
    .option('-I, --interactive', 'Interactive mode with Ink UI')
    .option('-w, --web', 'Open in web browser')
    .option('--show-dependencies', 'Show dependency counts (depends-on/blocks)')
    .option('--has-dependencies', 'Filter: show only projects with any dependencies')
    .option('--without-dependencies', 'Filter: show only projects with no dependencies')
    .option('--depends-on-others', 'Filter: show only projects that depend on others')
    .option('--blocks-others', 'Filter: show only projects that block others')
    .option('--desc', 'Show description preview column (default, 80 chars)')
    .option('--desc-length <n>', 'Description preview length in characters')
    .option('--desc-full', 'Show full description column (no truncation)')
    .option('--no-desc', 'Hide description preview column')
    .option('--columns <fields>', 'Comma-separated list of columns to display')
    .action(async (options: ProjectListCommandOptions, command: Command) => {
      await runProjectList(options, command);
    })
    .addHelpText(
      'after',
      `
Pagination:
  The default returns at most 50 matching projects.
  Copy the exact raw cursor printed by a truncated result into --after.
  --all fetches every remaining project; --after C --all resumes after C.
  --limit is long-only because -l remains --lead.
  --no-cursor-history prevents local recording for this invocation.

Examples:
  $ a2l project list --limit 50
  $ a2l project list --limit 50 --after '<raw-linear-cursor>'
  $ a2l project list --after '<raw-linear-cursor>' --all
  $ a2l project list --json
  $ a2l project list --no-cursor-history
`
    );
}
