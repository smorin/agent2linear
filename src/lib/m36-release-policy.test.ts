import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readText = (path: string): string => readFileSync(resolve(path), 'utf8');

describe('[RLS-CI-SINGLE-PUBLISH] v1 release policy', () => {
  it('removes local np publishing and leaves one tag-only publisher', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.release).toBeUndefined();
    expect(packageJson.devDependencies?.np).toBeUndefined();

    const workflowFiles = readdirSync(resolve('.github/workflows')).filter(file =>
      file.endsWith('.yml')
    );
    const publishers = workflowFiles.flatMap(file => {
      const workflow = readText(`.github/workflows/${file}`);
      return workflow.includes('npm publish') ? [file] : [];
    });
    expect(publishers).toEqual(['release.yml']);
  });

  it('requires tag/version parity, trusted publishing, and same-SHA verification', () => {
    const release = readText('.github/workflows/release.yml');
    expect(release).toContain("tags: ['v*']");
    expect(release).toContain('id-token: write');
    expect(release).toContain('checks: read');
    expect(release).toContain('GITHUB_REF_NAME');
    expect(release).toContain('git cat-file -t');
    expect(release).toContain('git merge-base --is-ancestor');
    expect(release).toContain('check (22.x)');
    expect(release).toContain('check (24.x)');
    expect(release).toContain('npm audit --omit=dev --audit-level=high');
    expect(release).toContain('node .tmp/m36-live/test-m36-issue-automation-live.js');
    expect(release).toContain('npm publish --provenance --access public');
    expect(release).toContain('needs: verify');
    expect(release).toContain('publish:\n    needs: verify\n    runs-on: ubuntu-latest');
    expect(release).toContain('major < 11');
    expect(release).toContain('minor < 5');
    expect(release).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
  });

  it('keeps the ordinary live workflow exercising M36 automation', () => {
    const live = readText('.github/workflows/live.yml');
    expect(live).toContain('./node_modules/.bin/tsup --config tsup.live.config.ts');
    expect(live).toContain('node .tmp/m36-live/test-m36-issue-automation-live.js');
    expect(live).not.toContain('npx tsx');
    expect(readText('.github/workflows/release.yml')).not.toContain('npx tsx');
  });
});
