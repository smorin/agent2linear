export interface Config {
  apiKey?: string;
  defaultInitiative?: string;
  defaultTeam?: string;
  defaultIssueTemplate?: string;
  defaultProjectTemplate?: string;
  defaultMilestoneTemplate?: string;
  projectCacheMinTTL?: number; // Cache TTL in minutes (default: 60)
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
    defaultIssueTemplate: ConfigLocation;
    defaultProjectTemplate: ConfigLocation;
    defaultMilestoneTemplate: ConfigLocation;
    projectCacheMinTTL: ConfigLocation;
  };
}

export type AliasEntityType = 'initiative' | 'team' | 'project' | 'project-status' | 'issue-template' | 'project-template';

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
