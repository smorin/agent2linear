import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMilestoneTemplate, getGlobalTemplatesPath } from './milestone-templates.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-tmpl-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('milestone-templates.ts global path honors XDG', () => {
  it('writes global templates under $XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    const expected = join(tmp, 'agent2linear', 'milestone-templates.json');
    // Assert the resolved path BEFORE any write. At RED (pre-migration) this
    // assertion fails and aborts the test before createMilestoneTemplate() could
    // write to the user's real ~/.config/agent2linear/milestone-templates.json
    // (the unmigrated global path is an absolute module-level constant).
    expect(getGlobalTemplatesPath()).toBe(expected);
    const res = createMilestoneTemplate(
      'std',
      { name: 'std', milestones: [{ name: 'M1' }] },
      'global'
    );
    expect(res.success).toBe(true);
    expect(existsSync(expected)).toBe(true);
  });
});
