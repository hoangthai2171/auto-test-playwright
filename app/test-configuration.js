"use strict";

const DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS = 6;

function normalizePlayerCheckTimeoutSeconds(value, fallback = DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS) {
    const candidate = Number(value);
    const normalizedFallback = Number(fallback);
    if (Number.isSafeInteger(candidate) && candidate > 0) return candidate;
    if (Number.isSafeInteger(normalizedFallback) && normalizedFallback > 0) return normalizedFallback;
    return DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS;
}

const configuration = Object.freeze({
    DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
    normalizePlayerCheckTimeoutSeconds,
});

if (typeof globalThis !== "undefined") globalThis.MYTV_TEST_CONFIGURATION = configuration;
if (typeof module !== "undefined" && module.exports) module.exports = configuration;
