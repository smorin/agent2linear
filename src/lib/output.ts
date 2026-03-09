/**
 * Shared output utilities for consistent message formatting across commands
 *
 * This module provides reusable functions for displaying success messages,
 * errors, info, and other common output patterns to ensure consistency
 * and reduce code duplication.
 */

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Display alias resolution message
 * @param alias - The alias name that was used
 * @param id - The resolved ID
 *
 * @example
 * showResolvedAlias('backend', 'init_abc123')
 * // Output: 📎 Resolved alias "backend" to init_abc123
 */
export function showResolvedAlias(alias: string, id: string): void {
  console.log(`📎 Resolved alias "${alias}" to ${id}`);
}

/**
 * Display validation start message
 * @param entityType - Type of entity being validated (e.g., 'team', 'initiative')
 * @param id - The ID being validated
 *
 * @example
 * showValidating('team', 'team_abc123')
 * // Output: 🔍 Validating team ID: team_abc123...
 */
export function showValidating(entityType: string, id: string): void {
  console.log(`🔍 Validating ${entityType} ID: ${id}...`);
}

/**
 * Display validation success message
 * @param entityType - Type of entity that was validated
 * @param name - Name of the validated entity
 *
 * @example
 * showValidated('team', 'Engineering')
 * // Output:    ✓ Team found: Engineering
 */
export function showValidated(entityType: string, name: string): void {
  console.log(`   ✓ ${capitalize(entityType)} found: ${name}`);
}

/**
 * Display a success message with optional details
 * @param message - Main success message
 * @param details - Optional key-value pairs to display as details
 *
 * @example
 * showSuccess('Default team set', {
 *   'Team': 'Engineering',
 *   'Saved to': 'global config',
 *   'ID': 'team_abc123'
 * })
 * // Output:
 * // ✅ Default team set
 * //    Team: Engineering
 * //    Saved to: global config
 * //    ID: team_abc123
 */
export function showSuccess(message: string, details?: Record<string, string>): void {
  console.log(`\n✅ ${message}`);
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.log(`   ${key}: ${value}`);
    }
  }
  console.log();
}

/**
 * Display an error message with optional hint
 * @param message - Error message (without ❌ prefix)
 * @param hint - Optional hint or suggestion for resolving the error
 *
 * @example
 * showError('Team not found', 'Use "agent2linear teams list" to see available teams')
 * // Output:
 * // ❌ Team not found
 * //    Use "agent2linear teams list" to see available teams
 */
export function showError(message: string, hint?: string): void {
  console.error(`❌ ${message}`);
  if (hint) {
    console.error(`   ${hint}`);
  }
}

/**
 * Display an informational tip or hint
 * @param message - Info message (without 💡 prefix)
 *
 * @example
 * showInfo('Use "agent2linear config show" to view your configuration')
 * // Output:
 * // 💡 Use "agent2linear config show" to view your configuration
 */
export function showInfo(message: string): void {
  console.log(`\n💡 ${message}\n`);
}

/**
 * Display a warning message
 * @param message - Warning message (without ⚠️ prefix)
 *
 * @example
 * showWarning('This command is deprecated')
 * // Output: ⚠️ This command is deprecated
 */
export function showWarning(message: string): void {
  console.log(`⚠️  ${message}`);
}

/**
 * Display entity details in a consistent format
 * @param type - Type of entity (e.g., 'Project', 'Initiative')
 * @param entity - Entity object with properties to display
 * @param fields - Array of field names to display from the entity
 *
 * @example
 * showEntityDetails('Team', team, ['id', 'name', 'key'])
 * // Output:
 * // 📋 Team: Engineering
 * //    ID: team_abc123
 * //    Name: Engineering
 * //    Key: ENG
 */
export function showEntityDetails(
  type: string,
  entity: Record<string, unknown>,
  fields: string[]
): void {
  console.log(`📋 ${type}: ${entity.name || entity.title || entity.id}`);
  for (const field of fields) {
    if (entity[field] !== undefined && entity[field] !== null) {
      const label = capitalize(field);
      console.log(`   ${label}: ${entity[field]}`);
    }
  }
}

/**
 * Display entity not found error
 * @param type - Type of entity that wasn't found
 * @param id - ID that was searched for
 *
 * @example
 * showEntityNotFound('team', 'team_invalid')
 * // Output: ❌ Error: Team with ID "team_invalid" not found
 */
export function showEntityNotFound(type: string, id: string): void {
  console.error(`❌ Error: ${capitalize(type)} with ID "${id}" not found`);
}

/**
 * Format a list of items as TSV (tab-separated values)
 * Outputs clean data with no headers - ideal for scripting
 *
 * @param items - Array of objects to format
 * @param fields - Array of field names to include in output (in order)
 * @returns TSV string with one row per item
 *
 * @example
 * formatListTSV([{id: 'team_123', name: 'Eng', key: 'ENG'}], ['id', 'name', 'key'])
 * // Output: "team_123\tEng\tENG"
 */
export function formatListTSV(items: Array<Record<string, unknown>>, fields: string[]): string {
  if (items.length === 0) {
    return '';
  }

  const rows = items.map(item => {
    const values = fields.map(field => {
      const value = item[field];
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      // Convert to string and escape tabs/newlines for TSV
      return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ');
    });
    return values.join('\t');
  });

  return rows.join('\n');
}

/**
 * Format a list of items as JSON array
 *
 * @param items - Array of objects to format
 * @returns JSON string (pretty-printed with 2-space indentation)
 *
 * @example
 * formatListJSON([{id: 'team_123', name: 'Engineering'}])
 * // Output: [\n  {\n    "id": "team_123",\n    "name": "Engineering"\n  }\n]
 */
export function formatListJSON(items: Array<Record<string, unknown>>): string {
  return JSON.stringify(items, null, 2);
}

/**
 * Format a text preview by stripping markdown, collapsing whitespace, and truncating.
 *
 * @param text - The text to preview (description, content, etc.)
 * @param maxLength - Maximum length before truncation (default: 80)
 * @returns Cleaned, truncated text or empty string if input is empty/null
 *
 * @example
 * formatContentPreview('# Hello\n\nThis is a **long** description...', 40)
 * // Output: "Hello This is a long description..."
 */
export function formatContentPreview(text: string | undefined | null, maxLength = 80): string {
  if (!text) return '';

  const cleaned = text
    .replace(/[#*_~`]/g, '')   // Remove markdown syntax
    .replace(/\n+/g, ' ')      // Replace newlines with spaces
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();

  if (cleaned.length <= maxLength) return cleaned;

  return cleaned.substring(0, maxLength - 3) + '...';
}
