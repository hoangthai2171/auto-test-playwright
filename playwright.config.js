const { defineConfig, devices } = require("playwright/test");

const VIEWPORT = { width: 1920, height: 1080 };
const VIEWPORT_SCALE = 0.5;
const WINDOW_SIZE = {
  width: Math.round(VIEWPORT.width * VIEWPORT_SCALE),
  height: Math.round(VIEWPORT.height * VIEWPORT_SCALE),
};

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 240000,
  workers: 1,
  reporter: [
    ["line"],
    ["html", { open: "always" }],
  ],
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: "https://html5stage.mytv.vn/",
    viewport: WINDOW_SIZE,
    actionTimeout: 10000,
    navigationTimeout: 90000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            `--window-size=${WINDOW_SIZE.width},${WINDOW_SIZE.height}`,
            "--window-position=0,0",
          ],
        },
      },
    },
  ],
});
