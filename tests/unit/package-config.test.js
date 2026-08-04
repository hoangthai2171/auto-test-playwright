const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../../package.json");

test("Electron packaging includes the local test case fixture", () => {
  assert.ok(packageJson.build.files.includes("testcased.json"));
});

test("Electron packaging includes the maintained device compatibility catalog", () => {
  assert.ok(packageJson.build.files.includes("DEVICE-COMPATIBILITY.json"));
});

test("Electron packaging includes the Playwright tsconfig isolation file under app", () => {
  assert.ok(packageJson.build.files.includes("app/**/*"));
  assert.ok(fs.existsSync(path.join(__dirname, "../../app/playwright.tsconfig.json")));
});

test("Electron packaging excludes the browser cache while Playwright stays pinned", () => {
  assert.equal(packageJson.dependencies.playwright, "1.61.1");
  assert.equal(packageJson.build.extraResources, undefined);
});

test("cross-platform packaging does not force the host-only Electron distribution", () => {
  assert.equal(packageJson.build.electronDist, undefined);
});

test("the LG compatibility maintainer command is available without becoming a packaged runtime dependency", () => {
  assert.equal(packageJson.scripts["tv:compatibility:lg"], "node scripts/real-tv-appium/lg-device-compatibility-check.js");
  assert.ok(!packageJson.build.files.includes("scripts/**/*"));
});
