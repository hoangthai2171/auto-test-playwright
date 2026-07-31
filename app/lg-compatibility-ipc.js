"use strict";

const INSPECTION_STATUSES = new Set([
  "INSPECTION_CONFIRMATION_REQUIRED",
  "INSPECTION_INPUT_INVALID",
  "CONNECTION_UNAVAILABLE",
  "INSPECTION_FAILED",
  "COMPATIBILITY_PROFILE_UNVERIFIED",
  "COMPATIBILITY_VERIFIED",
]);
const VALIDATION_STATUSES = new Set([
  "VALIDATION_CONFIRMATION_REQUIRED",
  "LG_COMPATIBILITY_CASE_UNSUPPORTED",
  "LG_COMPATIBILITY_CREDENTIALS_REQUIRED",
  "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE",
  "ATTEMPT_NOT_FOUND",
  "TEMPORARY_DRIVER_UNAVAILABLE",
  "CONNECTION_UNAVAILABLE",
  "DEVICE_IDENTITY_MISMATCH",
  "VALIDATION_FAILED",
  "VALIDATION_PASSED",
]);
const CREDENTIAL_STATUSES = new Set([
  "LG_COMPATIBILITY_CREDENTIALS_REQUIRED",
  "LG_COMPATIBILITY_CREDENTIALS_INVALID",
  "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE",
  "LG_COMPATIBILITY_CREDENTIALS_SAVED",
]);
const FAILED_ACTIONS = new Set([
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
const FAILED_CODES = new Set([
  "SESSION_UNAVAILABLE",
  "DOM_INSPECTION_UNAVAILABLE",
  "VISUAL_CAPTURE_UNAVAILABLE",
  "TV_RUN_FAILED",
  "TV_CLEANUP_FAILED",
]);
const APPIUM_FAILURE_CODES = new Set([
  "APPIUM_CAPABILITIES",
  "APPIUM_CHROMEDRIVER",
  "APPIUM_DEVICE_CONNECTION",
  "APPIUM_DRIVER",
  "APPIUM_SESSION",
]);
const APPIUM_CAPABILITY_FAILURE = /^APPIUM_CAPABILITY_(?:APP_ID|APP_LAUNCH_PARAMS|AUTO_EXTEND_DEV_MODE|AUTOMATION_NAME|CHROMEDRIVER_EXECUTABLE|DEVICE_HOST|DEVICE_NAME|FULL_RESET|NO_RESET|PLATFORM_NAME|RC_MODE|REMOTE_ONLY|USE_SECURE_WEBSOCKET)$/u;
const FAILED_STAGES = new Set([
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
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const DEVICE_FACT = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/u;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeId(value) {
  const id = text(value);
  return OPAQUE_ID.test(id) ? id : "";
}

function safeFact(value) {
  const fact = text(value);
  return DEVICE_FACT.test(fact) ? fact : "";
}

function publicInspection(value) {
  const status = INSPECTION_STATUSES.has(value?.status) ? value.status : "INSPECTION_FAILED";
  if (status === "COMPATIBILITY_VERIFIED" && value?.ok === true) {
    const attemptId = safeId(value.attemptId);
    const model = safeFact(value.model);
    const firmware = safeFact(value.firmware);
    return attemptId && model && firmware
      ? {ok: true, status, attemptId, model, firmware}
      : {ok: false, status: "INSPECTION_FAILED"};
  }
  if (status === "COMPATIBILITY_PROFILE_UNVERIFIED") {
    const model = safeFact(value?.model);
    const firmware = safeFact(value?.firmware);
    return model && firmware
      ? {ok: false, status, model, firmware}
      : {ok: false, status: "INSPECTION_FAILED"};
  }
  return {ok: false, status};
}

function publicValidation(value) {
  const status = VALIDATION_STATUSES.has(value?.status) ? value.status : "VALIDATION_FAILED";
  const response = {ok: value?.ok === true && status === "VALIDATION_PASSED", status};
  if (!response.ok) {
    const failedAction = typeof value?.failedAction === "string" ? value.failedAction.trim() : "";
    if (FAILED_ACTIONS.has(failedAction)) response.failedAction = failedAction;
    const failureCode = typeof value?.failureCode === "string" ? value.failureCode.trim() : "";
    if (FAILED_CODES.has(failureCode)) response.failureCode = failureCode;
    const appiumFailureCode = typeof value?.appiumFailureCode === "string" ? value.appiumFailureCode.trim() : "";
    if (APPIUM_FAILURE_CODES.has(appiumFailureCode) || APPIUM_CAPABILITY_FAILURE.test(appiumFailureCode)) response.appiumFailureCode = appiumFailureCode;
    const failureStage = typeof value?.failureStage === "string" ? value.failureStage.trim() : "";
    if (FAILED_STAGES.has(failureStage)) response.failureStage = failureStage;
  }
  return response;
}

function publicCredentialStatus(value) {
  const status = CREDENTIAL_STATUSES.has(value?.status) ? value.status : "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE";
  return {ok: value?.ok === true && status === "LG_COMPATIBILITY_CREDENTIALS_SAVED", status};
}

function requireDependency(value, name, method) {
  if (!value || typeof value[method] !== "function") throw new Error(`An injected ${name} with ${method}() is required.`);
}

function registerLgCompatibilityIpc({ipcMain, attempts, validation, compatibilityCredentials, createProductGateCase, redact} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");
  requireDependency(attempts, "compatibility attempt service", "inspect");
  requireDependency(attempts, "compatibility attempt service", "discard");
  requireDependency(validation, "compatibility validation service", "validate");
  requireDependency(compatibilityCredentials, "LG compatibility credentials", "status");
  requireDependency(compatibilityCredentials, "LG compatibility credentials", "save");
  requireDependency(compatibilityCredentials, "LG compatibility credentials", "load");
  if (typeof createProductGateCase !== "function") throw new Error("An LG compatibility product-gate case factory is required.");
  if (typeof redact !== "function") throw new Error("An LG compatibility redactor is required.");

  async function discard(attemptId) {
    try {
      await attempts.discard({attemptId: safeId(attemptId)});
    } catch {
      // Attempt cleanup is intentionally idempotent and has no renderer-visible details.
    }
  }

  ipcMain.handle("inspect-lg-compatibility-device", async (_event, request) => {
    if (request?.confirmed !== true) return {ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED"};
    try {
      return publicInspection(await attempts.inspect({
        confirmed: true,
        label: text(request?.label),
        host: text(request?.host),
        passphrase: String(request?.passphrase || ""),
      }));
    } catch {
      return {ok: false, status: "INSPECTION_FAILED"};
    }
  });

  ipcMain.handle("get-lg-compatibility-product-gate-status", async () => {
    try {
      return publicCredentialStatus(await compatibilityCredentials.status());
    } catch {
      return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
    }
  });

  ipcMain.handle("save-lg-compatibility-product-gate-credentials", async (_event, request) => {
    try {
      return publicCredentialStatus(await compatibilityCredentials.save({
        username: text(request?.username),
        password: String(request?.password || ""),
      }));
    } catch {
      return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
    }
  });

  ipcMain.handle("run-lg-compatibility-validation", async (_event, request) => {
    if (request?.confirmed !== true) return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
    const attemptId = safeId(request?.attemptId);
    if (!attemptId) {
      await discard(attemptId);
      return {ok: false, status: "ATTEMPT_NOT_FOUND"};
    }
    let credentials;
    try {
      credentials = await compatibilityCredentials.load();
    } catch {
      await discard(attemptId);
      return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_UNAVAILABLE"};
    }
    if (!credentials) {
      await discard(attemptId);
      return {ok: false, status: "LG_COMPATIBILITY_CREDENTIALS_REQUIRED"};
    }
    try {
      const testCase = createProductGateCase(credentials);
      return publicValidation(await validation.validate({attemptId, confirmed: true, testCase}));
    } catch (error) {
      await discard(attemptId);
      const response = {ok: false, status: "VALIDATION_FAILED"};
      const failedAction = typeof error?.failedAction === "string" ? error.failedAction.trim() : "";
      if (FAILED_ACTIONS.has(failedAction)) response.failedAction = failedAction;
      const failureCode = typeof error?.code === "string" ? error.code.trim() : "";
      if (FAILED_CODES.has(failureCode)) response.failureCode = failureCode;
      const appiumFailureCode = typeof error?.failureCode === "string" ? error.failureCode.trim() : "";
      if (APPIUM_FAILURE_CODES.has(appiumFailureCode) || APPIUM_CAPABILITY_FAILURE.test(appiumFailureCode)) response.appiumFailureCode = appiumFailureCode;
      const failureStage = typeof error?.lifecycleStage === "string" ? error.lifecycleStage.trim() : "";
      if (FAILED_STAGES.has(failureStage)) response.failureStage = failureStage;
      return publicValidation(response);
    }
  });

  ipcMain.handle("discard-lg-compatibility-attempt", async (_event, request) => {
    await discard(request?.attemptId);
    return {ok: true};
  });
}

module.exports = {registerLgCompatibilityIpc};
