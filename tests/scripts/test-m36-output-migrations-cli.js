#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-output-migrations-'));
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

const commands = [
  ['issue', 'create', '--title', 'Probe', '--team', 'team-probe'],
  ['issue', 'update', 'ENG-1', '--title', 'Probe'],
  ['issue', 'view', 'ENG-1'],
  ['project', 'create', '--title', 'Probe', '--team', 'team-probe'],
  ['project', 'update', 'project-probe', '--name', 'Probe'],
  ['project', 'view', 'project-probe'],
  ['project', 'dependencies', 'list', 'project-probe'],
];

try {
  for (const command of commands) {
    const help = run([
      ...command.slice(0, command[0] === 'project' && command[1] === 'dependencies' ? 3 : 2),
      '--help',
    ]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /-o, --output <table\|json>/);
    assert.match(help.stdout, /--json/);

    const shorthand = run([...command, '--json']);
    const canonical = run([...command, '--output', 'json']);
    assert.equal(canonical.status, shorthand.status, command.join(' '));
    assert.equal(canonical.stdout, shorthand.stdout, command.join(' '));
    assert.equal(canonical.stderr, shorthand.stderr, command.join(' '));

    const redundant = run([...command, '--output', 'json', '--json']);
    assert.equal(redundant.status, shorthand.status, command.join(' '));
    assert.equal(redundant.stdout, shorthand.stdout, command.join(' '));
    assert.equal(redundant.stderr, shorthand.stderr, command.join(' '));
  }

  process.stdout.write('M36 command output migration built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
