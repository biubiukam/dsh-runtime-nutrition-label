import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/invariant.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
})
