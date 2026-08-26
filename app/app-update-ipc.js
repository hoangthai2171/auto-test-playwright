"use strict";

const CHECK_STATUSES = new Set([
  "UPDATE_CHECK_UNAVAILABLE",
  "UPDATE_CHECK_FAILED",
  "UPDATE_CHECK_TIMEOUT",
  "UPDATE_MANIFEST_INVALID",
  "UPDATE_PLATFORM_UNSUPPORTED",
  "UPDATE_ARTIFACT_UNAVAILABLE",
  "UPDATE_ARTIFACT_UNTRUSTED",
  "UPDATE_ARTIFACT_UNVERIFIABLE",
]);
const INSTALL_STATUSES = new Set([
  "UPDATE_NOT_CHECKED",
  "UPDATE_BLOCKED_BY_RUN",
  "UPDATE_VERSION_MISMATCH",
  "UPDATE_DOWNLOAD_FAILED",
  "UPDATE_VERIFICATION_FAILED",
  "UPDATE_ARCHIVE_INVALID",
  "UPDATE_INSTALL_FAILED",
  "UPDATE_INSTALL_UNSUPPORTED",
  "UPDATE_PLATFORM_UNSUPPORTED",
]);
const PROGRESS_CODES = new Set(["downloading", "verifying", "installing", "complete"]);
const MAX_CHANGELOG_ENTRIES = 60;

function checkFailure(status) {
  return {ok: false, status: CHECK_STATUSES.has(status) ? status : "UPDATE_CHECK_FAILED"};
}

// The renderer only ever sees release metadata: never the artifact URL, the
// staged file path, or the service token used to reach the server.
function publicCheckResult(value) {
  if (!value?.ok) return checkFailure(value?.status);
  if (!value.updateAvailable) {
    return {
      ok: true,
      updateAvailable: false,
      currentVersion: String(value.currentVersion || ""),
      version: String(value.version || ""),
    };
  }
  return {
    ok: true,
    updateAvailable: true,
    currentVersion: String(value.currentVersion || ""),
    version: String(value.version || ""),
    releaseName: String(value.releaseName || ""),
    changelog: (Array.isArray(value.changelog) ? value.changelog : []).slice(0, MAX_CHANGELOG_ENTRIES).map(String),
    mandatory: value.mandatory === true,
    downloadSize: Number.isSafeInteger(value.downloadSize) ? value.downloadSize : 0,
  };
}

function publicInstallResult(value) {
  if (!value?.ok) return {ok: false, status: INSTALL_STATUSES.has(value?.status) ? value.status : "UPDATE_INSTALL_FAILED"};
  return {ok: true, status: "UPDATE_INSTALL_STARTED"};
}

function publicProgress(value) {
  const code = String(value?.code || "");
  if (code === "failed") {
    return {code: "failed", status: INSTALL_STATUSES.has(value?.status) ? value.status : "UPDATE_INSTALL_FAILED"};
  }
  if (!PROGRESS_CODES.has(code)) return null;
  if (code !== "downloading") return {code};
  const percent = Number(value?.percent);
  return {
    code,
    percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0,
    receivedBytes: Number.isSafeInteger(value?.receivedBytes) ? value.receivedBytes : 0,
    totalBytes: Number.isSafeInteger(value?.totalBytes) ? value.totalBytes : 0,
  };
}

// resolveTimeoutMs receives seconds, matching flow-case-api's normalizeTimeoutMs,
// so the renderer sends API_TIMEOUT_SECONDS and never a millisecond value.
function registerAppUpdateIpc({ipcMain, appUpdateService, resolveTimeoutMs = (value) => value, canInstall = () => true} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");

  ipcMain.handle("check-app-update", async (_event, request = {}) => {
    if (!appUpdateService?.check) return {ok: false, status: "UPDATE_CHECK_UNAVAILABLE"};
    try {
      return publicCheckResult(await appUpdateService.check({
        apiDomain: request?.apiDomain,
        authorization: request?.authorization,
        timeoutMs: resolveTimeoutMs(request?.timeoutSeconds),
      }));
    } catch {
      return {ok: false, status: "UPDATE_CHECK_FAILED"};
    }
  });

  // Downloading and replacing the application is destructive, so it runs only
  // after the user confirmed the version they were shown, and never while a run
  // is active - installing quits the app and would abandon that run.
  ipcMain.handle("install-app-update", async (event, request = {}) => {
    if (request?.confirmed !== true) return {ok: false, status: "UPDATE_INSTALL_FAILED"};
    if (!appUpdateService?.install) return {ok: false, status: "UPDATE_INSTALL_FAILED"};
    let installable = false;
    try { installable = canInstall() === true; } catch { installable = false; }
    if (!installable) return {ok: false, status: "UPDATE_BLOCKED_BY_RUN"};
    const onProgress = (value) => {
      const safe = publicProgress(value);
      if (safe && typeof event?.sender?.send === "function") event.sender.send("app-update-progress", safe);
    };
    try {
      return publicInstallResult(await appUpdateService.install({version: request?.version, onProgress}));
    } catch {
      return {ok: false, status: "UPDATE_INSTALL_FAILED"};
    }
  });

  ipcMain.handle("cancel-app-update", async () => {
    try { appUpdateService?.cancel?.(); } catch {}
    return {ok: true};
  });
}

module.exports = {registerAppUpdateIpc, publicCheckResult, publicInstallResult, publicProgress};
