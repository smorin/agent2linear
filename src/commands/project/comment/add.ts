import type { Command } from 'commander';

import {
  type CommentAddOptions,
  runCommentAdd,
} from '../../comment/runner.js';

function outputSource(command?: Command): 'default' | 'explicit' {
  return command?.getOptionValueSource('output') === 'cli' ? 'explicit' : 'default';
}

export async function addProjectCommentCommand(
  nameOrId: string,
  options: CommentAddOptions,
  command?: Command
): Promise<void> {
  await runCommentAdd('project', nameOrId, {
    ...options,
    ...(options.output === undefined ? {} : { outputSource: outputSource(command) }),
  });
}
