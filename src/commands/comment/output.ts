import type { LinearComment } from '../../lib/api/comments.js';
import type {
  CursorCommands,
  CursorHistoryResult,
} from '../../lib/cursor-history-adapter.js';
import type { PageInfo } from '../../lib/pagination.js';
import { quotePosixShellArg } from '../../lib/shell-quote.js';
import type { ResolvedCommentTarget } from './targets.js';

export type CommentTargetJson =
  | { type: 'issue'; id: string; identifier: string; title: string | null }
  | { type: 'project'; id: string; name: string };

export interface CommentCursorCommandInput {
  target: ResolvedCommentTarget;
  limit: number;
  startingAfter?: string;
  emittedCursor: string;
}

export interface CommentListRenderInput {
  target: ResolvedCommentTarget;
  comments: LinearComment[];
  pageInfo: PageInfo;
  cursorHistory: CursorHistoryResult;
  commands: CursorCommands | null;
}

function commandPrefix(target: ResolvedCommentTarget): string[] {
  return [
    'a2l',
    target.type,
    'comment',
    'list',
    quotePosixShellArg(target.originalInput),
  ];
}

export function buildCommentCursorCommands(input: CommentCursorCommandInput): CursorCommands {
  const base = commandPrefix(input.target);
  const withLimit = [...base, '--limit', quotePosixShellArg(String(input.limit))];
  const source = [...withLimit];
  if (input.startingAfter !== undefined) {
    source.push('--after', quotePosixShellArg(input.startingAfter));
  }
  return {
    sourceCommand: source.join(' '),
    nextCommand: [
      ...withLimit,
      '--after',
      quotePosixShellArg(input.emittedCursor),
    ].join(' '),
    allRemainingCommand: [
      ...base,
      '--after',
      quotePosixShellArg(input.emittedCursor),
      '--all',
    ].join(' '),
  };
}

export function commentTargetJson(target: ResolvedCommentTarget): CommentTargetJson {
  if (target.type === 'issue') {
    return {
      type: 'issue',
      id: target.id,
      identifier: target.identifier,
      title: target.title,
    };
  }
  return {
    type: 'project',
    id: target.id,
    name: target.name,
  };
}

export function commentCreatorName(comment: LinearComment): string {
  if (comment.user?.name) return comment.user.name;
  if (comment.botActor?.name) return comment.botActor.name;
  if (comment.botActor?.userDisplayName) return comment.botActor.userDisplayName;
  if (comment.externalUser?.displayName) return comment.externalUser.displayName;
  if (comment.externalUser?.name) return comment.externalUser.name;
  return 'Unknown';
}

function targetHeading(target: ResolvedCommentTarget): string {
  if (target.type === 'issue') {
    return target.title ? `${target.identifier} — ${target.title}` : target.identifier;
  }
  return target.name;
}

function humanTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function plural(count: number): string {
  return count === 1 ? 'comment' : 'comments';
}

export function listCommentJson(
  target: ResolvedCommentTarget,
  comments: LinearComment[],
  pageInfo: PageInfo,
  cursorHistory: CursorHistoryResult
): {
  target: CommentTargetJson;
  comments: LinearComment[];
  pageInfo: PageInfo;
  cursorHistory: { status: CursorHistoryResult['status']; entryId: string | null };
} {
  return {
    target: commentTargetJson(target),
    comments,
    pageInfo,
    cursorHistory: {
      status: cursorHistory.status,
      entryId: cursorHistory.entryId,
    },
  };
}

export function renderCommentAdded(
  target: ResolvedCommentTarget,
  comment: LinearComment
): string {
  return [
    `Comment added to ${targetHeading(target)}`,
    `ID: ${comment.id}`,
    ...(comment.url ? [`URL: ${comment.url}`] : []),
  ].join('\n');
}

export function renderCommentList(input: CommentListRenderInput): string {
  const lines: string[] = [`Comments for ${targetHeading(input.target)}`, ''];

  if (input.comments.length === 0) {
    lines.push('No comments found.');
  } else {
    input.comments.forEach((comment, index) => {
      if (index > 0) lines.push('');
      lines.push(
        `${humanTimestamp(comment.createdAt)} · ${commentCreatorName(comment)} · ${comment.id}`
      );
      for (const line of comment.body.split('\n')) {
        lines.push(`  ${line}`);
      }
    });
  }

  if (input.comments.length > 0) lines.push('');
  if (input.pageInfo.hasNextPage) {
    lines.push(
      `Showing ${input.pageInfo.returnedCount} ${plural(input.pageInfo.returnedCount)}; more are available.`
    );
    if (input.commands) {
      lines.push('', 'Next page:', `  ${input.commands.nextCommand}`);
      lines.push('', 'All remaining:', `  ${input.commands.allRemainingCommand}`);
    }
    if (input.cursorHistory.status === 'recorded' && input.cursorHistory.entryId) {
      lines.push('', `Cursor history: ${input.cursorHistory.entryId}`);
    }
  } else {
    lines.push(`Total: ${input.pageInfo.returnedCount} ${plural(input.pageInfo.returnedCount)}`);
  }

  return lines.join('\n');
}
