import type { Command } from 'commander';

import {
  type CommentListOptions,
  runCommentList,
} from '../../comment/runner.js';

function outputSource(command?: Command): 'default' | 'explicit' {
  return command?.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default';
}

export async function listIssueCommentsCommand(
  identifier: string,
  options: CommentListOptions,
  command?: Command
): Promise<void> {
  await runCommentList('issue', identifier, {
    ...options,
    ...(options.limit === undefined ? {} : {
      limitSource: command?.getOptionValueSource('limit') === 'cli' ? 'explicit' : 'default',
    }),
    ...(options.output === undefined ? {} : { outputSource: outputSource(command) }),
  });
}
