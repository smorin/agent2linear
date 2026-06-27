/**
 * `config override move <selector>` (M31 Phase 3).
 *
 * Reorder a rule within its scope to control M29's equal-specificity tie-break
 * (declaration order). The moved rule and the anchor are BOTH resolved (by `<label>`
 * or `#<index>`) within the selected scope; `--before <selector>` / `--after
 * <selector>` are mutually exclusive and exactly one is required. The anchor index
 * is re-found AFTER the splice so the insertion point is correct regardless of
 * direction. `--json` emits the moved rule record (with its NEW index) as a bare
 * object.
 */

import { readConfigForScope, writeConfigForScope } from '../../../lib/config.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { getScopeInfo } from '../../../lib/scope.js';
import { resolveSelector, ruleLabel, serializeRule } from './shared.js';

interface OverrideMoveOptions {
  before?: string;
  after?: string;
  global?: boolean;
  project?: boolean;
  json?: boolean;
}

export function runOverrideMove(selector: string, options: OverrideMoveOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    const hasBefore = options.before !== undefined;
    const hasAfter = options.after !== undefined;
    if (hasBefore === hasAfter) {
      throw new Error('exactly one of --before <selector> or --after <selector> is required');
    }
    const anchorSelector = (hasBefore ? options.before : options.after) as string;

    const cfg = readConfigForScope(scope);
    const rules = cfg.overrides ?? [];

    const moved = resolveSelector(rules, selector);
    if (!moved) {
      throw new Error(`override rule "${selector}" not found in ${scopeLabel} config`);
    }
    const anchor = resolveSelector(rules, anchorSelector);
    if (!anchor) {
      throw new Error(`override rule "${anchorSelector}" not found in ${scopeLabel} config`);
    }
    if (moved.index === anchor.index) {
      throw new Error('cannot move a rule relative to itself');
    }

    // Splice out the moved rule, then re-find the anchor by reference identity — its
    // index may have shifted by one if it sat after the moved rule.
    const anchorRule = anchor.rule;
    const [movedRule] = rules.splice(moved.index, 1);
    let target = rules.indexOf(anchorRule);
    if (hasAfter) {
      target += 1;
    }
    rules.splice(target, 0, movedRule);

    cfg.overrides = rules;
    writeConfigForScope(scope, cfg);

    const newIndex = rules.indexOf(movedRule);
    const record = serializeRule(movedRule, newIndex);

    if (options.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    // Report the anchor by its POST-move index — `anchor.index` is the stale pre-splice
    // slot, which for an unlabeled anchor can now point at the moved rule, not the anchor.
    const anchorNewIndex = rules.indexOf(anchorRule);
    showSuccess('Override rule moved!', {
      Label: String(record.label),
      Scope: scopeLabel,
      Position: `${hasBefore ? 'before' : 'after'} ${ruleLabel(anchor.rule.id, anchorNewIndex)}`,
      'New index': String(newIndex),
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
