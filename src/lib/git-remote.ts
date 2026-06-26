/**
 * Git-tracking check for secrets-hygiene warnings (doctor).
 *
 * `isTrackedByGit()` degrades gracefully so a missing git or non-repo never throws.
 */

import { execFileSync } from 'child_process';
import { basename, dirname } from 'path';

/**
 * Whether `filePath` is tracked by git. Returns false for an untracked file, a
 * non-repo, or when git is unavailable (degrades gracefully — never throws).
 */
export function isTrackedByGit(filePath: string): boolean {
  try {
    execFileSync('git', ['-C', dirname(filePath), 'ls-files', '--error-unmatch', basename(filePath)], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}
