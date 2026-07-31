"use strict";

const path = require("node:path");

const COMPATIBILITY_GATE_ACTIONS = new Set([
  "wait_for_ready",
  "press_ok",
  "press_back",
  "assert_screen",
  "login",
  "open_home",
  "open_search",
  "search_content",
  "play_search_result",
]);
const COMPATIBILITY_FAILED_ACTIONS = new Set([
  "wait_for_ready",
  "login",
  "open_home",
  "open_search",
  "search_content",
  "play_search_result",
  "press_ok",
  "press_back",
  "assert_screen",
  "logout_cleanup",
]);
const COMPATIBILITY_FAILED_CODES = new Set([
  "SESSION_UNAVAILABLE",
  "DOM_INSPECTION_UNAVAILABLE",
  "VISUAL_CAPTURE_UNAVAILABLE",
  "TV_RUN_FAILED",
  "TV_CLEANUP_FAILED",
]);
const COMPATIBILITY_APPIUM_FAILURE_CODES = new Set([
  "APPIUM_CAPABILITIES",
  "APPIUM_CHROMEDRIVER",
  "APPIUM_DEVICE_CONNECTION",
  "APPIUM_DRIVER",
  "APPIUM_SESSION",
]);
const COMPATIBILITY_APPIUM_CAPABILITY_FAILURE = /^APPIUM_CAPABILITY_(?:APP_ID|APP_LAUNCH_PARAMS|AUTO_EXTEND_DEV_MODE|AUTOMATION_NAME|CHROMEDRIVER_EXECUTABLE|DEVICE_HOST|DEVICE_NAME|FULL_RESET|NO_RESET|PLATFORM_NAME|RC_MODE|REMOTE_ONLY|USE_SECURE_WEBSOCKET)$/u;
const COMPATIBILITY_FAILED_STAGES = new Set([
  "attempt-claim",
  "temporary-driver-create",
  "chromedriver-download",
  "chromedriver-archive-verify",
  "chromedriver-extract",
  "chromedriver-binary-verify",
  "target-acquire",
  "identity-check",
  "case-run",
  "preflight-ready",
  "appium-started",
  "session-creating",
  "session-starting",
  "session-started",
  "case-started",
  "case-finished",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validCase(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function supportedCompatibilityCase(value) {
  return Array.isArray(value?.actions)
    && value.actions.every((action) => COMPATIBILITY_GATE_ACTIONS.has(action?.action));
}

function failedCompatibilityAction(error) {
  const steps = error?.testCaseResult?.steps;
  if (!Array.isArray(steps)) return "";
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step?.status !== "failed") continue;
    const action = text(step?.action);
    if (COMPATIBILITY_FAILED_ACTIONS.has(action)) return action;
    return "";
  }
  return "";
}

function failedCompatibilityCode(error) {
  const code = text(error?.code);
  return COMPATIBILITY_FAILED_CODES.has(code) ? code : "";
}

function failedCompatibilityAppiumCode(error) {
  const code = text(error?.failureCode);
  return COMPATIBILITY_APPIUM_FAILURE_CODES.has(code) || COMPATIBILITY_APPIUM_CAPABILITY_FAILURE.test(code) ? code : "";
}

function failedCompatibilityStage(error) {
  const stage = text(error?.lifecycleStage);
  return COMPATIBILITY_FAILED_STAGES.has(stage) ? stage : "";
}

function requiredDependency(value, name, method) {
  if (!value || typeof value[method] !== "function") {
    throw new Error(`An injected ${name} with ${method}() is required.`);
  }
}

function createLgCompatibilityValidation({
  attempts,
  temporaryTarget,
  adapter,
  downloadArtifact,
  verifyArchive,
  extractChromeDriver,
  verifyChromeDriver,
  runCase,
  createTempDir,
  removeTempDir,
  platform = process.platform,
} = {}) {
  requiredDependency(attempts, "compatibility attempt service", "takeForValidation");
  requiredDependency(attempts, "compatibility attempt service", "discard");
  requiredDependency(temporaryTarget, "temporary LG target service", "acquire");
  requiredDependency(adapter, "read-only LG device adapter", "deviceInfo");
  for (const [name, dependency] of Object.entries({downloadArtifact, verifyArchive, extractChromeDriver, verifyChromeDriver, runCase, createTempDir, removeTempDir})) {
    if (typeof dependency !== "function") throw new Error(`An injected ${name} function is required.`);
  }
  if (!new Set(["darwin", "win32"]).has(platform)) throw new Error("LG compatibility validation supports only macOS and Windows.");

  return Object.freeze({
    async validate({attemptId, confirmed, testCase} = {}) {
      if (confirmed !== true) return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
      if (!validCase(testCase)) return {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"};
      if (!supportedCompatibilityCase(testCase)) return {ok: false, status: "LG_COMPATIBILITY_CASE_UNSUPPORTED"};

      const id = text(attemptId);
      let root = "";
      let lease;
      let validationStage = "";
      try {
        validationStage = "attempt-claim";
        const taken = await attempts.takeForValidation({attemptId: id});
        if (!taken?.ok || !taken.attempt) return {ok: false, status: "ATTEMPT_NOT_FOUND"};
        const attempt = taken.attempt;
        validationStage = "temporary-driver-create";
        root = await createTempDir();
        if (!text(root)) return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};

        validationStage = "chromedriver-download";
        const archivePath = await downloadArtifact({artifact: attempt.artifact, destination: root});
        validationStage = "chromedriver-archive-verify";
        if (await verifyArchive({archivePath, artifact: attempt.artifact}) !== true) {
          return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};
        }
        const chromedriverRoot = path.join(root, "chromedriver");
        validationStage = "chromedriver-extract";
        await extractChromeDriver({archivePath, destination: chromedriverRoot});
        validationStage = "chromedriver-binary-verify";
        if (await verifyChromeDriver({chromedriverRoot, version: attempt.artifact?.version}) !== true) {
          return {ok: false, status: "TEMPORARY_DRIVER_UNAVAILABLE"};
        }

        validationStage = "target-acquire";
        lease = await temporaryTarget.acquire({host: attempt.host, passphrase: attempt.passphrase});
        if (!lease?.ok || !text(lease.targetName) || typeof lease.release !== "function") {
          return {ok: false, status: "CONNECTION_UNAVAILABLE"};
        }
        validationStage = "identity-check";
        const info = await adapter.deviceInfo({deviceName: lease.targetName});
        if (text(info?.model) !== attempt.model || text(info?.firmware) !== attempt.firmware) {
          return {ok: false, status: "DEVICE_IDENTITY_MISMATCH"};
        }
        validationStage = "case-run";
        await runCase({
          testCase,
          model: attempt.model,
          firmware: attempt.firmware,
          connection: Object.freeze({
            deviceName: lease.targetName,
            deviceHost: attempt.host,
            chromedriverPath: path.join(chromedriverRoot, platform === "win32" ? "chromedriver.exe" : "chromedriver"),
            remoteOnly: false,
            rcMode: "rc",
          }),
        });
        return {ok: true, status: "VALIDATION_PASSED"};
      } catch (error) {
        const response = {ok: false, status: "VALIDATION_FAILED"};
        const action = failedCompatibilityAction(error);
        if (action) response.failedAction = action;
        const code = failedCompatibilityCode(error);
        if (code) response.failureCode = code;
        const appiumFailureCode = failedCompatibilityAppiumCode(error);
        if (appiumFailureCode) response.appiumFailureCode = appiumFailureCode;
        const stage = failedCompatibilityStage(error) || (COMPATIBILITY_FAILED_STAGES.has(validationStage) ? validationStage : "");
        if (stage) response.failureStage = stage;
        return response;
      } finally {
        if (lease?.release) {
          try {
            await lease.release();
          } catch {
            // A failed cleanup cannot disclose or retain the transient runtime values.
          }
        }
        if (root) {
          try {
            await removeTempDir(root);
          } catch {
            // A failed cleanup cannot disclose or retain the transient runtime values.
          }
        }
        try {
          await attempts.discard({attemptId: id});
        } catch {
          // The in-memory attempt service treats discard as idempotent.
        }
      }
    },
  });
}

module.exports = {createLgCompatibilityValidation};
