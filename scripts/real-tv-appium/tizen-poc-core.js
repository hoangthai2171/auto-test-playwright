"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PRODUCTION_APP_ID = "PP2MTMRMs9.MyTV";
const EXPECTED_TEST_APP_ID = "PP2MTMRMs8.MyTV";
const REDACTED = "[REDACTED]";

function assertSafeSamsungAppId(appId) {
  if (typeof appId !== "string" || !appId.trim()) {
    throw new Error("A non-empty Samsung test app ID is required.");
  }

  const normalized = appId.trim();
  if (normalized === PRODUCTION_APP_ID) {
    throw new Error(
      `Refusing production Samsung app ID ${PRODUCTION_APP_ID}. A distinct test package is mandatory and cannot be overridden.`
    );
  }
  return normalized;
}

function isExpectedSamsungTestId(appId) {
  return appId === EXPECTED_TEST_APP_ID;
}

function samsungPackageIdFromAppId(appId) {
  const safeAppId = assertSafeSamsungAppId(appId);
  const packageId = safeAppId.split(".")[0];
  if (!packageId || packageId === PRODUCTION_APP_ID.split(".")[0]) {
    throw new Error("A distinct Samsung test package ID is required.");
  }
  return packageId;
}

function assertSdbSerial(sdbSerial) {
  if (typeof sdbSerial !== "string" || !/^[A-Za-z0-9._-]+:\d+$/.test(sdbSerial.trim())) {
    throw new Error("A connected Samsung SDB serial in host:port form is required.");
  }
  return sdbSerial.trim();
}

function redactHost(value) {
  if (typeof value !== "string") return value;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.replace(/\.\d{1,3}$/, ".x");
  }
  return REDACTED;
}

function redactValue(value, secrets = []) {
  let text = String(value ?? "");
  for (const secret of secrets.filter(Boolean)) {
    text = text.split(secret).join(REDACTED);
  }
  return text
    .replace(/(password|token|authorization|cookie)\s*[:=]\s*[^\s,}]+/gi, "$1=" + REDACTED)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (host) => redactHost(host));
}

function redactDomState(state, secrets = []) {
  const screenUrl = redactValue(state?.screenUrl || "", secrets).slice(0, 2000);
  if (/#chooseProfile\b/.test(screenUrl)) {
    return {
      bodyText: "[REDACTED PROFILE SELECTION SCREEN]",
      focused: "[REDACTED PROFILE ITEM]",
      active: redactValue(state?.active || "", secrets).slice(0, 2000),
      screenUrl,
    };
  }
  return {
    bodyText: redactValue(state?.bodyText || "", secrets).slice(0, 12000),
    focused: redactValue(state?.focused || "", secrets).slice(0, 2000),
    active: redactValue(state?.active || "", secrets).slice(0, 2000),
    screenUrl,
  };
}

async function capturePocEvidence({
  label,
  readDomState,
  requestScreenshot,
  writer,
  secrets = [],
  skipScreenshotGate = false,
}) {
  const dom = redactDomState(await readDomState(), secrets);
  writer.writeJson(`${label}.dom.json`, dom);
  if (skipScreenshotGate) return dom;
  try {
    const screenshot = await requestScreenshot();
    writer.writeScreenshot(`${label}.png`, screenshot);
    return dom;
  } catch (error) {
    error.appiumScreenshotError = redactValue(error?.message || String(error), secrets);
    throw error;
  }
}

function focusIdentity(dom = {}) {
  return `${dom.focused || ""}\n${dom.active || ""}`;
}

async function waitForFocusChange({ readDomState, initialDom, timeoutMs = 3_000, pollMs = 100 }) {
  const initialIdentity = focusIdentity(initialDom);
  const deadline = Date.now() + timeoutMs;
  let lastDom = initialDom;
  while (Date.now() <= deadline) {
    lastDom = await readDomState();
    if (focusIdentity(lastDom) !== initialIdentity) return lastDom;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return lastDom;
}

function pocCompletion({ skipScreenshotGate, evidenceDir, status }) {
  if (status === "failed") {
    return {
      status: "failed",
      message: `Samsung Tizen POC failed during required cleanup. Redacted local evidence: ${evidenceDir}`,
    };
  }
  return skipScreenshotGate
    ? {
      status: "passed_without_screenshot_gate",
      message: `Samsung Tizen partial POC passed without the screenshot gate. Redacted local evidence: ${evidenceDir}`,
    }
    : {
      status: "passed",
      message: `Samsung Tizen POC passed. Redacted local evidence: ${evidenceDir}`,
    };
}

function recordPocCleanup(manifest, checkName, check) {
  manifest.checks[checkName] = check;
  if (!check.passed && /^(passed|passed_without_screenshot_gate)$/.test(manifest.status)) {
    manifest.status = "failed";
  }
}

function visualCaptureStatus({ skipScreenshotGate, captureSucceeded = false }) {
  if (skipScreenshotGate) return "unavailable";
  return captureSucceeded ? "available" : "pending";
}

function buildTizenCapabilities({ host, sdbSerial, appId, chromedriverPath, rcToken }) {
  const safeAppId = assertSafeSamsungAppId(appId);
  if (!host) throw new Error("Samsung TV host is required.");
  const safeSdbSerial = assertSdbSerial(sdbSerial);
  if (!chromedriverPath) throw new Error("A compatible Chromedriver path is required for DOM inspection.");
  const capabilities = {
    platformName: "TizenTV",
    "appium:automationName": "TizenTV",
    "appium:deviceName": host,
    "appium:deviceAddress": host,
    "appium:udid": safeSdbSerial,
    "appium:appPackage": safeAppId,
    "appium:chromedriverExecutable": path.resolve(chromedriverPath),
    "appium:rcMode": "remote",
    // Start with paired remote control only. The POC terminates only its
    // distinct test package before requesting the driver's debug attach.
    "appium:rcOnly": true,
    "appium:rcKeypressCooldown": 750,
    "appium:sendKeysStrategy": "rc",
    "appium:noReset": true,
  };
  // The driver retrieves an omitted token from its local secure cache after a
  // successful pair-remote command. Supplying one at runtime remains useful
  // for a cache-less or different host, but is never required in source.
  if (rcToken) capabilities["appium:rcToken"] = rcToken;
  return capabilities;
}

function packageAppId(packagePath, runCommand = defaultRunCommand) {
  const result = runCommand("unzip", ["-p", packagePath, "config.xml"]);
  if (result.status !== 0) {
    throw new Error(`Unable to read config.xml from the supplied .wgt package: ${result.stderr || result.stdout}`);
  }
  const match = result.stdout.match(/<tizen:application\b[^>]*\bid=["']([^"']+)["']/i);
  if (!match) {
    throw new Error("The supplied .wgt package has no tizen:application id in config.xml.");
  }
  return match[1];
}

function assertSafePackage(packagePath, appId, runCommand = defaultRunCommand) {
  const packageId = packageAppId(packagePath, runCommand);
  assertSafeSamsungAppId(packageId);
  if (packageId !== appId) {
    throw new Error(`Package app ID ${packageId} does not match requested test app ID ${appId}.`);
  }
  return packageId;
}

function buildTizenInstallArgs(serial, packagePath) {
  if (typeof serial !== "string" || !serial.trim()) {
    throw new Error("A connected Samsung SDB serial is required for deployment.");
  }
  if (typeof packagePath !== "string" || path.extname(packagePath).toLowerCase() !== ".wgt") {
    throw new Error("Samsung deployment requires a .wgt package path.");
  }
  const resolvedPackage = path.resolve(packagePath);
  return ["install", "-s", serial.trim(), "--name", path.basename(resolvedPackage), "--", path.dirname(resolvedPackage)];
}

function defaultRunCommand(command, args, options = {}) {
  const output = spawnSync(command, args, {
    encoding: "utf8",
    timeout: options.timeoutMs || 90_000,
    env: options.env || process.env,
  });
  return {
    status: output.status ?? 1,
    stdout: output.stdout || "",
    stderr: output.stderr || output.error?.message || "",
  };
}

function createEvidenceWriter(rootDir, runId) {
  const safeRunId = String(runId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const evidenceDir = path.resolve(rootDir, safeRunId);
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

  return {
    evidenceDir,
    writeJson(name, value) {
      const destination = path.join(evidenceDir, name);
      fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      return destination;
    },
    writeScreenshot(name, base64Png) {
      const destination = path.join(evidenceDir, name);
      fs.writeFileSync(destination, Buffer.from(base64Png, "base64"), { mode: 0o600 });
      return destination;
    },
  };
}

function createCredentialSafeAppiumLogCapture({ redact = (value) => String(value) } = {}) {
  let enabled = true;
  let captured = "";
  return {
    append(chunk) {
      if (enabled) captured += redact(chunk);
    },
    stop() {
      enabled = false;
    },
    value() {
      return captured;
    },
  };
}

module.exports = {
  EXPECTED_TEST_APP_ID,
  PRODUCTION_APP_ID,
  assertSafePackage,
  assertSafeSamsungAppId,
  assertSdbSerial,
  buildTizenInstallArgs,
  buildTizenCapabilities,
  capturePocEvidence,
  createCredentialSafeAppiumLogCapture,
  createEvidenceWriter,
  defaultRunCommand,
  isExpectedSamsungTestId,
  packageAppId,
  pocCompletion,
  recordPocCleanup,
  redactDomState,
  redactHost,
  redactValue,
  samsungPackageIdFromAppId,
  visualCaptureStatus,
  waitForFocusChange,
};
