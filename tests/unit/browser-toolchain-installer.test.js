"use strict";

const {EventEmitter} = require("node:events");
const test = require("node:test");
const assert = require("node:assert/strict");

const {createBrowserToolchainInstaller} = require("../../app/browser-toolchain-installer");

function child(exitCode = 0) {
  const value = new EventEmitter();
  queueMicrotask(() => value.emit("close", exitCode));
  return value;
}

test("requires confirmation before it can install Chromium", async () => {
  let spawned = false;
  const installer = createBrowserToolchainInstaller({
    browserToolchain: {status: async () => ({ok: true, state: "missing"}), resolve: async () => "/managed/chrome"},
    managedRoot: "/managed",
    nodePath: "/node",
    playwrightCliPath: "/playwright/cli.js",
    spawn() { spawned = true; return child(); },
  });

  assert.deepEqual(await installer.install({confirmed: false}), {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"});
  assert.equal(spawned, false);
});

test("installs Chromium through the pinned Playwright CLI with fixed progress only", async () => {
  const events = [];
  const calls = [];
  const installer = createBrowserToolchainInstaller({
    browserToolchain: {
      status: async () => ({ok: true, state: "ready", component: {id: "playwright-chromium", status: "ready"}}),
      resolve: async () => "/managed/chrome",
    },
    managedRoot: "/managed",
    nodePath: "/node",
    playwrightCliPath: "/playwright/cli.js",
    environment: {PLAYWRIGHT_DOWNLOAD_HOST: "unsafe", KEEP: "yes"},
    spawn(command, args, options) { calls.push({command, args, options}); return child(); },
  });

  const response = await installer.install({confirmed: true, onProgress: (event) => events.push(event)});

  assert.deepEqual(events, [
    {code: "preparing"}, {code: "downloading-chromium"}, {code: "verifying-chromium"}, {code: "complete"},
  ]);
  assert.deepEqual(calls[0].args, ["/playwright/cli.js", "install", "chromium"]);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.env.PLAYWRIGHT_BROWSERS_PATH, "/managed");
  assert.equal(calls[0].options.env.PLAYWRIGHT_DOWNLOAD_HOST, undefined);
  assert.deepEqual(response, {ok: true, state: "ready", component: {id: "playwright-chromium", status: "ready"}});
});
