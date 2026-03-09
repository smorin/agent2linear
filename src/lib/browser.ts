import { execFile } from 'child_process';
import { platform } from 'os';

/**
 * Open a URL in the default browser
 */
export function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platformName = platform();
    let cmd: string;
    let args: string[];

    // Determine the command based on the platform
    if (platformName === 'darwin') {
      cmd = 'open';
      args = [url];
    } else if (platformName === 'win32') {
      cmd = 'cmd';
      args = ['/c', 'start', '', url];
    } else {
      // Linux and other Unix-like systems
      cmd = 'xdg-open';
      args = [url];
    }

    execFile(cmd, args, (error) => {
      if (error) {
        reject(new Error(`Failed to open browser: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}
