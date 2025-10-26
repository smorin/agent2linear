import { Command } from 'commander';
import { getColorUsage, findColorByHex, formatColorPreview } from '../../lib/colors.js';

export function viewColor(program: Command) {
  program
    .command('view <hex>')
    .description('View color details and usage')
    .action(async (hex: string) => {
      try {
        const normalizedHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
        const curatedColor = findColorByHex(normalizedHex);

        console.log('');
        console.log(`${formatColorPreview(normalizedHex)} Color: ${normalizedHex}`);
        if (curatedColor?.name) {
          console.log(`   Name: ${curatedColor.name}`);
        }

        console.log('');
        console.log('🔍 Fetching usage statistics...');
        const usage = await getColorUsage(normalizedHex);

        console.log('');
        console.log('Usage in workspace:');
        console.log(`   Issue Labels: ${usage.breakdown.issueLabels}`);
        console.log(`   Project Labels: ${usage.breakdown.projectLabels}`);
        console.log(`   Workflow States: ${usage.breakdown.workflowStates}`);
        console.log(`   Project Statuses: ${usage.breakdown.projectStatuses}`);
        console.log(`   Total: ${usage.totalUsage}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
