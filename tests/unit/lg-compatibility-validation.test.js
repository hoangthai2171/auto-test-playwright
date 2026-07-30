"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {createLgCompatibilityValidation} = require("../../app/lg-compatibility-validation");

const CASE = Object.freeze({id: "case-1", actions: [{type: "open_home"}]});

function createHarness({info = {model: "model-a", firmware: "firmware-a"}, runCaseError} = {}) {
  const calls = [];
  const validator = createLgCompatibilityValidation({
    attempts: {
      async takeForValidation({attemptId}) {
        calls.push(["take", attemptId]);
        return attemptId === "attempt-1"
          ? {ok: true, attempt: {host: "192.0.2.10", passphrase: "runtime-only", model: "model-a", firmware: "firmware-a", artifact: {version: "2.36"}}}
          : {ok: false, status: "ATTEMPT_NOT_FOUND"};
      },
      async discard({attemptId}) { calls.push(["discard", attemptId]); },
    },
    temporaryTarget: {
      async acquire({host, passphrase}) {
        calls.push(["target-created", host, passphrase]);
        return {
          ok: true,
          targetName: "lgcompat-a1",
          async release() { calls.push(["target-removed"]); },
        };
      },
    },
    adapter: {
      async deviceInfo({deviceName}) {
        calls.push(["identity-rechecked", deviceName]);
        return info;
      },
    },
    downloadArtifact: async ({artifact, destination}) => {
      calls.push(["downloaded", artifact.version, destination]);
      return "/tmp/lgcompat/driver.zip";
    },
    verifyArchive: async ({archivePath, artifact}) => {
      calls.push(["archive-verified", archivePath, artifact.version]);
      return true;
    },
    extractChromeDriver: async ({archivePath, destination}) => {
      calls.push(["driver-extracted", archivePath, destination]);
    },
    verifyChromeDriver: async ({chromedriverRoot, version}) => {
      calls.push(["driver-verified", chromedriverRoot, version]);
      return true;
    },
    runCase: async ({testCase, connection, model, firmware}) => {
      calls.push(["case-run-once", testCase.id, connection.deviceName, model, firmware]);
      if (runCaseError) throw runCaseError;
    },
    createTempDir: async () => {
      calls.push(["temporary-driver-created"]);
      return "/tmp/lgcompat";
    },
    removeTempDir: async (root) => { calls.push(["temporary-driver-removed", root]); },
    platform: "darwin",
  });
  return {validator, calls};
}

test("does not consume an attempt or download before validation confirmation", async () => {
  const {validator, calls} = createHarness();

  assert.deepEqual(await validator.validate({attemptId: "attempt-1", testCase: CASE}), {
    ok: false,
    status: "VALIDATION_CONFIRMATION_REQUIRED",
  });
  assert.deepEqual(calls, []);
});

test("uses one verified temporary driver and one selected case, then removes all temporary resources", async () => {
  const {validator, calls} = createHarness();

  assert.deepEqual(await validator.validate({attemptId: "attempt-1", confirmed: true, testCase: CASE}), {
    ok: true,
    status: "VALIDATION_PASSED",
  });
  assert.deepEqual(calls.map(([name]) => name), [
    "take",
    "temporary-driver-created",
    "downloaded",
    "archive-verified",
    "driver-extracted",
    "driver-verified",
    "target-created",
    "identity-rechecked",
    "case-run-once",
    "target-removed",
    "temporary-driver-removed",
    "discard",
  ]);
});

test("returns a fixed mismatch failure without a second case attempt or private connection data", async () => {
  const {validator, calls} = createHarness({info: {model: "model-a", firmware: "firmware-b"}});

  const result = await validator.validate({attemptId: "attempt-1", confirmed: true, testCase: CASE});

  assert.deepEqual(result, {ok: false, status: "DEVICE_IDENTITY_MISMATCH"});
  assert.equal(calls.filter(([name]) => name === "case-run-once").length, 0);
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|runtime-only|lgcompat-a1/i);
  assert.deepEqual(calls.slice(-3).map(([name]) => name), ["target-removed", "temporary-driver-removed", "discard"]);
});

test("returns a fixed case failure without retry and removes the temporary target", async () => {
  const {validator, calls} = createHarness({runCaseError: new Error("case failed")});

  assert.deepEqual(await validator.validate({attemptId: "attempt-1", confirmed: true, testCase: CASE}), {
    ok: false,
    status: "VALIDATION_FAILED",
  });
  assert.equal(calls.filter(([name]) => name === "case-run-once").length, 1);
  assert.deepEqual(calls.slice(-3).map(([name]) => name), ["target-removed", "temporary-driver-removed", "discard"]);
});
