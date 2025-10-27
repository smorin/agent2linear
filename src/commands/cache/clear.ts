import { getEntityCache, clearGlobalCache } from '../../lib/entity-cache.js';
import {
  clearAllCache,
  clearTeamsCache,
  clearInitiativesCache,
  clearMembersCache,
  clearTemplatesCache,
  clearStatusCache
} from '../../lib/status-cache.js';

/**
 * Clear all cached entities (both session and persistent)
 */
export async function clearCache(options?: { entity?: string }) {
  const cache = getEntityCache();

  if (options?.entity) {
    // Clear specific entity type
    // Note: Only entities with persistent cache support are included
    // issue-labels and project-labels will be added when persistent cache is implemented (M12)
    const validEntities = ['teams', 'initiatives', 'members', 'templates', 'statuses'];

    if (!validEntities.includes(options.entity)) {
      console.error(`❌ Invalid entity type: ${options.entity}`);
      console.error(`   Valid options: ${validEntities.join(', ')}`);
      process.exit(1);
    }

    console.log(`🗑️  Clearing ${options.entity} cache...`);

    // Clear session cache (in-memory)
    cache.clearEntity(options.entity as any);

    // Clear persistent cache (file-based)
    switch (options.entity) {
      case 'teams':
        clearTeamsCache();
        break;
      case 'initiatives':
        clearInitiativesCache();
        break;
      case 'members':
        clearMembersCache();
        break;
      case 'templates':
        clearTemplatesCache();
        break;
      case 'statuses':
        clearStatusCache();
        break;
    }

    console.log('✅ Cache cleared successfully (session + persistent)');
  } else {
    // Clear all caches
    console.log('🗑️  Clearing all cached entities...');

    // Clear session cache (in-memory)
    clearGlobalCache();

    // Clear persistent cache (file-based)
    clearAllCache();

    console.log('✅ All caches cleared successfully (session + persistent)');
  }

  console.log('\n💡 Cache will be repopulated on next access');
  console.log('💡 Use "linear-create cache stats" to view cache status\n');
}
