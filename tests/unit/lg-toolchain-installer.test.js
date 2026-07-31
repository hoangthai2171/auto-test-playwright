"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgToolchainInstaller} = require("../../app/lg-toolchain-installer");

function createInstaller({state = "missing"} = {}) {
  const calls = [];
  const installer = createLgToolchainInstaller({
    detector: {
      async inspect() {
        calls.push("inspect");
        return {
          source: "managed",
          state,
          managedRoot: "/user-data/lg-toolchain",
          components: [
            {id: "node", label: "Node.js and npm", status: state === "ready" ? "ready" : "missing", version: "24.18.0", path: "/user-data/lg-toolchain/node"},
            {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4", path: "/user-data/lg-toolchain/webos-cli"},
          ],
        };
      },
    },
    installManagedBundle: async () => {
      calls.push("install");
      return {ok: true};
    },
  });
  return {installer, calls};
}

test("returns a redacted installation review without staging or installation", async () => {
  const {installer, calls} = createInstaller();

  const review = await installer.plan();

  assert.deepEqual(review, {
    ok: true,
    state: "installable",
    components: [
      {id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"},
      {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4"},
    ],
  });
  assert.deepEqual(calls, ["inspect"]);
  assert.doesNotMatch(JSON.stringify(review), /\/user-data\/|https?:\/\//);
});

test("requires explicit confirmation before it invokes managed installation", async () => {
  const {installer, calls} = createInstaller();

  const result = await installer.install({confirmed: false});

  assert.deepEqual(result, {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"});
  assert.deepEqual(calls, []);
});

test("preserves a safe managed-install failure code", async () => {
  const installer = createLgToolchainInstaller({
    detector: {async inspect() {
      return {state: "missing", components: []};
    }},
    async installManagedBundle() {
      return {ok: false, status: "DOWNLOAD_FAILED"};
    },
  });

  assert.deepEqual(await installer.install({confirmed: true}), {ok: false, status: "DOWNLOAD_FAILED"});
});

test("preserves a safe component verification result", async () => {
  const installer = createLgToolchainInstaller({
    detector: {async inspect() {
      return {state: "missing", components: []};
    }},
    async installManagedBundle() {
      return {ok: false, status: "VERIFICATION_FAILED", verification: "LG_DRIVER_UNVERIFIED"};
    },
  });

  assert.deepEqual(await installer.install({confirmed: true}), {
    ok: false,
    status: "VERIFICATION_FAILED",
    verification: "LG_DRIVER_UNVERIFIED",
  });
});

test("passes only the pinned bundle and immutable npm closure to confirmed installation", async () => {
  const calls = [];
  const installer = createLgToolchainInstaller({
    detector: {async inspect() {
      calls.push("inspect");
      return {
        state: "missing",
        managedRoot: "/user-data/lg-toolchain",
        components: [{id: "node", path: "/user-data/lg-toolchain/node"}],
      };
    }},
    async installManagedBundle(input) {
      calls.push(["install", input]);
      return {ok: false};
    },
  });

  await installer.install({confirmed: true});

  assert.equal(calls[1][0], "install");
  const input = calls[1][1];
  assert.deepEqual(Object.keys(input).sort(), ["bundle", "npmClosure"]);
  assert.equal(input.bundle.components.node.version, "24.18.0");
  assert.equal(input.npmClosure.packages[""].dependencies.appium, "2.19.0");
  assert.equal(input.npmClosure.packages[""].dependencies["appium-lg-webos-driver"], "0.5.0");
  assert.doesNotMatch(JSON.stringify(input), /\/user-data\//);
});

test("forwards the confirmed install progress observer without exposing review data", async () => {
  let received;
  const events = [];
  const installer = createLgToolchainInstaller({
    detector: {async inspect() { return {state: "missing", components: []}; }},
    async installManagedBundle(input) {
      received = input;
      input.onProgress({code: "installing-appium"});
      return {ok: false, status: "DEPENDENCY_INSTALL_FAILED"};
    },
  });

  assert.deepEqual(await installer.install({
    confirmed: true,
    onProgress: (event) => events.push(event),
  }), {ok: false, status: "DEPENDENCY_INSTALL_FAILED"});
  assert.equal(typeof received.onProgress, "function");
  assert.deepEqual(events, [{code: "installing-appium"}]);
  assert.deepEqual(Object.keys(received).sort(), ["bundle", "npmClosure", "onProgress"]);
});

test("uses the matching catalog artifact instead of the historical fixed ChromeDriver", async () => {
  const installed = [];
  const artifact = {
    version: "120.0",
    url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/mac-arm64/chromedriver-mac-arm64.zip",
    archiveName: "chromedriver-mac-arm64.zip",
    sha256: "a".repeat(64),
  };
  const installer = createLgToolchainInstaller({
    platform: "darwin",
    detector: {async inspect() { return {state: "missing", components: []}; }},
    async installManagedBundle(input) { installed.push(input); return {ok: true}; },
  });

  await installer.install({confirmed: true, chromedriverArtifact: artifact});

  assert.equal(installed[0].bundle.components.chromedriver.version, "120.0");
  assert.equal(installed[0].includeChromeDriver, true);
});
