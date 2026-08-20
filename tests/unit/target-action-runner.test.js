const test = require("node:test");
const assert = require("node:assert/strict");

const {createTargetActionContext} = require("../lib/target-action-context");
const {runTargetActions, validateTargetCaseCapabilities} = require("../lib/target-action-runner");

test("runs basic target-neutral actions through the injected TV session", async () => {
  const calls = [];
  const context = createTargetActionContext({
    session: {
      async press(key) { calls.push(["press", key]); },
      async hasVisibleText(text) { calls.push(["hasVisibleText", text]); return text === "Trang chủ"; },
    },
    helpers: {
      async waitForReady(_session, name) { calls.push(["waitForReady", name]); },
    },
    capabilities: {domInspection: true},
  });
  const result = await runTargetActions(context, {
    id: "tv-case-1",
    name: "basic remote actions",
    actions: [
      {action: "wait_for_ready", name: "app"},
      {action: "press_ok"},
      {action: "press_back", count: 2},
      {action: "assert_screen", text: "Trang chủ"},
    ],
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.steps.map((step) => step.action), ["wait_for_ready", "press_ok", "press_back", "assert_screen"]);
  assert.deepEqual(calls, [
    ["waitForReady", "app"],
    ["press", "Enter"],
    ["press", "Backspace"],
    ["press", "Backspace"],
    ["hasVisibleText", "Trang chủ"],
  ]);
});

test("fails unsupported target actions before the session receives input", async () => {
  let pressed = false;
  const context = createTargetActionContext({
    session: {async press() { pressed = true; }},
    helpers: {},
    capabilities: {domInspection: true},
  });

  await assert.rejects(
    () => runTargetActions(context, {
      id: "tv-case-2",
      name: "unsupported playback",
      actions: [{action: "play_content", name: "item", type: "movie"}],
    }),
    (error) => error.code === "ACTION_CAPABILITY_UNSUPPORTED" && error.caseId === "tv-case-2" && error.actionIndex === 0,
  );
  assert.equal(pressed, false);
});

test("admits supported TV actions before a session is created", () => {
  assert.doesNotThrow(() => validateTargetCaseCapabilities({
    id: "tv-case-admission",
    name: "admission",
    actions: [
      {action: "wait_for_ready", name: "app"},
      {action: "press_back"},
      {action: "play_content", name: "item", type: "movie"},
    ],
  }, {
    domInspection: true,
    visualCapture: true,
    targetSemanticActions: true,
    playerInspection: true,
  }));
});

test("rejects unsupported TV capabilities before a session is created", () => {
  assert.throws(
    () => validateTargetCaseCapabilities({
      id: "tv-case-unsupported-admission",
      name: "unsupported admission",
      actions: [{action: "play_content", name: "item", type: "movie"}],
    }, {
      domInspection: true,
      visualCapture: true,
      targetSemanticActions: true,
      playerInspection: false,
    }),
    (error) => error.code === "ACTION_CAPABILITY_UNSUPPORTED"
      && error.caseId === "tv-case-unsupported-admission"
      && error.actionIndex === 0,
  );
});

test("rejects Browser-only Home-trailer action before a TV session is created", () => {
  assert.throws(
    () => validateTargetCaseCapabilities({
      id: "home-trailer-browser-only",
      name: "Home trailers",
      actions: [{action: "play_home_trailers"}],
    }, {
      domInspection: true,
      visualCapture: true,
      targetSemanticActions: true,
      playerInspection: true,
    }),
    (error) => error.code === "ACTION_CAPABILITY_UNSUPPORTED"
      && error.caseId === "home-trailer-browser-only"
      && error.actionIndex === 0
      && /browserHomeTrailers/u.test(error.message)
  );
});

test("rejects Browser-only list playback before a TV session is created", () => {
  assert.throws(
    () => validateTargetCaseCapabilities({
      id: "list-playback-browser-only",
      name: "Play list page",
      actions: [{action: "play_all_contents"}],
    }, {
      domInspection: true,
      visualCapture: true,
      targetSemanticActions: true,
      playerInspection: true,
    }),
    (error) => error.code === "ACTION_CAPABILITY_UNSUPPORTED"
      && error.caseId === "list-playback-browser-only"
      && error.actionIndex === 0
      && /browserListPlayback/u.test(error.message)
  );
});
