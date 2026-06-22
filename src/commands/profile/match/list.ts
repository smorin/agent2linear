import { loadProfiles } from '../../../lib/profiles.js';

/**
 * List a profile's git-remote-owner match rules + exclusion state (offline).
 */
export function profileMatchListCommand(name: string): void {
  const profile = loadProfiles()[name];
  if (!profile) {
    console.error(`❌ Profile "${name}" not found`);
    process.exit(1);
  }

  const owners = profile.match?.gitRemoteOwner ?? [];
  console.log(`Match rules for profile "${name}":`);
  if (owners.length === 0) {
    console.log('  (no git-remote-owner rules)');
  } else {
    for (const owner of owners) {
      console.log(`  git-remote-owner: ${owner}`);
    }
  }
  if (profile.linear === false || profile.match?.linear === false) {
    console.log('  excluded (linear: false)');
  }
}
