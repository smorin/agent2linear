/**
 * Shared builder/validator/serializer for the `config override` (`config ov`)
 * command group (M31). Everything here is offline and pure — functions that can
 * reject `throw new Error(...)`, and the thin command files turn that into
 * `showError` + `process.exit(1)`. The single source of truth for value keys is
 * `OVERRIDABLE_FIELDS` (re-used from the resolver), so `apiKey`/`when`/`aliases`/
 * `id` can never be set via `--set` — the same structural guarantee M29 relies on.
 *
 * This module grows across phases. Phase 1 owns the complete VALUE side
 * (`--set` + `--alias`) and a deliberately minimal `when` side (a single
 * `--when-<facet>` leaf); composites, `--when-json`, and eager glob validation
 * arrive in Phase 2.
 */

import { getAliasesKey } from '../../../lib/aliases.js';
import { OVERRIDABLE_FIELDS } from '../../../lib/overrides.js';
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

/** The single-facet `when` flags this phase understands. */
export interface WhenFlagOptions {
  whenRepo?: string;
  whenOwner?: string;
  whenHost?: string;
  whenPath?: string;
  whenBranch?: string;
  whenRemote?: string;
}

/**
 * Build a `when` clause from the single-leaf flag options (Phase 1). Exactly one
 * facet may be supplied; supplying more than one is rejected here (cross-facet AND
 * and composites arrive in Phase 2). The value side enforces "≥1 criterion" at the
 * `add` layer, so a flag-less call returns an empty clause for that check to reject.
 */
export function buildWhenFromFlags(opts: WhenFlagOptions): WhenClause {
  const leaves: Array<[keyof WhenClause, string]> = [];
  if (opts.whenRepo !== undefined) leaves.push(['repo', opts.whenRepo]);
  if (opts.whenOwner !== undefined) leaves.push(['owner', opts.whenOwner]);
  if (opts.whenHost !== undefined) leaves.push(['host', opts.whenHost]);
  if (opts.whenPath !== undefined) leaves.push(['path', opts.whenPath]);
  if (opts.whenBranch !== undefined) leaves.push(['branch', opts.whenBranch]);
  if (opts.whenRemote !== undefined) leaves.push(['remote', opts.whenRemote]);

  if (leaves.length > 1) {
    throw new Error(
      `only one --when-<facet> flag is supported in this release (got: ${leaves
        .map(([k]) => k)
        .join(', ')})`
    );
  }

  const when: WhenClause = {};
  for (const [facet, value] of leaves) {
    if (!value.trim()) {
      throw new Error(`--when-${facet} cannot be empty`);
    }
    (when as Record<string, string>)[facet] = value;
  }
  return when;
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
    const index = Number.parseInt(selector.slice(1), 10);
    if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
      return undefined;
    }
    return { rule: rules[index], index };
  }
  const index = rules.findIndex((r) => r.id === selector);
  return index === -1 ? undefined : { rule: rules[index], index };
}

/**
 * Static specificity TAG for `list` display (design Q6) — an at-a-glance hint of
 * how specific a rule's `when` is, NOT a sort key. Classifies a Phase-1 single-leaf
 * clause; later phases extend this to composite shapes.
 */
export function specificityTag(when: WhenClause): string {
  if (when.repo !== undefined) return 'exact-repo';
  if (when.owner !== undefined) return 'owner';
  if (when.host !== undefined) return 'host';
  if (when.path !== undefined) return 'path';
  if (when.branch !== undefined) return 'branch';
  if (when.remote !== undefined) return 'remote';
  return 'catch-all';
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
