const test = require("node:test");
const assert = require("node:assert/strict");

const {runTvTestCase} = require("../lib/tv-case-runner");

function fakeSession(events) {
  return {
    async resetAppState() { events.push("reset"); },
    async pressKey(key) { events.push(`key:${key}`); },
    async getDomState() { return {bodyText: "Trang chủ", focused: "", active: "", screenUrl: ""}; },
    async waitForDomState(predicate) { return predicate({bodyText: "Trang chủ"}) ? {bodyText: "Trang chủ"} : null; },
    async screenshot() { return "genuine"; },
  };
}

test("runs each TV case from reset through trusted logout cleanup", async () => {
  const events = [];
  const progress = [];
  const frames = [];
  const result = await runTvTestCase({
    tvSession: fakeSession(events),
    capabilities: {domInspection: true, visualCapture: true, targetSemanticActions: true, playerInspection: true},
    helpers: {
      async waitForReady() { events.push("ready"); },
      semantic: {
        async logout() { events.push("logout"); },
      },
    },
    testCase: {
      id: "case-1",
      name: "basic",
      actions: [{action: "wait_for_ready", name: "app"}, {action: "press_back"}],
    },
    onProgress: (event) => progress.push(event),
    onFrame: (frame) => frames.push(frame),
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(events, ["reset", "ready", "key:Backspace", "logout"]);
  assert.deepEqual(progress, [
    {code: "case-reset"},
    {code: "action-complete", actionIndex: 0},
    {code: "action-complete", actionIndex: 1},
    {code: "case-cleanup"},
  ]);
  assert.equal(frames.length, 3);
  assert.equal(frames.every((frame) => /^data:image\/png;base64,/.test(frame)), true);
});

test("calls session-bound logout without passing the raw TV session", async () => {
  const events = [];
  const logoutArguments = [];

  await runTvTestCase({
    tvSession: fakeSession(events),
    capabilities: {domInspection: true, targetSemanticActions: true},
    helpers: {
      semantic: {
        async logout(...argumentsReceived) {
          logoutArguments.push(argumentsReceived);
          events.push("logout");
        },
      },
    },
    testCase: {
      id: "case-session-bound-logout",
      name: "session-bound logout",
      actions: [{action: "press_back"}],
    },
  });

  assert.deepEqual(logoutArguments, [[]]);
  assert.deepEqual(events, ["reset", "key:Backspace", "logout"]);
});

test("keeps the action failure authoritative when trusted logout cleanup also fails", async () => {
  const events = [];
  const progress = [];
  await assert.rejects(
    () => runTvTestCase({
      tvSession: fakeSession(events),
      capabilities: {domInspection: true, targetSemanticActions: true},
      helpers: {
        semantic: {
          async logout() { events.push("logout"); throw new Error("logout failed"); },
        },
      },
      testCase: {
        id: "case-2",
        name: "assertion failure",
        actions: [{action: "assert_screen", text: "Missing"}],
      },
      onProgress: (event) => progress.push(event),
    }),
    (error) => /Missing/.test(error.message)
      && /logout failed/.test(error.tvLogoutCleanupError)
      && error.tvFailure?.kind === "technical"
      && error.tvFailure?.code === "TV_TECHNICAL_UNKNOWN",
  );
  assert.deepEqual(events, ["reset", "logout"]);
  assert.deepEqual(progress, [
    {code: "case-reset"},
    {code: "action-failed", actionIndex: 0},
    {code: "case-cleanup"},
  ]);
});
