import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke/desktop",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});
