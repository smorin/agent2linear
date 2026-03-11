import { Command } from 'commander';

import { createProjectLabelCommand } from './create.js';
import { deleteProjectLabelCommand } from './delete.js';
import { listProjectLabels } from './list.js';
import { syncProjectLabelAliases } from './sync-aliases.js';
import { updateProjectLabelCommand } from './update.js';
import { viewProjectLabel } from './view.js';

export function registerProjectLabelsCommands(cli: Command): void {
  const projectLabels = cli
    .command('project-labels')
    .alias('plbl')
    .description('Manage project labels');

  listProjectLabels(projectLabels);
  viewProjectLabel(projectLabels);
  createProjectLabelCommand(projectLabels);
  updateProjectLabelCommand(projectLabels);
  deleteProjectLabelCommand(projectLabels);
  syncProjectLabelAliases(projectLabels);
}
