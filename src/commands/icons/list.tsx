import React from 'react';
import { render, Text, Box } from 'ink';
import { Command } from 'commander';
import { CURATED_ICONS, getIconsByCategory, searchIcons } from '../../lib/icons.js';

interface IconsListProps {
  search?: string;
  category?: string;
  format?: string;
}

function IconsList({ search, category, format }: IconsListProps) {
  const icons = search ? searchIcons(search) : category ? getIconsByCategory(category) : CURATED_ICONS;

  if (icons.length === 0) {
    return <Text color="yellow">No icons found</Text>;
  }

  const categories = new Map<string, typeof icons>();
  for (const icon of icons) {
    const cat = icon.category || 'other';
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(icon);
  }

  return (
    <Box flexDirection="column">
      <Text bold>Curated Icons ({icons.length})</Text>
      <Text> </Text>

      {Array.from(categories.entries()).map(([cat, catIcons]) => (
        <Box key={cat} flexDirection="column">
          <Text bold color="cyan">Category: {cat}</Text>
          {catIcons.map(icon => (
            <Text key={icon.name}>
              {icon.emoji} <Text bold>{icon.name.padEnd(20)}</Text> <Text dimColor>{icon.unicode || ''}</Text>
            </Text>
          ))}
          <Text> </Text>
        </Box>
      ))}
    </Box>
  );
}

export function listIcons(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List available icons')
    .option('--search <query>', 'Search icons by name or category')
    .option('--category <category>', 'Filter by category')
    .option('-f, --format <type>', 'Output format (json|tsv|grid)', 'grid')
    .action(async (options) => {
      // Handle JSON/TSV output before rendering React component
      if (options.format === 'json' || options.format === 'tsv') {
        const icons = options.search ? searchIcons(options.search) : options.category ? getIconsByCategory(options.category) : CURATED_ICONS;

        if (options.format === 'json') {
          console.log(JSON.stringify(icons, null, 2));
        } else if (options.format === 'tsv') {
          console.log('Name\tEmoji\tUnicode\tCategory');
          for (const icon of icons) {
            console.log(`${icon.name}\t${icon.emoji}\t${icon.unicode || ''}\t${icon.category || ''}`);
          }
        }
        process.exit(0);
      }

      // Render interactive UI for grid format
      render(<IconsList search={options.search} category={options.category} format={options.format} />);
    });
}
