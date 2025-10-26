import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { TeamList } from '../../ui/components/TeamList.js';
import { getAllTeams, type Team } from '../../lib/linear-client.js';
import { setConfigValue } from '../../lib/config.js';
import { getScopeInfo } from '../../lib/scope.js';

interface SelectOptions {
  global?: boolean;
  project?: boolean;
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
    const { scope, label: scopeLabel } = getScopeInfo(options);

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

export async function selectTeam(options: SelectOptions = {}) {
  // Always interactive mode
  render(<App options={options} />);
}
