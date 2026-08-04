"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
  DEFAULT_TEST_CASE_MAX_TIME_MINUTES,
  MAX_TEST_CASE_MAX_TIME_MINUTES,
  normalizePlayerCheckTimeoutSeconds,
  normalizeTestCaseMaxTimeMinutes,
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

test("keeps the test-case maximum time at thirty minutes by default", () => {
  assert.equal(DEFAULT_TEST_CASE_MAX_TIME_MINUTES, 30);
  assert.equal(normalizeTestCaseMaxTimeMinutes(undefined), 30);
  assert.equal(normalizeTestCaseMaxTimeMinutes("45"), 45);
  assert.equal(normalizeTestCaseMaxTimeMinutes(MAX_TEST_CASE_MAX_TIME_MINUTES), MAX_TEST_CASE_MAX_TIME_MINUTES);
});

test("falls back for invalid or unsafe test-case maximum times", () => {
  for (const value of [null, "", "1.5", 0, -1, MAX_TEST_CASE_MAX_TIME_MINUTES + 1, Number.MAX_SAFE_INTEGER + 1, "not-a-number"]) {
    assert.equal(normalizeTestCaseMaxTimeMinutes(value), 30, `value: ${String(value)}`);
  }
  assert.equal(normalizeTestCaseMaxTimeMinutes("invalid", 12), 12);
});
