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
 * Get current user information
 */
export async function getCurrentUser(): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
    };
  } catch (error) {
    throw new LinearClientError(
      `Failed to get current user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
  icon?: string;
}

/**
 * Member/User data structure
 */
export interface Member {
  id: string;
  name: string;
  email: string;
  active: boolean;
  admin: boolean;
  avatarUrl?: string;
  displayName?: string;
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
 * Get all members from Linear organization
 * @param options - Optional filtering options
 */
export async function getAllMembers(options?: {
  teamId?: string;
  activeOnly?: boolean;
  inactiveOnly?: boolean;
  adminOnly?: boolean;
  nameFilter?: string;
  emailFilter?: string;
}): Promise<Member[]> {
  try {
    const client = getLinearClient();

    // If team filter is specified, get team members
    if (options?.teamId) {
      const team = await client.team(options.teamId);
      if (!team) {
        throw new Error(`Team with ID "${options.teamId}" not found`);
      }
      const teamMembers = await team.members();

      const result: Member[] = [];
      for await (const member of teamMembers.nodes) {
        result.push({
          id: member.id,
          name: member.name,
          email: member.email,
          active: member.active,
          admin: member.admin,
          avatarUrl: member.avatarUrl || undefined,
          displayName: member.displayName || undefined,
        });
      }

      // Apply additional filters
      return applyMemberFilters(result, options);
    }

    // Otherwise get all organization users
    const users = await client.users();

    const result: Member[] = [];
    for await (const user of users.nodes) {
      result.push({
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        admin: user.admin,
        avatarUrl: user.avatarUrl || undefined,
        displayName: user.displayName || undefined,
      });
    }

    // Apply filters and sort
    const filtered = applyMemberFilters(result, options);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch members: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Apply filters to member list
 */
function applyMemberFilters(
  members: Member[],
  options?: {
    activeOnly?: boolean;
    inactiveOnly?: boolean;
    adminOnly?: boolean;
    nameFilter?: string;
    emailFilter?: string;
  }
): Member[] {
  let filtered = members;

  // Filter by active status
  if (options?.activeOnly) {
    filtered = filtered.filter(m => m.active);
  } else if (options?.inactiveOnly) {
    filtered = filtered.filter(m => !m.active);
  }

  // Filter by admin status
  if (options?.adminOnly) {
    filtered = filtered.filter(m => m.admin);
  }

  // Filter by name (case-insensitive partial match)
  if (options?.nameFilter) {
    const nameLower = options.nameFilter.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(nameLower) ||
      (m.displayName && m.displayName.toLowerCase().includes(nameLower))
    );
  }

  // Filter by email (case-insensitive partial match)
  if (options?.emailFilter) {
    const emailLower = options.emailFilter.toLowerCase();
    filtered = filtered.filter(m => m.email.toLowerCase().includes(emailLower));
  }

  return filtered;
}

/**
 * Get a single member by ID
 */
export async function getMemberById(
  userId: string
): Promise<{ id: string; name: string; email: string; active: boolean; admin: boolean } | null> {
  try {
    const client = getLinearClient();
    const user = await client.user(userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      admin: user.admin,
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch member: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get member by exact email match (case-insensitive)
 */
export async function getMemberByEmail(email: string): Promise<Member | null> {
  try {
    const members = await getAllMembers({ emailFilter: email });
    // Find exact match (case-insensitive)
    const exactMatch = members.find(m => m.email.toLowerCase() === email.toLowerCase());
    return exactMatch || null;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to search member by email: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search members by email or name filter
 * Returns array of matching members (active members only by default)
 */
export async function searchMembers(options: {
  emailFilter?: string;
  nameFilter?: string;
  activeOnly?: boolean;
}): Promise<Member[]> {
  try {
    return await getAllMembers({
      emailFilter: options.emailFilter,
      nameFilter: options.nameFilter,
      activeOnly: options.activeOnly !== false, // Default to true
    });
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to search members: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Resolve a member identifier (ID, alias, or email) to a member
 * Tries multiple lookup strategies in order:
 * 1. Alias resolution (if configured)
 * 2. Direct ID lookup (if looks like a UUID)
 * 3. Email lookup (if contains @)
 *
 * @param identifier - The member identifier (ID, alias, or email)
 * @param resolveAliasFn - Optional alias resolver function
 * @returns Member details or null if not found
 */
export async function resolveMemberIdentifier(
  identifier: string,
  resolveAliasFn?: (type: 'member', value: string) => string
): Promise<{ id: string; name: string; email: string } | null> {
  try {
    const trimmedId = identifier.trim();

    // Try alias resolution first (if resolver provided)
    let resolvedId = trimmedId;
    if (resolveAliasFn) {
      const aliasResolved = resolveAliasFn('member', trimmedId);
      if (aliasResolved !== trimmedId) {
        resolvedId = aliasResolved;
        // Alias was found, now validate the resolved ID
        const member = await getMemberById(resolvedId);
        if (member) {
          return member;
        }
      }
    }

    // Try direct ID lookup if it looks like a UUID
    // Linear UUIDs are lowercase hex with dashes (e.g., "a1b2c3d4-...")
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(resolvedId)) {
      const member = await getMemberById(resolvedId);
      if (member) {
        return member;
      }
    }

    // Try email lookup if it contains @
    if (trimmedId.includes('@')) {
      const member = await getMemberByEmail(trimmedId);
      if (member) {
        return {
          id: member.id,
          name: member.name,
          email: member.email,
        };
      }
    }

    // Not found by any method
    return null;
  } catch (error) {
    // If there's an error during lookup, return null
    // The caller will handle the error messaging
    return null;
  }
}

/**
 * Get all projects from Linear
 * @param teamId - Optional team ID to filter projects by team
 */
export async function getAllProjects(teamId?: string): Promise<Project[]> {
  try {
    const client = getLinearClient();

    // Fetch all projects (team filtering happens client-side)
    const projects = await client.projects();

    const result: Project[] = [];
    for await (const project of projects.nodes) {
      // If teamId specified, check if project belongs to team
      if (teamId) {
        const teams = await project.teams();
        const teamIds = teams.nodes.map(t => t.id);
        if (!teamIds.includes(teamId)) {
          continue; // Skip projects not in this team
        }
      }

      result.push({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        icon: project.icon || undefined,
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
    const createInput = {
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
    } as const;

    // Debug: log what we're sending to the API
    if (process.env.DEBUG) {
      console.log('DEBUG: createInput =', JSON.stringify(createInput, null, 2));
    }

    // Create the project
    const projectPayload = await client.createProject(createInput as Parameters<typeof client.createProject>[0]);

    const project = await projectPayload.project;

    if (!project) {
      throw new Error('Failed to create project: No project returned from API');
    }

    // Debug: Check if template was applied
    if (process.env.DEBUG && input.templateId) {
      try {
        const lastAppliedTemplate = await (project as { lastAppliedTemplate?: { id: string; name: string } }).lastAppliedTemplate;
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
  content?: string;
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
    const updateInput: Partial<{
      statusId: string;
      name: string;
      description: string;
      content: string;
      priority: number;
      startDate: string;
      targetDate: string;
    }> = {};

    if (updates.statusId !== undefined) {
      updateInput.statusId = updates.statusId;
    }
    if (updates.name !== undefined) {
      updateInput.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateInput.description = updates.description;
    }
    if (updates.content !== undefined) {
      updateInput.content = updates.content;
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
    const projectPayload = await client.updateProject(projectId, updateInput as Parameters<typeof client.updateProject>[1]);
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
      const template = await (project as { lastAppliedTemplate?: { id: string; name: string } }).lastAppliedTemplate;
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

    return statuses.map((status: { id: string; name: string; type: string; color: string; description?: string; position: number }) => ({
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

/**
 * Workflow State (Issue Status) API Methods
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
 */
export async function getAllWorkflowStates(teamId?: string): Promise<import('./types.js').WorkflowState[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').WorkflowState[] = [];

    if (teamId) {
      // Get workflow states for a specific team
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
      // Get workflow states for all teams
      const teams = await client.teams();
      for (const team of teams.nodes) {
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
export async function getWorkflowStateById(id: string): Promise<import('./types.js').WorkflowState | null> {
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
export async function createWorkflowState(input: WorkflowStateCreateInput): Promise<import('./types.js').WorkflowState> {
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
export async function updateWorkflowState(id: string, input: WorkflowStateUpdateInput): Promise<import('./types.js').WorkflowState> {
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

/**
 * Issue Label API Methods
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
 * Get all issue labels (workspace-level and/or team-level)
 */
export async function getAllIssueLabels(teamId?: string): Promise<import('./types.js').IssueLabel[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').IssueLabel[] = [];

    if (teamId) {
      // Get labels for a specific team
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
      // Get all labels (workspace + all teams)
      const labels = await client.issueLabels();
      for (const label of labels.nodes) {
        const team = await label.team;
        result.push({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description || undefined,
          teamId: team?.id,
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
export async function getIssueLabelById(id: string): Promise<import('./types.js').IssueLabel | null> {
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
export async function createIssueLabel(input: IssueLabelCreateInput): Promise<import('./types.js').IssueLabel> {
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
export async function updateIssueLabel(id: string, input: IssueLabelUpdateInput): Promise<import('./types.js').IssueLabel> {
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
 * Project Label API Methods
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
 * Get all project labels (workspace-level only)
 * @param includeAll - If true, fetches ALL labels including ones never applied to projects
 */
export async function getAllProjectLabels(includeAll?: boolean): Promise<import('./types.js').ProjectLabel[]> {
  try {
    const client = getLinearClient();
    const result: import('./types.js').ProjectLabel[] = [];

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
export async function getProjectLabelById(id: string): Promise<import('./types.js').ProjectLabel | null> {
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
export async function createProjectLabel(input: ProjectLabelCreateInput): Promise<import('./types.js').ProjectLabel> {
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
export async function updateProjectLabel(id: string, input: ProjectLabelUpdateInput): Promise<import('./types.js').ProjectLabel> {
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

/**
 * External Link API Methods
 */

export interface ExternalLink {
  id: string;
  url: string;
  label: string;
  sortOrder: number;
  creatorId: string;
}

export interface ExternalLinkCreateInput {
  url: string;
  label: string;
  projectId?: string;
  initiativeId?: string;
  sortOrder?: number;
}

/**
 * Create an external link for a project or initiative
 */
export async function createExternalLink(input: ExternalLinkCreateInput): Promise<ExternalLink> {
  try {
    const client = getLinearClient();

    const payload = await client.createEntityExternalLink({
      url: input.url,
      label: input.label,
      projectId: input.projectId,
      initiativeId: input.initiativeId,
      sortOrder: input.sortOrder,
    });

    const link = await payload.entityExternalLink;
    if (!link) {
      throw new Error('Failed to create external link: No link returned from API');
    }

    const creator = await link.creator;

    return {
      id: link.id,
      url: link.url,
      label: link.label,
      sortOrder: link.sortOrder,
      creatorId: creator?.id ?? '',
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create external link: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all external links for a project
 */
export async function getProjectExternalLinks(projectId: string): Promise<ExternalLink[]> {
  try {
    const client = getLinearClient();
    const project = await client.project(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const links = await project.externalLinks();
    const result: ExternalLink[] = [];

    for (const link of links.nodes) {
      const creator = await link.creator;
      result.push({
        id: link.id,
        url: link.url,
        label: link.label,
        sortOrder: link.sortOrder,
        creatorId: creator?.id ?? '',
      });
    }

    // Sort by sort order
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch external links: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
