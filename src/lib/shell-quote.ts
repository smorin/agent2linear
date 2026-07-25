/**
 * Quote one argument for a POSIX-compatible shell.
 *
 * Always quoting keeps generated commands deterministic. Embedded single quotes
 * use the standard close-quote, quoted-quote, reopen sequence. NUL cannot be
 * represented in a process argv and is therefore rejected explicitly.
 */
export function quotePosixShellArg(value: string): string {
  if (value.includes('\0')) {
    throw new TypeError('POSIX shell arguments cannot contain NUL');
  }
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
