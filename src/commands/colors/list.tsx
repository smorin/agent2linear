import React from 'react';
import { render, Text, Box } from 'ink';
import { Command } from 'commander';
import { CURATED_COLORS, extractColorsFromEntities, formatColorPreview } from '../../lib/colors.js';

interface ColorsListProps {
  palette: string;
  search?: string;
  format?: string;
}

function ColorsList({ palette, search, format }: ColorsListProps) {
  const [colors, setColors] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchColors() {
      try {
        let result = palette === 'workspace' ? await extractColorsFromEntities() : CURATED_COLORS;

        if (search) {
          result = result.filter(c => c.hex.toLowerCase().includes(search.toLowerCase()) || c.name?.toLowerCase().includes(search.toLowerCase()));
        }

        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
          process.exit(0);
        }

        if (format === 'tsv') {
          console.log('Hex\tName\tUsage');
          for (const color of result) {
            console.log(`${color.hex}\t${color.name || ''}\t${color.usageCount || ''}`);
          }
          process.exit(0);
        }

        setColors(result);
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setLoading(false);
      }
    }

    fetchColors();
  }, [palette, search, format]);

  if (loading) {
    return <Text>Loading colors...</Text>;
  }

  if (colors.length === 0) {
    return <Text color="yellow">No colors found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>{palette === 'workspace' ? 'Workspace Colors' : 'Curated Linear Colors'} ({colors.length})</Text>
      <Text> </Text>

      {colors.map(color => (
        <Text key={color.hex}>
          {formatColorPreview(color.hex)} <Text bold>{color.hex.padEnd(10)}</Text> {color.name || ''} {color.usageCount ? `(${color.usageCount} uses)` : ''}
        </Text>
      ))}
    </Box>
  );
}

export function listColors(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List colors')
    .option('--palette <type>', 'Palette source (default|workspace)', 'default')
    .option('--search <hex>', 'Search by hex code')
    .option('-f, --format <type>', 'Output format (json|tsv|grid)', 'grid')
    .action(async (options) => {
      render(<ColorsList palette={options.palette} search={options.search} format={options.format} />);
    });
}
