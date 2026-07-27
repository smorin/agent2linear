import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetGitContextCache,
  buildGitContext,
  defaultGitRun,
} from './git-context.js';

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

  it('does not include remote URLs from global git config', () => {
    const globalConfig = join(
      tmpdir(),
      `a2l-global-gitconfig-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
    writeFileSync(globalConfig, '[remote "upstream"]\n\turl = git@github.com:global/leak.git\n');
    process.env.GIT_CONFIG_GLOBAL = globalConfig;
    __resetGitContextCache();
    try {
      const ctx = buildGitContext(repo);

      expect(ctx.remotes.origin).toEqual({ host: 'github.com', owner: 'smorin', name: 'agent2linear' });
      expect(ctx.remotes.upstream).toBeUndefined();
    } finally {
      if (previousGlobalConfig === undefined) {
        delete process.env.GIT_CONFIG_GLOBAL;
      } else {
        process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
      }
      rmSync(globalConfig, { force: true });
      __resetGitContextCache();
    }
  });

  it('matches git remote get-url by keeping the first URL when origin has multiple URLs', () => {
    runGit(repo, ['remote', 'set-url', '--add', 'origin', 'https://github.com/mirror/agent2linear.git']);
    __resetGitContextCache();

    expect(capture(repo, ['remote', 'get-url', 'origin'])).toBe(
      'https://github.com/smorin/agent2linear.git'
    );
    expect(buildGitContext(repo).remotes.origin).toEqual({
      host: 'github.com',
      owner: 'smorin',
      name: 'agent2linear',
    });
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
