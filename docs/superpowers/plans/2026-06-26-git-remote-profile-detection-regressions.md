# Git Remote Profile Detection Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two P2 profile matching regressions: global git remotes leaking into workspace auto-detection, and `remote: ['*']` failing to behave as an all-remotes wildcard.

**Architecture:** Keep both fixes in the shared git context primitive so profile detection and config overrides stay consistent. `buildGitContext()` should expose only local repository remotes, and `selectRemotes()` should treat any remote selector list containing `'*'` as all remotes.

**Tech Stack:** TypeScript, Node.js `child_process.execFileSync`, Vitest, git CLI.

---

## File Structure

- Modify: `src/lib/git-context.ts`
  - `buildGitContext()`: return no remotes when `rev-parse --show-toplevel` fails; when inside a repo, read remotes with `git config --local --get-regexp`.
  - `selectRemotes()`: treat `'*'` inside string arrays as a wildcard.
- Modify: `src/lib/git-context.test.ts`
  - Add regression tests for local-only remote loading.
  - Add direct unit coverage for `selectRemotes(['*'], remotes)`.
  - Update existing injected fake git answers from `config --get-regexp ...` to `config --local --get-regexp ...`.
- Modify: `src/lib/profiles.test.ts`
  - Add profile-level regression coverage proving `remote: ['*']` checks every remote.

---

### Task 1: Restrict Git Remotes To The Local Repository

**Files:**
- Modify: `src/lib/git-context.test.ts`
- Modify: `src/lib/git-context.ts`

- [ ] **Step 1: Write failing injected regression tests**

In `src/lib/git-context.test.ts`, inside `describe('buildGitContext (injected run)', () => { ... })`, add these tests after `returns null repoRoot / empty remotes / no branch outside a repo`:

```ts
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
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run:

```bash
npm test -- src/lib/git-context.test.ts
```

Expected before the fix:
- The no-repo regression fails because `buildGitContext()` still calls plain `git config --get-regexp` and parses the fake `upstream`.
- The local-only regression fails because `buildGitContext()` does not call `config --local --get-regexp`.

- [ ] **Step 3: Update existing fake git answers to local config**

In `src/lib/git-context.test.ts`, update existing injected test fixtures that currently provide this key:

```ts
'config --get-regexp ^remote\\..*\\.url$'
```

to this key:

```ts
'config --local --get-regexp ^remote\\..*\\.url$'
```

Do this in the existing tests:
- `resolves repoRoot, branch, and all remotes`
- `skips malformed / non-remote / unparseable config lines`

- [ ] **Step 4: Implement local-only remote loading**

In `src/lib/git-context.ts`, replace the remote-loading block in `buildGitContext()` with:

```ts
  const remotes: Record<string, RemoteIdentity> = {};
  if (top) {
    const remotesOut = run(['config', '--local', '--get-regexp', '^remote\\..*\\.url$']);
    if (remotesOut) {
      for (const line of remotesOut.split('\n')) {
        const sp = line.indexOf(' ');
        if (sp === -1) {
          continue;
        }
        const nameMatch = /^remote\.(.+)\.url$/.exec(line.slice(0, sp));
        if (!nameMatch) {
          continue;
        }
        const identity = normalizeRemoteUrl(line.slice(sp + 1));
        if (identity) {
          remotes[nameMatch[1]] = identity;
        }
      }
    }
  }
```

Do not change `defaultGitRun()`. It already scopes the command to `git -C <contextDir>`.

- [ ] **Step 5: Add real-git global leak regression coverage**

In `src/lib/git-context.test.ts`, update the fs import:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
```

Inside `describe('defaultGitRun + buildGitContext (real git)', () => { ... })`, add this test after `reads a real repo via the default runner`:

```ts
  it('does not include remote URLs from global git config', () => {
    const globalConfig = join(tmpdir(), `a2l-global-gitconfig-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
```

- [ ] **Step 6: Run Task 1 tests**

Run:

```bash
npm test -- src/lib/git-context.test.ts
```

Expected after the fix: all `src/lib/git-context.test.ts` tests pass.

---

### Task 2: Treat `'*'` Inside Remote Lists As A Wildcard

**Files:**
- Modify: `src/lib/git-context.test.ts`
- Modify: `src/lib/profiles.test.ts`
- Modify: `src/lib/git-context.ts`

- [ ] **Step 1: Add direct `selectRemotes()` regression tests**

In `src/lib/git-context.test.ts`, add `selectRemotes` to the import list:

```ts
  selectRemotes,
```

Add this `describe()` block before `describe('buildGitContext (injected run)', () => { ... })`:

```ts
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
```

- [ ] **Step 2: Add profile-level regression coverage**

In `src/lib/profiles.test.ts`, inside `describe('detectProfile - remote selection + fork predicate (M31 Phase 3)', () => { ... })`, add this after `remote: "*" matches if ANY remote satisfies`:

```ts
  it('remote: ["*"] matches if ANY remote satisfies', () => {
    const profiles: Record<string, Profile> = {
      p: { workspace: 'p', match: { remote: ['*'], gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'p', exclude: false });
  });
```

- [ ] **Step 3: Run targeted tests and confirm failure**

Run:

```bash
npm test -- src/lib/git-context.test.ts src/lib/profiles.test.ts
```

Expected before the fix:
- `selectRemotes(['*'], remotes)` returns `[]`.
- The profile test returns `null` instead of matching `upstream`.

- [ ] **Step 4: Implement wildcard-list handling**

In `src/lib/git-context.ts`, update `selectRemotes()` from:

```ts
  const names = Array.isArray(spec) ? spec : [spec];
  return all.filter((r) => names.includes(r.name));
```

to:

```ts
  const names = Array.isArray(spec) ? spec : [spec];
  if (names.includes('*')) {
    return all;
  }
  return all.filter((r) => names.includes(r.name));
```

- [ ] **Step 5: Run Task 2 tests**

Run:

```bash
npm test -- src/lib/git-context.test.ts src/lib/profiles.test.ts
```

Expected after the fix: all targeted tests pass.

---

### Task 3: Full Verification

**Files:**
- No additional file changes.

- [ ] **Step 1: Run all unit tests**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run type checking**

Run:

```bash
npm run typecheck
```

Expected: `tsc --noEmit` completes successfully.

- [ ] **Step 3: Optional lint check**

Run:

```bash
npm run lint
```

Expected: ESLint completes successfully.

---

## Review Reply Summary

Use this wording after implementation:

```text
Fixed both P2 profile matching regressions.

- Git context now reads remotes from local repository config only and returns no remotes when there is no repo root, preventing global `remote.*.url` entries from driving profile auto-detection.
- Remote selector lists now treat `'*'` as a wildcard, so `remote: ['*']` behaves the same as `remote: '*'`.

Regression coverage added for local-only remote loading, global config leakage, direct wildcard list selection, and profile-level `remote: ['*']` matching.
```
