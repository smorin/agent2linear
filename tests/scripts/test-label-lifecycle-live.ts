#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { getLinearClient } from '../../src/lib/api/client.js';
import { getApiKey } from '../../src/lib/config.js';

const EXPECTED_ORGANIZATION = 'ConceptM';
const repo = resolve(process.cwd());
const cli = join(repo, 'dist/index.js');
const tempRoot = mkdtempSync(join(tmpdir(), 'a2l-m33-live-'));
const stateRoot = join(tempRoot, 'state');
const cacheRoot = join(tempRoot, 'cache');
const configRoot = join(tempRoot, 'config');
const configuredApiKey = getApiKey();

if (!configuredApiKey) {
  throw new Error('M33 live verification requires a configured Linear API key');
}

// Make workspace selection hermetic and portable to CI: one explicitly named ConceptM
// workspace backed by the already configured key, with no dependency on host profiles.
process.env.XDG_CONFIG_HOME = configRoot;
process.env.XDG_STATE_HOME = stateRoot;
process.env.XDG_CACHE_HOME = cacheRoot;
process.env.AGENT2LINEAR_WORKSPACE = EXPECTED_ORGANIZATION;
process.env.LINEAR_API_KEY_CONCEPTM = configuredApiKey;

if (!existsSync(cli)) {
  throw new Error('Build dist/index.js before running the M33 live lifecycle test');
}

function run(args: string[]): string {
  const result = spawnSync(process.execPath, [cli, '-C', repo, ...args], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env },
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

function runJson(args: string[]): Record<string, any> {
  return JSON.parse(run(args));
}

function assertWorkspace(result: Record<string, any>, operation: string): void {
  if (result.workspace?.name !== EXPECTED_ORGANIZATION) {
    throw new Error(operation + ' did not report the ConceptM workspace');
  }
}

function includesId(result: Record<string, any>, id: string): boolean {
  return (
    Array.isArray(result.labels) && result.labels.some((label: { id: string }) => label.id === id)
  );
}

function verifyLabelTraversal(
  kind: 'issue' | 'project',
  color: string,
  expectedIds: string[],
  teamId?: string
): Record<string, unknown> {
  const base = [
    kind === 'issue' ? 'issue-labels' : 'project-labels',
    'list',
    ...(teamId ? ['--team', teamId] : []),
    '--color',
    color,
    '--include-retired',
  ];
  const first = runJson([...base, '--limit', '1', '--format', 'json']);
  if (
    first.labels?.length !== 1 ||
    first.pageInfo?.hasNextPage !== true ||
    typeof first.pageInfo.endCursor !== 'string' ||
    first.pageInfo.endCursor.length === 0 ||
    first.cursorHistory?.status !== 'recorded' ||
    typeof first.cursorHistory.entryId !== 'string'
  ) {
    throw new Error(kind + ' label first-page/history contract failed: ' + JSON.stringify(first));
  }

  const cursor = first.pageInfo.endCursor;
  const second = runJson([
    ...base,
    '--limit',
    '1',
    '--after',
    cursor,
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  const remaining = runJson([
    ...base,
    '--after',
    cursor,
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  const traversedIds = [
    first.labels[0]?.id,
    ...(remaining.labels ?? []).map((label: { id: string }) => label.id),
  ];
  if (
    second.labels?.length !== 1 ||
    second.labels[0].id === first.labels[0].id ||
    remaining.labels?.[0]?.id !== second.labels[0].id ||
    remaining.pageInfo?.fetchedAll !== true ||
    remaining.pageInfo?.hasNextPage !== false ||
    remaining.pageInfo?.endCursor !== null ||
    expectedIds.some(id => !traversedIds.includes(id))
  ) {
    throw new Error(kind + ' label raw cursor/all-remaining contract failed');
  }

  const history = runJson(['cursor-history', 'view', first.cursorHistory.entryId, '--json']);
  if (
    history.resource !== kind + '-label' ||
    history.cursor !== cursor ||
    !history.nextCommand?.includes(kind === 'issue' ? 'issue-labels list' : 'project-labels list')
  ) {
    throw new Error(kind + ' label cursor-history context failed');
  }

  return {
    firstId: first.labels[0].id,
    secondId: second.labels[0].id,
    rawCursor: cursor,
    historyId: first.cursorHistory.entryId,
    remainingCount: remaining.labels.length,
  };
}

async function retryCleanup(
  description: string,
  cleanup: () => Promise<unknown>,
  errors: string[]
): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await cleanup();
      return;
    } catch (error) {
      if (attempt === 3) errors.push(description + ': ' + String(error));
    }
  }
}

const client = getLinearClient();
const fixtureIds = {
  issue: null as string | null,
  project: null as string | null,
  issueLabels: [] as string[],
  projectLabels: [] as string[],
};
let report: Record<string, unknown> | null = null;
let primaryError: unknown = null;
const cleanupErrors: string[] = [];

try {
  const organization = await client.organization;
  const identity = run(['whoami']);
  if (
    organization.name !== EXPECTED_ORGANIZATION ||
    !identity.includes('Organization: ' + EXPECTED_ORGANIZATION) ||
    !identity.includes('Active:       ' + EXPECTED_ORGANIZATION)
  ) {
    throw new Error(
      'Fail-closed: M33 live writes require the exact ' +
        EXPECTED_ORGANIZATION +
        ' organization and active workspace'
    );
  }
  process.stderr.write('M33 live: ConceptM identity confirmed\n');

  const teams = await client.teams({ first: 50 });
  const team =
    teams.nodes.find(candidate => candidate.name === 'AGENT2LINEAR GITHUB CI') ?? teams.nodes[0];
  if (!team) throw new Error('ConceptM has no team available for disposable fixtures');

  const suffix = Date.now().toString(36);
  const issueColor = '#A1B2C3';
  const projectColor = '#C3B2A1';
  const issueLabelNames = ['TEST_M33_ISSUE_APPLIED_' + suffix, 'TEST_M33_ISSUE_UNUSED_' + suffix];
  const projectLabelNames = [
    'TEST_M33_PROJECT_APPLIED_' + suffix,
    'TEST_M33_PROJECT_UNUSED_' + suffix,
  ];

  for (const name of issueLabelNames) {
    const created = runJson([
      'issue-labels',
      'create',
      '--name',
      name,
      '--color',
      issueColor,
      '--team',
      team.id,
      '--json',
      '-y',
    ]);
    assertWorkspace(created, 'issue-label create');
    fixtureIds.issueLabels.push(created.label.id);
  }
  for (const name of projectLabelNames) {
    const created = runJson([
      'project-labels',
      'create',
      '--name',
      name,
      '--color',
      projectColor,
      '--json',
      '-y',
    ]);
    assertWorkspace(created, 'project-label create');
    fixtureIds.projectLabels.push(created.label.id);
  }

  const issuePayload = await client.createIssue({
    teamId: team.id,
    title: 'TEST_M33_LABEL_LIFECYCLE_' + suffix,
    description: 'Disposable M33 live verification fixture.',
    labelIds: [fixtureIds.issueLabels[0]],
  });
  const issue = await issuePayload.issue;
  if (!issue) throw new Error('Linear did not create the disposable M33 issue');
  fixtureIds.issue = issue.id;

  const projectPayload = await client.createProject({
    name: 'TEST_M33_LABEL_LIFECYCLE_' + suffix,
    teamIds: [team.id],
    description: 'Disposable M33 live verification fixture.',
    labelIds: [fixtureIds.projectLabels[0]],
  });
  const project = await projectPayload.project;
  if (!project) throw new Error('Linear did not create the disposable M33 project');
  fixtureIds.project = project.id;
  process.stderr.write('M33 live: disposable labels, issue, and project created\n');

  const issueTraversal = verifyLabelTraversal('issue', issueColor, fixtureIds.issueLabels, team.id);
  const projectTraversal = verifyLabelTraversal('project', projectColor, fixtureIds.projectLabels);

  const projectCatalog = runJson([
    'project-labels',
    'list',
    '--color',
    projectColor,
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  if (fixtureIds.projectLabels.some(id => !includesId(projectCatalog, id))) {
    throw new Error('project-label catalog omitted applied or unused disposable definition');
  }

  const retiredIssue = runJson([
    'issue-labels',
    'retire',
    fixtureIds.issueLabels[0],
    '--json',
    '-y',
  ]);
  assertWorkspace(retiredIssue, 'issue-label retire');
  if (typeof retiredIssue.label?.retiredAt !== 'string' || retiredIssue.label.archivedAt !== null) {
    throw new Error('issue-label retire did not set retiredAt independently');
  }
  const activeIssueLabels = runJson([
    'issue-labels',
    'list',
    '--team',
    team.id,
    '--color',
    issueColor,
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  const allIssueLabels = runJson([
    'issue-labels',
    'list',
    '--team',
    team.id,
    '--color',
    issueColor,
    '--include-retired',
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  if (
    includesId(activeIssueLabels, fixtureIds.issueLabels[0]) ||
    !includesId(allIssueLabels, fixtureIds.issueLabels[0])
  ) {
    throw new Error('issue-label active/include-retired filtering failed');
  }
  const restoredIssue = runJson([
    'issue-labels',
    'restore',
    fixtureIds.issueLabels[0],
    '--json',
    '-y',
  ]);
  if (restoredIssue.label?.retiredAt !== null || restoredIssue.label?.archivedAt !== null) {
    throw new Error('issue-label restore did not clear only retiredAt');
  }

  const retiredProject = runJson([
    'project-labels',
    'retire',
    fixtureIds.projectLabels[0],
    '--json',
    '-y',
  ]);
  assertWorkspace(retiredProject, 'project-label retire');
  if (
    typeof retiredProject.label?.retiredAt !== 'string' ||
    retiredProject.label.archivedAt !== null
  ) {
    throw new Error('project-label retire did not set retiredAt independently');
  }
  const activeProjectLabels = runJson([
    'project-labels',
    'list',
    '--color',
    projectColor,
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  const allProjectLabels = runJson([
    'project-labels',
    'list',
    '--color',
    projectColor,
    '--include-retired',
    '--all',
    '--format',
    'json',
    '--no-cursor-history',
  ]);
  if (
    includesId(activeProjectLabels, fixtureIds.projectLabels[0]) ||
    !includesId(allProjectLabels, fixtureIds.projectLabels[0])
  ) {
    throw new Error('project-label active/include-retired filtering failed');
  }
  const restoredProject = runJson([
    'project-labels',
    'restore',
    fixtureIds.projectLabels[0],
    '--json',
    '-y',
  ]);
  if (restoredProject.label?.retiredAt !== null || restoredProject.label?.archivedAt !== null) {
    throw new Error('project-label restore did not clear only retiredAt');
  }

  const trashed = runJson(['project', 'update', project.id, '--trash', '--json', '-y']);
  assertWorkspace(trashed, 'project trash');
  if (trashed.lifecycle?.trashed !== true) {
    throw new Error('project update --trash did not report trashed=true');
  }
  const untrashed = runJson(['project', 'update', project.id, '--untrash', '--json', '-y']);
  if (untrashed.lifecycle?.trashed !== false) {
    throw new Error('project update --untrash did not report trashed=false');
  }

  await client.updateIssue(issue.id, { labelIds: [] });
  await client.updateProject(project.id, { labelIds: [] });

  const finalTrash = runJson(['project', 'update', project.id, '--trash', '--json', '-y']);
  if (finalTrash.lifecycle?.trashed !== true) {
    throw new Error('project final trash cleanup state failed');
  }

  for (const id of [...fixtureIds.issueLabels]) {
    const deleted = runJson(['issue-labels', 'delete', id, '--json', '-y']);
    if (deleted.deleted?.id !== id) throw new Error('issue-label delete output mismatch');
    fixtureIds.issueLabels = fixtureIds.issueLabels.filter(candidate => candidate !== id);
  }
  for (const id of [...fixtureIds.projectLabels]) {
    const deleted = runJson(['project-labels', 'delete', id, '--json', '-y']);
    if (deleted.deleted?.id !== id) throw new Error('project-label delete output mismatch');
    fixtureIds.projectLabels = fixtureIds.projectLabels.filter(candidate => candidate !== id);
  }

  report = {
    workspace: EXPECTED_ORGANIZATION,
    team: { id: team.id, name: team.name },
    fixtures: { issueId: issue.id, projectId: project.id },
    issueLabels: {
      traversal: issueTraversal,
      lifecycle: 'create-apply-retire-filter-restore-delete',
    },
    projectLabels: {
      traversal: projectTraversal,
      catalog: 'applied-and-unused-present',
      lifecycle: 'create-apply-retire-filter-restore-delete',
    },
    project: {
      lifecycle: 'create-trash-untrash-trash',
      finalState: 'trashed',
    },
  };
} catch (error) {
  primaryError = error;
} finally {
  for (const id of fixtureIds.issueLabels) {
    await retryCleanup('issue label ' + id, () => client.deleteIssueLabel(id), cleanupErrors);
  }
  for (const id of fixtureIds.projectLabels) {
    await retryCleanup('project label ' + id, () => client.deleteProjectLabel(id), cleanupErrors);
  }
  if (fixtureIds.issue) {
    await retryCleanup(
      'issue ' + fixtureIds.issue,
      () => client.deleteIssue(fixtureIds.issue as string),
      cleanupErrors
    );
  }
  if (fixtureIds.project) {
    await retryCleanup(
      'project ' + fixtureIds.project,
      () => client.deleteProject(fixtureIds.project as string),
      cleanupErrors
    );
  }
  rmSync(tempRoot, { recursive: true, force: true });
  if (cleanupErrors.length === 0) {
    process.stderr.write('M33 live: disposable fixture cleanup complete\n');
  }
}

if (cleanupErrors.length > 0) {
  throw new Error(
    'M33 live fixture cleanup failed: ' +
      cleanupErrors.join('; ') +
      (primaryError ? '; primary verification failure: ' + String(primaryError) : '')
  );
}
if (primaryError) throw primaryError;
if (!report) throw new Error('M33 live test produced no report');
process.stdout.write(JSON.stringify({ ...report, cleanup: 'complete' }, null, 2) + '\n');
