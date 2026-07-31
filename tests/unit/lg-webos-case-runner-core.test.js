"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createLgProductGateCase,
  createLgProductGateEvidenceWriter,
  createLgProductGateManifest,
  finalizeLgProductGateManifest,
  parseLgCaseRunnerArgs,
  requestLoopbackAppium,
  runLgProductGateWithEvidence,
  withoutLgProductGateCredentials,
} = require("../../scripts/real-tv-appium/lg-webos-case-runner-core");

test("creates the credentialed LG product gate from runtime values only", () => {
  const testCase = createLgProductGateCase({
    username: "runtime-user",
    password: "runtime-password",
    searchName: "VTV3 HD",
    contentType: "channel",
  });

  assert.equal(testCase.id, "lg-product-gate");
  assert.deepEqual(testCase.actions.map((action) => action.action), ["login", "open_home", "open_search", "search_content", "play_search_result"]);
  assert.equal(testCase.actions[3].name, "VTV3 HD");
  assert.equal(testCase.actions[3].type, "channel");
  assert.equal(Object.hasOwn(testCase, "host"), false);
});

test("accepts only an explicit LG product-gate runtime configuration", () => {
  const args = parseLgCaseRunnerArgs([
    "--device", "LG2022",
    "--host", "runtime-tv.invalid",
    "--model", "55QNED80SRA",
    "--app-id", "com.mytvb2c.app",
    "--chromedriver", "/runtime/chromedriver",
    "--search-name", "VTV3 HD",
    "--content-type", "channel",
    "--secure-websocket",
    "--allow-self-signed-tls",
  ]);

  assert.equal(args["content-type"], "channel");
  assert.throws(() => parseLgCaseRunnerArgs(["--skip-screenshot-gate"]), /does not support/i);
});

test("removes LG product credentials before creating vendor subprocess environments", () => {
  assert.deepEqual(withoutLgProductGateCredentials({
    PATH: "/usr/bin",
    MYTV_LG_TEST_USERNAME: "runtime-user",
    MYTV_LG_TEST_PASSWORD: "runtime-password",
  }), {PATH: "/usr/bin"});
});

test("records a failed login step in a redacted LG product-gate manifest", () => {
  const manifest = createLgProductGateManifest({
    model: "55QNED80SRA",
    appId: "com.mytvb2c.app",
  });

  const completed = finalizeLgProductGateManifest(manifest, {
    testCaseResult: {
      status: "failed",
      steps: [{
        index: 0,
        action: "login",
        status: "failed",
        durationMs: 932,
        message: "login failed for runtime-user with runtime-password at runtime-tv.invalid",
      }],
    },
  });

  assert.deepEqual(completed, {
    platform: "lg-webos",
    status: "failed",
    evidencePolicy: "local-only-redacted",
    device: {model: "55QNED80SRA", appId: "com.mytvb2c.app"},
    case: {status: "failed", steps: [{index: 0, action: "login", status: "failed", durationMs: 932}]},
  });
  assert.equal(JSON.stringify(completed).includes("runtime-password"), false);
  assert.equal(JSON.stringify(completed).includes("runtime-tv.invalid"), false);
});

test("writes the redacted LG product-gate manifest with owner-only permissions", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "mytv-lg-gate-"));
  try {
    const writer = createLgProductGateEvidenceWriter({rootDir, runId: "live-run"});
    writer.write({status: "passed", case: {status: "passed", steps: []}});

    const manifestPath = path.join(writer.evidenceDir, "manifest.json");
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, "utf8")), {status: "passed", case: {status: "passed", steps: []}});
    assert.equal(fs.statSync(manifestPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(rootDir, {recursive: true, force: true});
  }
});

test("refreshes permissions when an LG product-gate evidence path already exists", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "mytv-lg-gate-"));
  const evidenceDir = path.join(rootDir, "lg-product-gate-live-run");
  try {
    fs.mkdirSync(evidenceDir, {mode: 0o777});
    fs.writeFileSync(path.join(evidenceDir, "manifest.json"), "{}\n", {mode: 0o644});
    const writer = createLgProductGateEvidenceWriter({rootDir, runId: "live-run"});
    writer.write({status: "failed", case: {status: "failed", steps: []}});

    assert.equal(fs.statSync(writer.evidenceDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(writer.evidenceDir, "manifest.json")).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(rootDir, {recursive: true, force: true});
  }
});

test("persists the failed semantic step before a product-gate error returns", async () => {
  const written = [];
  const failure = new Error("gate failed");
  const testCaseResult = {
    status: "failed",
    steps: [{index: 0, action: "login", status: "failed", durationMs: 43, message: "credential-shaped detail"}],
  };

  await assert.rejects(
    () => runLgProductGateWithEvidence({
      manifest: createLgProductGateManifest({model: "55QNED80SRA", appId: "com.mytvb2c.app"}),
      writer: {write(value) { written.push(value); }},
      run: async () => { throw failure; },
      getTestCaseResult: () => testCaseResult,
    }),
    /gate failed/,
  );

  assert.deepEqual(written[1], {
    platform: "lg-webos",
    status: "failed",
    evidencePolicy: "local-only-redacted",
    device: {model: "55QNED80SRA", appId: "com.mytvb2c.app"},
    case: {status: "failed", steps: [{index: 0, action: "login", status: "failed", durationMs: 43}]},
  });
});

test("marks the gate failed when cleanup throws after every semantic action passes", async () => {
  const written = [];
  await assert.rejects(
    () => runLgProductGateWithEvidence({
      manifest: createLgProductGateManifest({model: "55QNED80SRA", appId: "com.mytvb2c.app"}),
      writer: {write(value) { written.push(value); }},
      run: async () => { throw new Error("cleanup failed"); },
      getTestCaseResult: () => ({
        status: "passed",
        steps: [{index: 0, action: "login", status: "passed", durationMs: 43}],
      }),
    }),
    /cleanup failed/,
  );

  assert.deepEqual(written[1], {
    platform: "lg-webos",
    status: "failed",
    evidencePolicy: "local-only-redacted",
    device: {model: "55QNED80SRA", appId: "com.mytvb2c.app"},
    case: {status: "failed", steps: [{index: 0, action: "login", status: "passed", durationMs: 43}]},
  });
});

test("records a safe component failure code without retaining error text", async () => {
  const written = [];
  await assert.rejects(
    () => runLgProductGateWithEvidence({
      manifest: createLgProductGateManifest({model: "55QNED80SRA", appId: "com.mytvb2c.app"}),
      writer: {write(value) { written.push(value); }},
      run: async () => { throw new Error("reset failed for runtime-password"); },
      getFailureCode: () => "RESET_UNAVAILABLE",
    }),
    /runtime-password/,
  );

  assert.equal(written[1].failureCode, "RESET_UNAVAILABLE");
  assert.equal(JSON.stringify(written[1]).includes("runtime-password"), false);
});

test("records the running gate manifest before starting terminal execution", async () => {
  const written = [];
  await runLgProductGateWithEvidence({
    manifest: createLgProductGateManifest({model: "55QNED80SRA", appId: "com.mytvb2c.app"}),
    writer: {write(value) { written.push(value); }},
    run: async () => ({caseResult: {status: "passed", steps: []}}),
  });

  assert.deepEqual(written.map((manifest) => manifest.status), ["running", "passed"]);
});

test("finalizes a pending LG gate as interrupted before Node exits", async () => {
  const written = [];
  const handlers = new Map();
  const processLike = {
    once(name, handler) { handlers.set(name, handler); },
    removeListener(name, handler) { if (handlers.get(name) === handler) handlers.delete(name); },
  };

  void runLgProductGateWithEvidence({
    manifest: createLgProductGateManifest({model: "55QNED80SRA", appId: "com.mytvb2c.app"}),
    writer: {write(value) { written.push(value); }},
    run: () => new Promise(() => {}),
    processLike,
  });

  assert.equal(typeof handlers.get("beforeExit"), "function");
  handlers.get("beforeExit")();
  assert.equal(written.at(-1).status, "failed");
  assert.equal(written.at(-1).failureCode, "RUN_INTERRUPTED");
});

test("bounds a pending loopback Appium request without retaining its URL", async () => {
  let aborted = false;
  await assert.rejects(
    () => requestLoopbackAppium({
      fetchImpl: (_url, {signal}) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => { aborted = true; reject(new Error("request aborted")); });
      }),
      baseUrl: "http://127.0.0.1:4727",
      pathname: "/session/private-id/execute/sync",
      timeoutMs: 1,
      setTimeoutImpl(handler) { queueMicrotask(handler); return 1; },
      clearTimeoutImpl() {},
    }),
    (error) => error.code === "APPIUM_REQUEST_TIMEOUT" && !/private-id|127\.0\.0\.1/.test(error.message),
  );
  assert.equal(aborted, true);
});
