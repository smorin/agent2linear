#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-api-key-cli-'));
const home = join(root, 'home');
const xdg = join(root, 'xdg');
const project = join(root, 'project');
const keyFile = join(project, 'linear.key');
const malformedFile = join(project, 'malformed.key');
const emptyFile = join(project, 'empty.key');
const workspacesFile = join(xdg, 'agent2linear', 'workspaces.json');
const literalSecret = 'lin_api_literal_must_not_appear';
const configSecret = 'lin_api_config_must_not_appear';

if (!existsSync(cli)) {
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);
}

mkdirSync(dirname(workspacesFile), { recursive: true });
mkdirSync(project, { recursive: true });
mkdirSync(home, { recursive: true });
writeFileSync(keyFile, 'lin_api_from_file_xyz\n', 'utf8');
writeFileSync(malformedFile, 'lin_api_first\nlin_api_second\n', 'utf8');
writeFileSync(emptyFile, '\n', 'utf8');
writeFileSync(
  workspacesFile,
  JSON.stringify({ acme: { apiKey: 'lin_api_stored_abc' } }),
  'utf8'
);

function run(args, { input, extraEnv = {} } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: join(root, 'state'),
      AGENT2LINEAR_WORKSPACE: '',
      LINEAR_API_KEY: '',
      LINEAR_API_KEY_ACME: '',
      NODE_NO_WARNINGS: '1',
      ...extraEnv,
    },
  });
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const stats = statSync(path);
  if (stats.isFile()) return { type: 'file', body: readFileSync(path, 'utf8') };
  return {
    type: 'directory',
    entries: Object.fromEntries(
      readdirSync(path)
        .sort()
        .map(name => [name, snapshot(join(path, name))])
    ),
  };
}

function assertFailure(result, status, pattern, forbidden = []) {
  assert.equal(result.status, status, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, pattern);
  for (const value of forbidden) assert.doesNotMatch(result.stderr, new RegExp(value));
}

try {
  const help = run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--api-key-file <path>/);
  assert.doesNotMatch(help.stdout, /--api-key <key>/);

  assertFailure(
    run(['--api-key', literalSecret, 'workspace', 'current']),
    2,
    /Legacy --api-key <key> has been removed/,
    [literalSecret]
  );
  assertFailure(
    run(['--api-key', '-', 'workspace', 'current'], { input: 'lin_api_not_consumed\n' }),
    2,
    /use --api-key-file <path\|->/
  );
  for (const args of [
    ['--api-key', literalSecret, '--help'],
    ['--api-key', literalSecret, '--version'],
    ['--api-key', literalSecret, 'workspace', 'add'],
  ]) {
    assertFailure(run(args), 2, /Legacy --api-key <key> has been removed/, [literalSecret]);
  }

  const adHoc = run(['-C', project, '--api-key-file', './linear.key', 'workspace', 'current', '--json']);
  assert.equal(adHoc.status, 0, adHoc.stderr);
  assert.deepEqual(JSON.parse(adHoc.stdout), {
    name: null,
    source: 'flag',
    apiKey: 'lin_***xyz',
  });

  const selected = run([
    '--workspace',
    'acme',
    '--api-key-file',
    keyFile,
    'workspace',
    'current',
    '--json',
  ]);
  assert.equal(selected.status, 0, selected.stderr);
  assert.deepEqual(JSON.parse(selected.stdout), {
    name: 'acme',
    source: 'flag',
    apiKey: 'lin_***xyz',
  });

  const namedDoesNotBorrow = run(['--workspace', 'unknown', 'workspace', 'current', '--json'], {
    extraEnv: { LINEAR_API_KEY: 'lin_api_unnamed_only' },
  });
  assert.equal(namedDoesNotBorrow.status, 0, namedDoesNotBorrow.stderr);
  assert.deepEqual(JSON.parse(namedDoesNotBorrow.stdout), {
    name: 'unknown',
    source: 'flag',
    apiKey: null,
  });

  assertFailure(
    run(['--api-key-file', join(project, 'missing.key'), 'workspace', 'current']),
    1,
    /API key file is missing or unreadable/
  );
  assertFailure(
    run(['--api-key-file', malformedFile, 'workspace', 'current']),
    2,
    /exactly one nonempty logical line/,
    ['lin_api_first', 'lin_api_second']
  );
  assertFailure(
    run(['--api-key-file', emptyFile, 'workspace', 'current']),
    2,
    /exactly one nonempty logical line/
  );

  for (const command of [
    ['config', 'set', 'apiKey', configSecret],
    ['config', 'edit', '--key', 'apiKey', '--value', configSecret],
    ['config', 'set', 'apiKey', configSecret, '--help'],
    ['config', 'set', '--global', 'apiKey', configSecret, '--help'],
    ['cfg', 'set', '--project', 'apiKey', configSecret, '--version'],
    ['config', 'set', '--quiet', 'apiKey', configSecret, '--help'],
    ['config', 'set', '-C', project, 'apiKey', configSecret, '--help'],
    ['-qC', project, 'config', 'set', 'apiKey', configSecret, '--help'],
    ['config', '-vC', project, 'set', 'apiKey', configSecret, '--help'],
    ['config', 'set', '-qC', project, 'apiKey', configSecret, '--help'],
    ['config', 'edit', '--key', 'apiKey', '--value', configSecret, '--help'],
  ]) {
    const before = snapshot(root);
    const result = run(command);
    assertFailure(result, 2, /exposes an API key in argv/, [configSecret]);
    assert.deepEqual(snapshot(root), before, command.join(' '));
  }

  for (const command of [
    ['--config', 'config', 'issue', 'list', '--help'],
    [
      'issue',
      'create',
      '--title',
      'config',
      '--team',
      'set',
      '--assignee',
      'apiKey',
      '--description',
      'foo',
      '--help',
    ],
  ]) {
    const result = run(command);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /exposes an API key in argv/);
  }

  const stdinConflicts = [
    ['--api-key-file', '-', 'issue', 'comment', 'add', 'ENG-123', '--body-file', '-'],
    ['--api-key-file', '-', 'issue', 'create'],
    ['--api-key-file', '-', 'issue', 'create', '--title', ''],
    ['--api-key-file', '-', 'issue', 'update', 'ENG-123', '--description', '-'],
  ];
  for (const command of stdinConflicts) {
    const result = run(command, { input: 'lin_api_single_stream\n' });
    assertFailure(result, 2, /stdin cannot supply both --api-key-file - and/);
  }

  assertFailure(
    run(['--api-key-file', '-', 'issue-labels', 'retire', 'label-id'], {
      input: 'lin_api_single_stream\n',
    }),
    2,
    /stdin cannot supply both --api-key-file - and confirmation input/
  );
  assertFailure(
    run(['--api-key-file', '-', 'project', 'create', '--interactive'], {
      input: 'lin_api_single_stream\n',
    }),
    2,
    /requires interactive input from a TTY|stdin cannot supply both --api-key-file - and interactive input/
  );

  const destructiveDryRun = run(
    ['--api-key-file', '-', 'alias', 'clear', 'team', '--dry-run'],
    { input: 'lin_api_single_stream\n' }
  );
  assert.equal(destructiveDryRun.status, 0, destructiveDryRun.stderr);
  assert.doesNotMatch(destructiveDryRun.stderr, /confirmation input/);

  const added = run(['--api-key-file', keyFile, 'workspace', 'add', 'from-file']);
  assert.equal(added.status, 0, added.stderr);
  const stored = JSON.parse(readFileSync(workspacesFile, 'utf8'));
  assert.equal(stored['from-file'].apiKey, 'lin_api_from_file_xyz');

  process.stdout.write('M36 API-key built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
