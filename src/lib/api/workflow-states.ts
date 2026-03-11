import { getLinearClient, LinearClientError } from './client.js';
import type { WorkflowState } from '../types.js';

/**
 * Workflow State input types
 */
export interface WorkflowStateCreateInput {
  name: string;
  teamId: string;
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  description?: string;
  position?: number;
}

export interface WorkflowStateUpdateInput {
  name?: string;
  type?: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color?: string;
  description?: string;
  position?: number;
}

/**
 * Get all workflow states for a team (or all teams)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern when fetching all workflow states
 * Previous: 1 + N API calls (1 for teams + N for states per team)
 * Optimized: 1 API call with nested states data
 */
export async function getAllWorkflowStates(teamId?: string): Promise<WorkflowState[]> {
  try {
    const client = getLinearClient();
    const result: WorkflowState[] = [];

    if (teamId) {
      // Get workflow states for a specific team (already efficient - 2 calls)
      const team = await client.team(teamId);
      if (!team) {
        throw new Error(`Team not found: ${teamId}`);
      }

      const states = await team.states();
      for (const state of states.nodes) {
        result.push({
          id: state.id,
          name: state.name,
          type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
          color: state.color,
          description: state.description || undefined,
          position: state.position,
          teamId: team.id,
        });
      }
    } else {
      // Get workflow states for all teams - OPTIMIZED with custom GraphQL
      const statesQuery = `
        query GetAllWorkflowStates {
          teams {
            nodes {
              id
              states {
                nodes {
                  id
                  name
                  type
                  color
                  description
                  position
                }
              }
            }
          }
        }
      `;

      const response: any = await client.client.rawRequest(statesQuery);
      const teamsData = response.data?.teams?.nodes || [];

      for (const team of teamsData) {
        for (const state of team.states.nodes) {
          result.push({
            id: state.id,
            name: state.name,
            type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
            color: state.color,
            description: state.description || undefined,
            position: state.position,
            teamId: team.id,
          });
        }
      }
    }

    // Sort by team, then position
    return result.sort((a, b) => {
      if (a.teamId !== b.teamId) {
        return a.teamId.localeCompare(b.teamId);
      }
      return a.position - b.position;
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch workflow states: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single workflow state by ID
 */
export async function getWorkflowStateById(id: string): Promise<WorkflowState | null> {
  try {
    const client = getLinearClient();
    const state = await client.workflowState(id);

    if (!state) {
      return null;
    }

    const team = await state.team;

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: team?.id || '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new workflow state
 */
export async function createWorkflowState(input: WorkflowStateCreateInput): Promise<WorkflowState> {
  try {
    const client = getLinearClient();

    const payload = await client.createWorkflowState({
      name: input.name,
      teamId: input.teamId,
      type: input.type,
      color: input.color,
      description: input.description,
      position: input.position,
    });

    const state = await payload.workflowState;
    if (!state) {
      throw new Error('Failed to create workflow state: No state returned from API');
    }

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: input.teamId,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a workflow state
 */
export async function updateWorkflowState(id: string, input: WorkflowStateUpdateInput): Promise<WorkflowState> {
  try {
    const client = getLinearClient();

    const payload = await client.updateWorkflowState(id, {
      name: input.name,
      color: input.color,
      description: input.description,
      position: input.position,
    });

    const state = await payload.workflowState;
    if (!state) {
      throw new Error('Failed to update workflow state: No state returned from API');
    }

    const team = await state.team;

    return {
      id: state.id,
      name: state.name,
      type: state.type as 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled',
      color: state.color,
      description: state.description || undefined,
      position: state.position,
      teamId: team?.id || '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a workflow state (archives it in Linear)
 */
export async function deleteWorkflowState(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.archiveWorkflowState(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
