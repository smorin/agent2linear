#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-output-cli-'));
const home = join(root, 'home');
const xdg = join(root, 'xdg');

if (!existsSync(cli)) throw new Error('Build dist/index.js before running this script');
mkdirSync(home, { recursive: true });

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: join(root, 'state'),
      AGENT2LINEAR_WORKSPACE: '',
      LINEAR_API_KEY: '',
      NODE_NO_WARNINGS: '1',
    },
  });
}

function assertJsonError(result, status, code) {
  assert.equal(result.status, status, result.stderr);
  assert.equal(result.stdout, '');
  const envelope = JSON.parse(result.stderr);
  assert.deepEqual(Object.keys(envelope), ['error']);
  assert.deepEqual(Object.keys(envelope.error).sort(), ['code', 'message']);
  assert.equal(envelope.error.code, code);
  assert.equal(typeof envelope.error.message, 'string');
  assert.notEqual(envelope.error.message.length, 0);
}

try {
  const json = run(['cursor-history', 'list', '--json']);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(json.stderr, '');
  const jsonValue = JSON.parse(json.stdout);

  const equivalent = run(['cursor-history', 'list', '--output', 'json', '--json']);
  assert.equal(equivalent.status, 0, equivalent.stderr);
  assert.equal(equivalent.stderr, '');
  assert.deepEqual(JSON.parse(equivalent.stdout), jsonValue);

  for (const selectors of [
    ['--json', '--output', 'json'],
    ['--json', '-o', 'json'],
    ['--json', '-ojson'],
  ]) {
    const shorthandOrder = run(['cursor-history', 'list', ...selectors]);
    assert.equal(shorthandOrder.status, 0, shorthandOrder.stderr);
    assert.equal(shorthandOrder.stderr, '');
    assert.deepEqual(JSON.parse(shorthandOrder.stdout), jsonValue);
  }

  // Comment-list declares Commander's default output as `table`. This proves
  // the root hook distinguishes that implicit default from an explicit
  // conflicting selector and lets --json reach the action.
  const defaulted = run(['issue', 'comment', 'list', 'ENG-1', '--json']);
  assert.equal(defaulted.status, 4, defaulted.stderr);
  assert.equal(defaulted.stdout, '');
  const defaultedError = JSON.parse(defaulted.stderr);
  assert.equal(defaultedError.error.code, 'auth');

  const defaultedEquivalent = run([
    'issue',
    'comment',
    'list',
    'ENG-1',
    '--output',
    'json',
    '--json',
  ]);
  assert.equal(defaultedEquivalent.status, 4, defaultedEquivalent.stderr);
  assert.equal(defaultedEquivalent.stdout, '');
  assert.deepEqual(JSON.parse(defaultedEquivalent.stderr), defaultedError);

  const quiet = run(['--quiet', 'cursor-history', 'list', '--json']);
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.equal(quiet.stderr, '');
  assert.deepEqual(JSON.parse(quiet.stdout), jsonValue);

  const missingKey = join(root, 'missing-key.txt');
  const conflict = run([
    '--api-key-file',
    missingKey,
    'cursor-history',
    'list',
    '--json',
    '--output',
    'table',
  ]);
  assert.equal(conflict.status, 2, conflict.stderr);
  assert.equal(conflict.stdout, '');
  assert.match(conflict.stderr, /--json cannot be combined with explicit --output 'table'/);
  assert.doesNotMatch(conflict.stderr, /missing-key\.txt/);

  for (const selectors of [
    ['--output', 'table', '--json'],
    ['--json', '--output=table'],
    ['--json', '-o', 'table'],
    ['--json', '-otable'],
  ]) {
    const orderedConflict = run([
      '--api-key-file',
      missingKey,
      'cursor-history',
      'list',
      ...selectors,
    ]);
    assert.equal(orderedConflict.status, 2, orderedConflict.stderr);
    assert.equal(orderedConflict.stdout, '');
    assert.match(
      orderedConflict.stderr,
      /--json cannot be combined with explicit --output 'table'/
    );
    assert.doesNotMatch(orderedConflict.stderr, /missing-key\.txt/);
  }

  // RLS-OUT-JSON-ERROR: parser failures are one JSON envelope, with no
  // Commander usage/help text before or after it.
  for (const selectors of [['--json'], ['-o', 'json']]) {
    assertJsonError(run(['cursor-history', 'view', ...selectors]), 2, 'usage');
    assertJsonError(
      run(['cursor-history', 'list', '--not-a-real-option', ...selectors]),
      2,
      'usage'
    );
  }

  // RLS-OUT-JSON-CLEAN/ERROR: mode combinations which otherwise enter a
  // human/browser/interactive path are rejected before I/O.
  assertJsonError(run(['issue', 'list', '--web', '--json']), 2, 'usage');
  assertJsonError(run(['project', 'list', '--interactive', '--json']), 2, 'usage');
  assertJsonError(
    run(['issue', 'create', '--title', 'Test', '--team', 'ENG', '--web', '--json']),
    2,
    'usage'
  );
  assertJsonError(
    run(['project', 'create', '--title', 'Test project', '--web', '--json']),
    2,
    'usage'
  );
  assertJsonError(run(['project', 'create', '--interactive', '--json']), 2, 'usage');
  assertJsonError(
    run([
      'issue',
      'update',
      'ENG-1',
      '--title',
      'Updated',
      '--bulk',
      'ENG-2',
      '--dry-run',
      '--json',
    ]),
    2,
    'usage'
  );

  // Legacy handler preflight failures must reach the shared renderer instead
  // of printing prose and calling process.exit(1).
  assertJsonError(
    run(['issue', 'update', 'ENG-1', '--labels', 'one', '--add-labels', 'two', '--json']),
    2,
    'usage'
  );
  assertJsonError(run(['issue', 'view', 'ENG-1', '--web', '--json']), 2, 'usage');
  assertJsonError(
    run([
      'issue',
      'create',
      '--title',
      'Test',
      '--team',
      'ENG',
      '--description-file',
      join(root, 'missing-issue.md'),
      '--json',
    ]),
    1,
    'runtime'
  );
  assertJsonError(
    run([
      'project',
      'create',
      '--title',
      'Test project',
      '--content-file',
      join(root, 'missing-project.md'),
      '--json',
    ]),
    1,
    'runtime'
  );
  assertJsonError(
    run([
      'issue',
      'update',
      '11111111-1111-4111-8111-111111111111',
      '--title',
      'Updated',
      '--json',
    ]),
    4,
    'auth'
  );
  assertJsonError(
    run(['project', 'update', 'missing-project', '--name', 'Updated', '--json']),
    4,
    'auth'
  );
  assertJsonError(
    run(['-C', root, 'issue-labels', 'create', '--name', 'Test', '--json']),
    4,
    'auth'
  );

  process.stdout.write('M36 shared output built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
