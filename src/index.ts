import './lib/suppress-warnings.js'; // must precede deps that pull in `punycode`

import { cli } from './cli.js';
import { inferErrorOutputMode, normalizeCliError, renderCliError } from './lib/cli-error.js';

cli.parseAsync(process.argv).catch(error => {
  if (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')
  ) {
    process.exitCode = 0;
    return;
  }

  const normalized = normalizeCliError(error);
  renderCliError(normalized, inferErrorOutputMode(process.argv.slice(2)));
  process.exitCode = normalized.exitCode;
});
