const test = require("node:test");
const assert = require("node:assert/strict");

const {buildPlaywrightTestArgs} = require("../../app/playwright-runner");

test("uses the bundled tsconfig before loading the Playwright configuration", () => {
  const args = buildPlaywrightTestArgs({
    playwrightCli: "C:\\app\\node_modules\\playwright\\cli.js",
    testResultsDir: "C:\\Users\\Admin\\AppData\\Roaming\\MyTV\\test-results",
    tsconfigPath: "C:\\app\\app\\playwright.tsconfig.json",
  });

  assert.deepEqual(args, [
    "C:\\app\\node_modules\\playwright\\cli.js",
    "test",
    "tests/run-test-case-mytv.spec.js",
    "--project=chromium",
    "--output",
    "C:\\Users\\Admin\\AppData\\Roaming\\MyTV\\test-results",
    "--tsconfig",
    "C:\\app\\app\\playwright.tsconfig.json",
  ]);
});
