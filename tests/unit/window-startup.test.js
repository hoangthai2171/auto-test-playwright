"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {revealWindowOnFirstPaint} = require("../../app/window-startup");

function createWindowFixture() {
  const events = new Map();
  let visible = false;
  return {
    window: {
      once(event, listener) { events.set(event, listener); },
      isDestroyed() { return false; },
      show() { visible = true; },
    },
    events,
    isVisible() { return visible; },
  };
}

test("reveals only after Electron first paint and renderer bootstrap are both ready", () => {
  const fixture = createWindowFixture();
  const timer = {unref() {}};
  let clearTimeoutArgument;
  const releaseWindowReveal = revealWindowOnFirstPaint(fixture.window, {
    setTimeoutFn: () => timer,
    clearTimeoutFn: (value) => { clearTimeoutArgument = value; },
  });

  assert.equal(fixture.isVisible(), false);
  fixture.events.get("ready-to-show")();
  assert.equal(fixture.isVisible(), false);

  releaseWindowReveal();

  assert.equal(fixture.isVisible(), true);
  assert.equal(clearTimeoutArgument, timer);
});

test("uses the startup fallback if the renderer never signals readiness", () => {
  const fixture = createWindowFixture();
  let timeoutCallback;
  const releaseWindowReveal = revealWindowOnFirstPaint(fixture.window, {
    setTimeoutFn: (callback) => {
      timeoutCallback = callback;
      return {unref() {}};
    },
  });

  fixture.events.get("ready-to-show")();
  assert.equal(fixture.isVisible(), false);

  timeoutCallback();

  assert.equal(fixture.isVisible(), true);
  releaseWindowReveal();
});
