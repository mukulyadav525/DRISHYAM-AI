const { defineConfig, devices } = require("@playwright/test");

const simulationBaseUrl = process.env.DRISHYAM_E2E_SIM_BASE || "http://127.0.0.1:4101";

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: simulationBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "chrome",
  },
});
