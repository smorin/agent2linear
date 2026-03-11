import { Command } from 'commander';
import { listIssueLabels } from './list.js';
import { viewIssueLabel } from './view.js';
import { createIssueLabelCommand } from './create.js';
import { updateIssueLabelCommand } from './update.js';
import { deleteIssueLabelCommand } from './delete.js';
import { syncIssueLabelAliases } from './sync-aliases.js';

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
