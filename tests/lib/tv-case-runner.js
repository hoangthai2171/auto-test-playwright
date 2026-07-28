"use strict";

const {createDomSession} = require("./tv-session/dom-session");
const {createTargetActionContext} = require("./target-action-context");
const {runTargetActions} = require("./target-action-runner");
const {classifyTvFailure} = require("./tv-failure-classification");

function requireReset(tvSession) {
  if (typeof tvSession?.resetAppState !== "function") {
    throw new TypeError("TvSession resetAppState() is required before every TV case.");
  }
}

async function runTvTestCase({tvSession, testInfo, helpers = {}, capabilities, testCase, source = "tv"} = {}) {
  requireReset(tvSession);
  const session = createDomSession({tvSession, capabilities});
  const context = createTargetActionContext({session, testInfo, helpers, capabilities});
  let result;
  let primaryError;

  try {
    await tvSession.resetAppState();
    result = await runTargetActions(context, testCase, {source});
  } catch (error) {
    primaryError = error;
    if (primaryError && typeof primaryError === "object") {
      primaryError.tvFailure = classifyTvFailure(primaryError);
    }
  } finally {
    try {
      if (typeof helpers.semantic?.logout !== "function") throw new Error("Trusted TV logout operation is unavailable.");
      await helpers.semantic.logout(session);
    } catch (cleanupError) {
      if (primaryError) {
        primaryError.tvLogoutCleanupError = cleanupError?.message || String(cleanupError);
      } else {
        const cleanupFailure = new Error(cleanupError?.message || String(cleanupError));
        const failedResult = result || {
          testCaseId: String(testCase?.id || ""),
          name: testCase?.name || "",
          status: "failed",
          source,
          steps: [],
          expectedResult: testCase?.expectedResult || "",
        };
        failedResult.status = "failed";
        failedResult.steps.push({
          index: failedResult.steps.length,
          action: "logout_cleanup",
          status: "failed",
          durationMs: 0,
          message: cleanupFailure.message,
        });
        cleanupFailure.testCaseResult = failedResult;
        primaryError = cleanupFailure;
      }
    }
  }

  if (primaryError) throw primaryError;
  return result;
}

module.exports = {runTvTestCase};
