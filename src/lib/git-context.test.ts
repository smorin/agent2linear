import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetGitContextCache,
  buildGitContext,
  type GitRun,
  normalizeHostInput,
  normalizeOwnerInput,
  normalizeRemoteUrl,
  normalizeRepoInput,
  selectRemotes,
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

  it('accepts owner globs and nested-group owners (M31 — all identity fields take globs)', () => {
    expect(normalizeOwnerInput('acme-*')).toBe('acme-*');
    expect(normalizeOwnerInput('group/sub')).toBe('group/sub'); // nested group (all-but-last)
    expect(normalizeOwnerInput('group/*')).toBe('group/*'); // the D2 migration glob
    expect(normalizeOwnerInput('my-org/secret-*')).toBe('my-org/secret-*');
    expect(normalizeOwnerInput('+(my-org|acme)')).toBe('+(my-org|acme)');
    expect(normalizeOwnerInput('@(my-org|acme)')).toBe('@(my-org|acme)');
  });

  it('rejects genuinely malformed input (empty, whitespace, or URL/host separators)', () => {
    expect(normalizeOwnerInput('https://github.com')).toBeNull(); // URL-like, no owner
    expect(normalizeOwnerInput('git@github.com:owner')).toBeNull(); // host:single-segment, no repo
    expect(normalizeOwnerInput('owner with spaces')).toBeNull();
    expect(normalizeOwnerInput('')).toBeNull();
  });
});

describe('normalizeHostInput / normalizeRepoInput', () => {
  it('normalizes pasted full repo URLs by field', () => {
    expect(normalizeHostInput('git@github.com:acme/widgets.git')).toBe('github.com');
    expect(normalizeRepoInput('https://github.com/acme/widgets.git')).toBe('acme/widgets');
  });

  it('accepts valid literal globs and rejects malformed URL-like inputs', () => {
    expect(normalizeHostInput('*.gitlab.example.com')).toBe('*.gitlab.example.com');
    expect(normalizeHostInput('@(github|gitlab).com')).toBe('@(github|gitlab).com');
    expect(normalizeRepoInput('my-org/secret-*')).toBe('my-org/secret-*');
    expect(normalizeRepoInput('group/**/repo')).toBe('group/**/repo');

    expect(normalizeHostInput('https://github.com')).toBeNull();
    expect(normalizeHostInput('git@github.com')).toBeNull();
    expect(normalizeHostInput('git hub.com')).toBeNull();
    expect(normalizeRepoInput('github.com')).toBeNull();
    expect(normalizeRepoInput('https://github.com')).toBeNull();
    expect(normalizeRepoInput('owner with spaces/repo')).toBeNull();
  });
});

describe('selectRemotes', () => {
  const remotes = {
    origin: { host: 'github.com', owner: 'alice', name: 'widgets' },
    upstream: { host: 'github.com', owner: 'acme', name: 'widgets' },
  };

  const names = (spec: '*' | string | string[] | undefined): string[] =>
    selectRemotes(spec, remotes)
      .map((r) => r.name)
      .sort();

  it('treats "*" inside a remote list as all remotes', () => {
    expect(names(['*'])).toEqual(['origin', 'upstream']);
    expect(names(['origin', '*'])).toEqual(['origin', 'upstream']);
  });

  it('keeps named remote lists as an OR over those names', () => {
    expect(names(['origin'])).toEqual(['origin']);
    expect(names(['origin', 'missing'])).toEqual(['origin']);
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
      'config --local --get-regexp ^remote\\..*\\.url$':
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

  it('does not expose remotes when no repo root is found, even if git config reports remote URLs', () => {
    const { run, calls } = fakeRun({
      'rev-parse --show-toplevel': null,
      'rev-parse --abbrev-ref HEAD': null,
      'config --get-regexp ^remote\\..*\\.url$': 'remote.upstream.url git@github.com:acme/web.git',
      'config --local --get-regexp ^remote\\..*\\.url$': 'remote.upstream.url git@github.com:acme/web.git',
    });

    const ctx = buildGitContext('/not/a/repo', run);

    expect(ctx.repoRoot).toBeNull();
    expect(ctx.branch).toBeUndefined();
    expect(ctx.remotes).toEqual({});
    expect(calls.map((args) => args.join(' '))).not.toContain('config --get-regexp ^remote\\..*\\.url$');
    expect(calls.map((args) => args.join(' '))).not.toContain(
      'config --local --get-regexp ^remote\\..*\\.url$'
    );
  });

  it('reads remote URLs from local repo config only', () => {
    const { run, calls } = fakeRun({
      'rev-parse --show-toplevel': '/repo',
      'rev-parse --abbrev-ref HEAD': 'main',
      'config --local --get-regexp ^remote\\..*\\.url$':
        'remote.origin.url https://github.com/local/repo.git',
      'config --get-regexp ^remote\\..*\\.url$':
        'remote.origin.url https://github.com/local/repo.git\nremote.upstream.url git@github.com:global/leak.git',
    });

    const ctx = buildGitContext('/repo', run);

    expect(ctx.remotes).toEqual({
      origin: { host: 'github.com', owner: 'local', name: 'repo' },
    });
    expect(calls.map((args) => args.join(' '))).toContain(
      'config --local --get-regexp ^remote\\..*\\.url$'
    );
    expect(calls.map((args) => args.join(' '))).not.toContain('config --get-regexp ^remote\\..*\\.url$');
  });

  it('skips malformed / non-remote / unparseable config lines', () => {
    const { run } = fakeRun({
      'rev-parse --show-toplevel': '/repo',
      'rev-parse --abbrev-ref HEAD': 'main',
      'config --local --get-regexp ^remote\\..*\\.url$': [
        'remote.origin.url https://github.com/acme/web.git',
        'badlinewithnospace',
        'notaremote.key value',
        'remote.broken.url not-a-valid-url',
      ].join('\n'),
    });
    const ctx = buildGitContext('/repo', run);
    expect(Object.keys(ctx.remotes)).toEqual(['origin']);
  });

  it('preserves the first URL when a remote has multiple configured fetch URLs', () => {
    const { run } = fakeRun({
      'rev-parse --show-toplevel': '/repo',
      'rev-parse --abbrev-ref HEAD': 'main',
      'config --local --get-regexp ^remote\\..*\\.url$': [
        'remote.origin.url https://github.com/canonical/repo.git',
        'remote.origin.url https://github.com/mirror/repo.git',
      ].join('\n'),
    });

    expect(buildGitContext('/repo', run).remotes.origin).toEqual({
      host: 'github.com',
      owner: 'canonical',
      name: 'repo',
    });
  });

  it('caches per contextDir (run invoked once across calls)', () => {
    const { run, calls } = fakeRun({ 'rev-parse --show-toplevel': '/repo' });
    buildGitContext('/repo', run);
    const callsAfterFirst = calls.length;
    buildGitContext('/repo', run);
    expect(calls.length).toBe(callsAfterFirst); // second call served from cache
  });
});
