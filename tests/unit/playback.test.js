const test = require("node:test");
const assert = require("node:assert/strict");

const {closePlayerOrDetail} = require("../lib/playback");

function createHarness({closedAfter = 1, popupAt = null, unexpectedPopup = false} = {}) {
  const events = [];
  let closePresses = 0;
  let popupVisible = popupAt === 0;

  const page = {
    waitForTimeout: async (durationMs) => events.push(["wait", durationMs]),
  };
  const remotePress = async (_page, key) => {
    events.push(["press", key]);
    if (key === "Backspace") {
      closePresses += 1;
      if (popupAt != null && popupAt > 0 && closePresses >= popupAt) popupVisible = true;
      if (popupVisible && popupAt != null && closePresses > popupAt) popupVisible = false;
    }
  };
  const observePopup = async () => ({
    visible: popupVisible && !unexpectedPopup,
    kind: popupVisible && !unexpectedPopup ? "exit_confirmation" : "none",
    unexpectedVisible: unexpectedPopup,
    visibleDialogs: unexpectedPopup ? [{id: "dialog_confirm_v2", text: "Unexpected"}] : [],
  });
  const isClosed = async () => closePresses >= closedAfter;

  return {page, remotePress, observePopup, isClosed, events, get closePresses() { return closePresses; }};
}

test("closes a player with one Back when the first Back reaches the destination", async () => {
  const harness = createHarness({closedAfter: 1});

  const result = await closePlayerOrDetail(harness.page, harness);

  assert.equal(result.closed, true);
  assert.equal(result.backPresses, 1);
  assert.deepEqual(harness.events.filter(([type]) => type === "press"), [["press", "Backspace"]]);
});

test("sends a second Back only when the first Back did not close the player", async () => {
  const harness = createHarness({closedAfter: 2});

  const result = await closePlayerOrDetail(harness.page, {
    ...harness,
    boundaryTimeoutMs: 0,
  });

  assert.equal(result.closed, true);
  assert.equal(result.backPresses, 2);
  assert.deepEqual(harness.events.filter(([type]) => type === "press"), [
    ["press", "Backspace"],
    ["press", "Backspace"],
  ]);
});

test("honors the larger bounded close limit for a deep row return", async () => {
  const harness = createHarness({closedAfter: 4});

  const result = await closePlayerOrDetail(harness.page, {
    ...harness,
    maxBackPresses: 6,
    boundaryTimeoutMs: 0,
  });

  assert.equal(result.closed, true);
  assert.equal(result.backPresses, 4);
  assert.equal(harness.closePresses, 4);
});

test("keeps the generic close limit at two Back presses", async () => {
  const harness = createHarness({closedAfter: 3});

  await assert.rejects(
    () => closePlayerOrDetail(harness.page, {...harness, boundaryTimeoutMs: 0}),
    (error) => error.code === "PLAYER_CLOSE_FAILED" && error.details.backPresses === 2
  );
  assert.equal(harness.closePresses, 2);
});

test("dismisses an exit confirmation without treating it as another close attempt", async () => {
  const harness = createHarness({closedAfter: 1, popupAt: 1});

  const result = await closePlayerOrDetail(harness.page, harness);

  assert.equal(result.closed, true);
  assert.equal(result.backPresses, 1);
  assert.equal(result.dismissedExitConfirmation, 1);
  assert.equal(harness.closePresses, 2);
  assert.deepEqual(harness.events.filter(([type]) => type === "press"), [
    ["press", "Backspace"],
    ["press", "Backspace"],
  ]);
});

test("fails closed when an unexpected modal is visible", async () => {
  const harness = createHarness({unexpectedPopup: true});

  await assert.rejects(
    () => closePlayerOrDetail(harness.page, harness),
    (error) => error.code === "PLAYER_CLOSE_UNSAFE_POPUP"
  );
  assert.equal(harness.closePresses, 0);
});

test("allows a row caller to dismiss one recognized playback failure dialog safely", async () => {
  let unexpected = true;
  let enterPresses = 0;
  const page = {waitForTimeout: async () => {}};
  const remotePress = async (_page, key) => {
    if (key === "Enter") {
      enterPresses += 1;
      unexpected = false;
    }
  };
  const observePopup = async () => ({
    visible: false,
    kind: "none",
    unexpectedVisible: unexpected,
    visibleDialogs: unexpected ? [{id: "dialog_alert_v2", text: "Thiết bị không hỗ trợ"}] : [],
  });

  const result = await closePlayerOrDetail(page, {
    remotePress,
    observePopup,
    dismissUnexpectedPopup: async () => {
      unexpected = false;
      return true;
    },
    isClosed: async () => !unexpected,
    boundaryTimeoutMs: 0,
  });

  assert.equal(result.closed, true);
  assert.equal(enterPresses, 0);
});
