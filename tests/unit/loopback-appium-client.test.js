"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLoopbackAppiumClient} = require("../../app/loopback-appium-client");

function response(value, {ok = true} = {}) {
  return {ok, async json() { return {value}; }};
}

test("uses only a loopback Appium base URL and keeps the session id private", async () => {
  const calls = [];
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl(url, options) {
      calls.push([url, options]);
      if (url.endsWith("/session")) return response({sessionId: "private-session-id"});
      if (url.endsWith("/screenshot")) return response("genuine-png");
      return response({ok: true});
    },
  });

  await client.createSession({capabilities: {alwaysMatch: {}}});
  assert.equal(await client.screenshot(), "genuine-png");
  await client.deleteSession();

  assert.deepEqual(calls.map(([url, options]) => [url, options.method]), [
    ["http://127.0.0.1:4725/session", "POST"],
    ["http://127.0.0.1:4725/session/private-session-id/screenshot", "GET"],
    ["http://127.0.0.1:4725/session/private-session-id", "DELETE"],
  ]);
  assert.doesNotMatch(JSON.stringify(client), /private-session-id/);
});

test("rejects remote or malformed Appium base URLs before a request", () => {
  for (const baseUrl of [
    "http://remote.example:4725/",
    "https://127.0.0.1:4725/",
    "http://127.0.0.1:4725/wd/hub",
    "http://user:pass@127.0.0.1:4725/",
  ]) {
    assert.throws(
      () => createLoopbackAppiumClient({baseUrl, fetchImpl: async () => response({})}),
      /loopback Appium/i,
    );
  }
});

test("classifies Appium response failures without exposing response details", async () => {
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl() {
      return {
        ok: false,
        async json() {
          return {
            value: {
              error: "unknown error",
              message: "chromedriver failed for private-session-id at remote.example",
            },
          };
        },
      };
    },
  });

  await assert.rejects(
    client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.code === "APPIUM_CLIENT_UNAVAILABLE"
      && error.appiumFailureCode === "APPIUM_CHROMEDRIVER"
      && !/private-session-id|remote\.example/.test(error.message),
  );
});

test("classifies a rejected capability by its allowlisted capability name", async () => {
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl() {
      return {
        ok: false,
        async json() {
          return {value: {error: "invalid argument", message: "Invalid appium:automationName for remote.example"}};
        },
      };
    },
  });

  await assert.rejects(
    client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.appiumFailureCode === "APPIUM_CAPABILITY_AUTOMATION_NAME"
      && !/remote\.example|automationName/.test(error.message),
  );
});

test("does not infer a capability from an echoed capabilities payload", async () => {
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl() {
      return {
        ok: false,
        async json() {
          return {
            value: {
              error: "invalid argument",
              message: "Could not find matching capabilities from {\"appium:automationName\":\"webOS\"}",
            },
          };
        },
      };
    },
  });

  await assert.rejects(
    client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.appiumFailureCode === "APPIUM_CAPABILITIES"
      && !/automationName/.test(error.message),
  );
});

test("classifies a downstream ChromeDriver capability error as ChromeDriver", async () => {
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl() {
      return {
        ok: false,
        async json() {
          return {value: {error: "invalid argument", message: "ChromeDriver rejected the session capabilities"}};
        },
      };
    },
  });

  await assert.rejects(
    client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.appiumFailureCode === "APPIUM_CHROMEDRIVER",
  );
});

test("classifies a downstream session-not-created error as ChromeDriver", async () => {
  const client = createLoopbackAppiumClient({
    baseUrl: "http://127.0.0.1:4725/",
    async fetchImpl() {
      return {
        ok: false,
        async json() {
          return {value: {error: "session not created", message: "The requested browser session could not be created"}};
        },
      };
    },
  });

  await assert.rejects(
    client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.appiumFailureCode === "APPIUM_CHROMEDRIVER",
  );
});
