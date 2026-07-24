const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FOCUS_SELECTORS,
  POPUP_FOCUS_DIALOG_IDS,
  POPUP_ACTIVE_FOCUS_SELECTORS,
  SELECTOR_CONTRACTS,
} = require("../lib/selectors");

test("popup dialog focus selectors prioritize active buttons for every supported dialog", () => {
  assert.deepEqual(POPUP_FOCUS_DIALOG_IDS, [
    "dialog_confirm_v2",
    "dialog_alert_v2",
    "dialog_alert_full",
    "dialog_confirm_full",
  ]);
  assert.deepEqual(POPUP_ACTIVE_FOCUS_SELECTORS, [
    "#dialog_confirm_v2 .active",
    "#dialog_alert_v2 .active",
    "#dialog_alert_full .active",
    "#dialog_confirm_full .active",
  ]);
  assert.deepEqual(FOCUS_SELECTORS, [
    ...POPUP_ACTIVE_FOCUS_SELECTORS,
    ".focused",
  ]);
  assert.equal(SELECTOR_CONTRACTS.focus.alternatives[1].name, "popup-active-class");
});
