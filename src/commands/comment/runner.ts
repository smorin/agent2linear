import {
  type CommentCreateOptions,
  type CommentPageResult,
  type CommentTargetRef,
  createComment,
  type LinearComment,
  listComments,
  validateReplyTarget,
} from '../../lib/api/comments.js';
import { withCacheWritesSuppressed } from '../../lib/cache-write-policy.js';
import { RuntimeError, UsageError } from '../../lib/cli-error.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import {
  type CursorCommands,
  type CursorHistoryResult,
  recordCursorContinuation,
  type RecordCursorContinuationInput,
} from '../../lib/cursor-history-adapter.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import { logger } from '../../lib/logger.js';
import { type OutputValueSource, resolveOutputMode } from '../../lib/output-mode.js';
import {
  type PageInput,
  PaginationInputError,
  parsePageLimit,
  validateRawCursor,
} from '../../lib/pagination.js';
import type { WorkspaceResolution } from '../../lib/types.js';
import { workspaceForJson } from '../../lib/workspace-banner.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { workspaceCacheKey } from '../../lib/xdg-paths.js';
import { type CommentBodyOptions, readCommentBody } from './input.js';
import {
  buildCommentCursorCommands,
  commentTargetJson,
  listCommentJson,
  renderCommentAdded,
  renderCommentList,
} from './output.js';
import {
  type CommentTargetKind,
  resolveCommentTarget,
  type ResolvedCommentTarget,
} from './targets.js';

export interface CommentAddOptions extends CommentBodyOptions {
  replyTo?: string;
  dryRun?: boolean;
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
  yes?: boolean;
  /** Commander represents --no-input as input=false. */
  input?: boolean;
}

export interface CommentListOptions {
  limit?: string;
  limitSource?: OutputValueSource;
  after?: string;
  all?: boolean;
  /** Commander represents --no-cursor-history as cursorHistory=false. */
  cursorHistory?: boolean;
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
}

export interface CommentRunnerDependencies {
  resolveTarget(kind: CommentTargetKind, input: string): Promise<ResolvedCommentTarget>;
  readBody(options: CommentBodyOptions): Promise<string>;
  validateReply(target: CommentTargetRef, commentId: string): Promise<void>;
  create(target: CommentTargetRef, options: CommentCreateOptions): Promise<LinearComment>;
  list(target: CommentTargetRef, input: PageInput): Promise<CommentPageResult>;
  guardMutation(options: {
    json?: boolean;
    yes?: boolean;
    noInput?: boolean;
  }): Promise<WorkspaceResolution>;
  resolveWorkspace(): WorkspaceResolution;
  recordHistory(input: RecordCursorContinuationInput): Promise<CursorHistoryResult>;
  writeStdout(value: string): void;
  writeStderr(value: string): void;
  writeDebug(value: string): void;
  stdinReservedForApiKey(): boolean;
}

const defaultDependencies: CommentRunnerDependencies = {
  resolveTarget: resolveCommentTarget,
  readBody: readCommentBody,
  validateReply: validateReplyTarget,
  create: createComment,
  list: listComments,
  guardMutation: guardWorkspaceForMutation,
  resolveWorkspace: resolveActiveWorkspace,
  recordHistory: recordCursorContinuation,
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
  writeDebug: value => logger.debug(value),
  stdinReservedForApiKey: () => getInvocationContext().apiKeyFromStdin === true,
};

function outputMode(options: {
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
}): 'table' | 'json' {
  const resolved =
    options.output === undefined
      ? resolveOutputMode({ allowedModes: ['table', 'json'], json: options.json })
      : resolveOutputMode({
          allowedModes: ['table', 'json'],
          output: options.output,
          outputSource: options.outputSource ?? 'default',
          json: options.json,
        });
  if (resolved === 'tsv') {
    throw new UsageError('TSV output is not supported by comment commands');
  }
  return resolved;
}

function apiTarget(target: ResolvedCommentTarget): CommentTargetRef {
  return { type: target.type, id: target.id };
}

function requireWorkspace(resolution: WorkspaceResolution): WorkspaceResolution {
  if (resolution.denied) {
    throw new RuntimeError(`${resolution.denied.reason} — ${resolution.denied.hint}`);
  }
  return resolution;
}

function targetLabel(target: ResolvedCommentTarget): string {
  return target.type === 'issue' ? target.identifier : target.name;
}

function completeCommands(
  target: ResolvedCommentTarget,
  limit: number,
  after: string | undefined
): CursorCommands {
  const source = buildCommentCursorCommands({
    target,
    limit,
    ...(after === undefined ? {} : { startingAfter: after }),
    emittedCursor: after ?? '__complete__',
  }).sourceCommand;
  return {
    sourceCommand: source,
    nextCommand: source,
    allRemainingCommand: source,
  };
}

function commentCommands(
  target: ResolvedCommentTarget,
  limit: number,
  after: string | undefined,
  page: CommentPageResult
): CursorCommands | null {
  if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) return null;
  return buildCommentCursorCommands({
    target,
    limit,
    ...(after === undefined ? {} : { startingAfter: after }),
    emittedCursor: page.pageInfo.endCursor,
  });
}

async function runCommentAddInternal(
  kind: CommentTargetKind,
  input: string,
  options: CommentAddOptions,
  dependencies: CommentRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = outputMode(options);
  const body = await dependencies.readBody({
    body: options.body,
    bodyFile: options.bodyFile,
    stdinReservedForApiKey: dependencies.stdinReservedForApiKey(),
  });
  const target = await dependencies.resolveTarget(kind, input);
  const targetRef = apiTarget(target);

  if (options.replyTo) {
    await dependencies.validateReply(targetRef, options.replyTo);
  }

  if (options.dryRun) {
    const workspace = requireWorkspace(dependencies.resolveWorkspace());
    if (mode === 'json') {
      dependencies.writeStdout(
        `${JSON.stringify(
          {
            dryRun: true,
            workspace: workspaceForJson(workspace),
            target: commentTargetJson(target),
            comment: {
              body,
              parentId: options.replyTo ?? null,
            },
            validation: {
              localWrites: false,
              targetResolved: true,
              serverMutation: false,
            },
          },
          null,
          2
        )}\n`
      );
    } else {
      dependencies.writeStdout(
        `Dry run: comment would be added to ${targetLabel(target)}\nNo server mutation performed.\n`
      );
    }
    return;
  }

  const workspace = await dependencies.guardMutation({
    json: mode === 'json',
    yes: options.yes === true,
    noInput: options.input === false,
  });
  const created = await dependencies.create(targetRef, {
    body,
    ...(options.replyTo
      ? {
          parentId: options.replyTo,
          replyTargetValidated: true,
        }
      : {}),
  });

  if (mode === 'json') {
    dependencies.writeStdout(
      `${JSON.stringify(
        {
          ok: true,
          workspace: workspaceForJson(workspace),
          target: commentTargetJson(target),
          comment: created,
        },
        null,
        2
      )}\n`
    );
  } else {
    dependencies.writeStdout(`${renderCommentAdded(target, created)}\n`);
  }
}

export async function runCommentAdd(
  kind: CommentTargetKind,
  input: string,
  options: CommentAddOptions,
  dependencies: CommentRunnerDependencies = defaultDependencies
): Promise<void> {
  return withCacheWritesSuppressed(options.dryRun === true, () =>
    runCommentAddInternal(kind, input, options, dependencies)
  );
}

export async function runCommentList(
  kind: CommentTargetKind,
  input: string,
  options: CommentListOptions,
  dependencies: CommentRunnerDependencies = defaultDependencies
): Promise<void> {
  const mode = outputMode(options);
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

  if (options.all && options.limitSource === 'explicit') {
    dependencies.writeDebug('--limit is ignored when --all is present; requests use pages of 250');
  }

  const target = await dependencies.resolveTarget(kind, input);
  const page = await dependencies.list(apiTarget(target), {
    limit,
    ...(after === undefined ? {} : { after }),
    fetchAll: options.all === true,
  });
  const commands = commentCommands(target, limit, after, page);
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
      commandPath: `${kind} comment list`,
      resource: `${kind}-comment`,
      target: {
        id: target.id,
        label: targetLabel(target),
      },
      filters: {},
      orderBy: 'createdAt',
      limit,
      commands: commands ?? completeCommands(target, limit, after),
    },
  });

  if (history.status === 'failed') {
    dependencies.writeStderr(
      'warning: the comments were fetched, but cursor history could not be saved\n'
    );
  }

  if (mode === 'json') {
    dependencies.writeStdout(
      `${JSON.stringify(listCommentJson(target, page.items, page.pageInfo, history), null, 2)}\n`
    );
  } else {
    dependencies.writeStdout(
      `${renderCommentList({
        target,
        comments: page.items,
        pageInfo: page.pageInfo,
        cursorHistory: history,
        commands,
      })}\n`
    );
  }
}
