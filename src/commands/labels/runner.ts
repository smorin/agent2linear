import { resolveAlias } from '../../lib/aliases.js';
import {
  createIssueLabel,
  createProjectLabel,
  deleteIssueLabel,
  deleteProjectLabel,
  getIssueLabelById,
  getIssueLabelListPage,
  getProjectLabelById,
  getProjectLabelListPage,
  type IssueLabelCreateInput,
  type IssueLabelListFilters,
  type IssueLabelUpdateInput,
  type ProjectLabelCreateInput,
  type ProjectLabelListFilters,
  type ProjectLabelUpdateInput,
  restoreIssueLabel,
  restoreProjectLabel,
  retireIssueLabel,
  retireProjectLabel,
  updateIssueLabel,
  updateProjectLabel,
} from '../../lib/api/labels.js';
import { NotFoundError, RuntimeError, UsageError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import {
  confirmDestructiveAction,
  type DestructiveConfirmationDeclined,
} from '../../lib/confirm-destructive.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import {
  buildCursorCommands,
  type CanonicalCommandOption,
  type CursorCommands,
  type CursorHistoryResult,
  recordCursorContinuation,
  type RecordCursorContinuationInput,
} from '../../lib/cursor-history-adapter.js';
import { logger } from '../../lib/logger.js';
import { type OutputValueSource, resolveOutputMode } from '../../lib/output-mode.js';
import {
  type PageInput,
  type PageResult,
  PaginationInputError,
  parsePageLimit,
  validateRawCursor,
} from '../../lib/pagination.js';
import type { IssueLabel, ProjectLabel, WorkspaceResolution } from '../../lib/types.js';
import { validateAndNormalizeColor } from '../../lib/validators.js';
import { workspaceForJson } from '../../lib/workspace-banner.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { workspaceCacheKey } from '../../lib/xdg-paths.js';

export type LabelKind = 'issue' | 'project';
export type LabelLifecycleOperation = 'retire' | 'restore';
export type AnyLabel = IssueLabel | ProjectLabel;
export type AnyLabelListFilters = IssueLabelListFilters | ProjectLabelListFilters;
export type AnyLabelUpdateInput = IssueLabelUpdateInput | ProjectLabelUpdateInput;

interface MutationOutputOptions {
  dryRun?: boolean;
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
  yes?: boolean;
  /** Commander represents --no-input as input=false. */
  input?: boolean;
}

export interface LabelCreateOptions extends MutationOutputOptions {
  name?: string;
  color?: string;
  description?: string;
  team?: string;
}

export interface LabelUpdateOptions extends MutationOutputOptions {
  name?: string;
  color?: string;
  description?: string;
}

export type LabelDeleteOptions = MutationOutputOptions;
export type LabelLifecycleOptions = MutationOutputOptions;

export interface LabelListOptions {
  team?: string;
  workspace?: boolean;
  color?: string;
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
  limit?: string;
  limitSource?: OutputValueSource;
  after?: string;
  includeRetired?: boolean;
  all?: boolean;
  /** Commander represents --no-cursor-history as cursorHistory=false. */
  cursorHistory?: boolean;
}

export interface LabelRunnerDependencies {
  resolveAlias(type: 'team' | 'issue-label' | 'project-label', id: string): string;
  getById(kind: LabelKind, id: string): Promise<AnyLabel | null>;
  create(
    kind: LabelKind,
    input: IssueLabelCreateInput | ProjectLabelCreateInput
  ): Promise<AnyLabel>;
  update(kind: LabelKind, id: string, input: AnyLabelUpdateInput): Promise<AnyLabel>;
  delete(kind: LabelKind, id: string): Promise<boolean>;
  lifecycle(kind: LabelKind, operation: LabelLifecycleOperation, id: string): Promise<AnyLabel>;
  list(
    kind: LabelKind,
    filters: AnyLabelListFilters,
    page: PageInput
  ): Promise<PageResult<AnyLabel>>;
  guardMutation(options: {
    json?: boolean;
    yes?: boolean;
    noInput?: boolean;
  }): Promise<WorkspaceResolution>;
  resolveWorkspace(): WorkspaceResolution;
  confirmDestructive(
    action: string,
    options: { yes?: boolean; noInput?: boolean }
  ): Promise<void | DestructiveConfirmationDeclined>;
  recordHistory(input: RecordCursorContinuationInput): Promise<CursorHistoryResult>;
  writeStdout(value: string): void;
  writeStderr(value: string): void;
  writeDebug(value: string): void;
  getDefaultTeam?(): string | undefined;
}

const defaultDependencies: LabelRunnerDependencies = {
  resolveAlias,
  getById: async (kind, id) => (kind === 'issue' ? getIssueLabelById(id) : getProjectLabelById(id)),
  create: async (kind, input) =>
    kind === 'issue'
      ? createIssueLabel(input as IssueLabelCreateInput)
      : createProjectLabel(input as ProjectLabelCreateInput),
  update: async (kind, id, input) =>
    kind === 'issue'
      ? updateIssueLabel(id, input as IssueLabelUpdateInput)
      : updateProjectLabel(id, input as ProjectLabelUpdateInput),
  delete: async (kind, id) => (kind === 'issue' ? deleteIssueLabel(id) : deleteProjectLabel(id)),
  lifecycle: async (kind, operation, id) => {
    if (kind === 'issue') {
      return operation === 'retire' ? retireIssueLabel(id) : restoreIssueLabel(id);
    }
    return operation === 'retire' ? retireProjectLabel(id) : restoreProjectLabel(id);
  },
  list: async (kind, filters, page) =>
    kind === 'issue'
      ? getIssueLabelListPage(filters as IssueLabelListFilters, page)
      : getProjectLabelListPage(filters as ProjectLabelListFilters, page),
  guardMutation: guardWorkspaceForMutation,
  resolveWorkspace: resolveActiveWorkspace,
  confirmDestructive: confirmDestructiveAction,
  recordHistory: recordCursorContinuation,
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
  writeDebug: value => logger.debug(value),
  getDefaultTeam: () => getConfig().defaultTeam,
};

function mutationMode(options: MutationOutputOptions): 'table' | 'json' {
  const mode =
    options.output === undefined
      ? resolveOutputMode({ allowedModes: ['table', 'json'], json: options.json })
      : resolveOutputMode({
          allowedModes: ['table', 'json'],
          output: options.output,
          outputSource: options.outputSource ?? 'default',
          json: options.json,
        });
  if (mode === 'tsv') {
    throw new UsageError('TSV output is not supported by label mutation commands');
  }
  return mode;
}

function listMode(options: LabelListOptions): 'table' | 'json' | 'tsv' {
  const allowedModes = ['table', 'json', 'tsv'] as const;
  return options.output === undefined
    ? resolveOutputMode({ allowedModes, json: options.json })
    : resolveOutputMode({
        allowedModes,
        output: options.output,
        outputSource: options.outputSource ?? 'default',
        json: options.json,
      });
}

function requireWorkspace(resolution: WorkspaceResolution): WorkspaceResolution {
  if (resolution.denied) {
    throw new RuntimeError(resolution.denied.reason + ' — ' + resolution.denied.hint);
  }
  return resolution;
}

function requireName(name: string | undefined): string {
  if (name === undefined || name.trim().length === 0) {
    throw new UsageError('--name is required and must not be blank');
  }
  return name;
}

function normalizeColor(color: string): string {
  const result = validateAndNormalizeColor(color);
  if (!result.valid || result.value === undefined) {
    throw new UsageError(result.error ?? 'invalid label color');
  }
  return result.value;
}

function resolvedLabelId(
  kind: LabelKind,
  input: string,
  dependencies: LabelRunnerDependencies
): string {
  return dependencies.resolveAlias(kind === 'issue' ? 'issue-label' : 'project-label', input);
}

async function requireLabel(
  kind: LabelKind,
  input: string,
  dependencies: LabelRunnerDependencies
): Promise<{ id: string; label: AnyLabel }> {
  const id = resolvedLabelId(kind, input, dependencies);
  const label = await dependencies.getById(kind, id);
  if (!label) {
    throw new NotFoundError(kind + ' label not found: ' + input);
  }
  return { id, label };
}

function mutationGuardOptions(
  mode: 'table' | 'json',
  options: MutationOutputOptions
): { json: boolean; yes: boolean; noInput: boolean } {
  return {
    json: mode === 'json',
    yes: options.yes === true,
    noInput: options.input === false,
  };
}

function writeJson(dependencies: LabelRunnerDependencies, value: unknown): void {
  dependencies.writeStdout(JSON.stringify(value, null, 2) + '\n');
}

function labelType(kind: LabelKind): string {
  return kind + '-label';
}

function labelTitle(kind: LabelKind): string {
  return kind === 'issue' ? 'Issue label' : 'Project label';
}

function labelJson(kind: LabelKind, label: AnyLabel): Record<string, unknown> {
  return { type: kind, ...label };
}

function stateText(label: AnyLabel): string {
  const states: string[] = [];
  if (label.retiredAt !== null) states.push('retired');
  if (label.archivedAt !== null) states.push('archived');
  return states.length === 0 ? 'active' : states.join(', ');
}

function renderLabel(kind: LabelKind, label: AnyLabel): string {
  const lines = [
    labelTitle(kind) + ': ' + label.name,
    'ID: ' + label.id,
    'Color: ' + label.color,
    'State: ' + stateText(label),
  ];
  if ('teamId' in label) {
    lines.push('Scope: ' + (label.teamId ? 'Team (' + label.teamId + ')' : 'Workspace'));
  }
  if (label.description !== undefined) {
    lines.push('Description: ' + label.description);
  }
  if (label.retiredAt !== null) lines.push('Retired at: ' + label.retiredAt);
  if (label.archivedAt !== null) lines.push('Archived at: ' + label.archivedAt);
  return lines.join('\n');
}

function dryRunWorkspace(dependencies: LabelRunnerDependencies): WorkspaceResolution {
  return requireWorkspace(dependencies.resolveWorkspace());
}

function writeMutationResult(
  kind: LabelKind,
  operation: string,
  label: AnyLabel,
  workspace: WorkspaceResolution,
  mode: 'table' | 'json',
  dependencies: LabelRunnerDependencies
): void {
  if (mode === 'json') {
    writeJson(dependencies, {
      ok: true,
      workspace: workspaceForJson(workspace),
      operation,
      label: labelJson(kind, label),
    });
    return;
  }
  dependencies.writeStdout(
    labelTitle(kind) + ' ' + operation + '.\n' + renderLabel(kind, label) + '\n'
  );
}

function writeDryRun(
  kind: LabelKind,
  operation: string,
  label: Record<string, unknown>,
  mode: 'table' | 'json',
  workspace: WorkspaceResolution,
  dependencies: LabelRunnerDependencies
): void {
  if (mode === 'json') {
    writeJson(dependencies, {
      dryRun: true,
      operation,
      workspace: workspaceForJson(workspace),
      label: { type: kind, ...label },
      validation: { serverMutation: false },
    });
    return;
  }
  dependencies.writeStdout(
    'Dry run: would ' + operation + ' ' + labelType(kind) + '.\nNo server mutation performed.\n'
  );
}

export async function runLabelCreate(
  kind: LabelKind,
  options: LabelCreateOptions,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = mutationMode(options);
  const name = requireName(options.name);
  const color = normalizeColor(options.color ?? '#5E6AD2');
  const teamId =
    kind === 'issue' && options.team ? dependencies.resolveAlias('team', options.team) : undefined;
  const input = {
    name,
    color,
    ...(options.description === undefined ? {} : { description: options.description }),
    ...(teamId === undefined ? {} : { teamId }),
  };

  if (options.dryRun) {
    writeDryRun(kind, 'create', input, mode, dryRunWorkspace(dependencies), dependencies);
    return;
  }

  const workspace = await dependencies.guardMutation(mutationGuardOptions(mode, options));
  const label = await dependencies.create(kind, input);
  writeMutationResult(kind, 'created', label, workspace, mode, dependencies);
}

export async function runLabelUpdate(
  kind: LabelKind,
  inputId: string,
  options: LabelUpdateOptions,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = mutationMode(options);
  const hasUpdate =
    options.name !== undefined || options.color !== undefined || options.description !== undefined;
  if (!hasUpdate) {
    throw new UsageError('at least one of --name, --color, or --description is required');
  }
  const { id, label: current } = await requireLabel(kind, inputId, dependencies);
  const updateInput: AnyLabelUpdateInput = {};
  if (options.name !== undefined) updateInput.name = requireName(options.name);
  if (options.color !== undefined) updateInput.color = normalizeColor(options.color);
  if (options.description !== undefined) updateInput.description = options.description;

  if (options.dryRun) {
    writeDryRun(
      kind,
      'update',
      { id, before: current, changes: updateInput },
      mode,
      dryRunWorkspace(dependencies),
      dependencies
    );
    return;
  }

  const workspace = await dependencies.guardMutation(mutationGuardOptions(mode, options));
  const label = await dependencies.update(kind, id, updateInput);
  writeMutationResult(kind, 'updated', label, workspace, mode, dependencies);
}

export async function runLabelDelete(
  kind: LabelKind,
  inputId: string,
  options: LabelDeleteOptions,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = mutationMode(options);
  const { id, label } = await requireLabel(kind, inputId, dependencies);

  if (options.dryRun) {
    writeDryRun(
      kind,
      'delete',
      { id, name: label.name },
      mode,
      dryRunWorkspace(dependencies),
      dependencies
    );
    return;
  }

  const workspace = await dependencies.guardMutation(mutationGuardOptions(mode, options));
  const confirmation = await dependencies.confirmDestructive(
    'Permanently delete ' + labelType(kind) + ' "' + label.name + '"?',
    { yes: options.yes === true, noInput: options.input === false }
  );
  if (confirmation?.confirmed === false) {
    if (mode === 'json') {
      writeJson(dependencies, {
        ok: false,
        cancelled: true,
        workspace: workspaceForJson(workspace),
        operation: 'delete',
        label: { type: kind, id, name: label.name },
      });
    } else {
      dependencies.writeStdout('Deletion cancelled.\n');
    }
    return;
  }

  const success = await dependencies.delete(kind, id);
  if (!success) {
    throw new RuntimeError('Linear did not confirm ' + labelType(kind) + ' deletion');
  }

  if (mode === 'json') {
    writeJson(dependencies, {
      ok: true,
      workspace: workspaceForJson(workspace),
      operation: 'delete',
      deleted: { type: kind, id, name: label.name },
    });
  } else {
    dependencies.writeStdout(labelTitle(kind) + ' deleted: ' + label.name + '\n');
  }
}

export async function runLabelLifecycle(
  kind: LabelKind,
  operation: LabelLifecycleOperation,
  inputId: string,
  options: LabelLifecycleOptions,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = mutationMode(options);
  const { id, label } = await requireLabel(kind, inputId, dependencies);

  if (options.dryRun) {
    writeDryRun(
      kind,
      operation,
      { id, name: label.name },
      mode,
      dryRunWorkspace(dependencies),
      dependencies
    );
    return;
  }

  const workspace = await dependencies.guardMutation(mutationGuardOptions(mode, options));
  if (operation === 'retire') {
    const confirmation = await dependencies.confirmDestructive(
      'Retire ' + labelType(kind) + ' "' + label.name + '"?',
      { yes: options.yes === true, noInput: options.input === false }
    );
    if (confirmation?.confirmed === false) {
      if (mode === 'json') {
        writeJson(dependencies, {
          ok: false,
          cancelled: true,
          workspace: workspaceForJson(workspace),
          operation: 'retire',
          label: { type: kind, id, name: label.name },
        });
      } else {
        dependencies.writeStdout('Retirement cancelled.\n');
      }
      return;
    }
  }

  const result = await dependencies.lifecycle(kind, operation, id);
  writeMutationResult(
    kind,
    operation === 'retire' ? 'retired' : 'restored',
    result,
    workspace,
    mode,
    dependencies
  );
}

export async function runLabelView(
  kind: LabelKind,
  inputId: string,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const { label } = await requireLabel(kind, inputId, dependencies);
  dependencies.writeStdout(renderLabel(kind, label) + '\n');
}

function listFilters(
  kind: LabelKind,
  options: LabelListOptions,
  dependencies: LabelRunnerDependencies
): AnyLabelListFilters {
  if (kind === 'issue' && options.team && options.workspace) {
    throw new UsageError('--team cannot be combined with --workspace');
  }
  const color = options.color === undefined ? undefined : normalizeColor(options.color);
  if (kind === 'project') {
    return {
      ...(color === undefined ? {} : { color }),
      includeRetired: options.includeRetired === true,
    };
  }

  const defaultTeam =
    options.team === undefined && !options.workspace ? dependencies.getDefaultTeam?.() : undefined;
  const requestedTeam = options.team ?? defaultTeam;
  const teamId = requestedTeam ? dependencies.resolveAlias('team', requestedTeam) : undefined;
  return {
    ...(teamId === undefined ? {} : { teamId }),
    ...(options.workspace === true ? { workspaceOnly: true } : {}),
    ...(color === undefined ? {} : { color }),
    includeRetired: options.includeRetired === true,
  };
}

function cursorOptions(
  kind: LabelKind,
  options: LabelListOptions,
  filters: AnyLabelListFilters,
  mode: 'table' | 'json' | 'tsv'
): CanonicalCommandOption[] {
  const result: CanonicalCommandOption[] = [];
  if (kind === 'issue') {
    const issueFilters = filters as IssueLabelListFilters;
    if (issueFilters.teamId) result.push({ flag: '--team', value: issueFilters.teamId });
    if (issueFilters.workspaceOnly) result.push({ flag: '--workspace' });
  }
  if (filters.color) result.push({ flag: '--color', value: filters.color });
  if (filters.includeRetired) result.push({ flag: '--include-retired' });
  if (mode !== 'table') {
    result.push({ flag: '--output', value: mode });
  }
  if (options.cursorHistory === false) result.push({ flag: '--no-cursor-history' });
  return result;
}

function commandsForPage(
  kind: LabelKind,
  options: LabelListOptions,
  filters: AnyLabelListFilters,
  mode: 'table' | 'json' | 'tsv',
  limit: number,
  after: string | undefined,
  endCursor: string
): CursorCommands {
  return buildCursorCommands({
    commandPath: [kind === 'issue' ? 'issue-labels' : 'project-labels', 'list'],
    options: cursorOptions(kind, options, filters, mode),
    limit,
    ...(after === undefined ? {} : { startingAfter: after }),
    emittedCursor: endCursor,
  });
}

function listState(label: AnyLabel): string {
  return stateText(label);
}

function renderListTable(
  kind: LabelKind,
  labels: AnyLabel[],
  pageInfo: PageResult<AnyLabel>['pageInfo'],
  history: CursorHistoryResult,
  commands: CursorCommands | null
): string {
  const lines: string[] = [];
  if (labels.length === 0) {
    lines.push('No ' + kind + ' labels found.');
  } else {
    lines.push(labelTitle(kind) + 's');
    lines.push('');
    for (const label of labels) {
      const scope = 'teamId' in label ? (label.teamId ?? 'workspace') : undefined;
      lines.push(label.name + ' · ' + label.id);
      lines.push('  Color: ' + label.color + ' · State: ' + listState(label));
      if (scope) lines.push('  Scope: ' + scope);
      if (label.description !== undefined) lines.push('  ' + label.description);
      lines.push('');
    }
  }

  if (pageInfo.hasNextPage && commands) {
    lines.push('Showing ' + pageInfo.returnedCount + ' labels; more are available.');
    lines.push('');
    lines.push('Next page:');
    lines.push('  ' + commands.nextCommand);
    lines.push('');
    lines.push('All remaining labels:');
    lines.push('  ' + commands.allRemainingCommand);
    if (history.status === 'recorded' && history.entryId) {
      lines.push('');
      lines.push('Cursor history ID: ' + history.entryId);
    }
  } else {
    lines.push('Total: ' + pageInfo.returnedCount + ' labels');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function renderListTsv(labels: AnyLabel[]): string {
  const lines = ['id\tname\tcolor\tdescription\tteamId\tretiredAt\tarchivedAt'];
  for (const label of labels) {
    lines.push(
      [
        label.id,
        label.name,
        label.color,
        label.description ?? '',
        'teamId' in label ? (label.teamId ?? '') : '',
        label.retiredAt ?? '',
        label.archivedAt ?? '',
      ]
        .map(value => value.replace(/[\t\r\n]/g, ' '))
        .join('\t')
    );
  }
  return lines.join('\n') + '\n';
}

export async function runLabelList(
  kind: LabelKind,
  options: LabelListOptions,
  dependencies: LabelRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = listMode(options);
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

  const filters = listFilters(kind, options, dependencies);
  if (options.all && options.limitSource === 'explicit') {
    dependencies.writeDebug('--limit is ignored when --all is present; requests use pages of 250');
  }

  const page = await dependencies.list(kind, filters, {
    limit,
    ...(after === undefined ? {} : { after }),
    fetchAll: options.all === true,
  });

  const commands =
    page.pageInfo.hasNextPage && page.pageInfo.endCursor !== null
      ? commandsForPage(kind, options, filters, mode, limit, after, page.pageInfo.endCursor)
      : null;
  const completeCommands =
    commands ?? commandsForPage(kind, options, filters, mode, limit, after, after ?? '__complete__');
  const workspace = requireWorkspace(dependencies.resolveWorkspace());
  const history = await dependencies.recordHistory({
    disabled: options.cursorHistory === false,
    pageInfo: page.pageInfo,
    entry: {
      workspace: {
        key: workspaceCacheKey(workspace.key),
        id: null,
        name: workspace.name ?? null,
      },
      commandPath: (kind === 'issue' ? 'issue-labels' : 'project-labels') + ' list',
      resource: kind === 'issue' ? 'issue-label' : 'project-label',
      target: null,
      filters: filters as Record<string, string | boolean | null>,
      orderBy: 'createdAt',
      limit,
      commands: completeCommands,
    },
  });

  if (history.status === 'failed') {
    dependencies.writeStderr(
      'warning: labels were fetched, but cursor history could not be saved\n'
    );
  }

  if (mode === 'json') {
    writeJson(dependencies, {
      labels: page.items,
      pageInfo: page.pageInfo,
      cursorHistory: {
        status: history.status,
        entryId: history.entryId,
      },
    });
  } else if (mode === 'tsv') {
    dependencies.writeStdout(renderListTsv(page.items));
  } else {
    dependencies.writeStdout(renderListTable(kind, page.items, page.pageInfo, history, commands));
  }
}
