import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readText = (path: string): string => readFileSync(resolve(path), 'utf8');

const guardedLiveCommands = [
  'node dist/index.js whoami',
  'node .tmp/m36-live/test-label-lifecycle-live.js',
  'node tests/scripts/test-pagination-live.js',
  'node .tmp/m36-live/test-comments-live.js',
  'node .tmp/m36-live/test-m36-issue-automation-live.js',
];

describe('[RLS-CI-SINGLE-PUBLISH] v1 release policy', () => {
  it('publishes canonical repository metadata required by npm trusted publishing', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      bugs?: { url?: string };
      homepage?: string;
      repository?: { type?: string; url?: string };
    };

    expect(packageJson.repository).toMatchObject({
      type: 'git',
      url: 'git+https://github.com/smorinlabs/agent2linear.git',
    });
    expect(packageJson.homepage).toBe('https://github.com/smorinlabs/agent2linear#readme');
    expect(packageJson.bugs?.url).toBe(
      'https://github.com/smorinlabs/agent2linear/issues'
    );
  });

  it('[RLS-DOC-README][RLS-DOC-CHANGELOG][RLS-PKG-PACK] keeps packaged release docs timeless', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      files?: string[];
    };
    expect(packageJson.files).toEqual(expect.arrayContaining(['README.md', 'CHANGELOG.md']));

    const packagedReleaseDocs = [readText('README.md'), readText('CHANGELOG.md')].join('\n');
    expect(packagedReleaseDocs).not.toMatch(
      /documentation is staged|staged v1\.0\.0|not a published release|does not (?:claim|assert)|not certify a release artifact|not a publication claim|publication remain release gates|release is actually announced/i
    );
  });

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

  it('verifies the remote annotated tag outside the checkout-managed tag ref', () => {
    const release = readText('.github/workflows/release.yml');
    expect(release).toContain('RELEASE_TAG_REF="refs/release-tags/${GITHUB_REF_NAME}"');
    expect(release).toContain('"refs/tags/${GITHUB_REF_NAME}:${RELEASE_TAG_REF}"');
    expect(release).toContain(
      'test "$(git cat-file -t "${RELEASE_TAG_REF}")" = "tag"'
    );
    expect(release).toContain(
      'test "$(git rev-parse "${RELEASE_TAG_REF}^{}")" = "${GITHUB_SHA}"'
    );
  });

  it('keeps the ordinary live workflow exercising M36 automation', () => {
    const live = readText('.github/workflows/live.yml');
    expect(live).toContain('./node_modules/.bin/tsup --config tsup.live.config.ts');
    expect(live).toContain('node .tmp/m36-live/test-m36-issue-automation-live.js');
    expect(live).not.toContain('npx tsx');
    expect(readText('.github/workflows/release.yml')).not.toContain('npx tsx');
  });

  it('[RLS-BLK-LIVE-SUITE][RLS-CI-RELEASE-GATES] gates on the guarded current live suite', () => {
    for (const workflowPath of ['.github/workflows/live.yml', '.github/workflows/release.yml']) {
      const workflow = readText(workflowPath);
      for (const command of guardedLiveCommands) {
        expect(workflow, workflowPath).toContain(command);
      }
      expect(workflow, workflowPath).not.toContain('run-all-tests.sh');
    }
  });

  it('[RLS-BLK-LIVE-SUITE][RLS-CI-RELEASE-GATES] runs read-only pagination before mutating lifecycle checks', () => {
    for (const workflowPath of ['.github/workflows/live.yml', '.github/workflows/release.yml']) {
      const workflow = readText(workflowPath);
      const paginationIndex = workflow.indexOf('node tests/scripts/test-pagination-live.js');
      const lifecycleIndex = workflow.indexOf(
        'node .tmp/m36-live/test-label-lifecycle-live.js'
      );

      expect(paginationIndex, workflowPath).toBeGreaterThan(-1);
      expect(lifecycleIndex, workflowPath).toBeGreaterThan(paginationIndex);
    }
  });
});
