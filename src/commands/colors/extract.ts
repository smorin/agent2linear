import { Command } from 'commander';
import { extractColorsFromEntities, formatColorPreview } from '../../lib/colors.js';

export function extractColors(program: Command) {
  program
    .command('extract')
    .description('Extract colors from workspace entities')
    .option('--type <type>', 'Entity type (labels|workflow-states|project-statuses)')
    .option('-f, --format <format>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      try {
        console.log('🔍 Extracting colors from workspace...');
        const colors = await extractColorsFromEntities(options.type as any);
        console.log(`   Found ${colors.length} unique colors`);
        console.log('');

        if (options.format === 'json') {
          console.log(JSON.stringify(colors, null, 2));
          return;
        }

        if (options.format === 'tsv') {
          console.log('Hex\tUsage');
          for (const color of colors) {
            console.log(`${color.hex}\t${color.usageCount || 0}`);
          }
          return;
        }

        console.log('Hex       Usage');
        console.log('────────  ─────');
        for (const color of colors) {
          console.log(`${formatColorPreview(color.hex)} ${color.hex.padEnd(10)} ${color.usageCount || 0}`);
        }
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
