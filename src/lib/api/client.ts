import { LinearClient as SDKClient } from '@linear/sdk';
import { getApiKey } from '../config.js';

export class LinearClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearClientError';
  }
}

/**
 * Cached singleton Linear client instance
 */
let cachedClient: SDKClient | null = null;

/**
 * Get authenticated Linear client (singleton - reuses same instance)
 */
export function getLinearClient(): SDKClient {
  if (cachedClient) return cachedClient;

  const apiKey = getApiKey();

  if (!apiKey) {
    throw new LinearClientError(
      'Linear API key not found. Please set LINEAR_API_KEY environment variable or configure it using the config file.'
    );
  }

  // Validate API key format (Linear API keys start with "lin_api_")
  if (!apiKey.startsWith('lin_api_')) {
    throw new LinearClientError(
      'Invalid Linear API key format. API keys should start with "lin_api_"'
    );
  }

  cachedClient = new SDKClient({ apiKey });
  return cachedClient;
}

/**
 * Get the current user's organization
 */
export async function getOrganization(): Promise<{
  id: string;
  name: string;
  urlKey: string;
}> {
  try {
    const client = getLinearClient();
    const org = await client.organization;
    return {
      id: org.id,
      name: org.name,
      urlKey: org.urlKey,
    };
  } catch (error) {
    throw new LinearClientError(
      `Failed to get organization: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Test the Linear API connection
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  user?: { name: string; email: string };
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      success: true,
      user: {
        name: viewer.name,
        email: viewer.email,
      },
    };
  } catch (error) {
    if (error instanceof LinearClientError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  try {
    const client = getLinearClient();
    const viewer = await client.viewer;

    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
    };
  } catch (error) {
    throw new LinearClientError(
      `Failed to get current user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate API key by testing connection
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new SDKClient({ apiKey });
    await client.viewer;
    return true;
  } catch {
    return false;
  }
}
