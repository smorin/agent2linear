import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readText = (path: string): string => readFileSync(resolve(path), 'utf8');
const readJson = (path: string): Record<string, unknown> => JSON.parse(readText(path));

describe('[RLS-VER-ALIGN] coordinated v1 metadata', () => {
  it('aligns package, lockfile, CLI, and supported Node versions', () => {
    const packageJson = readJson('package.json') as {
      engines?: { node?: string };
      version?: string;
    };
    const packageLock = readJson('package-lock.json') as {
      packages?: { ''?: { engines?: { node?: string }; version?: string } };
      version?: string;
    };

    expect(packageJson.version).toBe('1.0.0');
    expect(packageLock.version).toBe('1.0.0');
    expect(packageLock.packages?.['']?.version).toBe('1.0.0');
    expect(readText('src/lib/version.ts')).toContain("CLI_VERSION = '1.0.0'");
    expect(packageJson.engines?.node).toBe('>=22');
    expect(packageLock.packages?.['']?.engines?.node).toBe('>=22');
  });

  it('tests Node 22 and 24 and runs release/live verification on Node 24', () => {
    expect(readText('.github/workflows/ci.yml')).toContain('node-version: [22.x, 24.x]');
    expect(readText('.github/workflows/release.yml')).toContain('node-version: 24.x');
    expect(readText('.github/workflows/live.yml')).toContain('node-version: 24.x');
  });
});
