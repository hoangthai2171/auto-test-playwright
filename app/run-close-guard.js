"use strict";

function requiredCheck(value, name) {
  if (typeof value !== "function") throw new TypeError(`Run close guard ${name}() is required.`);
  return value;
}

function createRunCloseGuard({isRunning, hasUnsyncedResults, stopRun = async () => {}, discardUnsyncedResults = () => {}} = {}) {
  const running = requiredCheck(isRunning, "isRunning");
  const unsynced = requiredCheck(hasUnsyncedResults, "hasUnsyncedResults");

  async function requestClose() {
    if (running()) return {allow: false, reason: unsynced() ? "running_and_unsynced_results" : "running"};
    if (unsynced()) return {allow: false, reason: "unsynced_results"};
    return {allow: true};
  }

  async function resolve(action) {
    const current = await requestClose();
    if (current.allow || action === "keep_open") return {allow: false};
    if (current.reason === "running" || current.reason === "running_and_unsynced_results") {
      if (action !== "stop_run_and_close") return {allow: false};
      await stopRun();
      if (unsynced()) await discardUnsyncedResults();
      return {allow: true};
    }
    if (current.reason === "unsynced_results" && action === "close_and_discard_unsynced_retry") {
      await discardUnsyncedResults();
      return {allow: true};
    }
    return {allow: false};
  }

  return {requestClose, resolve};
}

module.exports = {createRunCloseGuard};
