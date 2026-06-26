/**
 * `config override add <label>` (M31 Phase 1).
 *
 * Append a new override rule named `<label>` to the selected scope's `overrides[]`.
 * Hard-blocks a duplicate label in that scope (the `alias add` precedent — no
 * `--force`; changing a rule is what `edit` is for). At least one match criterion
 * and at least one value are required. `--dry-run` builds the rule and returns
 * without writing; `--json` emits the rule record.
 */

import { readConfigForScope, writeConfigForScope } from '../../../lib/config.js';
import { showError, showInfo, showSuccess } from '../../../lib/output.js';
import { getScopeInfo } from '../../../lib/scope.js';
import type { Aliases, ConfigOverride, OverridableConfig } from '../../../lib/types.js';
import {
  buildWhenFromFlags,
  parseAlias,
  parseSet,
  serializeRule,
  type WhenFlagOptions,
} from './shared.js';

interface OverrideAddOptions extends WhenFlagOptions {
  set?: string[];
  alias?: string[];
  global?: boolean;
  project?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export function runOverrideAdd(label: string, options: OverrideAddOptions = {}): void {
  try {
    const trimmedLabel = label?.trim();
    if (!trimmedLabel) {
      throw new Error('label cannot be empty');
    }
    if (trimmedLabel.startsWith('#')) {
      throw new Error('label cannot start with "#" (that prefix is reserved for index selectors)');
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);

    const when = buildWhenFromFlags(options);
    const values: Partial<OverridableConfig> = parseSet(options.set ?? []);
    const aliases: Partial<Aliases> = parseAlias(options.alias ?? []);

    if (Object.keys(when).length === 0) {
      throw new Error('at least one match criterion is required (e.g. --when-repo, --when-branch)');
    }
    if (Object.keys(values).length === 0 && Object.keys(aliases).length === 0) {
      throw new Error('at least one value is required (--set <key>=<value> or --alias <entity>.<name>=<id>)');
    }

    const cfg = readConfigForScope(scope);
    cfg.overrides ??= [];

    if (cfg.overrides.some((r) => r.id === trimmedLabel)) {
      throw new Error(`override rule "${trimmedLabel}" already exists in ${scopeLabel} config`);
    }

    const rule: ConfigOverride = { id: trimmedLabel, when, ...values };
    if (Object.keys(aliases).length > 0) {
      rule.aliases = aliases;
    }

    const index = cfg.overrides.length;

    if (options.dryRun) {
      if (options.json) {
        console.log(JSON.stringify(serializeRule(rule, index), null, 2));
      } else {
        showInfo(`Dry run — would add override "${trimmedLabel}" to ${scopeLabel} config:`);
        console.log(JSON.stringify(rule, null, 2));
      }
      return;
    }

    cfg.overrides.push(rule);
    writeConfigForScope(scope, cfg);

    if (options.json) {
      console.log(JSON.stringify(serializeRule(rule, index), null, 2));
      return;
    }

    showSuccess('Override rule added!', { Label: trimmedLabel, Scope: scopeLabel });
    console.log(JSON.stringify(rule, null, 2));
    showInfo(`Verify it fires with: agent2linear config explain <dir>`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
