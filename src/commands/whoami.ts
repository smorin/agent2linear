import { testConnection, getCurrentUser, getOrganization } from '../lib/linear-client.js';
import { getApiKey, maskApiKey } from '../lib/config.js';
import { showError } from '../lib/output.js';

/**
 * Display authenticated user identity and organization info
 */
export async function whoamiCommand() {
  try {
    const result = await testConnection();
    if (!result.success) {
      showError('Not authenticated', result.error);
      process.exit(1);
    }

    const user = await getCurrentUser();
    const org = await getOrganization();
    const apiKey = getApiKey() || '';
    const masked = maskApiKey(apiKey);

    console.log(`\nUser:         ${user.name}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Organization: ${org.name}`);
    console.log(`Workspace:    ${org.urlKey}`);
    console.log(`API Key:      ${masked}`);
    console.log();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
