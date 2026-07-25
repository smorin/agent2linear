import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';

import { quotePosixShellArg } from './shell-quote.js';

describe('quotePosixShellArg', () => {
  it('always quotes empty and ordinary values', () => {
    expect(quotePosixShellArg('')).toBe("''");
    expect(quotePosixShellArg('cursor')).toBe("'cursor'");
  });

  it('escapes embedded single quotes without enabling shell expansion', () => {
    expect(quotePosixShellArg("a'b")).toBe("'a'\"'\"'b'");
  });

  it.runIf(process.platform !== 'win32')(
    'round-trips adversarial values through a POSIX shell',
    () => {
      const values = [
        'with spaces',
        "single'quote",
        '$(printf exploited)',
        '`printf exploited`',
        'semi;colon',
        'glob*?[x]',
        'line one\nline two',
        'snowman ☃',
      ];
      const command = `printf '%s\\0' ${values.map(quotePosixShellArg).join(' ')}`;
      const output = execFileSync('/bin/sh', ['-c', command]);
      expect(output.toString('utf8').split('\0').slice(0, -1)).toEqual(values);
    }
  );

  it('rejects NUL because it cannot survive an argv round trip', () => {
    expect(() => quotePosixShellArg('a\0b')).toThrow(/NUL/);
  });
});
