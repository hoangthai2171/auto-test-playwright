"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgDesktopRunPreflight} = require("../../app/lg-desktop-run-preflight");

const PROFILE = Object.freeze({
  id: "lg-1",
  label: "Lab LG",
  platform: "webos",
  appId: "com.mytvb2c.app",
  model: "verified-model",
  firmwareVersion: "verified-firmware",
  vendorDeviceName: "registered-lg",
});
const TOOLCHAIN = Object.freeze({
  webosSdkHome: "/private/toolchain/webos-sdk",
  appiumHome: "/private/toolchain/appium",
  appiumBin: "/private/toolchain/appium/bin/appium",
  chromedriverPath: "/private/toolchain/chromedriver",
});

function createHarness({
  profiles = [PROFILE],
  host = "host-value",
  passphrase = "passphrase-value",
  toolchain = TOOLCHAIN,
  toolchainError,
  compatibility = "verified",
  chromedriverStatus = "ready",
  info = {model: PROFILE.model, firmware: PROFILE.firmwareVersion},
  apps = [{id: PROFILE.appId, version: "version-value"}],
  adapterError,
} = {}) {
  const calls = {registry: 0, secrets: [], toolchain: 0, adapter: []};
  const preflight = createLgDesktopRunPreflight({
    registry: {
      async list() {
        calls.registry += 1;
        return profiles;
      },
    },
    secrets: {
      async getSecret(deviceId, name) {
        calls.secrets.push([deviceId, name]);
        return name === "host" ? host : passphrase;
      },
    },
    toolchainConfig: {
      async resolve() {
        calls.toolchain += 1;
        if (toolchainError) throw toolchainError;
        return toolchain;
      },
    },
    adapter: {
      async deviceInfo(connection) {
        calls.adapter.push(["deviceInfo", connection]);
        if (adapterError) throw adapterError;
        return info;
      },
      async listApps(connection) {
        calls.adapter.push(["listApps", connection]);
        if (adapterError) throw adapterError;
        return apps;
      },
    },
    compatibilityCatalog: {
      async select() {
        return compatibility === "verified"
          ? {status: "verified", artifact: {version: "120.0"}}
          : {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
      },
    },
    detector: {
      async inspect({chromedriverVersion}) {
        calls.detector = chromedriverVersion;
        return {
          state: chromedriverStatus === "ready" ? "ready" : "missing",
          components: [{id: "chromedriver", status: chromedriverStatus, version: chromedriverVersion}],
        };
      },
    },
    redact(value) {
      return String(value)
        .replaceAll(host, "[HOST]")
        .replaceAll(passphrase, "[PASSPHRASE]")
        .replaceAll("/private/toolchain", "[TOOLCHAIN]");
    },
  });
  return {preflight, calls};
}

test("availability is local-only and blocks an unverified compatibility profile", async () => {
  const {preflight, calls} = createHarness({compatibility: "unverified"});

  assert.deepEqual(await preflight.availability({deviceId: PROFILE.id}), {
    ok: false,
    status: "COMPATIBILITY_PROFILE_UNVERIFIED",
  });
  assert.equal(calls.toolchain, 1);
  assert.deepEqual(calls.secrets, []);
  assert.deepEqual(calls.adapter, []);
});

test("availability blocks a selected catalog driver that is not installed at its exact version", async () => {
  const {preflight, calls} = createHarness({chromedriverStatus: "repair-needed"});

  assert.deepEqual(await preflight.availability({deviceId: PROFILE.id}), {
    ok: false,
    status: "TOOLCHAIN_UNAVAILABLE",
  });
  assert.equal(calls.detector, "120.0");
  assert.deepEqual(calls.secrets, []);
  assert.deepEqual(calls.adapter, []);
});

test("availability classifies missing saved run prerequisites without contacting a TV", async () => {
  const cases = [
    {options: {profiles: []}, status: "DEVICE_NOT_FOUND"},
    {options: {profiles: [{...PROFILE, vendorDeviceName: ""}]}, status: "REGISTERED_TARGET_REQUIRED"},
    {options: {toolchainError: new Error("/private/toolchain unavailable")}, status: "TOOLCHAIN_UNAVAILABLE"},
  ];

  for (const {options, status} of cases) {
    const {preflight, calls} = createHarness(options);
    assert.deepEqual(await preflight.availability({deviceId: PROFILE.id}), {ok: false, status});
    assert.deepEqual(calls.secrets, []);
    assert.deepEqual(calls.adapter, []);
  }
});

test("prepare blocks an absent MyTV app before exposing a runtime configuration", async () => {
  const {preflight, calls} = createHarness({apps: []});

  await assert.rejects(
    preflight.prepare({deviceId: PROFILE.id}),
    (error) => error.code === "APP_NOT_INSTALLED"
      && !/host-value|passphrase-value|private\/toolchain/i.test(error.message),
  );
  assert.deepEqual(calls.secrets, [[PROFILE.id, "host"], [PROFILE.id, "passphrase"]]);
  assert.deepEqual(calls.adapter, [
    ["deviceInfo", {deviceName: PROFILE.vendorDeviceName}],
    ["listApps", {deviceName: PROFILE.vendorDeviceName}],
  ]);
});

test("prepare classifies read-only mismatches and failures without runtime details", async () => {
  const cases = [
    {options: {host: ""}, status: "SAVED_CONNECTION_REQUIRED"},
    {options: {compatibility: "unverified"}, status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
    {options: {info: {model: "other-model", firmware: PROFILE.firmwareVersion}}, status: "DEVICE_MISMATCH"},
    {options: {adapterError: new Error("host-value passphrase-value /private/toolchain")}, status: "CONNECTION_UNAVAILABLE"},
  ];

  for (const {options, status} of cases) {
    const {preflight} = createHarness(options);
    await assert.rejects(
      preflight.prepare({deviceId: PROFILE.id}),
      (error) => error.code === status
        && !/host-value|passphrase-value|private\/toolchain/i.test(error.message),
    );
  }
});

test("prepare returns a frozen private runtime only after fresh read-only verification", async () => {
  const {preflight, calls} = createHarness();

  const result = await preflight.prepare({deviceId: PROFILE.id});

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.runtime), true);
  assert.equal(Object.isFrozen(result.runtime.connection), true);
  assert.deepEqual(result.runtime.connection, {
    deviceName: PROFILE.vendorDeviceName,
    deviceHost: "host-value",
    chromedriverPath: TOOLCHAIN.chromedriverPath,
    remoteOnly: false,
    rcMode: "rc",
  });
  assert.deepEqual(result.runtime.appium, {
    port: 4727,
    appiumHome: TOOLCHAIN.appiumHome,
    appiumBin: TOOLCHAIN.appiumBin,
  });
  assert.deepEqual(result.runtime.transport, {
    secureWebsocket: true,
    allowSelfSignedTls: true,
  });
  assert.equal(result.redactionSecrets.includes("host-value"), true);
  assert.equal(result.redactionSecrets.includes("passphrase-value"), true);
  assert.equal(result.redactionSecrets.includes(TOOLCHAIN.chromedriverPath), true);
  assert.deepEqual(await preflight.availability({deviceId: PROFILE.id}), {ok: true, status: "READY"});
  assert.equal(calls.adapter.length, 2);
});
