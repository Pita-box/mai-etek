import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "env -u FORCE_COLOR pnpm start --hostname 127.0.0.1 --port 3100",
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: `${baseURL}/login`,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
