import { Command } from 'commander';

import { extractColors } from './extract.js';
import { listColors } from './list.js';
import { viewColor } from './view.js';

export function registerColorsCommands(cli: Command): void {
  const colors = cli
    .command('colors')
    .description('Browse and manage colors');

  listColors(colors);
  viewColor(colors);
  extractColors(colors);
}
