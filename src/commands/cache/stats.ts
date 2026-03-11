import { getConfig } from '../../lib/config.js';
import { getEntityCache } from '../../lib/entity-cache.js';

/**
 * Display cache statistics
 */
export async function showCacheStats() {
  const cache = getEntityCache();
  const stats = cache.getStats();
  const config = getConfig();

  console.log('\n📊 Cache Statistics\n');

  // Cache configuration
  console.log('Configuration:');
  console.log(`  Entity Cache:      ${config.enableEntityCache !== false ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Session Cache:     ${config.enableSessionCache !== false ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Persistent Cache:  ${config.enablePersistentCache !== false ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Batch Fetching:    ${config.enableBatchFetching !== false ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Prewarm on Create: ${config.prewarmCacheOnCreate !== false ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  Cache TTL:         ${config.entityCacheMinTTL || config.projectCacheMinTTL || 60} minutes`);
  console.log();

  // Cache status
  console.log('Entity Cache Status:');

  // Teams
  const teamsStatus = stats.teams.cached ? '✓' : '✗';
  const teamsAge = stats.teams.age ? formatAge(stats.teams.age) : 'n/a';
  console.log(`  Teams:        ${teamsStatus} ${stats.teams.count} items (age: ${teamsAge})`);

  // Initiatives
  const initiativesStatus = stats.initiatives.cached ? '✓' : '✗';
  const initiativesAge = stats.initiatives.age ? formatAge(stats.initiatives.age) : 'n/a';
  console.log(`  Initiatives:  ${initiativesStatus} ${stats.initiatives.count} items (age: ${initiativesAge})`);

  // Members
  const membersStatus = stats.members.cached ? '✓' : '✗';
  const membersAge = stats.members.age ? formatAge(stats.members.age) : 'n/a';
  console.log(`  Members:      ${membersStatus} ${stats.members.count} items (age: ${membersAge})`);

  // Templates
  const templatesStatus = stats.templates.cached ? '✓' : '✗';
  const templatesAge = stats.templates.age ? formatAge(stats.templates.age) : 'n/a';
  console.log(`  Templates:    ${templatesStatus} ${stats.templates.count} items (age: ${templatesAge})`);

  console.log();
  console.log('💡 Use "agent2linear cache clear" to clear all cached data');
  console.log('💡 Use "agent2linear config set entityCacheMinTTL <minutes>" to adjust TTL');
  console.log();
}

/**
 * Format cache age in human-readable format
 */
function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
