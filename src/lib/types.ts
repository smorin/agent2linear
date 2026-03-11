export interface Config {
  apiKey?: string;
  defaultInitiative?: string;
  defaultTeam?: string;
  defaultProject?: string; // M15.1: Default project for issue creation
  defaultIssueTemplate?: string;
  defaultProjectTemplate?: string;
  defaultMilestoneTemplate?: string;
  projectCacheMinTTL?: number; // Cache TTL in minutes (default: 60)
  defaultAutoAssignLead?: boolean; // Auto-assign project lead to creator (default: true)

  // Entity cache configuration (M14 caching system)
  entityCacheMinTTL?: number; // Entity cache TTL in minutes (default: 60)
  enableEntityCache?: boolean; // Enable/disable entity caching (default: true)
  enablePersistentCache?: boolean; // Enable/disable file-based cache (default: true)
  enableSessionCache?: boolean; // Enable/disable in-memory cache (default: true)
  enableBatchFetching?: boolean; // Enable/disable batch API calls (default: true)
  prewarmCacheOnCreate?: boolean; // Auto-prewarm cache on project create (default: true)
}

export interface ConfigLocation {
  type: 'global' | 'project' | 'env' | 'none';
  path?: string;
}

export interface ResolvedConfig extends Config {
  locations: {
    apiKey: ConfigLocation;
    defaultInitiative: ConfigLocation;
    defaultTeam: ConfigLocation;
    defaultProject: ConfigLocation;
    defaultIssueTemplate: ConfigLocation;
    defaultProjectTemplate: ConfigLocation;
    defaultMilestoneTemplate: ConfigLocation;
    projectCacheMinTTL: ConfigLocation;
    defaultAutoAssignLead: ConfigLocation;
    entityCacheMinTTL: ConfigLocation;
    enableEntityCache: ConfigLocation;
    enablePersistentCache: ConfigLocation;
    enableSessionCache: ConfigLocation;
    enableBatchFetching: ConfigLocation;
    prewarmCacheOnCreate: ConfigLocation;
  };
}

export type AliasEntityType = 'initiative' | 'team' | 'project' | 'project-status' | 'issue-template' | 'project-template' | 'member' | 'issue-label' | 'project-label' | 'workflow-state' | 'cycle';

export interface AliasMap {
  [alias: string]: string; // alias -> Linear ID
}

export interface Aliases {
  initiatives: AliasMap;
  teams: AliasMap;
  projects: AliasMap;
  projectStatuses: AliasMap;
  issueTemplates: AliasMap;
  projectTemplates: AliasMap;
  members: AliasMap;
  issueLabels: AliasMap;
  projectLabels: AliasMap;
  workflowStates: AliasMap;
  cycles: AliasMap; // M15.1: Cycle aliases for issue commands
}

export interface AliasLocation {
  type: 'global' | 'project';
  path: string;
}

export interface ResolvedAliases extends Aliases {
  locations: {
    [type in AliasEntityType]: {
      [alias: string]: AliasLocation;
    };
  };
}

/**
 * Template data structure
 */
export interface Template {
  id: string;
  name: string;
  type: 'issue' | 'project';
  description?: string;
}

/**
 * Milestone template data structures
 */
export interface MilestoneDefinition {
  name: string;
  description?: string;
  targetDate?: string; // Relative format: "+7d", "+2w", "+1m" or ISO date
}

export interface MilestoneTemplate {
  name: string;
  description?: string;
  milestones: MilestoneDefinition[];
}

export interface MilestoneTemplates {
  templates: {
    [templateName: string]: MilestoneTemplate;
  };
}

/**
 * Workflow State (Issue Status) data structure
 */
export interface WorkflowState {
  id: string;
  name: string;
  type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  description?: string;
  position: number;
  teamId: string;
}

/**
 * Issue Label data structure
 */
export interface IssueLabel {
  id: string;
  name: string;
  description?: string;
  color: string;
  teamId?: string; // undefined for workspace-level labels
}

/**
 * Project Label data structure
 */
export interface ProjectLabel {
  id: string;
  name: string;
  description?: string;
  color: string;
}

/**
 * Color definition
 */
export interface Color {
  hex: string;
  name?: string;
  usageCount?: number; // For extracted colors
}

/**
 * Icon definition
 */
export interface Icon {
  name: string;
  emoji?: string;
  unicode?: string;
  category?: string;
}

/**
 * Project list filters (M20)
 */
export interface ProjectListFilters {
  teamId?: string;
  initiativeId?: string;
  statusId?: string;
  priority?: number;
  leadId?: string;
  memberIds?: string[];
  labelIds?: string[];
  startDateAfter?: string;
  startDateBefore?: string;
  targetDateAfter?: string;
  targetDateBefore?: string;
  search?: string;

  // Pagination options (M21.1)
  limit?: number;      // Max results to return (default: 50, max: 250)
  fetchAll?: boolean;  // Fetch all pages (uses pageSize: 250 for optimization)

  // M23: Dependency options
  includeDependencies?: boolean;  // Fetch dependency relation counts
}

/**
 * Project list item with comprehensive fields (M20)
 */
export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  content?: string;
  icon?: string;
  color?: string;
  state: string;
  priority?: number;
  status?: {
    id: string;
    name: string;
    type: string;
  };
  lead?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
    key: string;
  };
  initiative?: {
    id: string;
    name: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  dependsOnCount?: number;    // Count of "depends on" relations (M23)
  blocksCount?: number;       // Count of "blocks" relations (M23)
}

/**
 * Project Relation data structure (M23: Project Dependencies)
 * Represents a dependency relationship between two projects
 */
export interface ProjectRelation {
  id: string;
  type: 'dependency';  // Only valid value in Linear API
  project: {
    id: string;
    name: string;
  };
  relatedProject: {
    id: string;
    name: string;
  };
  anchorType: 'start' | 'end';        // Which part of source project
  relatedAnchorType: 'start' | 'end'; // Which part of target project
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a project relation (M23)
 */
export interface ProjectRelationCreateInput {
  id?: string;
  type: 'dependency';  // Always this value
  projectId: string;
  relatedProjectId: string;
  anchorType: 'start' | 'end';
  relatedAnchorType: 'start' | 'end';
}

/**
 * Parsed dependency with direction (M23)
 * Used for advanced dependency syntax parsing
 */
export interface DependencyDirection {
  relatedProjectId: string;
  anchorType: 'start' | 'end';
  relatedAnchorType: 'start' | 'end';
}

/**
 * Issue creation input (M15.1)
 * All fields for creating a new Linear issue
 */
export interface IssueCreateInput {
  // Required fields
  title: string;
  teamId: string;

  // Content fields
  description?: string;
  descriptionData?: any; // Linear's Prosemirror JSON format

  // Priority & estimation
  priority?: number; // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  estimate?: number; // Story points or time estimate

  // Workflow fields
  stateId?: string; // Workflow state (status)

  // Assignment fields
  assigneeId?: string; // Assigned user
  subscriberIds?: string[]; // Users subscribed to updates

  // Organization fields
  projectId?: string;
  cycleId?: string;
  parentId?: string; // Parent issue for sub-issues
  labelIds?: string[]; // Issue labels

  // Date fields
  dueDate?: string; // ISO date format (YYYY-MM-DD)

  // Template
  templateId?: string; // Issue template to apply
}

/**
 * Issue update input (M15.1)
 * All fields for updating an existing Linear issue
 */
export interface IssueUpdateInput {
  // Basic fields
  title?: string;
  description?: string;
  descriptionData?: any;

  // Priority & estimation
  priority?: number;
  estimate?: number | null; // Allow null to clear estimate

  // Workflow fields
  stateId?: string;

  // Assignment fields
  assigneeId?: string | null; // Allow null to unassign
  subscriberIds?: string[]; // Replace all subscribers

  // Organization fields
  teamId?: string; // Move to different team
  projectId?: string | null; // Allow null to remove from project
  cycleId?: string | null; // Allow null to remove from cycle
  parentId?: string | null; // Allow null to remove parent (make root issue)
  labelIds?: string[]; // Replace all labels

  // Date fields
  dueDate?: string | null; // Allow null to clear due date

  // Lifecycle operations
  trashed?: boolean; // Move to/from trash

  // Add/remove patterns (handled separately in command logic)
  // These are not direct API fields but used in CLI
  addLabelIds?: string[];
  removeLabelIds?: string[];
  addSubscriberIds?: string[];
  removeSubscriberIds?: string[];
}

/**
 * Issue list filters (M15.1)
 * Filter options for querying issues
 */
export interface IssueListFilters {
  // Primary filters
  teamId?: string;
  assigneeId?: string;
  projectId?: string;
  initiativeId?: string; // Filter by initiative's projects

  // Workflow filters
  stateId?: string;
  priority?: number;
  labelIds?: string[]; // Issues with these labels

  // Relationship filters
  parentId?: string; // Sub-issues of this parent
  cycleId?: string;
  hasParent?: boolean; // true=only sub-issues, false=only root issues

  // Status filters
  includeCompleted?: boolean;
  includeCanceled?: boolean;
  includeArchived?: boolean;

  // Search
  search?: string; // Full-text search in title and description

  // Date range filters
  createdAfter?: string;  // ISO date string
  createdBefore?: string; // ISO date string
  updatedAfter?: string;  // ISO date string
  updatedBefore?: string; // ISO date string

  // Pagination
  limit?: number; // Max results (default: 50, max: 250)
  fetchAll?: boolean; // Fetch all pages with cursor pagination

  // Sorting
  sortField?: 'priority' | 'created' | 'updated' | 'due';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Issue list item (M15.5)
 * Formatted data for displaying issues in list view
 * Includes all relations fetched in single query to avoid N+1 patterns
 */
export interface IssueListItem {
  // Core identification
  id: string;
  identifier: string; // ENG-123 format
  title: string;
  url: string;

  // Content
  description?: string;

  // Workflow
  priority?: number; // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  estimate?: number;

  // Assignment
  assignee?: {
    id: string;
    name: string;
    email: string;
  };

  // Organization
  team?: {
    id: string;
    key: string;
    name: string;
  };

  state?: {
    id: string;
    name: string;
    type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  };

  project?: {
    id: string;
    name: string;
  };

  cycle?: {
    id: string;
    name: string;
    number: number;
  };

  labels: Array<{
    id: string;
    name: string;
    color?: string;
  }>;

  parent?: {
    id: string;
    identifier: string; // ENG-123 format
    title: string;
  };

  // Dates
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
  archivedAt?: string;
}

/**
 * Issue view data (M15.1)
 * Formatted data for displaying issue details
 */
export interface IssueViewData {
  // Core identification
  id: string;
  identifier: string; // ENG-123 format
  title: string;
  url: string;

  // Content
  description?: string;
  descriptionText?: string; // Plain text version

  // Workflow
  state: {
    id: string;
    name: string;
    type: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
    color: string;
  };
  priority?: number;
  estimate?: number;

  // Assignment
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  subscribers: Array<{
    id: string;
    name: string;
    email: string;
  }>;

  // Organization
  team: {
    id: string;
    key: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
  };
  parent?: {
    id: string;
    identifier: string;
    title: string;
  };
  children: Array<{
    id: string;
    identifier: string;
    title: string;
    state: string;
  }>;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;

  // Dates
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
  dueDate?: string;
  archivedAt?: string;

  // Creator
  creator: {
    id: string;
    name: string;
    email: string;
  };
}
