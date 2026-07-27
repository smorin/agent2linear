#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');

if (!existsSync(cli)) {
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);
}

for (const flag of ['--version', '-V']) {
  const result = spawnSync(process.execPath, [cli, flag], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'agent2linear 1.0.0\n');
  assert.equal(result.stderr, '');
}

process.stdout.write('M36 version built-CLI verification passed\n');
