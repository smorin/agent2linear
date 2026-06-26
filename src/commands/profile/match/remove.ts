import { readConfigForScope } from '../../../lib/config.js';
import {
  normalizeHostInput,
  normalizeOwnerInput,
  normalizeRepoInput,
} from '../../../lib/git-context.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { saveProfile } from '../../../lib/profiles.js';
import { getScopeInfo } from '../../../lib/scope.js';
import type { MatchRule } from '../../../lib/types.js';

interface MatchRemoveOptions {
  gitRemoteHost?: string;
  gitRemoteOwner?: string;
  gitRemoteRepo?: string;
  remote?: string;
  global?: boolean;
  project?: boolean;
}

/**
 * Remove a git-remote match rule (host/owner/repo/remote) from a profile (offline).
 *
 * Exactly one identity/remote flag is acted on; the value is normalized the SAME
 * way `match add` stored it (a pasted URL is reduced to its component; a bare glob is
 * matched verbatim) so an equivalent input form can always remove the rule. The
 * `remote` field is normalized through its string|array duality: filter the selector
 * out, re-collapse a single survivor to a string, and delete the field when empty so
 * it reverts to the default `origin`.
 */
export function profileMatchRemoveCommand(name: string, options: MatchRemoveOptions = {}): void {
  try {
    const passed = [
      options.gitRemoteHost !== undefined,
      options.gitRemoteOwner !== undefined,
      options.gitRemoteRepo !== undefined,
      options.remote !== undefined,
    ].filter(Boolean).length;
    if (passed === 0) {
      showError(
        'One of --git-remote-host, --git-remote-owner, --git-remote-repo, or --remote is required'
      );
      process.exit(1);
    }
    if (passed > 1) {
      showError('Pass only one of --git-remote-host, --git-remote-owner, --git-remote-repo, or --remote');
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(`Profile "${name}" not found in ${scopeLabel} config`);
      process.exit(1);
    }
    const rule: MatchRule = { ...profile.match };

    let removed: string;

    if (options.gitRemoteOwner !== undefined) {
      const owner = normalizeOwnerInput(options.gitRemoteOwner);
      if (!owner) {
        showError(
          `Invalid git remote owner: "${options.gitRemoteOwner}"`,
          'Pass a bare owner (e.g. "acme-co") or a full repo URL to extract it from.'
        );
        process.exit(1);
      }
      removed = removeFromList(rule, 'gitRemoteOwner', owner, name, 'Owner');
      deleteRemoteIfNoIdentityFields(rule);
    } else if (options.gitRemoteHost !== undefined) {
      const host = normalizeHostInput(options.gitRemoteHost);
      if (!host) {
        showError(
          `Invalid git remote host: "${options.gitRemoteHost}"`,
          'Pass a host glob (e.g. "github.com" or "*.gitlab.example.com") or a full repo URL to extract it from.'
        );
        process.exit(1);
      }
      removed = removeFromList(rule, 'gitRemoteHost', host, name, 'Host');
      deleteRemoteIfNoIdentityFields(rule);
    } else if (options.gitRemoteRepo !== undefined) {
      const repo = normalizeRepoInput(options.gitRemoteRepo);
      if (!repo) {
        showError(
          `Invalid git remote repo: "${options.gitRemoteRepo}"`,
          'Pass an owner/name glob (e.g. "acme/secret-*") or a full repo URL to extract it from.'
        );
        process.exit(1);
      }
      removed = removeFromList(rule, 'gitRemoteRepo', repo, name, 'Repo');
      deleteRemoteIfNoIdentityFields(rule);
    } else {
      const value = (options.remote as string).trim();
      if (!value) {
        showError('Invalid remote selector: value cannot be empty', 'Pass a remote name or "*".');
        process.exit(1);
      }
      const current =
        rule.remote === undefined ? [] : Array.isArray(rule.remote) ? rule.remote : [rule.remote];
      const same = valueComparer(rule);
      if (!current.some((r) => same(r, value))) {
        showError(`Remote "${value}" is not a match rule on profile "${name}"`);
        process.exit(1);
      }
      const survivors = current.filter((r) => !same(r, value));
      if (survivors.length === 0) {
        delete rule.remote;
      } else {
        rule.remote = survivors.length === 1 ? survivors[0] : survivors;
      }
      removed = value;
    }

    profile.match = rule;
    saveProfile(scope, name, profile);

    showSuccess('Match rule removed!', {
      Profile: name,
      Scope: scopeLabel,
      Removed: removed,
    });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Remove one value from an identity list on the rule, erroring (exit 1) when it
 * isn't present. Case-insensitive by default, exact when the rule is case-sensitive.
 * Deletes the key when the list becomes empty.
 */
function removeFromList(
  rule: MatchRule,
  field: 'gitRemoteHost' | 'gitRemoteOwner' | 'gitRemoteRepo',
  value: string,
  profileName: string,
  label: string
): string {
  const list = rule[field] ?? [];
  const same = valueComparer(rule);
  if (!list.some((v) => same(v, value))) {
    showError(`${label} "${value}" is not a match rule on profile "${profileName}"`);
    process.exit(1);
  }
  const survivors = list.filter((v) => !same(v, value));
  if (survivors.length === 0) {
    delete rule[field];
  } else {
    rule[field] = survivors;
  }
  return value;
}

function valueComparer(rule: MatchRule): (left: string, right: string) => boolean {
  if (rule.caseSensitive) {
    return (left, right) => left === right;
  }
  return (left, right) => left.toLowerCase() === right.toLowerCase();
}

function deleteRemoteIfNoIdentityFields(rule: MatchRule): void {
  const hasIdentity =
    (rule.gitRemoteHost?.length ?? 0) > 0 ||
    (rule.gitRemoteOwner?.length ?? 0) > 0 ||
    (rule.gitRemoteRepo?.length ?? 0) > 0;
  if (!hasIdentity) {
    delete rule.remote;
  }
}
