"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createTvRunner} = require("../app/tv-runner");
const {createDeviceLock} = require("../app/device-lock");
const {createWebOsAppiumSession, createWebOsSessionFactory} = require("./lib/tv-session/webos-appium-session");
const {runTvTestCase} = require("./lib/tv-case-runner");

async function runTvContractCase(runner) {
  if (!runner || typeof runner.run !== "function") throw new Error("An injected TV runner is required.");
  return runner.run({
    profileId: "fake-lg",
    host: "fake-tv.invalid",
    sharedDeviceAcknowledged: true,
    secureWebsocket: false,
    allowSelfSignedTls: false,
    connection: {
      deviceName: "Fake LG",
      deviceHost: "fake-tv.invalid",
      chromedriverPath: "/runtime/fake-chromedriver",
      remoteOnly: false,
      rcMode: "rc",
    },
    appium: {
      port: 4725,
      appiumHome: "/runtime/fake-appium-home",
      appiumBin: "/runtime/fake-appium",
    },
  });
}

function createFakeTvRunner() {
  const profile = {id: "fake-lg", label: "Fake LG", platform: "webos", appId: "com.mytvb2c.app", model: "fake-model"};
  const sessionFactory = createWebOsSessionFactory({
    async clientFactory({baseUrl}) {
      assert.equal(baseUrl, "http://127.0.0.1:4725");
      return {
        async createSession() {},
        async execute(script) {
          if (script.includes("document.body")) {
            return {bodyText: "fake", focused: "", active: "", screenUrl: ""};
          }
          throw new Error("Unexpected fake Appium command.");
        },
        async screenshot() { return "genuine-appium-png"; },
        async deleteSession() {},
      };
    },
  });
  return createTvRunner({
    registry: {async list() { return [profile]; }},
    discovery: {async validate() { return {status: "ready"}; }},
    lock: createDeviceLock(),
    serverManager: {
      async start(options) {
        assert.deepEqual(options, {
          port: 4725,
          appiumHome: "/runtime/fake-appium-home",
          appiumBin: "/runtime/fake-appium",
          secureWebsocket: false,
          allowSelfSignedTls: false,
        });
        return {baseUrl: "http://127.0.0.1:4725", async stop() {}};
      },
    },
    sessionFactory,
    redact: (value) => value,
  });
}

test("terminal TV contract harness uses only its injected LG fake", async () => {
  const result = await runTvContractCase(createFakeTvRunner());
  assert.equal(result.status, "passed");
});

test("terminal TV session contract proves a native Right DOM transition using only fakes", async () => {
  let focused = "Đăng nhập";
  const calls = [];
  const session = createWebOsAppiumSession({
    appId: "com.mytvb2c.app",
    model: "fake-model",
    connection: {
      deviceName: "Fake LG",
      deviceHost: "fake-tv.invalid",
      chromedriverPath: "/runtime/fake-chromedriver",
      remoteOnly: false,
      rcMode: "rc",
      useSecureWebsocket: false,
    },
    wait: async () => {},
    client: {
      async createSession() { calls.push("create"); },
      async execute(script, args = []) {
        if (script.includes("document.body")) {
          return {bodyText: "welcome", focused, active: "", screenUrl: "https://mytv.example/"};
        }
        if (script === "webos: pressKey") {
          calls.push([script, args]);
          focused = "Trải nghiệm";
          return;
        }
        throw new Error("Unexpected fake Appium command.");
      },
      async screenshot() { return "genuine-appium-png"; },
      async deleteSession() { calls.push("delete"); },
    },
  });

  await session.start();
  const before = await session.getDomState();
  await session.screenshot();
  await session.pressKey("ArrowRight");
  const after = await session.waitForDomState((state) => state.focused === "Trải nghiệm", {timeoutMs: 50, pollIntervalMs: 10});
  await session.cleanup();
  await session.close();

  assert.equal(before.focused, "Đăng nhập");
  assert.equal(after.focused, "Trải nghiệm");
  assert.deepEqual(calls, ["create", ["webos: pressKey", [{key: "RIGHT"}]], "delete"]);
});

test("terminal target-neutral case contract runs every supported action through trusted fakes", async () => {
  const events = [];
  const tvSession = {
    async resetAppState() { events.push("reset"); },
    async pressKey(key) { events.push(`key:${key}`); },
    async getDomState() { return {bodyText: "Trải nghiệm", focused: "", active: ""}; },
    async waitForDomState(predicate) { return predicate({bodyText: "Trải nghiệm", focused: "", active: ""}); },
    async screenshot() { return "genuine-appium-png"; },
  };
  const semantic = new Proxy({}, {
    get(_target, name) {
      if (name === "enterVirtualKey") return async (character) => events.push(`virtual:${character}`);
      if (name === "logout") return async () => events.push("logout");
      return async (value) => events.push([name, value]);
    },
  });
  const result = await runTvTestCase({
    tvSession,
    capabilities: {domInspection: true, visualCapture: true, targetSemanticActions: true, playerInspection: true},
    helpers: {
      semantic,
      async waitForReady(_session, name) { events.push(`ready:${name}`); },
    },
    testCase: {
      id: "fake-all-actions",
      name: "Fake all target-neutral actions",
      actions: [
        {action: "wait_for_ready", name: "app"},
        {action: "login", username: "ab", password: "12"},
        {action: "open_home"},
        {action: "focus_row", rowName: "Thể loại", itemIndex: 1},
        {action: "focus_row_first_item"},
        {action: "focus_text", text: "Trải nghiệm"},
        {action: "press_ok"},
        {action: "open_service", service: "Truyền hình"},
        {action: "open_search"},
        {action: "search_content", name: "xy", type: "content"},
        {action: "play_content", name: "Mẫu", type: "content"},
        {action: "play_search_result", type: "content"},
        {action: "play_row", rowIndex: 1, count: 1},
        {action: "assert_screen", text: "Trải nghiệm"},
        {action: "press_back", count: 2},
      ],
    },
  });

  assert.equal(result.status, "passed");
  assert.equal(result.steps.length, 15);
  assert.deepEqual(events, [
    "reset",
    "ready:app",
    ["focusLogin", undefined],
    "virtual:a",
    "virtual:b",
    ["submitVirtualField", "username"],
    "virtual:1",
    "virtual:2",
    ["submitVirtualField", "password"],
    ["completeLogin", undefined],
    ["openHome", undefined],
    ["focusRow", {rowName: "Thể loại", itemIndex: 1}],
    ["focusRowFirstItem", undefined],
    ["focusText", "Trải nghiệm"],
    "key:Enter",
    ["openService", "Truyền hình"],
    ["openSearch", undefined],
    "virtual:x",
    "virtual:y",
    ["searchContent", {name: "xy", type: "content"}],
    ["playContent", {name: "Mẫu", type: "content"}],
    ["playSearchResult", {type: "content"}],
    ["playRow", {rowIndex: 1, rowName: undefined, count: 1}],
    "key:Backspace",
    "key:Backspace",
    "logout",
  ]);
});

module.exports = {runTvContractCase, createFakeTvRunner};
