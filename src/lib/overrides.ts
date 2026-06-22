/**
 * Context-aware override resolution (M29 §5.5/§5.6).
 *
 * For each overridable field independently, pick the value from the winning
 * matching rule, where "winning" is decided by (in order): scope (repo-local beats
 * global), specificity within a scope, then declaration order (later wins).
 *
 * Phase 1 evaluates **only** the `path` leaf and the empty/absent catch-all. Any
 * other `when` key (identity/branch/composites — later phases) triggers a
 * warn-and-skip; this file is intentionally re-edited in Phases 2–3 as those
 * matchers become reachable (so coverage stays meaningful per phase).
 */

import { matchPath } from './glob-match.js';
import { logger } from './logger.js';
import type { Aliases, ConfigLocation, ConfigOverride, OverridableConfig, WhenClause } from './types.js';

export interface OverrideContext {
  contextDir: string;
  repoRoot: string | null;
  // git fields (branch, remotes) added in Phase 2
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

/** `when` keys Phase 1 understands. Anything else ⇒ warn + skip (§9). */
const KNOWN_WHEN_KEYS: readonly string[] = ['path'];

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
 * Specificity sort key (ascending = weakest first), per §5.6:
 *   [scopeRank, tier, literalLeading, -wildcardCount]
 * Scope is primary (repo-local always beats global). Declaration order is NOT in
 * the key — a stable sort preserves it, so equal-specificity ties resolve to the
 * later-declared rule when applied weakest→strongest.
 */
function specificityKey(when: WhenClause, scope: 'global' | 'project'): number[] {
  const scopeRank = scope === 'project' ? 1 : 0;
  if (when.path === undefined) {
    return [scopeRank, 0, 0, 0]; // catch-all (empty when) — lowest tier
  }
  const { literalLeading, wildcardCount } = pathSpecificity(when.path);
  return [scopeRank, 1, literalLeading, -wildcardCount];
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
  return matchPath(when.path as string, ctx.contextDir, ctx.repoRoot);
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
