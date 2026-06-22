import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceResolution } from './types.js';
import { printWorkspaceBanner, workspaceForJson } from './workspace-banner.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspaceForJson', () => {
  it('shapes { name, source } and preserves the raw source value', () => {
    const ws: WorkspaceResolution = { key: 'k', name: 'acme', source: 'auto-detect' };
    expect(workspaceForJson(ws)).toEqual({ name: 'acme', source: 'auto-detect' });
  });

  it('includes urlKey only when provided', () => {
    const ws: WorkspaceResolution = { key: 'k', name: 'acme', source: 'flag' };
    expect(workspaceForJson(ws, 'acme-co')).toEqual({
      name: 'acme',
      urlKey: 'acme-co',
      source: 'flag',
    });
  });

  it('maps a missing name to null', () => {
    const ws: WorkspaceResolution = { key: 'k', source: 'legacy' };
    expect(workspaceForJson(ws)).toEqual({ name: null, source: 'legacy' });
  });
});

describe('printWorkspaceBanner', () => {
  it('prints the workspace name + a human source label to stderr', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    printWorkspaceBanner({ key: 'k', name: 'acme', source: 'auto-detect' });
    expect(err).toHaveBeenCalledOnce();
    const line = err.mock.calls[0][0] as string;
    expect(line).toContain('acme');
    expect(line).toContain('git-remote auto-detect');
  });

  it('is a no-op when called with { verbose: false } (read-site contract)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    printWorkspaceBanner({ key: 'k', name: 'acme', source: 'project' }, { verbose: false });
    expect(err).not.toHaveBeenCalled();
  });
});
