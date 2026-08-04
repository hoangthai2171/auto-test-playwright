"use strict";

const DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS = 6;
const DEFAULT_TEST_CASE_MAX_TIME_MINUTES = 30;
const MAX_TEST_CASE_MAX_TIME_MINUTES = 24 * 60;

function normalizePlayerCheckTimeoutSeconds(value, fallback = DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS) {
    const candidate = Number(value);
    const normalizedFallback = Number(fallback);
    if (Number.isSafeInteger(candidate) && candidate > 0) return candidate;
    if (Number.isSafeInteger(normalizedFallback) && normalizedFallback > 0) return normalizedFallback;
    return DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS;
}

function normalizeTestCaseMaxTimeMinutes(value, fallback = DEFAULT_TEST_CASE_MAX_TIME_MINUTES) {
    const candidate = Number(value);
    const normalizedFallback = Number(fallback);
    if (Number.isSafeInteger(candidate) && candidate > 0 && candidate <= MAX_TEST_CASE_MAX_TIME_MINUTES) return candidate;
    if (Number.isSafeInteger(normalizedFallback) && normalizedFallback > 0 && normalizedFallback <= MAX_TEST_CASE_MAX_TIME_MINUTES) return normalizedFallback;
    return DEFAULT_TEST_CASE_MAX_TIME_MINUTES;
}

const configuration = Object.freeze({
    DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
    DEFAULT_TEST_CASE_MAX_TIME_MINUTES,
    MAX_TEST_CASE_MAX_TIME_MINUTES,
    normalizePlayerCheckTimeoutSeconds,
    normalizeTestCaseMaxTimeMinutes,
});

if (typeof globalThis !== "undefined") globalThis.MYTV_TEST_CONFIGURATION = configuration;
if (typeof module !== "undefined" && module.exports) module.exports = configuration;
