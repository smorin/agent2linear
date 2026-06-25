import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../lib/git-context.js';
import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import type { ConfigLocation } from '../../lib/types.js';
import {
  buildExplainData,
  buildExplainJson,
  explainConfig,
  type ExplainData,
  renderExplainText,
  sourceLabel,
} from './explain.js';

describe('sourceLabel — provenance labels', () => {
  it('labels every location type', () => {
    expect(sourceLabel({ type: 'override', scope: 'project', when: { path: 'cli/**' } })).toMatch(/^repo override/);
    expect(sourceLabel({ type: 'override', scope: 'global', when: {} })).toMatch(/^global override/);
    expect(sourceLabel({ type: 'project' })).toBe('repo config');
    expect(sourceLabel({ type: 'profile' })).toBe('profile');
    expect(sourceLabel({ type: 'global' })).toBe('global config');
    expect(sourceLabel({ type: 'env' })).toBe('environment');
    expect(sourceLabel({ type: 'none' })).toBe('unset');
  });

  it('formats an override label as `<scope> override (when <json>)` (A)', () => {
    expect(sourceLabel({ type: 'override', scope: 'project', when: { path: 'cli/**' } })).toBe(
      'repo override (when {"path":"cli/**"})'
    );
    expect(sourceLabel({ type: 'override', scope: 'global', when: {} })).toBe('global override (when {})');
  });
});

describe('renderExplainText', () => {
  it('renders context + remotes/branch + per-field winner when an override matched', () => {
    const data: ExplainData = {
      contextDir: '/repo/cli',
      repoRoot: '/repo',
      branch: 'feature/login',
      remotes: {
        origin: { host: 'github.com', owner: 'myuser', name: 'web' },
        upstream: { host: 'github.com', owner: 'acme', name: 'web' },
      },
      fields: [
        { key: 'defaultTeam', value: 'cli-team', location: { type: 'override', scope: 'project', when: { path: 'cli/**' } } },
        { key: 'defaultInitiative', value: undefined, location: { type: 'none' } },
      ],
    };
    const text = renderExplainText(data);
    expect(text).toContain('contextDir  /repo/cli');
    expect(text).toContain('repoRoot    /repo');
    expect(text).toContain('origin → github.com  myuser/web');
    expect(text).toContain('upstream → github.com  acme/web');
    expect(text).toContain('branch      feature/login');
    expect(text).toContain('cli-team');
    expect(text).toContain('repo override');
    expect(text).toContain('(not set)');
    expect(text).not.toContain('(no override rules matched');
  });

  it('shows (none) for repoRoot/remotes/branch and the no-match note when nothing overrides', () => {
    const data: ExplainData = {
      contextDir: '/tmp/x',
      repoRoot: null,
      remotes: {},
      fields: [{ key: 'defaultTeam', value: 'platform', location: { type: 'global' } }],
    };
    const text = renderExplainText(data);
    expect(text).toContain('repoRoot    (none)');
    expect(text).toContain('remotes     (none)');
    expect(text).toContain('branch      (none)');
    expect(text).toContain('(no override rules matched this context)');
  });
});

describe('buildExplainJson', () => {
  it('adds override metadata only for override-sourced fields, plus git context', () => {
    const data: ExplainData = {
      contextDir: '/repo/cli',
      repoRoot: '/repo',
      branch: 'main',
      remotes: { origin: { host: 'github.com', owner: 'acme', name: 'web' } },
      fields: [
        {
          key: 'defaultTeam',
          value: 'cli-team',
          location: { type: 'override', scope: 'project', ruleIndex: 0, when: { path: 'cli/**' } } as ConfigLocation,
        },
        { key: 'defaultInitiative', value: undefined, location: { type: 'none' } },
      ],
    };
    const json = buildExplainJson(data);
    expect(json.contextDir).toBe('/repo/cli');
    expect(json.repoRoot).toBe('/repo');
    expect(json.branch).toBe('main');
    expect(json.remotes).toEqual({ origin: { host: 'github.com', owner: 'acme', name: 'web' } });
    const resolved = json.resolved as Record<string, unknown>;
    expect(resolved.defaultTeam).toEqual({
      value: 'cli-team',
      source: 'override',
      scope: 'project',
      ruleIndex: 0,
      when: { path: 'cli/**' },
    });
    expect(resolved.defaultInitiative).toEqual({ value: null, source: 'none' });
  });

  it('renders null branch as null in JSON', () => {
    const data: ExplainData = { contextDir: '/x', repoRoot: null, remotes: {}, fields: [] };
    expect(buildExplainJson(data).branch).toBeNull();
  });

  it('preserves a boolean value as a boolean (not a string) in JSON (G)', () => {
    const data: ExplainData = {
      contextDir: '/x',
      repoRoot: null,
      remotes: {},
      fields: [{ key: 'defaultAutoAssignLead', value: true, location: { type: 'profile' } }],
    };
    const resolved = buildExplainJson(data).resolved as Record<string, { value: unknown }>;
    expect(resolved.defaultAutoAssignLead.value).toBe(true);
  });
});

describe('buildExplainData / explainConfig — query path', () => {
  let xdgConfig: string;
  let repoRoot: string;

  beforeEach(() => {
    xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-explain-xdg-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'a2l-explain-repo-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
    resetInvocationContext();
    __resetGitContextCache();
  });

  afterEach(() => {
    resetInvocationContext();
    __resetGitContextCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs(); // restoreAllMocks does NOT undo stubEnv — unstub so env doesn't leak (K)
    rmSync(xdgConfig, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  function writeRepoOverride(): string {
    mkdirSync(join(repoRoot, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repoRoot, '.agent2linear', 'config.json'),
      JSON.stringify({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] })
    );
    const cli = join(repoRoot, 'cli');
    mkdirSync(cli, { recursive: true });
    return cli;
  }

  it('resolves an override for a real context dir (positional)', () => {
    const cli = writeRepoOverride();
    const data = buildExplainData(cli);
    const team = data.fields.find((f) => f.key === 'defaultTeam');
    expect(team?.value).toBe('cli-team');
    expect(team?.location.type).toBe('override');
    expect(data.repoRoot).not.toBeNull();
  });

  it('shows defaultPrompt with override provenance when a rule wins (M30)', () => {
    mkdirSync(join(repoRoot, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repoRoot, '.agent2linear', 'config.json'),
      JSON.stringify({
        defaultPrompt: 'general',
        overrides: [{ when: { path: 'mobile/**' }, defaultPrompt: 'mobile-issue' }],
      })
    );
    const mobile = join(repoRoot, 'mobile');
    mkdirSync(mobile, { recursive: true });

    const data = buildExplainData(mobile);
    const prompt = data.fields.find((f) => f.key === 'defaultPrompt');
    expect(prompt?.value).toBe('mobile-issue');
    expect(prompt?.location).toMatchObject({ type: 'override', scope: 'project' });
    expect(prompt?.location.when).toEqual({ path: 'mobile/**' });

    // It also surfaces in the JSON shape with override metadata.
    const resolved = buildExplainJson(data).resolved as Record<string, unknown>;
    expect(resolved.defaultPrompt).toMatchObject({ value: 'mobile-issue', source: 'override' });
  });

  it('falls back to the invocation context dir when no positional dir is given', () => {
    const cli = writeRepoOverride();
    setInvocationContext({ contextDir: cli });
    const data = buildExplainData();
    expect(data.fields.find((f) => f.key === 'defaultTeam')?.value).toBe('cli-team');
  });

  it('falls back to process.cwd() when neither positional nor context dir is set', () => {
    const data = buildExplainData();
    expect(data.fields).toHaveLength(8);
  });

  it('yields no override for a missing/repo-less dir without crashing (§9 query)', () => {
    const data = buildExplainData(join(tmpdir(), `a2l-explain-missing-${Date.now()}`));
    expect(data.fields.every((f) => f.location.type !== 'override')).toBe(true);
  });

  it('explainConfig prints text and json', async () => {
    const cli = writeRepoOverride();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await explainConfig(cli, {});
    expect(String(log.mock.calls[0][0])).toContain('cli-team');

    log.mockClear();
    await explainConfig(cli, { json: true });
    const out = String(log.mock.calls[0][0]);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out).resolved.defaultTeam.value).toBe('cli-team');
  });
});
