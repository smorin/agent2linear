import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetGitContextCache,
  buildGitContext,
  defaultGitRun,
  type GitRun,
  normalizeOwnerInput,
  normalizeRemoteUrl,
} from './git-context.js';

beforeEach(() => __resetGitContextCache());
afterEach(() => __resetGitContextCache());

describe('normalizeRemoteUrl (§5.4)', () => {
  it('normalizes SSH/HTTPS/ssh:// forms, strips .git, supports nested groups', () => {
    expect(normalizeRemoteUrl('git@github.com:acme/web.git')).toEqual({ host: 'github.com', owner: 'acme', name: 'web' });
    expect(normalizeRemoteUrl('https://github.com/acme/web.git')).toEqual({ host: 'github.com', owner: 'acme', name: 'web' });
    expect(normalizeRemoteUrl('ssh://git@gitlab.com/acme/platform/web.git')).toEqual({
      host: 'gitlab.com',
      owner: 'acme/platform',
      name: 'web',
    });
    expect(normalizeRemoteUrl('https://user@github.com:443/acme/web')).toEqual({
      host: 'github.com',
      owner: 'acme',
      name: 'web',
    });
  });

  it('strips a trailing slash after .git (e.g. a copied URL) (F)', () => {
    expect(normalizeRemoteUrl('https://github.com/acme/web.git/')).toEqual({
      host: 'github.com',
      owner: 'acme',
      name: 'web',
    });
    expect(normalizeRemoteUrl('git@github.com:acme/web.git/')).toEqual({
      host: 'github.com',
      owner: 'acme',
      name: 'web',
    });
  });

  it('rejects non-remote input', () => {
    expect(normalizeRemoteUrl('')).toBeNull();
    expect(normalizeRemoteUrl('   ')).toBeNull();
    expect(normalizeRemoteUrl('ssh://nopath')).toBeNull(); // scheme:// but no owner/repo
    expect(normalizeRemoteUrl('git@github.com:acme')).toBeNull(); // < 2 segments
    expect(normalizeRemoteUrl('not a url')).toBeNull(); // no scheme, no scp colon
  });
});

describe('normalizeOwnerInput - accepts a bare owner OR a full repo URL', () => {
  it('passes a bare owner through, trimming surrounding whitespace', () => {
    expect(normalizeOwnerInput('banksheets')).toBe('banksheets');
    expect(normalizeOwnerInput('acme-co')).toBe('acme-co');
    expect(normalizeOwnerInput('  acme.labs_1  ')).toBe('acme.labs_1');
  });

  it('extracts the owner from a full HTTPS repo URL', () => {
    expect(normalizeOwnerInput('https://github.com/banksheets/get-bank-sheets-web.git')).toBe(
      'banksheets'
    );
  });

  it('extracts the owner from an SSH/scp repo URL', () => {
    expect(normalizeOwnerInput('git@github.com:acme-co/repo.git')).toBe('acme-co');
  });

  it('rejects malformed input (URL-like with no owner, or path/host separators)', () => {
    expect(normalizeOwnerInput('https://github.com')).toBeNull();
    expect(normalizeOwnerInput('banksheets/repo')).toBeNull();
    expect(normalizeOwnerInput('owner with spaces')).toBeNull();
    expect(normalizeOwnerInput('')).toBeNull();
  });
});

describe('buildGitContext (injected run)', () => {
  // A fake git that answers from a script map; records the args it was asked.
  function fakeRun(answers: Record<string, string | null>): { run: GitRun; calls: string[][] } {
    const calls: string[][] = [];
    const run: GitRun = (args) => {
      calls.push(args);
      return answers[args.join(' ')] ?? null;
    };
    return { run, calls };
  }

  it('resolves repoRoot, branch, and all remotes', () => {
    const { run } = fakeRun({
      'rev-parse --show-toplevel': '/work/acme/web',
      'rev-parse --abbrev-ref HEAD': 'main',
      'config --get-regexp ^remote\\..*\\.url$':
        'remote.origin.url https://github.com/myuser/web.git\nremote.upstream.url git@github.com:acme/web.git',
    });
    const ctx = buildGitContext('/work/acme/web', run);
    expect(ctx.repoRoot).toBe('/work/acme/web');
    expect(ctx.branch).toBe('main');
    expect(ctx.remotes.origin).toEqual({ host: 'github.com', owner: 'myuser', name: 'web' });
    expect(ctx.remotes.upstream).toEqual({ host: 'github.com', owner: 'acme', name: 'web' });
  });

  it('treats a detached HEAD as no branch', () => {
    const { run } = fakeRun({
      'rev-parse --show-toplevel': '/repo',
      'rev-parse --abbrev-ref HEAD': 'HEAD',
    });
    expect(buildGitContext('/repo', run).branch).toBeUndefined();
  });

  it('returns null repoRoot / empty remotes / no branch outside a repo', () => {
    const { run } = fakeRun({});
    const ctx = buildGitContext('/not/a/repo', run);
    expect(ctx.repoRoot).toBeNull();
    expect(ctx.branch).toBeUndefined();
    expect(ctx.remotes).toEqual({});
  });

  it('skips malformed / non-remote / unparseable config lines', () => {
    const { run } = fakeRun({
      'rev-parse --show-toplevel': '/repo',
      'rev-parse --abbrev-ref HEAD': 'main',
      'config --get-regexp ^remote\\..*\\.url$': [
        'remote.origin.url https://github.com/acme/web.git',
        'badlinewithnospace',
        'notaremote.key value',
        'remote.broken.url not-a-valid-url',
      ].join('\n'),
    });
    const ctx = buildGitContext('/repo', run);
    expect(Object.keys(ctx.remotes)).toEqual(['origin']);
  });

  it('caches per contextDir (run invoked once across calls)', () => {
    const { run, calls } = fakeRun({ 'rev-parse --show-toplevel': '/repo' });
    buildGitContext('/repo', run);
    const callsAfterFirst = calls.length;
    buildGitContext('/repo', run);
    expect(calls.length).toBe(callsAfterFirst); // second call served from cache
  });
});

describe('defaultGitRun + buildGitContext (real git)', () => {
  let repo: string;

  // Run git against a directory, ignoring all stdio (throws on non-zero exit).
  const runGit = (dir: string, args: string[]): void => {
    execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
  };
  // Run git and capture trimmed stdout.
  const capture = (dir: string, args: string[]): string =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf-8' }).trim();

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'a2l-gitctx-'));
    runGit(repo, ['init', '-q', '-b', 'main']);
    runGit(repo, ['config', 'user.email', 't@t.co']);
    runGit(repo, ['config', 'user.name', 't']);
    runGit(repo, ['remote', 'add', 'origin', 'https://github.com/smorin/agent2linear.git']);
    runGit(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);
  });

  afterEach(() => {
    __resetGitContextCache();
    rmSync(repo, { recursive: true, force: true });
  });

  it('reads a real repo via the default runner', () => {
    const ctx = buildGitContext(repo);
    expect(ctx.repoRoot).not.toBeNull();
    expect(ctx.branch).toBe('main');
    expect(ctx.remotes.origin).toEqual({ host: 'github.com', owner: 'smorin', name: 'agent2linear' });
  });

  it('enumerates multiple real remotes across URL forms (HTTPS, SSH scp, nested group)', () => {
    runGit(repo, ['remote', 'add', 'upstream', 'git@github.com:acme/web.git']);
    runGit(repo, ['remote', 'add', 'gl', 'ssh://git@gitlab.com/acme/platform/web.git']);
    const ctx = buildGitContext(repo);
    expect(ctx.remotes.origin).toEqual({ host: 'github.com', owner: 'smorin', name: 'agent2linear' });
    expect(ctx.remotes.upstream).toEqual({ host: 'github.com', owner: 'acme', name: 'web' });
    expect(ctx.remotes.gl).toEqual({ host: 'gitlab.com', owner: 'acme/platform', name: 'web' });
  });

  it('reports no branch in a real detached HEAD', () => {
    const sha = capture(repo, ['rev-parse', 'HEAD']);
    runGit(repo, ['checkout', '-q', sha]);
    const ctx = buildGitContext(repo);
    expect(ctx.branch).toBeUndefined();
    expect(ctx.repoRoot).not.toBeNull(); // still a repo
  });

  it('resolves a real linked worktree (own branch + root, shared remotes)', () => {
    const wt = join(tmpdir(), `a2l-gitwt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    runGit(repo, ['worktree', 'add', '-q', '-b', 'feature/login', wt]);
    try {
      const wtCtx = buildGitContext(wt);
      expect(wtCtx.branch).toBe('feature/login'); // the worktree's branch, not main
      expect(wtCtx.repoRoot).not.toBeNull();
      expect(wtCtx.repoRoot).not.toBe(buildGitContext(repo).repoRoot); // distinct root
      expect(wtCtx.remotes.origin).toEqual({ host: 'github.com', owner: 'smorin', name: 'agent2linear' });
    } finally {
      runGit(repo, ['worktree', 'remove', '--force', wt]);
      rmSync(wt, { recursive: true, force: true });
    }
  });

  it('degrades to nulls/empties outside a repo (default runner)', () => {
    const notRepo = mkdtempSync(join(tmpdir(), 'a2l-norepo-'));
    try {
      const ctx = buildGitContext(notRepo);
      expect(ctx.repoRoot).toBeNull();
      expect(ctx.branch).toBeUndefined();
      expect(ctx.remotes).toEqual({});
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  it('defaultGitRun returns trimmed output, or null on failure', () => {
    expect(defaultGitRun(repo)(['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');
    const notRepo = mkdtempSync(join(tmpdir(), 'a2l-norepo2-'));
    try {
      expect(defaultGitRun(notRepo)(['rev-parse', '--show-toplevel'])).toBeNull();
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });
});
