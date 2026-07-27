#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const preload = join(repo, 'tests/fixtures/m36-linear-list-fetch-stub.mjs');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-tsv-cli-'));
const home = join(root, 'home');

if (!existsSync(cli)) throw new Error('Build dist/index.js before running this script');
mkdirSync(home, { recursive: true });

function run(args) {
  return spawnSync(process.execPath, ['--import', preload, cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: join(root, 'state'),
      AGENT2LINEAR_WORKSPACE: '',
      LINEAR_API_KEY: 'lin_api_m36_fixture',
      NODE_NO_WARNINGS: '1',
    },
  });
}

function parseTsv(result, expectedColumns) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /\r/);
  const output = result.stdout.endsWith('\n') ? result.stdout.slice(0, -1) : result.stdout;
  const lines = output.split('\n');
  assert.equal(lines.length, 2, result.stdout);
  const rows = lines.map(line => line.split('\t'));
  for (const row of rows) assert.equal(row.length, expectedColumns, result.stdout);
  return rows;
}

try {
  const issueBase = ['issue', 'list', '--all-assignees', '--no-cursor-history'];
  const issueStandard = parseTsv(run([...issueBase, '--output', 'tsv', '--desc-full']), 8);
  assert.deepEqual(issueStandard[1], [
    'ENG 101',
    'Title row',
    'In Progress',
    '2',
    'user @example.com',
    'E NG',
    'https://linear.app/issue /ENG-101',
    'first second third fourth',
  ]);

  const issueCustom = parseTsv(
    run([
      ...issueBase,
      '--output',
      'tsv',
      '--columns',
      'id,identifier,title,state,assignee,team,url,description,dueDate',
    ]),
    9
  );
  assert.deepEqual(issueCustom[1], [
    'issue 1',
    'ENG 101',
    'Title row',
    'In Progress',
    'User Name',
    'E NG',
    'https://linear.app/issue /ENG-101',
    'first second third fourth',
    '2026-08-01 ',
  ]);

  const projectBase = [
    'project',
    'list',
    '--all-leads',
    '--all-teams',
    '--all-initiatives',
    '--no-cursor-history',
  ];
  const projectStandard = parseTsv(run([...projectBase, '--output', 'tsv', '--desc-full']), 6);
  assert.deepEqual(projectStandard[1], [
    'project 1',
    'Project one',
    'fallback state',
    'Platform Team',
    'Lead Name',
    'first second third fourth',
  ]);

  const projectCustom = parseTsv(
    run([
      ...projectBase,
      '--output',
      'tsv',
      '--columns',
      'id,name,status,team,lead,description,url',
    ]),
    7
  );
  assert.deepEqual(projectCustom[1], [
    'project 1',
    'Project one',
    'fallback state',
    'Platform Team',
    'Lead Name',
    'first second third fourth',
    'https://linear.app/project /project-1',
  ]);

  process.stdout.write('M36 built-CLI TSV machine-parser verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
