import { getLinearClient, LinearClientError } from './client.js';
import type { IssueLabel, ProjectLabel } from '../types.js';

/**
 * Issue Label types
 */
export interface IssueLabelCreateInput {
  name: string;
  color: string;
  description?: string;
  teamId?: string; // undefined for workspace-level labels
}

export interface IssueLabelUpdateInput {
  name?: string;
  color?: string;
  description?: string;
}

/**
 * Project Label types
 */
export interface ProjectLabelCreateInput {
  name: string;
  color: string;
  description?: string;
}

export interface ProjectLabelUpdateInput {
  name?: string;
  color?: string;
  description?: string;
}

/**
 * Get all issue labels (workspace-level and/or team-level)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern when fetching all labels
 * Previous: 1 + N API calls (1 for labels + N for teams)
 * Optimized: 1 API call with nested team data
 */
export async function getAllIssueLabels(teamId?: string): Promise<IssueLabel[]> {
  try {
    const client = getLinearClient();
    const result: IssueLabel[] = [];

    if (teamId) {
      // Get labels for a specific team (already efficient - 2 calls)
      const team = await client.team(teamId);
      if (!team) {
        throw new Error(`Team not found: ${teamId}`);
      }

      const labels = await team.labels();
      for (const label of labels.nodes) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
          teamId: team.id,
        });
      }
    } else {
      // Get all labels (workspace + all teams) - OPTIMIZED with custom GraphQL
      const labelsQuery = `
        query GetAllIssueLabels {
          issueLabels {
            nodes {
              id
              name
              color
              description
              team {
                id
              }
            }
          }
        }
      `;

      const response: any = await client.client.rawRequest(labelsQuery);
      const labelsData = response.data?.issueLabels?.nodes || [];

      for (const label of labelsData) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
          teamId: label.team?.id,
        });
      }
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch issue labels: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single issue label by ID
 */
export async function getIssueLabelById(id: string): Promise<IssueLabel | null> {
  try {
    const client = getLinearClient();
    const label = await client.issueLabel(id);

    if (!label) {
      return null;
    }

    const team = await label.team;

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: team?.id,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new issue label
 */
export async function createIssueLabel(input: IssueLabelCreateInput): Promise<IssueLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.createIssueLabel({
      name: input.name,
      color: input.color,
      description: input.description,
      teamId: input.teamId,
    });

    const label = await payload.issueLabel;
    if (!label) {
      throw new Error('Failed to create issue label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: input.teamId,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update an issue label
 */
export async function updateIssueLabel(id: string, input: IssueLabelUpdateInput): Promise<IssueLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.updateIssueLabel(id, {
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.issueLabel;
    if (!label) {
      throw new Error('Failed to update issue label: No label returned from API');
    }

    const team = await label.team;

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: team?.id,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete an issue label
 */
export async function deleteIssueLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteIssueLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete issue label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all project labels (workspace-level only)
 * @param includeAll - If true, fetches ALL labels including ones never applied to projects
 */
export async function getAllProjectLabels(includeAll?: boolean): Promise<ProjectLabel[]> {
  try {
    const client = getLinearClient();
    const result: ProjectLabel[] = [];

    if (includeAll) {
      // Use raw GraphQL query to fetch ALL project labels including unused ones
      const query = `
        query GetAllProjectLabels {
          organization {
            projectLabels {
              nodes {
                id
                name
                color
                description
                lastAppliedAt
              }
            }
          }
        }
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await client.client.rawRequest(query);

      if (process.env.DEBUG) {
        console.log(`DEBUG: Raw GraphQL response:`, JSON.stringify(response.data, null, 2));
      }

      const labels = response.data?.organization?.projectLabels?.nodes || [];

      for (const label of labels) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
        });
      }

      if (process.env.DEBUG) {
        console.log(`DEBUG: Fetched ${result.length} labels via raw GraphQL query`);
      }
    } else {
      // Default: use SDK method which may only return labels that have been applied
      const labels = await client.projectLabels();

      for (const label of labels.nodes) {
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
        });
      }

      if (process.env.DEBUG) {
        console.log(`DEBUG: Fetched ${result.length} labels from client.projectLabels()`);
      }
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project labels: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project label by ID
 */
export async function getProjectLabelById(id: string): Promise<ProjectLabel | null> {
  try {
    const client = getLinearClient();
    const label = await client.projectLabel(id);

    if (!label) {
      return null;
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a new project label
 */
export async function createProjectLabel(input: ProjectLabelCreateInput): Promise<ProjectLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.createProjectLabel({
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.projectLabel;
    if (!label) {
      throw new Error('Failed to create project label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a project label
 */
export async function updateProjectLabel(id: string, input: ProjectLabelUpdateInput): Promise<ProjectLabel> {
  try {
    const client = getLinearClient();

    const payload = await client.updateProjectLabel(id, {
      name: input.name,
      color: input.color,
      description: input.description,
    });

    const label = await payload.projectLabel;
    if (!label) {
      throw new Error('Failed to update project label: No label returned from API');
    }

    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a project label
 */
export async function deleteProjectLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteProjectLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete project label: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
