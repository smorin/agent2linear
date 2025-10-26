import { Command } from 'commander';
import { findIconByName, findIconByEmoji } from '../../lib/icons.js';

export function viewIcon(program: Command) {
  program
    .command('view <name>')
    .description('View icon details')
    .action(async (name: string) => {
      try {
        const icon = findIconByName(name) || findIconByEmoji(name);

        if (!icon) {
          console.error(`❌ Icon not found: ${name}`);
          process.exit(1);
        }

        console.log('');
        console.log(`${icon.emoji} Icon: ${icon.name}`);
        if (icon.unicode) console.log(`   Unicode: ${icon.unicode}`);
        if (icon.category) console.log(`   Category: ${icon.category}`);
        console.log('');
        console.log('💡 Use this icon:');
        console.log(`   In labels: --icon "${icon.emoji}"`);
        console.log(`   Copy emoji: ${icon.emoji}`);
        console.log('');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
