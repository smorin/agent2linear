import { describe, it, expect } from 'vitest';
import {
  parseCommaSeparated,
  parsePipeDelimited,
  parseLifecycleDate,
  parsePipeDelimitedArray,
  parseCommaSeparatedUnique,
  validateAnchorType,
  parseAdvancedDependency,
} from './parsers.js';

describe('parseCommaSeparated', () => {
  it('splits basic comma-separated values', () => {
    expect(parseCommaSeparated('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace around values', () => {
    expect(parseCommaSeparated('a, b , c')).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty strings from double commas', () => {
    expect(parseCommaSeparated('a,,c')).toEqual(['a', 'c']);
  });

  it('handles trailing comma', () => {
    expect(parseCommaSeparated('a,')).toEqual(['a']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCommaSeparated('')).toEqual([]);
  });

  it('handles single value', () => {
    expect(parseCommaSeparated('hello')).toEqual(['hello']);
  });

  it('handles values with special characters', () => {
    expect(parseCommaSeparated('user_1,john@example.com,alias')).toEqual([
      'user_1',
      'john@example.com',
      'alias',
    ]);
  });
});

describe('parsePipeDelimited', () => {
  it('splits on first pipe character', () => {
    expect(parsePipeDelimited('https://example.com|Example Site')).toEqual({
      key: 'https://example.com',
      value: 'Example Site',
    });
  });

  it('returns whole string as key when no pipe', () => {
    expect(parsePipeDelimited('https://example.com')).toEqual({
      key: 'https://example.com',
      value: '',
    });
  });

  it('only splits on first pipe', () => {
    expect(parsePipeDelimited('key|value|extra')).toEqual({
      key: 'key',
      value: 'value|extra',
    });
  });

  it('trims whitespace', () => {
    expect(parsePipeDelimited('  url  |  label  ')).toEqual({
      key: 'url',
      value: 'label',
    });
  });
});

describe('parseLifecycleDate', () => {
  it('handles "now" keyword', () => {
    const result = parseLifecycleDate('now');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles "NOW" (case insensitive)', () => {
    const result = parseLifecycleDate('NOW');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('parses valid ISO date', () => {
    const result = parseLifecycleDate('2025-01-15');
    expect(result).toBe('2025-01-15T00:00:00.000Z');
  });

  it('throws for invalid date format', () => {
    expect(() => parseLifecycleDate('01/15/2025')).toThrow('Invalid date format');
  });

  it('throws for non-date string', () => {
    expect(() => parseLifecycleDate('not-a-date')).toThrow('Invalid date format');
  });

  it('trims whitespace for "now"', () => {
    const result = parseLifecycleDate('  now  ');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('parsePipeDelimitedArray', () => {
  it('parses array of pipe-delimited values', () => {
    const result = parsePipeDelimitedArray([
      'https://github.com/repo|GitHub',
      'https://docs.site.com',
    ]);
    expect(result).toEqual([
      { key: 'https://github.com/repo', value: 'GitHub' },
      { key: 'https://docs.site.com', value: '' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parsePipeDelimitedArray([])).toEqual([]);
  });
});

describe('parseCommaSeparatedUnique', () => {
  it('deduplicates values', () => {
    expect(parseCommaSeparatedUnique('a,b,a,c')).toEqual(['a', 'b', 'c']);
  });

  it('is case-sensitive', () => {
    expect(parseCommaSeparatedUnique('a,A,a')).toEqual(['a', 'A']);
  });
});

describe('validateAnchorType', () => {
  it('accepts "start"', () => {
    expect(validateAnchorType('start')).toBe('start');
  });

  it('accepts "end"', () => {
    expect(validateAnchorType('end')).toBe('end');
  });

  it('is case insensitive', () => {
    expect(validateAnchorType('START')).toBe('start');
    expect(validateAnchorType('End')).toBe('end');
  });

  it('throws for invalid values', () => {
    expect(() => validateAnchorType('middle')).toThrow('Invalid anchor type');
  });

  it('trims whitespace', () => {
    expect(validateAnchorType('  start  ')).toBe('start');
  });
});
