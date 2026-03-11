import { describe, expect,it } from 'vitest';

import {
  formatEntityNotFoundError,
  validateAndNormalizeColor,
  validateEnumValue,
  validateISODate,
  validateNonEmpty,
  validatePriority,
} from './validators.js';

describe('validatePriority', () => {
  it('accepts valid numeric priorities 0-4', () => {
    for (let i = 0; i <= 4; i++) {
      const result = validatePriority(i);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(i);
    }
  });

  it('accepts string priorities', () => {
    const result = validatePriority('2');
    expect(result.valid).toBe(true);
    expect(result.value).toBe(2);
  });

  it('rejects priority below 0', () => {
    const result = validatePriority(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid priority');
  });

  it('rejects priority above 4', () => {
    const result = validatePriority(5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid priority');
  });

  it('rejects non-numeric strings', () => {
    const result = validatePriority('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid priority');
  });
});

describe('validateAndNormalizeColor', () => {
  it('accepts valid hex color with #', () => {
    const result = validateAndNormalizeColor('#FF6B6B');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('#FF6B6B');
  });

  it('normalizes color without # prefix', () => {
    const result = validateAndNormalizeColor('FF6B6B');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('#FF6B6B');
  });

  it('normalizes to uppercase', () => {
    const result = validateAndNormalizeColor('ff6b6b');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('#FF6B6B');
  });

  it('rejects invalid hex characters', () => {
    const result = validateAndNormalizeColor('ZZZZZZ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid color format');
  });

  it('rejects short hex codes', () => {
    const result = validateAndNormalizeColor('#FFF');
    expect(result.valid).toBe(false);
  });

  it('rejects too-long hex codes', () => {
    const result = validateAndNormalizeColor('#FF6B6B00');
    expect(result.valid).toBe(false);
  });
});

describe('validateISODate', () => {
  it('accepts valid ISO date', () => {
    const result = validateISODate('2025-01-15');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('2025-01-15');
  });

  it('rejects US date format', () => {
    const result = validateISODate('01/15/2025');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid date format');
  });

  it('rejects invalid calendar date', () => {
    const result = validateISODate('2025-02-30');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid date');
  });

  it('rejects month 13', () => {
    const result = validateISODate('2025-13-01');
    expect(result.valid).toBe(false);
  });

  it('accepts leap year date', () => {
    const result = validateISODate('2024-02-29');
    expect(result.valid).toBe(true);
  });

  it('rejects non-leap year Feb 29', () => {
    const result = validateISODate('2025-02-29');
    expect(result.valid).toBe(false);
  });
});

describe('validateEnumValue', () => {
  const allowed = ['month', 'quarter', 'halfYear', 'year'];

  it('accepts valid enum value', () => {
    const result = validateEnumValue('quarter', allowed, 'resolution');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('quarter');
  });

  it('rejects invalid enum value', () => {
    const result = validateEnumValue('week', allowed, 'resolution');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid resolution');
    expect(result.error).toContain('month, quarter, halfYear, year');
  });

  it('uses generic name when fieldName not provided', () => {
    const result = validateEnumValue('invalid', allowed);
    expect(result.error).toContain('Invalid value');
  });
});

describe('validateNonEmpty', () => {
  it('accepts non-empty string', () => {
    const result = validateNonEmpty('hello', 'name');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('trims whitespace', () => {
    const result = validateNonEmpty('  hello  ', 'name');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('rejects empty string', () => {
    const result = validateNonEmpty('', 'name');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name cannot be empty');
  });

  it('rejects whitespace-only string', () => {
    const result = validateNonEmpty('   ', 'name');
    expect(result.valid).toBe(false);
  });

  it('uses generic message without fieldName', () => {
    const result = validateNonEmpty('');
    expect(result.error).toContain('Value cannot be empty');
  });
});

describe('formatEntityNotFoundError', () => {
  it('formats error with entity type and input', () => {
    const error = formatEntityNotFoundError('team', 'backend', 'teams list');
    expect(error).toContain('Team not found: "backend"');
    expect(error).toContain('agent2linear teams list');
  });

  it('capitalizes entity type', () => {
    const error = formatEntityNotFoundError('workflow state', 'todo', 'workflow-states list');
    expect(error).toContain('Workflow state not found');
  });
});
