import { defineConfig } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  use: {
    baseURL: isCI ? 'http://localhost:3001' : 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: isCI
    ? [
        {
          command: 'node server/index.js',
          port: 3001,
          reuseExistingServer: false,
          timeout: 60_000,
          env: { NODE_ENV: 'test', PORT: '3001' },
        },
      ]
    : [
        {
          command: 'node server/index.js',
          port: 3001,
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: 'npm run dev:web',
          port: 5174,
          reuseExistingServer: true,
          timeout: 30_000,
        },
      ],
})
