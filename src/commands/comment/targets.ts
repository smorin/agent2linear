import { ConflictError, NotFoundError, UsageError } from '../../lib/cli-error.js';
import {
  type IssueResolveResult,
  resolveIssueIdentifier,
  validateIssueIdentifierFormat,
} from '../../lib/issue-resolver.js';
import { getLinearClient } from '../../lib/linear-client.js';
import {
  resolveProject,
  type ResolveResult as ProjectResolveResult,
} from '../../lib/project-resolver.js';

export type CommentTargetKind = 'issue' | 'project';

export interface IssueCommentTarget {
  type: 'issue';
  id: string;
  identifier: string;
  title: string | null;
  resolvedBy: IssueResolveResult['resolvedBy'];
  originalInput: string;
}

export interface ProjectCommentTarget {
  type: 'project';
  id: string;
  name: string;
  resolvedBy: ProjectResolveResult['resolvedBy'];
  originalInput: string;
  usedAlias?: string;
}

export type ResolvedCommentTarget = IssueCommentTarget | ProjectCommentTarget;

export interface CommentTargetDependencies {
  resolveIssue(input: string): Promise<IssueResolveResult | null>;
  resolveProject(input: string): Promise<ProjectResolveResult | null>;
  /** Probe a swallowed resolver failure so auth/network errors are not mislabeled not-found. */
  assertAuthenticated?(): Promise<void>;
  /** Detect duplicate exact names after normal ID/alias/cache/name precedence. */
  findProjectMatches?(name: string): Promise<Array<{ id: string; name: string }>>;
}

const defaultDependencies: CommentTargetDependencies = {
  resolveIssue: resolveIssueIdentifier,
  resolveProject,
  assertAuthenticated: async () => {
    await getLinearClient().viewer;
  },
  findProjectMatches: async name => {
    const result = await getLinearClient().projects({
      first: 3,
      filter: { name: { eq: name } },
    });
    return result.nodes.map(project => ({ id: project.id, name: project.name }));
  },
};

function issueMetadata(value: unknown): { identifier?: string; title?: string } {
  if (!value || typeof value !== 'object') return {};
  const item = value as Record<string, unknown>;
  return {
    ...(typeof item.identifier === 'string' && item.identifier.length > 0
      ? { identifier: item.identifier }
      : {}),
    ...(typeof item.title === 'string' ? { title: item.title } : {}),
  };
}

export async function resolveCommentTarget(
  kind: CommentTargetKind,
  input: string,
  dependencies: CommentTargetDependencies = defaultDependencies
): Promise<ResolvedCommentTarget> {
  if (kind === 'issue') {
    const validation = validateIssueIdentifierFormat(input);
    if (!validation.valid) {
      throw new UsageError(validation.error ?? 'invalid issue identifier');
    }

    const result = await dependencies.resolveIssue(input);
    if (!result) {
      await dependencies.assertAuthenticated?.();
      throw new NotFoundError(
        `issue '${input}' was not found — check the identifier or UUID with a2l issue view`
      );
    }
    const metadata = issueMetadata(result.issue);
    return {
      type: 'issue',
      id: result.issueId,
      identifier:
        metadata.identifier ??
        (validation.format === 'identifier' ? input.trim().toUpperCase() : result.issueId),
      title: metadata.title ?? null,
      resolvedBy: result.resolvedBy,
      originalInput: result.originalInput,
    };
  }

  const result = await dependencies.resolveProject(input);
  if (!result) {
    await dependencies.assertAuthenticated?.();
    throw new NotFoundError(
      `project '${input}' was not found — check the ID, name, or alias with a2l project list`
    );
  }

  if (
    (result.resolvedBy === 'name' || result.resolvedBy === 'cache') &&
    dependencies.findProjectMatches
  ) {
    const matches = await dependencies.findProjectMatches(result.originalInput);
    if (matches.length > 1) {
      const choices = matches.map(match => `${match.name} (${match.id})`).join(', ');
      throw new ConflictError(
        `project name '${result.originalInput}' is ambiguous — use an ID or alias: ${choices}`
      );
    }
  }

  return {
    type: 'project',
    id: result.projectId,
    name: result.project?.name ?? result.originalInput,
    resolvedBy: result.resolvedBy,
    originalInput: result.originalInput,
    ...(result.usedAlias ? { usedAlias: result.usedAlias } : {}),
  };
}
