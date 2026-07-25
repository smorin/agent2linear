import { describe, expect, it } from 'vitest';

import { UsageError } from './cli-error.js';
import { resolveOutputMode } from './output-mode.js';

describe('resolveOutputMode', () => {
  it('[CPH-OPT-HISTORY-LIST-OUTPUT] defaults to table when neither selector is present', () => {
    expect(resolveOutputMode({})).toBe('table');
  });

  it('[CPH-OPT-HISTORY-LIST-OUTPUT] accepts each explicitly allowed output mode', () => {
    expect(resolveOutputMode({ output: 'table', outputSource: 'explicit' })).toBe('table');
    expect(resolveOutputMode({ output: 'json', outputSource: 'explicit' })).toBe('json');
    expect(resolveOutputMode({ output: 'tsv', outputSource: 'explicit' })).toBe('tsv');
  });

  it('[CPH-OPT-HISTORY-LIST-JSON] treats --json as exact output-json shorthand', () => {
    expect(resolveOutputMode({ json: true })).toBe('json');
  });

  it('[CPH-OUT-JSON-CONFLICT] accepts explicit output json together with --json', () => {
    expect(resolveOutputMode({ output: 'json', outputSource: 'explicit', json: true })).toBe(
      'json'
    );
  });

  it('[CPH-OUT-JSON-CONFLICT] rejects explicit non-JSON output together with --json', () => {
    expect(() =>
      resolveOutputMode({ output: 'table', outputSource: 'explicit', json: true })
    ).toThrow(UsageError);
    expect(() =>
      resolveOutputMode({ output: 'tsv', outputSource: 'explicit', json: true })
    ).toThrow(/--json cannot be combined with explicit --output 'tsv'/);
  });

  it('[CPH-OUT-JSON-CONFLICT] does not conflict with an implicit Commander default', () => {
    expect(resolveOutputMode({ output: 'table', outputSource: 'default', json: true })).toBe(
      'json'
    );
  });

  it('[CPH-OPT-HISTORY-LIST-OUTPUT] enforces a command-specific allowed-mode set', () => {
    expect(
      resolveOutputMode({
        output: 'json',
        outputSource: 'explicit',
        allowedModes: ['table', 'json'],
      })
    ).toBe('json');
    expect(() =>
      resolveOutputMode({
        output: 'tsv',
        outputSource: 'explicit',
        allowedModes: ['table', 'json'],
      })
    ).toThrow(/output must be one of: table, json/);
  });

  it('[CPH-OPT-HISTORY-LIST-OUTPUT] rejects unknown and non-exact mode names', () => {
    expect(() => resolveOutputMode({ output: 'yaml', outputSource: 'explicit' })).toThrow(
      UsageError
    );
    expect(() => resolveOutputMode({ output: 'JSON', outputSource: 'explicit' })).toThrow(
      UsageError
    );
  });

  it('[CPH-OPT-HISTORY-LIST-JSON] rejects --json when JSON is unavailable', () => {
    expect(() => resolveOutputMode({ json: true, allowedModes: ['table'] })).toThrow(
      /JSON output is not supported/
    );
  });

  it('[CPH-OPT-HISTORY-LIST-OUTPUT] rejects an allowed-mode set without table default', () => {
    expect(() => resolveOutputMode({ allowedModes: ['json'] })).toThrow(
      /default output mode 'table' is not allowed/
    );
  });
});
