import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { InitiativeList } from '../../ui/components/InitiativeList.js';
import { getAllInitiatives, type Initiative } from '../../lib/linear-client.js';
import { openInBrowser } from '../../lib/browser.js';

interface ListOptions {
  interactive?: boolean;
  web?: boolean;
}

function App({ options: _options }: { options: ListOptions }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllInitiatives()
      .then(data => {
        setInitiatives(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch initiatives');
        setLoading(false);
      });
  }, []);

  const handleSelect = (_initiative: Initiative) => {
    // Interactive list mode doesn't save, just allows browsing
    // Use 'initiatives select' for saving
    console.log('\n💡 Tip: Use "linear-create init select" to save a default initiative\n');
    process.exit(0);
  };

  const handleCancel = () => {
    process.exit(0);
  };

  if (loading) {
    return (
      <Box>
        <Text>🔄 Loading initiatives...</Text>
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

  if (initiatives.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No initiatives found in your Linear workspace.</Text>
        <Text dimColor>Create one at linear.app to get started.</Text>
      </Box>
    );
  }

  return <InitiativeList initiatives={initiatives} onSelect={handleSelect} onCancel={handleCancel} />;
}

export async function listInitiatives(options: ListOptions = {}) {
  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/');
      console.log('✓ Browser opened. View your initiatives in Linear.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/ manually.');
      process.exit(1);
    }
    return;
  }

  if (options.interactive) {
    // Interactive mode: browse with keyboard navigation
    render(<App options={options} />);
  } else {
    // Non-interactive mode (default): print list to stdout
    try {
      const initiatives = await getAllInitiatives();

      if (initiatives.length === 0) {
        console.log('No initiatives found in your Linear workspace.');
        console.log('Create one at linear.app to get started.');
        return;
      }

      // Print tab-separated values for easy parsing
      initiatives.forEach(initiative => {
        console.log(`${initiative.id}\t${initiative.name}`);
      });
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch initiatives'}`);
      process.exit(1);
    }
  }
}
