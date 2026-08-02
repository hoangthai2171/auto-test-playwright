"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createTvRunner} = require("../../app/tv-runner");
const {createDeviceLock} = require("../../app/device-lock");

const LG_PROFILE = Object.freeze({
  id: "lg-1",
  label: "Living room LG",
  platform: "webos",
  appId: "com.mytvb2c.app",
  model: "OLED55C4",
});

const CONNECTION = Object.freeze({
  deviceName: "Living room LG",
  deviceHost: "192.168.1.9",
  chromedriverPath: "/private/runtime/chromedriver",
  remoteOnly: false,
  rcMode: "rc",
});

const APPIUM = Object.freeze({
  port: 4725,
  appiumHome: "/private/runtime/appium-home",
  appiumBin: "/private/runtime/appium",
});

function redact(value) {
  return String(value)
    .replaceAll("192.168.1.9", "[HOST]")
    .replaceAll("pairing-secret", "[SECRET]")
    .replaceAll("/private/runtime/chromedriver", "[TOOL]");
}

function createHarness({profiles = [LG_PROFILE], discoveryResult, sessionFactoryCreate, session: suppliedSession, serverStart, serverStop, caseExecutor} = {}) {
  const calls = {discovery: 0, serverStarts: 0, serverStops: 0, sessionCreates: 0, sessionStarts: 0, domReads: 0, screenshots: 0, sessionCleanups: 0, sessionCloses: 0};
  const lock = createDeviceLock();
  const session = suppliedSession || {
    async start() { calls.sessionStarts += 1; },
    async getDomState() {
      calls.domReads += 1;
      return {bodyText: "ready at 192.168.1.9 with pairing-secret", focused: "", active: "", screenUrl: "https://192.168.1.9/"};
    },
    async screenshot() { calls.screenshots += 1; return "genuine-appium-png"; },
    async cleanup() { calls.sessionCleanups += 1; },
    async close() { calls.sessionCloses += 1; },
  };
  const registry = {async list() { return profiles; }};
  const discovery = {
    async validate(profile, {host}) {
      calls.discovery += 1;
      return discoveryResult || {
        status: "ready",
        identity: {model: profile.model},
        installedApp: {id: profile.appId, version: "3.5.0"},
        diagnostics: {host, pairing: "pairing-secret"},
      };
    },
  };
  const serverManager = {
    async start(options) {
      calls.serverStarts += 1;
      calls.serverOptions = options;
      if (serverStart) return serverStart(options);
      if (!Number.isInteger(options.port) || !options.appiumHome) {
        throw new Error("fake Appium manager requires a runtime port and APPIUM_HOME");
      }
      return {
        baseUrl: "http://127.0.0.1:4725",
        diagnostics: {host: "192.168.1.9", command: "/private/runtime/chromedriver"},
        async stop() {
          calls.serverStops += 1;
          if (serverStop) return serverStop();
        },
      };
    },
  };
  const sessionFactory = {
    async create(options) {
      calls.sessionCreates += 1;
      calls.sessionOptions = options;
      return sessionFactoryCreate ? sessionFactoryCreate(options) : session;
    },
  };
  return {
    calls,
    session,
    lock,
    runner: createTvRunner({registry, discovery, lock, serverManager, sessionFactory, redact, caseExecutor}),
  };
}

function validRun(overrides = {}) {
  return {
    profileId: "lg-1",
    host: "192.168.1.9",
    sharedDeviceAcknowledged: true,
    secureWebsocket: true,
    allowSelfSignedTls: false,
    connection: CONNECTION,
    appium: APPIUM,
    ...overrides,
  };
}

test("runner rejects Samsung before discovery, lock, Appium, or session creation", async () => {
  const samsung = {...LG_PROFILE, id: "sam-1", platform: "tizen", appId: "PP2MTMRMs9.MyTV"};
  const {runner, calls, lock} = createHarness({profiles: [samsung]});

  await assert.rejects(runner.run(validRun({profileId: "sam-1"})), (error) => error.code === "PLATFORM_UNSUPPORTED");

  assert.equal(calls.discovery, 0);
  assert.equal(calls.serverStarts, 0);
  assert.equal(calls.sessionCreates, 0);
  assert.equal(lock.isLocked("sam-1"), false);
});

test("runner rejects an unknown profile before discovery, lock, Appium, or session creation", async () => {
  const {runner, calls, lock} = createHarness();

  await assert.rejects(runner.run(validRun({profileId: "missing"})), (error) => error.code === "PROFILE_NOT_FOUND");

  assert.equal(calls.discovery, 0);
  assert.equal(calls.serverStarts, 0);
  assert.equal(calls.sessionCreates, 0);
  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner requires acknowledgement before contacting a shared LG device", async () => {
  const {runner, calls, lock} = createHarness();

  await assert.rejects(runner.run(validRun({sharedDeviceAcknowledged: false})), (error) => error.code === "SHARED_DEVICE_ACKNOWLEDGEMENT_REQUIRED");

  assert.equal(calls.discovery, 0);
  assert.equal(calls.serverStarts, 0);
  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner stops before Appium when read-only discovery is not ready", async () => {
  const {runner, calls, lock} = createHarness({
    discoveryResult: {status: "APP_NOT_INSTALLED", diagnostics: {host: "192.168.1.9", pairing: "pairing-secret"}},
  });

  await assert.rejects(runner.run(validRun()), (error) => error.code === "APP_NOT_INSTALLED" && !/192\.168\.1\.9|pairing-secret/.test(error.message));

  assert.equal(calls.discovery, 1);
  assert.equal(calls.serverStarts, 0);
  assert.equal(calls.sessionCreates, 0);
  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner rejects missing, synthetic, or contradictory ephemeral connections before server or session activity", async () => {
  for (const connection of [
    undefined,
    {...CONNECTION, deviceHost: "192.168.1.8"},
    {...CONNECTION, rcMode: "js"},
    {...CONNECTION, remoteOnly: true},
  ]) {
    const {runner, calls, lock} = createHarness();

    await assert.rejects(runner.run(validRun({connection})), (error) => error.code === "RUNTIME_CONNECTION_INVALID");

    assert.equal(calls.serverStarts, 0);
    assert.equal(calls.sessionCreates, 0);
    assert.equal(lock.isLocked("lg-1"), false);
  }
});

test("runner rejects incomplete ephemeral Appium configuration before discovery or server activity", async () => {
  for (const appium of [undefined, {...APPIUM, port: 0}, {...APPIUM, appiumHome: ""}]) {
    const {runner, calls, lock} = createHarness();

    await assert.rejects(runner.run(validRun({appium})), (error) => error.code === "RUNTIME_APPIUM_INVALID");

    assert.equal(calls.discovery, 0);
    assert.equal(calls.serverStarts, 0);
    assert.equal(calls.sessionCreates, 0);
    assert.equal(lock.isLocked("lg-1"), false);
  }
});

test("runner verifies injected DOM and genuine Appium screenshot then returns immutable redacted metadata", async () => {
  const {runner, calls, lock} = createHarness();

  const result = await runner.run(validRun());

  assert.equal(result.status, "passed");
  assert.equal(calls.serverOptions.secureWebsocket, true);
  assert.equal(calls.serverOptions.allowSelfSignedTls, false);
  assert.deepEqual(calls.serverOptions, {...APPIUM, secureWebsocket: true, allowSelfSignedTls: false});
  assert.equal(calls.sessionOptions.profile.platform, "lg");
  assert.deepEqual(calls.sessionOptions.connection, {...CONNECTION, deviceHost: "192.168.1.9", useSecureWebsocket: true});
  assert.equal(calls.sessionOptions.server.baseUrl, "http://127.0.0.1:4725");
  assert.equal(calls.domReads, 1);
  assert.equal(calls.screenshots, 1);
  assert.equal(calls.sessionCleanups, 1);
  assert.equal(calls.sessionCloses, 1);
  assert.equal(calls.serverStops, 1);
  assert.equal(lock.isLocked("lg-1"), false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.events));
  assert.ok(Object.isFrozen(result.artifactMetadata));
  assert.doesNotMatch(JSON.stringify(result), /192\.168\.1\.9|pairing-secret|chromedriver/i);
  assert.deepEqual(result.artifactMetadata, {domInspected: true, genuineAppiumScreenshot: true});
});

test("runner emits fixed lifecycle codes and data-url frames without runtime values", async () => {
  const events = [];
  const frames = [];
  const {runner} = createHarness({
    session: {
      async start() {},
      async getDomState() { return {}; },
      async screenshot() { return Buffer.from("genuine-appium-png"); },
      async cleanup() {},
      async close() {},
    },
  });

  await runner.run(validRun({
    onEvent: (event) => events.push(event),
    onFrame: (frame) => frames.push(frame),
  }));

  assert.deepEqual(events.map((event) => event.code), [
    "preflight-ready",
    "appium-started",
    "session-started",
    "cleanup-complete",
  ]);
  assert.equal(frames.length, 1);
  assert.match(frames[0], /^data:image\/png;base64,/);
  assert.doesNotMatch(JSON.stringify({events, frames}), /192\.168\.1\.9|pairing-secret|chromedriver/i);
});

test("runner ignores lifecycle and frame callback failures", async () => {
  const {runner} = createHarness({
    session: {
      async start() {},
      async getDomState() { return {}; },
      async screenshot() { return "Z2VudWluZQ=="; },
      async cleanup() {},
      async close() {},
    },
  });

  const result = await runner.run(validRun({
    onEvent() { throw new Error("callback failure"); },
    onFrame() { throw new Error("callback failure"); },
  }));

  assert.equal(result.status, "passed");
});

test("runner invokes a trusted injected case executor only after the session preflight", async () => {
  const received = [];
  const {runner, calls, session} = createHarness({
    async caseExecutor(context) {
      received.push(context);
      return {testCaseId: context.testCase.id, status: "passed", steps: []};
    },
  });
  const testCase = {id: "case-1", name: "Trusted case", actions: [{action: "wait_for_ready", name: "app"}]};

  const result = await runner.run(validRun({testCase, caseHelpers: {semantic: {}}}));

  assert.equal(received.length, 1);
  assert.equal(received[0].testCase, testCase);
  assert.equal(received[0].tvSession, session);
  assert.equal(received[0].runtimeHost, undefined);
  assert.equal(received[0].connection, undefined);
  assert.deepEqual(result.caseResult, {testCaseId: "case-1", status: "passed", steps: []});
});

test("runner forwards the configured player timeout into trusted LG helpers", async () => {
  const helperOptions = [];
  const session = {
    async start() {},
    async getDomState() { return {}; },
    async screenshot() { return "genuine-appium-png"; },
    async cleanup() {},
    async close() {},
    createMyTvAutomation(options) {
      helperOptions.push(options);
      return {waitForReady: async () => {}};
    },
  };
  const {runner} = createHarness({
    session,
    async caseExecutor(context) {
      assert.equal(typeof context.helpers.waitForReady, "function");
      return {testCaseId: context.testCase.id, status: "passed", steps: []};
    },
  });

  await runner.run(validRun({
    testCase: {id: "case-1", name: "Configured case", actions: [{action: "wait_for_ready", name: "player"}]},
    playerCheckTimeoutSeconds: 9,
  }));

  assert.deepEqual(helperOptions, [{playerCheckTimeoutSeconds: 9}]);
});

test("runner preserves only a redacted case step summary when a case action fails", async () => {
  const actionError = new Error("search failed for 192.168.1.9 with pairing-secret");
  actionError.testCaseResult = {
    testCaseId: "case-1",
    status: "failed",
    completionScreenshotDataUrl: "data:image/png;base64,PRIVATE_SCREENSHOT",
    steps: [
      {action: "login", status: "passed", message: "account included pairing-secret"},
      {action: "search_content", status: "failed", message: "host 192.168.1.9", screenshot: "data:image/png;base64,PRIVATE_SCREENSHOT"},
    ],
  };
  const {runner, lock} = createHarness({
    async caseExecutor() {
      throw actionError;
    },
  });
  const testCase = {id: "case-1", name: "Trusted case", actions: [{action: "search_content", name: "VTV1 HD", type: "channel"}]};

  await assert.rejects(
    runner.run(validRun({testCase, caseHelpers: {semantic: {}}})),
    (error) => {
      assert.equal(error.code, "TV_RUN_FAILED");
      assert.equal(error.lifecycleStage, "case-started");
      assert.deepEqual(error.testCaseResult, {
        status: "failed",
        steps: [
          {action: "login", status: "passed"},
          {action: "search_content", status: "failed"},
        ],
      });
      assert.doesNotMatch(JSON.stringify(error.testCaseResult), /192\.168\.1\.9|pairing-secret|data:image/i);
      return true;
    },
  );

  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner releases its lock and stops Appium when injected session creation fails", async () => {
  const {runner, calls, lock} = createHarness({
    sessionFactoryCreate: async () => {
      const error = new Error("session failed for 192.168.1.9 with pairing-secret");
      error.failureCode = "APPIUM_CHROMEDRIVER";
      throw error;
    },
  });

  await assert.rejects(
    runner.run(validRun()),
    (error) => error.code === "TV_RUN_FAILED"
      && error.lifecycleStage === "session-creating"
      && error.failureCode === "APPIUM_CHROMEDRIVER"
      && /session failed/.test(error.message)
      && !/192\.168\.1\.9|pairing-secret/.test(error.message),
  );

  assert.equal(calls.serverStops, 1);
  assert.equal(calls.sessionCloses, 0);
  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner releases its lock without creating a session when the Appium manager start deadline fails", async () => {
  const {runner, calls, lock} = createHarness({
    serverStart: async () => { throw new Error("Appium health deadline reached for 192.168.1.9"); },
  });

  await assert.rejects(
    runner.run(validRun()),
    (error) => error.code === "TV_RUN_FAILED" && !/192\.168\.1\.9/.test(error.message),
  );

  assert.equal(calls.serverStarts, 1);
  assert.equal(calls.serverStops, 0);
  assert.equal(calls.sessionCreates, 0);
  assert.equal(lock.isLocked("lg-1"), false);
});

test("runner preserves a redacted session failure when later cleanup also fails", async () => {
  let closeAttempts = 0;
  const session = {
    async start() { throw new Error("session failed for 192.168.1.9 with pairing-secret"); },
    async getDomState() { return {}; },
    async screenshot() { return "genuine-appium-png"; },
    async cleanup() {},
    async close() {
      closeAttempts += 1;
      throw new Error("close failure for pairing-secret");
    },
  };
  const {runner, calls, lock} = createHarness({
    session,
    serverStop: async () => { throw new Error("server failure for 192.168.1.9"); },
  });

  await assert.rejects(
    runner.run(validRun()),
    (error) => error.code === "TV_RUN_FAILED"
      && /session failed/.test(error.message)
      && !/192\.168\.1\.9|pairing-secret/.test(JSON.stringify(error))
      && error.cleanupEvents?.length === 2,
  );

  assert.equal(closeAttempts, 1);
  assert.equal(calls.serverStops, 1);
  assert.equal(lock.isLocked("lg-1"), false);
});
