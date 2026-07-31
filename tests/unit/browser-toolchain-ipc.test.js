"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {registerBrowserToolchainIpc} = require("../../app/browser-toolchain-ipc");

test("returns a redacted browser review and sends fixed progress only", async () => {
  const handlers = new Map();
  const sent = [];
  registerBrowserToolchainIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    browserToolchain: {status: async () => ({ok: true, state: "missing", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "missing", path: "/managed"}})},
    browserInstaller: {install: async ({onProgress}) => {
      onProgress({code: "downloading-chromium", path: "/managed", output: "private"});
      return {ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready", path: "/managed"}};
    }},
  });

  assert.deepEqual(await handlers.get("get-browser-toolchain-status")(), {ok: true, state: "missing", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "missing"}});
  const result = await handlers.get("install-browser-toolchain")({sender: {send(channel, value) { sent.push([channel, value]); }}}, {confirmed: true});
  assert.deepEqual(sent, [["browser-toolchain-install-progress", {code: "downloading-chromium"}]]);
  assert.deepEqual(result, {ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"}});
});
