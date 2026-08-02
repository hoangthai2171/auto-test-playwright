"use strict";

const {validateTargetCaseCapabilities} = require("../tests/lib/target-action-runner");
const {TV_FAILURE_KIND, classifyTvFailure} = require("../tests/lib/tv-failure-classification");
const {DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS, normalizePlayerCheckTimeoutSeconds} = require("./test-configuration");

const SAFE_EVENT_CODES = new Set([
  "preflight",
  "case-started",
  "case-retry",
  "case-finished",
  "recovery-required",
  "batch-finished",
  "stopped",
]);
const TV_CAPABILITIES = Object.freeze({
  domInspection: true,
  visualCapture: true,
  targetSemanticActions: true,
  playerInspection: true,
});

function batchError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueCaseIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => text(id)).filter(Boolean))];
}

function requireMethod(value, name, method) {
  if (!value || typeof value[method] !== "function") throw new Error(`An injected ${name} with ${method}() is required.`);
}

function safeExecutionResult(value, fallbackStatus) {
  const status = value?.caseResult?.status === "passed" || value?.status === "passed" ? "passed" : fallbackStatus;
  return Object.freeze({status});
}

function caseRun(testCase, {passed = false, stopped = false, executionResult, failure} = {}) {
  return Object.freeze({
    id: String(testCase.id),
    result: Object.freeze({
      passed,
      started: !stopped,
      stopped,
      executionResult: safeExecutionResult(executionResult, passed ? "passed" : "failed"),
      ...(failure ? {failure: Object.freeze({kind: failure.kind, code: failure.code})} : {}),
    }),
  });
}

function createLgDesktopBatchRunner({preflight, tvRunner, loadCase, writeReportEntry = async () => {}, classifyFailure = classifyTvFailure, getPlayerCheckTimeoutSeconds = () => DEFAULT_PLAYER_CHECK_TIMEOUT_SECONDS} = {}) {
  requireMethod(preflight, "LG run preflight", "availability");
  requireMethod(preflight, "LG run preflight", "prepare");
  requireMethod(tvRunner, "LG TV runner", "run");
  if (typeof loadCase !== "function") throw new Error("An injected LG test case loader is required.");
  if (typeof writeReportEntry !== "function") throw new Error("An injected LG report writer is required.");
  if (typeof classifyFailure !== "function") throw new Error("An injected LG failure classifier is required.");

  let active = false;
  let stopRequested = false;
  let pendingRecovery;

  async function admit({selectedCaseIds, folderId}) {
    const ids = uniqueCaseIds(selectedCaseIds);
    if (!ids.length) throw batchError("LG_BATCH_INVALID", "Select at least one LG test case.");
    const cases = await Promise.all(ids.map(async (id) => {
      const testCase = await loadCase(id, folderId);
      if (!testCase) throw batchError("LG_BATCH_INVALID", "The selected LG test case is unavailable.");
      validateTargetCaseCapabilities(testCase, TV_CAPABILITIES);
      return testCase;
    }));
    return Object.freeze(cases);
  }

  function emit(callback, event) {
    if (SAFE_EVENT_CODES.has(event?.code) && typeof callback === "function") callback(event);
  }

  function waitForRecovery() {
    return new Promise((resolve) => { pendingRecovery = resolve; });
  }

  async function runCaseWithPolicy(testCase, runtime, onEvent, onFrame) {
    let attempts = 0;
    while (!stopRequested) {
      attempts += 1;
      emit(onEvent, {code: "case-started", caseId: String(testCase.id), attempt: Math.min(attempts, 3)});
      try {
        const executionResult = await tvRunner.run({
          profileId: runtime.profile.id,
          host: runtime.host,
          sharedDeviceAcknowledged: true,
          secureWebsocket: runtime.transport.secureWebsocket,
          allowSelfSignedTls: runtime.transport.allowSelfSignedTls,
          connection: runtime.connection,
          appium: runtime.appium,
          testCase,
          playerCheckTimeoutSeconds: normalizePlayerCheckTimeoutSeconds(getPlayerCheckTimeoutSeconds()),
          onFrame,
        });
        const result = caseRun(testCase, {passed: true, executionResult});
        await writeReportEntry({testCase, executionResult, result});
        emit(onEvent, {code: "case-finished", caseId: String(testCase.id), attempt: Math.min(attempts, 3)});
        return result;
      } catch (error) {
        const failure = classifyFailure(error);
        const executionResult = error?.testCaseResult || error;
        if (failure.kind === TV_FAILURE_KIND.business) {
          const result = caseRun(testCase, {executionResult, failure});
          await writeReportEntry({testCase, executionResult, result});
          emit(onEvent, {code: "case-finished", caseId: String(testCase.id), attempt: Math.min(attempts, 3)});
          return result;
        }
        const pairing = failure.code === "PAIRING_REQUIRED";
        if (!pairing && attempts < 3) {
          emit(onEvent, {code: "case-retry", caseId: String(testCase.id), attempt: attempts, reason: "technical"});
          continue;
        }
        emit(onEvent, {code: "recovery-required", caseId: String(testCase.id), attempt: Math.min(attempts, 3), reason: pairing ? "pairing" : "technical"});
        const action = await waitForRecovery();
        pendingRecovery = undefined;
        if (action === "stop" || stopRequested) return caseRun(testCase, {stopped: true});
        attempts = 0;
      }
    }
    return caseRun(testCase, {stopped: true});
  }

  return Object.freeze({
    async availability({deviceId, selectedCaseIds, folderId} = {}) {
      try {
        await admit({selectedCaseIds, folderId});
      } catch (error) {
        return {ok: false, status: error?.code === "ACTION_CAPABILITY_UNSUPPORTED" ? error.code : "LG_BATCH_INVALID"};
      }
      return preflight.availability({deviceId});
    },

    async start({deviceId, selectedCaseIds, folderId, confirmed, onEvent, onFrame} = {}) {
      if (confirmed !== true) throw batchError("LG_CONFIRMATION_REQUIRED", "Confirm the LG batch before it starts.");
      if (active) throw batchError("LG_BATCH_ACTIVE", "An LG batch is already active.");
      const cases = await admit({selectedCaseIds, folderId});
      active = true;
      stopRequested = false;
      try {
        emit(onEvent, {code: "preflight"});
        const prepared = await preflight.prepare({deviceId});
        const runtime = prepared?.runtime;
        if (!runtime?.profile?.id || !runtime?.transport) throw batchError("CONNECTION_UNAVAILABLE", "The selected LG device is unavailable.");
        const caseRuns = [];
        for (const testCase of cases) {
          if (stopRequested) {
            caseRuns.push(caseRun(testCase, {stopped: true}));
            break;
          }
          const result = await runCaseWithPolicy(testCase, runtime, onEvent, onFrame);
          caseRuns.push(result);
          if (result.result.stopped) break;
        }
        const stopped = caseRuns.some((item) => item.result.stopped);
        emit(onEvent, {code: stopped ? "stopped" : "batch-finished"});
        return Object.freeze({ok: true, caseRuns: Object.freeze(caseRuns), stopped});
      } finally {
        active = false;
        pendingRecovery = undefined;
      }
    },

    requestStop() {
      stopRequested = true;
      if (pendingRecovery) pendingRecovery("stop");
      return {ok: true};
    },

    async resolveRecovery({action} = {}) {
      if (!pendingRecovery || !["retry", "stop"].includes(action)) return {ok: false, status: "LG_RECOVERY_INVALID"};
      pendingRecovery(action);
      return {ok: true};
    },
  });
}

module.exports = {createLgDesktopBatchRunner, SAFE_EVENT_CODES};
