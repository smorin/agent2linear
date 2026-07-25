#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { getLinearClient } from '../../src/lib/api/client.js';

const EXPECTED_ORGANIZATION = 'ConceptM';
const repo = resolve(process.cwd());
const cli = join(repo, 'dist/index.js');
const tempRoot = mkdtempSync(join(tmpdir(), 'a2l-m35-live-'));
const stateRoot = join(tempRoot, 'state');
const cacheRoot = join(tempRoot, 'cache');

if (!existsSync(cli)) {
  throw new Error('Build dist/index.js before running the M35 live comments test');
}

function run(args: string[], stdin?: string): string {
  const result = spawnSync(process.execPath, [cli, '-C', repo, ...args], {
    cwd: repo,
    encoding: 'utf8',
    input: stdin,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, XDG_STATE_HOME: stateRoot, XDG_CACHE_HOME: cacheRoot },
  });
  if (result.status !== 0) {
    throw new Error([
      'Live command failed: a2l ' + args.join(' '),
      'exit: ' + String(result.status),
      result.signal ? 'signal: ' + result.signal : '',
      result.error ? 'spawn: ' + result.error.message : '',
      result.stderr,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout;
}

function runJson(args: string[], stdin?: string): Record<string, any> {
  return JSON.parse(run(args, stdin));
}

function assertPageTraversal(
  kind: 'issue' | 'project',
  target: string,
  expectedTargetId: string
): Record<string, unknown> {
  const base = [kind, 'comment', 'list', target];
  const first = runJson([...base, '--limit', '1', '--json']);
  if (
    first.target?.id !== expectedTargetId ||
    first.comments?.length !== 1 ||
    first.pageInfo?.hasNextPage !== true ||
    typeof first.pageInfo.endCursor !== 'string' ||
    first.pageInfo.endCursor.length === 0 ||
    first.cursorHistory?.status !== 'recorded' ||
    typeof first.cursorHistory.entryId !== 'string'
  ) {
    throw new Error(kind + ' first comment page/history contract failed: ' + JSON.stringify(first));
  }

  const cursor = first.pageInfo.endCursor;
  const second = runJson([
    ...base,
    '--limit',
    '1',
    '--after',
    cursor,
    '--json',
    '--no-cursor-history',
  ]);
  const remaining = runJson([
    ...base,
    '--after',
    cursor,
    '--all',
    '--json',
    '--no-cursor-history',
  ]);
  if (
    second.comments?.length !== 1 ||
    second.comments[0].id === first.comments[0].id ||
    remaining.comments?.[0]?.id !== second.comments[0].id ||
    remaining.comments?.length !== 2 ||
    remaining.pageInfo?.fetchedAll !== true ||
    remaining.pageInfo?.hasNextPage !== false ||
    remaining.pageInfo?.endCursor !== null
  ) {
    throw new Error(kind + ' raw cursor/all-remaining traversal contract failed');
  }

  const history = runJson([
    'cursor-history',
    'view',
    first.cursorHistory.entryId,
    '--json',
  ]);
  if (
    history.resource !== kind + '-comment' ||
    history.target?.id !== expectedTargetId ||
    history.cursor !== cursor ||
    !history.nextCommand?.includes(target)
  ) {
    throw new Error(kind + ' cursor-history context contract failed');
  }

  return {
    firstId: first.comments[0].id,
    secondId: second.comments[0].id,
    rawCursor: cursor,
    historyId: first.cursorHistory.entryId,
    remainingCount: remaining.comments.length,
  };
}

const client = getLinearClient();
let issueId: string | null = null;
let projectId: string | null = null;
let report: Record<string, unknown> | null = null;
let primaryError: unknown = null;

try {
  const organization = await client.organization;
  const identity = run(['whoami']);
  if (
    organization.name !== EXPECTED_ORGANIZATION ||
    !identity.includes('Organization: ' + EXPECTED_ORGANIZATION) ||
    !identity.includes('Active:       ' + EXPECTED_ORGANIZATION)
  ) {
    throw new Error(
      'Fail-closed: M35 live writes require the exact ' +
        EXPECTED_ORGANIZATION +
        ' organization and active workspace'
    );
  }

  process.stderr.write('M35 live: ConceptM identity confirmed\n');

  const teams = await client.teams({ first: 1 });
  const team = teams.nodes[0];
  if (!team) throw new Error('ConceptM has no team available for disposable fixtures');

  const suffix = Date.now().toString(36);
  const issuePayload = await client.createIssue({
    teamId: team.id,
    title: 'TEST_M35_COMMENTS_' + suffix,
    description: 'Disposable M35 live verification fixture.',
  });
  const issue = await issuePayload.issue;
  if (!issue) throw new Error('Linear did not create the disposable issue');
  issueId = issue.id;

  const projectPayload = await client.createProject({
    name: 'TEST_M35_COMMENTS_' + suffix,
    teamIds: [team.id],
    description: 'Disposable M35 live verification fixture.',
  });
  const project = await projectPayload.project;
  if (!project) throw new Error('Linear did not create the disposable project');
  projectId = project.id;
  process.stderr.write('M35 live: disposable fixtures created\n');

  const issueDryRun = runJson([
    'issue', 'comment', 'add', issue.identifier,
    '--body', 'dry run only', '--dry-run', '--json',
  ]);
  if (issueDryRun.dryRun !== true || issueDryRun.validation?.serverMutation !== false) {
    throw new Error('issue dry-run contract failed');
  }

  const issueTop = runJson([
    'issue', 'comment', 'add', issue.identifier,
    '--body', 'issue live top level', '--json', '-y',
  ]);
  const issueSecond = runJson([
    'issue', 'comment', 'add', issue.identifier,
    '--json', '-y',
  ], 'issue live stdin body\n');
  const issueReply = runJson([
    'issue', 'comment', 'add', issue.identifier,
    '--reply-to', issueTop.comment.id,
    '--body', 'issue live reply', '--json', '-y',
  ]);
  if (
    issueTop.target?.id !== issueId ||
    issueSecond.comment?.body !== 'issue live stdin body\n' ||
    issueReply.comment?.parentId !== issueTop.comment.id
  ) {
    throw new Error('issue comment add/reply contract failed');
  }

  const projectBodyFile = join(tempRoot, 'project-body.md');
  writeFileSync(projectBodyFile, 'project live file body\n', 'utf8');
  const projectTop = runJson([
    'project', 'comment', 'add', projectId,
    '--body-file', projectBodyFile, '--json', '-y',
  ]);
  const projectSecond = runJson([
    'project', 'comment', 'add', projectId,
    '--body', 'project live second', '--json', '-y',
  ]);
  const projectReply = runJson([
    'project', 'comment', 'add', projectId,
    '--reply-to', projectTop.comment.id,
    '--body', 'project live reply', '--json', '-y',
  ]);
  if (
    projectTop.target?.id !== projectId ||
    projectTop.comment?.body !== 'project live file body\n' ||
    projectSecond.comment?.id === projectTop.comment.id ||
    projectReply.comment?.parentId !== projectTop.comment.id
  ) {
    throw new Error('project comment add/reply contract failed');
  }

  const projectUpdatePayload = await client.createProjectUpdate({
    projectId,
    body: 'Disposable M35 project-update control.',
  });
  const projectUpdate = await projectUpdatePayload.projectUpdate;
  if (!projectUpdate) throw new Error('Linear did not create the project-update control');

  const updateCommentResponse = await client.client.rawRequest(
    `mutation ProjectUpdateCommentControl($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id projectUpdateId }
      }
    }`,
    {
      input: {
        body: 'project-update comment must stay out of direct project comments',
        projectUpdateId: projectUpdate.id,
      },
    }
  ) as {
    data?: {
      commentCreate?: {
        success?: boolean;
        comment?: { id?: string; projectUpdateId?: string };
      };
    };
  };
  const updateComment = updateCommentResponse.data?.commentCreate?.comment;
  if (
    updateCommentResponse.data?.commentCreate?.success !== true ||
    !updateComment?.id ||
    updateComment.projectUpdateId !== projectUpdate.id
  ) {
    throw new Error('Linear did not create the project-update comment control');
  }

  const directProjectComments = runJson([
    'project', 'comment', 'list', projectId,
    '--all', '--json', '--no-cursor-history',
  ]);
  const directProjectIds = directProjectComments.comments?.map(
    (item: { id: string }) => item.id
  ) ?? [];
  const expectedDirectProjectIds = [
    projectTop.comment.id,
    projectSecond.comment.id,
    projectReply.comment.id,
  ];
  if (
    directProjectIds.length !== expectedDirectProjectIds.length ||
    expectedDirectProjectIds.some((id: string) => !directProjectIds.includes(id)) ||
    directProjectIds.includes(updateComment.id)
  ) {
    throw new Error(
      'direct project comments leaked or omitted the project-update control: ' +
        JSON.stringify({ directProjectIds, updateCommentId: updateComment.id })
    );
  }

  process.stderr.write('M35 live: add and reply behavior verified\n');
  const issueTraversal = assertPageTraversal('issue', issue.identifier, issueId);
  const projectTraversal = assertPageTraversal('project', projectId, projectId);

  process.stderr.write('M35 live: raw cursor and history behavior verified\n');

  report = {
    workspace: EXPECTED_ORGANIZATION,
    fixtures: { issueId, projectId },
    issue: issueTraversal,
    project: projectTraversal,
    projectUpdateControl: {
      updateId: projectUpdate.id,
      commentId: updateComment.id,
      excludedFromDirectList: true,
    },
  };
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors: string[] = [];
  if (issueId) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await client.deleteIssue(issueId);
        break;
      } catch (error) {
        if (attempt === 3) {
          cleanupErrors.push('issue ' + issueId + ': ' + String(error));
        }
      }
    }
  }
  if (projectId) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await client.deleteProject(projectId);
        break;
      } catch (error) {
        if (attempt === 3) {
          cleanupErrors.push('project ' + projectId + ': ' + String(error));
        }
      }
    }
  }
  rmSync(tempRoot, { recursive: true, force: true });
  if (cleanupErrors.length > 0) {
    throw new Error(
      'M35 live fixture cleanup failed: ' + cleanupErrors.join('; ') +
        (primaryError ? '; primary verification failure: ' + String(primaryError) : '')
    );
  }
  process.stderr.write('M35 live: disposable fixture cleanup complete\n');
}

if (primaryError) throw primaryError;
if (!report) throw new Error('M35 live test produced no report');
process.stdout.write(JSON.stringify({ ...report, cleanup: 'complete' }, null, 2) + '\n');
