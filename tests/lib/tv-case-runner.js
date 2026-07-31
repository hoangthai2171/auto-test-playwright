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

const PROGRESS_CODES = new Set(["case-reset", "action-complete", "action-failed", "case-cleanup"]);

function frameDataUrl(value) {
  if (Buffer.isBuffer(value)) return `data:image/png;base64,${value.toString("base64")}`;
  if (ArrayBuffer.isView(value)) return `data:image/png;base64,${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64")}`;
  const text = typeof value === "string" ? value.trim() : "";
  if (/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(text)) return text;
  if (/^[A-Za-z0-9+/]+={0,2}$/u.test(text)) return `data:image/png;base64,${text}`;
  return "";
}

async function safeNotify(callback, value) {
  if (typeof callback !== "function") return;
  try {
    await callback(value);
  } catch {
    // Informational callbacks cannot alter trusted case execution.
  }
}

async function runTvTestCase({tvSession, testInfo, helpers = {}, capabilities, testCase, source = "tv", onProgress, onFrame} = {}) {
  requireReset(tvSession);
  const session = createDomSession({tvSession, capabilities});
  const context = createTargetActionContext({session, testInfo, helpers, capabilities});
  let result;
  let primaryError;

  const emitProgress = async (event) => {
    if (!PROGRESS_CODES.has(event?.code)) return;
    const publicEvent = {code: event.code};
    if (Number.isInteger(event.actionIndex) && event.actionIndex >= 0) publicEvent.actionIndex = event.actionIndex;
    await safeNotify(onProgress, publicEvent);
  };
  const captureFrame = async () => {
    if (typeof tvSession?.screenshot !== "function") return;
    try {
      const frame = frameDataUrl(await tvSession.screenshot());
      if (frame) await safeNotify(onFrame, frame);
    } catch {
      // Frames are supplementary; genuine execution remains authoritative.
    }
  };

  try {
    await tvSession.resetAppState();
    await emitProgress({code: "case-reset"});
    await captureFrame();
    result = await runTargetActions(context, testCase, {
      source,
      onStep: async ({status, actionIndex}) => {
        await emitProgress({code: status === "passed" ? "action-complete" : "action-failed", actionIndex});
        await captureFrame();
      },
    });
  } catch (error) {
    primaryError = error;
    if (primaryError && typeof primaryError === "object") {
      primaryError.tvFailure = classifyTvFailure(primaryError);
    }
  } finally {
    try {
      if (typeof helpers.semantic?.logout !== "function") throw new Error("Trusted TV logout operation is unavailable.");
      await helpers.semantic.logout();
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
    await emitProgress({code: "case-cleanup"});
  }

  if (primaryError) throw primaryError;
  return result;
}

module.exports = {runTvTestCase};
