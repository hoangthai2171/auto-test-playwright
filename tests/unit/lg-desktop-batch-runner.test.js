"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createLgDesktopBatchRunner} = require("../../app/lg-desktop-batch-runner");

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return {promise, resolve};
}

function failure(code) {
  const error = new Error(code);
  error.code = code;
  error.testCaseResult = {testCaseId: "case", status: "failed", steps: []};
  return error;
}

function createHarness({runs = new Map()} = {}) {
  const calls = {prepare: 0, load: [], run: [], playerTimeouts: [], report: []};
  const runtime = Object.freeze({profile: {id: "lg-1"}, host: "private-host", connection: {}, appium: {}, transport: {secureWebsocket: true, allowSelfSignedTls: true}});
  const batch = createLgDesktopBatchRunner({
    preflight: {
      async availability() { return {ok: true, status: "READY"}; },
      async prepare() { calls.prepare += 1; return {runtime, redactionSecrets: ["private-host"]}; },
    },
    async loadCase(id) {
      calls.load.push(String(id));
      return {id: String(id), name: `Case ${id}`, actions: [{action: "assert_screen", text: "Ready"}]};
    },
    tvRunner: {
      async run(input) {
        calls.run.push(String(input.testCase.id));
        calls.playerTimeouts.push(input.playerCheckTimeoutSeconds);
        const queue = runs.get(String(input.testCase.id)) || [];
        const result = queue.shift();
        if (result instanceof Error) throw result;
        return result || {caseResult: {testCaseId: String(input.testCase.id), status: "passed", steps: []}};
      },
    },
    async writeReportEntry(entry) { calls.report.push(entry); },
  });
  return {batch, calls};
}

test("requires confirmation and continues after a business case failure", async () => {
  const {batch, calls} = createHarness({runs: new Map([
    ["business", [failure("SCREEN_ASSERTION_FAILED")]],
    ["next", [{caseResult: {testCaseId: "next", status: "passed", steps: []}}]],
  ])});

  await assert.rejects(
    batch.start({deviceId: "lg-1", selectedCaseIds: ["business"], confirmed: false}),
    (error) => error.code === "LG_CONFIRMATION_REQUIRED",
  );
  assert.equal(calls.prepare, 0);

  const result = await batch.start({deviceId: "lg-1", selectedCaseIds: ["business", "next"], confirmed: true});

  assert.deepEqual(result.caseRuns.map(({id}) => id), ["business", "next"]);
  assert.deepEqual(calls.run, ["business", "next"]);
  assert.equal(calls.prepare, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-host/i);
});

test("restarts technical failures from a fresh TV runner invocation", async () => {
  const {batch, calls} = createHarness({runs: new Map([
    ["retry", [failure("SESSION_UNAVAILABLE"), failure("SESSION_UNAVAILABLE"), {caseResult: {testCaseId: "retry", status: "passed", steps: []}}]],
  ])});

  const result = await batch.start({deviceId: "lg-1", selectedCaseIds: ["retry"], confirmed: true});

  assert.equal(result.caseRuns[0].result.passed, true);
  assert.deepEqual(calls.run, ["retry", "retry", "retry"]);
});

test("pauses after three technical failures and resumes only after explicit retry", async () => {
  const recovery = deferred();
  const events = [];
  const {batch, calls} = createHarness({runs: new Map([
    ["retry", [failure("SESSION_UNAVAILABLE"), failure("SESSION_UNAVAILABLE"), failure("SESSION_UNAVAILABLE"), {caseResult: {testCaseId: "retry", status: "passed", steps: []}}]],
  ])});

  const pending = batch.start({deviceId: "lg-1", selectedCaseIds: ["retry"], confirmed: true, onEvent: (event) => {
    events.push(event);
    if (event.code === "recovery-required") recovery.resolve();
  }});
  await recovery.promise;
  assert.deepEqual(events.at(-1), {code: "recovery-required", caseId: "retry", attempt: 3, reason: "technical"});
  assert.deepEqual(await batch.resolveRecovery({action: "retry"}), {ok: true});

  const result = await pending;
  assert.equal(result.caseRuns[0].result.passed, true);
  assert.deepEqual(calls.run, ["retry", "retry", "retry", "retry"]);
});

test("pairing pauses immediately and stop does not start later cases", async () => {
  const recovery = deferred();
  const {batch, calls} = createHarness({runs: new Map([
    ["pairing", [failure("PAIRING_REQUIRED")]],
  ])});

  const pending = batch.start({deviceId: "lg-1", selectedCaseIds: ["pairing", "later"], confirmed: true, onEvent: (event) => {
    if (event.code === "recovery-required") recovery.resolve();
  }});
  await recovery.promise;
  assert.deepEqual(await batch.resolveRecovery({action: "stop"}), {ok: true});

  const result = await pending;
  assert.equal(result.stopped, true);
  assert.deepEqual(calls.run, ["pairing"]);
});

test("requestStop prevents the next selected case from starting", async () => {
  const {batch, calls} = createHarness({runs: new Map([
    ["one", [{caseResult: {testCaseId: "one", status: "passed", steps: []}}]],
  ])});
  const result = await batch.start({deviceId: "lg-1", selectedCaseIds: ["one", "two"], confirmed: true, onEvent: (event) => {
    if (event.code === "case-finished") batch.requestStop();
  }});

  assert.equal(result.stopped, true);
  assert.deepEqual(calls.run, ["one"]);
  assert.deepEqual(result.caseRuns.map(({id, result: caseResult}) => [id, caseResult.stopped]), [
    ["one", false],
    ["two", true],
  ]);
});

test("forwards the current player timeout to each LG case", async () => {
  const {batch, calls} = createHarness();
  const result = await batch.start({deviceId: "lg-1", selectedCaseIds: ["one"], confirmed: true});

  assert.equal(result.ok, true);
  assert.deepEqual(calls.playerTimeouts, [6]);
});

test("normalizes a custom player timeout before starting an LG case", async () => {
  const {calls} = createHarness();
  const batch = createLgDesktopBatchRunner({
    preflight: {
      async availability() { return {ok: true, status: "READY"}; },
      async prepare() { return {runtime: {profile: {id: "lg-1"}, host: "host", connection: {}, appium: {}, transport: {secureWebsocket: true, allowSelfSignedTls: true}}}; },
    },
    loadCase: async (id) => ({id: String(id), name: "Case", actions: [{action: "assert_screen", text: "Ready"}]}),
    tvRunner: {
      async run(input) {
        calls.playerTimeouts.push(input.playerCheckTimeoutSeconds);
        return {caseResult: {testCaseId: String(input.testCase.id), status: "passed", steps: []}};
      },
    },
    getPlayerCheckTimeoutSeconds: () => "13",
  });

  await batch.start({deviceId: "lg-1", selectedCaseIds: ["one"], confirmed: true});

  assert.deepEqual(calls.playerTimeouts, [13]);
});
