import { AuthError } from '../lib/cli-error.js';
import { getApiKey, maskApiKey } from '../lib/config.js';
import { getCurrentUser, getOrganization,testConnection } from '../lib/linear-client.js';
import { showError } from '../lib/output.js';
import { resolveActiveWorkspace } from '../lib/workspace-resolver.js';

/**
 * Display authenticated user identity and organization info
 */
export async function whoamiCommand() {
  try {
    const result = await testConnection();
    if (!result.success) {
      throw new AuthError(`Not authenticated: ${result.error ?? 'Linear API key is required'}`);
    }

    const user = await getCurrentUser();
    const org = await getOrganization();
    const apiKey = getApiKey() || '';
    const masked = maskApiKey(apiKey);
    const resolution = resolveActiveWorkspace();
    const activeName = resolution.name ?? (resolution.source === 'flag' ? '(ad-hoc)' : '(default)');

    console.log(`\nUser:         ${user.name}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Organization: ${org.name}`);
    console.log(`Workspace:    ${org.urlKey}`);
    console.log(`Active:       ${activeName} · source: ${resolution.source}`);
    console.log(`API Key:      ${masked}`);
    console.log();
  } catch (error) {
    if (error instanceof AuthError) throw error;
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
