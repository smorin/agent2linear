import type { Command } from 'commander';

import {
  type CommentCommandHandlers,
  registerCommentGroup,
} from '../../comment/register.js';
import { addIssueCommentCommand } from './add.js';
import { listIssueCommentsCommand } from './list.js';

const defaultHandlers: CommentCommandHandlers = {
  add: addIssueCommentCommand,
  list: listIssueCommentsCommand,
};

export function registerIssueCommentCommands(
  issue: Command,
  handlers: CommentCommandHandlers = defaultHandlers
): Command {
  return registerCommentGroup(
    issue,
    '<identifier>',
    'Issue identifier (ENG-123) or UUID.',
    handlers,
    { rejectLegacyIssueSyntax: true }
  );
}
