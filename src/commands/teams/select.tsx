import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { TeamList } from '../../ui/components/TeamList.js';
import { getAllTeams, validateTeamExists, type Team } from '../../lib/linear-client.js';
import { setConfigValue } from '../../lib/config.js';

interface SelectOptions {
  global?: boolean;
  project?: boolean;
  id?: string;
}

function App({ options }: { options: SelectOptions }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

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

  const handleSelect = (team: Team) => {
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';
    const scopeLabel = scope === 'global' ? 'global' : 'project';

    try {
      setConfigValue('defaultTeam', team.id, scope);
      console.log(`\n✅ Default team set to: ${team.name}`);
      console.log(`   Saved to ${scopeLabel} config`);
      console.log(`   Team ID: ${team.id}\n`);
      setCompleted(true);
      process.exit(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
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

  return <TeamList teams={teams} onSelect={handleSelect} onCancel={handleCancel} />;
}

// Non-interactive select with --id flag
async function selectNonInteractive(teamId: string, options: SelectOptions) {
  console.log(`🔍 Validating team ID: ${teamId}...`);

  try {
    // Validate team exists
    const result = await validateTeamExists(teamId);

    if (!result.valid) {
      console.error(`❌ ${result.error}`);
      process.exit(1);
    }

    console.log(`   ✓ Team found: ${result.name}`);

    // Determine scope
    const scope: 'global' | 'project' = options.project ? 'project' : 'global';
    const scopeLabel = scope === 'global' ? 'global' : 'project';

    // Save to config
    setConfigValue('defaultTeam', teamId, scope);

    console.log(`\n✅ Default team set to: ${result.name}`);
    console.log(`   Saved to ${scopeLabel} config`);
    console.log(`   Team ID: ${teamId}\n`);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

export async function selectTeam(options: SelectOptions = {}) {
  if (options.id) {
    // Non-interactive mode with --id flag
    await selectNonInteractive(options.id, options);
  } else {
    // Interactive mode (default for select commands)
    render(<App options={options} />);
  }
}
