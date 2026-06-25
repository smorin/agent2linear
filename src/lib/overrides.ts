/**
 * Context-aware override resolution (M29 §5.5/§5.6).
 *
 * For each overridable field independently, pick the value from the winning
 * matching rule, where "winning" is decided by (in order): scope (repo-local beats
 * global), specificity within a scope, then declaration order (later wins).
 *
 * Phase 3 makes the `when` tree fully recursive: leaf criteria (`path` + identity
 * `repo`/`owner`/`host` + `branch`) AND'd with the boolean composites `allOf`/
 * `anyOf`/`not`, and the `remote` qualifier selecting which remote(s) identity reads
 * (default `origin`; a name / list / `"*"`; bare `remote` = "a remote of that name
 * exists"). Matching and scoring are unified in one recursive `matchWhen` because
 * §5.6 specificity is match-dependent (an `anyOf` scores as its most-specific
 * *matching* branch).
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
  // M30 Phase 3: the resolved team id for the prompt team layer. Only consulted
  // when matchWhen is called with `{ allowTeam: true }` (the prompt path); the
  // config-field path never sets `allowTeam`, so this is ignored there.
  team?: string;
}

/** Options for `matchWhen`. `allowTeam` gates the prompt-store-only `team` matcher. */
export interface MatchWhenOptions {
  allowTeam?: boolean;
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
  'defaultPrompt',
  'defaultAutoAssignLead',
];

/** `when` keys Phase 3 understands. Anything else ⇒ warn + skip (§9). */
const KNOWN_WHEN_KEYS: readonly string[] = [
  'path',
  'repo',
  'owner',
  'host',
  'branch',
  'remote',
  'allOf',
  'anyOf',
  'not',
];

/** Leaf `when` keys that require the git/filesystem context to be resolved (§8). */
const CONTEXT_MATCHER_KEYS: readonly string[] = ['path', 'repo', 'owner', 'host', 'branch', 'remote'];

/** Type guard: a usable `when` node is a non-null, non-array object. */
function isWhenObject(value: unknown): value is WhenClause {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether a single `when` node (recursing into composites) needs the git context.
 * Runs before `resolveOverrides`'s warn-and-skip try/catch (§8 lazy git), so it must
 * never throw on a malformed config — a bad shape is simply "needs nothing" here, and
 * is rejected later by `matchWhen` (which warn-skips the rule).
 */
function whenNeedsContext(node: unknown): boolean {
  if (!isWhenObject(node)) {
    return false;
  }
  if (CONTEXT_MATCHER_KEYS.some((key) => key in node)) {
    return true;
  }
  if (Array.isArray(node.allOf) && node.allOf.some(whenNeedsContext)) {
    return true;
  }
  if (Array.isArray(node.anyOf) && node.anyOf.some(whenNeedsContext)) {
    return true;
  }
  return node.not !== undefined && whenNeedsContext(node.not);
}

/** Identity/path leaf keys that make a `when` clause "location-specific" (M30 Phase 3). */
const LOCATION_MATCHER_KEYS: readonly string[] = ['path', 'repo', 'owner', 'host'];

/**
 * Whether a `when` clause is "location-specific" (M30 Phase 3): a `path`/`repo`/
 * `owner`/`host` matcher present anywhere (recursing `allOf`/`anyOf`/`not`). A
 * branch-only clause, a catch-all `{}`, and `undefined` are NOT location-specific.
 *
 * Load-bearing for the prompt tiering (location override > team > general): a
 * `defaultPrompt` set by a location-specific override outranks the team layer,
 * while a branch-only or catch-all override is general-tier. Purely structural
 * (not match-dependent) and malformed-safe (mirrors `whenNeedsContext`): never
 * throws on a bad shape — that is simply "not location-specific" here.
 */
export function whenIsLocationSpecific(node: unknown): boolean {
  if (!isWhenObject(node)) {
    return false;
  }
  if (LOCATION_MATCHER_KEYS.some((key) => key in node)) {
    return true;
  }
  if (Array.isArray(node.allOf) && node.allOf.some(whenIsLocationSpecific)) {
    return true;
  }
  if (Array.isArray(node.anyOf) && node.anyOf.some(whenIsLocationSpecific)) {
    return true;
  }
  return node.not !== undefined && whenIsLocationSpecific(node.not);
}

/**
 * Whether a string carries a glob metacharacter picomatch honors (`* ? [ ] { } ( )`,
 * the last covering extglobs like `@(a|b)`). Specificity scoring (§5.6) uses this so a
 * pattern's "literal vs glob" classification agrees with the actual matchers in
 * glob-match.ts (which run picomatch) — e.g. `acme/w?b` is a glob, not an exact repo.
 */
function hasGlobMeta(s: string): boolean {
  return /[*?[\]{}()]/.test(s);
}

/** Whether any candidate rule needs the git/filesystem context (so it's built lazily). */
export function needsGitContext(layers: OverrideLayer[]): boolean {
  return layers.some((layer) => layer.rules.some((rule) => whenNeedsContext(rule.when ?? {})));
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
    if (hasGlobMeta(segment)) {
      break;
    }
    literalLeading++;
  }
  const wildcardCount = segments.filter((s) => hasGlobMeta(s)).length;
  return { literalLeading, wildcardCount };
}

/**
 * Per-node specificity score (§5.6), as a lexicographic tuple where earlier slots
 * dominate (tier ordering is structural, not weight-tuned). `resolveOverrides`
 * prepends `scopeRank` (repo-local beats global). Indices:
 *   0 exactRepo   — exact `repo` value match (no wildcard), strongest identity
 *   1 idValue     — repo-glob + owner value matches
 *   2 idPresence  — `host` + a bare `remote`-presence predicate (below repo/owner value)
 *   3 pathPresent
 *   4 pathLiteral — more leading literal path segments = finer
 *   5 -pathWild   — then fewer wildcard segments
 *   6 branch      — `branch` presence (lowest leaf tier)
 *   7 notPresence — a matched `not` clause contributes presence only (never negative)
 *   8 originBonus — identity matched via `origin` outranks a non-origin remote (tiebreak)
 */
type Spec = number[];
const SPEC_LEN = 9;
const zeroSpec = (): Spec => new Array<number>(SPEC_LEN).fill(0);

/** Lexicographically larger of two specs (for `anyOf`'s most-specific branch). */
function maxSpec(a: Spec, b: Spec): Spec {
  return compareKeys(a, b) >= 0 ? a : b;
}

/** Lexicographic compare of two equal-length numeric keys. */
export function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

/** Resolve the remote(s) a node's identity reads: default `origin`, a name, a list, or `"*"`. */
function selectRemotes(
  spec: WhenClause['remote'],
  remotes: Record<string, RemoteIdentity>
): Array<{ name: string; identity: RemoteIdentity }> {
  const all = Object.entries(remotes).map(([name, identity]) => ({ name, identity }));
  if (spec === undefined) {
    return all.filter((r) => r.name === 'origin');
  }
  if (spec === '*') {
    return all;
  }
  const names = Array.isArray(spec) ? spec : [spec];
  return all.filter((r) => names.includes(r.name));
}

/** Whether a remote's identity satisfies the node's identity criteria (those present). */
function identitySatisfies(node: WhenClause, id: RemoteIdentity): boolean {
  if (node.repo !== undefined && !matchGlob(node.repo, `${id.owner}/${id.name}`)) {
    return false;
  }
  if (node.owner !== undefined && !matchGlob(node.owner, id.owner)) {
    return false;
  }
  if (node.host !== undefined && !matchGlob(node.host, id.host)) {
    return false;
  }
  return true;
}

/**
 * Recursively evaluate a `when` node (§5.2.1): every present key is AND'd; identity
 * reads the node's selected remote(s); `allOf`/`anyOf`/`not` compose. Returns whether
 * it matched and the §5.6 specificity it earned. Throws on an unsupported key — the
 * caller turns that into a warn-and-skip (§9). Graceful: a missing remote / detached
 * HEAD makes a criterion fail rather than throw.
 */
export function matchWhen(
  node: WhenClause,
  ctx: OverrideContext,
  opts?: MatchWhenOptions
): { matched: boolean; score: Spec } {
  const fail = { matched: false, score: zeroSpec() };
  // Reject malformed composite shapes up front so the caller's try/catch turns them
  // into a clear warn-and-skip (§9) instead of an opaque "not iterable"/"in null".
  if (!isWhenObject(node)) {
    throw new Error('invalid `when`: expected an object');
  }
  if (node.allOf !== undefined && !Array.isArray(node.allOf)) {
    throw new Error('invalid `when.allOf`: expected an array');
  }
  if (node.anyOf !== undefined && !Array.isArray(node.anyOf)) {
    throw new Error('invalid `when.anyOf`: expected an array');
  }
  if (node.not !== undefined && !isWhenObject(node.not)) {
    throw new Error('invalid `when.not`: expected an object');
  }
  // `team` is recognized ONLY when `allowTeam` is set (the prompt path). The config
  // path passes no opts, so a `team` key in a config `overrides[]` is unsupported and
  // hits the warn-and-skip below — config-field resolution stays byte-identical.
  const allowedKeys = opts?.allowTeam ? [...KNOWN_WHEN_KEYS, 'team'] : KNOWN_WHEN_KEYS;
  const unsupported = Object.keys(node).filter((k) => !allowedKeys.includes(k));
  if (unsupported.length > 0) {
    throw new Error(`unsupported \`when\` key(s): ${unsupported.join(', ')}`);
  }

  const score = zeroSpec();
  const hasIdentity = node.repo !== undefined || node.owner !== undefined || node.host !== undefined;

  if (hasIdentity) {
    const selected = selectRemotes(node.remote, ctx.remotes).filter((r) => identitySatisfies(node, r.identity));
    if (selected.length === 0) {
      return fail;
    }
    if (node.repo !== undefined) {
      if (hasGlobMeta(node.repo)) {
        score[1] += 1;
      } else {
        score[0] += 1;
      }
    }
    if (node.owner !== undefined) {
      score[1] += 1;
    }
    if (node.host !== undefined) {
      score[2] += 1;
    }
    if (selected.some((r) => r.name === 'origin')) {
      score[8] = 1;
    }
  } else if (node.remote !== undefined) {
    // Bare `remote` predicate: matches if a selected remote exists ("this is a fork").
    const selected = selectRemotes(node.remote, ctx.remotes);
    if (selected.length === 0) {
      return fail;
    }
    score[2] += 1;
    if (selected.some((r) => r.name === 'origin')) {
      score[8] = 1;
    }
  }

  if (node.path !== undefined) {
    if (!matchPath(node.path, ctx.contextDir, ctx.repoRoot)) {
      return fail;
    }
    const spec = pathSpecificity(node.path);
    score[3] = 1;
    score[4] += spec.literalLeading;
    score[5] += -spec.wildcardCount;
  }

  if (node.branch !== undefined) {
    if (ctx.branch === undefined || !matchGlob(node.branch, ctx.branch)) {
      return fail;
    }
    score[6] = 1;
  }

  // M30 Phase 3: prompt-store-only `team` matcher (gated by `allowTeam`). Compares
  // like `branch` — graceful-fail (no throw) when `ctx.team` is undefined. The key is
  // already validated as supported above only when `allowTeam` is set.
  const teamPattern = (node as { team?: string }).team;
  if (teamPattern !== undefined) {
    if (ctx.team === undefined || !matchGlob(teamPattern, ctx.team)) {
      return fail;
    }
    score[6] = 1;
  }

  if (node.allOf !== undefined) {
    for (const child of node.allOf) {
      const result = matchWhen(child, ctx, opts);
      if (!result.matched) {
        return fail;
      }
      addInto(score, result.score);
    }
  }

  if (node.anyOf !== undefined) {
    if (node.anyOf.length === 0) {
      logger.warn('Override `when` has an empty `anyOf: []` (matches nothing); did you mean `allOf`?');
      return fail;
    }
    let best: Spec | null = null;
    for (const child of node.anyOf) {
      const result = matchWhen(child, ctx, opts);
      if (result.matched) {
        best = best === null ? result.score : maxSpec(best, result.score);
      }
    }
    if (best === null) {
      return fail;
    }
    addInto(score, best);
  }

  if (node.not !== undefined) {
    if (matchWhen(node.not, ctx, opts).matched) {
      return fail;
    }
    score[7] += 1;
  }

  return { matched: true, score };
}

/** In-place element-wise add (keeps the running node score a single array). */
function addInto(target: Spec, addend: Spec): void {
  for (let i = 0; i < target.length; i++) {
    target[i] += addend[i];
  }
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
    const scopeRank = layer.scope === 'project' ? 1 : 0;
    for (let ruleIndex = 0; ruleIndex < layer.rules.length; ruleIndex++) {
      const rule = layer.rules[ruleIndex];
      const when = rule.when ?? ({} as WhenClause);
      let result: { matched: boolean; score: Spec };
      try {
        result = matchWhen(when, ctx);
      } catch (error) {
        // matchWhen / matchPath only ever throw Error (unsupported key, invalid glob).
        logger.warn(`Skipping override rule (${layer.scope} #${ruleIndex}): ${(error as Error).message}`);
        continue;
      }
      if (!result.matched) {
        continue;
      }
      // Scope is the primary sort key (repo-local beats global, §5.6).
      matched.push({ scope: layer.scope, ruleIndex, rule, when, key: [scopeRank, ...result.score] });
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
