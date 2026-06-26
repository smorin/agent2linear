import { readConfigForScope } from '../../../lib/config.js';
import { normalizeRemoteUrl } from '../../../lib/git-context.js';
import { normalizeRemoteOwner } from '../../../lib/git-remote.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { saveProfile } from '../../../lib/profiles.js';
import { getScopeInfo } from '../../../lib/scope.js';
import type { MatchRule } from '../../../lib/types.js';

interface MatchAddOptions {
  gitRemoteHost?: string[];
  gitRemoteOwner?: string[];
  gitRemoteRepo?: string[];
  remote?: string[];
  caseSensitive?: boolean;
  global?: boolean;
  project?: boolean;
}

/**
 * Normalize a `--git-remote-host` value: if it parses as a full repo URL, extract
 * its host; otherwise store the literal glob verbatim (e.g. "github.com",
 * "*.gitlab.example.com" — neither parses as a URL, so they pass through).
 */
function normalizeHost(raw: string): string {
  return normalizeRemoteUrl(raw)?.host ?? raw.trim();
}

/**
 * Normalize a `--git-remote-repo` value: if it parses as a full repo URL, extract
 * `owner/name`; otherwise store the literal glob verbatim. Repo globs legitimately
 * contain `/` (e.g. "my-org/secret-*") and never match the scheme/scp regexes, so
 * verbatim storage is safe (O2).
 */
function normalizeRepo(raw: string): string {
  const id = normalizeRemoteUrl(raw);
  return id ? `${id.owner}/${id.name}` : raw.trim();
}

/** Merge new values into an existing field, deduping (order-preserving). */
function mergeField(existing: string[] | undefined, additions: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...additions]));
}

/**
 * Add git-remote match rules (host/owner/repo/remote/case) to a profile (offline).
 *
 * Each identity field is normalized PER FIELD (a pasted full URL is reduced to its
 * host / owner / `owner/name` component; a bare glob is stored verbatim) and merged
 * into the profile's `match` set. `--remote` mirrors M29's `remote` shape: a single
 * value collapses to a string, multiple to an array. `--case-sensitive` persists
 * `caseSensitive: true` (never `false` — unsetting is via hand-editing config, v1).
 */
export function profileMatchAddCommand(name: string, options: MatchAddOptions = {}): void {
  try {
    const hosts = options.gitRemoteHost ?? [];
    const owners = options.gitRemoteOwner ?? [];
    const repos = options.gitRemoteRepo ?? [];
    const remotes = options.remote ?? [];
    // `--case-sensitive` is a per-rule modifier, not a rule on its own (a rule with
    // only `caseSensitive` is non-matchable), so it doesn't satisfy this requirement.
    if (hosts.length === 0 && owners.length === 0 && repos.length === 0 && remotes.length === 0) {
      showError(
        'At least one of --git-remote-host, --git-remote-owner, --git-remote-repo, or --remote is required'
      );
      process.exit(1);
    }

    const { scope, label: scopeLabel } = getScopeInfo(options);
    const profile = readConfigForScope(scope).profiles?.[name];
    if (!profile) {
      showError(
        `Profile "${name}" not found in ${scopeLabel} config`,
        'Create it first with "agent2linear profile add"'
      );
      process.exit(1);
    }

    // Owner: accept a bare owner OR a full repo URL (extract the owner); reject
    // malformed input so a bad value never gets stored where it can never match.
    const normalizedOwners: string[] = [];
    for (const raw of owners) {
      const owner = normalizeRemoteOwner(raw);
      if (!owner) {
        showError(
          `Invalid git remote owner: "${raw}"`,
          'Pass a bare owner (e.g. "acme-co") or a full repo URL to extract it from (e.g. "git@github.com:acme-co/repo.git").'
        );
        process.exit(1);
      }
      normalizedOwners.push(owner);
    }
    const normalizedHosts = hosts.map(normalizeHost);
    const normalizedRepos = repos.map(normalizeRepo);

    const rule: MatchRule = { ...profile.match };
    if (normalizedHosts.length > 0) {
      rule.gitRemoteHost = mergeField(rule.gitRemoteHost, normalizedHosts);
    }
    if (normalizedOwners.length > 0) {
      rule.gitRemoteOwner = mergeField(rule.gitRemoteOwner, normalizedOwners);
    }
    if (normalizedRepos.length > 0) {
      rule.gitRemoteRepo = mergeField(rule.gitRemoteRepo, normalizedRepos);
    }
    if (remotes.length > 0) {
      // Mirror M29's `remote` shape: a single selector collapses to a string,
      // multiple to a deduped array. Stored verbatim (a plain remote name or "*").
      const merged = Array.from(
        new Set([
          ...(rule.remote === undefined ? [] : Array.isArray(rule.remote) ? rule.remote : [rule.remote]),
          ...remotes.map((r) => r.trim()),
        ])
      );
      rule.remote = merged.length === 1 ? merged[0] : merged;
    }
    if (options.caseSensitive) {
      rule.caseSensitive = true;
    }
    profile.match = rule;
    saveProfile(scope, name, profile);

    const summary: Record<string, string> = { Profile: name, Scope: scopeLabel };
    if (rule.remote !== undefined) {
      summary.Remote = Array.isArray(rule.remote) ? rule.remote.join(', ') : rule.remote;
    }
    if (rule.gitRemoteHost?.length) {
      summary['Git remote hosts'] = rule.gitRemoteHost.join(', ');
    }
    if (rule.gitRemoteOwner?.length) {
      summary['Git remote owners'] = rule.gitRemoteOwner.join(', ');
    }
    if (rule.gitRemoteRepo?.length) {
      summary['Git remote repos'] = rule.gitRemoteRepo.join(', ');
    }
    if (rule.caseSensitive) {
      summary['Case sensitive'] = 'true';
    }
    showSuccess('Match rule added!', summary);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
