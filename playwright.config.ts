import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/gallery/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'line',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'pnpm --filter @octa/gallery preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
