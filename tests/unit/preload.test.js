"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

function loadPreload() {
  const listeners = new Map();
  const invokes = [];
  let bridge;
  const ipcRenderer = {
    invoke(...args) { invokes.push(args); },
    on(channel, listener) { listeners.set(channel, listener); },
    removeListener(channel, listener) {
      if (listeners.get(channel) === listener) listeners.delete(channel);
    },
  };
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === "electron") {
      return {
        contextBridge: {exposeInMainWorld(_name, value) { bridge = value; }},
        ipcRenderer,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve("../../app/preload.js")];
    require("../../app/preload.js");
  } finally {
    Module._load = originalLoad;
  }
  return {bridge, listeners, invokes};
}

test("exposes one removable subscription for safe managed-install progress", () => {
  const {bridge, listeners} = loadPreload();
  const events = [];

  const unsubscribe = bridge.onLgToolchainInstallProgress((event) => events.push(event));
  listeners.get("lg-toolchain-install-progress")(undefined, {code: "installing-appium"});
  unsubscribe();

  assert.deepEqual(events, [{code: "installing-appium"}]);
  assert.equal(listeners.has("lg-toolchain-install-progress"), false);
});

test("exposes browser configuration calls and a removable progress subscription", () => {
  const {bridge, listeners} = loadPreload();
  const events = [];

  assert.equal(typeof bridge.getBrowserToolchainStatus, "function");
  assert.equal(typeof bridge.planBrowserToolchainSetup, "function");
  assert.equal(typeof bridge.installBrowserToolchain, "function");

  const unsubscribe = bridge.onBrowserToolchainInstallProgress((event) => events.push(event));
  listeners.get("browser-toolchain-install-progress")(undefined, {code: "downloading-chromium"});
  unsubscribe();

  assert.deepEqual(events, [{code: "downloading-chromium"}]);
  assert.equal(listeners.has("browser-toolchain-install-progress"), false);
});

test("exposes hosts-file status and update calls", () => {
  const {bridge, invokes} = loadPreload();

  bridge.getHostEntryStatus();
  bridge.addHostEntry();
  bridge.removeHostEntry();

  assert.deepEqual(invokes, [
    ["get-host-entry-status"],
    ["add-host-entry"],
    ["remove-host-entry"],
  ]);
});

test("exposes the test configuration synchronization call", () => {
  const {bridge, invokes} = loadPreload();

  bridge.setTestConfiguration({PLAYER_CHECK_TIMEOUT_SECONDS: "12", TEST_CASE_MAX_TIME_MINUTES: "45"});

  assert.deepEqual(invokes, [["set-test-configuration", {PLAYER_CHECK_TIMEOUT_SECONDS: "12", TEST_CASE_MAX_TIME_MINUTES: "45"}]]);
});

test("exposes the running campaign loader through the narrow IPC bridge", () => {
  const {bridge, invokes} = loadPreload();

  bridge.loadFlowCaseCampaigns({API_DOMAIN: "https://api.example.test", PROJECT_ID: "1"});

  assert.deepEqual(invokes, [["load-flow-case-campaigns", {API_DOMAIN: "https://api.example.test", PROJECT_ID: "1"}]]);
});

test("exposes test-case restore and cache-clear calls through the narrow IPC bridge", () => {
  const {bridge, invokes} = loadPreload();

  bridge.loadTestCases();
  bridge.clearTestCaseCache();

  assert.deepEqual(invokes, [["load-test-cases"], ["clear-test-case-cache"]]);
});

test("exposes the selected-device connection check without a host or passphrase argument", () => {
  const {bridge, invokes} = loadPreload();

  bridge.checkTvDeviceConnection("lab-lg");

  assert.deepEqual(invokes, [["check-tv-device-connection", {deviceId: "lab-lg"}]]);
});

test("exposes narrow compatibility catalog status and refresh calls", () => {
  const {bridge, invokes} = loadPreload();

  bridge.getLgCompatibilityCatalogStatus();
  bridge.refreshLgCompatibilityCatalog({apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500});

  assert.deepEqual(invokes, [
    ["get-lg-compatibility-catalog-status"],
    ["refresh-lg-compatibility-catalog", {apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500}],
  ]);
});

test("exposes narrow local compatibility credential and validation calls", () => {
  const {bridge, invokes} = loadPreload();

  bridge.getLgCompatibilityProductGateStatus();
  bridge.saveLgCompatibilityProductGateCredentials({username: "account", password: "secret"});
  bridge.inspectLgCompatibilityDevice({confirmed: true, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"});
  bridge.runLgCompatibilityValidation({confirmed: true, attemptId: "attempt-a1"});
  bridge.discardLgCompatibilityAttempt({attemptId: "attempt-a1"});

  assert.deepEqual(invokes, [
    ["get-lg-compatibility-product-gate-status"],
    ["save-lg-compatibility-product-gate-credentials", {username: "account", password: "secret"}],
    ["inspect-lg-compatibility-device", {confirmed: true, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"}],
    ["run-lg-compatibility-validation", {confirmed: true, attemptId: "attempt-a1"}],
    ["discard-lg-compatibility-attempt", {attemptId: "attempt-a1"}],
  ]);
});

test("exposes narrow LG run calls and removable safe subscriptions", () => {
  const {bridge, invokes, listeners} = loadPreload();
  const statuses = [];
  const previews = [];

  bridge.getLgRunAvailability({deviceId: "lg-1", selectedCaseIds: ["1"]});
  bridge.runLgBatch({deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: true});
  bridge.resolveLgRunRecovery({action: "retry"});
  const stopStatus = bridge.onLgRunStatus((value) => statuses.push(value));
  const stopPreview = bridge.onLgRunPreview((value) => previews.push(value));
  listeners.get("lg-run-status")(undefined, {code: "preflight"});
  listeners.get("lg-run-preview")(undefined, "data:image/png;base64,ZmFrZQ==");
  stopStatus();
  stopPreview();

  assert.deepEqual(invokes, [
    ["get-lg-run-availability", {deviceId: "lg-1", selectedCaseIds: ["1"]}],
    ["run-lg-batch", {deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: true}],
    ["resolve-lg-run-recovery", {action: "retry"}],
  ]);
  assert.deepEqual(statuses, [{code: "preflight"}]);
  assert.deepEqual(previews, ["data:image/png;base64,ZmFrZQ=="]);
  assert.equal(listeners.has("lg-run-status"), false);
  assert.equal(listeners.has("lg-run-preview"), false);
});
