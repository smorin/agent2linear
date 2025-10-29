/**
 * Smart Date Parser for Linear Project Dates
 *
 * Supports flexible input formats:
 * - Quarters: 2025-Q1, Q1 2025, q1-2025
 * - Half-years: 2025-H1, H1 2025
 * - Months: 2025-01, Jan 2025, January 2025
 * - Years: 2025
 * - ISO dates: 2025-01-15
 *
 * Based on DATES.md specification
 */

/**
 * Successfully parsed date result
 */
export interface ParsedDate {
  success: true;
  date: string; // ISO 8601: "2025-01-01"
  resolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  displayText: string; // "Q1 2025", "January 2025", etc.
  inputFormat: 'quarter' | 'halfYear' | 'month' | 'year' | 'specific';
}

/**
 * Date parsing error with helpful suggestion
 */
export interface DateParseError {
  success: false;
  error: string; // What went wrong
  suggestion: string; // Helpful examples
}

export type DateParseResult = ParsedDate | DateParseError;

/**
 * Get the start date for a quarter (1-4)
 */
export function getQuarterStartDate(year: number, quarter: number): string {
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}. Must be 1-4`);
  }
  const month = (quarter - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Get the start date for a half-year (1-2)
 */
export function getHalfYearStartDate(year: number, half: number): string {
  if (half < 1 || half > 2) {
    throw new Error(`Invalid half-year: ${half}. Must be 1 or 2`);
  }
  const month = half === 1 ? 1 : 7;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Get the start date for a month
 */
export function getMonthStartDate(year: number, month: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be 1-12`);
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Parse month name to number (Jan → 1, December → 12)
 */
export function parseMonthName(name: string): number | null {
  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  return months[name.toLowerCase()] ?? null;
}

/**
 * Get display name for month number
 */
function getMonthDisplayName(month: number): string {
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return names[month - 1] || 'Unknown';
}

/**
 * Parse quarter format (2025-Q1, Q1 2025, q1-2025, etc.)
 */
function parseQuarter(input: string): DateParseResult | null {
  // Formats: 2025-Q1, Q1 2025, q1-2025, 2025-q1
  // Match Q with any digit, then validate
  const quarterRegex = /^(?:(\d{4})[-\s]?[qQ](\d)|[qQ](\d)[-\s]?(\d{4}))$/;
  const match = input.match(quarterRegex);

  if (!match) return null;

  const year = parseInt(match[1] || match[4]);
  const quarter = parseInt(match[2] || match[3]);

  // Validate quarter (1-4)
  if (quarter < 1 || quarter > 4) {
    return {
      success: false,
      error: `Invalid quarter: Q${quarter}`,
      suggestion:
        'Quarter must be Q1, Q2, Q3, or Q4\n' +
        '  --start-date "2025-Q1"     → Q1 2025 (Jan 1 - Mar 31)\n' +
        '  --start-date "Q2 2025"     → Q2 2025 (Apr 1 - Jun 30)\n' +
        '  --start-date "Q3 2025"     → Q3 2025 (Jul 1 - Sep 30)\n' +
        '  --start-date "Q4 2025"     → Q4 2025 (Oct 1 - Dec 31)',
    };
  }

  // Validate year range (2000-2100)
  if (year < 2000 || year > 2100) {
    return {
      success: false,
      error: `Invalid year: ${year}`,
      suggestion: 'Year must be between 2000 and 2100',
    };
  }

  const date = getQuarterStartDate(year, quarter);

  return {
    success: true,
    date,
    resolution: 'quarter',
    displayText: `Q${quarter} ${year}`,
    inputFormat: 'quarter',
  };
}

/**
 * Parse half-year format (2025-H1, H1 2025, etc.)
 */
function parseHalfYear(input: string): DateParseResult | null {
  // Formats: 2025-H1, H1 2025, h1-2025, 2025-h1
  // Match H with any digit, then validate
  const halfYearRegex = /^(?:(\d{4})[-\s]?[hH](\d)|[hH](\d)[-\s]?(\d{4}))$/;
  const match = input.match(halfYearRegex);

  if (!match) return null;

  const year = parseInt(match[1] || match[4]);
  const half = parseInt(match[2] || match[3]);

  // Validate half (1-2)
  if (half < 1 || half > 2) {
    return {
      success: false,
      error: `Invalid half-year: H${half}`,
      suggestion:
        'Half-year must be H1 or H2\n' +
        '  --start-date "2025-H1"     → H1 2025 (Jan 1 - Jun 30)\n' +
        '  --start-date "H2 2025"     → H2 2025 (Jul 1 - Dec 31)',
    };
  }

  // Validate year range (2000-2100)
  if (year < 2000 || year > 2100) {
    return {
      success: false,
      error: `Invalid year: ${year}`,
      suggestion: 'Year must be between 2000 and 2100',
    };
  }

  const date = getHalfYearStartDate(year, half);

  return {
    success: true,
    date,
    resolution: 'halfYear',
    displayText: `H${half} ${year}`,
    inputFormat: 'halfYear',
  };
}

/**
 * Parse month format (2025-01, Jan 2025, January 2025, etc.)
 */
function parseMonth(input: string): DateParseResult | null {
  // Format 1: Numeric month (2025-01) - but NOT ISO date (2025-01-15)
  // Must be exactly YYYY-MM format (no third component)
  const numericRegex = /^(\d{4})-(\d{1,2})$/;
  const numericMatch = input.match(numericRegex);

  if (numericMatch) {
    const year = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]);

    // Validate month (1-12)
    if (month < 1 || month > 12) {
      return {
        success: false,
        error: `Invalid month: ${month}`,
        suggestion:
          'Month must be 01-12 or name (Jan-Dec). Examples:\n' +
          '  --start-date "2025-01"     → January 2025\n' +
          '  --start-date "Jan 2025"    → January 2025\n' +
          '  --start-date "2025-12"     → December 2025',
      };
    }

    // Validate year range (2000-2100)
    if (year < 2000 || year > 2100) {
      return {
        success: false,
        error: `Invalid year: ${year}`,
        suggestion: 'Year must be between 2000 and 2100',
      };
    }

    const date = getMonthStartDate(year, month);

    return {
      success: true,
      date,
      resolution: 'month',
      displayText: `${getMonthDisplayName(month)} ${year}`,
      inputFormat: 'month',
    };
  }

  // Format 2: Named month (Jan 2025, January 2025, 2025-Jan)
  const namedRegex = /^(?:([a-zA-Z]+)[\s-](\d{4})|(\d{4})[\s-]([a-zA-Z]+))$/;
  const namedMatch = input.match(namedRegex);

  if (namedMatch) {
    const year = parseInt(namedMatch[2] || namedMatch[3]);
    const monthName = namedMatch[1] || namedMatch[4];
    const month = parseMonthName(monthName);

    if (month === null) {
      return {
        success: false,
        error: `Invalid month name: "${monthName}"`,
        suggestion:
          'Month must be Jan-Dec or January-December. Examples:\n' +
          '  --start-date "Jan 2025"    → January 2025\n' +
          '  --start-date "February 2025"\n' +
          '  --start-date "2025-Dec"    → December 2025',
      };
    }

    // Validate year range (2000-2100)
    if (year < 2000 || year > 2100) {
      return {
        success: false,
        error: `Invalid year: ${year}`,
        suggestion: 'Year must be between 2000 and 2100',
      };
    }

    const date = getMonthStartDate(year, month);

    return {
      success: true,
      date,
      resolution: 'month',
      displayText: `${getMonthDisplayName(month)} ${year}`,
      inputFormat: 'month',
    };
  }

  return null;
}

/**
 * Parse year format (2025)
 */
function parseYear(input: string): DateParseResult | null {
  // Format: 4-digit year
  const yearRegex = /^(\d{4})$/;
  const match = input.match(yearRegex);

  if (!match) return null;

  const year = parseInt(match[1]);

  // Validate year range (2000-2100)
  if (year < 2000 || year > 2100) {
    return {
      success: false,
      error: `Invalid year: ${year}`,
      suggestion: 'Year must be between 2000 and 2100',
    };
  }

  const date = `${year}-01-01`;

  return {
    success: true,
    date,
    resolution: 'year',
    displayText: `${year}`,
    inputFormat: 'year',
  };
}

/**
 * Parse ISO date format (YYYY-MM-DD)
 */
function parseISODate(input: string): DateParseResult {
  // Regex: YYYY-MM-DD
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = input.match(isoRegex);

  if (!match) {
    return {
      success: false,
      error: `Invalid ISO date format: "${input}"`,
      suggestion:
        'Date must be in YYYY-MM-DD format. Examples:\n' +
        '  --start-date "2025-01-15"\n' +
        '  --start-date "2025-03-31"',
    };
  }

  // Extract date components
  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);

  // Validate year range
  if (year < 2000 || year > 2100) {
    return {
      success: false,
      error: `Invalid year: ${year}`,
      suggestion: 'Year must be between 2000 and 2100',
    };
  }

  // Validate month
  if (month < 1 || month > 12) {
    return {
      success: false,
      error: `Invalid month: ${month}`,
      suggestion: 'Month must be between 01 and 12',
    };
  }

  // Validate it's a real date by creating a Date object
  // Use UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return {
      success: false,
      error: `Invalid date: "${input}"`,
      suggestion:
        'Date does not exist (e.g., 2025-02-30 is invalid). Examples:\n' +
        '  --start-date "2025-01-15"  → Valid\n' +
        '  --start-date "2024-02-29"  → Valid (leap year)\n' +
        '  --start-date "2025-02-29"  → Invalid (not leap year)',
    };
  }

  return {
    success: true,
    date: input,
    resolution: undefined,
    displayText: input,
    inputFormat: 'specific',
  };
}

/**
 * Parse project date with flexible input formats
 *
 * Supported formats (case-insensitive):
 * - Quarters: 2025-Q1, Q1 2025, q1-2025
 * - Half-years: 2025-H1, H1 2025
 * - Months: 2025-01, Jan 2025, January 2025, 2025-Jan
 * - Years: 2025
 * - ISO dates: 2025-01-15
 *
 * Parser priority (first match wins):
 * 1. Quarter formats
 * 2. Half-year formats
 * 3. Month formats
 * 4. Year format
 * 5. ISO date format
 */
export function parseProjectDate(input: string): DateParseResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      error: 'Empty date input',
      suggestion: 'Please provide a date value',
    };
  }

  // Priority 1: Try quarter formats
  const quarterResult = parseQuarter(trimmed);
  if (quarterResult !== null) return quarterResult;

  // Priority 2: Try half-year formats
  const halfYearResult = parseHalfYear(trimmed);
  if (halfYearResult !== null) return halfYearResult;

  // Priority 3: Try month formats
  const monthResult = parseMonth(trimmed);
  if (monthResult !== null) return monthResult;

  // Priority 4: Try year format
  const yearResult = parseYear(trimmed);
  if (yearResult !== null) return yearResult;

  // Priority 5: Try ISO date if it matches the pattern (YYYY-MM-DD exactly)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseISODate(trimmed);
  }

  return {
    success: false,
    error: `Invalid date format: "${trimmed}"`,
    suggestion:
      'Supported date formats include:\n' +
      '  --start-date "2025-Q1"     → Quarter start date\n' +
      '  --start-date "H2 2025"     → Half-year start date\n' +
      '  --start-date "Jan 2025"    → Month start date\n' +
      '  --start-date "2025-01"     → Month start date (numeric)\n' +
      '  --start-date "2025"        → Year start date\n' +
      '  --start-date "2025-01-15"  → Specific ISO date (YYYY-MM-DD)',
  };
}

/**
 * Parse date for CLI commands with error handling and console output
 *
 * This is a convenience wrapper around parseProjectDate() that:
 * - Handles errors by printing to console and exiting
 * - Returns a simple object with date and optional resolution
 * - Used by project create/update commands
 *
 * @param input - Date string from user input
 * @param fieldName - Human-readable field name for error messages (e.g., "start date")
 * @returns Object with ISO date string and optional resolution
 */
export function parseDateForCommand(
  input: string,
  fieldName: string,
): { date: string; resolution?: 'month' | 'quarter' | 'halfYear' | 'year'; displayText: string } {
  const result = parseProjectDate(input);

  if (!result.success) {
    console.error(`❌ Invalid ${fieldName}: ${result.error}\n`);
    console.error(result.suggestion);
    process.exit(1);
  }

  return {
    date: result.date,
    resolution: result.resolution,
    displayText: result.displayText,
  };
}

/**
 * Validation result for resolution override checking
 */
export interface ResolutionValidationResult {
  valid: boolean;
  warning?: string;
  info?: string;
}

/**
 * Validate explicit resolution override against auto-detected resolution
 *
 * This function checks for conflicting or redundant resolution specifications
 * when both date format and explicit resolution flag are provided.
 *
 * Validation rules:
 * - ALLOW: Auto-detected matches explicit (redundant but harmless)
 *   Example: --start-date "2025-Q1" --start-date-resolution quarter ✅
 *
 * - ALLOW: ISO date + explicit resolution (legitimate use case)
 *   Example: --start-date "2025-01-15" --start-date-resolution quarter ✅
 *
 * - WARN: Format implies resolution but explicit flag differs
 *   Example: --start-date "2025-Q1" --start-date-resolution month ⚠️
 *
 * - INFO: No format-implied resolution, explicit used
 *   Example: --start-date "2025-01-01" --start-date-resolution quarter ℹ️
 *
 * @param dateInput - Original date input string (e.g., "2025-Q1", "2025-01-15")
 * @param detectedResolution - Resolution auto-detected from format (undefined for ISO dates)
 * @param explicitResolution - Resolution explicitly set via CLI flag
 * @returns Validation result with optional warning or info message
 */
export function validateResolutionOverride(
  dateInput: string,
  detectedResolution: 'month' | 'quarter' | 'halfYear' | 'year' | undefined,
  explicitResolution: 'month' | 'quarter' | 'halfYear' | 'year' | undefined,
): ResolutionValidationResult {
  // No explicit resolution provided - auto-detection only (ideal case)
  if (!explicitResolution) {
    return { valid: true };
  }

  // No auto-detected resolution (ISO date) + explicit resolution (legitimate use case)
  if (!detectedResolution) {
    return {
      valid: true,
      info: `Using explicit resolution: ${explicitResolution}`,
    };
  }

  // Both present: Check for conflicts
  if (detectedResolution !== explicitResolution) {
    return {
      valid: true, // Allow but warn
      warning:
        `Date format '${dateInput}' implies ${detectedResolution} resolution, ` +
        `but --*-date-resolution is set to '${explicitResolution}'. ` +
        `Using explicit value (${explicitResolution}).`,
    };
  }

  // Both present and matching (redundant but harmless - no message needed)
  return { valid: true };
}
