"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {createLgCompatibilityAttemptService} = require("../../app/lg-compatibility-attempt-service");

function createHarness({selection = {status: "verified", artifact: {version: "2.36"}}, info = {model: "model-a", firmware: "firmware-a"}} = {}) {
  const calls = [];
  const timers = new Map();
  const service = createLgCompatibilityAttemptService({
    temporaryTarget: {
      async acquire(input) {
        calls.push(["acquire", input]);
        return {
          ok: true,
          targetName: "lgcompat-a1",
          async release() { calls.push(["release"]); },
        };
      },
    },
    adapter: {
      async deviceInfo(input) {
        calls.push(["deviceInfo", input]);
        return info;
      },
    },
    compatibilityCatalog: {
      async select(input) {
        calls.push(["select", input]);
        return selection;
      },
    },
    platform: "darwin",
    createId: () => "attempt-a1",
    scheduleExpiry(callback) {
      timers.set("timer-a1", callback);
      return "timer-a1";
    },
    cancelExpiry(timer) { timers.delete(timer); },
  });
  return {service, calls, timers};
}

test("requires explicit inspection confirmation before it creates a temporary target", async () => {
  const {service, calls} = createHarness();

  assert.deepEqual(await service.inspect({label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"}), {
    ok: false,
    status: "INSPECTION_CONFIRMATION_REQUIRED",
  });
  assert.deepEqual(calls, []);
});

test("returns model and firmware but never connection data, then discards an unknown pair", async () => {
  const {service, calls, timers} = createHarness({selection: {status: "COMPATIBILITY_PROFILE_UNVERIFIED"}});

  const result = await service.inspect({
    confirmed: true,
    label: "Lab",
    host: "192.0.2.10",
    passphrase: "runtime-only",
  });

  assert.deepEqual(result, {
    ok: false,
    status: "COMPATIBILITY_PROFILE_UNVERIFIED",
    model: "model-a",
    firmware: "firmware-a",
  });
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|runtime-only|lgcompat-a1/i);
  assert.deepEqual(calls.map(([name]) => name), ["acquire", "deviceInfo", "select", "release"]);
  assert.equal(timers.size, 0);
  assert.deepEqual(await service.takeForValidation({attemptId: "attempt-a1"}), {
    ok: false,
    status: "ATTEMPT_NOT_FOUND",
  });
});

test("releases the inspection target and permits a verified attempt to be consumed once", async () => {
  const {service, calls, timers} = createHarness();

  assert.deepEqual(await service.inspect({
    confirmed: true,
    label: "Lab",
    host: "192.0.2.10",
    passphrase: "runtime-only",
  }), {
    ok: true,
    status: "COMPATIBILITY_VERIFIED",
    attemptId: "attempt-a1",
    model: "model-a",
    firmware: "firmware-a",
  });
  assert.deepEqual(calls.map(([name]) => name), ["acquire", "deviceInfo", "select", "release"]);

  const taken = await service.takeForValidation({attemptId: "attempt-a1"});
  assert.equal(taken.ok, true);
  assert.equal(taken.attempt.host, "192.0.2.10");
  assert.equal(timers.size, 0);
  assert.deepEqual(await service.takeForValidation({attemptId: "attempt-a1"}), {
    ok: false,
    status: "ATTEMPT_NOT_FOUND",
  });
});

test("discarding an attempt clears its expiry and prevents later validation", async () => {
  const {service, timers} = createHarness();
  await service.inspect({confirmed: true, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"});

  assert.equal(timers.size, 1);
  assert.deepEqual(await service.discard({attemptId: "attempt-a1"}), {ok: true});
  assert.equal(timers.size, 0);
  assert.deepEqual(await service.takeForValidation({attemptId: "attempt-a1"}), {
    ok: false,
    status: "ATTEMPT_NOT_FOUND",
  });
});
