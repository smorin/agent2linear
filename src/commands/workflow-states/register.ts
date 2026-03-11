import { Command } from 'commander';

import { createWorkflowStateCommand } from './create.js';
import { deleteWorkflowStateCommand } from './delete.js';
import { listWorkflowStates } from './list.js';
import { syncWorkflowStateAliases } from './sync-aliases.js';
import { updateWorkflowStateCommand } from './update.js';
import { viewWorkflowState } from './view.js';

export function registerWorkflowStatesCommands(cli: Command): void {
  const workflowStates = cli
    .command('workflow-states')
    .alias('wstate')
    .alias('ws')
    .description('Manage workflow states (issue statuses)');

  listWorkflowStates(workflowStates);
  viewWorkflowState(workflowStates);
  createWorkflowStateCommand(workflowStates);
  updateWorkflowStateCommand(workflowStates);
  deleteWorkflowStateCommand(workflowStates);
  syncWorkflowStateAliases(workflowStates);
}
