/**
 * GraphQL and Linear API Error Handler (M15.1)
 * Provides user-friendly error messages for common Linear API errors
 */

/**
 * Extract HTTP status code from error object
 * Works with various error formats from Linear SDK
 */
function getStatusCode(error: unknown): number | null {
  const err = error as Record<string, unknown>;
  // Try common locations for status code
  if (typeof err.status === 'number') return err.status;
  const response = err.response as Record<string, unknown> | undefined;
  if (typeof response?.status === 'number') return response.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  const extensions = err.extensions as Record<string, unknown> | undefined;
  if (extensions?.code) {
    // GraphQL errors sometimes use extensions.code
    const code = extensions.code;
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
function getRetryAfter(error: unknown): string | null {
  const err = error as Record<string, unknown>;
  const response = err.response as Record<string, unknown> | undefined;
  const headers = response?.headers as Record<string, string> | undefined;
  if (headers?.['retry-after']) {
    return headers['retry-after'];
  }
  if (err.retryAfter) {
    return String(err.retryAfter);
  }
  return null;
}

/**
 * Extract Linear validation error message if available
 */
function getValidationMessage(error: unknown): string | null {
  const err = error as Record<string, unknown>;
  // Try common locations for validation messages
  if (typeof err.message === 'string') return err.message;
  const response = err.response as Record<string, unknown> | undefined;
  const data = response?.data as Record<string, unknown> | undefined;
  if (typeof data?.message === 'string') return data.message;
  const errors = data?.errors as Array<{ message?: string }> | undefined;
  if (typeof errors?.[0]?.message === 'string') {
    return errors[0].message;
  }
  const graphQLErrors = err.graphQLErrors as Array<{ message?: string }> | undefined;
  if (typeof graphQLErrors?.[0]?.message === 'string') {
    return graphQLErrors[0].message;
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
export function handleLinearError(error: unknown, context?: string): string {
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
        '  3. Set it using: agent2linear config set apiKey <your-key>'
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
        '  - Enable caching with: agent2linear config set enableEntityCache true'
      );
    }

    default: {
      // Try to extract validation error message from Linear
      const validationMessage = getValidationMessage(error);
      if (validationMessage) {
        return `❌ ${validationMessage}`;
      }

      // Generic error fallback
      const errObj = error as Record<string, unknown>;
      if (typeof errObj.message === 'string') {
        return `❌ Error: ${errObj.message}`;
      }

      return '❌ An unexpected error occurred while communicating with Linear';
    }
  }
}

/**
 * Check if an error is a Linear API error
 * Useful for determining if handleLinearError should be used
 */
export function isLinearError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  return (
    err.name === 'LinearClientError' ||
      (err.constructor as { name?: string } | undefined)?.name === 'LinearClientError' ||
      getStatusCode(error) !== null ||
      getValidationMessage(error) !== null
  );
}

/**
 * Format a Linear API error for logging/debugging
 * Includes more technical details than handleLinearError
 */
export function formatLinearErrorForLogging(error: unknown): string {
  const parts: string[] = ['Linear API Error:'];

  const statusCode = getStatusCode(error);
  if (statusCode) {
    parts.push(`  Status: ${statusCode}`);
  }

  const message = getValidationMessage(error);
  if (message) {
    parts.push(`  Message: ${message}`);
  }

  const errObj = error as Record<string, unknown>;
  if (typeof errObj.stack === 'string') {
    parts.push(`  Stack: ${errObj.stack}`);
  }

  return parts.join('\n');
}
