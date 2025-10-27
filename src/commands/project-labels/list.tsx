import React from 'react';
import { render, Text, Box } from 'ink';
import { Command } from 'commander';
import { getAllProjectLabels } from '../../lib/linear-client.js';
import { formatColorPreview } from '../../lib/colors.js';

interface ProjectLabelsListProps {
  colorFilter?: string;
  format?: string;
  all?: boolean;
}

function ProjectLabelsList({ colorFilter, format, all }: ProjectLabelsListProps) {
  const [labels, setLabels] = React.useState<Array<{ id: string; name: string; color: string; description?: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchLabels() {
      try {
        let allLabels = await getAllProjectLabels(all);

        if (colorFilter) {
          allLabels = allLabels.filter(l => l.color.toUpperCase() === colorFilter.toUpperCase());
        }

        if (format === 'json') {
          console.log(JSON.stringify(allLabels, null, 2));
          process.exit(0);
        } else if (format === 'tsv') {
          console.log('ID\\tName\\tColor\\tDescription');
          for (const label of allLabels) {
            console.log(`${label.id}\\t${label.name}\\t${label.color}\\t${label.description || ''}`);
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
  }, [colorFilter, format, all]);

  if (loading) {
    return <Text>Loading project labels...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (labels.length === 0) {
    return <Text color="yellow">No project labels found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>Project Labels ({labels.length})</Text>
      <Text> </Text>

      {labels.map((label, index) => (
        <Box key={label.id} flexDirection="column">
          <Text>
            {formatColorPreview(label.color, '●')} <Text bold>{label.name}</Text>
          </Text>
          <Text dimColor>  ID: {label.id} | Color: {label.color}</Text>
          {label.description && <Text dimColor>  {label.description}</Text>}
          {index < labels.length - 1 && <Text> </Text>}
        </Box>
      ))}
    </Box>
  );
}

export function listProjectLabels(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List project labels')
    .option('--color <hex>', 'Filter by color (hex code)')
    .option('-f, --format <type>', 'Output format (json|tsv)', 'default')
    .option('-a, --all', 'Include all labels (including archived)')
    .action(async (options) => {
      render(
        <ProjectLabelsList
          colorFilter={options.color}
          format={options.format}
          all={options.all}
        />
      );
    });
}
