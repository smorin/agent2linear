/**
 * Shared validation utilities for agent2linear CLI
 *
 * These utilities provide consistent validation across all commands,
 * returning structured results instead of calling process.exit().
 */

/**
 * Validation result type
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * Validate and parse priority value (0-4 range)
 *
 * Priority levels:
 * - 0: None
 * - 1: Urgent
 * - 2: High
 * - 3: Normal
 * - 4: Low
 *
 * @param value - Priority as string or number
 * @returns Validation result with parsed priority or error message
 *
 * @example
 * ```typescript
 * const result = validatePriority("2");
 * if (result.valid) {
 *   console.log(`Priority: ${result.value}`); // Priority: 2
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validatePriority(value: string | number): ValidationResult<number> {
  const priority = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(priority)) {
    return {
      valid: false,
      error: 'Invalid priority value. Priority must be a number between 0 and 4:\n' +
             '  0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low'
    };
  }

  if (priority < 0 || priority > 4) {
    return {
      valid: false,
      error: 'Invalid priority value. Priority must be a number between 0 and 4:\n' +
             '  0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low'
    };
  }

  return {
    valid: true,
    value: priority
  };
}

/**
 * Validate and normalize hex color code
 *
 * Accepts colors with or without # prefix. Normalizes to include # prefix.
 * Validates 6-character hex codes only (no short codes like #FFF).
 *
 * @param value - Color as hex string (with or without # prefix)
 * @returns Validation result with normalized color or error message
 *
 * @example
 * ```typescript
 * const result1 = validateAndNormalizeColor("#FF6B6B");
 * console.log(result1.value); // "#FF6B6B"
 *
 * const result2 = validateAndNormalizeColor("FF6B6B");
 * console.log(result2.value); // "#FF6B6B" (normalized with #)
 *
 * const result3 = validateAndNormalizeColor("ZZZZZZ");
 * console.log(result3.error); // "Invalid color format..."
 * ```
 */
export function validateAndNormalizeColor(value: string): ValidationResult<string> {
  // Remove # prefix if present
  const cleanValue = value.startsWith('#') ? value.slice(1) : value;

  // Validate hex format (6 characters, A-F and 0-9 only)
  const hexRegex = /^[0-9A-Fa-f]{6}$/;

  if (!hexRegex.test(cleanValue)) {
    return {
      valid: false,
      error: `Invalid color format: ${value}\n` +
             'Color must be a valid 6-character hex code (e.g., #5E6AD2 or 5E6AD2)'
    };
  }

  // Normalize with # prefix
  return {
    valid: true,
    value: `#${cleanValue.toUpperCase()}`
  };
}

/**
 * Validate that a value is one of the allowed enum values
 *
 * Generic validator for enum-like string values. Case-sensitive by default.
 *
 * @param value - Value to validate
 * @param allowedValues - Array of allowed values
 * @param fieldName - Optional field name for error message
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateEnumValue(
 *   "quarter",
 *   ["month", "quarter", "halfYear", "year"],
 *   "date resolution"
 * );
 *
 * if (result.valid) {
 *   console.log("Valid date resolution");
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateEnumValue(
  value: string,
  allowedValues: string[],
  fieldName?: string
): ValidationResult<string> {
  if (!allowedValues.includes(value)) {
    const field = fieldName || 'value';
    return {
      valid: false,
      error: `Invalid ${field}: ${value}\n` +
             `Must be one of: ${allowedValues.join(', ')}`
    };
  }

  return {
    valid: true,
    value
  };
}

/**
 * Validate ISO 8601 date format (YYYY-MM-DD)
 *
 * Validates that a string matches the ISO 8601 date format and represents a valid date.
 *
 * @param value - Date string in YYYY-MM-DD format
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result1 = validateISODate("2025-01-15");
 * console.log(result1.valid); // true
 *
 * const result2 = validateISODate("01/15/2025");
 * console.log(result2.error); // "Invalid date format..."
 * ```
 */
export function validateISODate(value: string): ValidationResult<string> {
  // Check format: YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!isoDateRegex.test(value)) {
    return {
      valid: false,
      error: `Invalid date format: ${value}\n` +
             'Date must be in ISO 8601 format: YYYY-MM-DD (e.g., 2025-01-15)'
    };
  }

  // Validate it's a real date using UTC to avoid timezone rollover issues
  // (new Date("2025-01-15") in UTC-negative timezones rolls back a day)
  const parts = value.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return {
      valid: false,
      error: `Invalid date: ${value}\n` +
             'Date must be a valid calendar date'
    };
  }

  return {
    valid: true,
    value
  };
}

/**
 * Validate that a string is non-empty after trimming
 *
 * @param value - String to validate
 * @param fieldName - Optional field name for error message
 * @returns Validation result with trimmed value or error message
 *
 * @example
 * ```typescript
 * const result = validateNonEmpty("  Hello  ", "name");
 * console.log(result.value); // "Hello" (trimmed)
 *
 * const result2 = validateNonEmpty("   ", "name");
 * console.log(result2.error); // "name cannot be empty"
 * ```
 */
export function validateNonEmpty(value: string, fieldName?: string): ValidationResult<string> {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    const field = fieldName || 'Value';
    return {
      valid: false,
      error: `${field} cannot be empty`
    };
  }

  return {
    valid: true,
    value: trimmed
  };
}

/**
 * @deprecated Icon validation removed - Linear validates icons server-side.
 *
 * Investigation revealed that Linear's GraphQL API does not expose an endpoint
 * to fetch the standard icon catalog. The `emojis` query only returns custom
 * organization emojis uploaded by users, not Linear's built-in icons.
 *
 * Icons like "Checklist", "Skull", "Tree", "Joystick", etc. are valid Linear icons
 * but were not in our hardcoded curated list (only 67 icons), causing validation
 * failures for known-valid icons.
 *
 * Solution: Pass icon values directly to Linear API for server-side validation.
 * This eliminates maintenance burden and ensures all valid Linear icons work.
 *
 * The curated icon list in src/lib/icons.ts remains available for discovery
 * and suggestions via the `icons list` command.
 */

/**
 * Format a standardized "entity not found" error message
 *
 * Creates consistent error messages across all commands with helpful tips.
 *
 * @param entityType - Type of entity (e.g., "team", "project", "workflow state")
 * @param input - The user's input that wasn't found
 * @param listCommand - Command to list available entities (e.g., "teams list")
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * const error = formatEntityNotFoundError("team", "backend", "teams list");
 * console.error(error);
 * // Output:
 * // ❌ Team not found: "backend"
 * //    Tip: Use "agent2linear teams list" to see available teams
 * ```
 */
export function formatEntityNotFoundError(
  entityType: string,
  input: string,
  listCommand: string
): string {
  // Capitalize first letter of entity type
  const capitalizedEntity = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return `❌ ${capitalizedEntity} not found: "${input}"\n` +
         `   Tip: Use "agent2linear ${listCommand}" to see available ${entityType}s`;
}
