import React from 'react';
import { render, Text, Box } from 'ink';
import { Command } from 'commander';
import { getAllWorkflowStates } from '../../lib/linear-client.js';
import { getConfig } from '../../lib/config.js';
import { formatColorPreview } from '../../lib/colors.js';
import { resolveAlias } from '../../lib/aliases.js';

interface WorkflowStatesListProps {
  teamId?: string;
  typeFilter?: string;
  colorFilter?: string;
  format?: string;
}

function WorkflowStatesList({ teamId, typeFilter, colorFilter, format }: WorkflowStatesListProps) {
  const [states, setStates] = React.useState<Array<{ id: string; name: string; type: string; color: string; description?: string; position: number; teamId: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStates() {
      try {
        let resolvedTeamId = teamId;
        if (!resolvedTeamId) {
          const config = getConfig();
          if (config.defaultTeam) {
            resolvedTeamId = config.defaultTeam;
          }
        }
        if (resolvedTeamId) {
          resolvedTeamId = resolveAlias('team', resolvedTeamId);
        }

        let allStates = await getAllWorkflowStates(resolvedTeamId);

        if (typeFilter) {
          allStates = allStates.filter(s => s.type === typeFilter);
        }
        if (colorFilter) {
          allStates = allStates.filter(s => s.color.toUpperCase() === colorFilter.toUpperCase());
        }

        if (format === 'json') {
          console.log(JSON.stringify(allStates, null, 2));
          process.exit(0);
        } else if (format === 'tsv') {
          console.log('ID\tName\tType\tColor\tPosition\tTeam');
          for (const state of allStates) {
            console.log(`${state.id}\t${state.name}\t${state.type}\t${state.color}\t${state.position}\t${state.teamId}`);
          }
          process.exit(0);
        }

        setStates(allStates);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchStates();
  }, [teamId, typeFilter, colorFilter, format]);

  if (loading) {
    return <Text>Loading workflow states...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (states.length === 0) {
    return <Text color="yellow">No workflow states found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>Workflow States ({states.length})</Text>
      <Text> </Text>

      {states.map((state, index) => (
        <Box key={state.id} flexDirection="column">
          <Text>
            {formatColorPreview(state.color, '●')} <Text bold>{state.name}</Text> <Text dimColor>({state.type})</Text>
          </Text>
          <Text dimColor>  ID: {state.id} | Position: {state.position} | Color: {state.color}</Text>
          {index < states.length - 1 && <Text> </Text>}
        </Box>
      ))}
    </Box>
  );
}

export function listWorkflowStates(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List workflow states (issue statuses)')
    .option('-t, --team <id>', 'Filter by team (ID, name, or alias)')
    .option('--type <type>', 'Filter by type (triage|backlog|unstarted|started|completed|canceled)')
    .option('--color <hex>', 'Filter by color (hex code)')
    .option('-f, --format <type>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      // Handle JSON/TSV output before rendering React component
      if (options.format === 'json' || options.format === 'tsv') {
        try {
          let resolvedTeamId = options.team;
          if (!resolvedTeamId) {
            const config = getConfig();
            if (config.defaultTeam) {
              resolvedTeamId = config.defaultTeam;
            }
          }
          if (resolvedTeamId) {
            resolvedTeamId = resolveAlias('team', resolvedTeamId);
          }

          let allStates = await getAllWorkflowStates(resolvedTeamId);

          if (options.type) {
            allStates = allStates.filter(s => s.type === options.type);
          }
          if (options.color) {
            allStates = allStates.filter(s => s.color.toUpperCase() === options.color.toUpperCase());
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(allStates, null, 2));
          } else if (options.format === 'tsv') {
            console.log('ID\tName\tType\tColor\tPosition\tTeam');
            for (const state of allStates) {
              console.log(`${state.id}\t${state.name}\t${state.type}\t${state.color}\t${state.position}\t${state.teamId}`);
            }
          }
          process.exit(0);
        } catch (err) {
          console.error('Error:', err instanceof Error ? err.message : 'Unknown error');
          process.exit(1);
        }
      }

      // Render interactive UI for default format
      render(
        <WorkflowStatesList
          teamId={options.team}
          typeFilter={options.type}
          colorFilter={options.color}
          format={options.format}
        />
      );
    });
}
