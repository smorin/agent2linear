import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { getAllProjectStatuses, type ProjectStatus } from '../../lib/linear-client.js';
import { openInBrowser } from '../../lib/browser.js';
import { formatListTSV, formatListJSON } from '../../lib/output.js';

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
        {statuses.map(status => (
          <Box key={status.id}>
            <Text>
              <Text color="cyan">{status.id}</Text>
              {' - '}
              <Text bold>{status.name}</Text>
              {' '}
              <Text dimColor>({status.type})</Text>
            </Text>
          </Box>
        ))}
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

      // Handle format option
      if (options.format === 'json') {
        console.log(formatListJSON(statuses));
      } else if (options.format === 'tsv') {
        console.log(formatListTSV(statuses, ['id', 'name', 'type']));
      } else {
        // Default behavior (backward compatible): formatted output with labels
        console.log('Available project statuses:');
        statuses.forEach(status => {
          console.log(`  ${status.id}\t${status.name}\t(${status.type})`);
        });
        console.log('\n💡 Tip: Use "linear-create project-status sync-aliases" to create aliases for all statuses');
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch project statuses'}`);
      process.exit(1);
    }
  }
}
