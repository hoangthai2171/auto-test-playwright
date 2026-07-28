const test = require("node:test");
const assert = require("node:assert/strict");

const {createWebOsAppiumSession, createWebOsSessionFactory} = require("../lib/tv-session/webos-appium-session");

const APP_ID = "com.mytvb2c.app";
const RUNTIME_CONNECTION = Object.freeze({
  deviceName: "Living room OLED",
  deviceHost: "192.168.1.9",
  chromedriverPath: "/private/runtime/chromedriver",
  remoteOnly: false,
  rcMode: "rc",
  useSecureWebsocket: true,
});
const APPROVED_PROFILE = Object.freeze({
  id: "living-room",
  platform: "lg",
  appId: APP_ID,
  model: "OLED55C4",
});
const LOOPBACK_SERVER = Object.freeze({baseUrl: "http://127.0.0.1:4725"});

function createFakeClient({activeAppId = APP_ID, domState, screenshot, createSession} = {}) {
  const calls = [];
  return {
    calls,
    async createSession(options) {
      calls.push(["createSession", options]);
      return createSession ? createSession(options) : {sessionId: "session-1"};
    },
    async execute(script, args = []) {
      calls.push(["execute", script, args]);
      if (script === "webos: activeAppInfo") return {appId: activeAppId};
      if (script.includes("document.body")) {
        return typeof domState === "function" ? domState() : (domState || {
          bodyText: "password=secret welcome",
          focused: "secret focused",
          active: "",
          screenUrl: "https://mytv.example/",
        });
      }
      return undefined;
    },
    async screenshot() {
      calls.push(["screenshot"]);
      if (screenshot) return screenshot();
      return "genuine-appium-png";
    },
    async deleteSession() {
      calls.push(["deleteSession"]);
    },
  };
}

function createSession(client, options = {}) {
  return createWebOsAppiumSession({
    client,
    appId: APP_ID,
    model: "OLED55C4",
    connection: RUNTIME_CONNECTION,
    ...options,
  });
}

test("webOS session factory injects only the validated loopback Appium base URL", async () => {
  const client = createFakeClient();
  const clientFactoryCalls = [];
  const factory = createWebOsSessionFactory({
    secrets: ["factory-secret"],
    async clientFactory(options) {
      clientFactoryCalls.push(options);
      return client;
    },
  });

  const session = await factory.create({
    profile: APPROVED_PROFILE,
    server: LOOPBACK_SERVER,
    connection: RUNTIME_CONNECTION,
  });

  assert.deepEqual(clientFactoryCalls, [{baseUrl: "http://127.0.0.1:4725"}]);
  assert.equal(typeof session.start, "function");
  assert.doesNotMatch(
    JSON.stringify(session.diagnostics),
    /192\.168\.1\.9|chromedriver|factory-secret|capabilit/i,
  );
});

test("webOS session factory blocks unsupported profiles before creating a client", async () => {
  let clientFactoryCalls = 0;
  const factory = createWebOsSessionFactory({
    clientFactory: async () => {
      clientFactoryCalls += 1;
      return createFakeClient();
    },
  });

  await assert.rejects(
    factory.create({
      profile: {...APPROVED_PROFILE, platform: "tizen", appId: "org.example.unapproved"},
      server: LOOPBACK_SERVER,
      connection: RUNTIME_CONNECTION,
    }),
    (error) => error.code === "PLATFORM_UNSUPPORTED",
  );
  assert.equal(clientFactoryCalls, 0);
});

test("webOS session factory blocks non-loopback server URLs before creating a client", async () => {
  let clientFactoryCalls = 0;
  const factory = createWebOsSessionFactory({
    clientFactory: async () => {
      clientFactoryCalls += 1;
      return createFakeClient();
    },
  });

  await assert.rejects(
    factory.create({
      profile: APPROVED_PROFILE,
      server: {baseUrl: "http://192.168.1.9:4725"},
      connection: RUNTIME_CONNECTION,
    }),
    (error) => error.code === "APPIUM_BASE_URL_INVALID"
      && !/192\.168\.1\.9/.test(error.message),
  );
  assert.equal(clientFactoryCalls, 0);
});

test("webOS session factory redacts sensitive client-factory failures", async () => {
  const factory = createWebOsSessionFactory({
    secrets: ["factory-secret"],
    clientFactory: async () => {
      throw new Error("factory-secret 192.168.1.9 /private/runtime/chromedriver");
    },
  });

  await assert.rejects(
    factory.create({profile: APPROVED_PROFILE, server: LOOPBACK_SERVER, connection: RUNTIME_CONNECTION}),
    (error) => error.code === "APPIUM_CLIENT_UNAVAILABLE"
      && !/factory-secret|192\.168\.1\.9|chromedriver/i.test(error.message),
  );
});

test("webOS session rejects an unapproved app identity before client commands", () => {
  const client = createFakeClient();

  assert.throws(
    () => createWebOsAppiumSession({client, appId: "com.example.other", model: "OLED55C4"}),
    /com\.mytvb2c\.app/,
  );
  assert.deepEqual(client.calls, []);
});

test("webOS session creates one installed-app session without deployment capabilities", async () => {
  const client = createFakeClient();
  const session = createSession(client);

  await session.start();
  await session.start();

  assert.equal(client.calls.filter(([command]) => command === "createSession").length, 1);
  const options = client.calls.find(([command]) => command === "createSession")[1];
  assert.deepEqual(options, {
    capabilities: {
      alwaysMatch: {
        platformName: "LGTV",
        "appium:automationName": "webOS",
        "appium:deviceName": "Living room OLED",
        "appium:deviceHost": "192.168.1.9",
        "appium:appId": APP_ID,
        "appium:chromedriverExecutable": "/private/runtime/chromedriver",
        "appium:autoExtendDevMode": false,
        "appium:noReset": false,
        "appium:fullReset": false,
        "appium:remoteOnly": false,
        "appium:rcMode": "rc",
        "appium:useSecureWebsocket": true,
      },
      firstMatch: [{}],
    },
  });
  assert.doesNotMatch(JSON.stringify(options), /package|install|deploy/i);
});

test("webOS session rejects incomplete or remote-only runtime connection data before client commands", () => {
  const client = createFakeClient();

  for (const connection of [
    {...RUNTIME_CONNECTION, deviceHost: ""},
    {...RUNTIME_CONNECTION, remoteOnly: true},
  ]) {
    assert.throws(
      () => createWebOsAppiumSession({client, appId: APP_ID, model: "OLED55C4", connection}),
      /connection|host|remoteOnly/i,
    );
  }
  assert.deepEqual(client.calls, []);
});

test("webOS session sends native remote key names and reads redacted DOM through Appium", async () => {
  const client = createFakeClient();
  const session = createSession(client, {secrets: ["secret"]});

  await session.pressKey("ArrowRight");
  await session.pressKey("Backspace");
  const state = await session.readDomState();

  assert.deepEqual(client.calls[0], ["execute", "webos: pressKey", [{key: "RIGHT"}]]);
  assert.deepEqual(client.calls[1], ["execute", "webos: pressKey", [{key: "BACK"}]]);
  assert.match(client.calls[2][1], /document\.body/);
  assert.doesNotMatch(JSON.stringify(state), /secret/i);
  assert.equal(state.screenUrl, "https://mytv.example/");
});

test("webOS session exposes target-neutral reset, DOM, screenshot, and cleanup methods", async () => {
  const client = createFakeClient();
  const session = createSession(client, {secrets: ["secret"]});

  assert.equal(typeof session.resetAppState, "function");
  assert.equal(typeof session.getDomState, "function");
  assert.equal(typeof session.screenshot, "function");
  assert.equal(typeof session.cleanup, "function");
  await session.resetAppState();
  assert.deepEqual(client.calls[0], ["execute", "webos: activeAppInfo", []]);
  assert.deepEqual(client.calls[1], ["execute", "webos: clearApp", [{appId: APP_ID}]]);
  assert.deepEqual(await session.getDomState(), await session.readDomState());
  assert.equal(await session.screenshot(), "genuine-appium-png");
  assert.equal((await session.cleanup()).platform, "lg");
});

test("webOS session waits for a redacted DOM-state transition with an injected clock", async () => {
  let reads = 0;
  const waits = [];
  const client = createFakeClient({
    domState: () => ({
      bodyText: "welcome",
      focused: reads++ === 0 ? "Đăng nhập" : "Trải nghiệm",
      active: "",
      screenUrl: "https://mytv.example/",
    }),
  });
  const session = createSession(client, {wait: async (milliseconds) => waits.push(milliseconds)});

  const state = await session.waitForDomState(
    (current) => current.focused.includes("Trải nghiệm"),
    {timeoutMs: 100, pollIntervalMs: 25},
  );

  assert.equal(state.focused, "Trải nghiệm");
  assert.deepEqual(waits, [25]);
});

test("webOS session rejects an unsupported key before client action", async () => {
  const client = createFakeClient();
  const session = createSession(client);

  await assert.rejects(session.pressKey("Space"), /Unsupported TV remote key/);
  assert.deepEqual(client.calls, []);
});

test("webOS session resets only after the foreground app identity is validated", async () => {
  const client = createFakeClient();
  const session = createSession(client);

  await session.reset();

  assert.deepEqual(client.calls, [
    ["execute", "webos: activeAppInfo", []],
    ["execute", "webos: clearApp", [{appId: APP_ID}]],
  ]);
});

test("webOS session does not clear an unverified foreground app", async () => {
  const client = createFakeClient({activeAppId: "com.example.other"});
  const session = createSession(client);

  await assert.rejects(session.reset(), (error) => error.code === "APP_IDENTITY_MISMATCH");
  assert.deepEqual(client.calls, [["execute", "webos: activeAppInfo", []]]);
});

test("webOS session fails when a genuine Appium screenshot is unavailable", async () => {
  const client = createFakeClient({
    screenshot: async () => { throw new Error("192.168.1.9 could not use /private/runtime/chromedriver"); },
  });
  const session = createSession(client);

  await assert.rejects(
    session.captureScreenshot(),
    (error) => error.code === "VISUAL_CAPTURE_UNAVAILABLE"
      && !/192\.168\.1\.9|chromedriver/i.test(error.message),
  );
  assert.deepEqual(client.calls, [["screenshot"]]);
});

test("webOS session never includes runtime connection values in client failure messages", async () => {
  const client = createFakeClient({
    createSession: async () => { throw new Error("192.168.1.9 could not use /private/runtime/chromedriver"); },
  });
  const session = createSession(client);

  await assert.rejects(
    session.start(),
    (error) => error.code === "SESSION_UNAVAILABLE"
      && !/192\.168\.1\.9|chromedriver/i.test(error.message),
  );
});

test("webOS session rejects missing or empty genuine Appium screenshot payloads", async () => {
  for (const payload of [undefined, null, "", Buffer.alloc(0)]) {
    const client = createFakeClient({screenshot: async () => payload});
    const session = createSession(client);

    await assert.rejects(
      session.captureScreenshot(),
      (error) => error.code === "VISUAL_CAPTURE_UNAVAILABLE",
    );
    assert.deepEqual(client.calls, [["screenshot"]]);
  }
});

test("webOS session redacts runtime connection data from DOM state and diagnostics", async () => {
  const client = createFakeClient({
    domState: {
      bodyText: "MyTV ready",
      focused: "",
      active: "",
      screenUrl: "https://192.168.1.9/search?session=opaque-query-value",
    },
  });
  const session = createSession(client, {secrets: ["query-secret"]});

  const state = await session.readDomState();

  assert.doesNotMatch(JSON.stringify(state), /192\.168\.1\.9|query-secret|opaque-query-value|chromedriver/i);
  assert.doesNotMatch(JSON.stringify(session.diagnostics), /192\.168\.1\.9|chromedriver|query-secret/i);
});

test("webOS session redacts URL hostnames derived from runtime endpoints", async () => {
  const cases = [
    {deviceHost: "192.168.1.9:3000", screenUrl: "https://192.168.1.9/app", rawHost: "192.168.1.9"},
    {deviceHost: "office-mytv.local", screenUrl: "https://office-mytv.local/app", rawHost: "office-mytv.local"},
    {deviceHost: "[2001:db8::7]:3000", screenUrl: "https://[2001:db8::7]/app", rawHost: "2001:db8::7"},
  ];

  for (const {deviceHost, screenUrl, rawHost} of cases) {
    const client = createFakeClient({
      domState: {bodyText: "MyTV ready", focused: "", active: "", screenUrl},
    });
    const session = createSession(client, {
      connection: {...RUNTIME_CONNECTION, deviceHost},
    });

    const state = await session.readDomState();

    assert.doesNotMatch(JSON.stringify(state), new RegExp(rawHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    assert.doesNotMatch(JSON.stringify(session.diagnostics), new RegExp(rawHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("webOS session closes idempotently and exposes only redacted diagnostics", async () => {
  const client = createFakeClient();
  const session = createSession(client, {
    secrets: ["password-secret", "pairing-secret", "iVBORw0KGgoAAA"],
  });

  await session.start();
  await session.close();
  await session.close();

  assert.equal(client.calls.filter(([command]) => command === "deleteSession").length, 1);
  const retained = JSON.stringify(session.diagnostics);
  assert.doesNotMatch(
    retained,
    /capabilit|host|pairing|passphrase|password-secret|pairing-secret|iVBORw0KGgoAAA|png/i,
  );
  assert.deepEqual(session.diagnostics, {platform: "lg", model: "OLED55C4", started: true, closed: true});
});

test("webOS session exposes only named trusted MyTV semantic operations", () => {
  const session = createSession(createFakeClient());

  assert.deepEqual(Object.keys(session.createMyTvAutomation()).sort(), [
    "completeLogin",
    "enterVirtualKey",
    "focusLogin",
    "logout",
    "openHome",
    "openSearch",
    "playContent",
    "playRow",
    "playSearchResult",
    "focusRow",
    "focusRowFirstItem",
    "focusText",
    "openService",
    "searchContent",
    "submitVirtualField",
    "waitForReady",
  ].sort());
  assert.equal("execute" in session.createMyTvAutomation(), false);
  assert.equal("evaluate" in session.createMyTvAutomation(), false);
});
