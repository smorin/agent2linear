import { describe, expect, it, vi } from 'vitest';

import {
  ALL_PAGE_SIZE,
  type ConnectionPage,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  PaginationInputError,
  PaginationRuntimeError,
  parsePageLimit,
  validateRawCursor,
  walkPages,
} from './pagination.js';

interface Item {
  id: string;
  label: string;
  matches?: boolean;
}

function item(id: string, label = id, matches?: boolean): Item {
  return { id, label, matches };
}

function page(
  entries: Array<[cursor: string, node: Item]>,
  hasNextPage = false,
  endCursor: string | null | undefined = null
): ConnectionPage<Item> {
  return {
    edges: entries.map(([cursor, node]) => ({ cursor, node })),
    pageInfo: { hasNextPage, endCursor },
  };
}

describe('parsePageLimit', () => {
  it('uses the documented default and accepts both inclusive boundaries', () => {
    expect(parsePageLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit('1')).toBe(1);
    expect(parsePageLimit('250')).toBe(MAX_PAGE_LIMIT);
    expect(parsePageLimit('050')).toBe(50);
  });

  it.each(['', ' ', '0', '-1', '+1', '1.5', '12abc', '1 ', ' 1', '251', '9007199254740993'])(
    'rejects the complete invalid token %j',
    value => {
      expect(() => parsePageLimit(value)).toThrow(PaginationInputError);
    }
  );
});

describe('validateRawCursor', () => {
  it('allows an omitted cursor and rejects only the empty string', () => {
    expect(validateRawCursor(undefined)).toBeUndefined();
    expect(() => validateRawCursor('')).toThrow(PaginationInputError);
  });

  it('preserves every code unit without trimming, decoding, or wrapping', () => {
    const cursor = '  raw/+/= cursor 💡\n';
    expect(validateRawCursor(cursor)).toBe(cursor);
  });
});

describe('walkPages', () => {
  it('uses first=50 by default and reports an exhausted bounded result', async () => {
    const fetchPage = vi.fn(async () => page([['c1', item('1')]]));

    const result = await walkPages({ fetchPage });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ first: DEFAULT_PAGE_LIMIT, after: null });
    expect(result.items.map(({ id }) => id)).toEqual(['1']);
    expect(result.pageInfo).toEqual({
      returnedCount: 1,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    });
  });

  it('passes a raw starting cursor to the first request byte-for-byte', async () => {
    const after = '  opaque/+/= 💡\n';
    const fetchPage = vi.fn(async () => page([]));

    await walkPages({ after, fetchPage });

    expect(fetchPage).toHaveBeenCalledWith({ first: DEFAULT_PAGE_LIMIT, after });
  });

  it('rejects invalid numeric input before invoking the fetcher', async () => {
    const fetchPage = vi.fn(async () => page([]));

    await expect(walkPages({ limit: 0, fetchPage })).rejects.toBeInstanceOf(PaginationInputError);
    await expect(walkPages({ limit: 1.5, fetchPage })).rejects.toBeInstanceOf(PaginationInputError);
    await expect(walkPages({ limit: 251, fetchPage })).rejects.toBeInstanceOf(PaginationInputError);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('stops inside a backend page at the bounded limit and exposes the last examined edge', async () => {
    const fetchPage = vi.fn(async () =>
      page([
        ['c1', item('1')],
        ['c2', item('2')],
        ['c3', item('3')],
      ])
    );

    const result = await walkPages({ limit: 2, fetchPage });

    expect(result.items.map(({ id }) => id)).toEqual(['1', '2']);
    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: true,
      endCursor: 'c2',
      fetchedAll: false,
    });
  });

  it('counts predicate matches and resumes after the last examined edge, not the page end', async () => {
    const fetchPage = vi.fn(async () =>
      page([
        ['c1', item('1', 'no', false)],
        ['c2', item('2', 'yes-1', true)],
        ['c3', item('3', 'no', false)],
        ['c4', item('4', 'yes-2', true)],
        ['c5', item('5', 'unexamined', true)],
      ])
    );

    const result = await walkPages<Item>({
      limit: 2,
      fetchPage,
      matches: node => node.matches === true,
    });

    expect(result.items.map(({ id }) => id)).toEqual(['2', '4']);
    expect(result.pageInfo.endCursor).toBe('c4');
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('walks additional bounded backend pages until enough matches are found', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            ['c1', item('1', 'no', false)],
            ['c2', item('2', 'yes-1', true)],
          ],
          true,
          'c2'
        )
      )
      .mockResolvedValueOnce(
        page([
          ['c3', item('3', 'no', false)],
          ['c4', item('4', 'yes-2', true)],
          ['c5', item('5', 'unexamined', true)],
        ])
      );

    const result = await walkPages<Item>({
      limit: 2,
      fetchPage,
      matches: node => node.matches === true,
    });

    expect(fetchPage).toHaveBeenNthCalledWith(1, { first: 2, after: null });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { first: 2, after: 'c2' });
    expect(result.items.map(({ id }) => id)).toEqual(['2', '4']);
    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: true,
      endCursor: 'c4',
      fetchedAll: false,
    });
  });

  it('treats an exact-limit result at connection exhaustion as complete', async () => {
    const fetchPage = vi.fn(async () =>
      page([
        ['c1', item('1')],
        ['c2', item('2')],
      ])
    );

    const result = await walkPages({ limit: 2, fetchPage });

    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    });
  });

  it('uses the last edge cursor when a bounded result ends at a page boundary with more data', async () => {
    const fetchPage = vi.fn(async () =>
      page(
        [
          ['edge-1', item('1')],
          ['edge-2', item('2')],
        ],
        true,
        'backend-end-2'
      )
    );

    const result = await walkPages({ limit: 2, fetchPage });

    expect(result.pageInfo).toEqual({
      returnedCount: 2,
      hasNextPage: true,
      endCursor: 'edge-2',
      fetchedAll: false,
    });
  });

  it('[CPH-API-PAGE-ORDER] honors an adapter request-page cap while filling a larger public limit', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            ['c1', item('1')],
            ['c2', item('2')],
          ],
          true,
          'c2'
        )
      )
      .mockResolvedValueOnce(
        page([
          ['c3', item('3')],
          ['c4', item('4')],
        ])
      );

    const result = await walkPages({
      limit: 3,
      requestPageSize: 2,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenNthCalledWith(1, { first: 2, after: null });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { first: 2, after: 'c2' });
    expect(result.items.map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(result.pageInfo).toEqual({
      returnedCount: 3,
      hasNextPage: true,
      endCursor: 'c3',
      fetchedAll: false,
    });
  });

  it('makes sequential all-page requests of 250, ignores the bounded limit, and preserves order', async () => {
    const after = 'raw-start';
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            ['c1', item('1')],
            ['c2', item('2')],
          ],
          true,
          'c2'
        )
      )
      .mockResolvedValueOnce(page([['c3', item('3')]]));

    const result = await walkPages({ after, limit: 1, fetchAll: true, fetchPage });

    expect(fetchPage).toHaveBeenNthCalledWith(1, { first: ALL_PAGE_SIZE, after });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { first: ALL_PAGE_SIZE, after: 'c2' });
    expect(result.items.map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(result.pageInfo).toEqual({
      returnedCount: 3,
      hasNextPage: false,
      endCursor: null,
      fetchedAll: true,
    });
  });

  it('deduplicates by ID while retaining the first occurrence and provider order', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            ['c1', item('a', 'first-a')],
            ['c2', item('b', 'b')],
          ],
          true,
          'c2'
        )
      )
      .mockResolvedValueOnce(
        page([
          ['c3', item('a', 'second-a')],
          ['c4', item('c', 'c')],
        ])
      );

    const result = await walkPages<Item>({ fetchAll: true, fetchPage });

    expect(result.items.map(({ label }) => label)).toEqual(['first-a', 'b', 'c']);
  });

  it('supports an asynchronous match predicate without changing order', async () => {
    const fetchPage = vi.fn(async () =>
      page([
        ['c1', item('1', 'yes', true)],
        ['c2', item('2', 'no', false)],
        ['c3', item('3', 'yes', true)],
      ])
    );

    const result = await walkPages({
      fetchAll: true,
      fetchPage,
      matches: async node => node.matches === true,
    });

    expect(result.items.map(({ id }) => id)).toEqual(['1', '3']);
  });

  it('fails on hasNextPage without a nonempty backend end cursor', async () => {
    const missing = vi.fn(async () => page([['c1', item('1')]], true, null));
    const empty = vi.fn(async () => page([['c1', item('1')]], true, ''));

    await expect(walkPages({ fetchAll: true, fetchPage: missing })).rejects.toMatchObject({
      name: 'PaginationRuntimeError',
      code: 'missing_end_cursor',
    });
    await expect(walkPages({ fetchAll: true, fetchPage: empty })).rejects.toBeInstanceOf(
      PaginationRuntimeError
    );
  });

  it('fails instead of looping when a continuation cursor repeats', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([], true, 'repeat'))
      .mockResolvedValueOnce(page([], true, 'repeat'));

    await expect(walkPages({ fetchAll: true, fetchPage })).rejects.toMatchObject({
      name: 'PaginationRuntimeError',
      code: 'repeated_cursor',
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('detects a backend continuation that repeats the raw starting cursor', async () => {
    const fetchPage = vi.fn(async () => page([], true, 'start'));

    await expect(walkPages({ after: 'start', fetchAll: true, fetchPage })).rejects.toMatchObject({
      code: 'repeated_cursor',
    });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty edge cursor needed for a bounded continuation', async () => {
    const fetchPage = vi.fn(async () =>
      page([
        ['c1', item('1')],
        ['', item('2')],
        ['c3', item('3')],
      ])
    );

    await expect(walkPages({ limit: 2, fetchPage })).rejects.toMatchObject({
      code: 'invalid_edge_cursor',
    });
  });

  it('rejects a later-page failure without returning a partial result', async () => {
    const failure = new Error('second page failed');
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([['c1', item('1')]], true, 'c1'))
      .mockRejectedValueOnce(failure);

    await expect(walkPages({ fetchAll: true, fetchPage })).rejects.toBe(failure);
  });
});
