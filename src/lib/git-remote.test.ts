import { describe, expect, it } from 'vitest';

import { normalizeRemoteOwner, parseRemoteOwner } from './git-remote.js';

describe('parseRemoteOwner - R1 edge-case table', () => {
  it('parses SCP-style SSH (git@github.com:acme/repo.git)', () => {
    expect(parseRemoteOwner('git@github.com:acme/repo.git')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('parses SSH without the .git suffix', () => {
    expect(parseRemoteOwner('git@github.com:acme/repo')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('parses ssh:// URL form', () => {
    expect(parseRemoteOwner('ssh://git@github.com/acme/repo.git')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('parses HTTPS URL', () => {
    expect(parseRemoteOwner('https://github.com/acme/repo.git')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('parses HTTPS URL with userinfo and no .git', () => {
    expect(parseRemoteOwner('https://user@github.com/acme/repo')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('parses HTTPS URL with a port', () => {
    expect(parseRemoteOwner('https://github.com:443/acme/repo.git')).toEqual({
      host: 'github.com',
      owner: 'acme',
    });
  });

  it('takes the top-level owner for nested groups (GitLab subgroups)', () => {
    expect(parseRemoteOwner('git@gitlab.com:group/sub/repo.git')).toEqual({
      host: 'gitlab.com',
      owner: 'group',
    });
  });

  it('parses non-GitHub hosts the same way', () => {
    expect(parseRemoteOwner('git@bitbucket.org:team/repo.git')).toEqual({
      host: 'bitbucket.org',
      owner: 'team',
    });
  });

  it('returns null for null / empty / unparseable input', () => {
    expect(parseRemoteOwner(null)).toBeNull();
    expect(parseRemoteOwner('')).toBeNull();
    expect(parseRemoteOwner('   ')).toBeNull();
    expect(parseRemoteOwner('not-a-remote-url')).toBeNull();
  });

  it('rejects URL/SCP input that has no owner/repo path (owner only)', () => {
    // host:owner with no repo, and host/owner with no repo — not a real remote.
    expect(parseRemoteOwner('git@github.com:acme')).toBeNull();
    expect(parseRemoteOwner('foo:bar')).toBeNull();
    expect(parseRemoteOwner('https://github.com/acme')).toBeNull();
  });
});

describe('normalizeRemoteOwner - accepts bare owner OR full URL', () => {
  it('passes a bare owner through unchanged', () => {
    expect(normalizeRemoteOwner('banksheets')).toBe('banksheets');
    expect(normalizeRemoteOwner('acme-co')).toBe('acme-co');
    expect(normalizeRemoteOwner('  acme.labs_1  ')).toBe('acme.labs_1');
  });

  it('extracts the owner from a full HTTPS repo URL', () => {
    expect(normalizeRemoteOwner('https://github.com/banksheets/get-bank-sheets-web.git')).toBe(
      'banksheets'
    );
  });

  it('extracts the owner from an SSH/scp repo URL', () => {
    expect(normalizeRemoteOwner('git@github.com:acme-co/repo.git')).toBe('acme-co');
  });

  it('rejects malformed input (URL-like with no owner, or path/host separators)', () => {
    expect(normalizeRemoteOwner('https://github.com')).toBeNull();
    expect(normalizeRemoteOwner('banksheets/repo')).toBeNull();
    expect(normalizeRemoteOwner('owner with spaces')).toBeNull();
    expect(normalizeRemoteOwner('')).toBeNull();
  });
});
