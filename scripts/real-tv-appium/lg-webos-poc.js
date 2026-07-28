#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
  createCredentialSafeAppiumLogCapture,
  createEvidenceWriter,
  recordPocCleanup,
  redactDomState,
  redactHost,
  redactValue,
  waitForFocusChange,
} = require("./tizen-poc-core");
const {
  EXPECTED_LG_APP_ID,
  buildLgCapabilities,
  buildLgPocEnvironment,
  buildLgRuntimeRedactionSecrets,
  captureGenuinePocEvidence,
  hasFocusedText,
  parseLgPocArgs,
  runVisibleFocusCheck,
} = require("./lg-webos-poc-core");
const toolchain = require("./toolchain.json");

const projectRoot = path.resolve(__dirname, "..", "..");
const appiumHome = path.join(projectRoot, ".real-tv-appium", "appium-home");
const evidenceRoot = path.join(projectRoot, ".real-tv-appium", "evidence");
const defaultWebosSdkHome = path.join(projectRoot, ".real-tv-appium", "webos-sdk");

function usage() {
  return `LG webOS physical-TV POC (local evidence only)

Usage:
  npm run tv:poc:lg -- --device <registered-device-name> --host <tv-ip> --model <actual-tv-model> --app-id ${EXPECTED_LG_APP_ID} --chromedriver <absolute-compatible-chromedriver-path> [--firmware <actual-firmware>] [--port <local-port>] [--secure-websocket --allow-self-signed-tls] [--visible-focus-check | --reset-only]

This POC always requires genuine Appium screenshots unless --reset-only is explicitly requested. It rejects --skip-screenshot-gate, never deploys an IPK, does not use credentials or product flows, and sets appium:autoExtendDevMode=false. --visible-focus-check waits for the existing welcome-screen Đăng nhập focus, sends exactly one visible Right move to Trải nghiệm, holds it for five seconds, then cleans up. --reset-only creates the session, resets only MyTV local storage, verifies the approved foreground app, and closes without screenshots or remote keys; it is not visual POC evidence.
The first Appium session can show an on-TV remote-pairing prompt; approve it manually. The command never retries or dismisses that prompt. --allow-self-signed-tls disables TLS certificate verification only for this Appium child process and is valid only with --secure-websocket.`;
}

function run(command, args, { env = process.env, allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", env, timeout: 120_000 });
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout || result.error?.message || "unknown error"}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function commandVersion(command, args, env) {
  const result = run(command, args, { env, allowFailure: true });
  return result.status === 0 ? (result.stdout || result.stderr).trim() : `unavailable (${result.stderr.trim() || "not found"})`;
}

function toolchainSnapshot(env, chromedriverPath) {
  const appiumBin = path.join(projectRoot, "node_modules", ".bin", "appium");
  return {
    checkedAt: new Date().toISOString(),
    pins: toolchain,
    detected: {
      appium: commandVersion(appiumBin, ["--version"], env),
      appiumDrivers: run(appiumBin, ["driver", "list", "--installed"], { env, allowFailure: true }).stdout.trim(),
      webosCli: commandVersion(path.join(env.LG_WEBOS_TV_SDK_HOME, "CLI", "bin", "ares"), ["--version"], env),
      chromedriver: commandVersion(path.resolve(chromedriverPath), ["--version"], env),
    },
  };
}

async function appiumRequest(baseUrl, pathname, method = "GET", body, { timeoutMs = 30_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.value?.message || payload?.message || `${method} ${pathname} failed with HTTP ${response.status}`);
    }
    return payload.value;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${method} ${pathname} timed out after ${timeoutMs}ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForAppium(baseUrl, processHandle) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error("Appium exited before it became ready.");
    try {
      await appiumRequest(baseUrl, "/status", "GET", undefined, { timeoutMs: 5_000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for Appium: ${lastError?.message || "unknown error"}`);
}

function startAppium(port, env, onLog) {
  const appiumBin = path.join(projectRoot, "node_modules", ".bin", "appium");
  const child = spawn(appiumBin, ["server", "--address", "127.0.0.1", "--port", String(port), "--use-drivers", "webos"], {
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => onLog(chunk.toString()));
  child.stderr.on("data", (chunk) => onLog(chunk.toString()));
  return child;
}

function signalAppiumProcessGroup(child, signal) {
  if (!child?.pid) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
      return;
    }
  }
  child.kill(signal);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  signalAppiumProcessGroup(child, "SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) signalAppiumProcessGroup(child, "SIGKILL");
      resolve();
    }, 45_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function execute(sessionBase, script, args = []) {
  return appiumRequest(sessionBase, "/execute/sync", "POST", { script, args });
}

async function readDomState(sessionBase) {
  return execute(sessionBase, `return {
    bodyText: (document.body && document.body.innerText) || '',
    focused: ((document.querySelector('.focused') || document.querySelector('[data-focused="true"]')) || {}).outerHTML || '',
    active: ((document.querySelector('#dialog_confirm_v2 .active, #dialog_alert_v2 .active, #dialog_alert_full .active, #dialog_confirm_full .active')) || {}).outerHTML || '',
    screenUrl: location.href
  };`);
}

async function waitForUsableDom(sessionBase, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastDom;
  while (Date.now() < deadline) {
    lastDom = await readDomState(sessionBase);
    if (lastDom.bodyText || lastDom.focused || lastDom.active) return lastDom;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for MyTV DOM readiness; last body text: ${String(lastDom?.bodyText || "").slice(0, 200)}`);
}

async function waitForFocusedText(sessionBase, text, { timeoutMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastDom;
  while (Date.now() < deadline) {
    lastDom = await readDomState(sessionBase);
    if (hasFocusedText(lastDom, text)) return lastDom;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for focused ${text}.`);
}

async function runPoc(args) {
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const deviceName = args.device;
  const deviceHost = args.host;
  const model = args.model;
  const appId = args["app-id"];
  const chromedriverPath = args.chromedriver;
  const webosSdkHome = args["webos-sdk"] || defaultWebosSdkHome;
  const port = Number(args.port || 4725);
  const useSecureWebsocket = args["secure-websocket"] === true;
  const allowSelfSignedTls = args["allow-self-signed-tls"] === true;
  const visibleFocusCheck = args["visible-focus-check"] === true;
  const resetOnly = args["reset-only"] === true;
  if (!deviceName || !deviceHost || !model || !appId || !chromedriverPath) {
    throw new Error("--device, --host, --model, --app-id, and --chromedriver are required.");
  }
  if (visibleFocusCheck && resetOnly) throw new Error("--visible-focus-check and --reset-only cannot be combined.");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be a valid unprivileged TCP port.");
  if (allowSelfSignedTls && !useSecureWebsocket) throw new Error("--allow-self-signed-tls requires --secure-websocket.");
  if (!fs.existsSync(chromedriverPath)) throw new Error("--chromedriver must name an existing executable.");
  if (!fs.existsSync(path.join(webosSdkHome, "CLI", "bin", "ares"))) {
    throw new Error("--webos-sdk must name an official webOS TV CLI directory containing CLI/bin/ares.");
  }

  const env = buildLgPocEnvironment({ baseEnv: process.env, appiumHome, webosSdkHome, allowSelfSignedTls });
  const redactionSecrets = buildLgRuntimeRedactionSecrets(deviceHost);
  const redactRuntimeValue = (value) => redactValue(value, redactionSecrets);
  const runId = `lg-webos-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const writer = createEvidenceWriter(evidenceRoot, runId);
  const manifest = {
    runId,
    platform: "lg-webos",
    status: "running",
    evidencePolicy: "local-only-redacted",
    visualCapture: "pending",
    device: {
      model,
      modelYear: "not reported",
      firmwareReported: args.firmware || "not supplied",
      host: redactHost(deviceHost),
      appId,
      autoExtendDevMode: false,
      remoteTransport: useSecureWebsocket ? "secure-websocket" : "websocket",
      tlsCertificateVerification: allowSelfSignedTls ? "disabled-process-scoped" : "enabled",
    },
    toolchain: toolchainSnapshot(env, chromedriverPath),
    checks: {},
  };
  writer.writeJson("manifest.json", manifest);

  const aresDeviceInfo = path.join(webosSdkHome, "CLI", "bin", "ares-device-info");
  const appiumBase = `http://127.0.0.1:${port}`;
  const appiumLogCapture = createCredentialSafeAppiumLogCapture({ redact: redactRuntimeValue });
  let server;
  let sessionId;
  let runError;

  try {
    const deviceInfo = run(aresDeviceInfo, ["--device", deviceName], { env });
    manifest.checks.vendorConnection = { passed: true, output: redactRuntimeValue(deviceInfo.stdout) };
    const capabilities = buildLgCapabilities({ deviceName, deviceHost, appId, chromedriverPath, useSecureWebsocket });
    writer.writeJson("capabilities.redacted.json", {
      ...capabilities,
      "appium:deviceHost": redactHost(deviceHost),
    });

    server = startAppium(port, env, (chunk) => appiumLogCapture.append(chunk));
    await waitForAppium(appiumBase, server);
    manifest.checks.appiumStarted = { passed: true, boundTo: "127.0.0.1" };

    const session = await appiumRequest(appiumBase, "/session", "POST", {
      capabilities: { alwaysMatch: capabilities, firstMatch: [{}] },
    }, { timeoutMs: 120_000 });
    sessionId = session.sessionId || session?.capabilities?.sessionId;
    if (!sessionId) throw new Error("Appium did not return a session ID.");
    const sessionBase = `${appiumBase}/session/${sessionId}`;
    manifest.checks.session = { passed: true };

    const activeApp = await execute(sessionBase, "webos: activeAppInfo");
    manifest.checks.resetRestart = {
      passed: true,
      method: "Appium webOS session launch followed by the driver's MyTV local-storage reset",
      scope: "MyTV local storage only; appium:autoExtendDevMode=false",
    };
    manifest.checks.activeApp = { passed: activeApp?.appId === appId, appId: activeApp?.appId || "" };
    if (!manifest.checks.activeApp.passed) throw new Error("The Appium session did not foreground the requested installed MyTV app.");
    if (resetOnly) {
      manifest.visualCapture = "not-requested";
      manifest.checks.resetOnly = {
        passed: true,
        scope: "MyTV local storage only; no screenshot or remote key was requested",
      };
      manifest.status = "passed";
      manifest.completedAt = new Date().toISOString();
    } else {
      const before = await waitForUsableDom(sessionBase);
    await captureGenuinePocEvidence({
      label: "01-after-reset",
      readDomState: () => Promise.resolve(before),
      requestScreenshot: () => appiumRequest(sessionBase, "/screenshot", "GET", undefined, { timeoutMs: 20_000 }),
      writer,
      secrets: redactionSecrets,
    });
    manifest.visualCapture = "available";
    manifest.checks.appiumScreenshot = { passed: true, method: "genuine Appium GET /screenshot before any remote key" };

    let focusBeforeRight = before;
    let afterRight;
    let afterRightLabel = "02-after-right";
    let afterBackLabel = "03-after-back";
    if (visibleFocusCheck) {
      const visibleFocusResult = await runVisibleFocusCheck({
        waitForFocusedText: (text) => waitForFocusedText(sessionBase, text),
        capture: (label, dom) => captureGenuinePocEvidence({
          label,
          readDomState: () => Promise.resolve(dom),
          requestScreenshot: () => appiumRequest(sessionBase, "/screenshot", "GET", undefined, { timeoutMs: 20_000 }),
          writer,
          secrets: redactionSecrets,
        }),
        pressRight: () => execute(sessionBase, "webos: pressKey", [{ key: "RIGHT" }]),
        hold: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
      });
      focusBeforeRight = visibleFocusResult.focusBeforeRight;
      afterRight = visibleFocusResult.afterRight;
      afterRightLabel = "03-after-visible-right";
      afterBackLabel = "04-after-back";
    } else {
      await execute(sessionBase, "webos: pressKey", [{ key: "RIGHT" }]);
      afterRight = await waitForFocusChange({ initialDom: focusBeforeRight, readDomState: () => readDomState(sessionBase) });
    }

    if (!visibleFocusCheck) {
      await captureGenuinePocEvidence({
        label: afterRightLabel,
        readDomState: () => Promise.resolve(afterRight),
        requestScreenshot: () => appiumRequest(sessionBase, "/screenshot", "GET", undefined, { timeoutMs: 20_000 }),
        writer,
        secrets: redactionSecrets,
      });
    }
    manifest.checks.realRemoteRight = {
      passed: true,
      beforeFocus: redactRuntimeValue(focusBeforeRight.focused),
      afterFocus: redactRuntimeValue(afterRight.focused),
    };
    if (visibleFocusCheck) {
      manifest.checks.visibleFocusCheck = { passed: true, target: "Trải nghiệm", holdMs: 5000 };
    }

    await execute(sessionBase, "webos: pressKey", [{ key: "BACK" }]);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const afterBack = await readDomState(sessionBase);
    await captureGenuinePocEvidence({
      label: afterBackLabel,
      readDomState: () => Promise.resolve(afterBack),
      requestScreenshot: () => appiumRequest(sessionBase, "/screenshot", "GET", undefined, { timeoutMs: 20_000 }),
      writer,
    });
    manifest.checks.realRemoteBack = {
      passed: Boolean(afterBack.bodyText || afterBack.focused || afterBack.active),
      state: redactDomState(afterBack, redactionSecrets),
    };
    if (!manifest.checks.realRemoteBack.passed) throw new Error("The real Back press did not leave readable MyTV DOM state.");
    manifest.checks.domInspection = {
      passed: true,
      selectors: ["body.innerText", ".focused", "dialog .active"],
    };
      manifest.status = "passed";
      manifest.completedAt = new Date().toISOString();
    }
  } catch (error) {
    runError = error;
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.error = redactRuntimeValue(error?.stack || error?.message || String(error));
    if (/\/screenshot/.test(String(error?.message || error))) {
      manifest.visualCapture = "unavailable";
      manifest.checks.appiumScreenshot = { passed: false, error: redactRuntimeValue(error.message) };
    }
  } finally {
    if (sessionId) {
      try {
        await appiumRequest(`${appiumBase}/session/${sessionId}`, "", "DELETE", undefined, { timeoutMs: 90_000 });
        recordPocCleanup(manifest, "sessionClosed", { passed: true });
      } catch (error) {
        recordPocCleanup(manifest, "sessionClosed", { passed: false, error: redactRuntimeValue(error.message) });
      }
    }
    await stopProcess(server);
    recordPocCleanup(manifest, "appiumStopped", { passed: !server || server.exitCode !== null });
    writer.writeJson("appium.redacted.log.json", { log: redactRuntimeValue(appiumLogCapture.value()).slice(-50_000) });
    writer.writeJson("manifest.json", manifest);
  }

  if (runError) throw runError;
  if (manifest.status !== "passed") throw new Error("LG webOS POC failed during required cleanup.");
  process.stdout.write(`${resetOnly ? "LG webOS MyTV-local-storage reset passed" : "LG webOS POC passed"}. Redacted local evidence: ${writer.evidenceDir}\n`);
}

async function main() {
  const args = parseLgPocArgs(process.argv.slice(2));
  await runPoc(args);
}

main().catch((error) => {
  process.stderr.write(`LG webOS POC failed: ${redactValue(error?.message || String(error))}\n`);
  process.exitCode = 1;
});
