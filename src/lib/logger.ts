/**
 * Structured logging for agent2linear CLI
 *
 * All output goes to stderr (aligns with M26 stdout/stderr separation).
 * Levels: debug (verbose only), info (normal+), warn (always), error (always).
 */

type LogLevel = 'quiet' | 'normal' | 'verbose';

let currentLevel: LogLevel = 'normal';

/**
 * Set the global log level. Called by CLI based on --quiet/--verbose flags.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Get the current log level.
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

export const logger = {
  /**
   * Debug output - only shown with --verbose
   */
  debug(message: string, ...args: unknown[]): void {
    if (currentLevel === 'verbose') {
      console.error(`[debug] ${message}`, ...args);
    }
  },

  /**
   * Info output - shown in normal and verbose modes, suppressed with --quiet
   */
  info(message: string, ...args: unknown[]): void {
    if (currentLevel !== 'quiet') {
      console.error(message, ...args);
    }
  },

  /**
   * Warning output - always shown
   */
  warn(message: string, ...args: unknown[]): void {
    console.error(`⚠️  ${message}`, ...args);
  },

  /**
   * Error output - always shown
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`❌ ${message}`, ...args);
  },
};
