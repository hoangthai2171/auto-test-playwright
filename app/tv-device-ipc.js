"use strict";

const {trustedLgCliArchive} = require("./lg-toolchain-manifest");

const INSTALL_PROGRESS_CODES = new Set([
  "preparing",
  "downloading-node",
  "verifying-node",
  "extracting-node",
  "installing-appium",
  "verifying-lg-driver",
  "downloading-chromedriver",
  "verifying-chromedriver-archive",
  "extracting-chromedriver",
  "verifying-chromedriver",
  "activating",
  "complete",
]);
const INSTALL_PROGRESS_FAILURES = new Set([
  "INSTALL_INPUT_INVALID",
  "DOWNLOAD_FAILED",
  "CHECKSUM_MISMATCH",
  "EXTRACTION_FAILED",
  "DEPENDENCY_INSTALL_FAILED",
  "VERIFICATION_FAILED",
  "ACTIVATION_FAILED",
  "INSTALL_FAILED",
]);

function publicInstallProgress(event) {
  const code = String(event?.code || "");
  if (INSTALL_PROGRESS_CODES.has(code)) return {code};
  const status = String(event?.status || "");
  if (code === "failed" && INSTALL_PROGRESS_FAILURES.has(status)) return {code, status};
  return null;
}

function redactValue(redact, value) {
  if (Array.isArray(value)) return value.map((item) => redactValue(redact, item));
  if (typeof value === "string") return redact(value);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(?:host|hostname|lastKnownHost|webosSdkHome|appiumHome|appiumBin|chromedriverPath|archivePath|path|url|helpUrl|managedRoot|stdout|stderr|request|response)$/u.test(key))
    .map(([key, item]) => [key, redactValue(redact, item)]));
}

function publicLgToolchainReview(review) {
  const components = Array.isArray(review?.components)
    ? review.components.map(({id, label, status, version}) => ({id, label, status, version}))
    : [];
  return {
    ok: true,
    source: "managed",
    state: review?.state === "ready" ? "ready" : "missing",
    components,
  };
}

function publicLgToolchainInstallResult(result) {
  if (!result?.ok) {
    const status = /^[A-Z_]+$/u.test(String(result?.status || "")) ? result.status : "INSTALL_FAILED";
    const verification = status === "VERIFICATION_FAILED" && new Set(["NODE_UNVERIFIED", "APPIUM_UNVERIFIED", "LG_DRIVER_UNVERIFIED", "CHROMEDRIVER_UNVERIFIED"]).has(result?.verification)
      ? result.verification
      : undefined;
    return {ok: false, status, ...(verification ? {verification} : {})};
  }
  return {
    ok: true,
    ...(result.state === "ready" || result.state === "installable" ? {state: result.state} : {}),
    components: Array.isArray(result.components)
      ? result.components.map(({id, label, status, version}) => ({id, label, status, version}))
      : [],
  };
}

function publicCompatibilityCatalogStatus(result) {
  if (!result?.ok) {
    return {ok: false, status: ["CATALOG_REFRESH_UNAVAILABLE", "CATALOG_REFRESH_FAILED", "CATALOG_INVALID"].includes(result?.status)
      ? result.status
      : "CATALOG_REFRESH_FAILED"};
  }
  return {
    ok: true,
    state: result.state === "available" ? "available" : "unavailable",
    source: result.source === "cached" ? "cached" : "bundled",
    refreshedAt: typeof result.refreshedAt === "string" ? result.refreshedAt : null,
    profileCount: Number.isSafeInteger(result.profileCount) && result.profileCount >= 0 ? result.profileCount : 0,
  };
}

function registerTvDeviceIpc({ipcMain, deviceProfiles, connectionChecker, toolchain, toolchainConfig, lgToolchainDetector, lgToolchainInstaller, lgCliArchiveImporter, lgCliPlatform = process.platform, resolveLgCompatibilityProfile, compatibilityCatalog, dialog, shell, redact} = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") throw new Error("An Electron ipcMain.handle implementation is required.");
  if (!deviceProfiles || typeof deviceProfiles.listPublicProfiles !== "function" || typeof deviceProfiles.validateAndSave !== "function") {
    throw new Error("A redacted TV device profile service is required.");
  }
  if (typeof redact !== "function") throw new Error("A TV device diagnostic redactor is required.");

  ipcMain.handle("list-tv-devices", async () => {
    try {
      return {ok: true, devices: await deviceProfiles.listPublicProfiles()};
    } catch (error) {
      return {ok: false, message: redact(error?.message || "Could not list TV devices.")};
    }
  });

  ipcMain.handle("validate-and-save-tv-device", async (_event, candidate) => {
    try {
      return redactValue(redact, await deviceProfiles.validateAndSave(candidate));
    } catch {
      return {ok: false, status: "VALIDATION_FAILED"};
    }
  });

  ipcMain.handle("check-tv-device-connection", async (_event, request) => {
    const deviceId = typeof request?.deviceId === "string" ? request.deviceId.trim() : "";
    if (!deviceId || !connectionChecker || typeof connectionChecker.check !== "function") {
      return {ok: false, status: "DEVICE_NOT_FOUND"};
    }
    try {
      return redactValue(redact, await connectionChecker.check({deviceId}));
    } catch {
      return {ok: false, status: "CONNECTION_UNAVAILABLE"};
    }
  });

  ipcMain.handle("open-lg-cli-download-page", async () => {
    try {
      if (!shell || typeof shell.openExternal !== "function") return {ok: false, status: "LG_CLI_IMPORT_UNAVAILABLE"};
      await shell.openExternal(trustedLgCliArchive(lgCliPlatform).helpUrl);
      return {ok: true};
    } catch {
      return {ok: false, status: "LG_CLI_IMPORT_UNAVAILABLE"};
    }
  });

  ipcMain.handle("choose-lg-cli-archive", async () => {
    try {
      if (!dialog || typeof dialog.showOpenDialog !== "function" || !lgCliArchiveImporter || typeof lgCliArchiveImporter.importArchive !== "function") {
        return {ok: false, status: "LG_CLI_IMPORT_UNAVAILABLE"};
      }
      const archive = trustedLgCliArchive(lgCliPlatform);
      const extension = archive.archiveName.endsWith(".tgz") ? "tgz" : "zip";
      const selected = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{name: "LG webOS TV CLI", extensions: [extension]}],
      });
      if (selected?.canceled || !Array.isArray(selected?.filePaths) || selected.filePaths.length !== 1) {
        return {ok: false, status: "LG_CLI_SELECTION_CANCELLED"};
      }
      return redactValue(redact, await lgCliArchiveImporter.importArchive({archivePath: selected.filePaths[0], confirmed: true}));
    } catch {
      return {ok: false, status: "LG_CLI_IMPORT_FAILED"};
    }
  });

  ipcMain.handle("get-tv-toolchain-configuration", async () => {
    try {
      if (!toolchainConfig || typeof toolchainConfig.status !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE", message: "Local LG toolchain configuration is unavailable."};
      }
      return {ok: true, ...redactValue(redact, await toolchainConfig.status())};
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE", message: "Local LG toolchain configuration is unavailable."};
    }
  });

  ipcMain.handle("save-tv-toolchain-configuration", async (_event, configuration) => {
    try {
      if (!toolchainConfig || typeof toolchainConfig.save !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE", message: "Local LG toolchain configuration is unavailable."};
      }
      return {ok: true, ...redactValue(redact, await toolchainConfig.save(configuration))};
    } catch (error) {
      return {ok: false, status: error?.code === "TOOLCHAIN_INVALID" ? "TOOLCHAIN_INVALID" : "TOOLCHAIN_UNAVAILABLE", message: "Local LG toolchain configuration could not be saved."};
    }
  });

  ipcMain.handle("inspect-tv-toolchain", async () => {
    try {
      if (!toolchain || typeof toolchain.inspect !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE", message: "The local LG toolchain inspector is unavailable."};
      }
      return redactValue(redact, await toolchain.inspect());
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE", message: "The local LG toolchain inspector is unavailable."};
    }
  });

  ipcMain.handle("plan-lg-toolchain-setup", async () => {
    try {
      if (!lgToolchainDetector || typeof lgToolchainDetector.inspect !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
      }
      return publicLgToolchainReview(await lgToolchainDetector.inspect());
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    }
  });

  ipcMain.handle("get-lg-toolchain-status", async () => {
    try {
      if (!lgToolchainDetector || typeof lgToolchainDetector.inspect !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
      }
      return publicLgToolchainReview(await lgToolchainDetector.inspect());
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    }
  });

  ipcMain.handle("get-lg-compatibility-catalog-status", async () => {
    try {
      if (!compatibilityCatalog || typeof compatibilityCatalog.status !== "function") return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
      return publicCompatibilityCatalogStatus(await compatibilityCatalog.status());
    } catch {
      return {ok: false, status: "CATALOG_REFRESH_FAILED"};
    }
  });

  ipcMain.handle("refresh-lg-compatibility-catalog", async (_event, request) => {
    try {
      if (!compatibilityCatalog || typeof compatibilityCatalog.refresh !== "function") return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
      return publicCompatibilityCatalogStatus(await compatibilityCatalog.refresh({
        apiDomain: String(request?.apiDomain || ""),
        authorization: String(request?.authorization || ""),
        timeoutMs: Number(request?.timeoutMs),
      }));
    } catch {
      return {ok: false, status: "CATALOG_REFRESH_FAILED"};
    }
  });

  ipcMain.handle("install-lg-toolchain", async (_event, request) => {
    if (request?.confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
    try {
      if (!lgToolchainInstaller || typeof lgToolchainInstaller.install !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
      }
      const deviceId = typeof request?.deviceId === "string" ? request.deviceId.trim() : "";
      let chromedriverArtifact;
      if (deviceId) {
        if (typeof resolveLgCompatibilityProfile !== "function") return {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
        const compatibility = await resolveLgCompatibilityProfile({deviceId});
        if (compatibility?.status !== "verified" || !compatibility.artifact) return {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
        chromedriverArtifact = compatibility.artifact;
      }
      const onProgress = (event) => {
        const safeEvent = publicInstallProgress(event);
        if (safeEvent && typeof _event?.sender?.send === "function") {
          _event.sender.send("lg-toolchain-install-progress", safeEvent);
        }
      };
      return redactValue(redact, publicLgToolchainInstallResult(await lgToolchainInstaller.install({
        confirmed: true,
        ...(chromedriverArtifact ? {chromedriverArtifact} : {}),
        onProgress,
      })));
    } catch {
      return {ok: false, status: "INSTALL_FAILED"};
    }
  });

  ipcMain.handle("activate-managed-lg-toolchain", async () => {
    try {
      if (!toolchainConfig || typeof toolchainConfig.activateManaged !== "function") {
        return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
      }
      return {ok: true, ...redactValue(redact, await toolchainConfig.activateManaged())};
    } catch {
      return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    }
  });

}

module.exports = {registerTvDeviceIpc};
