import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
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
