import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('M36 diagnostics environment contract', () => {
  it('does not retain undocumented environment debug switches in API modules', () => {
    for (const path of [
      new URL('./api/issues.ts', import.meta.url),
      new URL('./api/projects.ts', import.meta.url),
      new URL('./api/templates.ts', import.meta.url),
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toContain('process.env.DEBUG');
      expect(source).not.toContain('LINEAR_CREATE_DEBUG_FILTERS');
    }
  });
});
