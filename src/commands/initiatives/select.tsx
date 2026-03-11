import { Box, render, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { setConfigValue } from '../../lib/config.js';
import { getAllInitiatives, type Initiative } from '../../lib/linear-client.js';
import { getScopeInfo } from '../../lib/scope.js';
import { InitiativeList } from '../../ui/components/InitiativeList.js';

interface SelectOptions {
  global?: boolean;
  project?: boolean;
}

function App({ options }: { options: SelectOptions }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

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

  const handleSelect = (initiative: Initiative) => {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    try {
      setConfigValue('defaultInitiative', initiative.id, scope);
      console.log(`\n✅ Default initiative set to: ${initiative.name}`);
      console.log(`   Saved to ${scopeLabel} config`);
      console.log(`   Initiative ID: ${initiative.id}\n`);
      setCompleted(true);
      process.exit(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save initiative');
    }
  };

  const handleCancel = () => {
    console.log('\n❌ Cancelled\n');
    process.exit(0);
  };

  if (completed) {
    return null;
  }

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

export async function selectInitiative(options: SelectOptions = {}) {
  // Always interactive mode
  render(<App options={options} />);
}
