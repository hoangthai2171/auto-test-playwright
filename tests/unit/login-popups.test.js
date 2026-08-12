const test = require("node:test");
const assert = require("node:assert/strict");

const {
  acceptDeviceLimitPopupIfVisible,
  acceptUserConsentPopupIfVisible,
  USER_CONSENT_ACCEPT_ALL_ID,
  USER_CONSENT_FOOTER_ID,
  USER_CONSENT_SUBMIT_ID,
} = require("../lib/login-popups");

test("accepts dialog_confirm_v2 when the OK button is active", async () => {
  const calls = [];
  const popupStates = [
    {dialogId: "dialog_confirm_v2", activeButtonId: "btn_confirm_v2_ok"},
    {dialogId: "dialog_confirm_v2", activeButtonId: "btn_confirm_v2_ok"},
    null,
  ];
  const result = await acceptDeviceLimitPopupIfVisible(
    {id: "page"},
    {id: "test-info"},
    {
      hasVisibleText: async () => true,
      getVisiblePopupState: async () => popupStates.shift(),
      remoteFocusById: async (...args) => calls.push(["focus-id", ...args]),
      getFocusedState: async () => ({id: "btn_confirm_v2_ok", text: "Tiếp tục", label: ""}),
      remotePress: async (...args) => calls.push(["press", ...args]),
    }
  );

  assert.equal(result, true);
  assert.deepEqual(calls, [["press", {id: "page"}, "Enter", 2500]]);
});

test("moves dialog_confirm_v2 focus to the OK button when cancel is active", async () => {
  const calls = [];
  const popupStates = [
    {dialogId: "dialog_confirm_v2", activeButtonId: "btn_confirm_v2_cancel"},
    {dialogId: "dialog_confirm_v2", activeButtonId: "btn_confirm_v2_ok"},
    null,
  ];
  const result = await acceptDeviceLimitPopupIfVisible(
    {id: "page"},
    {},
    {
      hasVisibleText: async () => true,
      getVisiblePopupState: async () => popupStates.shift(),
      remoteFocusById: async (...args) => calls.push(["focus-id", ...args]),
      getFocusedState: async () => ({id: "btn_confirm_v2_ok", text: "Tiếp tục", label: ""}),
      remotePress: async (...args) => calls.push(["press", ...args]),
    }
  );

  assert.equal(result, true);
  assert.deepEqual(calls, [["focus-id", {id: "page"}, "btn_confirm_v2_ok", 80], ["press", {id: "page"}, "Enter", 2500]]);
});

test("does not interact when the device-limit popup is absent", async () => {
  let focused = false;

  const result = await acceptDeviceLimitPopupIfVisible(
    {id: "page"},
    {},
    {
      getVisiblePopupState: async () => null,
      remoteFocusById: async () => {
        focused = true;
      },
    }
  );

  assert.equal(result, false);
  assert.equal(focused, false);
});

test("waits for a delayed device-limit popup before focusing and pressing Continue", async () => {
  const calls = [];
  let elapsed = 0;
  let popup = null;
  const page = {
    waitForTimeout: async (delay) => {
      elapsed += delay;
      if (elapsed >= 500) {
        popup = {dialogId: "dialog_confirm_v2", activeButtonId: "btn_confirm_v2_ok"};
      }
    },
  };

  const result = await acceptDeviceLimitPopupIfVisible(page, {}, {
    hasVisibleText: async () => true,
    hasProfileSelection: async () => false,
    getVisiblePopupState: async () => popup,
    getFocusedState: async () => ({id: "btn_confirm_v2_ok", text: "Tiếp tục", label: ""}),
    remotePress: async (...args) => {
      calls.push(["press", ...args]);
      popup = null;
    },
    transitionTimeout: 2000,
    transitionPolling: 250,
    profileGrace: 0,
    focusTimeout: 1000,
    dismissTimeout: 1000,
  });

  assert.equal(result, true);
  assert.equal(elapsed >= 500, true);
  assert.deepEqual(calls, [["press", page, "Enter", 2500]]);
});

test("accepts the account login consent popup in the required remote order", async () => {
  const calls = [];
  const page = {waitForTimeout: async () => {}};
  const visible = new Map([
    [USER_CONSENT_ACCEPT_ALL_ID, true],
    [USER_CONSENT_FOOTER_ID, true],
    [USER_CONSENT_SUBMIT_ID, true],
    ["new_ui_login_input_label", false],
  ]);
  const checked = new Map([
    [USER_CONSENT_ACCEPT_ALL_ID, false],
    [USER_CONSENT_FOOTER_ID, false],
  ]);
  let enterCount = 0;

  const result = await acceptUserConsentPopupIfVisible(page, {title: "login"}, {
    hasVisibleElement: async (_page, id) => visible.get(id) === true,
    readCheckboxState: async (_page, id) => checked.has(id) ? checked.get(id) : null,
    remoteFocusById: async (_page, id, maxMoves, options) => {
      calls.push(["focus", id, maxMoves, options?.preferredDirection || ""]);
    },
    remotePress: async (_page, key, delay) => {
      calls.push(["press", key, delay]);
      enterCount += 1;
      if (enterCount === 1) checked.set(USER_CONSENT_ACCEPT_ALL_ID, true);
      if (enterCount === 2) checked.set(USER_CONSENT_FOOTER_ID, true);
      if (enterCount === 3) {
        visible.set(USER_CONSENT_ACCEPT_ALL_ID, false);
        visible.set(USER_CONSENT_FOOTER_ID, false);
        visible.set(USER_CONSENT_SUBMIT_ID, false);
      }
    },
    transitionTimeout: 100,
    transitionPolling: 1,
    focusTimeout: 100,
    dismissTimeout: 100,
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [
    ["focus", USER_CONSENT_ACCEPT_ALL_ID, 100, "ArrowUp"],
    ["press", "Enter", 300],
    ["focus", USER_CONSENT_FOOTER_ID, 100, "ArrowDown"],
    ["press", "Enter", 300],
    ["focus", USER_CONSENT_SUBMIT_ID, 100, ""],
    ["press", "Enter", 1500],
  ]);
});

test("does not interact when the account login consent popup is absent", async () => {
  const calls = [];
  const result = await acceptUserConsentPopupIfVisible(
    {waitForTimeout: async () => {}},
    {},
    {
      hasVisibleElement: async () => false,
      remoteFocusById: async () => calls.push("focus"),
      remotePress: async () => calls.push("press"),
      transitionTimeout: 1,
      transitionPolling: 1,
    }
  );

  assert.equal(result, false);
  assert.deepEqual(calls, []);
});
