const test = require("node:test");
const assert = require("node:assert/strict");
const packageJson = require("../../package.json");

test("Electron packaging includes the local test case fixture", () => {
  assert.ok(packageJson.build.files.includes("testcased.json"));
});
