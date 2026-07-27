import { configDefaults, defineConfig } from 'vitest/config';

const GIT_INTEGRATION_GLOB = '**/*.git-integration.test.ts';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts',
        'src/cli.ts',
      ],
      all: true,
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [...configDefaults.exclude, GIT_INTEGRATION_GLOB],
          fileParallelism: true,
          testTimeout: 5_000,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'git-integration',
          include: [GIT_INTEGRATION_GLOB],
          fileParallelism: false,
          testTimeout: 15_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
