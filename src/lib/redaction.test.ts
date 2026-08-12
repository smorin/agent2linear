import { afterEach, describe, expect, it } from 'vitest';

import {
  redactText,
  redactValue,
  registerSecret,
  resetRegisteredSecrets,
} from './redaction.js';

afterEach(() => resetRegisteredSecrets());

describe('diagnostic redaction', () => {
  it('redacts registered values and recognizable Linear credentials in strings', () => {
    registerSecret('opaque-credential-sentinel');

    expect(redactText('a opaque-credential-sentinel b lin_api_visible_token c')).toBe(
      'a [REDACTED] b [REDACTED] c'
    );
  });

  it('redacts sensitive fields recursively while preserving safe metadata', () => {
    expect(
      redactValue({
        method: 'POST',
        status: 200,
        apiKey: 'secret',
        authorization: 'Bearer secret',
        headers: { authorization: 'secret' },
        body: { title: 'private' },
        variables: { after: 'cursor' },
        nested: { password: 'secret', pageCount: 2 },
      })
    ).toEqual({
      method: 'POST',
      status: 200,
      apiKey: '[REDACTED]',
      authorization: '[REDACTED]',
      headers: '[REDACTED]',
      body: '[REDACTED]',
      variables: '[REDACTED]',
      nested: { password: '[REDACTED]', pageCount: 2 },
    });
  });

  it('sanitizes Error message/stack and handles cycles without throwing', () => {
    registerSecret('opaque-error-secret');
    const error = new Error('failed with opaque-error-secret');
    const cyclic: Record<string, unknown> = { error };
    cyclic.self = cyclic;

    const safe = redactValue(cyclic) as Record<string, unknown>;
    expect(JSON.stringify(safe)).not.toContain('opaque-error-secret');
    expect(safe.self).toBe('[Circular]');
    expect(safe.error).toMatchObject({ name: 'Error', message: 'failed with [REDACTED]' });
  });
});
