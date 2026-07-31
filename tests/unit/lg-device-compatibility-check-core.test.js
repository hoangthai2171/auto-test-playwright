"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyCompatibilityProfile,
  buildCandidateGateArgs,
  parseCompatibilityCandidate,
} = require("../../scripts/real-tv-appium/lg-device-compatibility-check-core");
const {
  recordCandidate,
  validateCandidate,
} = require("../../scripts/real-tv-appium/lg-device-compatibility-check");

const validCandidate = {
  model: "LG-TEST-MODEL",
  firmware: "1.2.3",
  chromedriver: {
    darwin: {
      version: "120.0.0",
      url: "https://storage.googleapis.com/chrome-for-testing-public/120.0.0/mac-arm64/chromedriver-mac-arm64.zip",
      archiveName: "chromedriver-mac-arm64.zip",
      sha256: "a".repeat(64),
    },
    win32: {
      version: "120.0.0",
      url: "https://storage.googleapis.com/chrome-for-testing-public/120.0.0/win64/chromedriver-win64.zip",
      archiveName: "chromedriver-win64.zip",
      sha256: "b".repeat(64),
    },
  },
};

test("requires both audited platform artifacts before a live candidate can start", () => {
  assert.throws(
    () => parseCompatibilityCandidate({...validCandidate, chromedriver: {darwin: validCandidate.chromedriver.darwin}}),
    /win32/i,
  );
});

test("refuses to record a passed candidate without final confirmation", () => {
  assert.throws(
    () => applyCompatibilityProfile({catalog: {profiles: []}, candidate: validCandidate, confirmed: false}),
    /confirmation/i,
  );
});

test("requires separate update confirmation before replacing an existing pair", () => {
  assert.throws(
    () => applyCompatibilityProfile({catalog: {profiles: [validCandidate]}, candidate: validCandidate, confirmed: true}),
    /update confirmation/i,
  );
});

test("replaces an existing pair only after explicit update confirmation", () => {
  const replacement = structuredClone(validCandidate);
  replacement.chromedriver.darwin.version = "121.0.0";
  replacement.chromedriver.darwin.url = "https://storage.googleapis.com/chrome-for-testing-public/121.0.0/mac-arm64/chromedriver-mac-arm64.zip";
  const result = applyCompatibilityProfile({
    catalog: {profiles: [validCandidate]},
    candidate: replacement,
    confirmed: true,
    replaceExisting: true,
  });

  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0].chromedriver.darwin.version, "121.0.0");
});

test("builds a gate command without host or credential values", () => {
  const args = buildCandidateGateArgs({
    candidate: validCandidate,
    runtime: {
      deviceName: "registered-device",
      chromedriverPath: "/temporary/chromedriver",
      model: validCandidate.model,
      searchName: "known title",
      contentType: "content",
      runtimeRoot: "/project/runtime",
    },
  });

  assert.deepEqual(args.slice(0, 2), ["scripts/real-tv-appium/lg-webos-case-runner.js", "--device"]);
  assert.doesNotMatch(JSON.stringify(args), /host|password|passphrase/i);
});

test("record mode requires explicit confirmation after a previously passed validation", async () => {
  const result = await recordCandidate({catalog: {profiles: []}, candidate: validCandidate, confirmed: false});

  assert.deepEqual(result, {ok: false, status: "RECORD_CONFIRMATION_REQUIRED"});
});

test("record mode requires separate update confirmation for an existing device and firmware", async () => {
  const result = await recordCandidate({catalog: {profiles: [validCandidate]}, candidate: validCandidate, confirmed: true});

  assert.deepEqual(result, {ok: false, status: "UPDATE_CONFIRMATION_REQUIRED"});
});

test("candidate validation cleans temporary extraction when the product gate fails", async () => {
  const calls = [];
  const result = await validateCandidate({
    candidate: validCandidate,
    platform: "darwin",
    createTempDir: async () => "/temporary/candidate",
    removeTempDir: async () => calls.push("removed"),
    downloadArtifact: async () => "/temporary/candidate/archive.zip",
    verifyArchive: async () => true,
    extractChromeDriver: async () => "/temporary/candidate/chromedriver",
    verifyChromeDriver: async () => true,
    readDeviceInfo: async () => ({model: validCandidate.model, firmware: validCandidate.firmware}),
    runGate: async () => ({ok: false}),
    runtime: {
      deviceName: "registered-device",
      deviceHost: "runtime-value",
      searchName: "known title",
      contentType: "content",
      runtimeRoot: "/project/runtime",
    },
  });

  assert.deepEqual(result, {ok: false, status: "PRODUCT_GATE_FAILED"});
  assert.deepEqual(calls, ["removed"]);
});
