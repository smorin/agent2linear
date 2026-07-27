#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-diagnostics-cli-'));
const home = join(root, 'home');
const xdg = join(root, 'xdg');
const project = join(root, 'project');
const secret = 'opaque-diagnostic-credential';

if (!existsSync(cli)) {
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);
}
mkdirSync(home, { recursive: true });
mkdirSync(project, { recursive: true });

function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: join(root, 'state'),
      AGENT2LINEAR_WORKSPACE: '',
      LINEAR_API_KEY: secret,
      NODE_NO_WARNINGS: '1',
      ...extraEnv,
    },
  });
}

try {
  const help = run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /-v, --verbose/);
  assert.match(help.stdout, /repeatable: -vv, -vvv/);
  assert.match(help.stdout, /--debug/);
  assert.equal(help.stderr, '');

  const base = run(['-C', project, 'workspace', 'current', '--json']);
  assert.equal(base.status, 0, base.stderr);
  JSON.parse(base.stdout);
  assert.equal(base.stderr, '');
  assert.doesNotMatch(base.stdout, new RegExp(secret));

  const variants = new Map();
  for (const [name, flags] of [
    ['v', ['-v']],
    ['vv', ['-vv']],
    ['vvv', ['-vvv']],
    ['split-vvv', ['-v', '-v', '-v']],
    ['debug', ['--debug']],
  ]) {
    const result = run([...flags, '-C', project, 'workspace', 'current', '--json']);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.equal(result.stdout, base.stdout, name);
    JSON.parse(result.stdout);
    assert.match(result.stderr, /\[verbose\] command=workspace current/);
    assert.doesNotMatch(result.stderr, new RegExp(secret));
    variants.set(name, result.stderr);
  }
  assert.doesNotMatch(variants.get('v'), /\[debug\]/);
  assert.doesNotMatch(variants.get('vv'), /\[debug\]/);
  assert.match(variants.get('vvv'), /\[debug\] invocation resolution/);
  assert.match(variants.get('debug'), /\[debug\] invocation resolution/);
  assert.equal(variants.get('vvv'), variants.get('split-vvv'));

  for (const flags of [
    ['--quiet', '-vvv'],
    ['-vvv', '--quiet'],
  ]) {
    const result = run([...flags, '-C', project, 'workspace', 'current', '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, base.stdout);
    assert.equal(result.stderr, '');
  }

  for (const flags of [
    ['--quiet', '--debug'],
    ['--debug', '--quiet'],
  ]) {
    const result = run([...flags, '-C', project, 'workspace', 'current', '--json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, base.stdout);
    assert.match(result.stderr, /\[debug\] invocation resolution/);
  }

  const missing = join(project, 'lin_api_path_secret.json');
  const humanFailure = run(['--debug', '--config', missing, 'workspace', 'current']);
  assert.equal(humanFailure.status, 1, humanFailure.stderr);
  assert.equal(humanFailure.stdout, '');
  assert.match(humanFailure.stderr, /debug: agent2linear/);
  assert.match(humanFailure.stderr, /\[REDACTED\]/);
  assert.doesNotMatch(humanFailure.stderr, /lin_api_path_secret/);

  const jsonFailure = run([
    '--debug',
    '--config',
    missing,
    'workspace',
    'current',
    '--json',
  ]);
  assert.equal(jsonFailure.status, 1, jsonFailure.stderr);
  assert.equal(jsonFailure.stdout, '');
  const lines = jsonFailure.stderr.trimEnd().split('\n');
  assert.equal(lines.length, 1);
  const parsedError = JSON.parse(lines[0]);
  assert.equal(parsedError.error.code, 'runtime');
  assert.equal(parsedError.error.debug.context.cli, 'agent2linear');
  assert.doesNotMatch(jsonFailure.stderr, /lin_api_path_secret/);

  const verboseJsonFailure = run([
    '-v',
    '--config',
    missing,
    'workspace',
    'current',
    '--json',
  ]);
  assert.equal(verboseJsonFailure.status, 1, verboseJsonFailure.stderr);
  assert.equal(verboseJsonFailure.stdout, '');
  const verboseError = JSON.parse(verboseJsonFailure.stderr);
  assert.deepEqual(verboseError.error.diagnostics, [
    '[verbose] command=workspace current',
  ]);

  const legacyEnv = run(['-C', project, 'workspace', 'current', '--json'], {
    DEBUG: '1',
    LINEAR_CREATE_DEBUG_FILTERS: '1',
  });
  assert.equal(legacyEnv.status, 0, legacyEnv.stderr);
  assert.equal(legacyEnv.stdout, base.stdout);
  assert.equal(legacyEnv.stderr, '');

  process.stdout.write('M36 diagnostics built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
