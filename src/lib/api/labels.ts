import { RuntimeError, UsageError } from '../cli-error.js';
import type { ConnectionPage, PageInput, PageResult } from '../pagination.js';
import { walkPages } from '../pagination.js';
import type { IssueLabel, ProjectLabel } from '../types.js';
import { getLinearClient, LinearClientError } from './client.js';

export interface IssueLabelCreateInput {
  name: string;
  color: string;
  description?: string;
  teamId?: string;
}

export interface IssueLabelUpdateInput {
  name?: string;
  color?: string;
  description?: string;
}

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

export interface IssueLabelListFilters {
  teamId?: string;
  workspaceOnly?: boolean;
  color?: string;
  includeRetired?: boolean;
}

export interface ProjectLabelListFilters {
  color?: string;
  includeRetired?: boolean;
}

interface RawLabel {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  retiredAt?: string | null;
  archivedAt?: string | null;
  team?: { id: string } | null;
}

interface RawLabelConnection {
  edges: Array<{ cursor: string; node: RawLabel }>;
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

interface RawIssueLabelsResponse {
  data?: { issueLabels?: RawLabelConnection };
}

interface RawProjectLabelsResponse {
  data?: { projectLabels?: RawLabelConnection };
}

interface RawIssueLabelResponse {
  data?: { issueLabel?: RawLabel | null };
}

interface RawProjectLabelResponse {
  data?: { projectLabel?: RawLabel | null };
}

const LABEL_FIELDS = `
  id
  name
  color
  description
  retiredAt
  archivedAt
`;

const ISSUE_LABELS_QUERY = `
  query GetIssueLabels(
    $filter: IssueLabelFilter
    $first: Int!
    $after: String
    $includeArchived: Boolean!
  ) {
    issueLabels(
      filter: $filter
      first: $first
      after: $after
      includeArchived: $includeArchived
      orderBy: createdAt
    ) {
      edges {
        cursor
        node {
          ${LABEL_FIELDS}
          team { id }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PROJECT_LABELS_QUERY = `
  query GetProjectLabels(
    $first: Int!
    $after: String
    $includeArchived: Boolean!
  ) {
    projectLabels(
      first: $first
      after: $after
      includeArchived: $includeArchived
      orderBy: createdAt
    ) {
      edges {
        cursor
        node {
          ${LABEL_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const ISSUE_LABEL_QUERY = `
  query GetIssueLabel($id: String!) {
    issueLabel(id: $id) {
      ${LABEL_FIELDS}
      team { id }
    }
  }
`;

const PROJECT_LABEL_QUERY = `
  query GetProjectLabel($id: String!) {
    projectLabel(id: $id) {
      ${LABEL_FIELDS}
    }
  }
`;

function mapIssueLabel(label: RawLabel): IssueLabel {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description || undefined,
    teamId: label.team?.id,
    retiredAt: label.retiredAt ?? null,
    archivedAt: label.archivedAt ?? null,
  };
}

function mapProjectLabel(label: RawLabel): ProjectLabel {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description || undefined,
    retiredAt: label.retiredAt ?? null,
    archivedAt: label.archivedAt ?? null,
  };
}

function issueFilter(filters: IssueLabelListFilters): Record<string, unknown> | null {
  if (filters.workspaceOnly && filters.teamId) {
    throw new UsageError('--workspace cannot be combined with --team');
  }
  if (filters.workspaceOnly) return { team: { null: true } };
  if (filters.teamId) return { team: { id: { eq: filters.teamId } } };
  return null;
}

function matchesLabel(
  label: IssueLabel | ProjectLabel,
  filters: { color?: string; includeRetired?: boolean }
): boolean {
  if (!filters.includeRetired && label.retiredAt !== null) return false;
  if (filters.color && label.color.toUpperCase() !== filters.color.toUpperCase()) return false;
  return true;
}

function mapConnection<T>(
  connection: RawLabelConnection | undefined,
  mapper: (label: RawLabel) => T
): ConnectionPage<T> {
  if (!connection) {
    return undefined as unknown as ConnectionPage<T>;
  }
  return {
    edges: connection.edges.map(edge => ({ cursor: edge.cursor, node: mapper(edge.node) })),
    pageInfo: connection.pageInfo,
  };
}

export async function getIssueLabelListPage(
  filters: IssueLabelListFilters = {},
  page: PageInput = {}
): Promise<PageResult<IssueLabel>> {
  const client = getLinearClient();
  return walkPages({
    ...page,
    fetchPage: async ({ first, after }) => {
      const response = (await client.client.rawRequest(ISSUE_LABELS_QUERY, {
        filter: issueFilter(filters),
        first,
        after,
        includeArchived: false,
      })) as RawIssueLabelsResponse;
      return mapConnection(response.data?.issueLabels, mapIssueLabel);
    },
    matches: label => matchesLabel(label, filters),
  });
}

export async function getProjectLabelListPage(
  filters: ProjectLabelListFilters = {},
  page: PageInput = {}
): Promise<PageResult<ProjectLabel>> {
  const client = getLinearClient();
  return walkPages({
    ...page,
    fetchPage: async ({ first, after }) => {
      const response = (await client.client.rawRequest(PROJECT_LABELS_QUERY, {
        first,
        after,
        includeArchived: false,
      })) as RawProjectLabelsResponse;
      return mapConnection(response.data?.projectLabels, mapProjectLabel);
    },
    matches: label => matchesLabel(label, filters),
  });
}

export async function getAllIssueLabels(teamId?: string): Promise<IssueLabel[]> {
  try {
    const result = await getIssueLabelListPage(
      { teamId, includeRetired: true },
      { fetchAll: true }
    );
    return result.items;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to fetch issue labels: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function getIssueLabelById(id: string): Promise<IssueLabel | null> {
  try {
    const client = getLinearClient();
    const response = (await client.client.rawRequest(ISSUE_LABEL_QUERY, {
      id,
    })) as RawIssueLabelResponse;
    return response.data?.issueLabel ? mapIssueLabel(response.data.issueLabel) : null;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to fetch issue label: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

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
    if (!label) throw new Error('No label returned from API');
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      teamId: input.teamId,
      retiredAt: null,
      archivedAt: null,
    };
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to create issue label: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function updateIssueLabel(
  id: string,
  input: IssueLabelUpdateInput
): Promise<IssueLabel> {
  try {
    const client = getLinearClient();
    const payload = await client.updateIssueLabel(id, input);
    const label = await payload.issueLabel;
    if (!label) throw new Error('No label returned from API');
    return requireIssueLabel(id);
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to update issue label: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function deleteIssueLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteIssueLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to delete issue label: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function getAllProjectLabels(_includeAll?: boolean): Promise<ProjectLabel[]> {
  try {
    const result = await getProjectLabelListPage({ includeRetired: true }, { fetchAll: true });
    return result.items;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to fetch project labels: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function getProjectLabelById(id: string): Promise<ProjectLabel | null> {
  try {
    const client = getLinearClient();
    const response = (await client.client.rawRequest(PROJECT_LABEL_QUERY, {
      id,
    })) as RawProjectLabelResponse;
    return response.data?.projectLabel ? mapProjectLabel(response.data.projectLabel) : null;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to fetch project label: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function createProjectLabel(input: ProjectLabelCreateInput): Promise<ProjectLabel> {
  try {
    const client = getLinearClient();
    const payload = await client.createProjectLabel(input);
    const label = await payload.projectLabel;
    if (!label) throw new Error('No label returned from API');
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
      retiredAt: null,
      archivedAt: null,
    };
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to create project label: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function updateProjectLabel(
  id: string,
  input: ProjectLabelUpdateInput
): Promise<ProjectLabel> {
  try {
    const client = getLinearClient();
    const payload = await client.updateProjectLabel(id, input);
    const label = await payload.projectLabel;
    if (!label) throw new Error('No label returned from API');
    return requireProjectLabel(id);
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to update project label: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

export async function deleteProjectLabel(id: string): Promise<boolean> {
  try {
    const client = getLinearClient();
    const payload = await client.deleteProjectLabel(id);
    return payload.success;
  } catch (error) {
    if (error instanceof LinearClientError) throw error;
    throw new Error(
      'Failed to delete project label: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

async function requireIssueLabel(id: string): Promise<IssueLabel> {
  const label = await getIssueLabelById(id);
  if (!label) throw new RuntimeError('Linear did not return issue label ' + id);
  return label;
}

async function requireProjectLabel(id: string): Promise<ProjectLabel> {
  const label = await getProjectLabelById(id);
  if (!label) throw new RuntimeError('Linear did not return project label ' + id);
  return label;
}

const LABEL_LIFECYCLE_READ_ATTEMPTS = 3;
const LABEL_LIFECYCLE_READ_DELAY_MS = 100;

async function waitForLabelLifecycleState<T extends { retiredAt: string | null }>(
  read: () => Promise<T>,
  expectedRetired: boolean,
  resource: string,
  id: string
): Promise<T> {
  for (let attempt = 1; attempt <= LABEL_LIFECYCLE_READ_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, LABEL_LIFECYCLE_READ_DELAY_MS));
    }

    const label = await read();
    if ((label.retiredAt !== null) === expectedRetired) return label;
  }

  const expectedState = expectedRetired ? 'retired' : 'restored';
  throw new RuntimeError(
    'Linear did not return the ' +
      expectedState +
      ' state for ' +
      resource +
      ' ' +
      id +
      ' after ' +
      LABEL_LIFECYCLE_READ_ATTEMPTS +
      ' reads'
  );
}

export async function retireIssueLabel(id: string): Promise<IssueLabel> {
  const client = getLinearClient();
  const payload = await client.issueLabelRetire(id);
  if ((payload as { success?: boolean }).success === false) {
    throw new RuntimeError('Linear rejected issue-label retirement');
  }
  return waitForLabelLifecycleState(() => requireIssueLabel(id), true, 'issue label', id);
}

export async function restoreIssueLabel(id: string): Promise<IssueLabel> {
  const client = getLinearClient();
  const payload = await client.issueLabelRestore(id);
  if ((payload as { success?: boolean }).success === false) {
    throw new RuntimeError('Linear rejected issue-label restoration');
  }
  return waitForLabelLifecycleState(() => requireIssueLabel(id), false, 'issue label', id);
}

export async function retireProjectLabel(id: string): Promise<ProjectLabel> {
  const client = getLinearClient();
  const payload = await client.projectLabelRetire(id);
  if ((payload as { success?: boolean }).success === false) {
    throw new RuntimeError('Linear rejected project-label retirement');
  }
  return waitForLabelLifecycleState(() => requireProjectLabel(id), true, 'project label', id);
}

export async function restoreProjectLabel(id: string): Promise<ProjectLabel> {
  const client = getLinearClient();
  const payload = await client.projectLabelRestore(id);
  if ((payload as { success?: boolean }).success === false) {
    throw new RuntimeError('Linear rejected project-label restoration');
  }
  return waitForLabelLifecycleState(() => requireProjectLabel(id), false, 'project label', id);
}
