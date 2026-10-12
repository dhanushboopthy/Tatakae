import { defineConfig, devices } from "@playwright/test";

// Web smoke test (v4): `pnpm --filter web e2e`. Needs @playwright/test and a browser
// (`pnpm --filter web exec playwright install chromium`). Starts the API in dev mode with auth
// bypass on a throwaway database, and the Vite dev server that proxies /api to it.

const DB = process.env["E2E_DB"] ?? "./data/e2e.db";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts", // not *.spec/*.test, so vitest never collects it
  timeout: 30_000,
  retries: process.env["CI"] ? 1 : 0,
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter api dev",
      url: "http://localhost:8787/api/health",
      reuseExistingServer: !process.env["CI"],
      env: { NODE_ENV: "development", DEV_BYPASS_AUTH: "1", DATABASE_PATH: DB, PORT: "8787" },
    },
    {
      command: "pnpm --filter web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env["CI"],
    },
  ],
});
