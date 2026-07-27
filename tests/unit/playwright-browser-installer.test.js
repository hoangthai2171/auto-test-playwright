const test = require("node:test");
const assert = require("node:assert/strict");

const {buildBrowserInstallCommand} = require("../../scripts/playwright-browser-installer");

test("uses cmd and npx on Windows without resolving playwright/cli", () => {
  let resolved = false;

  const command = buildBrowserInstallCommand({
    platform: "win32",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    resolvePlaywrightCli: () => {
      resolved = true;
      return "unused";
    },
  });

  assert.deepEqual(command, {
    command: "cmd.exe",
    args: ["/c", "npx", "playwright", "install", "chromium"],
  });
  assert.equal(resolved, false);
});

test("uses the direct Playwright CLI outside Windows", () => {
  const command = buildBrowserInstallCommand({
    platform: "darwin",
    nodePath: "/usr/local/bin/node",
    resolvePlaywrightCli: () => "/project/node_modules/playwright/cli.js",
  });

  assert.deepEqual(command, {
    command: "/usr/local/bin/node",
    args: ["/project/node_modules/playwright/cli.js", "install", "chromium"],
  });
});
