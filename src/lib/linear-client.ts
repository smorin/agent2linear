import { LinearClient as SDKClient } from '@linear/sdk';
import { getApiKey } from './config.js';

export class LinearClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearClientError';
  }
}

/**
 * Get authenticated Linear client
 */
export function getLinearClient(): SDKClient {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new LinearClientError(
      'Linear API key not found. Please set LINEAR_API_KEY environment variable or configure it using the config file.'
    );
  }

  // Validate API key format (Linear API keys start with "lin_api_")
  if (!apiKey.startsWith('lin_api_')) {
    throw new LinearClientError(
      'Invalid Linear API key format. API keys should start with "lin_api_"'
    );
  }

  return new SDKClient({ apiKey });
}

/**
 * Test the Linear API connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  user?: { name: string; email: string };
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      success: true,
      user: {
        name: viewer.name,
        email: viewer.email,
      },
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate API key by testing connection
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new SDKClient({ apiKey });
    await client.viewer;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate initiative ID exists and return its details
 */
export async function validateInitiativeExists(
  initiativeId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const client = getLinearClient();
    const initiative = await client.initiative(initiativeId);

    if (!initiative) {
      return {
        valid: false,
        error: `Initiative with ID "${initiativeId}" not found`,
      };
    }

    return {
      valid: true,
      name: initiative.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        valid: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate initiative',
    };
  }
}

/**
 * Validate team ID exists and return its details
 */
export async function validateTeamExists(
  teamId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const client = getLinearClient();
    const team = await client.team(teamId);

    if (!team) {
      return {
        valid: false,
        error: `Team with ID "${teamId}" not found`,
      };
    }

    return {
      valid: true,
      name: team.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        valid: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate team',
    };
  }
}

/**
 * Initiative data structure
 */
export interface Initiative {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

/**
 * Team data structure
 */
export interface Team {
  id: string;
  name: string;
  description?: string;
  key: string;
}

/**
 * Project data structure (for listing/selection)
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
}

/**
 * Get all initiatives from Linear
 */
export async function getAllInitiatives(): Promise<Initiative[]> {
  try {
    const client = getLinearClient();
    const initiatives = await client.initiatives();

    const result: Initiative[] = [];
    for await (const initiative of initiatives.nodes) {
      result.push({
        id: initiative.id,
        name: initiative.name,
        description: initiative.description,
      });
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch initiatives: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single initiative by ID
 */
export async function getInitiativeById(
  initiativeId: string
): Promise<{ id: string; name: string; description?: string; url: string } | null> {
  try {
    const client = getLinearClient();
    const initiative = await client.initiative(initiativeId);

    if (!initiative) {
      return null;
    }

    return {
      id: initiative.id,
      name: initiative.name,
      description: initiative.description || undefined,
      url: initiative.url,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch initiative: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all teams from Linear
 */
export async function getAllTeams(): Promise<Team[]> {
  try {
    const client = getLinearClient();
    const teams = await client.teams();

    const result: Team[] = [];
    for await (const team of teams.nodes) {
      result.push({
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        key: team.key,
      });
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch teams: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single team by ID
 */
export async function getTeamById(
  teamId: string
): Promise<{ id: string; name: string; key: string; description?: string; url: string } | null> {
  try {
    const client = getLinearClient();
    const team = await client.team(teamId);

    if (!team) {
      return null;
    }

    return {
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description || undefined,
      url: `https://linear.app/team/${team.key.toLowerCase()}`,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch team: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all projects from Linear
 */
export async function getAllProjects(): Promise<Project[]> {
  try {
    const client = getLinearClient();
    const projects = await client.projects();

    const result: Project[] = [];
    for await (const project of projects.nodes) {
      result.push({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
      });
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch projects: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project creation input
 */
export interface ProjectCreateInput {
  name: string;
  description?: string;
  state?: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  initiativeId?: string;
  teamId?: string;
  templateId?: string;
  // Additional Linear SDK fields
  statusId?: string;
  content?: string;
  icon?: string;
  color?: string;
  leadId?: string;
  labelIds?: string[];
  convertedFromIssueId?: string;
  startDate?: string;
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDate?: string;
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  priority?: number;
  memberIds?: string[];
}

/**
 * Project result with metadata
 */
export interface ProjectResult {
  id: string;
  name: string;
  url: string;
  state: string;
  initiative?: {
    id: string;
    name: string;
  };
  team?: {
    id: string;
    name: string;
  };
}

/**
 * Check if a project with the given name already exists (legacy - returns boolean)
 */
export async function getProjectByName(name: string): Promise<boolean> {
  try {
    const project = await findProjectByName(name);
    return project !== null;
  } catch (error) {
    // If we can't check, allow creation to proceed
    return false;
  }
}

/**
 * Find a project by its exact name and return full project details
 */
export async function findProjectByName(name: string): Promise<ProjectResult | null> {
  try {
    const client = getLinearClient();
    const projects = await client.projects({
      filter: {
        name: { eq: name },
      },
    });

    const projectsList = await projects.nodes;
    if (projectsList.length === 0) {
      return null;
    }

    const project = projectsList[0];

    // Fetch initiative details if linked
    let initiative;
    try {
      const projectInitiatives = await project.initiatives();
      const initiativesList = await projectInitiatives.nodes;
      if (initiativesList && initiativesList.length > 0) {
        const firstInitiative = initiativesList[0];
        initiative = {
          id: firstInitiative.id,
          name: firstInitiative.name,
        };
      }
    } catch {
      // Initiative fetch failed or not linked
    }

    // Fetch team details if set
    let team;
    try {
      const teams = await project.teams();
      const teamsList = await teams.nodes;
      if (teamsList && teamsList.length > 0) {
        const firstTeam = teamsList[0];
        team = {
          id: firstTeam.id,
          name: firstTeam.name,
        };
      }
    } catch {
      // Team fetch failed
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create a new project in Linear
 */
export async function createProject(input: ProjectCreateInput): Promise<ProjectResult> {
  try {
    const client = getLinearClient();

    // Prepare the creation input
    const createInput: any = {
      name: input.name,
      description: input.description,
      ...(input.teamId && { teamIds: [input.teamId] }),
      ...(input.templateId && { lastAppliedTemplateId: input.templateId }),
      // Additional optional fields
      ...(input.statusId && { statusId: input.statusId }),
      ...(input.content && { content: input.content }),
      ...(input.icon && { icon: input.icon }),
      ...(input.color && { color: input.color }),
      ...(input.leadId && { leadId: input.leadId }),
      ...(input.labelIds && input.labelIds.length > 0 && { labelIds: input.labelIds }),
      ...(input.convertedFromIssueId && { convertedFromIssueId: input.convertedFromIssueId }),
      ...(input.startDate && { startDate: input.startDate }),
      ...(input.startDateResolution && { startDateResolution: input.startDateResolution }),
      ...(input.targetDate && { targetDate: input.targetDate }),
      ...(input.targetDateResolution && { targetDateResolution: input.targetDateResolution }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.memberIds && input.memberIds.length > 0 && { memberIds: input.memberIds }),
    };

    // Debug: log what we're sending to the API
    if (process.env.DEBUG) {
      console.log('DEBUG: createInput =', JSON.stringify(createInput, null, 2));
    }

    // Create the project
    const projectPayload = await client.createProject(createInput);

    const project = await projectPayload.project;

    if (!project) {
      throw new Error('Failed to create project: No project returned from API');
    }

    // Debug: Check if template was applied
    if (process.env.DEBUG && input.templateId) {
      try {
        const lastAppliedTemplate = await (project as any).lastAppliedTemplate;
        if (lastAppliedTemplate) {
          console.log(`DEBUG: Template applied - ID: ${lastAppliedTemplate.id}, Name: ${lastAppliedTemplate.name}`);
        } else {
          console.log('DEBUG: No template was applied to the project');
        }
      } catch (err) {
        console.log('DEBUG: Could not check lastAppliedTemplate:', err instanceof Error ? err.message : err);
      }
    }

    // Link project to initiative if specified
    let initiative;
    if (input.initiativeId) {
      try {
        // First fetch initiative details
        const initiativeData = await client.initiative(input.initiativeId);
        initiative = {
          id: initiativeData.id,
          name: initiativeData.name,
        };

        // Link project to initiative using initiativeToProjectCreate
        await client.createInitiativeToProject({
          initiativeId: input.initiativeId,
          projectId: project.id,
        });

        if (process.env.DEBUG) {
          console.log(`DEBUG: Successfully linked project ${project.id} to initiative ${input.initiativeId}`);
        }
      } catch (err) {
        // Initiative link failed - log in debug mode
        if (process.env.DEBUG) {
          console.log('DEBUG: Failed to link initiative:', err);
        }
        // Don't throw - project was still created successfully
      }
    }

    // Fetch team details if set
    let team;
    if (input.teamId) {
      try {
        const teamData = await client.team(input.teamId);
        team = {
          id: teamData.id,
          name: teamData.name,
        };
      } catch {
        // Team fetch failed
      }
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project Update Input
 */
export interface ProjectUpdateInput {
  statusId?: string;
  name?: string;
  description?: string;
  priority?: number;
  startDate?: string;
  targetDate?: string;
}

/**
 * Update an existing project
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdateInput
): Promise<ProjectResult> {
  try {
    const client = getLinearClient();

    // Prepare the update input
    const updateInput: any = {};

    if (updates.statusId !== undefined) {
      updateInput.statusId = updates.statusId;
    }
    if (updates.name !== undefined) {
      updateInput.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateInput.description = updates.description;
    }
    if (updates.priority !== undefined) {
      updateInput.priority = updates.priority;
    }
    if (updates.startDate !== undefined) {
      updateInput.startDate = updates.startDate;
    }
    if (updates.targetDate !== undefined) {
      updateInput.targetDate = updates.targetDate;
    }

    // Update the project
    const projectPayload = await client.updateProject(projectId, updateInput);
    const project = await projectPayload.project;

    if (!project) {
      throw new Error('Failed to update project: No project returned from API');
    }

    // Fetch initiative details if linked
    let initiative;
    try {
      const projectInitiatives = await project.initiatives();
      const initiativesList = await projectInitiatives.nodes;
      if (initiativesList && initiativesList.length > 0) {
        const firstInitiative = initiativesList[0];
        initiative = {
          id: firstInitiative.id,
          name: firstInitiative.name,
        };
      }
    } catch {
      // Initiative fetch failed or not linked
    }

    // Fetch team details if set
    let team;
    try {
      const teams = await project.teams();
      const teamsList = await teams.nodes;
      if (teamsList && teamsList.length > 0) {
        const firstTeam = teamsList[0];
        team = {
          id: firstTeam.id,
          name: firstTeam.name,
        };
      }
    } catch {
      // Team fetch failed
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project by ID
 */
export async function getProjectById(
  projectId: string
): Promise<ProjectResult | null> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      return null;
    }

    // Fetch initiative details if linked
    let initiative;
    try {
      const projectInitiatives = await project.initiatives();
      const initiativesList = await projectInitiatives.nodes;
      if (initiativesList && initiativesList.length > 0) {
        const firstInitiative = initiativesList[0];
        initiative = {
          id: firstInitiative.id,
          name: firstInitiative.name,
        };
      }
    } catch {
      // Initiative fetch failed or not linked
    }

    // Fetch team details if set
    let team;
    try {
      const teams = await project.teams();
      const teamsList = await teams.nodes;
      if (teamsList && teamsList.length > 0) {
        const firstTeam = teamsList[0];
        team = {
          id: firstTeam.id,
          name: firstTeam.name,
        };
      }
    } catch {
      // Team fetch failed or not set
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      state: project.state,
      initiative,
      team,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get project milestones and issues for validation
 */
export async function getProjectDetails(projectId: string): Promise<{
  project: ProjectResult;
  lastAppliedTemplate?: { id: string; name: string };
  milestones: Array<{ id: string; name: string }>;
  issues: Array<{ id: string; identifier: string; title: string }>;
} | null> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      return null;
    }

    // Get basic project info
    const projectResult = await getProjectById(projectId);
    if (!projectResult) {
      return null;
    }

    // Get last applied template
    let lastAppliedTemplate;
    try {
      const template = await (project as any).lastAppliedTemplate;
      if (template) {
        lastAppliedTemplate = {
          id: template.id,
          name: template.name,
        };
      }
    } catch {
      // Template not available
    }

    // Get milestones
    const milestones: Array<{ id: string; name: string }> = [];
    try {
      const projectMilestones = await project.projectMilestones();
      const milestonesList = await projectMilestones.nodes;
      for (const milestone of milestonesList) {
        milestones.push({
          id: milestone.id,
          name: milestone.name,
        });
      }
    } catch {
      // Milestones not available
    }

    // Get issues
    const issues: Array<{ id: string; identifier: string; title: string }> = [];
    try {
      const projectIssues = await project.issues();
      const issuesList = await projectIssues.nodes;
      for (const issue of issuesList) {
        issues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
        });
      }
    } catch {
      // Issues not available
    }

    return {
      project: projectResult,
      lastAppliedTemplate,
      milestones,
      issues,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project details: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Template data structure (from types.ts)
 */
export interface Template {
  id: string;
  name: string;
  type: 'issue' | 'project';
  description?: string;
}

/**
 * Get all templates from Linear
 */
export async function getAllTemplates(typeFilter?: 'issue' | 'project'): Promise<Template[]> {
  try {
    const client = getLinearClient();
    const result: Template[] = [];

    // Fetch all templates from Linear
    // Linear uses a single Template type with a 'type' field to distinguish between issue and project templates
    try {
      // client.templates returns LinearFetch<Template[]> which is Promise<Template[]>
      const templates = await client.templates;

      for (const template of templates) {
        // Determine template type based on the 'type' field from Linear
        // Linear uses different type values, but we normalize to 'issue' or 'project'
        let templateType: 'issue' | 'project';

        if (template.type.toLowerCase().includes('project')) {
          templateType = 'project';
        } else {
          // Default to issue template (most common case)
          templateType = 'issue';
        }

        // Apply filter if specified
        if (typeFilter && templateType !== typeFilter) {
          continue;
        }

        result.push({
          id: template.id,
          name: template.name,
          type: templateType,
          description: template.description || undefined,
        });
      }
    } catch (err) {
      // Templates may not be available - log the error for debugging
      if (process.env.DEBUG) {
        console.error('Error fetching templates:', err);
      }
      throw err; // Re-throw to let caller know there was an error
    }

    // Sort by type then name
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  templateId: string
): Promise<{ id: string; name: string; type: 'issue' | 'project'; description?: string } | null> {
  try {
    const client = getLinearClient();

    // Fetch the template by ID
    const template = await client.template(templateId);
    if (!template) {
      return null;
    }

    // Determine template type based on the 'type' field from Linear
    let templateType: 'issue' | 'project';
    if (template.type.toLowerCase().includes('project')) {
      templateType = 'project';
    } else {
      templateType = 'issue';
    }

    return {
      id: template.id,
      name: template.name,
      type: templateType,
      description: template.description || undefined,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Project Status types
 */
export interface ProjectStatus {
  id: string;
  name: string;
  type: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  color: string;
  description?: string;
  position: number;
}

/**
 * Get all project statuses from the organization
 */
export async function getAllProjectStatuses(): Promise<ProjectStatus[]> {
  try {
    const client = getLinearClient();
    const organization = await client.organization;
    const statuses = await organization.projectStatuses;

    return statuses.map((status: any) => ({
      id: status.id,
      name: status.name,
      type: status.type as 'planned' | 'started' | 'paused' | 'completed' | 'canceled',
      color: status.color,
      description: status.description || undefined,
      position: status.position,
    }));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project statuses: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single project status by ID
 */
export async function getProjectStatusById(statusId: string): Promise<ProjectStatus | null> {
  try {
    const client = getLinearClient();
    const status = await client.projectStatus(statusId);

    if (!status) {
      return null;
    }

    return {
      id: status.id,
      name: status.name,
      type: status.type as 'planned' | 'started' | 'paused' | 'completed' | 'canceled',
      color: status.color,
      description: status.description || undefined,
      position: status.position,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Milestone-related types
 */
export interface ProjectMilestone {
  id: string;
  name: string;
  description?: string;
  targetDate?: string;
}

export interface MilestoneCreateInput {
  name: string;
  description?: string;
  targetDate?: Date;
}

/**
 * Validate that a project exists
 */
export async function validateProjectExists(
  projectId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      return {
        valid: false,
        error: `Project with ID "${projectId}" not found`,
      };
    }

    return {
      valid: true,
      name: project.name,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate project: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Create a project milestone
 */
export async function createProjectMilestone(
  projectId: string,
  input: MilestoneCreateInput
): Promise<{ id: string; name: string }> {
  try {
    const client = getLinearClient();

    // Format target date if provided
    const targetDate = input.targetDate ? input.targetDate.toISOString() : undefined;

    const payload = await client.createProjectMilestone({
      projectId,
      name: input.name,
      description: input.description,
      targetDate,
    });

    const milestone = await payload.projectMilestone;
    if (!milestone) {
      throw new Error('Failed to create milestone: No milestone returned from API');
    }

    return {
      id: milestone.id,
      name: milestone.name,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create milestone: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all milestones for a project
 */
export async function getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const milestones = await project.projectMilestones();
    const result: ProjectMilestone[] = [];

    for (const milestone of milestones.nodes) {
      result.push({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description || undefined,
        targetDate: milestone.targetDate || undefined,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project milestones: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
