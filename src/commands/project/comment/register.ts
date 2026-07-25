import type { Command } from 'commander';

import {
  type CommentCommandHandlers,
  registerCommentGroup,
} from '../../comment/register.js';
import { addProjectCommentCommand } from './add.js';
import { listProjectCommentsCommand } from './list.js';

const defaultHandlers: CommentCommandHandlers = {
  add: addProjectCommentCommand,
  list: listProjectCommentsCommand,
};

export function registerProjectCommentCommands(
  project: Command,
  handlers: CommentCommandHandlers = defaultHandlers
): Command {
  return registerCommentGroup(
    project,
    '<name-or-id>',
    'Project ID, configured alias, or resolvable name.',
    handlers
  );
}
