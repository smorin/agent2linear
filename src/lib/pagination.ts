export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 250;
export const ALL_PAGE_SIZE = 250;

export interface PageInput {
  limit?: number;
  after?: string;
  fetchAll?: boolean;
}

export interface FetchPageInput {
  first: number;
  after: string | null;
}

export interface PageEdge<T> {
  cursor: string;
  node: T;
}

export interface ConnectionPage<T> {
  edges: PageEdge<T>[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
  };
}

export interface PageInfo {
  returnedCount: number;
  hasNextPage: boolean;
  endCursor: string | null;
  fetchedAll: boolean;
}

export interface PageResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

export type PageFetcher<T> = (input: FetchPageInput) => Promise<ConnectionPage<T>>;
export type PageMatchPredicate<T> = (node: T) => boolean | Promise<boolean>;

export interface WalkPagesOptions<T extends { id: string }> extends PageInput {
  fetchPage: PageFetcher<T>;
  matches?: PageMatchPredicate<T>;
  /** Adapter-specific GraphQL request cap; does not change the public result limit. */
  requestPageSize?: number;
}

export type PaginationInputErrorCode = 'invalid_limit' | 'empty_cursor';

export class PaginationInputError extends Error {
  readonly exitCode = 2;

  constructor(
    readonly code: PaginationInputErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PaginationInputError';
  }
}

export type PaginationRuntimeErrorCode =
  | 'invalid_edge_cursor'
  | 'invalid_node_id'
  | 'invalid_page'
  | 'missing_end_cursor'
  | 'repeated_cursor';

export class PaginationRuntimeError extends Error {
  readonly exitCode = 1;

  constructor(
    readonly code: PaginationRuntimeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PaginationRuntimeError';
  }
}

/**
 * Parse a complete base-10 integer token for the public `--limit` option.
 * No whitespace, sign, fraction, exponent, or trailing text is accepted.
 */
export function parsePageLimit(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PAGE_LIMIT;
  }

  if (!/^\d+$/.test(value)) {
    throw new PaginationInputError(
      'invalid_limit',
      `Limit must be a whole number between 1 and ${MAX_PAGE_LIMIT}`
    );
  }

  const limit = Number(value);
  return validatePageLimit(limit);
}

/**
 * Validate a raw Linear cursor without altering it. An omitted cursor starts at
 * the beginning; every nonempty supplied string is returned byte-for-byte.
 */
export function validateRawCursor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value.length === 0) {
    throw new PaginationInputError('empty_cursor', 'Cursor must not be empty');
  }
  return value;
}

/**
 * Walk a forward-only edge connection. The function buffers its result and
 * therefore either resolves with one complete invocation result or rejects;
 * callers never receive a partial result after a later-page failure.
 */
export async function walkPages<T extends { id: string }>(
  options: WalkPagesOptions<T>
): Promise<PageResult<T>> {
  const limit = validatePageLimit(options.limit ?? DEFAULT_PAGE_LIMIT);
  const startingAfter = validateRawCursor(options.after) ?? null;
  const fetchAll = options.fetchAll === true;
  const requestPageSize = validatePageLimit(options.requestPageSize ?? ALL_PAGE_SIZE);
  const requestSize = fetchAll ? requestPageSize : Math.min(limit, requestPageSize);

  const items: T[] = [];
  const seenIds = new Set<string>();
  const seenContinuationCursors = new Set<string>();
  if (startingAfter !== null) {
    seenContinuationCursors.add(startingAfter);
  }

  let after = startingAfter;

  for (;;) {
    const currentPage = await options.fetchPage({ first: requestSize, after });
    assertConnectionPage(currentPage);

    const backendEndCursor = currentPage.pageInfo.hasNextPage
      ? requireBackendEndCursor(currentPage.pageInfo.endCursor)
      : null;

    for (let index = 0; index < currentPage.edges.length; index += 1) {
      const edge = currentPage.edges[index];
      const edgeCursor = requireEdgeCursor(edge.cursor);
      const nodeId = requireNodeId(edge.node.id);

      // Seeing an edge advances the safe continuation boundary even if the
      // node is a duplicate or does not satisfy the client-side predicate.
      if (seenIds.has(nodeId)) {
        continue;
      }
      seenIds.add(nodeId);

      if (options.matches && !(await options.matches(edge.node))) {
        continue;
      }

      items.push(edge.node);

      if (!fetchAll && items.length === limit) {
        const hasUnexaminedEdges = index < currentPage.edges.length - 1;
        const hasNextPage = hasUnexaminedEdges || currentPage.pageInfo.hasNextPage;

        return {
          items,
          pageInfo: hasNextPage
            ? incompletePageInfo(items.length, edgeCursor)
            : completePageInfo(items.length),
        };
      }
    }

    if (!currentPage.pageInfo.hasNextPage) {
      return {
        items,
        pageInfo: completePageInfo(items.length),
      };
    }

    // `backendEndCursor` is non-null here because it was validated before any
    // page data was examined. Reject a repeated value instead of looping.
    if (seenContinuationCursors.has(backendEndCursor as string)) {
      throw new PaginationRuntimeError(
        'repeated_cursor',
        'Linear returned a repeated pagination cursor'
      );
    }
    seenContinuationCursors.add(backendEndCursor as string);
    after = backendEndCursor;
  }
}

function validatePageLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new PaginationInputError(
      'invalid_limit',
      `Limit must be a whole number between 1 and ${MAX_PAGE_LIMIT}`
    );
  }
  return limit;
}

function assertConnectionPage<T>(page: ConnectionPage<T>): void {
  if (
    !page ||
    !Array.isArray(page.edges) ||
    !page.pageInfo ||
    typeof page.pageInfo.hasNextPage !== 'boolean'
  ) {
    throw new PaginationRuntimeError('invalid_page', 'Linear returned malformed pagination data');
  }
}

function requireBackendEndCursor(cursor: string | null | undefined): string {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new PaginationRuntimeError(
      'missing_end_cursor',
      'Linear reported another page without a continuation cursor'
    );
  }
  return cursor;
}

function requireEdgeCursor(cursor: string): string {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new PaginationRuntimeError(
      'invalid_edge_cursor',
      'Linear returned an edge without a continuation cursor'
    );
  }
  return cursor;
}

function requireNodeId(id: string): string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new PaginationRuntimeError(
      'invalid_node_id',
      'Linear returned a paginated node without an ID'
    );
  }
  return id;
}

function completePageInfo(returnedCount: number): PageInfo {
  return {
    returnedCount,
    hasNextPage: false,
    endCursor: null,
    fetchedAll: true,
  };
}

function incompletePageInfo(returnedCount: number, endCursor: string): PageInfo {
  return {
    returnedCount,
    hasNextPage: true,
    endCursor,
    fetchedAll: false,
  };
}
