"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createRunCloseGuard} = require("../../app/run-close-guard");

test("allows a normal close when no run or result sync is pending", async () => {
  const guard = createRunCloseGuard({isRunning: () => false, hasUnsyncedResults: () => false});
  assert.deepEqual(await guard.requestClose(), {allow: true});
});

test("requires an explicit stop-and-close decision for an active run", async () => {
  const calls = [];
  const guard = createRunCloseGuard({
    isRunning: () => true,
    hasUnsyncedResults: () => false,
    async stopRun() { calls.push("stop"); },
  });

  assert.deepEqual(await guard.requestClose(), {allow: false, reason: "running"});
  assert.deepEqual(await guard.resolve("keep_open"), {allow: false});
  assert.deepEqual(await guard.resolve("stop_run_and_close"), {allow: true});
  assert.deepEqual(calls, ["stop"]);
});

test("requires explicit discard before close when completed results are unsynced", async () => {
  const calls = [];
  const guard = createRunCloseGuard({
    isRunning: () => false,
    hasUnsyncedResults: () => true,
    discardUnsyncedResults() { calls.push("discard"); },
  });

  assert.deepEqual(await guard.requestClose(), {allow: false, reason: "unsynced_results"});
  assert.deepEqual(await guard.resolve("close_and_discard_unsynced_retry"), {allow: true});
  assert.deepEqual(calls, ["discard"]);
});
