"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {revealWindowOnFirstPaint} = require("../../app/window-startup");

test("reveals the Electron window only after the renderer has its first paint", () => {
  const events = new Map();
  let visible = false;
  const window = {
    once(event, listener) { events.set(event, listener); },
    isDestroyed() { return false; },
    show() { visible = true; },
  };

  revealWindowOnFirstPaint(window);

  assert.equal(visible, false);
  events.get("ready-to-show")();
  assert.equal(visible, true);
});
