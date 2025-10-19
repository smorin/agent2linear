import { exec } from 'child_process';
import { platform } from 'os';

/**
 * Open a URL in the default browser
 */
export function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platformName = platform();
    let command: string;

    // Determine the command based on the platform
    if (platformName === 'darwin') {
      command = `open "${url}"`;
    } else if (platformName === 'win32') {
      command = `start "${url}"`;
    } else {
      // Linux and other Unix-like systems
      command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        reject(new Error(`Failed to open browser: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}
