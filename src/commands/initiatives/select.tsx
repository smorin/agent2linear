import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { InitiativeList } from '../../ui/components/InitiativeList.js';
import { getAllInitiatives, validateInitiativeExists, type Initiative } from '../../lib/linear-client.js';
import { setConfigValue } from '../../lib/config.js';

interface SelectOptions {
  global?: boolean;
  project?: boolean;
  id?: string;
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
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';
    const scopeLabel = scope === 'global' ? 'global' : 'project';

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

// Non-interactive select with --id flag
async function selectNonInteractive(initiativeId: string, options: SelectOptions) {
  console.log(`🔍 Validating initiative ID: ${initiativeId}...`);

  try {
    // Validate initiative exists
    const result = await validateInitiativeExists(initiativeId);

    if (!result.valid) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }

    console.log(`   ✓ Initiative found: ${result.name}`);

    // Determine scope
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';
    const scopeLabel = scope === 'global' ? 'global' : 'project';

    // Save to config
    setConfigValue('defaultInitiative', initiativeId, scope);

    console.log(`\n✅ Default initiative set to: ${result.name}`);
    console.log(`   Saved to ${scopeLabel} config`);
    console.log(`   Initiative ID: ${initiativeId}\n`);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export async function selectInitiative(options: SelectOptions = {}) {
  if (options.id) {
    // Non-interactive mode with --id flag
    await selectNonInteractive(options.id, options);
  } else {
    // Interactive mode (default for select commands)
    render(<App options={options} />);
  }
}
