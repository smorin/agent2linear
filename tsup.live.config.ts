import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'tests/scripts/test-label-lifecycle-live.ts',
    'tests/scripts/test-comments-live.ts',
    'tests/scripts/test-m36-issue-automation-live.ts',
  ],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true,
  outDir: '.tmp/m36-live',
});
