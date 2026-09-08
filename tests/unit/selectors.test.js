const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FOCUS_SELECTORS,
  SCREEN_FOCUS_SELECTORS,
  IS_FOCUS_SELECTOR,
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
    "user-consent-popup",
  ]);
  assert.deepEqual(POPUP_ACTIVE_FOCUS_SELECTORS, [
    "#dialog_confirm_v2 .active",
    "#dialog_alert_v2 .active",
    "#dialog_alert_full .active",
    "#dialog_confirm_full .active",
    "#user-consent-popup .active",
  ]);
  assert.deepEqual(FOCUS_SELECTORS, [
    ...POPUP_ACTIVE_FOCUS_SELECTORS,
    ".focused",
    '[is_focus="1"]',
  ]);
  assert.equal(SELECTOR_CONTRACTS.focus.alternatives[1].name, "popup-active-class");
});

test("the is_focus attribute is a declared focus marker, ranked below the focus class", () => {
  assert.deepEqual(SCREEN_FOCUS_SELECTORS, [".focused", '[is_focus="1"]']);
  assert.equal(IS_FOCUS_SELECTOR, '[is_focus="1"]');
  // Priority is what the readers rely on: when both markers are on screen the
  // class is the live one and the attribute can be stale.
  assert.ok(FOCUS_SELECTORS.indexOf(".focused") < FOCUS_SELECTORS.indexOf(IS_FOCUS_SELECTOR));
  assert.equal(SELECTOR_CONTRACTS.focus.alternatives[2].name, "is-focus-attribute");
});
