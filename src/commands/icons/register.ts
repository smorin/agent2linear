import { Command } from 'commander';

import { extractIcons } from './extract.js';
import { listIcons } from './list.js';
import { viewIcon } from './view.js';

export function registerIconsCommands(cli: Command): void {
  const icons = cli
    .command('icons')
    .description('Browse and manage icons');

  listIcons(icons);
  viewIcon(icons);
  extractIcons(icons);
}
