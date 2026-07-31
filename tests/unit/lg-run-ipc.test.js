"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {registerLgRunIpc} = require("../../app/lg-run-ipc");

function createHarness() {
  const handlers = new Map();
  const calls = [];
  registerLgRunIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    batchRunner: {
      async availability(request) { calls.push(["availability", request]); return {ok: true, status: "READY", host: "private-host"}; },
      async start(request) {
        calls.push(["start", request]);
        request.onEvent({code: "preflight", host: "private-host"});
        request.onEvent({code: "unexpected", message: "raw details"});
        request.onFrame("data:image/png;base64,ZmFrZQ==");
        request.onFrame("/private/frame.png");
        return {ok: true, caseRuns: [], stopped: false, runtime: {host: "private-host"}};
      },
      async resolveRecovery(request) { calls.push(["recovery", request]); return {ok: true, host: "private-host"}; },
    },
    redact: (value) => String(value).replaceAll("private-host", "[REDACTED]"),
  });
  return {handlers, calls};
}

test("forwards only the narrow batch payload and filters renderer events", async () => {
  const {handlers, calls} = createHarness();
  const sent = [];
  const sender = {send(channel, payload) { sent.push([channel, payload]); }};
  const result = await handlers.get("run-lg-batch")({sender}, {
    deviceId: "lg-1", selectedCaseIds: ["1", "1", "2"], folderId: "folder-1", confirmed: true,
    host: "private-host", passphrase: "private-passphrase", chromedriverPath: "/private/path", appium: {port: 1}, password: "private-password",
  });

  assert.deepEqual(calls[0], ["start", {deviceId: "lg-1", selectedCaseIds: ["1", "2"], folderId: "folder-1", confirmed: true, onEvent: calls[0][1].onEvent, onFrame: calls[0][1].onFrame}]);
  assert.deepEqual(sent, [
    ["lg-run-status", {code: "preflight"}],
    ["lg-run-preview", "data:image/png;base64,ZmFrZQ=="],
  ]);
  assert.deepEqual(result, {ok: true, caseRuns: [], stopped: false});
  assert.doesNotMatch(JSON.stringify({calls, sent, result}), /private-host|private-passphrase|private-password|\/private/i);
});

test("rejects invalid requests, unknown recovery, and concurrent batches", async () => {
  const {handlers} = createHarness();
  assert.deepEqual(await handlers.get("run-lg-batch")({}, {deviceId: "lg-1", selectedCaseIds: [], confirmed: true}), {ok: false, status: "LG_BATCH_INVALID"});
  assert.deepEqual(await handlers.get("run-lg-batch")({}, {deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: false}), {ok: false, status: "LG_CONFIRMATION_REQUIRED"});
  assert.deepEqual(await handlers.get("resolve-lg-run-recovery")({}, {action: "unexpected"}), {ok: false, status: "LG_RECOVERY_INVALID"});
});

test("uses the same narrow selected device request for local availability", async () => {
  const {handlers, calls} = createHarness();
  const result = await handlers.get("get-lg-run-availability")({}, {deviceId: "lg-1", host: "private-host", selectedCaseIds: ["1"]});
  assert.deepEqual(calls, [["availability", {deviceId: "lg-1", selectedCaseIds: ["1"]}]]);
  assert.deepEqual(result, {ok: true, status: "READY"});
});
