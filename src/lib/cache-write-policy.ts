let cacheWritesSuppressed = false;

/**
 * Run one command path without persisting resolver or entity caches.
 *
 * The CLI executes one command at a time. Restoring the prior value keeps
 * nested calls safe and prevents test processes from leaking the policy.
 */
export async function withCacheWritesSuppressed<T>(
  suppress: boolean,
  operation: () => Promise<T>
): Promise<T> {
  if (!suppress) return operation();

  const previous = cacheWritesSuppressed;
  cacheWritesSuppressed = true;
  try {
    return await operation();
  } finally {
    cacheWritesSuppressed = previous;
  }
}

export function areCacheWritesSuppressed(): boolean {
  return cacheWritesSuppressed;
}
