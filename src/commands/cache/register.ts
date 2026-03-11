import { Command } from 'commander';
import { showCacheStats } from './stats.js';
import { clearCache } from './clear.js';

export function registerCacheCommands(cli: Command): void {
  const cache = cli
    .command('cache')
    .description('Manage entity cache')
    .addHelpText('before', `
The cache system reduces API calls by storing frequently accessed entities in memory:
- Teams
- Initiatives
- Members
- Templates
- Issue Labels
- Project Labels

Cache configuration can be managed via config commands:
- \`entityCacheMinTTL\`: Cache time-to-live in minutes (default: 60)
- \`enableEntityCache\`: Enable/disable entity caching (default: true)
- \`enableSessionCache\`: Enable/disable in-memory cache (default: true)
- \`enableBatchFetching\`: Enable/disable parallel API calls (default: true)
- \`prewarmCacheOnCreate\`: Auto-prewarm on project create (default: true)
`)
    .addHelpText('after', `
Examples:
  $ agent2linear cache stats             # View cache statistics
  $ agent2linear cache clear             # Clear all cached entities
  $ agent2linear cache clear --entity teams  # Clear specific entity type

Related Commands:
  $ agent2linear config set entityCacheMinTTL 120  # Set 2-hour cache TTL
  $ agent2linear config set enableEntityCache false  # Disable caching
`)
    .action(() => {
      cache.help();
    });

  cache
    .command('stats')
    .description('Show cache statistics')
    .addHelpText('after', `
Examples:
  $ agent2linear cache stats  # Display cache status and configuration

This will show:
  • Cache configuration (enabled/disabled features)
  • Entity cache status (cached items, age)
  • Cache TTL settings
`)
    .action(async () => {
      await showCacheStats();
    });

  cache
    .command('clear')
    .description('Clear cached entities')
    .option('--entity <type>', 'Clear specific entity type (teams, initiatives, members, templates, issue-labels, project-labels)')
    .addHelpText('after', `
Examples:
  $ agent2linear cache clear                 # Clear all cached entities
  $ agent2linear cache clear --entity teams  # Clear only teams cache

Cache will be automatically repopulated on next access.
`)
    .action(async (options) => {
      await clearCache(options);
    });
}
