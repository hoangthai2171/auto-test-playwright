"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {registerLgCompatibilityIpc} = require("../../app/lg-compatibility-ipc");

function createHarness() {
  const handlers = new Map();
  const calls = [];
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect(request) {
        calls.push(["inspect", request]);
        return {ok: true, status: "COMPATIBILITY_VERIFIED", attemptId: "attempt-a1", model: "model-a", firmware: "firmware-a"};
      },
      async discard(request) { calls.push(["discard", request]); return {ok: true}; },
    },
    validation: {
      async validate(request) {
        calls.push(["validate", request]);
        return {ok: true, status: "VALIDATION_PASSED", host: "192.0.2.10", archivePath: "/tmp/private"};
      },
    },
    loadTrustedCase: async (request) => {
      calls.push(["load", request]);
      return {id: "case-1", actions: [{type: "open_home"}]};
    },
    redact: (value) => String(value).replaceAll("192.0.2.10", "[host]"),
  });
  return {handlers, calls};
}

test("inspection refuses unconfirmed input and never publishes connection values", async () => {
  const {handlers, calls} = createHarness();

  const result = await handlers.get("inspect-lg-compatibility-device")(undefined, {
    confirmed: false,
    label: "Lab",
    host: "192.0.2.10",
    passphrase: "runtime-only",
  });

  assert.deepEqual(result, {ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED"});
  assert.deepEqual(calls, []);
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|runtime-only/i);
});

test("validation loads one selected case in main and sends only an opaque attempt ID to the validator", async () => {
  const {handlers, calls} = createHarness();

  const result = await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "case-1",
    folderId: "folder-1",
    host: "192.0.2.10",
    passphrase: "runtime-only",
  });

  assert.deepEqual(result, {ok: true, status: "VALIDATION_PASSED"});
  assert.deepEqual(calls, [
    ["load", {selectedCaseId: "case-1", folderId: "folder-1"}],
    ["validate", {attemptId: "attempt-a1", confirmed: true, testCase: {id: "case-1", actions: [{type: "open_home"}]}}],
  ]);
  assert.doesNotMatch(JSON.stringify({result, calls: calls.filter(([name]) => name === "validate")}), /192\.0\.2\.10|runtime-only|\/tmp\/private/i);
});

test("an unavailable selected case discards the in-memory attempt without validating", async () => {
  const {handlers, calls} = createHarness();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard(request) { calls.push(["discard", request]); return {ok: true}; },
    },
    validation: {async validate() { calls.push(["validate"]); return {ok: true}; }},
    loadTrustedCase: async () => null,
    redact: (value) => String(value),
  });

  assert.deepEqual(await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "missing",
  }), {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"});
  assert.deepEqual(calls, [["discard", {attemptId: "attempt-a1"}]]);
});

test("discard exposes no attempt information", async () => {
  const {handlers, calls} = createHarness();

  assert.deepEqual(await handlers.get("discard-lg-compatibility-attempt")(undefined, {attemptId: "attempt-a1"}), {ok: true});
  assert.deepEqual(calls, [["discard", {attemptId: "attempt-a1"}]]);
});
