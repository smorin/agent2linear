/**
 * `config override edit <selector>` (M31 Phase 3).
 *
 * Modify an existing rule, addressed by `<label>` or `#<index>` within the selected
 * scope. The VALUE side merges field-by-field (the `profile edit` pattern): `--set`
 * overwrites a field, `--unset <key>` deletes it, `--alias` / `--rm-alias <e>.<n>`
 * merge the alias map (dropping an emptied alias sub-object). The `when` side is the
 * exception — ANY `when` input (flags or `--when-json`) replaces the ENTIRE `when`
 * (merging into a possibly-nested tree is undefined). `--id <label>` assigns a stable
 * label to a `#<index>` legacy rule (rejected on a collision with another rule in
 * scope). `--dry-run` previews without writing; `--json` emits the rule record.
 */

import { readConfigForScope, writeConfigForScope } from '../../../lib/config.js';
import { showError, showInfo, showSuccess } from '../../../lib/output.js';
import { getScopeInfo } from '../../../lib/scope.js';
import type { ConfigOverride, WhenClause } from '../../../lib/types.js';
import {
  applyAlias,
  applyRmAlias,
  applySet,
  applyUnset,
  buildWhenFromFlags,
  countRuleValues,
  hasWhenFlags,
  parseWhenJson,
  resolveSelector,
  serializeRule,
  type WhenFlagOptions,
} from './shared.js';

interface OverrideEditOptions extends WhenFlagOptions {
  whenJson?: string;
  set?: string[];
  unset?: string[];
  alias?: string[];
  rmAlias?: string[];
  id?: string;
  global?: boolean;
  project?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export function runOverrideEdit(selector: string, options: OverrideEditOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    const cfg = readConfigForScope(scope);
    const rules = cfg.overrides ?? [];
    const found = resolveSelector(rules, selector);
    if (!found) {
      throw new Error(`override rule "${selector}" not found in ${scopeLabel} config`);
    }
    const matchIndex = found.index;

    // Determine whether ANY mutation was requested up front — an empty `edit` is a
    // user error, not a silent no-op write.
    const hasWhenInput = options.whenJson !== undefined || hasWhenFlags(options);
    const set = options.set ?? [];
    const unset = options.unset ?? [];
    const alias = options.alias ?? [];
    const rmAlias = options.rmAlias ?? [];
    const newId = options.id?.trim();
    if (
      !hasWhenInput &&
      set.length === 0 &&
      unset.length === 0 &&
      alias.length === 0 &&
      rmAlias.length === 0 &&
      newId === undefined
    ) {
      throw new Error(
        'nothing to edit (provide a --when-* / --when-json, --set, --unset, --alias, --rm-alias, or --id)'
      );
    }

    // Work on a clone so a failed merge (e.g. a bad --set key) leaves the array
    // untouched, and so --dry-run previews without mutating the read config.
    const rule: ConfigOverride = structuredClone(rules[matchIndex]);

    // Label ASSIGNMENT — `--id` only NAMES an unlabeled `#<index>` legacy rule (Q5).
    // Renaming an already-labeled rule is a documented non-goal (label is fixed at
    // `add`), so reject it; setting `--id` to the rule's own label is a harmless
    // no-op. The other guards mirror `add` (non-empty, no leading `#`, unique in
    // scope — the uniqueness check skips the rule being edited).
    if (newId !== undefined) {
      if (!newId) {
        throw new Error('--id cannot be empty');
      }
      if (newId.startsWith('#')) {
        throw new Error('--id cannot start with "#" (that prefix is reserved for index selectors)');
      }
      const existingId = rule.id;
      if (existingId !== undefined && existingId !== newId) {
        throw new Error(
          'renaming a labeled rule is not supported (label is fixed at add); ' +
            '--id only names an unlabeled #<index> rule'
        );
      }
      if (rules.some((r, i) => i !== matchIndex && r.id === newId)) {
        throw new Error(`override rule "${newId}" already exists in ${scopeLabel} config`);
      }
      rule.id = newId;
    }

    // `when` is replaced wholesale when (and only when) when-input is present. The
    // flag/json mutual-exclusion + "≥1 criterion" checks mirror `add` exactly.
    if (hasWhenInput) {
      let when: WhenClause;
      if (options.whenJson !== undefined) {
        if (hasWhenFlags(options)) {
          throw new Error('--when-json cannot be combined with --when-* flags');
        }
        when = parseWhenJson(options.whenJson);
      } else {
        when = buildWhenFromFlags(options);
        if (Object.keys(when).length === 0) {
          throw new Error(
            'at least one match criterion is required (e.g. --when-repo, --when-branch, or --when-json)'
          );
        }
      }
      rule.when = when;
    }

    // Value side: field-by-field merge.
    applySet(rule, set);
    for (const key of unset) {
      applyUnset(rule, key);
    }
    applyAlias(rule, alias);
    for (const spec of rmAlias) {
      applyRmAlias(rule, spec);
    }

    // Parity with `add`: a rule must still carry at least one value after the merge.
    if (countRuleValues(rule) === 0) {
      throw new Error(
        'a rule must keep at least one value (--set <key>=<value> or --alias <entity>.<name>=<id>)'
      );
    }

    if (options.dryRun) {
      if (options.json) {
        console.log(JSON.stringify(serializeRule(rule, matchIndex), null, 2));
      } else {
        showInfo(`Dry run — would update override "${rule.id ?? `#${matchIndex}`}" in ${scopeLabel} config:`);
        console.log(JSON.stringify(rule, null, 2));
      }
      return;
    }

    rules[matchIndex] = rule;
    cfg.overrides = rules;
    writeConfigForScope(scope, cfg);

    if (options.json) {
      console.log(JSON.stringify(serializeRule(rule, matchIndex), null, 2));
      return;
    }

    showSuccess('Override rule updated!', { Label: rule.id ?? `#${matchIndex}`, Scope: scopeLabel });
    console.log(JSON.stringify(rule, null, 2));
    showInfo(`Verify it fires with: agent2linear config explain <dir>`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
