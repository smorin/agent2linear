import type { Command } from 'commander';

import {
  type CommentListOptions,
  runCommentList,
} from '../../comment/runner.js';

function outputSource(command?: Command): 'default' | 'explicit' {
  return command?.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default';
}

export async function listProjectCommentsCommand(
  nameOrId: string,
  options: CommentListOptions,
  command?: Command
): Promise<void> {
  await runCommentList('project', nameOrId, {
    ...options,
    ...(options.limit === undefined ? {} : {
      limitSource: command?.getOptionValueSource('limit') === 'cli' ? 'explicit' : 'default',
    }),
    ...(options.output === undefined ? {} : { outputSource: outputSource(command) }),
  });
}
