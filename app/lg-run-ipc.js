"use strict";

const SAFE_STATUS_CODES = new Set(["preflight", "case-started", "case-retry", "case-finished", "recovery-required", "batch-finished", "stopped"]);
const DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function caseIds(value) {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}

function requestPayload(value) {
  const deviceId = text(value?.deviceId);
  const selectedCaseIds = caseIds(value?.selectedCaseIds);
  const folderId = text(value?.folderId);
  const cacheKey = text(value?.cacheKey);
  return {deviceId, selectedCaseIds, ...(folderId ? {folderId} : {}), ...(cacheKey ? {cacheKey} : {})};
}

function safeResult(redact, value) {
  return {
    ok: value?.ok === true,
    ...(Array.isArray(value?.caseRuns) ? {caseRuns: value.caseRuns.map(({id, result}) => ({
      id: text(id),
      result: {
        passed: result?.passed === true,
        started: result?.started === true,
        stopped: result?.stopped === true,
        executionResult: {status: result?.executionResult?.status === "passed" ? "passed" : "failed"},
        ...(result?.failure?.kind && result?.failure?.code ? {failure: {kind: result.failure.kind, code: result.failure.code}} : {}),
      },
    }))} : {}),
    ...(typeof value?.stopped === "boolean" ? {stopped: value.stopped} : {}),
  };
}

function registerLgRunIpc({ipcMain, batchRunner, redact} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");
  if (!batchRunner || typeof batchRunner.availability !== "function" || typeof batchRunner.start !== "function" || typeof batchRunner.resolveRecovery !== "function") {
    throw new Error("An LG desktop batch runner is required.");
  }
  if (typeof redact !== "function") throw new Error("An LG IPC redactor is required.");

  const sendStatus = (sender, value) => {
    if (!SAFE_STATUS_CODES.has(value?.code) || typeof sender?.send !== "function") return;
    const event = {code: value.code};
    if (text(value.caseId)) event.caseId = text(value.caseId);
    if (Number.isInteger(value.attempt) && value.attempt >= 1 && value.attempt <= 3) event.attempt = value.attempt;
    if (["technical", "pairing"].includes(value.reason)) event.reason = value.reason;
    sender.send("lg-run-status", event);
  };
  const sendFrame = (sender, value) => {
    if (typeof sender?.send === "function" && typeof value === "string" && DATA_URL.test(value)) sender.send("lg-run-preview", value);
  };

  ipcMain.handle("get-lg-run-availability", async (_event, request) => {
    try {
      const payload = requestPayload(request);
      if (!payload.deviceId) return {ok: false, status: "DEVICE_NOT_FOUND"};
      const value = await batchRunner.availability(payload);
      return value?.ok === true && value?.status === "READY" ? {ok: true, status: "READY"} : {ok: false, status: text(value?.status) || "TOOLCHAIN_UNAVAILABLE"};
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    }
  });

  ipcMain.handle("run-lg-batch", async (event, request) => {
    const payload = requestPayload(request);
    if (!payload.deviceId || !payload.selectedCaseIds.length) return {ok: false, status: "LG_BATCH_INVALID"};
    if (request?.confirmed !== true) return {ok: false, status: "LG_CONFIRMATION_REQUIRED"};
    try {
      const value = await batchRunner.start({...payload, confirmed: true, onEvent: (status) => sendStatus(event?.sender, status), onFrame: (frame) => sendFrame(event?.sender, frame)});
      return safeResult(redact, value);
    } catch (error) {
      const status = ["LG_CONFIRMATION_REQUIRED", "LG_BATCH_ACTIVE", "LG_BATCH_INVALID", "ACTION_CAPABILITY_UNSUPPORTED", "CONNECTION_UNAVAILABLE"].includes(error?.code)
        ? error.code
        : "LG_BATCH_UNAVAILABLE";
      return {ok: false, status};
    }
  });

  ipcMain.handle("resolve-lg-run-recovery", async (_event, request) => {
    if (!["retry", "stop"].includes(request?.action)) return {ok: false, status: "LG_RECOVERY_INVALID"};
    try {
      const value = await batchRunner.resolveRecovery({action: request.action});
      return value?.ok === true ? {ok: true} : {ok: false, status: "LG_RECOVERY_INVALID"};
    } catch {
      return {ok: false, status: "LG_RECOVERY_INVALID"};
    }
  });
}

module.exports = {registerLgRunIpc};
