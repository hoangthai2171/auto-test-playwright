"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
  normalizePlayerCheckTimeoutSeconds,
} = require("../../app/test-configuration");

test("keeps the player-check timeout default at six seconds", () => {
  assert.equal(DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS, 6);
  assert.equal(normalizePlayerCheckTimeoutSeconds(undefined), 6);
  assert.equal(normalizePlayerCheckTimeoutSeconds("9"), 9);
});

test("falls back for missing, fractional, zero, negative, and unsafe timeout values", () => {
  for (const value of [null, "", "1.5", 0, -1, Number.MAX_SAFE_INTEGER + 1, "not-a-number"]) {
    assert.equal(normalizePlayerCheckTimeoutSeconds(value), 6, `value: ${String(value)}`);
  }
  assert.equal(normalizePlayerCheckTimeoutSeconds("invalid", 12), 12);
});
