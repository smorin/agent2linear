/**
 * Context-aware override resolution (M29 §5.5/§5.6).
 *
 * For each overridable field independently, pick the value from the winning
 * matching rule, where "winning" is decided by (in order): scope (repo-local beats
 * global), specificity within a scope, then declaration order (later wins).
 *
 * Phase 2 evaluates AND'd leaf criteria: `path` plus identity (`repo`/`owner`/
 * `host`, read against `origin`) and `branch`. Composites (`allOf`/`anyOf`/`not`)
 * and the `remote` qualifier remain unsupported (warn-and-skip) until Phase 3; this
 * file is intentionally re-edited per phase so coverage stays meaningful.
 */

import { matchGlob, matchPath } from './glob-match.js';
import type { RemoteIdentity } from './git-context.js';
import { logger } from './logger.js';
import type { Aliases, ConfigLocation, ConfigOverride, OverridableConfig, WhenClause } from './types.js';

export interface OverrideContext {
  contextDir: string;
  repoRoot: string | null;
  branch?: string;
  remotes: Record<string, RemoteIdentity>;
}

export interface OverrideLayer {
  scope: 'global' | 'project';
  rules: ConfigOverride[];
}

export interface ResolvedOverrides {
  values: Partial<OverridableConfig>;
  locations: Record<string, ConfigLocation>;
  aliases: Partial<Aliases>;
}

/**
 * The scalar config keys an override rule may supply. Iterating this fixed
 * whitelist — never the rule's own keys — is what structurally guarantees
 * `apiKey`/`when`/`aliases` can never leak into a scalar config field (§5.1/§10).
 */
const OVERRIDABLE_FIELDS: readonly (keyof OverridableConfig)[] = [
  'defaultTeam',
  'defaultInitiative',
  'defaultProject',
  'defaultIssueTemplate',
  'defaultProjectTemplate',
  'defaultMilestoneTemplate',
  'defaultAutoAssignLead',
];

/**
 * `when` keys Phase 2 understands (AND'd leaves). `remote`/`allOf`/`anyOf`/`not`
 * remain unsupported ⇒ warn + skip (§9) until Phase 3.
 */
const KNOWN_WHEN_KEYS: readonly string[] = ['path', 'repo', 'owner', 'host', 'branch'];

/**
 * `when` keys that require the git/filesystem context to be resolved. If no
 * candidate rule declares one of these (only catch-alls), the caller can skip
 * building the git context entirely (§8 performance). Phase 3 adds `remote` +
 * recursion into composites.
 */
const CONTEXT_MATCHER_KEYS: readonly string[] = ['path', 'repo', 'owner', 'host', 'branch'];

/** Whether any candidate rule needs the git/filesystem context (so it's built lazily). */
export function needsGitContext(layers: OverrideLayer[]): boolean {
  return layers.some((layer) =>
    layer.rules.some((rule) => {
      const when = rule.when ?? {};
      return CONTEXT_MATCHER_KEYS.some((key) => key in when);
    })
  );
}

/** Path-tier specificity (§5.6): leading literal segments, then wildcard count. */
function pathSpecificity(pattern: string): { literalLeading: number; wildcardCount: number } {
  let p = pattern.startsWith('!') ? pattern.slice(1) : pattern;
  if (p.endsWith('/')) {
    p = `${p}**`;
  }
  const segments = p.split('/').filter((s) => s !== '');
  let literalLeading = 0;
  for (const segment of segments) {
    if (segment.includes('*')) {
      break;
    }
    literalLeading++;
  }
  const wildcardCount = segments.filter((s) => s.includes('*')).length;
  return { literalLeading, wildcardCount };
}

/**
 * Specificity sort key (ascending = weakest first), per §5.6. Lexicographic tuple —
 * earlier slots dominate, so tier ordering is structural rather than weight-tuned:
 *   [ scopeRank,         // repo-local always beats global (primary)
 *     exactRepo,         // exact `repo` (no wildcard) — strongest identity
 *     identityValue,     // repo-glob + owner + host (summed across AND'd leaves)
 *     pathPresent,       // a `path` criterion outranks `branch`
 *     pathLiteralLeading,// finer path = more leading literal segments
 *     -pathWildcards,    // then fewer wildcard segments
 *     branchPresent ]    // `branch` presence — lowest leaf tier
 * Because the rule only reaches scoring once its whole (AND'd) `when` matched, every
 * present leaf is a matched leaf. Declaration order is NOT in the key — a stable sort
 * preserves it, so exact ties resolve to the later-declared rule (applied last).
 */
function specificityKey(when: WhenClause, scope: 'global' | 'project'): number[] {
  const scopeRank = scope === 'project' ? 1 : 0;
  let exactRepo = 0;
  let identityValue = 0;
  if (when.repo !== undefined) {
    if (when.repo.includes('*')) {
      identityValue++;
    } else {
      exactRepo++;
    }
  }
  if (when.owner !== undefined) {
    identityValue++;
  }
  if (when.host !== undefined) {
    identityValue++;
  }
  let pathPresent = 0;
  let pathLiteralLeading = 0;
  let pathWildcards = 0;
  if (when.path !== undefined) {
    pathPresent = 1;
    const spec = pathSpecificity(when.path);
    pathLiteralLeading = spec.literalLeading;
    pathWildcards = spec.wildcardCount;
  }
  const branchPresent = when.branch !== undefined ? 1 : 0;
  return [scopeRank, exactRepo, identityValue, pathPresent, pathLiteralLeading, -pathWildcards, branchPresent];
}

/** Lexicographic compare of two equal-length numeric keys. */
function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

/**
 * Evaluate a `when` clause against the context. Returns whether it matches.
 * Throws on an unsupported `when` key or an invalid glob — the caller turns either
 * into a warn-and-skip (§9).
 */
function evaluateWhen(when: WhenClause, ctx: OverrideContext): boolean {
  const keys = Object.keys(when);
  if (keys.length === 0) {
    return true; // catch-all
  }
  const unsupported = keys.filter((k) => !KNOWN_WHEN_KEYS.includes(k));
  if (unsupported.length > 0) {
    throw new Error(`unsupported \`when\` key(s): ${unsupported.join(', ')}`);
  }

  // Every present leaf must match (AND). Identity reads `origin` (the `remote`
  // qualifier is Phase 3); a missing origin / detached HEAD makes its criterion
  // fail rather than throw (§9 graceful degradation).
  if (when.path !== undefined && !matchPath(when.path, ctx.contextDir, ctx.repoRoot)) {
    return false;
  }
  const origin = ctx.remotes.origin;
  if (when.repo !== undefined && !(origin !== undefined && matchGlob(when.repo, `${origin.owner}/${origin.name}`))) {
    return false;
  }
  if (when.owner !== undefined && !(origin !== undefined && matchGlob(when.owner, origin.owner))) {
    return false;
  }
  if (when.host !== undefined && !(origin !== undefined && matchGlob(when.host, origin.host))) {
    return false;
  }
  if (when.branch !== undefined && !(ctx.branch !== undefined && matchGlob(when.branch, ctx.branch))) {
    return false;
  }
  return true;
}

/** Overlay one rule's alias block onto the accumulator (strongest applied last). */
function applyAliases(into: Partial<Aliases>, from: Partial<Aliases>): void {
  const target = into as Record<string, Record<string, string>>;
  for (const [entityType, map] of Object.entries(from)) {
    target[entityType] ??= {};
    for (const [alias, id] of Object.entries(map)) {
      target[entityType][alias] = id;
    }
  }
}

/**
 * Resolve overrides across the given layers (global then repo, concatenated).
 * Returns the per-field winning values, their `'override'` provenance, and the
 * merged per-rule alias overlay.
 */
export function resolveOverrides(ctx: OverrideContext, layers: OverrideLayer[]): ResolvedOverrides {
  const matched: Array<{
    scope: 'global' | 'project';
    ruleIndex: number;
    rule: ConfigOverride;
    when: WhenClause;
    key: number[];
  }> = [];

  for (const layer of layers) {
    for (let ruleIndex = 0; ruleIndex < layer.rules.length; ruleIndex++) {
      const rule = layer.rules[ruleIndex];
      const when = rule.when ?? ({} as WhenClause);
      try {
        if (!evaluateWhen(when, ctx)) {
          continue;
        }
      } catch (error) {
        // evaluateWhen / matchPath only ever throw Error (unsupported key, invalid glob).
        logger.warn(`Skipping override rule (${layer.scope} #${ruleIndex}): ${(error as Error).message}`);
        continue;
      }
      matched.push({ scope: layer.scope, ruleIndex, rule, when, key: specificityKey(when, layer.scope) });
    }
  }

  // Stable sort, weakest → strongest. Stability preserves declaration order, so
  // equal-specificity ties let the later-declared rule (applied last) win.
  matched.sort((a, b) => compareKeys(a.key, b.key));

  const values: Partial<OverridableConfig> = {};
  const locations: Record<string, ConfigLocation> = {};
  const aliases: Partial<Aliases> = {};

  for (const m of matched) {
    const provenance: ConfigLocation = {
      type: 'override',
      scope: m.scope,
      ruleIndex: m.ruleIndex,
      when: m.when,
    };
    for (const field of OVERRIDABLE_FIELDS) {
      const value = m.rule[field];
      if (value !== undefined) {
        (values as Record<string, unknown>)[field] = value;
        locations[field] = provenance;
      }
    }
    if (m.rule.aliases) {
      applyAliases(aliases, m.rule.aliases);
    }
  }

  return { values, locations, aliases };
}
