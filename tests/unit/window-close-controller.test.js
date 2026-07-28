"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createRunCloseGuard} = require("../../app/run-close-guard");
const {createWindowCloseController, createManagedWindowCloseController} = require("../../app/window-close-controller");

function createFakeWindow() {
  const listeners = new Map();
  return {
    on(name, callback) { listeners.set(name, callback); },
    close() {
      const event = {prevented: false, preventDefault() { this.prevented = true; }};
      listeners.get("close")?.(event);
      return event.prevented;
    },
  };
}

test("stops an active run, discards its unsynced retry, and closes only after explicit consent", async () => {
  let running = true;
  let unsynced = true;
  const events = [];
  const guard = createRunCloseGuard({
    isRunning: () => running,
    hasUnsyncedResults: () => unsynced,
    async stopRun() {
      events.push("stop");
      running = false;
    },
    discardUnsyncedResults() {
      events.push("discard");
      unsynced = false;
    },
  });
  const controller = createWindowCloseController({
    guard,
    async confirm(reason) {
      events.push(`confirm:${reason}`);
      return "stop_run_and_close";
    },
    closeWindow() {
      events.push("close");
    },
  });

  assert.equal(await controller.requestClose(), true);
  assert.deepEqual(events, [
    "confirm:running_and_unsynced_results",
    "stop",
    "discard",
    "close",
  ]);
});

test("keeps the window open when the operator declines an unsynced-result discard", async () => {
  let closed = false;
  const guard = createRunCloseGuard({
    isRunning: () => false,
    hasUnsyncedResults: () => true,
  });
  const controller = createWindowCloseController({
    guard,
    async confirm() {
      return "keep_open";
    },
    closeWindow() {
      closed = true;
    },
  });

  assert.equal(await controller.requestClose(), false);
  assert.equal(closed, false);
});

test("a close approval belongs only to its current Electron window", async () => {
  const firstWindow = createFakeWindow();
  const secondWindow = createFakeWindow();
  let firstRunning = true;
  let secondRunning = true;
  const decisions = [];
  createManagedWindowCloseController({
    window: firstWindow,
    guard: createRunCloseGuard({
      isRunning: () => firstRunning,
      hasUnsyncedResults: () => false,
      async stopRun() { firstRunning = false; },
    }),
    async confirm() { decisions.push("first"); return "stop_run_and_close"; },
  });
  createManagedWindowCloseController({
    window: secondWindow,
    guard: createRunCloseGuard({
      isRunning: () => secondRunning,
      hasUnsyncedResults: () => false,
      async stopRun() { secondRunning = false; },
    }),
    async confirm() { decisions.push("second"); return "stop_run_and_close"; },
  });

  assert.equal(firstWindow.close(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondWindow.close(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(decisions, ["first", "second"]);
});
