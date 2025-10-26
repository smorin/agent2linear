import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { getAllProjectStatuses, type ProjectStatus } from '../../lib/linear-client.js';
import { openInBrowser } from '../../lib/browser.js';
import { formatListTSV, formatListJSON } from '../../lib/output.js';
import { getAliasesForId } from '../../lib/aliases.js';

interface ListOptions {
  interactive?: boolean;
  web?: boolean;
  format?: 'tsv' | 'json';
}

function App({ options: _options }: { options: ListOptions }) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllProjectStatuses()
      .then(data => {
        setStatuses(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch project statuses');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      // In non-interactive mode with Ink, just display and exit
      process.exit(0);
    } else if (error) {
      process.exit(1);
    }
  }, [loading, error]);

  if (loading) {
    return (
      <Box>
        <Text>🔄 Loading project statuses...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (statuses.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No project statuses found in your Linear workspace.</Text>
        <Text dimColor>Contact your workspace admin to configure project statuses.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Available project statuses:</Text>
      <Box marginTop={1} flexDirection="column">
        {statuses.map(status => {
          const aliases = getAliasesForId('project-status', status.id);
          return (
            <Box key={status.id}>
              <Text>
                <Text color="cyan">{status.id}</Text>
                {' - '}
                <Text bold>{status.name}</Text>
                {' '}
                <Text dimColor>({status.type})</Text>
                {aliases.length > 0 && (
                  <>
                    {' '}
                    <Text dimColor>[aliases: {aliases.map(a => `@${a}`).join(', ')}]</Text>
                  </>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>💡 Tip: Use "linear-create project-status sync-aliases" to create aliases for all statuses</Text>
      </Box>
    </Box>
  );
}

export async function listProjectStatuses(options: ListOptions = {}) {
  // Handle --web flag: open Linear settings in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear settings in your browser...');
      await openInBrowser('https://linear.app/settings/projects');
      console.log('✓ Browser opened. View your project statuses in Linear settings.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/settings/projects manually.');
      process.exit(1);
    }
    return;
  }

  if (options.interactive) {
    // Interactive mode: display with Ink
    render(<App options={options} />);
  } else {
    // Non-interactive mode (default): print list to stdout
    try {
      const statuses = await getAllProjectStatuses();

      if (statuses.length === 0) {
        console.log('No project statuses found in your Linear workspace.');
        console.log('Contact your workspace admin to configure project statuses.');
        return;
      }

      // Add aliases to each status
      const statusesWithAliases = statuses.map(status => ({
        ...status,
        aliases: getAliasesForId('project-status', status.id)
      }));

      // Handle format option
      if (options.format === 'json') {
        console.log(formatListJSON(statusesWithAliases));
      } else if (options.format === 'tsv') {
        console.log(formatListTSV(statusesWithAliases, ['id', 'name', 'type', 'aliases']));
      } else {
        // Default behavior: formatted output with aliases column
        console.log('Available project statuses:');
        console.log('ID\t\tName\t\t\tType\t\tAliases');
        statusesWithAliases.forEach(status => {
          const aliasDisplay = status.aliases.length > 0
            ? status.aliases.map(a => `@${a}`).join(', ')
            : '(none)';
          console.log(`${status.id}\t${status.name}\t\t${status.type}\t\t${aliasDisplay}`);
        });
        console.log('\n💡 Tip: Use "linear-create project-status sync-aliases" to create aliases for all statuses');
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch project statuses'}`);
      process.exit(1);
    }
  }
}
