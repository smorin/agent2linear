import { describe, expect, it, vi } from 'vitest';

import { UsageError } from './cli-error.js';
import {
  getHalfYearStartDate,
  getMonthStartDate,
  getQuarterStartDate,
  parseDateForCommand,
  parseMonthName,
  parseProjectDate,
} from './date-parser.js';

describe('parseProjectDate', () => {
  describe('Quarter formats', () => {
    it('should parse "2025-Q1"', () => {
      const result = parseProjectDate('2025-Q1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.resolution).toBe('quarter');
        expect(result.displayText).toBe('Q1 2025');
        expect(result.inputFormat).toBe('quarter');
      }
    });

    it('should parse "Q2 2025"', () => {
      const result = parseProjectDate('Q2 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-04-01');
        expect(result.resolution).toBe('quarter');
        expect(result.displayText).toBe('Q2 2025');
      }
    });

    it('should parse "Q3 2025"', () => {
      const result = parseProjectDate('Q3 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-07-01');
        expect(result.displayText).toBe('Q3 2025');
      }
    });

    it('should parse "2025-Q4"', () => {
      const result = parseProjectDate('2025-Q4');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-10-01');
        expect(result.displayText).toBe('Q4 2025');
      }
    });

    it('should parse "q1-2025" (lowercase with dash)', () => {
      const result = parseProjectDate('q1-2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
      }
    });

    it('should parse "2025-q2" (lowercase)', () => {
      const result = parseProjectDate('2025-q2');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-04-01');
      }
    });

    it('should be case-insensitive', () => {
      const lower = parseProjectDate('2025-q1');
      const upper = parseProjectDate('2025-Q1');
      expect(lower).toEqual(upper);
    });

    it('should reject Q0', () => {
      const result = parseProjectDate('2025-Q0');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid quarter');
        expect(result.suggestion).toContain('Q1, Q2, Q3, or Q4');
      }
    });

    it('should reject Q5', () => {
      const result = parseProjectDate('2025-Q5');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid quarter');
      }
    });

    it('should reject invalid year (too low)', () => {
      const result = parseProjectDate('1999-Q1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
      }
    });

    it('should reject invalid year (too high)', () => {
      const result = parseProjectDate('2101-Q1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
      }
    });

    it('should accept year 2000', () => {
      const result = parseProjectDate('2000-Q1');
      expect(result.success).toBe(true);
    });

    it('should accept year 2100', () => {
      const result = parseProjectDate('2100-Q1');
      expect(result.success).toBe(true);
    });

    it('should parse "Q1 2026" with space', () => {
      const result = parseProjectDate('Q1 2026');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2026-01-01');
      }
    });
  });

  describe('Half-year formats', () => {
    it('should parse "2025-H1"', () => {
      const result = parseProjectDate('2025-H1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.resolution).toBe('halfYear');
        expect(result.displayText).toBe('H1 2025');
        expect(result.inputFormat).toBe('halfYear');
      }
    });

    it('should parse "H2 2025"', () => {
      const result = parseProjectDate('H2 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-07-01');
        expect(result.resolution).toBe('halfYear');
        expect(result.displayText).toBe('H2 2025');
      }
    });

    it('should parse "h1-2025" (lowercase with dash)', () => {
      const result = parseProjectDate('h1-2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
      }
    });

    it('should parse "2025-h2" (lowercase)', () => {
      const result = parseProjectDate('2025-h2');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-07-01');
      }
    });

    it('should be case-insensitive', () => {
      const lower = parseProjectDate('2025-h1');
      const upper = parseProjectDate('2025-H1');
      expect(lower).toEqual(upper);
    });

    it('should reject H0', () => {
      const result = parseProjectDate('2025-H0');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid half-year');
        expect(result.suggestion).toContain('H1 or H2');
      }
    });

    it('should reject H3', () => {
      const result = parseProjectDate('2025-H3');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid half-year');
      }
    });

    it('should reject invalid year', () => {
      const result = parseProjectDate('1999-H1');
      expect(result.success).toBe(false);
    });

    it('should accept "H1 2026" with space', () => {
      const result = parseProjectDate('H1 2026');
      expect(result.success).toBe(true);
    });
  });

  describe('Month formats - Numeric', () => {
    it('should parse "2025-01" (January)', () => {
      const result = parseProjectDate('2025-01');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.resolution).toBe('month');
        expect(result.displayText).toBe('January 2025');
        expect(result.inputFormat).toBe('month');
      }
    });

    it('should parse "2025-12" (December)', () => {
      const result = parseProjectDate('2025-12');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-12-01');
        expect(result.displayText).toBe('December 2025');
      }
    });

    it('should parse "2025-6" (single digit month)', () => {
      const result = parseProjectDate('2025-6');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-06-01');
        expect(result.displayText).toBe('June 2025');
      }
    });

    it('should reject month 00', () => {
      const result = parseProjectDate('2025-00');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid month');
      }
    });

    it('should reject month 13', () => {
      const result = parseProjectDate('2025-13');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid month');
        expect(result.suggestion).toContain('01-12');
      }
    });

    it('should reject invalid year (too low) for numeric month', () => {
      const result = parseProjectDate('1999-01');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
        expect(result.suggestion).toContain('2000 and 2100');
      }
    });

    it('should reject invalid year (too high) for numeric month', () => {
      const result = parseProjectDate('2101-12');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
      }
    });
  });

  describe('Month formats - Named', () => {
    it('should parse "Jan 2025"', () => {
      const result = parseProjectDate('Jan 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.displayText).toBe('January 2025');
      }
    });

    it('should parse "January 2025"', () => {
      const result = parseProjectDate('January 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.displayText).toBe('January 2025');
      }
    });

    it('should parse "2025-Jan"', () => {
      const result = parseProjectDate('2025-Jan');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
      }
    });

    it('should parse "Dec 2025"', () => {
      const result = parseProjectDate('Dec 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-12-01');
        expect(result.displayText).toBe('December 2025');
      }
    });

    it('should parse "February 2025"', () => {
      const result = parseProjectDate('February 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-02-01');
        expect(result.displayText).toBe('February 2025');
      }
    });

    it('should parse all month names (short)', () => {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      months.forEach((month, index) => {
        const result = parseProjectDate(`${month} 2025`);
        expect(result.success).toBe(true);
        if (result.success) {
          const expectedMonth = String(index + 1).padStart(2, '0');
          expect(result.date).toBe(`2025-${expectedMonth}-01`);
        }
      });
    });

    it('should be case-insensitive for month names', () => {
      const lower = parseProjectDate('jan 2025');
      const upper = parseProjectDate('JAN 2025');
      const mixed = parseProjectDate('Jan 2025');
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should reject invalid month name', () => {
      const result = parseProjectDate('Janu 2025');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid month name');
      }
    });

    it('should parse "Sept 2025" (alternative September)', () => {
      const result = parseProjectDate('Sept 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-09-01');
      }
    });

    it('should reject invalid year (too low) for named month', () => {
      const result = parseProjectDate('Jan 1999');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
        expect(result.suggestion).toContain('2000 and 2100');
      }
    });

    it('should reject invalid year (too high) for named month', () => {
      const result = parseProjectDate('December 2101');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
      }
    });
  });

  describe('Year format', () => {
    it('should parse "2025"', () => {
      const result = parseProjectDate('2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
        expect(result.resolution).toBe('year');
        expect(result.displayText).toBe('2025');
        expect(result.inputFormat).toBe('year');
      }
    });

    it('should parse "2026"', () => {
      const result = parseProjectDate('2026');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2026-01-01');
      }
    });

    it('should reject year 1999', () => {
      const result = parseProjectDate('1999');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid year');
      }
    });

    it('should reject year 2101', () => {
      const result = parseProjectDate('2101');
      expect(result.success).toBe(false);
    });

    it('should accept year 2000', () => {
      const result = parseProjectDate('2000');
      expect(result.success).toBe(true);
    });

    it('should accept year 2100', () => {
      const result = parseProjectDate('2100');
      expect(result.success).toBe(true);
    });
  });

  describe('ISO date format', () => {
    it('should parse "2025-01-15"', () => {
      const result = parseProjectDate('2025-01-15');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-15');
        expect(result.resolution).toBeUndefined();
        expect(result.displayText).toBe('2025-01-15');
        expect(result.inputFormat).toBe('specific');
      }
    });

    it('should parse "2025-12-31"', () => {
      const result = parseProjectDate('2025-12-31');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-12-31');
      }
    });

    it('should parse "2024-02-29" (leap year)', () => {
      const result = parseProjectDate('2024-02-29');
      expect(result.success).toBe(true);
    });

    it('should reject "2025-02-29" (not leap year)', () => {
      const result = parseProjectDate('2025-02-29');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid date');
      }
    });

    it('should reject "2025-02-30"', () => {
      const result = parseProjectDate('2025-02-30');
      expect(result.success).toBe(false);
    });

    it('should reject "2025-13-01" (invalid month)', () => {
      const result = parseProjectDate('2025-13-01');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid month');
      }
    });

    it('should reject "2025-01-32" (invalid day)', () => {
      const result = parseProjectDate('2025-01-32');
      expect(result.success).toBe(false);
    });

    it('should reject "2025-00-15" (month 00)', () => {
      const result = parseProjectDate('2025-00-15');
      expect(result.success).toBe(false);
    });

    it('should reject year out of range', () => {
      const result = parseProjectDate('1999-01-15');
      expect(result.success).toBe(false);
    });

    it('should reject date with single-digit day (no leading zero)', () => {
      const result = parseProjectDate('2025-01-5');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid date format');
        expect(result.suggestion).toContain('2025-01-15');
      }
    });

    it('should reject date with single-digit month (no leading zero)', () => {
      const result = parseProjectDate('2025-1-15');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid date format');
        expect(result.suggestion).toContain('2025-01-15');
      }
    });
  });

  describe('Resolution detection', () => {
    it('should detect quarter resolution', () => {
      const result = parseProjectDate('2025-Q1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('quarter');
      }
    });

    it('should detect halfYear resolution', () => {
      const result = parseProjectDate('2025-H1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('halfYear');
      }
    });

    it('should detect month resolution (numeric)', () => {
      const result = parseProjectDate('2025-01');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('month');
      }
    });

    it('should detect month resolution (named)', () => {
      const result = parseProjectDate('Jan 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('month');
      }
    });

    it('should detect year resolution', () => {
      const result = parseProjectDate('2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBe('year');
      }
    });

    it('should detect no resolution for specific date', () => {
      const result = parseProjectDate('2025-01-15');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.resolution).toBeUndefined();
      }
    });

    it('should set inputFormat correctly for each type', () => {
      const tests: Array<[string, string]> = [
        ['2025-Q1', 'quarter'],
        ['2025-H1', 'halfYear'],
        ['2025-01', 'month'],
        ['2025', 'year'],
        ['2025-01-15', 'specific'],
      ];

      tests.forEach(([input, expectedFormat]) => {
        const result = parseProjectDate(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.inputFormat).toBe(expectedFormat);
        }
      });
    });
  });

  describe('Parser priority', () => {
    it('should prioritize quarter over year ("2025" could be year)', () => {
      // Year format is just "2025"
      const result = parseProjectDate('2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.inputFormat).toBe('year');
      }
    });

    it('should not confuse "2025-01" (month) with ISO date', () => {
      const result = parseProjectDate('2025-01');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.inputFormat).toBe('month');
        expect(result.resolution).toBe('month');
      }
    });

    it('should handle "2025-01-01" as specific date, not month', () => {
      const result = parseProjectDate('2025-01-01');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.inputFormat).toBe('specific');
        expect(result.resolution).toBeUndefined();
      }
    });

    it('should handle ambiguous input correctly', () => {
      // These should NOT be ambiguous with current patterns
      expect(parseProjectDate('2025-Q1').success).toBe(true);
      expect(parseProjectDate('2025-01').success).toBe(true);
      expect(parseProjectDate('2025-01-01').success).toBe(true);
    });
  });

  describe('Error messages', () => {
    it('should provide helpful suggestion for invalid quarter', () => {
      const result = parseProjectDate('2025-Q5');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid quarter');
        expect(result.suggestion).toContain('Q1, Q2, Q3, or Q4');
        expect(result.suggestion).toContain('2025-Q1');
      }
    });

    it('should provide helpful suggestion for invalid half-year', () => {
      const result = parseProjectDate('2025-H3');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid half-year');
        expect(result.suggestion).toContain('H1 or H2');
      }
    });

    it('should provide examples for unrecognized format', () => {
      const result = parseProjectDate('invalid-date');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid date format');
        expect(result.suggestion).toContain('Supported date formats');
        expect(result.suggestion).toContain('2025-Q1');
      }
    });

    it('should provide helpful error for empty input', () => {
      const result = parseProjectDate('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Empty date input');
      }
    });

    it('should provide helpful error for whitespace input', () => {
      const result = parseProjectDate('   ');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Empty date input');
        expect(result.suggestion).toContain('provide a date value');
      }
    });

    it('should suggest ISO format for malformed dates', () => {
      const result = parseProjectDate('2025/01/15');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid date format');
        expect(result.suggestion).toContain('2025-01-15');
        expect(result.suggestion).toContain('YYYY-MM-DD');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle leading/trailing whitespace', () => {
      const result = parseProjectDate('  2025-Q1  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
      }
    });

    it('should handle mixed case in month names', () => {
      const result = parseProjectDate('jAnUaRy 2025');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.date).toBe('2025-01-01');
      }
    });

    it('should handle all valid quarters', () => {
      const quarters = [1, 2, 3, 4];
      quarters.forEach(q => {
        const result = parseProjectDate(`2025-Q${q}`);
        expect(result.success).toBe(true);
      });
    });

    it('should handle all valid half-years', () => {
      const halves = [1, 2];
      halves.forEach(h => {
        const result = parseProjectDate(`2025-H${h}`);
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Helper functions', () => {
  describe('getQuarterStartDate', () => {
    it('should return correct date for Q1', () => {
      expect(getQuarterStartDate(2025, 1)).toBe('2025-01-01');
    });

    it('should return correct date for Q2', () => {
      expect(getQuarterStartDate(2025, 2)).toBe('2025-04-01');
    });

    it('should return correct date for Q3', () => {
      expect(getQuarterStartDate(2025, 3)).toBe('2025-07-01');
    });

    it('should return correct date for Q4', () => {
      expect(getQuarterStartDate(2025, 4)).toBe('2025-10-01');
    });

    it('should throw for invalid quarter (0)', () => {
      expect(() => getQuarterStartDate(2025, 0)).toThrow('Invalid quarter');
    });

    it('should throw for invalid quarter (5)', () => {
      expect(() => getQuarterStartDate(2025, 5)).toThrow('Invalid quarter');
    });
  });

  describe('getHalfYearStartDate', () => {
    it('should return correct date for H1', () => {
      expect(getHalfYearStartDate(2025, 1)).toBe('2025-01-01');
    });

    it('should return correct date for H2', () => {
      expect(getHalfYearStartDate(2025, 2)).toBe('2025-07-01');
    });

    it('should throw for invalid half (0)', () => {
      expect(() => getHalfYearStartDate(2025, 0)).toThrow('Invalid half-year');
    });

    it('should throw for invalid half (3)', () => {
      expect(() => getHalfYearStartDate(2025, 3)).toThrow('Invalid half-year');
    });
  });

  describe('getMonthStartDate', () => {
    it('should return correct date for January', () => {
      expect(getMonthStartDate(2025, 1)).toBe('2025-01-01');
    });

    it('should return correct date for December', () => {
      expect(getMonthStartDate(2025, 12)).toBe('2025-12-01');
    });

    it('should pad single-digit months', () => {
      expect(getMonthStartDate(2025, 6)).toBe('2025-06-01');
    });

    it('should throw for invalid month (0)', () => {
      expect(() => getMonthStartDate(2025, 0)).toThrow('Invalid month');
    });

    it('should throw for invalid month (13)', () => {
      expect(() => getMonthStartDate(2025, 13)).toThrow('Invalid month');
    });
  });

  describe('parseMonthName', () => {
    it('should parse short month names', () => {
      expect(parseMonthName('Jan')).toBe(1);
      expect(parseMonthName('Feb')).toBe(2);
      expect(parseMonthName('Dec')).toBe(12);
    });

    it('should parse full month names', () => {
      expect(parseMonthName('January')).toBe(1);
      expect(parseMonthName('February')).toBe(2);
      expect(parseMonthName('December')).toBe(12);
    });

    it('should be case-insensitive', () => {
      expect(parseMonthName('jan')).toBe(1);
      expect(parseMonthName('JAN')).toBe(1);
      expect(parseMonthName('Jan')).toBe(1);
    });

    it('should return null for invalid month name', () => {
      expect(parseMonthName('Janu')).toBeNull();
      expect(parseMonthName('Invalid')).toBeNull();
      expect(parseMonthName('')).toBeNull();
    });

    it('should handle "Sept" as alternative to "Sep"', () => {
      expect(parseMonthName('Sept')).toBe(9);
      expect(parseMonthName('September')).toBe(9);
    });
  });
});

describe('parseDateForCommand', () => {
  it('should return parsed date with resolution for valid quarter input', () => {
    const result = parseDateForCommand('2025-Q1', 'start date');
    expect(result.date).toBe('2025-01-01');
    expect(result.resolution).toBe('quarter');
    expect(result.displayText).toBe('Q1 2025');
  });

  it('should return parsed date with resolution for valid month input', () => {
    const result = parseDateForCommand('Jan 2025', 'target date');
    expect(result.date).toBe('2025-01-01');
    expect(result.resolution).toBe('month');
    expect(result.displayText).toBe('January 2025');
  });

  it('should return parsed date without resolution for specific date', () => {
    const result = parseDateForCommand('2025-01-15', 'target date');
    expect(result.date).toBe('2025-01-15');
    expect(result.resolution).toBeUndefined();
    expect(result.displayText).toBe('2025-01-15');
  });

  it('[RLS-OUT-JSON-ERROR] throws a usage error instead of exiting on invalid input', () => {
    const exit = vi.spyOn(process, 'exit');

    expect(() => parseDateForCommand('invalid', 'start date')).toThrow(UsageError);
    expect(() => parseDateForCommand('invalid', 'start date')).toThrow(/Invalid start date/);
    expect(exit).not.toHaveBeenCalled();
  });

  it('should use fieldName in error messages', () => {
    expect(() => parseDateForCommand('2025-Q5', 'target date')).toThrow(/Invalid target date/);
  });
});
