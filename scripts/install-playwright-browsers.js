const path = require("node:path");
const { spawn } = require("node:child_process");

const playwrightCli = require.resolve("playwright/cli");
const browsersPath = path.resolve(__dirname, "..", ".playwright-browsers");

const child = spawn(process.execPath, [playwrightCli, "install", "chromium"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
