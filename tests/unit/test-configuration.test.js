"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
  DEFAULT_TEST_CASE_MAX_TIME_MINUTES,
  MAX_TEST_CASE_MAX_TIME_MINUTES,
  TEST_RESOLUTION_OPTIONS,
  DEFAULT_TEST_RESOLUTION,
  SIMULTANEOUS_DEVICE_OPTIONS,
  DEFAULT_SIMULTANEOUS_DEVICES,
  normalizePlayerCheckTimeoutSeconds,
  normalizeTestCaseMaxTimeMinutes,
  normalizeTestResolution,
  resolveTestViewport,
  normalizeSimultaneousDevices,
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

test("uses the requested resolution allowlist and 1280x720 default", () => {
  assert.deepEqual(TEST_RESOLUTION_OPTIONS, ["1280x720", "1920x1080"]);
  assert.equal(DEFAULT_TEST_RESOLUTION, "1280x720");
  assert.equal(normalizeTestResolution(undefined), "1280x720");
  assert.equal(normalizeTestResolution("1920x1080"), "1920x1080");
  assert.equal(normalizeTestResolution("invalid", "1920x1080"), "1920x1080");
  assert.equal(normalizeTestResolution("1024x768"), "1280x720");
});

test("resolves only the two supported 16:9 viewport objects", () => {
  assert.deepEqual(resolveTestViewport("1280x720"), {
    resolution: "1280x720",
    width: 1280,
    height: 720,
  });
  assert.deepEqual(resolveTestViewport("1920x1080"), {
    resolution: "1920x1080",
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(resolveTestViewport("unsupported", "1920x1080"), {
    resolution: "1920x1080",
    width: 1920,
    height: 1080,
  });
  const viewport = resolveTestViewport("1280x720");
  assert.equal(Object.isFrozen(viewport), true);
});

test("uses the simultaneous-device allowlist and six-device default", () => {
  assert.deepEqual(SIMULTANEOUS_DEVICE_OPTIONS, [1, 2, 4, 6]);
  assert.equal(DEFAULT_SIMULTANEOUS_DEVICES, 6);
  for (const value of [1, "2", 4, "6"]) {
    assert.equal(normalizeSimultaneousDevices(value), Number(value));
  }
  for (const value of [undefined, null, "", 0, -1, 3, 5, 7, 1.5, "not-a-number"]) {
    assert.equal(normalizeSimultaneousDevices(value), 6, `value: ${String(value)}`);
  }
  assert.equal(normalizeSimultaneousDevices("invalid", "4"), 4);
});
