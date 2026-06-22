/**
 * Suppress ONLY the transitive `punycode` deprecation (DEP0040), which is emitted
 * by a dependency (not our code) and is noise for CLI users. All other process
 * warnings pass through unchanged.
 *
 * This must be imported before any dependency that pulls in `punycode`, so it is
 * the first import in src/index.ts.
 */

const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = function patchedEmitWarning(
  warning: string | Error,
  ...args: unknown[]
): void {
  const message = typeof warning === 'string' ? warning : warning.message;
  const stringCode = args.find((arg): arg is string => typeof arg === 'string');
  const optionsCode =
    typeof args[0] === 'object' && args[0] !== null
      ? (args[0] as { code?: string }).code
      : undefined;

  if (message.includes('punycode') || stringCode === 'DEP0040' || optionsCode === 'DEP0040') {
    return;
  }

  (originalEmitWarning as (w: string | Error, ...rest: unknown[]) => void)(warning, ...args);
} as typeof process.emitWarning;
