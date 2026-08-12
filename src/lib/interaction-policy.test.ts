import { afterEach, describe, expect, it } from 'vitest';

import { UsageError } from './cli-error.js';
import {
  assertInteractionAllowed,
  noInputRequested,
  requireInteractiveInput,
} from './interaction-policy.js';
import { resetInvocationContext, setInvocationContext } from './invocation-context.js';

afterEach(() => {
  resetInvocationContext();
});

describe('no-input policy', () => {
  it('merges the root invocation policy with a local prompt option', () => {
    expect(noInputRequested()).toBe(false);
    expect(noInputRequested(true)).toBe(true);
    setInvocationContext({ noInput: true });
    expect(noInputRequested()).toBe(true);
  });

  it('rejects always-interactive actions', () => {
    expect(() => assertInteractionAllowed(['setup'], true, true)).toThrow(UsageError);
    expect(() => assertInteractionAllowed(['setup'], false, false)).toThrow(UsageError);
  });

  it('allows ordinary actions while no-input is set', () => {
    expect(() => assertInteractionAllowed(['workspace', 'current'], true, false)).not.toThrow();
    setInvocationContext({ noInput: true, apiKeyFromStdin: true });
    expect(() => requireInteractiveInput('confirmation', false, true)).toThrow(UsageError);
  });

  it('rejects an interactive boundary without a TTY', () => {
    expect(() => requireInteractiveInput('confirmation', false, false)).toThrow(UsageError);
    expect(() => requireInteractiveInput('confirmation', false, true)).not.toThrow();
  });
});
