"use strict";

const path = require("node:path");
const { redactDomState } = require("./tizen-poc-core");

const EXPECTED_LG_APP_ID = "com.mytvb2c.app";

function requireValue(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`A non-empty LG ${label} is required.`);
  }
  return value.trim();
}

function assertSafeLgAppId(appId) {
  const safeAppId = requireValue(appId, "app ID");
  if (safeAppId !== EXPECTED_LG_APP_ID) {
    throw new Error(`Expected LG MyTV app ID ${EXPECTED_LG_APP_ID}, received ${safeAppId}.`);
  }
  return safeAppId;
}

function buildLgCapabilities({ deviceName, deviceHost, appId, chromedriverPath, useSecureWebsocket = false } = {}) {
  if (typeof useSecureWebsocket !== "boolean") {
    throw new Error("LG useSecureWebsocket must be a boolean.");
  }
  return {
    platformName: "LGTV",
    "appium:automationName": "webOS",
    "appium:deviceName": requireValue(deviceName, "device name"),
    "appium:deviceHost": requireValue(deviceHost, "device host"),
    "appium:appId": assertSafeLgAppId(appId),
    "appium:chromedriverExecutable": path.resolve(requireValue(chromedriverPath, "ChromeDriver path")),
    "appium:autoExtendDevMode": false,
    "appium:noReset": false,
    "appium:fullReset": false,
    "appium:remoteOnly": false,
    "appium:rcMode": "rc",
    "appium:useSecureWebsocket": useSecureWebsocket,
  };
}

function buildLgPocEnvironment({ baseEnv = {}, appiumHome, webosSdkHome, allowSelfSignedTls = false } = {}) {
  if (typeof allowSelfSignedTls !== "boolean") {
    throw new Error("LG allowSelfSignedTls must be a boolean.");
  }
  const env = {
    ...baseEnv,
    APPIUM_HOME: path.resolve(requireValue(appiumHome, "Appium home")),
    LG_WEBOS_TV_SDK_HOME: path.resolve(requireValue(webosSdkHome, "webOS SDK home")),
  };
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (allowSelfSignedTls) env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  return env;
}

function buildLgRuntimeRedactionSecrets(deviceHost) {
  const host = requireValue(deviceHost, "device host");
  const unbracketedHost = host.replace(/^\[|\]$/g, "");
  return [...new Set([host, unbracketedHost, `[${unbracketedHost}]`])];
}

async function captureGenuinePocEvidence({ label, readDomState, requestScreenshot, writer, secrets = [] } = {}) {
  if (typeof readDomState !== "function" || typeof requestScreenshot !== "function" || !writer) {
    throw new Error("LG screenshot evidence requires DOM, Appium screenshot, and writer adapters.");
  }
  const dom = redactDomState(await readDomState(), secrets);
  writer.writeJson(`${label}.dom.json`, dom);
  const screenshot = await requestScreenshot();
  writer.writeScreenshot(`${label}.png`, screenshot);
  return dom;
}

function hasFocusedText(dom, text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("LG focused-target text is required.");
  return String(dom?.focused || "").includes(text);
}

async function runVisibleFocusCheck({ waitForFocusedText, capture, pressRight, hold } = {}) {
  if (typeof waitForFocusedText !== "function" || typeof capture !== "function" || typeof pressRight !== "function" || typeof hold !== "function") {
    throw new Error("LG visible focus check requires wait, capture, right-key, and hold adapters.");
  }
  const focusBeforeRight = await waitForFocusedText("Đăng nhập");
  await capture("02-before-visible-right", focusBeforeRight);
  await pressRight();
  const afterRight = await waitForFocusedText("Trải nghiệm");
  await capture("03-after-visible-right", afterRight);
  await hold(5_000);
  return { focusBeforeRight, afterRight };
}

function parseLgPocArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--skip-screenshot-gate") {
      throw new Error("LG POC does not support --skip-screenshot-gate.");
    }
    if (item === "--secure-websocket") {
      args["secure-websocket"] = true;
      continue;
    }
    if (item === "--allow-self-signed-tls") {
      args["allow-self-signed-tls"] = true;
      continue;
    }
    if (item === "--visible-focus-check") {
      args["visible-focus-check"] = true;
      continue;
    }
    if (item === "--reset-only") {
      args["reset-only"] = true;
      continue;
    }
    if (item === "--help" || item === "-h") {
      args.help = true;
      continue;
    }
    if (!item.startsWith("--")) throw new Error(`Unknown argument ${item}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}.`);
    args[item.slice(2)] = value;
    index += 1;
  }
  return args;
}

module.exports = {
  EXPECTED_LG_APP_ID,
  assertSafeLgAppId,
  buildLgCapabilities,
  buildLgPocEnvironment,
  buildLgRuntimeRedactionSecrets,
  captureGenuinePocEvidence,
  hasFocusedText,
  parseLgPocArgs,
  runVisibleFocusCheck,
};
