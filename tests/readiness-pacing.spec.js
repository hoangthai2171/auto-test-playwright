const {test, expect} = require("playwright/test");
const api = require("./lib");

test("compatibility barrel exposes the shared readiness and pacing API", () => {
  expect(api.waitForFocusState).toEqual(expect.any(Function));
  expect(api.waitForContentVisible).toEqual(expect.any(Function));
  expect(api.waitForPlayerReady).toEqual(expect.any(Function));
  expect(api.WAIT_DEFAULTS.focus.timeout).toBe(30000);
  expect(api.DEFAULT_REMOTE_PRESS_DELAY).toBe(100);
});
