const test = require("node:test");
const assert = require("node:assert/strict");

const {createDomSession} = require("../lib/tv-session/dom-session");

test("DomSession uses the wrapped native TV key and redacted DOM-state operations", async () => {
  const calls = [];
  const session = createDomSession({
    capabilities: {domInspection: true, visualCapture: true},
    tvSession: {
      async pressKey(key) { calls.push(["pressKey", key]); },
      async getDomState() { return {bodyText: "Trang chủ", focused: "", active: "", screenUrl: ""}; },
      async waitForDomState(predicate, options) { calls.push(["waitForDomState", options]); return predicate({bodyText: "Trang chủ"}); },
      async screenshot() { return "genuine-png"; },
    },
  });

  await session.press("ArrowRight");
  assert.deepEqual(calls[0], ["pressKey", "ArrowRight"]);
  assert.equal(await session.hasVisibleText("trang chu"), true);
  assert.deepEqual(await session.waitForVisibleText("Trang chủ", {timeoutMs: 500}), true);
  assert.equal(await session.capture(), "genuine-png");
});

test("DomSession rejects unavailable DOM and visual capabilities before TV interaction", async () => {
  const session = createDomSession({
    capabilities: {domInspection: false, visualCapture: false},
    tvSession: {
      async pressKey() { throw new Error("must not run"); },
      async getDomState() { throw new Error("must not run"); },
      async waitForDomState() { throw new Error("must not run"); },
      async screenshot() { throw new Error("must not run"); },
    },
  });

  await assert.rejects(() => session.read(), {code: "DOM_INSPECTION_UNAVAILABLE"});
  await assert.rejects(() => session.capture(), {code: "VISUAL_CAPTURE_UNAVAILABLE"});
});
