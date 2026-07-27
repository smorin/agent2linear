import { describe, expect, it } from 'vitest';

import { assertLiveOrganizationIdentity } from './live-identity.js';

const expected = {
  organizationName: 'ConceptM',
  organizationUrlKey: 'conceptm',
};

describe('assertLiveOrganizationIdentity', () => {
  it('accepts an environment-backed identity without a named active workspace', () => {
    const output = [
      'Organization: ConceptM',
      'Workspace:    conceptm',
      'Active:       (default) · source: env',
    ].join('\n');

    expect(assertLiveOrganizationIdentity(output, expected)).toEqual(expected);
  });

  it('ignores a misleading Active field and validates the remote identity', () => {
    const output = [
      'Organization: ConceptM',
      'Workspace:    conceptm',
      'Active:       Another Workspace · source: profile',
    ].join('\n');

    expect(assertLiveOrganizationIdentity(output, expected)).toEqual(expected);
  });

  it.each([
    ['Organization: Other\nWorkspace: conceptm', 'organization'],
    ['Organization: ConceptM-test\nWorkspace: conceptm', 'organization'],
    ['Organization: ConceptM\nWorkspace: other', 'workspace URL key'],
    ['Organization: ConceptM\nWorkspace: conceptm-old', 'workspace URL key'],
    ['Workspace: conceptm', 'Organization'],
    ['Organization: ConceptM', 'Workspace'],
    [
      'Organization: ConceptM\nOrganization: ConceptM\nWorkspace: conceptm',
      'duplicate Organization',
    ],
    [
      'Organization: ConceptM\nWorkspace: conceptm\nWorkspace: conceptm',
      'duplicate Workspace',
    ],
  ])('rejects an invalid or ambiguous remote identity: %s', (output, message) => {
    expect(() => assertLiveOrganizationIdentity(output, expected)).toThrow(message);
  });

  it('rejects correct Active text when the remote organization is wrong', () => {
    const output = [
      'Organization: Other',
      'Workspace:    conceptm',
      'Active:       ConceptM · source: profile',
    ].join('\n');

    expect(() => assertLiveOrganizationIdentity(output, expected)).toThrow(
      'organization'
    );
  });
});
