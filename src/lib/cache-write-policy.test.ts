import { describe, expect, it } from 'vitest';

import { areCacheWritesSuppressed, withCacheWritesSuppressed } from './cache-write-policy.js';

describe('cache write policy', () => {
  it('[RLS-SAFE-DRYRUN] restores the prior policy when a suppressed operation throws', async () => {
    const expected = new Error('expected failure');

    await expect(
      withCacheWritesSuppressed(true, async () => {
        expect(areCacheWritesSuppressed()).toBe(true);
        throw expected;
      })
    ).rejects.toBe(expected);

    expect(areCacheWritesSuppressed()).toBe(false);
  });
});
