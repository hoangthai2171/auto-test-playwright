"use strict";

const path = require("node:path");
const {normalizeRemoteKey, TvSessionError} = require("./tv-session");
const {normalizeDomState} = require("./dom-state");
const {createWebOsMyTvAutomation} = require("./webos-mytv-automation");

const INSTALLED_APP_ID = "com.mytvb2c.app";
const WEBOS_REMOTE_KEYS = Object.freeze({
  ok: "ENTER",
  back: "BACK",
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
});
const DOM_PROBE = `return {
  bodyText: (document.body && document.body.innerText) || "",
  focused: ((document.querySelector(".focused") || document.querySelector('[data-focused="true"]')) || {}).outerHTML || "",
  active: ((document.querySelector("#dialog_confirm_v2 .active, #dialog_alert_v2 .active, #dialog_alert_full .active, #dialog_confirm_full .active")) || {}).outerHTML || "",
  screenUrl: location.href
};`;

function assertInstalledAppId(appId) {
  if (appId !== INSTALLED_APP_ID) {
    throw new Error(`webOS sessions support only installed app ${INSTALLED_APP_ID}.`);
  }
  return appId;
}

function requiredRuntimeString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`A non-empty runtime webOS ${label} is required.`);
  }
  return value.trim();
}

function normalizeConnection(connection) {
  if (!connection || typeof connection !== "object") {
    throw new Error("Runtime webOS connection data is required.");
  }
  const deviceName = requiredRuntimeString(connection.deviceName, "device name");
  const deviceHost = requiredRuntimeString(connection.deviceHost, "device host");
  const chromedriverPath = requiredRuntimeString(connection.chromedriverPath, "ChromeDriver path");
  if (!path.isAbsolute(chromedriverPath)) {
    throw new Error("The runtime webOS ChromeDriver path must be absolute.");
  }
  if (connection.remoteOnly !== false) {
    throw new Error("Runtime webOS remoteOnly must be false for DOM inspection and genuine Appium screenshots.");
  }
  if (connection.rcMode !== "rc") {
    throw new Error("Runtime webOS rcMode must be rc.");
  }
  if (typeof connection.useSecureWebsocket !== "boolean") {
    throw new Error("Runtime webOS useSecureWebsocket must be a boolean.");
  }
  return {deviceName, deviceHost, chromedriverPath, remoteOnly: connection.remoteOnly, rcMode: connection.rcMode, useSecureWebsocket: connection.useSecureWebsocket};
}

function endpointRedactionSecrets(endpoint) {
  const values = [endpoint];
  try {
    const hostname = new URL(`http://${endpoint}`).hostname;
    values.push(hostname, hostname.replace(/^\[|\]$/g, ""));
  } catch {
    // The original endpoint remains a redaction secret; validation rejects no
    // connection data but does not expose runtime values in an error message.
  }
  return values;
}

function isNonEmptyScreenshot(payload) {
  if (typeof payload === "string") return payload.trim().length > 0;
  return Buffer.isBuffer(payload) || ArrayBuffer.isView(payload)
    ? payload.byteLength > 0
    : false;
}

function defaultWait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function redactUrlQuery(state) {
  if (!state || typeof state !== "object") return state;
  return {
    ...state,
    screenUrl: String(state.screenUrl ?? "").replace(/([?&][^=\s&#]+)=([^&#\s]*)/g, "$1=••••••"),
  };
}

function factoryError(code, message) {
  return new TvSessionError(code, message, {platform: "lg"});
}

function assertApprovedProfile(profile) {
  if (!profile || profile.platform !== "lg") {
    throw factoryError("PLATFORM_UNSUPPORTED", "Only approved LG profiles are supported.");
  }
  if (profile.appId !== INSTALLED_APP_ID) {
    throw factoryError("APP_ID_UNSUPPORTED", "Only the approved installed MyTV app is supported.");
  }
  return profile;
}

function normalizeLoopbackBaseUrl(server) {
  let url;
  try {
    url = new URL(server?.baseUrl);
  } catch {
    throw factoryError("APPIUM_BASE_URL_INVALID", "A loopback Appium base URL is required.");
  }
  if (
    url.protocol !== "http:"
    || url.hostname !== "127.0.0.1"
    || !url.port
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw factoryError("APPIUM_BASE_URL_INVALID", "A loopback Appium base URL is required.");
  }
  return url.origin;
}

function createWebOsSessionFactory({clientFactory, secrets = []} = {}) {
  if (typeof clientFactory !== "function") throw new Error("An injected Appium client factory is required.");
  if (!Array.isArray(secrets)) throw new Error("webOS session factory secrets must be an array.");

  async function create({profile, server, connection} = {}) {
    const approvedProfile = assertApprovedProfile(profile);
    const baseUrl = normalizeLoopbackBaseUrl(server);
    let client;
    try {
      client = await clientFactory({baseUrl});
    } catch {
      throw factoryError("APPIUM_CLIENT_UNAVAILABLE", "The injected Appium client could not be created.");
    }
    return createWebOsAppiumSession({
      client,
      appId: approvedProfile.appId,
      model: approvedProfile.model,
      secrets,
      connection,
    });
  }

  return {create};
}

function createWebOsAppiumSession({client, appId, model, secrets = [], connection, wait = defaultWait} = {}) {
  const safeAppId = assertInstalledAppId(appId);
  if (!client || typeof client !== "object") throw new Error("An injected Appium client is required.");
  if (!Array.isArray(secrets)) throw new Error("webOS session secrets must be an array.");
  if (typeof wait !== "function") throw new Error("webOS session wait must be a function.");
  const runtimeConnection = normalizeConnection(connection);
  const redactionSecrets = [...new Set([
    ...secrets,
    ...endpointRedactionSecrets(runtimeConnection.deviceHost),
    runtimeConnection.chromedriverPath,
  ])];

  const diagnostics = {
    platform: "lg",
    model: normalizeDomState({model}, {secrets: redactionSecrets}).model,
    started: false,
    closed: false,
  };
  let started = false;
  let closed = false;

  function sessionError(code, message) {
    return new TvSessionError(code, message, {platform: "lg", model: diagnostics.model});
  }

  async function start() {
    if (closed) throw sessionError("SESSION_CLOSED", "The Appium session is already closed.");
    if (started) return;
    if (typeof client.createSession !== "function") {
      throw sessionError("SESSION_UNAVAILABLE", "The injected Appium client cannot create a session.");
    }

    try {
      await client.createSession({
        capabilities: {
          alwaysMatch: {
            platformName: "LGTV",
            "appium:automationName": "webOS",
            "appium:deviceName": runtimeConnection.deviceName,
            "appium:deviceHost": runtimeConnection.deviceHost,
            "appium:appId": safeAppId,
            "appium:chromedriverExecutable": runtimeConnection.chromedriverPath,
            "appium:autoExtendDevMode": false,
            "appium:noReset": false,
            "appium:fullReset": false,
            "appium:remoteOnly": runtimeConnection.remoteOnly,
            "appium:rcMode": runtimeConnection.rcMode,
            "appium:useSecureWebsocket": runtimeConnection.useSecureWebsocket,
          },
          firstMatch: [{}],
        },
      });
    } catch {
      throw sessionError("SESSION_UNAVAILABLE", "The injected Appium client could not create a webOS session.");
    }
    started = true;
    diagnostics.started = true;
  }

  async function readDomState() {
    if (typeof client.execute !== "function") {
      throw sessionError("DOM_INSPECTION_UNAVAILABLE", "The injected Appium client cannot execute the DOM probe.");
    }
    let state;
    try {
      state = await client.execute(DOM_PROBE, []);
    } catch {
      throw sessionError("DOM_INSPECTION_UNAVAILABLE", "The injected Appium DOM probe failed.");
    }
    return normalizeDomState(redactUrlQuery(state), {secrets: redactionSecrets});
  }

  async function waitForDomState(predicate, {timeoutMs = 5_000, pollIntervalMs = 100} = {}) {
    if (typeof predicate !== "function") {
      throw sessionError("DOM_STATE_PREDICATE_INVALID", "A DOM-state predicate function is required.");
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      throw sessionError("DOM_STATE_WAIT_INVALID", "DOM-state wait timeout and poll interval must be valid positive durations.");
    }

    const attempts = Math.max(1, Math.floor(timeoutMs / pollIntervalMs) + 1);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const state = await readDomState();
      let matched;
      try {
        matched = await predicate(state);
      } catch {
        throw sessionError("DOM_STATE_PREDICATE_FAILED", "The DOM-state predicate failed.");
      }
      if (matched) return state;
      if (attempt < attempts - 1) await wait(pollIntervalMs);
    }
    throw sessionError("DOM_STATE_TIMEOUT", "The requested DOM state did not appear before the deadline.");
  }

  async function captureScreenshot() {
    if (typeof client.screenshot !== "function") {
      throw sessionError("VISUAL_CAPTURE_UNAVAILABLE", "The injected Appium client has no genuine screenshot command.");
    }
    try {
      const screenshot = await client.screenshot();
      if (!isNonEmptyScreenshot(screenshot)) {
        throw sessionError("VISUAL_CAPTURE_UNAVAILABLE", "The genuine Appium screenshot payload was empty.");
      }
      return screenshot;
    } catch (error) {
      if (error instanceof TvSessionError) throw error;
      throw sessionError("VISUAL_CAPTURE_UNAVAILABLE", "The genuine Appium screenshot command failed.");
    }
  }

  async function pressKey(key) {
    let normalizedKey;
    try {
      normalizedKey = normalizeRemoteKey(key);
    } catch {
      throw sessionError("REMOTE_KEY_UNSUPPORTED", "Unsupported TV remote key.");
    }
    if (typeof client.execute !== "function") {
      throw sessionError("REMOTE_CONTROL_UNAVAILABLE", "The injected Appium client cannot press remote keys.");
    }
    try {
      return await client.execute("webos: pressKey", [{key: WEBOS_REMOTE_KEYS[normalizedKey]}]);
    } catch {
      throw sessionError("REMOTE_CONTROL_UNAVAILABLE", "The injected Appium remote-key command failed.");
    }
  }

  async function executeTrustedMyTv(script, args = []) {
    if (!started || closed || typeof client.execute !== "function") {
      throw sessionError("DOM_INSPECTION_UNAVAILABLE", "Trusted MyTV DOM automation is unavailable for this session.");
    }
    try {
      return await client.execute(script, args);
    } catch {
      throw sessionError("DOM_INSPECTION_UNAVAILABLE", "Trusted MyTV DOM automation failed.");
    }
  }

  const myTvAutomation = createWebOsMyTvAutomation({
    execute: executeTrustedMyTv,
    pressKey,
    wait,
  });

  async function reset() {
    if (!started || closed || typeof client.execute !== "function") {
      throw sessionError("RESET_UNAVAILABLE", "A fresh Appium session is required before validating the MyTV reset.");
    }
    let activeApp;
    try {
      activeApp = await client.execute("webos: activeAppInfo", []);
    } catch {
      throw sessionError("RESET_UNAVAILABLE", "The injected Appium client could not validate the foreground app.");
    }
    if (activeApp?.appId !== safeAppId) {
      throw sessionError("APP_IDENTITY_MISMATCH", "The foreground app is not the approved installed MyTV app.");
    }
    return Object.freeze({
      method: "session-start-local-storage-reset",
      scope: "approved-mytv-app-only",
    });
  }

  async function close() {
    if (closed) return;
    closed = true;
    diagnostics.closed = true;
    if (!started || typeof client.deleteSession !== "function") return;
    try {
      await client.deleteSession();
    } catch {
      throw sessionError("SESSION_CLOSE_FAILED", "The injected Appium client could not close the session.");
    }
  }

  function collectDiagnostics() {
    return Object.freeze({...diagnostics});
  }

  async function cleanup() {
    return collectDiagnostics();
  }

  return {
    start,
    readDomState,
    getDomState: readDomState,
    waitForDomState,
    captureScreenshot,
    screenshot: captureScreenshot,
    pressKey,
    createMyTvAutomation: () => myTvAutomation,
    reset,
    resetAppState: reset,
    cleanup,
    collectDiagnostics,
    close,
    diagnostics,
  };
}

module.exports = {createWebOsAppiumSession, createWebOsSessionFactory};
