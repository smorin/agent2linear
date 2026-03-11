import type { LinearClient as SDKClient } from '@linear/sdk';
import { getLinearClient, LinearClientError } from './client.js';
import { getRelationDirection } from '../parsers.js';
import type {
  ProjectListFilters,
  ProjectListItem,
  ProjectRelation,
  ProjectRelationCreateInput,
} from '../types.js';

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
  description?: string;
  content?: string;
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
 * Project data structure (for listing/selection)
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string;
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
  // M15 Phase 1: Visual & Ownership Fields
  color?: string;
  icon?: string;
  leadId?: string;
  // M15 Phase 2: Collaboration & Organization Fields
  memberIds?: string[];
  labelIds?: string[];
  // M15 Phase 3: Date Resolutions
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
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
 * External Link types
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
 * Get all projects with optional filtering
 *
 * Performance Optimization (M21 Extended):
 * - Conditional fetching: Only fetch labels/members if used for filtering
 * - Two-query approach: Minimal query + optional batch query for labels/members
 * - In-code join to combine results
 * - API call reduction:
 *   - No filters: 1 call (was 1+N)
 *   - With label/member filters: 2 calls (was 1+N)
 *   - Overall: 92-98% reduction in API calls
 *
 * @param filters - Optional filters for projects
 * @returns Array of project list items
 */
export async function getAllProjects(filters?: ProjectListFilters): Promise<ProjectListItem[]> {
  try {
    const client = getLinearClient();

    // Build GraphQL filter object
    const graphqlFilter: any = {};

    if (filters?.teamId) {
      graphqlFilter.accessibleTeams = { some: { id: { eq: filters.teamId } } };
    }

    if (filters?.initiativeId) {
      graphqlFilter.initiatives = { some: { id: { eq: filters.initiativeId } } };
    }

    if (filters?.statusId) {
      graphqlFilter.status = { id: { eq: filters.statusId } };
    }

    if (filters?.priority !== undefined) {
      graphqlFilter.priority = { eq: filters.priority };
    }

    if (filters?.leadId) {
      graphqlFilter.lead = { id: { eq: filters.leadId } };
    }

    if (filters?.memberIds && filters.memberIds.length > 0) {
      graphqlFilter.members = { some: { id: { in: filters.memberIds } } };
    }

    if (filters?.labelIds && filters.labelIds.length > 0) {
      graphqlFilter.labels = { some: { id: { in: filters.labelIds } } };
    }

    // Date range filters
    if (filters?.startDateAfter || filters?.startDateBefore) {
      graphqlFilter.startDate = {};
      if (filters.startDateAfter) {
        graphqlFilter.startDate.gte = filters.startDateAfter;
      }
      if (filters.startDateBefore) {
        graphqlFilter.startDate.lte = filters.startDateBefore;
      }
    }

    if (filters?.targetDateAfter || filters?.targetDateBefore) {
      graphqlFilter.targetDate = {};
      if (filters.targetDateAfter) {
        graphqlFilter.targetDate.gte = filters.targetDateAfter;
      }
      if (filters.targetDateBefore) {
        graphqlFilter.targetDate.lte = filters.targetDateBefore;
      }
    }

    // Text search (search in name, description, content)
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm.length > 0) {
        graphqlFilter.or = [
          { name: { containsIgnoreCase: searchTerm } },
          { slugId: { containsIgnoreCase: searchTerm } },
          { searchableContent: { contains: searchTerm } }
        ];
      }
    }

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Project filter:', JSON.stringify(graphqlFilter, null, 2));
    }

    // Determine what data needs to be fetched based on filters
    const needsLabels = !!filters?.labelIds && filters.labelIds.length > 0;
    const needsMembers = !!filters?.memberIds && filters.memberIds.length > 0;
    const needsDependencies = !!filters?.includeDependencies; // M23
    const needsAdditionalData = needsLabels || needsMembers;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Conditional fetch:', { needsLabels, needsMembers, needsAdditionalData });
    }

    // ========================================
    // PAGINATION SETUP (M21.1)
    // ========================================
    const pageSize = filters?.fetchAll ? 250 : Math.min(filters?.limit || 50, 250);
    const fetchAll = filters?.fetchAll || false;
    const targetLimit = filters?.limit || 50;

    if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
      console.error('[agent2linear] Pagination:', { pageSize, fetchAll, targetLimit });
    }

    // QUERY 1: Minimal - Always fetch core project data (projects, teams, leads)
    // M23: Conditionally include relations if dependencies are requested
    const relationsFragment = needsDependencies ? `
            relations {
              nodes {
                id
                type
                anchorType
                relatedAnchorType
                project { id }
                relatedProject { id }
              }
            }` : '';

    const minimalQuery = `
      query GetMinimalProjects($filter: ProjectFilter, $includeArchived: Boolean, $first: Int, $after: String) {
        projects(filter: $filter, includeArchived: $includeArchived, first: $first, after: $after) {
          nodes {
            id
            name
            description
            content
            icon
            color
            state
            priority
            startDate
            targetDate
            completedAt
            url
            createdAt
            updatedAt

            teams {
              nodes {
                id
                name
                key
              }
            }

            lead {
              id
              name
              email
            }
${relationsFragment}
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // ========================================
    // PAGINATION LOOP (M21.1)
    // ========================================
    let rawProjects: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage && (fetchAll || rawProjects.length < targetLimit)) {
      pageCount++;

      const variables = {
        filter: Object.keys(graphqlFilter).length > 0 ? graphqlFilter : null,
        includeArchived: false,
        first: pageSize,
        after: cursor
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const minimalResponse: any = await client.client.rawRequest(minimalQuery, variables);

      const nodes = minimalResponse.data?.projects?.nodes || [];
      const pageInfo = minimalResponse.data?.projects?.pageInfo;

      rawProjects.push(...nodes);

      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Page ${pageCount}: fetched ${nodes.length} projects (total: ${rawProjects.length}, hasNextPage: ${hasNextPage})`);
      }

      // If not fetching all, stop when we have enough
      if (!fetchAll && rawProjects.length >= targetLimit) {
        break;
      }
    }

    // ========================================
    // QUERY 2: CONDITIONAL - Batch fetch labels+members IF filters use them
    // ========================================
    const labelsMap: Map<string, any[]> = new Map();
    const membersMap: Map<string, any[]> = new Map();

    if (needsAdditionalData && rawProjects.length > 0) {
      const projectIds = rawProjects.map((p: any) => p.id);

      const batchQuery = `
        query GetProjectsLabelsAndMembers($ids: [String!]!) {
          ${projectIds.map((id: string, index: number) => `
            project${index}: project(id: "${id}") {
              id
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              members {
                nodes {
                  id
                  name
                  email
                }
              }
            }
          `).join('\n')}
        }
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const batchResponse: any = await client.client.rawRequest(batchQuery, {});

      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error('[agent2linear] Batch query fetched labels+members for', projectIds.length, 'projects');
      }

      // Parse batch response and build maps for in-code join
      projectIds.forEach((projectId: string, index: number) => {
        const projectData = batchResponse.data?.[`project${index}`];
        if (projectData) {
          labelsMap.set(projectId, projectData.labels?.nodes || []);
          membersMap.set(projectId, projectData.members?.nodes || []);
        }
      });
    }

    // ========================================
    // TRUNCATION (M21.1)
    // ========================================
    if (!fetchAll && rawProjects.length > targetLimit) {
      if (process.env.LINEAR_CREATE_DEBUG_FILTERS === '1') {
        console.error(`[agent2linear] Truncating from ${rawProjects.length} to ${targetLimit} projects`);
      }
      rawProjects = rawProjects.slice(0, targetLimit);
    }

    // ========================================
    // BUILD FINAL PROJECT LIST (IN-CODE JOIN)
    // ========================================
    const projectList: ProjectListItem[] = rawProjects.map((project: any) => {
      const labels = labelsMap.get(project.id) || [];
      const members = membersMap.get(project.id) || [];

      // M23: Calculate dependency counts if relations were fetched
      let dependsOnCount: number | undefined = undefined;
      let blocksCount: number | undefined = undefined;

      if (needsDependencies) {
        // Initialize to 0 when fetching dependencies
        dependsOnCount = 0;
        blocksCount = 0;

        // Count relations if present
        if (project.relations?.nodes) {
          const relations = project.relations.nodes;

          dependsOnCount = relations.filter((rel: any) => {
            try {
              return getRelationDirection(rel, project.id) === 'depends-on';
            } catch {
              return false;
            }
          }).length;

          blocksCount = relations.filter((rel: any) => {
            try {
              return getRelationDirection(rel, project.id) === 'blocks';
            } catch {
              return false;
            }
          }).length;
        }
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        content: project.content || undefined,
        icon: project.icon || undefined,
        color: project.color || undefined,
        state: project.state,
        priority: project.priority !== undefined ? project.priority : undefined,

        status: undefined, // Project status is not available in Linear SDK v27+

        lead: project.lead ? {
          id: project.lead.id,
          name: project.lead.name,
          email: project.lead.email
        } : undefined,

        team: project.teams?.nodes?.[0] ? {
          id: project.teams.nodes[0].id,
          name: project.teams.nodes[0].name,
          key: project.teams.nodes[0].key
        } : undefined,

        initiative: undefined, // Initiative relationship needs to be fetched differently

        labels: labels.map((label: any) => ({
          id: label.id,
          name: label.name,
          color: label.color || undefined
        })),

        members: members.map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.email
        })),

        startDate: project.startDate || undefined,
        targetDate: project.targetDate || undefined,
        completedAt: project.completedAt || undefined,

        url: project.url,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,

        // M23: Include dependency counts if fetched
        dependsOnCount,
        blocksCount
      };
    });

    return projectList;
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
      color: string;
      icon: string;
      leadId: string;
      memberIds: string[];
      labelIds: string[];
      startDateResolution: 'month' | 'quarter' | 'halfYear' | 'year';
      targetDateResolution: 'month' | 'quarter' | 'halfYear' | 'year';
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
    // M15 Phase 1: Visual & Ownership Fields
    if (updates.color !== undefined) {
      updateInput.color = updates.color;
    }
    if (updates.icon !== undefined) {
      updateInput.icon = updates.icon;
    }
    if (updates.leadId !== undefined) {
      updateInput.leadId = updates.leadId;
    }
    // M15 Phase 2: Collaboration & Organization Fields
    if (updates.memberIds !== undefined) {
      updateInput.memberIds = updates.memberIds;
    }
    if (updates.labelIds !== undefined) {
      updateInput.labelIds = updates.labelIds;
    }
    // M15 Phase 3: Date Resolutions
    if (updates.startDateResolution !== undefined) {
      updateInput.startDateResolution = updates.startDateResolution;
    }
    if (updates.targetDateResolution !== undefined) {
      updateInput.targetDateResolution = updates.targetDateResolution;
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
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (3 API calls -> 1 call)
 * Fetches project with initiatives and teams upfront instead of lazy loading via SDK
 */
export async function getProjectById(
  projectId: string
): Promise<ProjectResult | null> {
  try {
    const client = getLinearClient();

    // Custom GraphQL query - fetch project with initiatives and teams in one request
    const projectQuery = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          url
          state

          initiatives {
            nodes {
              id
              name
            }
          }

          teams {
            nodes {
              id
              name
            }
          }
        }
      }
    `;

    const response: any = await client.client.rawRequest(projectQuery, { projectId });
    const project = response.data?.project;

    if (!project) {
      return null;
    }

    // Get first initiative if exists
    const initiative = project.initiatives?.nodes?.[0]
      ? {
          id: project.initiatives.nodes[0].id,
          name: project.initiatives.nodes[0].name,
        }
      : undefined;

    // Get first team if exists
    const team = project.teams?.nodes?.[0]
      ? {
          id: project.teams.nodes[0].id,
          name: project.teams.nodes[0].name,
        }
      : undefined;

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
 * Get full project details with all relationships (OPTIMIZED)
 *
 * PERFORMANCE OPTIMIZATION (v0.24.0-alpha.2.1):
 * Uses custom GraphQL query to avoid N+1 pattern (~10 API calls -> 1 call)
 * Fetches all project data upfront instead of lazy loading via SDK
 *
 * @param projectId - Project UUID
 * @returns Complete project details or null if not found
 */
export async function getFullProjectDetails(projectId: string): Promise<{
  project: ProjectResult;
  lastAppliedTemplate?: { id: string; name: string };
  milestones: Array<{ id: string; name: string }>;
  issues: Array<{ id: string; identifier: string; title: string }>;
} | null> {
  try {
    const client = getLinearClient();

    // ========================================
    // CUSTOM GRAPHQL QUERY - ALL RELATIONS UPFRONT
    // ========================================
    const projectQuery = `
      query GetFullProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          description
          content
          url
          state

          initiatives {
            nodes {
              id
              name
            }
          }

          teams {
            nodes {
              id
              name
            }
          }

          lastAppliedTemplate {
            id
            name
          }

          projectMilestones {
            nodes {
              id
              name
            }
          }

          issues {
            nodes {
              id
              identifier
              title
            }
          }
        }
      }
    `;

    const response: any = await client.client.rawRequest(projectQuery, { projectId });
    const projectData = response.data?.project;

    if (!projectData) {
      return null;
    }

    // Map GraphQL response to ProjectResult and related data (no awaits needed!)
    const initiative = projectData.initiatives?.nodes?.[0]
      ? {
          id: projectData.initiatives.nodes[0].id,
          name: projectData.initiatives.nodes[0].name,
        }
      : undefined;

    const team = projectData.teams?.nodes?.[0]
      ? {
          id: projectData.teams.nodes[0].id,
          name: projectData.teams.nodes[0].name,
        }
      : undefined;

    const lastAppliedTemplate = projectData.lastAppliedTemplate
      ? {
          id: projectData.lastAppliedTemplate.id,
          name: projectData.lastAppliedTemplate.name,
        }
      : undefined;

    const milestones = (projectData.projectMilestones?.nodes || []).map((milestone: any) => ({
      id: milestone.id,
      name: milestone.name,
    }));

    const issues = (projectData.issues?.nodes || []).map((issue: any) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
    }));

    return {
      project: {
        id: projectData.id,
        name: projectData.name,
        description: projectData.description || undefined,
        content: projectData.content || undefined,
        url: projectData.url,
        state: projectData.state,
        initiative,
        team,
      },
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

/**
 * Delete an external link
 */
export async function deleteExternalLink(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const result = await client.deleteEntityExternalLink(id);
    return result.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete external link: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * M23: Project Dependency Management
 *
 * Create a project relation (dependency)
 * Note: Linear API uses type: "dependency" with anchor-based semantics
 * - anchorType: which part of source project ("start" or "end")
 * - relatedAnchorType: which part of target project ("start" or "end")
 */
export async function createProjectRelation(
  client: SDKClient,
  input: ProjectRelationCreateInput
): Promise<ProjectRelation> {
  try {
    // GraphQL mutation with inline fragment for ProjectRelation fields
    const mutation = `
      mutation CreateProjectRelation($input: ProjectRelationCreateInput!) {
        projectRelationCreate(input: $input) {
          success
          projectRelation {
            id
            type
            anchorType
            relatedAnchorType
            createdAt
            updatedAt
            project {
              id
              name
            }
            relatedProject {
              id
              name
            }
          }
        }
      }
    `;

    const result = await client.client.rawRequest(mutation, {
      input: {
        type: 'dependency', // Always "dependency" (only valid value)
        projectId: input.projectId,
        relatedProjectId: input.relatedProjectId,
        anchorType: input.anchorType,
        relatedAnchorType: input.relatedAnchorType,
      },
    });

    const data = result.data as {
      projectRelationCreate: {
        success: boolean;
        projectRelation: ProjectRelation;
      };
    };

    if (!data.projectRelationCreate.success) {
      throw new Error('Failed to create project relation');
    }

    return data.projectRelationCreate.projectRelation;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to create project relation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a project relation by ID
 */
export async function deleteProjectRelation(
  client: SDKClient,
  relationId: string
): Promise<boolean> {
  try {
    const mutation = `
      mutation DeleteProjectRelation($id: String!) {
        projectRelationDelete(id: $id) {
          success
        }
      }
    `;

    const result = await client.client.rawRequest(mutation, {
      id: relationId,
    });

    const data = result.data as {
      projectRelationDelete: {
        success: boolean;
      };
    };

    return data.projectRelationDelete.success;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to delete project relation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch all project relations for a given project
 * Returns both "depends on" and "blocks" relations
 */
export async function getProjectRelations(
  client: SDKClient,
  projectId: string
): Promise<ProjectRelation[]> {
  try {
    // Query to fetch project relations using the .relations() method
    const query = `
      query GetProjectRelations($projectId: String!) {
        project(id: $projectId) {
          id
          name
          relations {
            nodes {
              id
              type
              anchorType
              relatedAnchorType
              createdAt
              updatedAt
              project {
                id
                name
              }
              relatedProject {
                id
                name
              }
            }
          }
        }
      }
    `;

    const result = await client.client.rawRequest(query, {
      projectId,
    });

    const data = result.data as {
      project: {
        id: string;
        name: string;
        relations: {
          nodes: ProjectRelation[];
        };
      };
    };

    return data.project.relations.nodes;
  } catch (error) {
    if (error instanceof LinearClientError) {
      throw error;
    }

    throw new Error(
      `Failed to fetch project relations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
