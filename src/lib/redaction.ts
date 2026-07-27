const registeredSecrets = new Set<string>();
const SENSITIVE_FIELD =
  /(?:api.?key|authorization|headers?|body|variables|password|secret|token|cookie|credentials?)/i;
const LINEAR_KEY = /\blin_api_[A-Za-z0-9_-]+\b/g;
const BEARER = /\bBearer\s+[^\s,;]+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Register a resolved credential so even opaque, nonstandard values are redacted. */
export function registerSecret(value: string | undefined): void {
  if (value && value.length >= 4) registeredSecrets.add(value);
}

export function resetRegisteredSecrets(): void {
  registeredSecrets.clear();
}

/** Redact credentials from free-form text without exposing the matched value. */
export function redactText(value: string): string {
  let result = value;
  for (const secret of [...registeredSecrets].sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
  }
  return result.replace(LINEAR_KEY, '[REDACTED]').replace(BEARER, 'Bearer [REDACTED]');
}

/** Convert arbitrary diagnostic data into a cycle-safe, recursively redacted value. */
export function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return redactText(String(value));
  }
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) return value.map(entry => redactValue(entry, seen));

  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    safe[key] = SENSITIVE_FIELD.test(key) ? '[REDACTED]' : redactValue(entry, seen);
  }
  return safe;
}
