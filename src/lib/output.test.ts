import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureDiagnostics, resetDiagnostics } from './logger.js';
import {
  setNoColor,
  showError,
  showInfo,
  showResolvedAlias,
  showSuccess,
  showValidated,
  showValidating,
  showWarning,
  silenceStdoutWhile,
} from './output.js';

afterEach(() => {
  resetDiagnostics();
  setNoColor(false);
  vi.restoreAllMocks();
});

describe('shared output stream discipline', () => {
  it('[RLS-OUT-JSON-CLEAN] suppresses legacy JSON progress until the one result is written', () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const restore = silenceStdoutWhile(true);
    console.log('resolving target');
    restore();
    console.log('{"ok":true}');

    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith('{"ok":true}');
  });

  it('[RLS-OUT-SHARED-DIAGNOSTICS] routes progress to stderr and results to stdout', () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    showResolvedAlias('backend', 'team_1');
    showValidating('team', 'team_1');
    showValidated('team', 'Backend');
    showInfo('Next step');
    showWarning('Review this');
    showError('Failed');
    showSuccess('Saved', { ID: 'team_1' });

    expect(stderr.mock.calls.flat().join('\n')).toContain('Resolved alias');
    expect(stderr.mock.calls.flat().join('\n')).toContain('Validating team');
    expect(stderr.mock.calls.flat().join('\n')).toContain('Team found');
    expect(stderr.mock.calls.flat().join('\n')).toContain('Next step');
    expect(stderr.mock.calls.flat().join('\n')).toContain('Review this');
    expect(stderr.mock.calls.flat().join('\n')).toContain('Failed');
    expect(stdout.mock.calls.flat().join('\n')).toContain('Saved');
    expect(stdout.mock.calls.flat().join('\n')).toContain('team_1');
  });

  it('[RLS-OUT-QUIET] suppresses progress but preserves warnings, errors, and results', () => {
    configureDiagnostics({ quiet: true });
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    showResolvedAlias('backend', 'team_1');
    showValidating('team', 'team_1');
    showValidated('team', 'Backend');
    showInfo('Next step');
    showWarning('Review this');
    showError('Failed');
    showSuccess('Saved');

    const diagnostics = stderr.mock.calls.flat().join('\n');
    expect(diagnostics).not.toContain('Resolved alias');
    expect(diagnostics).not.toContain('Validating team');
    expect(diagnostics).not.toContain('Team found');
    expect(diagnostics).not.toContain('Next step');
    expect(diagnostics).toContain('Review this');
    expect(diagnostics).toContain('Failed');
    expect(stdout.mock.calls.flat().join('\n')).toContain('Saved');
  });
});
