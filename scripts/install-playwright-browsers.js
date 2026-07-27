const path = require("node:path");
const { spawn } = require("node:child_process");
const {buildBrowserInstallCommand} = require("./playwright-browser-installer");

const browsersPath = path.resolve(__dirname, "..", ".playwright-browsers");
const {command, args} = buildBrowserInstallCommand({
  platform: process.platform,
  nodePath: process.execPath,
  resolvePlaywrightCli: () => require.resolve("playwright/cli"),
});

const child = spawn(command, args, {
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
