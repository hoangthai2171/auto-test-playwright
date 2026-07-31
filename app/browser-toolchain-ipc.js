"use strict";

const PROGRESS_CODES = new Set(["preparing", "downloading-chromium", "verifying-chromium", "complete"]);
const FAILURE_STATUSES = new Set(["DOWNLOAD_FAILED", "VERIFICATION_FAILED", "INSTALL_FAILED"]);

function publicResult(value) {
  if (!value?.ok) return {ok: false, status: FAILURE_STATUSES.has(value?.status) ? value.status : "INSTALL_FAILED"};
  const component = value.component || {};
  return {ok: true, state: value.state === "ready" ? "ready" : "missing", component: {id: component.id, label: component.label, version: component.version, status: component.status}};
}

function registerBrowserToolchainIpc({ipcMain, browserToolchain, browserInstaller} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");
  const status = async () => {
    if (!browserToolchain?.status) return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
    try { return publicResult(await browserToolchain.status()); } catch { return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"}; }
  };
  ipcMain.handle("get-browser-toolchain-status", status);
  ipcMain.handle("plan-browser-toolchain-setup", status);
  ipcMain.handle("install-browser-toolchain", async (event, request) => {
    if (request?.confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
    if (!browserInstaller?.install) return {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"};
    const onProgress = (value) => {
      const safe = PROGRESS_CODES.has(value?.code) ? {code: value.code} : value?.code === "failed" && FAILURE_STATUSES.has(value?.status) ? {code: "failed", status: value.status} : null;
      if (safe && typeof event?.sender?.send === "function") event.sender.send("browser-toolchain-install-progress", safe);
    };
    try { return publicResult(await browserInstaller.install({confirmed: true, onProgress})); } catch { return {ok: false, status: "INSTALL_FAILED"}; }
  });
}

module.exports = {registerBrowserToolchainIpc};
