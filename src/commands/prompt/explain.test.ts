import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../lib/git-context.js';
import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import {
  buildPromptExplainData,
  buildPromptExplainJson,
  explainPrompt,
  type PromptExplainData,
  renderPromptExplainText,
} from './explain.js';

/**
 * M30 Phase 4 — `prompt explain`. Mirrors `config/explain.test.ts`: pure renderers are
 * unit-tested against hand-constructed data over ALL FOUR selection tiers (explicit /
 * location / team / general), and the query path (`buildPromptExplainData` /
 * `explainPrompt`) is exercised against real temp dirs with a stubbed XDG_CONFIG_HOME for
 * location / team / general (the `explicit` tier has no surface on explain's `[dir]`/JSON
 * API, matching the spec — it's covered only by the renderer unit tests).
 */

function makeData(overrides: Partial<PromptExplainData> = {}): PromptExplainData {
  return {
    contextDir: '/repo',
    repoRoot: '/repo',
    branch: 'main',
    remotes: {},
    defaultPrompt: 'general',
    defaultPromptLocation: { type: 'global' },
    team: { explicit: false },
    matchedRule: null,
    selection: 'general',
    selectedName: 'general',
    ...overrides,
  };
}

describe('renderPromptExplainText — four selection tiers', () => {
  it('renders the general tier', () => {
    const text = renderPromptExplainText(makeData({ selection: 'general', selectedName: 'general' }));
    expect(text).toContain('defaultPrompt:');
    expect(text).toContain('general');
    expect(text).toContain('← general');
  });

  it('renders the explicit tier', () => {
    const text = renderPromptExplainText(makeData({ selection: 'explicit', selectedName: 'one-off' }));
    expect(text).toContain('one-off');
    expect(text).toContain('← explicit');
  });

  it('renders the location tier with override provenance', () => {
    const text = renderPromptExplainText(
      makeData({
        defaultPrompt: 'mobile-issue',
        defaultPromptLocation: { type: 'override', scope: 'project', when: { path: 'mobile/**' } },
        selection: 'location',
        selectedName: 'mobile-issue',
      })
    );
    expect(text).toContain('repo override');
    expect(text).toContain('← location');
  });

  it('renders the team tier with the matched rule shown', () => {
    const text = renderPromptExplainText(
      makeData({
        team: { input: 'payments', resolved: 'team_pay', explicit: true },
        matchedRule: { scope: 'project', when: { team: 'payments' }, prompt: 'pay-issue' },
        selection: 'team',
        selectedName: 'pay-issue',
      })
    );
    expect(text).toContain('payments → team_pay');
    expect(text).toContain('(--team)');
    expect(text).toContain('matched rule');
    expect(text).toContain('pay-issue');
    expect(text).toContain('← team');
  });

  it('surfaces the matched rule even when a location override wins', () => {
    const text = renderPromptExplainText(
      makeData({
        defaultPrompt: 'mobile-issue',
        defaultPromptLocation: { type: 'override', scope: 'project', when: { path: 'mobile/**' } },
        team: { input: 'team_pay', resolved: 'team_pay', explicit: false },
        matchedRule: { scope: 'project', when: { team: 'team_pay' }, prompt: 'pay-issue' },
        selection: 'location',
        selectedName: 'mobile-issue',
      })
    );
    // Both are shown: the matched team rule AND the final location selection.
    expect(text).toContain('matched rule');
    expect(text).toContain('pay-issue');
    expect(text).toContain('← location');
  });

  it('renders an unresolved selection without throwing', () => {
    const text = renderPromptExplainText(
      makeData({ defaultPrompt: undefined, defaultPromptLocation: { type: 'none' }, selection: null, selectedName: null, error: 'No prompt configured' })
    );
    expect(text).toContain('(not set)');
    expect(text).toContain('(unresolved)');
    expect(text).toContain('No prompt configured');
  });
});

describe('buildPromptExplainJson', () => {
  it('emits override metadata for a location-resolved defaultPrompt', () => {
    const json = buildPromptExplainJson(
      makeData({
        defaultPrompt: 'mobile-issue',
        defaultPromptLocation: { type: 'override', scope: 'project', ruleIndex: 0, when: { path: 'mobile/**' } },
        selection: 'location',
        selectedName: 'mobile-issue',
      })
    );
    expect(json.defaultPrompt).toEqual({
      value: 'mobile-issue',
      source: 'override',
      scope: 'project',
      ruleIndex: 0,
      when: { path: 'mobile/**' },
    });
    expect(json.selection).toBe('location');
    expect(json.selectedName).toBe('mobile-issue');
  });

  it('emits the team block + matched rule and null branch when applicable', () => {
    const json = buildPromptExplainJson(
      makeData({
        repoRoot: null,
        branch: undefined,
        team: { input: 'payments', resolved: 'team_pay', explicit: true },
        matchedRule: { scope: 'global', when: { team: 'payments' }, prompt: 'pay-issue' },
        selection: 'team',
        selectedName: 'pay-issue',
      })
    );
    expect(json.branch).toBeNull();
    expect(json.team).toEqual({ input: 'payments', resolved: 'team_pay', explicit: true });
    expect(json.matchedRule).toEqual({ scope: 'global', when: { team: 'payments' }, prompt: 'pay-issue' });
  });

  it('emits null defaults/selection on an unresolved trace', () => {
    const json = buildPromptExplainJson(
      makeData({ defaultPrompt: undefined, defaultPromptLocation: { type: 'none' }, team: { explicit: false }, matchedRule: null, selection: null, selectedName: null, error: 'No prompt configured' })
    );
    const dp = json.defaultPrompt as Record<string, unknown>;
    expect(dp.value).toBeNull();
    expect(dp.source).toBe('none');
    expect(json.matchedRule).toBeNull();
    expect(json.selection).toBeNull();
    expect(json.selectedName).toBeNull();
    expect(json.error).toBe('No prompt configured');
  });
});

describe('buildPromptExplainData / explainPrompt — query path', () => {
  let xdgConfig: string;
  let repoRoot: string;
  let originalCwd: string;

  // The body resolver discovers prompts.json by walking up from process.cwd() (the
  // `-C` lever does process.chdir in production, cli.ts:82). So chdir into the fixture
  // repo and pass `dir` only as the override-resolution context — exactly the real
  // positional usage (cwd in-project, `dir` = subdir).
  beforeEach(() => {
    originalCwd = process.cwd();
    xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-prompt-explain-xdg-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'a2l-prompt-explain-repo-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
    resetInvocationContext();
    __resetGitContextCache();
  });

  afterEach(() => {
    process.chdir(originalCwd); // leave the fixture before removing it (chdir leaks across files)
    resetInvocationContext();
    __resetGitContextCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(xdgConfig, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  function writeRepo(config: object, prompts: object): void {
    mkdirSync(join(repoRoot, '.agent2linear'), { recursive: true });
    writeFileSync(join(repoRoot, '.agent2linear', 'config.json'), JSON.stringify(config));
    writeFileSync(join(repoRoot, '.agent2linear', 'prompts.json'), JSON.stringify(prompts));
    process.chdir(repoRoot);
  }

  it('general tier: top-level defaultPrompt, no team rule', () => {
    writeRepo(
      { defaultPrompt: 'general' },
      { prompts: { general: { body: 'GENERAL' } } }
    );
    const data = buildPromptExplainData(repoRoot);
    expect(data.defaultPrompt).toBe('general');
    expect(data.selection).toBe('general');
    expect(data.selectedName).toBe('general');
    expect(data.matchedRule).toBeNull();
  });

  it('location tier: a path override resolves defaultPrompt and wins', () => {
    writeRepo(
      { defaultPrompt: 'general', overrides: [{ when: { path: 'mobile/**' }, defaultPrompt: 'mobile-issue' }] },
      { prompts: { general: { body: 'G' }, 'mobile-issue': { body: 'M' } } }
    );
    const mobile = join(repoRoot, 'mobile');
    mkdirSync(mobile, { recursive: true });
    const data = buildPromptExplainData(mobile);
    expect(data.defaultPrompt).toBe('mobile-issue');
    expect(data.defaultPromptLocation).toMatchObject({ type: 'override', scope: 'project' });
    expect(data.selection).toBe('location');
    expect(data.selectedName).toBe('mobile-issue');
  });

  it('team tier: a derived defaultTeam matches a promptRule and surfaces the matched rule', () => {
    writeRepo(
      { defaultPrompt: 'general', defaultTeam: 'team_pay' },
      {
        prompts: { general: { body: 'G' }, 'pay-issue': { body: 'P' } },
        promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
      }
    );
    const data = buildPromptExplainData(repoRoot);
    expect(data.team.input).toBe('team_pay');
    expect(data.team.resolved).toBe('team_pay');
    expect(data.matchedRule).toMatchObject({ prompt: 'pay-issue', scope: 'project' });
    expect(data.selection).toBe('team');
    expect(data.selectedName).toBe('pay-issue');
  });

  it('shows the matched rule even when a location override outranks it', () => {
    writeRepo(
      {
        defaultPrompt: 'general',
        defaultTeam: 'team_pay',
        overrides: [{ when: { path: 'mobile/**' }, defaultPrompt: 'mobile-issue' }],
      },
      {
        prompts: { general: { body: 'G' }, 'mobile-issue': { body: 'M' }, 'pay-issue': { body: 'P' } },
        promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
      }
    );
    const mobile = join(repoRoot, 'mobile');
    mkdirSync(mobile, { recursive: true });
    const data = buildPromptExplainData(mobile);
    // Final selection is the location override...
    expect(data.selection).toBe('location');
    expect(data.selectedName).toBe('mobile-issue');
    // ...but the matched team rule is still surfaced as a diagnostic.
    expect(data.matchedRule).toMatchObject({ prompt: 'pay-issue' });
  });

  it('explicit --team with no matching rule renders the error in the trace (never exits)', () => {
    writeRepo(
      { defaultPrompt: 'general', defaultTeam: 'team_pay' },
      {
        prompts: { general: { body: 'G' }, 'pay-issue': { body: 'P' } },
        promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
      }
    );
    const data = buildPromptExplainData(repoRoot, { team: 'team_other' });
    expect(data.selection).toBeNull();
    expect(data.error).toMatch(/No prompt configured for team/);
  });

  it('falls back to the invocation context dir when no positional dir is given', () => {
    writeRepo({ defaultPrompt: 'general' }, { prompts: { general: { body: 'G' } } });
    setInvocationContext({ contextDir: repoRoot });
    const data = buildPromptExplainData();
    expect(data.selectedName).toBe('general');
  });

  it('explainPrompt prints text and json', async () => {
    writeRepo({ defaultPrompt: 'general' }, { prompts: { general: { body: 'G' } } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await explainPrompt(repoRoot, {});
    expect(String(log.mock.calls[0][0])).toContain('defaultPrompt:');

    log.mockClear();
    await explainPrompt(repoRoot, { json: true });
    const out = String(log.mock.calls[0][0]);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(JSON.parse(out).selection).toBe('general');
    expect(JSON.parse(out).selectedName).toBe('general');
  });
});
