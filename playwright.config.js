import { defineConfig } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const useExternalServer = process.env.CURSORDANCE_SMOKE_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./smoke",
  testIgnore: ["desktop/**"],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    headless: true,
    viewport: {
      width: 1440,
      height: 960,
    },
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
