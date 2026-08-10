import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5200',
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'firefox', use: {...devices['Desktop Firefox']}},
    {name: 'webkit', use: {...devices['Desktop Safari']}},
  ],
  webServer: [
    {
      command:
        'pnpm --filter demo build && pnpm --filter demo exec vite preview --port 5200 --strictPort',
      url: 'http://localhost:5200/selftest.html',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter ssr-smoke build && pnpm --filter ssr-smoke start',
      url: 'http://localhost:5202/',
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
})
