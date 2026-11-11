import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const localChrome = process.env.PW_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/artifacts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: localChrome,
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tools/serve.mjs',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
})
