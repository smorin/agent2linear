import { Command } from 'commander';

import { createIssueLabelCommand } from './create.js';
import { deleteIssueLabelCommand } from './delete.js';
import { listIssueLabels } from './list.js';
import { syncIssueLabelAliases } from './sync-aliases.js';
import { updateIssueLabelCommand } from './update.js';
import { viewIssueLabel } from './view.js';

export function registerIssueLabelsCommands(cli: Command): void {
  const issueLabels = cli
    .command('issue-labels')
    .alias('ilbl')
    .description('Manage issue labels');

  listIssueLabels(issueLabels);
  viewIssueLabel(issueLabels);
  createIssueLabelCommand(issueLabels);
  updateIssueLabelCommand(issueLabels);
  deleteIssueLabelCommand(issueLabels);
  syncIssueLabelAliases(issueLabels);
}
