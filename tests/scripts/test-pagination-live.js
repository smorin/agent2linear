#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLiveOrganizationIdentity } from './live-identity.js';

const EXPECTED_ORGANIZATION = 'ConceptM';
const EXPECTED_ORGANIZATION_URL_KEY = 'conceptm';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const stateRoot = mkdtempSync(join(tmpdir(), 'a2l-m34-live-'));

if (!existsSync(cli)) {
  throw new Error('Build dist/index.js before running the M34 live pagination test');
}

function run(args) {
  const result = spawnSync(process.execPath, [cli, '-C', repo, ...args], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, XDG_STATE_HOME: stateRoot },
  });

  if (result.status !== 0) {
    throw new Error(
      [
        'Live command failed: a2l ' + args.join(' '),
        'exit: ' + String(result.status),
        result.signal ? 'signal: ' + result.signal : '',
        result.error ? 'spawn: ' + result.error.message : '',
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout;
}

function runJson(args) {
  return JSON.parse(run(args));
}

function verifyTraversal(resource, baseArgs, collectionKey) {
  const first = runJson([
    ...baseArgs,
    '--limit',
    '1',
    '--json',
    '--no-cursor-history',
  ]);
  if (
    first.pageInfo?.hasNextPage !== true ||
    typeof first.pageInfo.endCursor !== 'string' ||
    first.pageInfo.endCursor.length === 0
  ) {
    throw new Error(resource + ' does not have a live second page to verify');
  }

  const cursor = first.pageInfo.endCursor;
  const second = runJson([
    ...baseArgs,
    '--limit',
    '1',
    '--after',
    cursor,
    '--json',
    '--no-cursor-history',
  ]);
  const remaining = runJson([
    ...baseArgs,
    '--after',
    cursor,
    '--all',
    '--json',
    '--no-cursor-history',
  ]);

  const firstId = first[collectionKey]?.[0]?.id;
  const secondId = second[collectionKey]?.[0]?.id;
  if (!firstId || !secondId || firstId === secondId) {
    throw new Error(resource + ' raw cursor did not advance to a distinct record');
  }
  if (remaining[collectionKey]?.[0]?.id !== secondId) {
    throw new Error(resource + ' all-remaining traversal did not start at page two');
  }
  if (
    remaining.pageInfo?.fetchedAll !== true ||
    remaining.pageInfo?.hasNextPage !== false ||
    remaining.pageInfo?.endCursor !== null
  ) {
    throw new Error(resource + ' all-remaining traversal did not report exhaustion');
  }

  return {
    firstId,
    secondId,
    cursor,
    remainingCount: remaining[collectionKey].length,
    exhausted: true,
  };
}

try {
  const identity = run(['whoami']);
  assertLiveOrganizationIdentity(identity, {
    organizationName: EXPECTED_ORGANIZATION,
    organizationUrlKey: EXPECTED_ORGANIZATION_URL_KEY,
  });

  const issue = verifyTraversal('issue', ['issue', 'list'], 'issues');
  const project = verifyTraversal(
    'project',
    [
      'project',
      'list',
      '--all-leads',
      '--all-teams',
      '--all-initiatives',
    ],
    'projects'
  );

  process.stdout.write(
    JSON.stringify(
      {
        workspace: EXPECTED_ORGANIZATION,
        issue,
        project,
        remoteWrites: 0,
      },
      null,
      2
    ) + '\n'
  );
} finally {
  rmSync(stateRoot, { recursive: true, force: true });
}
