#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { getLinearClient } from '../../src/lib/api/client.js';
import { getApiKey } from '../../src/lib/config.js';
import { assertLiveOrganizationIdentity } from './live-identity.js';

const EXPECTED_ORGANIZATION = 'ConceptM';
const EXPECTED_ORGANIZATION_URL_KEY = 'conceptm';
const repo = resolve(process.cwd());
const cli = join(repo, 'dist/index.js');
const tempRoot = mkdtempSync(join(tmpdir(), 'a2l-m36-automation-'));
const configuredApiKey = getApiKey();

if (!configuredApiKey) {
  throw new Error('M36 live automation requires a configured Linear API key');
}
if (!existsSync(cli)) {
  throw new Error('Build dist/index.js before running the M36 live automation test');
}

process.env.XDG_CONFIG_HOME = join(tempRoot, 'config');
process.env.XDG_STATE_HOME = join(tempRoot, 'state');
process.env.XDG_CACHE_HOME = join(tempRoot, 'cache');
process.env.AGENT2LINEAR_WORKSPACE = EXPECTED_ORGANIZATION;
process.env.LINEAR_API_KEY_CONCEPTM = configuredApiKey;

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

async function findDisposableIssueId(title: string): Promise<string | null> {
  const candidates = await client.issues({
    first: 10,
    filter: { title: { eq: title } },
  });
  const exact = candidates.nodes.filter(candidate => candidate.title === title);
  if (exact.length > 1) {
    throw new Error(`exact-title cleanup fallback matched ${exact.length} issues`);
  }
  return exact[0]?.id ?? null;
}

function trashDisposableIssue(id: string): void {
  const trashed = runJson(['issue', 'update', id, '--trash', '--json', '--no-input', '-y']);
  if (trashed.ok !== true || trashed.issue?.id !== id) {
    throw new Error('issue trash cleanup contract failed: ' + JSON.stringify(trashed));
  }
}

const client = getLinearClient();
let issueId: string | null = null;
let issueIdentifier: string | null = null;
let createdTitle: string | null = null;
let createAttempted = false;
let report: Record<string, unknown> | null = null;
let primaryError: unknown = null;
let cleanupError: unknown = null;

try {
  const organization = await client.organization;
  if (
    organization.name !== EXPECTED_ORGANIZATION ||
    organization.urlKey !== EXPECTED_ORGANIZATION_URL_KEY
  ) {
    throw new Error('Fail-closed: M36 live writes require the exact ConceptM organization');
  }
  assertLiveOrganizationIdentity(run(['whoami']), {
    organizationName: EXPECTED_ORGANIZATION,
    organizationUrlKey: EXPECTED_ORGANIZATION_URL_KEY,
  });

  const teams = await client.teams({ first: 50 });
  const team =
    teams.nodes.find(candidate => candidate.name === 'AGENT2LINEAR GITHUB CI') ?? teams.nodes[0];
  if (!team) throw new Error('ConceptM has no team available for a disposable issue');

  const suffix = Date.now().toString(36);
  const initialTitle = 'TEST_M36_AUTOMATION_' + suffix;
  createdTitle = initialTitle;
  const updatedTitle = initialTitle + '_UPDATED';

  createAttempted = true;
  const created = runJson([
    'issue',
    'create',
    '--title',
    initialTitle,
    '--team',
    team.id,
    '--description',
    'Disposable M36 built-CLI automation fixture.',
    '--no-assignee',
    '--json',
    '-y',
  ]);
  if (typeof created.issue?.id === 'string') issueId = created.issue.id;
  if (typeof created.issue?.identifier === 'string') issueIdentifier = created.issue.identifier;
  if (
    created.ok !== true ||
    created.workspace?.name !== EXPECTED_ORGANIZATION ||
    issueId === null ||
    issueIdentifier === null ||
    created.issue.title !== initialTitle
  ) {
    throw new Error('issue create JSON contract failed: ' + JSON.stringify(created));
  }

  const updated = runJson(['issue', 'update', issueId, '--title', updatedTitle, '--json', '-y']);
  if (
    updated.ok !== true ||
    updated.workspace?.name !== EXPECTED_ORGANIZATION ||
    updated.issue?.id !== issueId ||
    updated.issue?.identifier !== issueIdentifier ||
    updated.issue?.title !== updatedTitle
  ) {
    throw new Error('issue update identity/title continuity failed: ' + JSON.stringify(updated));
  }

  const viewed = runJson(['issue', 'view', issueId, '--json']);
  if (
    viewed.id !== issueId ||
    viewed.identifier !== issueIdentifier ||
    viewed.title !== updatedTitle
  ) {
    throw new Error('issue view identity/title continuity failed: ' + JSON.stringify(viewed));
  }

  report = {
    workspace: EXPECTED_ORGANIZATION,
    issue: { id: issueId, identifier: issueIdentifier, title: updatedTitle },
    continuity: true,
  };
} catch (error) {
  primaryError = error;
} finally {
  try {
    if (!issueId && createAttempted && createdTitle) {
      issueId = await findDisposableIssueId(createdTitle);
    }
    if (issueId) trashDisposableIssue(issueId);
  } catch (error) {
    cleanupError = error;
  }
  rmSync(tempRoot, { recursive: true, force: true });
}

if (cleanupError) {
  throw new Error(
    'M36 live issue cleanup failed: ' +
      String(cleanupError) +
      (primaryError ? '; primary verification failure: ' + String(primaryError) : '')
  );
}
if (primaryError) throw primaryError;
if (!report) throw new Error('M36 live automation produced no report');
process.stdout.write(JSON.stringify({ ...report, cleanup: 'trashed' }, null, 2) + '\n');
