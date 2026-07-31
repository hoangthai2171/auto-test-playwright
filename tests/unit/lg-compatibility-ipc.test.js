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
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save(request) { calls.push(["save", request]); return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase(credentials) {
      calls.push(["case", credentials]);
      return {id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]};
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

test("validation uses the local product-gate case and sends only an opaque attempt ID to the validator", async () => {
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
    ["case", {username: "account", password: "secret"}],
    ["validate", {attemptId: "attempt-a1", confirmed: true, testCase: {id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]}}],
  ]);
  assert.doesNotMatch(JSON.stringify({result, calls: calls.filter(([name]) => name === "validate")}), /192\.0\.2\.10|runtime-only|\/tmp\/private/i);
});

test("publishes a fixed unsupported-case result without transient connection details", async () => {
  const {handlers, calls} = createHarness();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard(request) { calls.push(["discard", request]); return {ok: true}; },
    },
    validation: {
      async validate(request) {
        calls.push(["validate", request]);
        return {ok: false, status: "LG_COMPATIBILITY_CASE_UNSUPPORTED", host: "192.0.2.10"};
      },
    },
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase: () => ({id: "lg-compatibility-product-gate", actions: [{action: "focus_row", rowName: "Thịnh hành"}]}),
    redact: (value) => String(value).replaceAll("192.0.2.10", "[host]"),
  });

  const result = await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "case-unsupported",
  });

  assert.deepEqual(result, {ok: false, status: "LG_COMPATIBILITY_CASE_UNSUPPORTED"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10/i);
});

test("publishes the failed compatibility action without transient connection details", async () => {
  const {handlers} = createHarness();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard() { return {ok: true}; },
    },
    validation: {
      async validate() {
        return {ok: false, status: "VALIDATION_FAILED", failedAction: "wait_for_ready", failureCode: "TV_RUN_FAILED", failureStage: "case-started", host: "192.0.2.10"};
      },
    },
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase: () => ({id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]}),
    redact: (value) => String(value).replaceAll("192.0.2.10", "[host]"),
  });

  const result = await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "ignored",
  });

  assert.deepEqual(result, {ok: false, status: "VALIDATION_FAILED", failedAction: "wait_for_ready", failureCode: "TV_RUN_FAILED", failureStage: "case-started"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|secret/i);
});

test("publishes a failed compatibility validation preparation stage", async () => {
  const {handlers} = createHarness();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard() { return {ok: true}; },
    },
    validation: {
      async validate() {
        return {ok: false, status: "VALIDATION_FAILED", failureStage: "chromedriver-download", host: "192.0.2.10"};
      },
    },
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase: () => ({id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]}),
    redact: (value) => String(value),
  });

  const result = await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "ignored",
  });

  assert.deepEqual(result, {ok: false, status: "VALIDATION_FAILED", failureStage: "chromedriver-download"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|secret/i);
});

test("preserves a safe thrown validation failure code and stage instead of collapsing to a generic result", async () => {
  const handlers = new Map();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard() { return {ok: true}; },
    },
    validation: {
      async validate() {
        const error = new Error("session failed");
        error.code = "TV_RUN_FAILED";
        error.failureCode = "APPIUM_CAPABILITY_AUTOMATION_NAME";
        error.lifecycleStage = "session-creating";
        throw error;
      },
    },
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase: () => ({id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]}),
    redact: (value) => String(value),
  });

  const result = await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "ignored",
  });

  assert.deepEqual(result, {
    ok: false,
    status: "VALIDATION_FAILED",
    failureCode: "TV_RUN_FAILED",
    appiumFailureCode: "APPIUM_CAPABILITY_AUTOMATION_NAME",
    failureStage: "session-creating",
  });
});

test("uses the fixed local product-gate case instead of a selected API case", async () => {
  const handlers = new Map();
  const calls = [];
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard(request) { calls.push(["discard", request]); return {ok: true}; },
    },
    validation: {
      async validate(request) { calls.push(["validate", request]); return {ok: true, status: "VALIDATION_PASSED"}; },
    },
    compatibilityCredentials: {
      async status() { return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async save(request) { calls.push(["save", request]); return {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"}; },
      async load() { return {username: "account", password: "secret"}; },
    },
    createProductGateCase(credentials) {
      calls.push(["case", credentials]);
      return {id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]};
    },
    redact: (value) => String(value),
  });

  assert.deepEqual(await handlers.get("get-lg-compatibility-product-gate-status")(), {
    ok: true,
    status: "LG_COMPATIBILITY_CREDENTIALS_SAVED",
  });
  assert.deepEqual(await handlers.get("save-lg-compatibility-product-gate-credentials")(undefined, {
    username: "account",
    password: "secret",
  }), {ok: true, status: "LG_COMPATIBILITY_CREDENTIALS_SAVED"});
  assert.deepEqual(await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "ignored-api-case",
  }), {ok: true, status: "VALIDATION_PASSED"});
  assert.deepEqual(calls, [
    ["save", {username: "account", password: "secret"}],
    ["case", {username: "account", password: "secret"}],
    ["validate", {attemptId: "attempt-a1", confirmed: true, testCase: {id: "lg-compatibility-product-gate", actions: [{action: "open_home"}]}}],
  ]);
});

test("missing local credentials discard the in-memory attempt without validating", async () => {
  const {handlers, calls} = createHarness();
  registerLgCompatibilityIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    attempts: {
      async inspect() { throw new Error("must not inspect"); },
      async discard(request) { calls.push(["discard", request]); return {ok: true}; },
    },
    validation: {async validate() { calls.push(["validate"]); return {ok: true}; }},
    compatibilityCredentials: {
      async status() { return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"}; },
      async save() { return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"}; },
      async load() { return undefined; },
    },
    createProductGateCase: () => { throw new Error("must not create case"); },
    redact: (value) => String(value),
  });

  assert.deepEqual(await handlers.get("run-lg-compatibility-validation")(undefined, {
    confirmed: true,
    attemptId: "attempt-a1",
    selectedCaseId: "ignored",
  }), {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"});
  assert.deepEqual(calls, [["discard", {attemptId: "attempt-a1"}]]);
});

test("discard exposes no attempt information", async () => {
  const {handlers, calls} = createHarness();

  assert.deepEqual(await handlers.get("discard-lg-compatibility-attempt")(undefined, {attemptId: "attempt-a1"}), {ok: true});
  assert.deepEqual(calls, [["discard", {attemptId: "attempt-a1"}]]);
});
