import { ConflictError, NotFoundError, RuntimeError } from '../cli-error.js';
import type { ConnectionPage, PageInput, PageResult } from '../pagination.js';
import { walkPages } from '../pagination.js';
import { getLinearClient } from './client.js';

export type CommentTargetRef =
  | { type: 'issue'; id: string }
  | { type: 'project'; id: string };

export interface CommentUser {
  id: string;
  name: string;
  email: string | null;
}

export interface CommentBotActor {
  id: string | null;
  name: string | null;
  type: string;
  subType: string | null;
  userDisplayName: string | null;
  avatarUrl: string | null;
}

export interface CommentExternalUser {
  id: string;
  name: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface LinearComment {
  id: string;
  url: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  resolvedAt: string | null;
  parentId: string | null;
  quotedText: string | null;
  user: CommentUser | null;
  botActor: CommentBotActor | null;
  externalUser: CommentExternalUser | null;
}

export interface CommentCreateOptions {
  body: string;
  parentId?: string;
  /**
   * Internal command-runner proof that the parent was checked immediately
   * before the mutation guard. Never serialized into GraphQL input.
   */
  replyTargetValidated?: boolean;
}

export type CommentPageResult = PageResult<LinearComment>;

type RawRequest = (
  query: string,
  variables: Record<string, unknown>
) => Promise<unknown>;

export interface CommentApiDependencies {
  rawRequest: RawRequest;
}

const COMMENT_FIELDS = `
  id
  url
  body
  createdAt
  updatedAt
  editedAt
  resolvedAt
  parentId
  quotedText
  user { id name email }
  botActor { id name type subType userDisplayName avatarUrl }
  externalUser { id name displayName email avatarUrl }
`;

const ISSUE_COMMENTS_QUERY = `
  query IssueComments($targetId: String!, $first: Int!, $after: String) {
    issue(id: $targetId) {
      id
      comments(first: $first, after: $after, orderBy: createdAt) {
        edges {
          cursor
          node { ${COMMENT_FIELDS} }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const PROJECT_COMMENTS_QUERY = `
  query ProjectComments($targetId: ID!, $first: Int!, $after: String) {
    comments(
      first: $first
      after: $after
      filter: {
        and: [
          { project: { id: { eq: $targetId } } }
          { projectUpdate: { null: true } }
        ]
      }
      orderBy: createdAt
    ) {
      edges {
        cursor
        node { ${COMMENT_FIELDS} }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { ${COMMENT_FIELDS} }
    }
  }
`;

const REPLY_TARGET_QUERY = `
  query CommentReplyTarget($commentId: String!) {
    comment(id: $commentId) {
      id
      issueId
      projectId
      projectUpdateId
    }
  }
`;

function defaultDependencies(): CommentApiDependencies {
  return {
    rawRequest: (query, variables) => getLinearClient().client.rawRequest(query, variables),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RuntimeError(`Linear returned a comment without ${field}`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapUser(value: unknown): CommentUser | null {
  const item = record(value);
  if (!item) return null;
  return {
    id: requiredString(item.id, 'user.id'),
    name: requiredString(item.name, 'user.name'),
    email: nullableString(item.email),
  };
}

function mapBot(value: unknown): CommentBotActor | null {
  const item = record(value);
  if (!item) return null;
  return {
    id: nullableString(item.id),
    name: nullableString(item.name),
    type: requiredString(item.type, 'botActor.type'),
    subType: nullableString(item.subType),
    userDisplayName: nullableString(item.userDisplayName),
    avatarUrl: nullableString(item.avatarUrl),
  };
}

function mapExternalUser(value: unknown): CommentExternalUser | null {
  const item = record(value);
  if (!item) return null;
  return {
    id: requiredString(item.id, 'externalUser.id'),
    name: requiredString(item.name, 'externalUser.name'),
    displayName: requiredString(item.displayName, 'externalUser.displayName'),
    email: nullableString(item.email),
    avatarUrl: nullableString(item.avatarUrl),
  };
}

function mapComment(value: unknown): LinearComment {
  const item = record(value);
  if (!item) throw new RuntimeError('Linear returned a malformed comment');
  return {
    id: requiredString(item.id, 'id'),
    url: nullableString(item.url),
    body: requiredString(item.body, 'body'),
    createdAt: requiredString(item.createdAt, 'createdAt'),
    updatedAt: requiredString(item.updatedAt, 'updatedAt'),
    editedAt: nullableString(item.editedAt),
    resolvedAt: nullableString(item.resolvedAt),
    parentId: nullableString(item.parentId),
    quotedText: nullableString(item.quotedText),
    user: mapUser(item.user),
    botActor: mapBot(item.botActor),
    externalUser: mapExternalUser(item.externalUser),
  };
}

function readConnection(
  response: unknown,
  target: CommentTargetRef
): ConnectionPage<LinearComment> {
  const data = record(record(response)?.data);
  const resource = target.type === 'issue' ? record(data?.issue) : null;
  if (target.type === 'issue' && !resource) {
    throw new NotFoundError(`issue '${target.id}' was not found`);
  }
  const connection = target.type === 'issue'
    ? record(resource?.comments)
    : record(data?.comments);
  const rawEdges = connection?.edges;
  const pageInfo = record(connection?.pageInfo);
  if (!Array.isArray(rawEdges) || !pageInfo || typeof pageInfo.hasNextPage !== 'boolean') {
    throw new RuntimeError('Linear returned malformed comment pagination data');
  }
  return {
    edges: rawEdges.map(rawEdge => {
      const edge = record(rawEdge);
      return {
        cursor: requiredString(edge?.cursor, 'edge cursor'),
        node: mapComment(edge?.node),
      };
    }),
    pageInfo: {
      hasNextPage: pageInfo.hasNextPage,
      endCursor: nullableString(pageInfo.endCursor),
    },
  };
}

export async function listComments(
  target: CommentTargetRef,
  input: PageInput,
  dependencies: CommentApiDependencies = defaultDependencies()
): Promise<CommentPageResult> {
  const query = target.type === 'issue' ? ISSUE_COMMENTS_QUERY : PROJECT_COMMENTS_QUERY;
  return walkPages({
    ...input,
    fetchPage: async ({ first, after }) => {
      const response = await dependencies.rawRequest(query, {
        targetId: target.id,
        first,
        after,
      });
      return readConnection(response, target);
    },
  });
}

export async function validateReplyTarget(
  target: CommentTargetRef,
  commentId: string,
  dependencies: CommentApiDependencies = defaultDependencies()
): Promise<void> {
  const response = await dependencies.rawRequest(REPLY_TARGET_QUERY, { commentId });
  const comment = record(record(record(response)?.data)?.comment);
  if (!comment) {
    throw new NotFoundError(`comment '${commentId}' was not found`);
  }
  const actualTargetId = target.type === 'issue'
    ? nullableString(comment.issueId)
    : nullableString(comment.projectId);
  if (actualTargetId !== target.id) {
    throw new ConflictError(
      `comment '${commentId}' does not belong to ${target.type} '${target.id}'`
    );
  }
  if (target.type === 'project' && nullableString(comment.projectUpdateId) !== null) {
    throw new ConflictError(
      `comment '${commentId}' belongs to a project update, not the project's direct comment thread`
    );
  }
}

export async function createComment(
  target: CommentTargetRef,
  options: CommentCreateOptions,
  dependencies: CommentApiDependencies = defaultDependencies()
): Promise<LinearComment> {
  if (options.parentId && !options.replyTargetValidated) {
    await validateReplyTarget(target, options.parentId, dependencies);
  }

  const input: Record<string, unknown> = {
    body: options.body,
    [target.type === 'issue' ? 'issueId' : 'projectId']: target.id,
    ...(options.parentId ? { parentId: options.parentId } : {}),
  };
  const response = await dependencies.rawRequest(CREATE_COMMENT_MUTATION, { input });
  const payload = record(record(record(response)?.data)?.commentCreate);
  if (payload?.success !== true || !payload.comment) {
    throw new RuntimeError('Linear did not create the comment');
  }
  return mapComment(payload.comment);
}
