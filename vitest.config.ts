import { defineConfig } from 'vitest/config';

// One Vitest run for every workspace (NFR-MNT-02 thresholds).
export default defineConfig({
  test: {
    projects: ['packages/shared', 'backend', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      include: ['packages/shared/src/**', 'backend/src/**', 'apps/web/src/**'],
      exclude: [
        '**/*.test.*',
        '**/*.d.ts',
        'apps/web/src/main.tsx',
        'backend/src/gas/**',
        'backend/src/main.ts',
      ],
      thresholds: {
        lines: 80,
        'packages/shared/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
});
