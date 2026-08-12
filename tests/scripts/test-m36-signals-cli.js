#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-signals-cli-'));

if (!existsSync(cli)) {
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);
}

function childEnv() {
  return {
    ...process.env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'xdg'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_STATE_HOME: join(root, 'state'),
    AGENT2LINEAR_WORKSPACE: '',
    LINEAR_API_KEY: '',
    NODE_NO_WARNINGS: '1',
  };
}

function collect(child) {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });
  return {
    output: () => ({ stdout, stderr }),
    closed: new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    }),
  };
}

async function verifySignal(signal, exitCode) {
  const child = spawn(
    process.execPath,
    [cli, '-v', '--api-key-file', '-', 'workspace', 'current', '--json'],
    { cwd: repo, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] }
  );
  const result = collect(child);
  child.stdin.on('error', error => {
    if (error.code !== 'EPIPE') throw error;
  });

  const acceptedWithoutBackpressure = child.stdin.write(Buffer.alloc(4 * 1024 * 1024, 120));
  assert.equal(acceptedWithoutBackpressure, false, 'stdin readiness fixture needs backpressure');
  await Promise.race([
    once(child.stdin, 'drain'),
    result.closed.then(closed => {
      throw new Error(`${signal} fixture exited before reading stdin: ${JSON.stringify(closed)}`);
    }),
  ]);
  assert.equal(child.exitCode, null, `${signal} fixture exited before it could be signalled`);
  assert.equal(child.kill(signal), true, `failed to send ${signal}`);

  const closed = await result.closed;
  const output = result.output();
  assert.deepEqual(closed, { code: exitCode, signal: null }, output.stderr);
  assert.equal(output.stdout, '');
  assert.match(output.stderr, /\[verbose\] command=workspace current/);
  assert.doesNotMatch(output.stderr, /(?:stack trace|node:events|Unhandled 'error')/i);
}

async function verifyClosedStdout() {
  const child = spawn(process.execPath, [cli], {
    cwd: repo,
    env: childEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });
  child.stdout.destroy();

  const closed = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  assert.deepEqual(closed, { code: 0, signal: null }, stderr);
  assert.equal(stderr, '');
}

try {
  await verifySignal('SIGINT', 130);
  await verifySignal('SIGTERM', 143);
  await verifyClosedStdout();
  process.stdout.write('M36 signal built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
