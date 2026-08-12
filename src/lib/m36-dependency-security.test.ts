import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface LockPackage {
  dependencies?: Record<string, string>;
  dev?: boolean;
  version?: string;
}

interface PackageLock {
  packages: Record<string, LockPackage>;
}

function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(version);
  if (!match) throw new Error(`Unsupported ws version in package-lock.json: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isVulnerableMajor8(version: string): boolean {
  const [major, minor] = parseVersion(version);
  return major === 8 && minor < 21;
}

describe('M36 production dependency security regressions', () => {
  it('keeps the current Ink to ws path outside GHSA-96hv-2xvq-fx4p vulnerable v8 releases', () => {
    const lock = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8')
    ) as PackageLock;
    const ink = lock.packages['node_modules/ink'];
    const productionWs = Object.entries(lock.packages).filter(
      ([path, entry]) =>
        (path === 'node_modules/ws' || path.endsWith('/node_modules/ws')) &&
        entry.dev !== true
    );

    expect(ink?.dev).not.toBe(true);
    expect(ink?.dependencies?.ws).toBeDefined();
    expect(productionWs.length).toBeGreaterThan(0);

    for (const [path, entry] of productionWs) {
      expect(entry.version, `${path} must have a version`).toBeDefined();
      expect(
        isVulnerableMajor8(entry.version!),
        `${path}@${entry.version} is vulnerable to GHSA-96hv-2xvq-fx4p`
      ).toBe(false);
    }
  });
});
