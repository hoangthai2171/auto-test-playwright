"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {classifyTvFailure, TV_FAILURE_KIND} = require("../lib/tv-failure-classification");

test("classifies explicit product assertions as business failures", () => {
  const error = new Error("Requested content was not found.");
  error.code = "CONTENT_NOT_FOUND";

  assert.deepEqual(classifyTvFailure(error), {
    kind: TV_FAILURE_KIND.business,
    code: "CONTENT_NOT_FOUND",
  });
});

test("classifies explicit session failures and unknown failures as technical", () => {
  const sessionError = new Error("The Appium session was lost.");
  sessionError.code = "SESSION_UNAVAILABLE";

  assert.deepEqual(classifyTvFailure(sessionError), {
    kind: TV_FAILURE_KIND.technical,
    code: "SESSION_UNAVAILABLE",
  });
  assert.deepEqual(classifyTvFailure(new Error("untyped failure")), {
    kind: TV_FAILURE_KIND.technical,
    code: "TV_TECHNICAL_UNKNOWN",
  });
});
