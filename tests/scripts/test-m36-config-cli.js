#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repo, 'dist/index.js');
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-config-cli-'));
const home = join(root, 'home');
const xdg = join(root, 'xdg');
const project = join(root, 'project');
const globalConfig = join(xdg, 'agent2linear', 'config.json');
const projectConfig = join(project, '.agent2linear', 'config.json');
const explicitConfig = join(project, 'selected.json');
const displayConfig = join(project, 'display.json');
const routingConfig = join(project, 'routing.json');
const alphaRepo = join(root, 'alpha-repo');
const betaRepo = join(root, 'beta-repo');

if (!existsSync(cli))
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);

mkdirSync(dirname(globalConfig), { recursive: true });
mkdirSync(dirname(projectConfig), { recursive: true });
mkdirSync(home, { recursive: true });
const rebasedExplicitConfig = join(realpathSync(project), 'selected.json');
writeFileSync(globalConfig, JSON.stringify({ defaultTeam: 'global-team' }), 'utf8');
writeFileSync(projectConfig, JSON.stringify({ defaultTeam: 'project-team' }), 'utf8');
writeFileSync(
  explicitConfig,
  JSON.stringify({
    apiKey: 'file_prefix_file_suffix',
    defaultProfile: 'selected',
    defaultTeam: 'explicit-team',
    overrides: [{ id: 'only-once', when: {}, defaultProject: 'override-project' }],
    profiles: { selected: { workspace: 'selected-workspace' } },
  }),
  'utf8'
);
writeFileSync(displayConfig, JSON.stringify({ defaultProject: 'explicit-project' }), 'utf8');
writeFileSync(
  routingConfig,
  JSON.stringify({
    profiles: {
      alpha: {
        defaultTeam: 'alpha-team',
        match: { gitRemoteOwner: ['alpha-co'] },
        workspace: 'alpha',
      },
      beta: {
        defaultTeam: 'beta-team',
        match: { gitRemoteOwner: ['beta-co'] },
        workspace: 'beta',
      },
    },
  }),
  'utf8'
);

for (const [path, owner] of [
  [alphaRepo, 'alpha-co'],
  [betaRepo, 'beta-co'],
]) {
  mkdirSync(path, { recursive: true });
  const initialized = spawnSync('git', ['init', '--quiet', path], { encoding: 'utf8' });
  assert.equal(initialized.status, 0, initialized.stderr);
  const remote = spawnSync(
    'git',
    ['-C', path, 'remote', 'add', 'origin', `https://github.com/${owner}/example.git`],
    { encoding: 'utf8' }
  );
  assert.equal(remote.status, 0, remote.stderr);
}

function run(args, { cwd = repo, input, extraEnv = {} } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
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
      NODE_NO_WARNINGS: '1',
      ...extraEnv,
    },
  });
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const stats = statSync(path);
  if (stats.isFile())
    return { type: 'file', mode: stats.mode & 0o777, body: readFileSync(path, 'utf8') };
  return {
    type: 'directory',
    entries: Object.fromEntries(
      readdirSync(path)
        .sort()
        .map(name => [name, snapshot(join(path, name))])
    ),
  };
}

function assertSuccess(result, expected) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, expected);
  assert.equal(result.stderr, '');
}

try {
  assertSuccess(
    run(['-C', project, '--config', './selected.json', 'config', 'get', 'defaultTeam']),
    new RegExp(`defaultTeam: explicit-team \\(from explicit config ${rebasedExplicitConfig}\\)`)
  );

  assertSuccess(run(['--config', explicitConfig, 'profile', 'list']), /selected/);
  assertSuccess(run(['--config', explicitConfig, 'workspace', 'current']), /selected-workspace/);
  assertSuccess(
    run(['--config', explicitConfig, 'config', 'get', 'defaultProject']),
    new RegExp(`defaultProject: override-project \\(from explicit config ${explicitConfig} override only-once\\)`)
  );
  assertSuccess(
    run(['--config', routingConfig, 'config', 'get', 'defaultTeam', betaRepo], { cwd: alphaRepo }),
    /defaultTeam: beta-team \(from profile 'beta'\)/
  );

  const listedConfig = run(['--config', displayConfig, 'config', 'list']);
  assert.equal(listedConfig.status, 0, listedConfig.stderr);
  assert.match(listedConfig.stdout, new RegExp(`Explicit: ${displayConfig}`));
  assert.doesNotMatch(listedConfig.stdout, /Global:|Project:/);

  const explainedConfig = run(['--config', explicitConfig, 'config', 'explain', '--json']);
  assert.equal(explainedConfig.status, 0, explainedConfig.stderr);
  const explained = JSON.parse(explainedConfig.stdout);
  assert.deepEqual(explained.resolved.defaultTeam, {
    value: 'explicit-team',
    source: 'explicit',
    path: explicitConfig,
  });

  const overrideList = run(['--config', explicitConfig, 'config', 'override', 'list', '--json']);
  assert.equal(overrideList.status, 0, overrideList.stderr);
  assert.deepEqual(JSON.parse(overrideList.stdout), [
    {
      scope: 'global',
      label: 'only-once',
      index: 0,
      rule: { id: 'only-once', when: {}, defaultProject: 'override-project' },
      tag: 'catch-all',
    },
  ]);

  assertSuccess(
    run(['--config', explicitConfig, 'config', 'get', 'apiKey'], {
      extraEnv: { LINEAR_API_KEY: 'env_prefix_environment_suffix' },
    }),
    /env_\*\*\*fix \(from environment\)/
  );

  const strictFailures = [
    join(project, 'missing.json'),
    join(project, 'directory.json'),
    join(project, 'malformed.json'),
    join(project, 'unreadable.json'),
  ];
  mkdirSync(strictFailures[1]);
  writeFileSync(strictFailures[2], '{broken', 'utf8');
  writeFileSync(strictFailures[3], '{}', 'utf8');
  chmodSync(strictFailures[3], 0o000);

  for (const path of strictFailures) {
    const result = run(['--config', path, 'config', 'get', 'defaultTeam']);
    assert.equal(result.status, 1, `${path}\n${result.stderr}`);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(result.stderr, /project-team|global-team/);
  }
  chmodSync(strictFailures[3], 0o600);

  const mutationCases = [
    ['config', 'set', 'defaultTeam', 'changed'],
    ['config', 'unset', 'defaultTeam'],
    ['config', 'edit', '--key', 'defaultTeam', '--value', 'changed'],
    ['config', 'override', 'add', 'rule', '--set', 'defaultTeam=changed'],
    ['config', 'override', 'edit', 'rule', '--set', 'defaultTeam=changed'],
    ['config', 'override', 'remove', 'rule'],
    ['config', 'override', 'move', 'rule', '--before', 'other'],
    ['profile', 'add', 'changed'],
    ['profile', 'edit', 'changed', '--default-team', 'team'],
    ['profile', 'remove', 'changed'],
    ['profile', 'exclude', 'changed'],
    ['profile', 'match', 'add', 'changed', '--git-remote-owner', 'example'],
    ['profile', 'match', 'remove', 'changed', '--git-remote-owner', 'example'],
    ['workspace', 'add', 'changed'],
    ['workspace', 'remove', 'changed'],
    ['teams', 'set', 'changed'],
    ['teams', 'select'],
    ['initiatives', 'set', 'changed'],
    ['initiatives', 'select'],
    ['setup'],
    ['cfg', 'ov', 'remove', 'rule'],
    ['prof', 'rm', 'changed'],
  ];

  for (const command of mutationCases) {
    const before = snapshot(root);
    const result = run(['-C', project, '--config', './selected.json', ...command]);
    assert.equal(result.status, 2, `${command.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /--config is a read-only resolution selector/);
    assert.deepEqual(snapshot(root), before, command.join(' '));
  }

  const beforeStdin = snapshot(root);
  const stdinMutation = run(
    ['-C', project, '--config', './selected.json', '--api-key-file', '-', 'workspace', 'add', 'changed'],
    { input: 'lin_api_must_not_be_consumed\n' }
  );
  assert.equal(stdinMutation.status, 2, stdinMutation.stderr);
  assert.match(stdinMutation.stderr, /--config is a read-only resolution selector/);
  assert.deepEqual(snapshot(root), beforeStdin);

  const invalidOverride = run([
    'config',
    'override',
    'add',
    'exit-contract',
    '--global',
    '--set',
    'defaultTeam=changed',
  ]);
  assert.equal(invalidOverride.status, 2, invalidOverride.stderr);
  assert.match(invalidOverride.stderr, /at least one match criterion/);

  const validOverrideArgs = [
    'config',
    'override',
    'add',
    'exit-contract',
    '--global',
    '--when-json',
    '{}',
    '--set',
    'defaultTeam=changed',
  ];
  const firstOverride = run(validOverrideArgs);
  assert.equal(firstOverride.status, 0, firstOverride.stderr);
  const duplicateOverride = run(validOverrideArgs);
  assert.equal(duplicateOverride.status, 5, duplicateOverride.stderr);
  assert.match(duplicateOverride.stderr, /already exists/);

  process.stdout.write('M36 explicit-config built-CLI verification passed\n');
} finally {
  const unreadable = join(project, 'unreadable.json');
  if (existsSync(unreadable)) chmodSync(unreadable, 0o600);
  rmSync(root, { recursive: true, force: true });
}
