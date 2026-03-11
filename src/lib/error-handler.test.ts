import { describe, it, expect } from 'vitest';
import { handleLinearError, isLinearError, formatLinearErrorForLogging } from './error-handler.js';

describe('handleLinearError', () => {
  it('handles 401 authentication errors', () => {
    const error = { status: 401 };
    const message = handleLinearError(error);
    expect(message).toContain('Authentication failed');
    expect(message).toContain('linear.app/settings/api');
  });

  it('handles 403 permission errors', () => {
    const error = { status: 403 };
    const message = handleLinearError(error, 'project');
    expect(message).toContain('Permission denied');
    expect(message).toContain('project');
  });

  it('handles 404 not found errors', () => {
    const error = { status: 404 };
    const message = handleLinearError(error, 'issue');
    expect(message).toContain('not found');
    expect(message).toContain('issue');
  });

  it('handles 429 rate limiting', () => {
    const error = { status: 429, response: { headers: { 'retry-after': '30' } } };
    const message = handleLinearError(error);
    expect(message).toContain('Rate limited');
    expect(message).toContain('30');
  });

  it('handles 429 without retry-after header', () => {
    const error = { status: 429 };
    const message = handleLinearError(error);
    expect(message).toContain('Rate limited');
    expect(message).toContain('60'); // default
  });

  it('extracts GraphQL extension codes', () => {
    const error = { extensions: { code: 'UNAUTHENTICATED' } };
    const message = handleLinearError(error);
    expect(message).toContain('Authentication failed');
  });

  it('extracts validation messages from error.message', () => {
    const error = { message: 'Title is required' };
    const message = handleLinearError(error);
    expect(message).toContain('Title is required');
  });

  it('extracts nested GraphQL error messages', () => {
    const error = { graphQLErrors: [{ message: 'Invalid input' }] };
    const message = handleLinearError(error);
    expect(message).toContain('Invalid input');
  });

  it('provides generic message for unknown errors', () => {
    const error = {};
    const message = handleLinearError(error);
    expect(message).toContain('unexpected error');
  });

  it('extracts status from response.status', () => {
    const error = { response: { status: 401 } };
    const message = handleLinearError(error);
    expect(message).toContain('Authentication failed');
  });

  it('extracts status from statusCode', () => {
    const error = { statusCode: 404 };
    const message = handleLinearError(error);
    expect(message).toContain('not found');
  });
});

describe('isLinearError', () => {
  it('identifies errors with status codes', () => {
    expect(isLinearError({ status: 401 })).toBe(true);
  });

  it('identifies errors with validation messages', () => {
    expect(isLinearError({ message: 'some error' })).toBe(true);
  });

  it('identifies LinearClientError by name', () => {
    expect(isLinearError({ name: 'LinearClientError' })).toBe(true);
  });

  it('rejects plain objects without error markers', () => {
    expect(isLinearError({ foo: 'bar' })).toBe(false);
  });
});

describe('formatLinearErrorForLogging', () => {
  it('includes status code when available', () => {
    const result = formatLinearErrorForLogging({ status: 401 });
    expect(result).toContain('Status: 401');
  });

  it('includes message when available', () => {
    const result = formatLinearErrorForLogging({ message: 'test error' });
    expect(result).toContain('Message: test error');
  });

  it('includes stack when available', () => {
    const error = new Error('test');
    const result = formatLinearErrorForLogging(error);
    expect(result).toContain('Stack:');
  });
});
