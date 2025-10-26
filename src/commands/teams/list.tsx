import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { getAllTeams, type Team } from '../../lib/linear-client.js';
import { openInBrowser } from '../../lib/browser.js';
import { formatListTSV, formatListJSON } from '../../lib/output.js';

interface ListOptions {
  interactive?: boolean;
  web?: boolean;
  format?: 'tsv' | 'json';
}

function App({ options: _options }: { options: ListOptions }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllTeams()
      .then(data => {
        setTeams(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch teams');
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
        <Text>🔄 Loading teams...</Text>
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

  if (teams.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No teams found in your Linear workspace.</Text>
        <Text dimColor>Create one at linear.app to get started.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Available teams:</Text>
      <Box marginTop={1} flexDirection="column">
        {teams.map(team => (
          <Box key={team.id}>
            <Text>
              <Text color="cyan">{team.id}</Text>
              {' - '}
              <Text bold>{team.name}</Text>
              {team.key && <Text dimColor> ({team.key})</Text>}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>💡 Tip: Use "linear-create teams select" to save a default team</Text>
      </Box>
    </Box>
  );
}

export async function listTeams(options: ListOptions = {}) {
  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/');
      console.log('✓ Browser opened. View your teams in Linear.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/ manually.');
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
      const teams = await getAllTeams();

      if (teams.length === 0) {
        console.log('No teams found in your Linear workspace.');
        console.log('Create one at linear.app to get started.');
        return;
      }

      // Handle format option
      if (options.format === 'json') {
        console.log(formatListJSON(teams));
      } else if (options.format === 'tsv') {
        console.log(formatListTSV(teams, ['id', 'name', 'key']));
      } else {
        // Default behavior (backward compatible): formatted output with labels
        console.log('Available teams:');
        teams.forEach(team => {
          console.log(`  ${team.id}\t${team.name}${team.key ? ` (${team.key})` : ''}`);
        });
        console.log('\n💡 Tip: Use "linear-create teams select" to save a default team');
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch teams'}`);
      process.exit(1);
    }
  }
}
