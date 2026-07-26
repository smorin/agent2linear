import { describe, expect, it, vi } from 'vitest';

import { RuntimeError, UsageError } from '../../lib/cli-error.js';
import { readCommentBody } from './input.js';

function deps(overrides: Record<string, unknown> = {}) {
  return {
    stdinIsTTY: true,
    readFile: vi.fn(async () => 'file body'),
    readStdin: vi.fn(async () => 'stdin body'),
    ...overrides,
  };
}

describe('readCommentBody', () => {
  it('CMT-INP-INLINE preserves exact nonempty inline Markdown', async () => {
    const d = deps();
    await expect(readCommentBody({ body: '  **hello**\n' }, d)).resolves.toBe('  **hello**\n');
    expect(d.readFile).not.toHaveBeenCalled();
    expect(d.readStdin).not.toHaveBeenCalled();
  });

  it('CMT-RULE-IA-BODY-XOR rejects body plus body-file before IO', async () => {
    const d = deps();
    await expect(readCommentBody({ body: 'a', bodyFile: 'b.md' }, d)).rejects.toBeInstanceOf(
      UsageError
    );
    expect(d.readFile).not.toHaveBeenCalled();
  });

  it('CMT-INP-FILE reads a UTF-8 path', async () => {
    const d = deps({ readFile: vi.fn(async (path: string) => path === 'note.md' ? 'from file' : '') });
    await expect(readCommentBody({ bodyFile: 'note.md' }, d)).resolves.toBe('from file');
  });

  it('CMT-INP-STDIN-EXPLICIT reads --body-file - to EOF', async () => {
    const d = deps({ readStdin: vi.fn(async () => 'explicit stdin') });
    await expect(readCommentBody({ bodyFile: '-' }, d)).resolves.toBe('explicit stdin');
    expect(d.readFile).not.toHaveBeenCalled();
  });

  it('CMT-INP-STDIN-IMPLICIT reads non-TTY stdin without an explicit source', async () => {
    const d = deps({ stdinIsTTY: false, readStdin: vi.fn(async () => 'implicit stdin') });
    await expect(readCommentBody({}, d)).resolves.toBe('implicit stdin');
  });

  it('CMT-INP-STDIN-PRECEDENCE does not consume incidental stdin for explicit body or file', async () => {
    const inline = deps({ stdinIsTTY: false });
    await readCommentBody({ body: 'inline' }, inline);
    expect(inline.readStdin).not.toHaveBeenCalled();

    const file = deps({ stdinIsTTY: false });
    await readCommentBody({ bodyFile: 'note.md' }, file);
    expect(file.readStdin).not.toHaveBeenCalled();
  });

  it('CMT-INP-STDIN-APIKEY-CONFLICT rejects either stdin body when stdin supplies the API key', async () => {
    const d = deps({ stdinIsTTY: false });
    await expect(
      readCommentBody({ bodyFile: '-', stdinReservedForApiKey: true }, d)
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(readCommentBody({ stdinReservedForApiKey: true }, d)).rejects.toMatchObject({
      exitCode: 2,
    });
  });

  it('CMT-INP-TTY-MISSING gives all supported source choices', async () => {
    await expect(readCommentBody({}, deps())).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('--body-file'),
    });
  });

  it.each([
    [{ body: '   \n' }, 'CMT-INP-EMPTY-INLINE'],
    [{ bodyFile: 'blank.md' }, 'CMT-INP-EMPTY-FILE'],
    [{ bodyFile: '-' }, 'CMT-INP-EMPTY-STDIN'],
  ])('%s rejects blank content (%s)', async (options, _id) => {
    const d = deps({
      readFile: vi.fn(async () => ' \n'),
      readStdin: vi.fn(async () => '\t'),
    });
    await expect(readCommentBody(options, d)).rejects.toMatchObject({ exitCode: 2 });
  });

  it('CMT-INP-FILE-NOTFOUND maps missing paths to runtime input failure', async () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
    const d = deps({ readFile: vi.fn(async () => { throw error; }) });
    await expect(readCommentBody({ bodyFile: 'gone.md' }, d)).rejects.toBeInstanceOf(RuntimeError);
    await expect(readCommentBody({ bodyFile: 'gone.md' }, d)).rejects.toMatchObject({
      exitCode: 1,
      message: expect.stringContaining('gone.md'),
    });
  });

  it('CMT-INP-FILE-UNREADABLE distinguishes directories and permission failures', async () => {
    for (const code of ['EACCES', 'EISDIR']) {
      const error = Object.assign(new Error(code), { code });
      await expect(
        readCommentBody({ bodyFile: 'bad.md' }, deps({
          readFile: vi.fn(async () => { throw error; }),
        }))
      ).rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining('bad.md') });
    }
  });
});
