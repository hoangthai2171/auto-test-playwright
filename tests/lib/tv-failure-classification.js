"use strict";

const TV_FAILURE_KIND = Object.freeze({
  business: "business",
  technical: "technical",
});

const BUSINESS_CODES = new Set([
  "ACTION_ASSERTION_FAILED",
  "CONTENT_NOT_FOUND",
  "FOCUS_NOT_FOUND",
  "PLAYER_ASSERTION_FAILED",
  "SCREEN_ASSERTION_FAILED",
]);

const TECHNICAL_CODES = new Set([
  "APP_IDENTITY_MISMATCH",
  "APPIUM_BASE_URL_INVALID",
  "APPIUM_CLIENT_UNAVAILABLE",
  "DOM_INSPECTION_UNAVAILABLE",
  "DOM_STATE_PREDICATE_FAILED",
  "DOM_STATE_TIMEOUT",
  "REMOTE_CONTROL_UNAVAILABLE",
  "RESET_UNAVAILABLE",
  "SESSION_CLOSE_FAILED",
  "SESSION_CLOSED",
  "SESSION_UNAVAILABLE",
  "TV_CLEANUP_FAILED",
  "VISUAL_CAPTURE_UNAVAILABLE",
]);

function classifyTvFailure(error) {
  const code = typeof error?.code === "string" ? error.code : "TV_TECHNICAL_UNKNOWN";
  if (BUSINESS_CODES.has(code)) return {kind: TV_FAILURE_KIND.business, code};
  return {
    kind: TV_FAILURE_KIND.technical,
    code: TECHNICAL_CODES.has(code) ? code : "TV_TECHNICAL_UNKNOWN",
  };
}

module.exports = {BUSINESS_CODES, TECHNICAL_CODES, TV_FAILURE_KIND, classifyTvFailure};
