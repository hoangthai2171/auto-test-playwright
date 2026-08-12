const { defineConfig, devices } = require("playwright/test");
const {resolveTestViewport} = require("./app/test-configuration");

const TEST_VIEWPORT = resolveTestViewport(process.env.MYTV_TEST_RESOLUTION);
const VIEWPORT = {width: TEST_VIEWPORT.width, height: TEST_VIEWPORT.height};
const WINDOW_SIZE = VIEWPORT;

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
    viewport: VIEWPORT,
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
        viewport: VIEWPORT,
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
