"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {runTvCaseBatch} = require("../lib/tv-batch-runner");

function technicalError(code = "SESSION_UNAVAILABLE") {
  const error = new Error(code);
  error.code = code;
  return error;
}

function businessError(code = "SCREEN_ASSERTION_FAILED") {
  const error = new Error(code);
  error.code = code;
  return error;
}

test("continues after a business failure without recovery", async () => {
  const attempts = [];
  const batch = await runTvCaseBatch({
    cases: [{id: "business"}, {id: "passed"}],
    async executeCase(testCase) {
      attempts.push(testCase.id);
      if (testCase.id === "business") throw businessError();
      return {testCaseId: testCase.id, status: "passed", steps: []};
    },
    async recover() { throw new Error("must not recover business failures"); },
  });

  assert.equal(batch.status, "completed");
  assert.deepEqual(attempts, ["business", "passed"]);
  assert.deepEqual(batch.completed.map((item) => [item.id, item.status, item.failure?.kind]), [
    ["business", "failed", "business"],
    ["passed", "passed", undefined],
  ]);
});

test("recovers a technical failure by rerunning the active case from its first action", async () => {
  let attempts = 0;
  const recovered = [];
  const batch = await runTvCaseBatch({
    cases: [{id: "recover"}],
    async executeCase(testCase) {
      attempts += 1;
      if (attempts === 1) throw technicalError();
      return {testCaseId: testCase.id, status: "passed", steps: []};
    },
    async recover(details) { recovered.push(details); },
  });

  assert.equal(batch.status, "completed");
  assert.equal(attempts, 2);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].attempt, 1);
  assert.deepEqual(batch.completed.map((item) => item.id), ["recover"]);
});

test("pauses after three technical failures and stops only after operator direction", async () => {
  const decisions = [];
  const batch = await runTvCaseBatch({
    cases: [{id: "active"}, {id: "unstarted"}],
    async executeCase() { throw technicalError(); },
    async recover() {},
    async requestDecision(details) {
      decisions.push(details);
      return "stop";
    },
  });

  assert.equal(batch.status, "stopped_by_user");
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].code, "SESSION_UNAVAILABLE");
  assert.deepEqual(batch.stopped.map((item) => item.id), ["active", "unstarted"]);
  assert.deepEqual(batch.completed, []);
});

test("does not automatically retry a pairing pause", async () => {
  const pairing = technicalError("PAIRING_REQUIRED");
  let recoveryCalls = 0;
  const batch = await runTvCaseBatch({
    cases: [{id: "pairing"}],
    async executeCase() { throw pairing; },
    async recover() { recoveryCalls += 1; },
    async requestDecision(details) {
      assert.equal(details.reason, "pairing_required");
      return "stop";
    },
  });

  assert.equal(recoveryCalls, 0);
  assert.equal(batch.status, "stopped_by_user");
});
