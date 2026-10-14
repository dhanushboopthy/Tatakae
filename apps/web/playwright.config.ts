import { defineConfig, devices } from "@playwright/test";

// Web smoke test (v4): `pnpm --filter web e2e`. Needs @playwright/test and a browser:
// `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers pnpm --filter web exec playwright install chromium`
// (the folder is gitignored, R3-1). Starts the API in dev mode with auth bypass on a throwaway
// database, and the Vite dev server that proxies /api to it. Both get their own ports and are never
// reused, so a dev server (or another project) already on 5173/8787 can't answer the test.

const DB = process.env["E2E_DB"] ?? "./data/e2e.db";
const API_PORT = process.env["E2E_API_PORT"] ?? "8797";
const WEB_PORT = process.env["E2E_WEB_PORT"] ?? "5297";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts", // not *.spec/*.test, so vitest never collects it
  timeout: 30_000,
  retries: process.env["CI"] ? 1 : 0,
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter api dev",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      // PUBLIC_ORIGIN = the e2e web origin, so passkeys (RP ID "localhost") verify against it.
      env: { NODE_ENV: "development", DEV_BYPASS_AUTH: "1", DATABASE_PATH: DB, PORT: API_PORT, PUBLIC_ORIGIN: `http://localhost:${WEB_PORT}` },
    },
    {
      command: `pnpm --filter web exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
