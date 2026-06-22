/**
 * Minimal dotenv reader for per-profile env-files (Phase 4).
 *
 * `loadEnvFile()` parses `KEY=value` lines into a local map WITHOUT mutating
 * `process.env`, so a profile's env-file only ever supplies that profile's key
 * (no cross-profile leakage). `expandPath()` resolves `~` and `$VAR`/`${VAR}` in
 * the configured `envFile` path. No new dependency — a tiny parser, not dotenv.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';

/** Resolve `~` (home) and `$VAR` / `${VAR}` references in a path. */
export function expandPath(p: string): string {
  let out = p;
  if (out === '~') {
    return homedir();
  }
  if (out.startsWith('~/')) {
    out = homedir() + out.slice(1);
  }
  return out.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_match, name: string) => {
    return process.env[name] ?? '';
  });
}

/**
 * Parse a dotenv-style file into a record. Ignores blank lines and `#` comments,
 * trims keys/values, and strips a single pair of surrounding quotes. Returns `{}`
 * for a missing/unreadable file. Never touches `process.env`.
 */
export function loadEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(expandPath(path), 'utf-8');
  } catch {
    return {};
  }

  const result: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!key) {
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
