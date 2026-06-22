import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expandPath, loadEnvFile } from './env-file.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'a2l-envfile-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('loadEnvFile', () => {
  it('parses KEY=value, ignoring comments and blank lines', () => {
    const file = join(dir, 'acme.env');
    writeFileSync(
      file,
      ['# a comment', '', 'LINEAR_API_KEY_ACME=lin_api_acme', '  OTHER = spaced ', '#x=y'].join('\n'),
      'utf-8'
    );
    const parsed = loadEnvFile(file);
    expect(parsed.LINEAR_API_KEY_ACME).toBe('lin_api_acme');
    expect(parsed.OTHER).toBe('spaced');
    expect(parsed.x).toBeUndefined();
  });

  it('strips a single pair of surrounding quotes', () => {
    const file = join(dir, 'q.env');
    writeFileSync(file, ['A="dq"', "B='sq'", 'C=plain'].join('\n'), 'utf-8');
    const parsed = loadEnvFile(file);
    expect(parsed.A).toBe('dq');
    expect(parsed.B).toBe('sq');
    expect(parsed.C).toBe('plain');
  });

  it('does NOT mutate process.env', () => {
    const file = join(dir, 'noenv.env');
    writeFileSync(file, 'A2L_ENVFILE_PROBE=should_not_leak', 'utf-8');
    loadEnvFile(file);
    expect(process.env.A2L_ENVFILE_PROBE).toBeUndefined();
  });

  it('returns {} for a missing file', () => {
    expect(loadEnvFile(join(dir, 'nope.env'))).toEqual({});
  });
});

describe('expandPath', () => {
  it('expands a bare ~ to the home directory', () => {
    expect(expandPath('~')).toBe(homedir());
  });

  it('expands a leading ~/ to the home directory', () => {
    expect(expandPath('~/.secrets/acme.env')).toBe(join(homedir(), '.secrets/acme.env'));
  });

  it('expands $VAR and ${VAR} references', () => {
    vi.stubEnv('A2L_SECRETS_DIR', '/tmp/secrets');
    expect(expandPath('$A2L_SECRETS_DIR/acme.env')).toBe('/tmp/secrets/acme.env');
    expect(expandPath('${A2L_SECRETS_DIR}/acme.env')).toBe('/tmp/secrets/acme.env');
  });
});
