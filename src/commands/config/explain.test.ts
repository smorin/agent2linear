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

  it('formats an override label as `<scope> override <selector> (when <json>)` (A; M31 selector)', () => {
    // M31: a labeled rule is named by its label; an unlabeled rule by `#<ruleIndex>`.
    expect(
      sourceLabel({ type: 'override', scope: 'project', ruleId: 'cli-team', ruleIndex: 0, when: { path: 'cli/**' } })
    ).toBe('repo override cli-team (when {"path":"cli/**"})');
    expect(sourceLabel({ type: 'override', scope: 'global', ruleIndex: 2, when: {} })).toBe(
      'global override #2 (when {})'
    );
  });

  it('falls back to `#?` when neither label nor index is present (defensive)', () => {
    expect(sourceLabel({ type: 'override', scope: 'global', when: {} })).toBe('global override #? (when {})');
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
        { key: 'defaultTeam', value: 'cli-team', location: { type: 'override', scope: 'project', ruleIndex: 0, when: { path: 'cli/**' } } },
        { key: 'defaultInitiative', value: undefined, location: { type: 'none' } },
      ],
      rules: [],
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
      rules: [],
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
      rules: [],
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
    const data: ExplainData = { contextDir: '/x', repoRoot: null, remotes: {}, fields: [], rules: [] };
    expect(buildExplainJson(data).branch).toBeNull();
  });

  it('preserves a boolean value as a boolean (not a string) in JSON (G)', () => {
    const data: ExplainData = {
      contextDir: '/x',
      repoRoot: null,
      remotes: {},
      fields: [{ key: 'defaultAutoAssignLead', value: true, location: { type: 'profile' } }],
      rules: [],
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

  // --- M31 4a: label provenance -------------------------------------------------

  function writeLabeledOverride(): string {
    mkdirSync(join(repoRoot, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repoRoot, '.agent2linear', 'config.json'),
      JSON.stringify({
        defaultTeam: 'platform',
        overrides: [
          { id: 'cli-team', when: { path: 'cli/**' }, defaultTeam: 'cli-team' },
          { when: { path: 'mobile/**' }, defaultTeam: 'mobile-team' },
        ],
      })
    );
    mkdirSync(join(repoRoot, 'cli'), { recursive: true });
    mkdirSync(join(repoRoot, 'mobile'), { recursive: true });
    return join(repoRoot, 'cli');
  }

  it('4a: names the winning rule by its label in text + JSON (labeled rule)', () => {
    const cli = writeLabeledOverride();
    const data = buildExplainData(cli);
    expect(renderExplainText(data)).toContain('repo override cli-team (when {"path":"cli/**"})');
    const resolved = buildExplainJson(data).resolved as Record<string, { ruleId?: string }>;
    expect(resolved.defaultTeam.ruleId).toBe('cli-team');
  });

  it('4a: names an unlabeled winning rule by #<ruleIndex>', () => {
    writeLabeledOverride();
    const data = buildExplainData(join(repoRoot, 'mobile'));
    // The mobile rule is unlabeled and at array index 1.
    expect(renderExplainText(data)).toContain('repo override #1 (when {"path":"mobile/**"})');
    const resolved = buildExplainJson(data).resolved as Record<string, { ruleId?: string }>;
    expect(resolved.defaultTeam.ruleId).toBeUndefined();
  });

  // --- M31 4b (lite): the all-rules annotated view ------------------------------

  it('4b: annotates every rule ✓/✗ (driven by matchWhen) and echoes each `when`', () => {
    const cli = writeLabeledOverride();
    const data = buildExplainData(cli);
    // Both rules are present; the cli rule matches, the mobile rule does not.
    const cliRule = data.rules.find((r) => r.label === 'cli-team');
    const mobileRule = data.rules.find((r) => r.ruleIndex === 1 && r.scope === 'project');
    expect(cliRule?.matched).toBe(true);
    expect(mobileRule?.matched).toBe(false);
    // The winner annotates the field it wins; the non-matching rule wins nothing.
    expect(cliRule?.winsFields).toContain('defaultTeam');
    expect(mobileRule?.winsFields).toEqual([]);

    const text = renderExplainText(data);
    expect(text).toContain('✓ cli-team');
    expect(text).toContain('✗ #1');
    expect(text).toContain('when {"path":"cli/**"}'); // echoed `when` for the matching rule
    expect(text).toContain('when {"path":"mobile/**"}'); // and for the non-matching rule
  });

  it('4b: JSON envelope carries a top-level rules[] alongside the resolved map', () => {
    const cli = writeLabeledOverride();
    const json = buildExplainJson(buildExplainData(cli));
    expect(json.resolved).toBeTypeOf('object'); // existing map intact
    const rules = json.rules as Array<{ label: string; matched: boolean; winsFields: string[]; when: unknown }>;
    expect(Array.isArray(rules)).toBe(true);
    const cliRule = rules.find((r) => r.label === 'cli-team');
    expect(cliRule).toMatchObject({ matched: true, when: { path: 'cli/**' } });
    expect(cliRule?.winsFields).toContain('defaultTeam');
  });

  it('4b: a field in winsFields implies that rule matched (consistency invariant)', () => {
    const cli = writeLabeledOverride();
    const data = buildExplainData(cli);
    for (const rule of data.rules) {
      if (rule.winsFields.length > 0) {
        expect(rule.matched).toBe(true);
      }
    }
  });

  it('4b: annotates rules from BOTH scopes (global + project), keyed by scope+index', () => {
    // A global catch-all (matches everywhere) alongside a project path rule. Both must
    // appear in rules[], each attributed to its own scope — exercising the global
    // annotation branch + the scope-keyed `winsFields` aggregation (so a global #0 and a
    // project #0 can coexist without colliding).
    mkdirSync(join(xdgConfig, 'agent2linear'), { recursive: true });
    writeFileSync(
      join(xdgConfig, 'agent2linear', 'config.json'),
      JSON.stringify({ overrides: [{ id: 'global-default', when: {}, defaultInitiative: 'roadmap' }] })
    );
    const cli = writeLabeledOverride();

    const data = buildExplainData(cli);
    const globalRule = data.rules.find((r) => r.scope === 'global' && r.label === 'global-default');
    const projectRule = data.rules.find((r) => r.scope === 'project' && r.label === 'cli-team');
    expect(globalRule?.matched).toBe(true);
    expect(globalRule?.ruleIndex).toBe(0);
    expect(globalRule?.winsFields).toEqual(['defaultInitiative']); // global wins this field
    expect(projectRule?.matched).toBe(true);
    expect(projectRule?.ruleIndex).toBe(0); // same index as the global rule, different scope
    expect(projectRule?.winsFields).toContain('defaultTeam'); // project rule wins this one
    // The resolved fields agree: defaultTeam from the project rule, defaultInitiative from global.
    expect(data.fields.find((f) => f.key === 'defaultTeam')?.value).toBe('cli-team');
    expect(data.fields.find((f) => f.key === 'defaultInitiative')?.value).toBe('roadmap');
  });

  it('4b: a throwing rule (unsupported `when` key) renders ✗ without crashing', () => {
    mkdirSync(join(repoRoot, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repoRoot, '.agent2linear', 'config.json'),
      JSON.stringify({ overrides: [{ when: { bogus: 'x' }, defaultTeam: 'nope' }] })
    );
    const data = buildExplainData(repoRoot);
    expect(data.rules).toHaveLength(1);
    expect(data.rules[0].matched).toBe(false);
    expect(data.rules[0].winsFields).toEqual([]);
  });
});
