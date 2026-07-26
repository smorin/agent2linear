import { describe, expect, it } from 'vitest';

import type { LinearComment } from '../../lib/api/comments.js';
import type { CursorHistoryResult } from '../../lib/cursor-history-adapter.js';
import type { PageInfo } from '../../lib/pagination.js';
import {
  buildCommentCursorCommands,
  commentCreatorName,
  commentTargetJson,
  listCommentJson,
  renderCommentAdded,
  renderCommentList,
} from './output.js';
import type { ResolvedCommentTarget } from './targets.js';

const issueTarget: ResolvedCommentTarget = {
  type: 'issue',
  id: 'issue-1',
  identifier: 'ENG-123',
  title: 'Reconnect safely',
  resolvedBy: 'identifier',
  originalInput: 'ENG-123',
};

const projectTarget: ResolvedCommentTarget = {
  type: 'project',
  id: 'project-1',
  name: 'Backend migration',
  resolvedBy: 'name',
  originalInput: 'Backend migration',
};

function comment(overrides: Partial<LinearComment> = {}): LinearComment {
  return {
    id: 'comment-1',
    url: 'https://linear.app/comment/comment-1',
    body: 'line one\nline two',
    createdAt: '2026-07-24T18:32:04.000Z',
    updatedAt: '2026-07-24T18:33:04.000Z',
    editedAt: null,
    resolvedAt: null,
    parentId: null,
    quotedText: null,
    user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
    botActor: null,
    externalUser: null,
    ...overrides,
  };
}

const complete: PageInfo = {
  returnedCount: 1,
  hasNextPage: false,
  endCursor: null,
  fetchedAll: true,
};

describe('comment output', () => {
  it('CMT-OUT-HUMAN-CREATOR uses user, bot, external, then Unknown', () => {
    expect(commentCreatorName(comment())).toBe('Ada');
    expect(commentCreatorName(comment({ user: null, botActor: {
      id: 'bot-1', name: 'Linear Bot', type: 'integration', subType: null,
      userDisplayName: null, avatarUrl: null,
    } }))).toBe('Linear Bot');
    expect(commentCreatorName(comment({ user: null, externalUser: {
      id: 'ext-1', name: 'External', displayName: 'External Person', email: null, avatarUrl: null,
    } }))).toBe('External Person');
    expect(commentCreatorName(comment({ user: null }))).toBe('Unknown');
  });

  it('CMT-OUT-SHELL-QUOTE-TARGET/CURSOR creates copyable target-preserving commands', () => {
    const commands = buildCommentCursorCommands({
      target: { ...projectTarget, originalInput: "Backend's $(migration)" },
      limit: 25,
      startingAfter: 'old cursor',
      emittedCursor: "next'$(cursor)",
    });
    expect(commands).toEqual({
      sourceCommand: "a2l project comment list 'Backend'\"'\"'s $(migration)' --limit '25' --after 'old cursor'",
      nextCommand: "a2l project comment list 'Backend'\"'\"'s $(migration)' --limit '25' --after 'next'\"'\"'$(cursor)'",
      allRemainingCommand: "a2l project comment list 'Backend'\"'\"'s $(migration)' --after 'next'\"'\"'$(cursor)' --all",
    });
  });

  it('CMT-OUT-LJ-* emits only stable target/comment/page/history fields', () => {
    const history: CursorHistoryResult = { status: 'not_applicable', entryId: null };
    const output = listCommentJson(issueTarget, [comment()], complete, history);
    expect(output).toEqual({
      target: { type: 'issue', id: 'issue-1', identifier: 'ENG-123', title: 'Reconnect safely' },
      comments: [comment()],
      pageInfo: complete,
      cursorHistory: history,
    });
    expect(commentTargetJson(projectTarget)).toEqual({
      type: 'project', id: 'project-1', name: 'Backend migration',
    });
  });

  it('CMT-OUT-IA-HUMAN/CMT-OUT-PA-HUMAN identify target, ID, and optional URL', () => {
    expect(renderCommentAdded(issueTarget, comment())).toContain(
      'Comment added to ENG-123 — Reconnect safely\nID: comment-1\nURL: https://linear.app/comment/comment-1'
    );
    expect(renderCommentAdded(projectTarget, comment({ url: null }))).toBe(
      'Comment added to Backend migration\nID: comment-1'
    );
  });

  it('CMT-OUT-IL-HUMAN renders stacked multiline records and a complete total', () => {
    const result = renderCommentList({
      target: issueTarget,
      comments: [comment()],
      pageInfo: complete,
      cursorHistory: { status: 'not_applicable', entryId: null },
      commands: null,
    });
    expect(result).toContain('Comments for ENG-123 — Reconnect safely');
    expect(result).toContain('2026-07-24 18:32 · Ada · comment-1');
    expect(result).toContain('  line one\n  line two');
    expect(result).toContain('Total: 1 comment');
  });

  it('CMT-OUT-HUMAN-EMPTY succeeds with the explicit zero total', () => {
    expect(renderCommentList({
      target: projectTarget,
      comments: [],
      pageInfo: { ...complete, returnedCount: 0 },
      cursorHistory: { status: 'not_applicable', entryId: null },
      commands: null,
    })).toContain('No comments found.\nTotal: 0 comments');
  });

  it('CMT-OUT-HUMAN-NEXT prints next/all commands and recorded history ID', () => {
    const pageInfo: PageInfo = {
      returnedCount: 1,
      hasNextPage: true,
      endCursor: 'cursor-1',
      fetchedAll: false,
    };
    const commands = buildCommentCursorCommands({
      target: issueTarget,
      limit: 1,
      emittedCursor: 'cursor-1',
    });
    const result = renderCommentList({
      target: issueTarget,
      comments: [comment()],
      pageInfo,
      cursorHistory: { status: 'recorded', entryId: 'history-1' },
      commands,
    });
    expect(result).toContain('Showing 1 comment; more are available.');
    expect(result).toContain(`Next page:\n  ${commands.nextCommand}`);
    expect(result).toContain(`All remaining:\n  ${commands.allRemainingCommand}`);
    expect(result).toContain('Cursor history: history-1');
    expect(result).not.toContain('Total:');
  });
});
