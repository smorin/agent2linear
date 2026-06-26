import {
  ambiguityWarning,
  detectPositiveMatchingProfiles,
  loadProfiles,
} from '../../../lib/profiles.js';

/**
 * List a profile's git-remote match rules (host/owner/repo/remote/case) + exclusion
 * state (offline). When >1 profile POSITIVELY matches the current repo, append the
 * shared informational ambiguity warning (same count `doctor` uses).
 */
export function profileMatchListCommand(name: string): void {
  const profiles = loadProfiles();
  const profile = profiles[name];
  if (!profile) {
    console.error(`❌ Profile "${name}" not found`);
    process.exit(1);
  }

  const match = profile.match;
  const hosts = match?.gitRemoteHost ?? [];
  const owners = match?.gitRemoteOwner ?? [];
  const repos = match?.gitRemoteRepo ?? [];
  const remote = match?.remote;

  console.log(`Match rules for profile "${name}":`);
  const hasIdentityRule = hosts.length > 0 || owners.length > 0 || repos.length > 0;
  if (!hasIdentityRule && remote === undefined) {
    console.log('  (no git-remote match rules)');
  } else {
    // `remote` defaults to origin; only show it when the rule overrides that.
    if (remote !== undefined) {
      const value = Array.isArray(remote) ? remote.join(', ') : remote;
      console.log(`  remote: ${value}`);
    }
    for (const host of hosts) {
      console.log(`  git-remote-host: ${host}`);
    }
    for (const owner of owners) {
      console.log(`  git-remote-owner: ${owner}`);
    }
    for (const repo of repos) {
      console.log(`  git-remote-repo: ${repo}`);
    }
    if (match?.caseSensitive) {
      console.log('  case-sensitive: true');
    }
  }
  if (profile.linear === false || match?.linear === false) {
    console.log('  excluded (linear: false)');
  }

  const positive = detectPositiveMatchingProfiles(profiles);
  if (positive.length >= 2) {
    console.log(ambiguityWarning(positive.length));
  }
}
