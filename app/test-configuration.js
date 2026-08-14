"use strict";

const DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS = 6;
const DEFAULT_TEST_CASE_MAX_TIME_MINUTES = 30;
const MAX_TEST_CASE_MAX_TIME_MINUTES = 24 * 60;
const TEST_RESOLUTION_OPTIONS = Object.freeze(["1280x720", "1920x1080"]);
const DEFAULT_TEST_RESOLUTION = "1280x720";
const SIMULTANEOUS_DEVICE_OPTIONS = Object.freeze([1, 2, 4, 6]);
const DEFAULT_SIMULTANEOUS_DEVICES = 6;
const APP_ENVIRONMENT_OPTIONS = Object.freeze(["online", "pilot", "stage"]);
const DEFAULT_APP_ENVIRONMENT = "online";

const TEST_VIEWPORTS = Object.freeze({
    "1280x720": Object.freeze({width: 1280, height: 720}),
    "1920x1080": Object.freeze({width: 1920, height: 1080}),
});

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

function normalizeTestResolution(value, fallback = DEFAULT_TEST_RESOLUTION) {
    const candidate = String(value ?? "").trim();
    if (TEST_RESOLUTION_OPTIONS.includes(candidate)) return candidate;
    const normalizedFallback = String(fallback ?? "").trim();
    if (TEST_RESOLUTION_OPTIONS.includes(normalizedFallback)) return normalizedFallback;
    return DEFAULT_TEST_RESOLUTION;
}

function resolveTestViewport(value, fallback = DEFAULT_TEST_RESOLUTION) {
    const resolution = normalizeTestResolution(value, fallback);
    const viewport = TEST_VIEWPORTS[resolution];
    return Object.freeze({
        resolution,
        width: viewport.width,
        height: viewport.height,
    });
}

function normalizeSimultaneousDevices(value, fallback = DEFAULT_SIMULTANEOUS_DEVICES) {
    const candidate = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (Number.isSafeInteger(candidate) && SIMULTANEOUS_DEVICE_OPTIONS.includes(candidate)) return candidate;
    const normalizedFallback = typeof fallback === "string" && fallback.trim() !== "" ? Number(fallback) : fallback;
    if (Number.isSafeInteger(normalizedFallback) && SIMULTANEOUS_DEVICE_OPTIONS.includes(normalizedFallback)) return normalizedFallback;
    return DEFAULT_SIMULTANEOUS_DEVICES;
}

function normalizeAppEnvironment(value, fallback = DEFAULT_APP_ENVIRONMENT) {
    const candidate = String(value ?? "").trim().toLowerCase();
    if (APP_ENVIRONMENT_OPTIONS.includes(candidate)) return candidate;
    const normalizedFallback = String(fallback ?? "").trim().toLowerCase();
    if (APP_ENVIRONMENT_OPTIONS.includes(normalizedFallback)) return normalizedFallback;
    return DEFAULT_APP_ENVIRONMENT;
}

const configuration = Object.freeze({
    DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS,
    DEFAULT_TEST_CASE_MAX_TIME_MINUTES,
    MAX_TEST_CASE_MAX_TIME_MINUTES,
    TEST_RESOLUTION_OPTIONS,
    DEFAULT_TEST_RESOLUTION,
    SIMULTANEOUS_DEVICE_OPTIONS,
    DEFAULT_SIMULTANEOUS_DEVICES,
    APP_ENVIRONMENT_OPTIONS,
    DEFAULT_APP_ENVIRONMENT,
    TEST_VIEWPORTS,
    normalizePlayerCheckTimeoutSeconds,
    normalizeTestCaseMaxTimeMinutes,
    normalizeTestResolution,
    resolveTestViewport,
    normalizeSimultaneousDevices,
    normalizeAppEnvironment,
});

if (typeof globalThis !== "undefined") globalThis.MYTV_TEST_CONFIGURATION = configuration;
if (typeof module !== "undefined" && module.exports) module.exports = configuration;
