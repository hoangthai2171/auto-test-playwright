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
  "LG_COMPATIBILITY_CASE_REQUIRED",
  "ATTEMPT_NOT_FOUND",
  "TEMPORARY_DRIVER_UNAVAILABLE",
  "CONNECTION_UNAVAILABLE",
  "DEVICE_IDENTITY_MISMATCH",
  "VALIDATION_FAILED",
  "VALIDATION_PASSED",
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
  return {ok: value?.ok === true && status === "VALIDATION_PASSED", status};
}

function validCase(value) {
  return value && typeof value === "object" && !Array.isArray(value) && text(value.id);
}

function requireDependency(value, name, method) {
  if (!value || typeof value[method] !== "function") throw new Error(`An injected ${name} with ${method}() is required.`);
}

function registerLgCompatibilityIpc({ipcMain, attempts, validation, loadTrustedCase, redact} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");
  requireDependency(attempts, "compatibility attempt service", "inspect");
  requireDependency(attempts, "compatibility attempt service", "discard");
  requireDependency(validation, "compatibility validation service", "validate");
  if (typeof loadTrustedCase !== "function") throw new Error("A trusted LG compatibility case loader is required.");
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

  ipcMain.handle("run-lg-compatibility-validation", async (_event, request) => {
    if (request?.confirmed !== true) return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
    const attemptId = safeId(request?.attemptId);
    const selectedCaseId = text(request?.selectedCaseId);
    const folderId = text(request?.folderId);
    if (!attemptId || !selectedCaseId) {
      await discard(attemptId);
      return {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"};
    }
    let testCase;
    try {
      testCase = await loadTrustedCase({selectedCaseId, ...(folderId ? {folderId} : {})});
    } catch {
      testCase = null;
    }
    if (!validCase(testCase) || text(testCase.id) !== selectedCaseId) {
      await discard(attemptId);
      return {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"};
    }
    try {
      return publicValidation(await validation.validate({attemptId, confirmed: true, testCase}));
    } catch {
      await discard(attemptId);
      return {ok: false, status: "VALIDATION_FAILED"};
    }
  });

  ipcMain.handle("discard-lg-compatibility-attempt", async (_event, request) => {
    await discard(request?.attemptId);
    return {ok: true};
  });
}

module.exports = {registerLgCompatibilityIpc};
