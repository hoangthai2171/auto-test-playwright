const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../../package.json");

test("Electron packaging includes the local test case fixture", () => {
  assert.ok(packageJson.build.files.includes("testcased.json"));
});

test("Electron packaging includes the Playwright tsconfig isolation file under app", () => {
  assert.ok(packageJson.build.files.includes("app/**/*"));
  assert.ok(fs.existsSync(path.join(__dirname, "../../app/playwright.tsconfig.json")));
});
