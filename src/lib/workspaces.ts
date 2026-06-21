import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { Scope } from './scope.js';
import type { Workspace } from './types.js';
import { findProjectConfigDir, projectConfigWriteDir, userConfigDir } from './xdg-paths.js';

const GLOBAL_WORKSPACES_FILENAME = 'workspaces.json';
const PROJECT_WORKSPACES_FILENAME = 'workspaces.local.json';
const SECRETS_FILE_MODE = 0o600;

function globalWorkspacesFile(): string {
  return join(userConfigDir(), GLOBAL_WORKSPACES_FILENAME);
}

/** Project secrets file for reading (walk-up discovery), or null if none exists. */
function projectWorkspacesReadFile(): string | null {
  const dir = findProjectConfigDir();
  return dir ? join(dir, PROJECT_WORKSPACES_FILENAME) : null;
}

/** Project secrets file for writing (discovered dir, else cwd/.agent2linear). */
function projectWorkspacesWriteFile(): string {
  return join(projectConfigWriteDir(), PROJECT_WORKSPACES_FILENAME);
}

type WorkspacesFile = Record<string, Workspace>;

/**
 * Read a workspaces registry file safely. Returns {} for missing/unparseable files.
 */
function readWorkspacesFile(path: string): WorkspacesFile {
  try {
    if (!existsSync(path)) {
      return {};
    }
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as WorkspacesFile;
  } catch {
    return {};
  }
}

/**
 * Write a workspaces registry file at mode 0600. chmod explicitly because the
 * `mode` option to writeFileSync only applies when the file is created.
 */
function writeWorkspacesFile(path: string, data: WorkspacesFile): void {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: SECRETS_FILE_MODE });
    chmodSync(path, SECRETS_FILE_MODE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to write workspaces file ${path}: ${msg}`);
  }
}

/**
 * Ensure a `.gitignore` next to the project secrets file ignores it. Idempotent:
 * never writes a duplicate entry.
 */
function refreshProjectGitignore(secretsPath: string): void {
  try {
    const dir = dirname(secretsPath);
    const gitignorePath = join(dir, '.gitignore');
    const entry = PROJECT_WORKSPACES_FILENAME;

    let lines: string[] = [];
    if (existsSync(gitignorePath)) {
      lines = readFileSync(gitignorePath, 'utf-8').split('\n');
    }

    const alreadyIgnored = lines.some((line) => line.trim() === entry);
    if (alreadyIgnored) {
      return;
    }

    const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
    const needsNewline = existing.length > 0 && !existing.endsWith('\n');
    const addition = `${needsNewline ? '\n' : ''}${entry}\n`;
    writeFileSync(gitignorePath, existing + addition, 'utf-8');
  } catch {
    // best-effort; a missing gitignore refresh must not block writing the secret
  }
}

/**
 * Load the secrets registry, merging the global workspaces.json with the optional
 * project workspaces.local.json (project overriding global), mirroring aliases.ts.
 */
export function loadWorkspaces(): Record<string, Workspace> {
  const globalWorkspaces = readWorkspacesFile(globalWorkspacesFile());
  const projectReadFile = projectWorkspacesReadFile();
  const projectWorkspaces = projectReadFile ? readWorkspacesFile(projectReadFile) : {};

  return {
    ...globalWorkspaces,
    ...projectWorkspaces,
  };
}

/**
 * Save a single workspace into the registry at the given scope. Writes are 0600;
 * a project-scope write refreshes the `.gitignore` for the local secrets file.
 */
export function saveWorkspace(scope: Scope, name: string, ws: Workspace): void {
  const filePath = scope === 'global' ? globalWorkspacesFile() : projectWorkspacesWriteFile();
  const existing = readWorkspacesFile(filePath);
  existing[name] = ws;
  writeWorkspacesFile(filePath, existing);

  if (scope === 'project') {
    refreshProjectGitignore(filePath);
  }
}

/**
 * Remove a workspace from the registry at the given scope.
 */
export function removeWorkspace(scope: Scope, name: string): boolean {
  const filePath = scope === 'global' ? globalWorkspacesFile() : projectWorkspacesWriteFile();
  const existing = readWorkspacesFile(filePath);
  if (!(name in existing)) {
    return false;
  }
  delete existing[name];
  writeWorkspacesFile(filePath, existing);
  return true;
}

/** Global workspaces secrets file path. */
export function getGlobalWorkspacesPath(): string {
  return globalWorkspacesFile();
}

/** Project workspaces secrets file path (discovered, else cwd-relative). */
export function getProjectWorkspacesPath(): string {
  return projectWorkspacesReadFile() ?? projectWorkspacesWriteFile();
}
