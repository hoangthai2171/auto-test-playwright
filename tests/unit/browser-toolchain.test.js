"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createBrowserToolchain} = require("../../app/browser-toolchain");

test("reports a missing managed Chromium without exposing its executable path", async () => {
  const browserToolchain = createBrowserToolchain({
    fs: {
      async stat() {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    },
    resolveExecutablePath: () => "/user-data/browser-tools/chromium/chrome",
    version: "1.61.1",
  });

  assert.deepEqual(await browserToolchain.status(), {
    ok: true,
    state: "missing",
    component: {
      id: "playwright-chromium",
      label: "Playwright Chromium",
      version: "1.61.1",
      status: "missing",
    },
  });
});

test("resolves a verified managed Chromium only for main-process callers", async () => {
  const executablePath = "/user-data/browser-tools/chromium/chrome";
  const browserToolchain = createBrowserToolchain({
    fs: {async stat() { return {isFile: () => true}; }},
    resolveExecutablePath: () => executablePath,
    version: "1.61.1",
  });

  assert.deepEqual(await browserToolchain.status(), {
    ok: true,
    state: "ready",
    component: {
      id: "playwright-chromium",
      label: "Playwright Chromium",
      version: "1.61.1",
      status: "ready",
    },
  });
  assert.equal(await browserToolchain.resolve(), executablePath);
});
