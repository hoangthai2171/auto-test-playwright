"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createBrowserRunLauncher} = require("../../app/browser-run-launcher");

test("blocks a browser run when managed Chromium is unavailable", async () => {
  const launcher = createBrowserRunLauncher({
    browserToolchain: {resolve: async () => { throw new Error("missing"); }},
    managedRoot: "/private-browser-cache",
  });

  assert.deepEqual(await launcher.prepare(), {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"});
});

test("returns only the managed browser-root contract when Chromium resolves", async () => {
  const launcher = createBrowserRunLauncher({
    browserToolchain: {resolve: async () => "/private-browser-cache/chromium"},
    managedRoot: "/private-browser-cache",
  });

  assert.deepEqual(await launcher.prepare(), {ok: true, browsersPath: "/private-browser-cache"});
});
