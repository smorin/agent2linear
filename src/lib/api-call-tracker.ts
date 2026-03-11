/**
 * API Call Tracker - Performance Monitoring
 *
 * Tracks all GraphQL API calls to Linear to ensure we avoid N+1 query patterns.
 * Used during testing and development to verify performance optimizations.
 *
 * Usage:
 *   import { startTracking, stopTracking, getMetrics, logCall } from './api-call-tracker.js';
 *
 *   startTracking();
 *   // ... make API calls ...
 *   const metrics = getMetrics();
 *   console.log(`Total API calls: ${metrics.totalCalls}`);
 */

export interface ApiCallRecord {
  timestamp: Date;
  operation: string;
  operationType: 'query' | 'mutation' | 'unknown';
  source: 'main' | 'validation' | 'cache' | 'unknown';
  durationMs?: number;
  variables?: Record<string, unknown>;
  error?: string;
}

export interface ApiCallMetrics {
  totalCalls: number;
  mainCalls: number;
  validationCalls: number;
  cacheCalls: number;
  queries: number;
  mutations: number;
  averageDurationMs: number;
  records: ApiCallRecord[];
}

// Global tracking state
let trackingEnabled = false;
let apiCalls: ApiCallRecord[] = [];

/**
 * Enable API call tracking
 */
export function startTracking(): void {
  trackingEnabled = true;
  apiCalls = [];
}

/**
 * Disable API call tracking
 */
export function stopTracking(): void {
  trackingEnabled = false;
}

/**
 * Check if tracking is currently enabled
 */
export function isTracking(): boolean {
  return trackingEnabled;
}

/**
 * Reset tracking data without disabling tracking
 */
export function resetTracking(): void {
  apiCalls = [];
}

/**
 * Log an API call
 *
 * @param operation - Operation name (e.g., "IssueList", "ProjectQuery")
 * @param operationType - Type of GraphQL operation
 * @param source - Source of the call (main query, validation, cache warmup)
 * @param durationMs - Duration in milliseconds
 * @param variables - GraphQL variables (optional)
 * @param error - Error message if call failed (optional)
 */
export function logCall(
  operation: string,
  operationType: 'query' | 'mutation' | 'unknown' = 'unknown',
  source: 'main' | 'validation' | 'cache' | 'unknown' = 'unknown',
  durationMs?: number,
  variables?: Record<string, unknown>,
  error?: string
): void {
  if (!trackingEnabled) return;

  const record: ApiCallRecord = {
    timestamp: new Date(),
    operation,
    operationType,
    source,
    durationMs,
    variables,
    error,
  };

  apiCalls.push(record);
}

/**
 * Get current tracking metrics
 */
export function getMetrics(): ApiCallMetrics {
  const totalCalls = apiCalls.length;
  const mainCalls = apiCalls.filter(c => c.source === 'main').length;
  const validationCalls = apiCalls.filter(c => c.source === 'validation').length;
  const cacheCalls = apiCalls.filter(c => c.source === 'cache').length;
  const queries = apiCalls.filter(c => c.operationType === 'query').length;
  const mutations = apiCalls.filter(c => c.operationType === 'mutation').length;

  const durations = apiCalls
    .filter(c => c.durationMs !== undefined)
    .map(c => c.durationMs!);
  const averageDurationMs = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  return {
    totalCalls,
    mainCalls,
    validationCalls,
    cacheCalls,
    queries,
    mutations,
    averageDurationMs,
    records: [...apiCalls], // Return copy to prevent external modification
  };
}

/**
 * Print a formatted summary of metrics to console
 */
export function printMetrics(): void {
  const metrics = getMetrics();

  console.log('\n=== API Call Tracking Metrics ===');
  console.log(`Total API Calls:      ${metrics.totalCalls}`);
  console.log(`  Main queries:       ${metrics.mainCalls}`);
  console.log(`  Validation queries: ${metrics.validationCalls}`);
  console.log(`  Cache queries:      ${metrics.cacheCalls}`);
  console.log(`Query/Mutation split: ${metrics.queries}/${metrics.mutations}`);

  if (metrics.averageDurationMs > 0) {
    console.log(`Average duration:     ${metrics.averageDurationMs.toFixed(2)}ms`);
  }

  // Performance warning
  if (metrics.totalCalls > 5) {
    console.log(`\n⚠️  WARNING: High API call count detected!`);
    console.log(`   Expected: 1-3 calls for most operations`);
    console.log(`   Actual: ${metrics.totalCalls} calls`);
    console.log(`   Check for N+1 query patterns!`);
  } else if (metrics.totalCalls <= 3) {
    console.log(`\n✅ Performance looks good (${metrics.totalCalls} calls)`);
  }

  console.log('================================\n');
}

/**
 * Print detailed call log to console
 */
export function printDetailedLog(): void {
  const metrics = getMetrics();

  console.log('\n=== Detailed API Call Log ===');
  metrics.records.forEach((record, index) => {
    const time = record.timestamp.toISOString();
    const duration = record.durationMs ? ` (${record.durationMs}ms)` : '';
    const error = record.error ? ` ERROR: ${record.error}` : '';

    console.log(`[${index + 1}] ${time}`);
    console.log(`    Operation: ${record.operation} (${record.operationType})`);
    console.log(`    Source: ${record.source}${duration}${error}`);

    if (record.variables && Object.keys(record.variables).length > 0) {
      console.log(`    Variables: ${JSON.stringify(record.variables, null, 2)}`);
    }
    console.log('');
  });
  console.log('============================\n');
}

/**
 * Export metrics as JSON for test scripts
 */
export function exportMetricsJson(): string {
  return JSON.stringify(getMetrics(), null, 2);
}

/**
 * Helper: Wrap a Linear client call with tracking
 *
 * Example:
 *   const result = await trackCall('IssueList', 'query', 'main', async () => {
 *     return await client.issues({ filter: {...} });
 *   });
 */
export async function trackCall<T>(
  operation: string,
  operationType: 'query' | 'mutation' | 'unknown',
  source: 'main' | 'validation' | 'cache' | 'unknown',
  fn: () => Promise<T>
): Promise<T> {
  if (!trackingEnabled) {
    return fn();
  }

  const startTime = Date.now();
  let error: string | undefined;

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    logCall(operation, operationType, source, durationMs);
    return result;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;
    logCall(operation, operationType, source, durationMs, undefined, error);
    throw err;
  }
}
