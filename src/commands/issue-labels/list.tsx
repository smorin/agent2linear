import React from 'react';
import { render, Text, Box } from 'ink';
import { Command } from 'commander';
import { getAllIssueLabels } from '../../lib/linear-client.js';
import { getConfig } from '../../lib/config.js';
import { formatColorPreview } from '../../lib/colors.js';
import { resolveAlias } from '../../lib/aliases.js';

interface IssueLabelsListProps {
  teamId?: string;
  workspace?: boolean;
  colorFilter?: string;
  format?: string;
}

function IssueLabelsList({ teamId, workspace, colorFilter, format }: IssueLabelsListProps) {
  const [labels, setLabels] = React.useState<Array<{ id: string; name: string; color: string; description?: string; teamId?: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchLabels() {
      try {
        let resolvedTeamId = teamId;

        // Use defaultTeam if no team specified and not workspace-only
        if (!resolvedTeamId && !workspace) {
          const config = getConfig();
          if (config.defaultTeam) {
            resolvedTeamId = config.defaultTeam;
          }
        }

        // Resolve team alias if provided
        if (resolvedTeamId) {
          resolvedTeamId = resolveAlias('team', resolvedTeamId);
        }

        let allLabels = await getAllIssueLabels(workspace ? undefined : resolvedTeamId);

        // Apply filters
        if (colorFilter) {
          allLabels = allLabels.filter(l => l.color.toUpperCase() === colorFilter.toUpperCase());
        }

        if (format === 'json') {
          console.log(JSON.stringify(allLabels, null, 2));
          process.exit(0);
        } else if (format === 'tsv') {
          console.log('ID\tName\tColor\tDescription\tTeam');
          for (const label of allLabels) {
            console.log(`${label.id}\t${label.name}\t${label.color}\t${label.description || ''}\t${label.teamId || 'workspace'}`);
          }
          process.exit(0);
        }

        setLabels(allLabels);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchLabels();
  }, [teamId, workspace, colorFilter, format]);

  if (loading) {
    return <Text>Loading issue labels...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (labels.length === 0) {
    return <Text color="yellow">No issue labels found</Text>;
  }

  const workspaceLabels = labels.filter(l => !l.teamId);
  const teamLabels = labels.filter(l => l.teamId);

  return (
    <Box flexDirection="column">
      {workspaceLabels.length > 0 && (
        <>
          <Text bold>Workspace Labels ({workspaceLabels.length})</Text>
          <Text> </Text>
          {workspaceLabels.map((label, index) => (
            <Box key={label.id} flexDirection="column">
              <Text>
                {formatColorPreview(label.color, '●')} <Text bold>{label.name}</Text>
              </Text>
              <Text dimColor>  ID: {label.id} | Color: {label.color}</Text>
              {label.description && <Text dimColor>  {label.description}</Text>}
              {index < workspaceLabels.length - 1 && <Text> </Text>}
            </Box>
          ))}
          {teamLabels.length > 0 && <Text> </Text>}
        </>
      )}

      {teamLabels.length > 0 && (
        <>
          <Text bold>Team Labels ({teamLabels.length})</Text>
          <Text> </Text>
          {teamLabels.map((label, index) => (
            <Box key={label.id} flexDirection="column">
              <Text>
                {formatColorPreview(label.color, '●')} <Text bold>{label.name}</Text> <Text dimColor>({label.teamId})</Text>
              </Text>
              <Text dimColor>  ID: {label.id} | Color: {label.color}</Text>
              {label.description && <Text dimColor>  {label.description}</Text>}
              {index < teamLabels.length - 1 && <Text> </Text>}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

export function listIssueLabels(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List issue labels')
    .option('-t, --team <id>', 'Filter by team (ID, name, or alias)')
    .option('-w, --workspace', 'Show only workspace-level labels')
    .option('--color <hex>', 'Filter by color (hex code)')
    .option('-f, --format <type>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      render(
        <IssueLabelsList
          teamId={options.team}
          workspace={options.workspace}
          colorFilter={options.color}
          format={options.format}
        />
      );
    });
}
