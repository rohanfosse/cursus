import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--experimental-require-module'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['server/**/*.js', 'src/renderer/src/**/*.{ts,vue}'],
      exclude: ['**/node_modules/**', '**/dist/**', 'server/public/**'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 50,
        lines: 60,
      },
    },
    projects: [
      {
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['tests/frontend/**/*.test.ts'],
        },
        resolve: {
          alias: { '@': resolve(__dirname, 'src/renderer/src') },
        },
      },
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/backend/**/*.test.js'],
          globals: true,
        },
      },
    ],
  },
})
