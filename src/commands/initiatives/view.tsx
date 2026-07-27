import { Box, render, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { CliError, isAuthenticationError, UsageError } from '../../lib/cli-error.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import { getAllInitiatives, getInitiativeById, type Initiative } from '../../lib/linear-client.js';
import { showEntityNotFound,showResolvedAlias } from '../../lib/output.js';
import { InitiativeList } from '../../ui/components/InitiativeList.js';

interface ViewOptions {
  interactive?: boolean;
  web?: boolean;
}

function App({ options }: { options: ViewOptions }) {
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

  const handleSelect = async (initiative: Initiative) => {
    // Fetch full initiative details to get URL
    const fullInitiative = await getInitiativeById(initiative.id);

    if (!fullInitiative) {
      console.error(`\n❌ Error: Could not fetch details for initiative ${initiative.id}\n`);
      process.exit(1);
    }

    if (options.web) {
      console.log(`\n🌐 Opening in browser: ${fullInitiative.name}`);
      await openInBrowser(fullInitiative.url);
      console.log(`✓ Browser opened to ${fullInitiative.url}\n`);
    } else {
      // Display initiative details in terminal
      console.log(`\n📋 Initiative: ${fullInitiative.name}`);
      console.log(`   ID: ${fullInitiative.id}`);
      if (fullInitiative.description) {
        console.log(`   Description: ${fullInitiative.description}`);
      }
      console.log(`   URL: ${fullInitiative.url}\n`);
    }
    process.exit(0);
  };

  const handleCancel = () => {
    console.log('\n❌ Cancelled\n');
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

export async function viewInitiative(id?: string, options: ViewOptions = {}) {
  if (options.interactive) {
    requireInteractiveInput('initiatives view');
  }
  try {
    // Handle interactive mode
    if (options.interactive) {
      // Interactive mode: show list to select from
      render(<App options={options} />);
      return;
    }

    // Non-interactive mode: require ID
    if (!id) {
      throw new UsageError(
        'Initiative ID or alias is required when not using --interactive mode'
      );
    }

    // Resolve alias to ID if needed
    const resolvedId = resolveAlias('initiative', id);
    if (resolvedId !== id) {
      console.log();
      showResolvedAlias(id, resolvedId);
    }

    console.log(`\n🔍 Fetching initiative ${resolvedId}...\n`);

    const initiative = await getInitiativeById(resolvedId);

    if (!initiative) {
      showEntityNotFound('initiative', resolvedId);
      process.exit(1);
    }

    // Handle --web flag
    if (options.web) {
      console.log(`🌐 Opening in browser: ${initiative.name}`);
      await openInBrowser(initiative.url);
      console.log(`✓ Browser opened to ${initiative.url}`);
      process.exit(0);
    }

    // Display initiative details
    console.log(`📋 Initiative: ${initiative.name}`);
    console.log(`   ID: ${initiative.id}`);

    if (initiative.description) {
      console.log(`   Description: ${initiative.description}`);
    }

    console.log(`   URL: ${initiative.url}`);
    console.log();
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (isAuthenticationError(error)) throw error;
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
