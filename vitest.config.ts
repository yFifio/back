import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    exclude: ['dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/controllers/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/index.ts',
        'src/config/**',
        'src/models/**',
        'src/routes/**',
        'src/types/**',
        'src/test/**',
      ],
    },
  },
});
