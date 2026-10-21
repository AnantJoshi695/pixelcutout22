import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  use: { viewport: { width: 1440, height: 900 } },
});
