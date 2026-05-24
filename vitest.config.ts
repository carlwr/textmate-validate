import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/cfg/worker-setup.ts'],
    reporters: ['verbose'],
    silent: false,
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'threads',
  },
})
