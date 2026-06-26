/**
 * Phase-1 additivity keystone (M31): the new top-level `id` on a rule is inert to
 * the M29 resolver. These assertions guard the milestone's core invariant —
 * authoring metadata never leaks into resolved config values, and a config with no
 * `overrides` behaves byte-identically to today.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig } from '../../../lib/config.js';
import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

function writeGlobal(cfg: unknown): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
}

/**
 * Write a project `.agent2linear/config.json` at `workdir`. The presence of the
 * `.agent2linear/` directory establishes the repoRoot that anchors a relative
 * `path` override (no git needed — mirrors `config.xdg.test.ts`'s writeRepo).
 */
function writeRepo(cfg: unknown): void {
  const dir = join(workdir, '.agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovadd-add-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovadd-add-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  process.chdir(workdir);
  resetInvocationContext();
  __resetGitContextCache();
});

afterEach(() => {
  process.chdir(origCwd);
  resetInvocationContext();
  __resetGitContextCache();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('M31 additivity', () => {
  it('(a) a config with no overrides resolves byte-identically to an empty overrides[]', () => {
    writeGlobal({ defaultTeam: 'platform' });
    const noOverrides = getConfig();
    resetInvocationContext();
    __resetGitContextCache();

    writeGlobal({ defaultTeam: 'platform', overrides: [] });
    const emptyOverrides = getConfig();

    expect(emptyOverrides.defaultTeam).toBe(noOverrides.defaultTeam);
    expect(emptyOverrides.locations.defaultTeam).toEqual(noOverrides.locations.defaultTeam);
  });

  it('(b) a rule written WITH an id round-trips and the resolver ignores id', () => {
    // A relative `path: '**'` anchored at the repoRoot established by .agent2linear/;
    // at the repo root itself, only `**` matches (matchPath semantics).
    writeRepo({
      overrides: [{ id: 'cli-rule', when: { path: '**' }, defaultTeam: 'cli-team' }],
    });
    const resolved = getConfig();

    // The value is resolved, with override provenance...
    expect(resolved.defaultTeam).toBe('cli-team');
    expect(resolved.locations.defaultTeam.type).toBe('override');
    // ...but `id` never surfaces as a resolved config value.
    const asRecord = resolved as unknown as Record<string, unknown>;
    expect(asRecord.id).toBeUndefined();
    expect(Object.values(asRecord)).not.toContain('cli-rule');
  });

  it('(b) apiKey can never be supplied by an override rule', () => {
    writeRepo({
      // A hand-written rule that tries to smuggle apiKey is structurally ignored
      // by the resolver (it iterates OVERRIDABLE_FIELDS, never the rule's own keys).
      overrides: [{ id: 'evil', when: { path: '**' }, apiKey: 'lin_api_leak' } as never],
    });
    const resolved = getConfig();
    expect(resolved.apiKey).toBeUndefined();
  });
});
