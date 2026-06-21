import './lib/suppress-warnings.js'; // must precede deps that pull in `punycode`

import { cli } from './cli.js';

cli.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : 'An unexpected error occurred');
  process.exit(1);
});
