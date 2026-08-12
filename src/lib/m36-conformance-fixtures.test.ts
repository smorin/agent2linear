import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const permanentFixtures = [
  'tests/scripts/test-m36-api-key-cli.js',
  'tests/scripts/test-m36-config-cli.js',
  'tests/scripts/test-m36-diagnostics-cli.js',
  'tests/scripts/test-m36-output-cli.js',
  'tests/scripts/test-m36-output-migrations-cli.js',
  'tests/scripts/test-m36-parser-no-input-cli.js',
  'tests/scripts/test-m36-signals-cli.js',
  'tests/scripts/test-m36-tsv-cli.js',
  'tests/scripts/test-m36-version-cli.js',
] as const;

describe('[RLS-STD-FIXTURES] permanent built-CLI conformance evidence', () => {
  const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');

  it.each(permanentFixtures)('runs %s in ordinary CI', fixture => {
    expect(workflow).toContain(`node ${fixture}`);
  });
});
