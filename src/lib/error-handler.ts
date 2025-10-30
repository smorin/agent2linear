/**
 * GraphQL and Linear API Error Handler (M15.1)
 * Provides user-friendly error messages for common Linear API errors
 */

/**
 * Extract HTTP status code from error object
 * Works with various error formats from Linear SDK
 */
function getStatusCode(error: any): number | null {
  // Try common locations for status code
  if (error.status) return error.status;
  if (error.response?.status) return error.response.status;
  if (error.statusCode) return error.statusCode;
  if (error.extensions?.code) {
    // GraphQL errors sometimes use extensions.code
    const code = error.extensions.code;
    if (code === 'UNAUTHENTICATED') return 401;
    if (code === 'FORBIDDEN') return 403;
    if (code === 'NOT_FOUND') return 404;
    if (code === 'RATE_LIMITED') return 429;
  }
  return null;
}

/**
 * Extract retry-after header value for rate limiting
 */
function getRetryAfter(error: any): string | null {
  if (error.response?.headers?.['retry-after']) {
    return error.response.headers['retry-after'];
  }
  if (error.retryAfter) {
    return error.retryAfter.toString();
  }
  return null;
}

/**
 * Extract Linear validation error message if available
 */
function getValidationMessage(error: any): string | null {
  // Try common locations for validation messages
  if (error.message) return error.message;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.errors?.[0]?.message) {
    return error.response.data.errors[0].message;
  }
  if (error.graphQLErrors?.[0]?.message) {
    return error.graphQLErrors[0].message;
  }
  return null;
}

/**
 * Handle Linear API errors and return user-friendly error messages
 *
 * Handles common HTTP error codes and Linear-specific errors:
 * - 401: Authentication failed
 * - 403: Permission denied
 * - 404: Resource not found
 * - 429: Rate limited
 * - Validation errors: Extract and display Linear's error message
 *
 * @param error - Error object from Linear API or GraphQL
 * @param context - Optional context about what operation failed (e.g., "issue", "project")
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * try {
 *   await createIssue(input);
 * } catch (error) {
 *   const message = handleLinearError(error, 'issue');
 *   console.error(message);
 * }
 * ```
 */
export function handleLinearError(error: any, context?: string): string {
  const statusCode = getStatusCode(error);
  const entityContext = context ? ` ${context}` : ' resource';

  // Handle specific HTTP status codes
  switch (statusCode) {
    case 401:
      return (
        '❌ Authentication failed\n\n' +
        'Your Linear API key is invalid or has expired.\n' +
        'Please check your LINEAR_API_KEY environment variable or config file.\n\n' +
        'To get a new API key:\n' +
        '  1. Go to https://linear.app/settings/api\n' +
        '  2. Create a new personal API key\n' +
        '  3. Set it using: linear-create config set apiKey <your-key>'
      );

    case 403:
      return (
        '❌ Permission denied\n\n' +
        `You don't have permission to access this${entityContext}.\n` +
        'This may be because:\n' +
        '  - The resource doesn\'t exist\n' +
        '  - The resource is in a workspace you don\'t have access to\n' +
        '  - Your API key doesn\'t have the required permissions'
      );

    case 404:
      return (
        '❌ Resource not found\n\n' +
        `The${entityContext} you're looking for doesn't exist.\n` +
        'Please check:\n' +
        '  - The ID or identifier is correct\n' +
        '  - You have access to the workspace\n' +
        "  - The resource hasn't been deleted"
      );

    case 429: {
      const retryAfter = getRetryAfter(error);
      const waitTime = retryAfter || '60';
      return (
        '❌ Rate limited\n\n' +
        "You've made too many requests to the Linear API.\n" +
        `Please wait ${waitTime} seconds and try again.\n\n` +
        'To avoid rate limiting:\n' +
        '  - Reduce the frequency of your requests\n' +
        '  - Use batch operations when possible\n' +
        '  - Enable caching with: linear-create config set enableEntityCache true'
      );
    }

    default: {
      // Try to extract validation error message from Linear
      const validationMessage = getValidationMessage(error);
      if (validationMessage) {
        return `❌ ${validationMessage}`;
      }

      // Generic error fallback
      if (error.message) {
        return `❌ Error: ${error.message}`;
      }

      return '❌ An unexpected error occurred while communicating with Linear';
    }
  }
}

/**
 * Check if an error is a Linear API error
 * Useful for determining if handleLinearError should be used
 */
export function isLinearError(error: any): boolean {
  return (
    error &&
    (error.name === 'LinearClientError' ||
      error.constructor?.name === 'LinearClientError' ||
      getStatusCode(error) !== null ||
      getValidationMessage(error) !== null)
  );
}

/**
 * Format a Linear API error for logging/debugging
 * Includes more technical details than handleLinearError
 */
export function formatLinearErrorForLogging(error: any): string {
  const parts: string[] = ['Linear API Error:'];

  const statusCode = getStatusCode(error);
  if (statusCode) {
    parts.push(`  Status: ${statusCode}`);
  }

  const message = getValidationMessage(error);
  if (message) {
    parts.push(`  Message: ${message}`);
  }

  if (error.stack) {
    parts.push(`  Stack: ${error.stack}`);
  }

  return parts.join('\n');
}
