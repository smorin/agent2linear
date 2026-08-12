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
const root = mkdtempSync(join(tmpdir(), 'a2l-m36-parser-cli-'));
const home = join(root, 'home');
const xdg = join(root, 'xdg');
const state = join(root, 'state');
const project = join(root, 'project');
const history = join(state, 'agent2linear', 'cursor-history.json');
const milestoneTemplates = join(xdg, 'agent2linear', 'milestone-templates.json');

if (!existsSync(cli)) {
  throw new Error(`Build dist/index.js before running ${fileURLToPath(import.meta.url)}`);
}
mkdirSync(home, { recursive: true });
mkdirSync(project, { recursive: true });

function run(args, { input, extraEnv = {} } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    input,
    timeout: 10_000,
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: state,
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

function assertUsageFailure(result, commandLabel) {
  assert.equal(result.status, 2, `${commandLabel}\n${result.stderr}`);
  assert.equal(result.stdout, '', commandLabel);
  assert.match(result.stderr, /Usage:/, commandLabel);
  assert.match(result.stderr, /Commands:/, commandLabel);
  assert.doesNotMatch(result.stderr, /\(outputHelp\)/, commandLabel);
}

try {
  const bare = run([]);
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /Usage:/);
  assert.match(bare.stdout, /Commands:/);
  assert.equal(bare.stderr, '');

  for (const args of [
    ['--help'],
    ['project', '--help'],
    ['help'],
    ['help', 'project'],
    ['project', 'help'],
    ['project', 'help', 'list'],
    ['--', 'help', 'project'],
  ]) {
    const explicitHelp = run(args);
    assert.equal(explicitHelp.status, 0, explicitHelp.stderr);
    assert.match(explicitHelp.stdout, /Usage:/);
    assert.equal(explicitHelp.stderr, '');
  }

  const parentCommands = [
    ['initiatives'],
    ['project'],
    ['project', 'dependencies'],
    ['project', 'comment'],
    ['teams'],
    ['members'],
    ['project-status'],
    ['alias'],
    ['milestone-templates'],
    ['templates'],
    ['config'],
    ['config', 'override'],
    ['workflow-states'],
    ['issue-labels'],
    ['project-labels'],
    ['icons'],
    ['colors'],
    ['cache'],
    ['cursor-history'],
    ['issue'],
    ['issue', 'comment'],
    ['cycles'],
    ['workspace'],
    ['profile'],
    ['profile', 'match'],
    ['prompt'],
    ['issues'],
    ['milestones'],
    ['labels'],
  ];
  for (const command of parentCommands) {
    const before = snapshot(root);
    const result = run(command);
    assertUsageFailure(result, command.join(' '));
    assert.deepEqual(snapshot(root), before, `${command.join(' ')} changed local files`);
  }
  for (const aliasPath of [['init'], ['proj', 'deps'], ['lbl']]) {
    assertUsageFailure(run(aliasPath), aliasPath.join(' '));
  }
  assertUsageFailure(
    run(['--workspace', 'help', 'project']),
    '--workspace help project (help is an option value)'
  );
  for (const flags of ['-qC', '-vC', '-qvC']) {
    assertUsageFailure(run([flags, 'help', 'project']), `${flags} help project (help is -C value)`);
  }

  for (const [args, suggestion] of [
    [['projcet'], 'project'],
    [['project', 'lsit'], 'list'],
    [['--verboes'], '--verbose'],
    [['project', 'list', '--interactiv'], '--interactive'],
    [['issue', 'comment', 'lsit'], 'list'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:/);
    assert.match(result.stderr, /Did you mean/);
    assert.match(result.stderr, new RegExp(suggestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(result.stderr, /\(outputHelp\)/);
  }

  for (const [args, suggestion] of [
    [['help', 'projcet'], 'project'],
    [['project', 'help', 'lsit'], 'list'],
    [['help', 'project', 'lsit'], 'list'],
    [['project', 'dependencies', 'help', 'lsit'], 'list'],
    [['--', 'help', 'projcet'], 'project'],
    [['help', 'project', 'dependencies', 'lsit'], 'list'],
    [['help', 'issue', 'comment', 'lsit'], 'list'],
    [['--', 'help', 'project', 'lsit'], 'list'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /Usage:/, args.join(' '));
    assert.match(result.stderr, /Did you mean/, args.join(' '));
    assert.match(result.stderr, new RegExp(suggestion), args.join(' '));
  }

  for (const args of [
    ['help', 'help'],
    ['project', 'help', 'help'],
    ['help', 'project', 'help'],
    ['--', 'help', 'help'],
    ['help', 'icons', 'help', 'list'],
    ['icons', 'help', 'help', 'list'],
    ['--', 'help', 'icons', 'help', 'list'],
    ['--no-input', 'help', 'config', 'help', 'set', 'projectCacheMinTTL', '120'],
    ['--no-input', 'help', 'config', 'set', 'projectCacheMinTTL', '120'],
    ['help', 'icons', 'view', 'bug'],
    ['icons', 'help', 'list', '--search', 'bug'],
  ]) {
    const before = snapshot(root);
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /Usage:/, args.join(' '));
    assert.match(result.stderr, /Invalid generated help:/, args.join(' '));
    assert.doesNotMatch(result.stderr, /__invalid_help__/, args.join(' '));
    assert.deepEqual(snapshot(root), before, `${args.join(' ')} changed local files`);
  }

  const legacy = run(['issue', 'comment', 'ENG-123']);
  assert.equal(legacy.status, 2, legacy.stderr);
  assert.match(legacy.stderr, /legacy comment syntax has been removed/);
  assert.match(legacy.stderr, /issue comment add 'ENG-123'/);
  const terminatedLegacy = run(['--', 'issue', 'comment', 'ENG-123']);
  assert.equal(terminatedLegacy.status, 2, terminatedLegacy.stderr);
  assert.match(terminatedLegacy.stderr, /legacy comment syntax has been removed/);
  for (const flags of ['-qv', '-vq', '-qvv']) {
    const clusteredLegacy = run([flags, 'issue', 'comment', 'ENG-123']);
    assert.equal(clusteredLegacy.status, 2, clusteredLegacy.stderr);
    assert.match(clusteredLegacy.stderr, /legacy comment syntax has been removed/);
  }
  for (const args of [
    ['-qC', project, 'issue', 'comment', 'ENG-123'],
    ['-vC', project, 'issue', 'comment', 'ENG-123'],
    [`-qC${project}`, 'issue', 'comment', 'ENG-123'],
  ]) {
    const cwdClusteredLegacy = run(args);
    assert.equal(cwdClusteredLegacy.status, 2, cwdClusteredLegacy.stderr);
    assert.match(cwdClusteredLegacy.stderr, /legacy comment syntax has been removed/);
  }

  mkdirSync(dirname(history), { recursive: true });
  const seededHistory = '{"version":1,"entries":[]}\n';
  for (const args of [
    ['--no-input', 'cursor-history', 'clear'],
    ['cursor-history', 'clear', '--no-input'],
  ]) {
    writeFileSync(history, seededHistory, 'utf8');
    const result = run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /--no-input/);
    assert.match(result.stderr, /--yes/);
    assert.equal(readFileSync(history, 'utf8'), seededHistory);
  }

  for (const args of [
    ['--no-input', 'setup'],
    ['--no-input', 'initiatives', 'select'],
    ['--no-input', 'teams', 'select'],
    ['--no-input', 'alias', 'edit'],
    ['--no-input', 'config', 'edit'],
    ['--no-input', 'milestone-templates', 'edit', 'example'],
    ['--no-input', 'initiatives', 'list', '--interactive'],
    ['--no-input', 'initiatives', 'view', '--interactive'],
    ['--no-input', 'teams', 'list', '--interactive'],
    ['--no-input', 'members', 'list', '--interactive'],
    ['--no-input', 'templates', 'list', '--interactive'],
    ['--no-input', 'project-status', 'list', '--interactive'],
    ['--no-input', 'milestone-templates', 'create', '--interactive'],
    ['--no-input', 'project', 'create', '--interactive'],
    ['--no-input', 'project', 'list', '--interactive'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /--no-input forbids interactive input/, args.join(' '));
  }

  for (const args of [
    ['setup'],
    ['initiatives', 'select'],
    ['teams', 'select'],
    ['alias', 'edit'],
    ['config', 'edit'],
    ['milestone-templates', 'edit', 'example'],
    ['initiatives', 'list', '--interactive'],
    ['teams', 'list', '--interactive'],
    ['milestone-templates', 'create', '--interactive'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stderr}`);
    assert.equal(result.stdout, '', args.join(' '));
    assert.match(result.stderr, /requires interactive input from a TTY/, args.join(' '));
  }

  writeFileSync(history, seededHistory, 'utf8');
  const accepted = run(['--no-input', 'cursor-history', 'clear', '--yes']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(existsSync(history), false);

  mkdirSync(dirname(milestoneTemplates), { recursive: true });
  const seededTemplates = JSON.stringify({
    templates: { std: { name: 'std', milestones: [{ name: 'M1' }] } },
  });
  writeFileSync(milestoneTemplates, seededTemplates, 'utf8');
  const templateConsentFailure = run([
    '--no-input',
    'milestone-templates',
    'remove',
    'std',
  ]);
  assert.equal(templateConsentFailure.status, 2, templateConsentFailure.stderr);
  assert.equal(readFileSync(milestoneTemplates, 'utf8'), seededTemplates);
  const templateNonTtyFailure = run(['milestone-templates', 'remove', 'std']);
  assert.equal(templateNonTtyFailure.status, 2, templateNonTtyFailure.stderr);
  assert.match(templateNonTtyFailure.stderr, /requires interactive input from a TTY/);
  assert.equal(readFileSync(milestoneTemplates, 'utf8'), seededTemplates);

  const authFailure = run(['--no-input', 'whoami']);
  assert.equal(authFailure.status, 4, authFailure.stderr);
  assert.equal(authFailure.stdout, '');
  const workspaceAuthFailure = run(['--no-input', 'workspace', 'add', 'scratch']);
  assert.equal(workspaceAuthFailure.status, 4, workspaceAuthFailure.stderr);
  assert.equal(workspaceAuthFailure.stdout, '');

  const seededAlias = run([
    '--no-input',
    'alias',
    'add',
    'team',
    'seeded-auth-check',
    'fake-id',
    '--skip-validation',
  ]);
  assert.equal(seededAlias.status, 0, seededAlias.stderr);

  const promptSafetyAlias = run([
    '--no-input',
    'alias',
    'add',
    'user',
    'prompt-safety',
    'fake-user-id',
    '--skip-validation',
  ]);
  assert.equal(promptSafetyAlias.status, 0, promptSafetyAlias.stderr);
  const aliasesBeforeConsent = snapshot(xdg);
  for (const args of [
    ['--no-input', 'alias', 'clear', 'user', '--global'],
    ['--no-input', 'alias', 'clear', 'user', '--global', '--force'],
  ]) {
    const consentFailure = run(args);
    assert.equal(consentFailure.status, 2, `${args.join(' ')}\n${consentFailure.stderr}`);
    assert.equal(consentFailure.stdout, '', args.join(' '));
    assert.deepEqual(snapshot(xdg), aliasesBeforeConsent, args.join(' '));
  }
  const consentedAliasClear = run([
    '--no-input',
    'alias',
    'clear',
    'user',
    '--global',
    '--yes',
  ]);
  assert.equal(consentedAliasClear.status, 0, consentedAliasClear.stderr);
  assert.doesNotMatch(consentedAliasClear.stdout, /Are you sure|\(y\/N\)/);

  for (const args of [
    ['--no-input', 'teams', 'list'],
    ['--no-input', 'members', 'list', '--org-wide'],
    ['--no-input', 'initiatives', 'list'],
    ['--no-input', 'templates', 'list'],
    ['--no-input', 'project-status', 'list'],
    ['--no-input', 'cycles', 'list'],
    ['--no-input', 'workflow-states', 'list'],
    ['--no-input', 'project', 'view', 'missing-project'],
    ['--no-input', 'issue', 'view', 'ENG-1'],
    ['--no-input', 'alias', 'sync', 'team'],
    ['--no-input', 'alias', 'add', 'team', 'new-auth-check', 'fake-id'],
    ['--no-input', 'alias', 'list', 'team', '--validate'],
    ['--no-input', 'config', 'set', 'defaultTeam', 'fake-id'],
    ['--no-input', 'config', 'set', 'defaultInitiative', 'fake-id'],
    ['--no-input', 'config', 'set', 'defaultProject', 'fake-id'],
    ['--no-input', 'config', 'set', 'defaultIssueTemplate', 'fake-id'],
    ['--no-input', 'config', 'set', 'defaultProjectTemplate', 'fake-id'],
    ['--no-input', 'initiatives', 'set', 'fake-id'],
    ['--no-input', 'initiatives', 'view', 'fake-id'],
    ['--no-input', 'project', 'dependencies', 'list', 'missing'],
    ['--no-input', 'project', 'dependencies', 'clear', 'missing', '--yes'],
    ['--no-input', 'project-status', 'view', 'fake-id'],
    ['--no-input', 'teams', 'set', 'fake-id'],
    ['--no-input', 'teams', 'view', 'fake-id'],
    ['--no-input', 'templates', 'view', 'fake-id'],
    ['--no-input', 'workflow-states', 'delete', 'fake-id', '--yes'],
    ['--no-input', 'workflow-states', 'view', 'fake-id'],
    ['--no-input', 'cycles', 'view', 'fake-id'],
    ['--no-input', 'project', 'add-milestones', 'missing', '--template', 'scratch'],
    ['--no-input', 'colors', 'extract', '--type', 'labels'],
    ['--no-input', 'icons', 'extract', '--type', 'labels'],
    ['--no-input', 'icons', 'extract', '--type', 'labels', '--team', 'fake-id'],
    ['--no-input', 'project', 'create', '--title', 'Example', '--team', 'fake-id'],
    ['--no-input', 'issue', 'create', '--title', 'Example', '--team', 'fake-id'],
    ['--no-input', 'issue', 'update', 'ENG-1', '--title', 'Example'],
    ['--no-input', 'project', 'dependencies', 'add', 'missing', '--depends-on', 'other'],
    ['--no-input', 'project', 'dependencies', 'remove', 'missing', '--with', 'other'],
    ['--no-input', 'workflow-states', 'create', '--name', 'Example', '--team', 'fake-id'],
    ['--no-input', 'workflow-states', 'update', 'fake-id', '--name', 'Example'],
  ]) {
    const missingAuth = run(args);
    assert.equal(missingAuth.status, 4, `${args.join(' ')}\n${missingAuth.stderr}`);
  }

  for (const args of [
    ['--no-input', 'issue', 'create'],
    ['--no-input', 'milestone-templates', 'create'],
    ['--no-input', 'initiatives', 'view'],
    ['--no-input', 'alias', 'add', 'team', 'scratch'],
    ['--no-input', 'project', 'create', '--team', 'team_x'],
    ['--no-input', 'project', 'create', '--title', 'Example'],
    ['--no-input', 'milestone-templates', 'create', 'example'],
    ['--no-input', 'issue', 'update', 'ENG-1'],
    ['--no-input', 'workflow-states', 'create'],
    ['--no-input', 'workflow-states', 'create', '--name', 'Example'],
    ['--no-input', 'workflow-states', 'update', 'state_x'],
    ['--no-input', 'project', 'dependencies', 'clear', 'missing'],
    ['--no-input', 'workflow-states', 'delete', 'fake-id'],
    ['--no-input', 'project', 'add-milestones', 'missing'],
  ]) {
    const missingInput = run(args);
    assert.equal(missingInput.status, 2, `${args.join(' ')}\n${missingInput.stderr}`);
    assert.equal(missingInput.stdout, '', args.join(' '));
  }

  const pipedIssueWithoutTeam = run(['--no-input', 'issue', 'create'], {
    input: 'Piped issue title\n',
  });
  assert.equal(pipedIssueWithoutTeam.status, 2, pipedIssueWithoutTeam.stderr);
  assert.match(pipedIssueWithoutTeam.stderr, /team.*required/i);

  const missingKey = join(project, 'missing-key.txt');
  const inputFailure = run([
    '--no-input',
    '--api-key-file',
    missingKey,
    'workspace',
    'current',
  ]);
  assert.equal(inputFailure.status, 1, inputFailure.stderr);
  assert.equal(inputFailure.stdout, '');
  assert.match(inputFailure.stderr, /missing-key\.txt/);

  const suppliedInput = run(
    ['--no-input', '--api-key-file', '-', 'workspace', 'current'],
    { input: 'lin_api_explicit_stdin_only\n' }
  );
  assert.equal(suppliedInput.status, 0, suppliedInput.stderr);
  assert.doesNotMatch(JSON.stringify(snapshot(root)), /lin_api_explicit_stdin_only/);

  process.stdout.write('M36 parser/no-input built-CLI verification passed\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
