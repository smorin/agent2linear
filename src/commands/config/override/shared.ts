/**
 * Shared builder/validator/serializer for the `config override` (`config ov`)
 * command group (M31). Everything here is offline and pure — functions that can
 * reject `throw new Error(...)`, and the thin command files turn that into
 * `showError` + `process.exit(1)`. The single source of truth for value keys is
 * `OVERRIDABLE_FIELDS` (re-used from the resolver), so `apiKey`/`when`/`aliases`/
 * `id` can never be set via `--set` — the same structural guarantee M29 relies on.
 *
 * This module grows across phases. Phase 1 owns the complete VALUE side
 * (`--set` + `--alias`). Phase 2 owns the complete WHEN side: flag-sugar
 * composites (OR-within-a-facet via `anyOf`, negation via a single De-Morgan
 * `not`), the `--when-json` escape hatch for arbitrary nested trees, and eager
 * glob validation so a never-matching rule is rejected before it is written.
 */

import { getAliasesKey } from '../../../lib/aliases.js';
import { KNOWN_WHEN_KEYS, OVERRIDABLE_FIELDS } from '../../../lib/overrides.js';
import type {
  AliasEntityType,
  Aliases,
  ConfigOverride,
  OverridableConfig,
  WhenClause,
} from '../../../lib/types.js';

/**
 * The overridable value keys, as a runtime `Set` for membership tests. Iterating
 * the resolver's `OVERRIDABLE_FIELDS` keeps the CLI whitelist byte-identical to the
 * engine's — a new field is excluded from `--set` until added to that constant.
 */
const OVERRIDABLE_FIELD_SET = new Set<string>(OVERRIDABLE_FIELDS);

/** Boolean-valued overridable fields, coerced like `config set` does. */
const BOOLEAN_FIELDS = new Set<string>(['defaultAutoAssignLead']);

/** All 11 kebab-singular alias entity types accepted by `--alias <entity>.<name>=<id>`. */
const ALIAS_ENTITY_TYPES: readonly AliasEntityType[] = [
  'initiative',
  'team',
  'project',
  'project-status',
  'issue-template',
  'project-template',
  'member',
  'issue-label',
  'project-label',
  'workflow-state',
  'cycle',
];

const ALIAS_ENTITY_SET = new Set<string>(ALIAS_ENTITY_TYPES);

/** The camelCase `Aliases` storage keys, in `AliasEntityType` order. */
const ALIAS_STORAGE_KEYS = ALIAS_ENTITY_TYPES.map((e) => getAliasesKey(e));

/**
 * Coerce a `--set` boolean exactly like `setConfigValue` (`true|1|yes` /
 * `false|0|no`, else throw). Returns the boolean so `false` is preserved
 * precisely (the resolver gates on `value !== undefined`).
 */
function coerceBoolean(key: string, value: string): boolean {
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  throw new Error(`${key} must be true or false`);
}

/**
 * Parse `--set <key>=<value>` pairs into a partial value object. Each key MUST be
 * in `OVERRIDABLE_FIELDS` — `apiKey`/`when`/`aliases`/`id` (and anything else) are
 * rejected here, structurally guaranteeing they can never be set via an override.
 * Booleans are coerced; all other fields are stored as the raw string.
 */
export function parseSet(pairs: string[]): Partial<OverridableConfig> {
  const values: Record<string, string | boolean> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      throw new Error(`invalid --set "${pair}": expected <key>=<value>`);
    }
    const key = pair.slice(0, eq).trim();
    const rawValue = pair.slice(eq + 1);
    if (!key) {
      throw new Error(`invalid --set "${pair}": empty key`);
    }
    if (!OVERRIDABLE_FIELD_SET.has(key)) {
      throw new Error(
        `cannot set "${key}" via an override (allowed: ${OVERRIDABLE_FIELDS.join(', ')})`
      );
    }
    values[key] = BOOLEAN_FIELDS.has(key) ? coerceBoolean(key, rawValue) : rawValue;
  }
  return values as Partial<OverridableConfig>;
}

/**
 * Parse `--alias <entity>.<name>=<id>` pairs into a per-rule `aliases` block. The
 * entity is the kebab-singular `AliasEntityType` (`team`, `project-status`, …) —
 * the same vocabulary `a2l alias add` uses — and is translated to its camelCase
 * `Aliases` storage key via `getAliasesKey` before writing, so the resolver (which
 * reads the storage key) actually honors the alias (design Q2).
 */
export function parseAlias(pairs: string[]): Partial<Aliases> {
  const aliases: Partial<Aliases> = {};
  for (const pair of pairs) {
    const dot = pair.indexOf('.');
    if (dot === -1) {
      throw new Error(`invalid --alias "${pair}": expected <entity>.<name>=<id>`);
    }
    const entity = pair.slice(0, dot).trim();
    const rest = pair.slice(dot + 1);
    const eq = rest.indexOf('=');
    if (eq === -1) {
      throw new Error(`invalid --alias "${pair}": expected <entity>.<name>=<id>`);
    }
    const name = rest.slice(0, eq).trim();
    const id = rest.slice(eq + 1).trim();
    if (!entity || !name || !id) {
      throw new Error(`invalid --alias "${pair}": expected <entity>.<name>=<id>`);
    }
    if (!ALIAS_ENTITY_SET.has(entity)) {
      throw new Error(
        `unknown alias entity "${entity}" (allowed: ${ALIAS_ENTITY_TYPES.join(', ')})`
      );
    }
    const storageKey = getAliasesKey(entity as AliasEntityType);
    const map = (aliases as Record<string, Record<string, string>>);
    map[storageKey] ??= {};
    map[storageKey][name] = id;
  }
  return aliases;
}

/**
 * The `when` flags Phase 2 understands. Each facet is repeatable and comma-aware
 * (so the value arrives as `string | string[]` and is normalized below). The
 * positive facets become AND'd leaves (or one `anyOf` for the at-most-one OR-list);
 * the `whenNot*` facets all collapse into a single De-Morgan `not`.
 */
export interface WhenFlagOptions {
  whenRepo?: string | string[];
  whenOwner?: string | string[];
  whenHost?: string | string[];
  whenPath?: string | string[];
  whenBranch?: string | string[];
  whenRemote?: string | string[];
  whenNotRepo?: string | string[];
  whenNotOwner?: string | string[];
  whenNotHost?: string | string[];
  whenNotPath?: string | string[];
  whenNotBranch?: string | string[];
  whenNotRemote?: string | string[];
}

/** The leaf facets flag-sugar can express, in `specificityTag` precedence order. */
type WhenFacet = 'repo' | 'owner' | 'host' | 'path' | 'branch' | 'remote';
const WHEN_FACETS: readonly WhenFacet[] = ['repo', 'owner', 'host', 'path', 'branch', 'remote'];

function isIdentityFacet(facet: WhenFacet): boolean {
  return facet === 'repo' || facet === 'owner' || facet === 'host';
}

function isIdentityOrRemoteFacet(facet: WhenFacet): boolean {
  return facet === 'remote' || isIdentityFacet(facet);
}

function assignFacet(target: WhenClause, facet: WhenFacet, value: string): void {
  (target as Record<string, unknown>)[facet] = value;
}

/**
 * Normalize a repeatable, comma-aware flag value into a flat list of trimmed,
 * non-empty segments. `--when-repo a,b --when-repo c` arrives as `['a,b','c']` and
 * flattens to `['a','b','c']`. A segment that is empty/blank after trimming is an
 * invalid glob and is rejected here (eager validation — none of the resolver's
 * identity/branch matchers throw on a blank pattern, so the CLI must).
 */
function normalizeFacetValues(facet: string, raw: string | string[] | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  const inputs = Array.isArray(raw) ? raw : [raw];
  const segments: string[] = [];
  for (const input of inputs) {
    for (const part of input.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) {
        throw new Error(`--when-${facet} cannot be empty`);
      }
      segments.push(trimmed);
    }
  }
  return segments;
}

/** A single facet leaf, e.g. `{ repo: 'acme/web' }`. */
function leaf(facet: WhenFacet, value: string): WhenClause {
  return { [facet]: value } as WhenClause;
}

/**
 * Build a `when` clause from the Phase-2 flag-sugar options. The contract (design
 * Q3/Q4) compiles to exactly ONE top-level `when` object — flag-sugar NEVER emits a
 * top-level `allOf`:
 *   - single-value positive facets → direct AND'd leaf keys on the node;
 *   - the AT-MOST-ONE multi-value positive facet → an `anyOf` key on the same node;
 *   - 2+ multi-value positive facets ⇒ hard error pointing at `--when-json`;
 *   - all `--when-not-*` flags → one `not` key (`not: { anyOf: [...] }`, or
 *     `not: { <facet>: v }` for a single negative leaf total — De Morgan).
 * Nesting only ever happens inside `not`. A flag-less call returns `{}` so the
 * `add`/`edit` layer can apply the "≥1 criterion" check (this builder never does).
 */
export function buildWhenFromFlags(opts: WhenFlagOptions): WhenClause {
  const positive: Array<{ facet: WhenFacet; values: string[] }> = [];
  for (const facet of WHEN_FACETS) {
    const key = `when${facet[0].toUpperCase()}${facet.slice(1)}` as keyof WhenFlagOptions;
    const values = normalizeFacetValues(facet, opts[key]);
    if (values.length > 0) {
      positive.push({ facet, values });
    }
  }

  const negative: WhenClause[] = [];
  for (const facet of WHEN_FACETS) {
    const key = `whenNot${facet[0].toUpperCase()}${facet.slice(1)}` as keyof WhenFlagOptions;
    for (const value of normalizeFacetValues(`not-${facet}`, opts[key])) {
      negative.push(leaf(facet, value));
    }
  }

  const multiValueFacets = positive.filter((p) => p.values.length > 1);
  if (multiValueFacets.length >= 2) {
    const suggestion = JSON.stringify({
      allOf: multiValueFacets.map((p) => ({ anyOf: p.values.map((v) => leaf(p.facet, v)) })),
    });
    throw new Error(
      `cannot express ${multiValueFacets.length} OR-lists ` +
        `(${multiValueFacets.map((p) => p.facet).join(', ')}) with flag-sugar; ` +
        `use --when-json '${suggestion}'`
    );
  }

  const when: WhenClause = {};
  const multiValueFacet = multiValueFacets[0];
  const hasRemoteFacet = positive.some((p) => p.facet === 'remote');
  const hasIdentityFacet = positive.some((p) => isIdentityFacet(p.facet));
  const shouldInlineRemoteQualifiedIdentity =
    multiValueFacet !== undefined &&
    hasRemoteFacet &&
    hasIdentityFacet &&
    isIdentityOrRemoteFacet(multiValueFacet.facet);

  if (shouldInlineRemoteQualifiedIdentity) {
    for (const { facet, values } of positive) {
      if (!isIdentityOrRemoteFacet(facet)) {
        assignFacet(when, facet, values[0]);
      }
    }
    const identityBranches = positive.filter((p) => isIdentityOrRemoteFacet(p.facet));
    when.anyOf = multiValueFacet.values.map((value) => {
      const child: WhenClause = {};
      for (const { facet, values } of identityBranches) {
        assignFacet(child, facet, facet === multiValueFacet.facet ? value : values[0]);
      }
      return child;
    });
  } else {
    for (const { facet, values } of positive) {
      if (values.length === 1) {
        assignFacet(when, facet, values[0]);
      } else {
        // The at-most-one OR-list facet becomes an `anyOf` on the same node.
        when.anyOf = values.map((v) => leaf(facet, v));
      }
    }
  }

  if (negative.length === 1) {
    when.not = negative[0];
  } else if (negative.length > 1) {
    when.not = { anyOf: negative };
  }

  return when;
}

/**
 * Validate a `--when-json` object before writing: it must be a plain object whose
 * keys are all in `KNOWN_WHEN_KEYS` (recursively, through `allOf`/`anyOf`/`not`),
 * and every leaf glob must be non-empty. `{}` (the intentional catch-all) passes.
 * Rejecting unknown keys here keeps the prompt-only `team` matcher out of config
 * overrides (it is not in `KNOWN_WHEN_KEYS`). Returns the validated clause.
 */
export function validateWhenJson(value: unknown): WhenClause {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--when-json must be a JSON object');
  }
  const node = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(node)) {
    if (!KNOWN_WHEN_KEYS.includes(key)) {
      throw new Error(
        `unsupported \`when\` key "${key}" (allowed: ${KNOWN_WHEN_KEYS.join(', ')})`
      );
    }
    if (key === 'allOf' || key === 'anyOf') {
      if (!Array.isArray(child)) {
        throw new Error(`\`when.${key}\` must be an array`);
      }
      // `anyOf: []` is an OR of nothing — it can never match (the resolver warn-skips
      // it). Reject the never-matching shape eagerly. (`allOf: []` is a meaningful
      // vacuous-true catch-all, like `{}`, so it is allowed.)
      if (key === 'anyOf' && child.length === 0) {
        throw new Error('`when.anyOf` cannot be empty (it would never match)');
      }
      for (const item of child) {
        validateWhenJson(item);
      }
    } else if (key === 'not') {
      const negated = validateWhenJson(child);
      // `not: {}` negates the always-true catch-all, so it can never match.
      if (Object.keys(negated).length === 0) {
        throw new Error('`when.not` cannot be empty (it would never match)');
      }
    } else if (key === 'remote') {
      // `remote` may be a string or a list of strings (or "*").
      const remotes = Array.isArray(child) ? child : [child];
      for (const r of remotes) {
        if (typeof r !== 'string' || r.trim() === '') {
          throw new Error('`when.remote` must be a non-empty string or list of strings');
        }
      }
    } else {
      // A leaf glob facet (path/repo/owner/host/branch): must be a non-empty string.
      if (typeof child !== 'string' || child.trim() === '') {
        throw new Error(`\`when.${key}\` must be a non-empty glob string`);
      }
    }
  }
  return node as WhenClause;
}

/** Parse + validate a raw `--when-json` argument string. */
export function parseWhenJson(raw: string): WhenClause {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid --when-json: ${error instanceof Error ? error.message : 'parse error'}`);
  }
  return validateWhenJson(parsed);
}

/** Whether any flag-sugar facet (positive or negative) was supplied. */
export function hasWhenFlags(opts: WhenFlagOptions): boolean {
  return [
    opts.whenRepo,
    opts.whenOwner,
    opts.whenHost,
    opts.whenPath,
    opts.whenBranch,
    opts.whenRemote,
    opts.whenNotRepo,
    opts.whenNotOwner,
    opts.whenNotHost,
    opts.whenNotPath,
    opts.whenNotBranch,
    opts.whenNotRemote,
  ].some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true));
}

/**
 * Resolve a selector to a rule + index within a scope's rules array. A selector is
 * either a label (matched against `rule.id`) or `#<n>` (a 0-based array index).
 * Returns undefined when nothing matches.
 */
export function resolveSelector(
  rules: ConfigOverride[],
  selector: string
): { rule: ConfigOverride; index: number } | undefined {
  if (selector.startsWith('#')) {
    const rawIndex = selector.slice(1);
    if (!/^\d+$/.test(rawIndex)) {
      return undefined;
    }
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
      return undefined;
    }
    return { rule: rules[index], index };
  }
  const index = rules.findIndex((r) => r.id === selector);
  return index === -1 ? undefined : { rule: rules[index], index };
}

/** The positive leaf facets in `list`-tag precedence order (most → least specific). */
const TAG_PRECEDENCE: ReadonlyArray<[WhenFacet, string]> = [
  ['repo', 'exact-repo'],
  ['owner', 'owner'],
  ['host', 'host'],
  ['path', 'path'],
  ['branch', 'branch'],
  ['remote', 'remote'],
];

/**
 * Static specificity TAG for `list` display (design Q6) — an at-a-glance hint of
 * how specific a rule's `when` is, NOT a sort key. The classification is the most
 * specific POSITIVE leaf facet appearing anywhere in the tree (recursing into
 * `allOf`/`anyOf`, but NOT into `not` — a negation is an exclusion, not what the
 * rule is "about"), via the same `repo > owner > host > path > branch > remote`
 * precedence; a clause with no positive leaf (e.g. `{}` or a `not`-only rule) tags
 * `catch-all`.
 */
export function specificityTag(when: WhenClause): string {
  const present = new Set<WhenFacet>();
  collectPositiveFacets(when, present);
  for (const [facet, tag] of TAG_PRECEDENCE) {
    if (present.has(facet)) return tag;
  }
  return 'catch-all';
}

/** Gather every positive leaf facet in a `when` tree (skipping `not` subtrees). */
function collectPositiveFacets(node: WhenClause, into: Set<WhenFacet>): void {
  for (const facet of WHEN_FACETS) {
    if ((node as Record<string, unknown>)[facet] !== undefined) {
      into.add(facet);
    }
  }
  for (const child of node.allOf ?? []) {
    collectPositiveFacets(child, into);
  }
  for (const child of node.anyOf ?? []) {
    collectPositiveFacets(child, into);
  }
}

/**
 * Serialize a rule into a record for `--json` / `--dry-run` output. Carries the
 * array index and the display label (`id ?? #<index>`) so machine consumers and the
 * read side name a rule the same way.
 */
export function serializeRule(rule: ConfigOverride, index: number): Record<string, unknown> {
  return {
    label: rule.id ?? `#${index}`,
    index,
    rule,
  };
}

/**
 * Overwrite the named overridable fields on a rule from `--set` pairs (`edit`'s
 * field-by-field merge). Keys are validated through `parseSet`, so the
 * `apiKey`/`when`/`aliases`/`id` rejection still holds on the edit path; existing
 * fields not named are preserved. Booleans (incl. `false`) overwrite precisely.
 */
export function applySet(rule: ConfigOverride, pairs: string[]): void {
  const values = parseSet(pairs);
  const target = rule as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    target[key] = value;
  }
}

/**
 * Delete one overridable field from a rule (`--unset <key>`). The key must be in
 * `OVERRIDABLE_FIELDS` — the same whitelist `--set` uses — so `--unset apiKey`
 * (or `when`/`aliases`/`id`) is rejected rather than silently no-op'd.
 */
export function applyUnset(rule: ConfigOverride, key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('--unset requires a key');
  }
  if (!OVERRIDABLE_FIELD_SET.has(trimmed)) {
    throw new Error(
      `cannot unset "${trimmed}" (allowed: ${OVERRIDABLE_FIELDS.join(', ')})`
    );
  }
  delete (rule as unknown as Record<string, unknown>)[trimmed];
}

/**
 * Merge `--alias <entity>.<name>=<id>` pairs into a rule's `aliases` map (the
 * storage-key translation is reused from `parseAlias`). Existing aliases on other
 * entities/names are preserved; a name colliding within the same entity overwrites.
 */
export function applyAlias(rule: ConfigOverride, pairs: string[]): void {
  const parsed = parseAlias(pairs);
  if (Object.keys(parsed).length === 0) {
    return;
  }
  const aliases = (rule.aliases ?? {}) as Record<string, Record<string, string>>;
  for (const [storageKey, names] of Object.entries(parsed as Record<string, Record<string, string>>)) {
    aliases[storageKey] ??= {};
    Object.assign(aliases[storageKey], names);
  }
  rule.aliases = aliases as Partial<Aliases>;
}

/**
 * Remove one `--rm-alias <entity>.<name>` from a rule's `aliases` map. Drops an
 * emptied entity sub-object (and the whole `aliases` block if it becomes empty),
 * the `profile match remove` pattern, so the round-tripped rule shape stays clean.
 * Errors if the entity is unknown or the named alias is not present.
 */
export function applyRmAlias(rule: ConfigOverride, spec: string): void {
  const dot = spec.indexOf('.');
  if (dot === -1) {
    throw new Error(`invalid --rm-alias "${spec}": expected <entity>.<name>`);
  }
  const entity = spec.slice(0, dot).trim();
  const name = spec.slice(dot + 1).trim();
  if (!entity || !name) {
    throw new Error(`invalid --rm-alias "${spec}": expected <entity>.<name>`);
  }
  if (!ALIAS_ENTITY_SET.has(entity)) {
    throw new Error(
      `unknown alias entity "${entity}" (allowed: ${ALIAS_ENTITY_TYPES.join(', ')})`
    );
  }
  const storageKey = getAliasesKey(entity as AliasEntityType);
  const aliases = (rule.aliases ?? {}) as Record<string, Record<string, string>>;
  if (aliases[storageKey]?.[name] === undefined) {
    throw new Error(`alias "${entity}.${name}" not found on this rule`);
  }
  delete aliases[storageKey][name];
  if (Object.keys(aliases[storageKey]).length === 0) {
    delete aliases[storageKey];
  }
  if (Object.keys(aliases).length === 0) {
    delete rule.aliases;
  } else {
    rule.aliases = aliases as Partial<Aliases>;
  }
}

/**
 * Count the overridable VALUES a rule sets (its `--set`/`--alias` payload), i.e.
 * everything except `id`/`when`. Used by `edit` to enforce a rule still carries ≥1
 * value after a merge (the same "≥1 value" invariant `add` requires).
 */
export function countRuleValues(rule: ConfigOverride): number {
  let count = 0;
  for (const key of Object.keys(rule)) {
    if (key === 'id' || key === 'when') continue;
    if (key === 'aliases') {
      // An empty/absent aliases block does not count as a value.
      const aliases = rule.aliases ?? {};
      if (ALIAS_STORAGE_KEYS.some((k) => Object.keys((aliases as Record<string, object>)[k] ?? {}).length > 0)) {
        count += 1;
      }
      continue;
    }
    count += 1;
  }
  return count;
}
