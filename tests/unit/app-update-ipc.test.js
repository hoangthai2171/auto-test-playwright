"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {registerAppUpdateIpc} = require("../../app/app-update-ipc");

function register({service, canInstall, resolveTimeoutMs} = {}) {
  const handlers = new Map();
  const sent = [];
  registerAppUpdateIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    appUpdateService: service,
    ...(canInstall ? {canInstall} : {}),
    ...(resolveTimeoutMs ? {resolveTimeoutMs} : {}),
  });
  const event = {sender: {send(channel, value) { sent.push([channel, value]); }}};
  return {handlers, sent, event};
}

test("requires an ipcMain implementation", () => {
  assert.throws(() => registerAppUpdateIpc({}), /ipcMain.handle implementation is required/u);
});

test("passes the normalized timeout and returns only release metadata", async () => {
  const requests = [];
  const {handlers} = register({
    service: {
      async check(request) {
        requests.push(request);
        return {
          ok: true,
          updateAvailable: true,
          currentVersion: "1.0.9",
          version: "1.1.0",
          releaseName: "MyTV Auto Test 1.1.0",
          changelog: ["Thêm mục Check for updates"],
          mandatory: false,
          downloadSize: 1024,
          fileName: "Setup.exe",
          artifact: {url: "http://172.16.240.254:30100/files/Setup.exe", sha256: "a".repeat(64)},
        };
      },
    },
    resolveTimeoutMs: (seconds) => seconds * 1000,
  });

  const result = await handlers.get("check-app-update")({}, {apiDomain: "http://172.16.240.254:30100", authorization: "token", timeoutSeconds: 30});
  assert.deepEqual(requests, [{apiDomain: "http://172.16.240.254:30100", authorization: "token", timeoutMs: 30000}]);
  assert.deepEqual(result, {
    ok: true,
    updateAvailable: true,
    currentVersion: "1.0.9",
    version: "1.1.0",
    releaseName: "MyTV Auto Test 1.1.0",
    changelog: ["Thêm mục Check for updates"],
    mandatory: false,
    downloadSize: 1024,
  });
});

test("reports an up-to-date build without release fields", async () => {
  const {handlers} = register({
    service: {async check() { return {ok: true, updateAvailable: false, currentVersion: "1.0.9", version: "1.0.9"}; }},
  });
  assert.deepEqual(await handlers.get("check-app-update")({}, {}), {
    ok: true,
    updateAvailable: false,
    currentVersion: "1.0.9",
    version: "1.0.9",
  });
});

test("maps unknown and thrown check failures to a single failed status", async () => {
  const unknown = register({service: {async check() { return {ok: false, status: "SOMETHING_ELSE"}; }}});
  assert.deepEqual(await unknown.handlers.get("check-app-update")({}, {}), {ok: false, status: "UPDATE_CHECK_FAILED"});

  const known = register({service: {async check() { return {ok: false, status: "UPDATE_ARTIFACT_UNTRUSTED"}; }}});
  assert.deepEqual(await known.handlers.get("check-app-update")({}, {}), {ok: false, status: "UPDATE_ARTIFACT_UNTRUSTED"});

  const thrown = register({service: {async check() { throw new Error("boom"); }}});
  assert.deepEqual(await thrown.handlers.get("check-app-update")({}, {}), {ok: false, status: "UPDATE_CHECK_FAILED"});

  const missing = register({});
  assert.deepEqual(await missing.handlers.get("check-app-update")({}, {}), {ok: false, status: "UPDATE_CHECK_UNAVAILABLE"});
});

test("installs only a confirmed request and forwards the requested version", async () => {
  const requests = [];
  const {handlers, event} = register({
    service: {async install(request) { requests.push(request.version); return {ok: true, status: "UPDATE_INSTALL_STARTED"}; }},
  });

  assert.deepEqual(await handlers.get("install-app-update")(event, {version: "1.1.0"}), {ok: false, status: "UPDATE_INSTALL_FAILED"});
  assert.deepEqual(requests, []);
  assert.deepEqual(await handlers.get("install-app-update")(event, {confirmed: true, version: "1.1.0"}), {ok: true, status: "UPDATE_INSTALL_STARTED"});
  assert.deepEqual(requests, ["1.1.0"]);
});

test("blocks an install while a run is active or results are unsynced", async () => {
  let installs = 0;
  const {handlers, event} = register({
    service: {async install() { installs += 1; return {ok: true}; }},
    canInstall: () => false,
  });
  assert.deepEqual(await handlers.get("install-app-update")(event, {confirmed: true, version: "1.1.0"}), {ok: false, status: "UPDATE_BLOCKED_BY_RUN"});
  assert.equal(installs, 0);
});

test("treats a throwing run check as blocking", async () => {
  const {handlers, event} = register({
    service: {async install() { return {ok: true}; }},
    canInstall: () => { throw new Error("unavailable"); },
  });
  assert.deepEqual(await handlers.get("install-app-update")(event, {confirmed: true, version: "1.1.0"}), {ok: false, status: "UPDATE_BLOCKED_BY_RUN"});
});

test("forwards bounded progress and drops unknown codes and extra fields", async () => {
  const {handlers, sent, event} = register({
    service: {
      async install({onProgress}) {
        onProgress({code: "downloading", percent: 42.6, receivedBytes: 10, totalBytes: 100, url: "http://internal/Setup.exe"});
        onProgress({code: "downloading", percent: 512});
        onProgress({code: "verifying", archivePath: "/userData/app-updates/abc/Setup.exe"});
        onProgress({code: "installing"});
        onProgress({code: "sniffing"});
        onProgress({code: "failed", status: "UPDATE_VERIFICATION_FAILED"});
        onProgress({code: "failed", status: "LEAKED_INTERNAL"});
        onProgress({code: "complete"});
        return {ok: true, status: "UPDATE_INSTALL_STARTED", archivePath: "/userData/app-updates/abc/Setup.exe"};
      },
    },
  });

  const result = await handlers.get("install-app-update")(event, {confirmed: true, version: "1.1.0"});
  assert.deepEqual(result, {ok: true, status: "UPDATE_INSTALL_STARTED"});
  assert.deepEqual(sent.map(([channel]) => channel), Array(7).fill("app-update-progress"));
  assert.deepEqual(sent.map(([, value]) => value), [
    {code: "downloading", percent: 43, receivedBytes: 10, totalBytes: 100},
    {code: "downloading", percent: 100, receivedBytes: 0, totalBytes: 0},
    {code: "verifying"},
    {code: "installing"},
    {code: "failed", status: "UPDATE_VERIFICATION_FAILED"},
    {code: "failed", status: "UPDATE_INSTALL_FAILED"},
    {code: "complete"},
  ]);
});

test("maps unknown and thrown install failures without exposing paths", async () => {
  const unknown = register({service: {async install() { return {ok: false, status: "WHATEVER", archivePath: "/userData/app-updates/abc/Setup.exe"}; }}});
  assert.deepEqual(await unknown.handlers.get("install-app-update")(unknown.event, {confirmed: true, version: "1.1.0"}), {ok: false, status: "UPDATE_INSTALL_FAILED"});

  const thrown = register({service: {async install() { throw new Error("boom"); }}});
  assert.deepEqual(await thrown.handlers.get("install-app-update")(thrown.event, {confirmed: true, version: "1.1.0"}), {ok: false, status: "UPDATE_INSTALL_FAILED"});

  const unsupported = register({service: {async install() { return {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED", archivePath: "/staged/Setup.exe"}; }}});
  assert.deepEqual(await unsupported.handlers.get("install-app-update")(unsupported.event, {confirmed: true, version: "1.1.0"}), {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED"});
});

test("cancelling drops the pending update and never throws", async () => {
  let cancelled = 0;
  const {handlers} = register({service: {cancel() { cancelled += 1; }}});
  assert.deepEqual(await handlers.get("cancel-app-update")({}), {ok: true});
  assert.equal(cancelled, 1);

  const failing = register({service: {cancel() { throw new Error("boom"); }}});
  assert.deepEqual(await failing.handlers.get("cancel-app-update")({}), {ok: true});
});

test("treats the renderer's timeout as seconds so a 30s setting is not an 8-hour wait", async () => {
  const {normalizeTimeoutMs} = require("../../app/flow-case-api");
  const requests = [];
  const {handlers} = register({
    service: {async check(request) { requests.push(request.timeoutMs); return {ok: true, updateAvailable: false, currentVersion: "1.0.9", version: "1.0.9"}; }},
    resolveTimeoutMs: normalizeTimeoutMs,
  });
  await handlers.get("check-app-update")({}, {apiDomain: "http://172.16.240.254:30100", timeoutSeconds: 30});
  await handlers.get("check-app-update")({}, {apiDomain: "http://172.16.240.254:30100"});
  assert.deepEqual(requests, [30000, 30000]);
});
