#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
  EXPECTED_TEST_APP_ID,
  assertSafePackage,
  assertSafeSamsungAppId,
  buildTizenInstallArgs,
  buildTizenCapabilities,
  capturePocEvidence,
  createCredentialSafeAppiumLogCapture,
  createEvidenceWriter,
  isExpectedSamsungTestId,
  redactHost,
  redactValue,
  pocCompletion,
  recordPocCleanup,
  samsungPackageIdFromAppId,
  visualCaptureStatus,
  waitForFocusChange,
} = require("./tizen-poc-core");
const {
  loginWithDedicatedAccount,
  logoutToLoginScreen,
  prepareDedicatedLogin,
  requireDedicatedAccount,
} = require("./tizen-poc-login");
const {
  leavePlayerAfterAssessment,
  parseSemanticRequest,
  runSemanticSearchPlayback,
} = require("./tizen-poc-semantic");
const toolchain = require("./toolchain.json");

const projectRoot = path.resolve(__dirname, "..", "..");
const appiumHome = path.join(projectRoot, ".real-tv-appium", "appium-home");
const evidenceRoot = path.join(projectRoot, ".real-tv-appium", "evidence");

function vendorTool(name) {
  const tizenHome = process.env.TIZEN_HOME || path.join(os.homedir(), "tizen-studio");
  const candidate = name === "sdb"
    ? path.join(tizenHome, "tools", "sdb")
    : path.join(tizenHome, "tools", "ide", "bin", "tizen");
  return fs.existsSync(candidate) ? candidate : name;
}

function vendorEnvironment() {
  const tizenHome = process.env.TIZEN_HOME || path.join(os.homedir(), "tizen-studio");
  const toolPaths = [path.join(tizenHome, "tools", "ide", "bin"), path.join(tizenHome, "tools")];
  return {
    ...process.env,
    TIZEN_HOME: tizenHome,
    PATH: [...toolPaths, process.env.PATH || ""].join(path.delimiter),
  };
}

function usage() {
  return `Samsung Tizen physical-TV POC (local evidence only)

Usage:
  npm run tv:poc:tizen:setup
  npm run tv:poc:tizen:doctor
  npm run tv:poc:tizen:pair -- --host <tv-ip>
  [MYTV_TIZEN_RC_TOKEN=<pairing-token>] npm run tv:poc:tizen -- --host <tv-ip> --sdb-serial <sdb-host:port> --model <tv-model> --model-year <year> --app-id ${EXPECTED_TEST_APP_ID} --chromedriver <path> [--package <signed.wgt> --deploy] [--login-from-env --verify-logout] [--skip-screenshot-gate --search-name <known-playable-title> --content-type <channel|movie|content>]

No command accepts ${"PP2MTMRMs9.MyTV"}; the production Samsung app is permanently blocked.
--skip-screenshot-gate records redacted DOM only and can never establish a complete POC or Samsung model support.
The semantic search/playback flags require --login-from-env --verify-logout --skip-screenshot-gate and use the test app's virtual keyboard plus real remote keys only.
The pairing token, TV IP, package path, credentials, screenshots, and evidence never enter git.`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--help" || item === "-h") args.help = true;
    else if (item === "--deploy" || item === "--login-from-env" || item === "--verify-logout" || item === "--skip-screenshot-gate") args[item.slice(2)] = true;
    else if (item.startsWith("--")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${item}.`);
      args[item.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument ${item}.`);
    }
  }
  return args;
}

function run(command, args, { allowFailure = false, env = process.env } = {}) {
  const output = spawnSync(command, args, { encoding: "utf8", env, timeout: 120_000 });
  if ((output.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed: ${output.stderr || output.stdout || output.error?.message || "unknown error"}`);
  }
  return {
    status: output.status ?? 1,
    stdout: output.stdout || "",
    stderr: output.stderr || output.error?.message || "",
  };
}

function commandVersion(command, args, env) {
  const result = run(command, args, { allowFailure: true, env });
  return result.status === 0 ? (result.stdout || result.stderr).trim() : `unavailable (${result.stderr.trim() || "not found"})`;
}

function toolchainSnapshot(env) {
  const appiumBin = path.join(projectRoot, "node_modules", ".bin", "appium");
  const installedDrivers = run(appiumBin, ["driver", "list", "--installed"], {
    allowFailure: true,
    env,
  });
  return {
    checkedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      electron: packageVersion("electron"),
    },
    pins: toolchain,
    detected: {
      appium: commandVersion(appiumBin, ["--version"], env),
      appiumDrivers: (installedDrivers.stdout || installedDrivers.stderr).trim(),
      sdb: commandVersion(vendorTool("sdb"), ["version"], env),
      tizen: commandVersion(vendorTool("tizen"), ["version"], env),
      tizenHome: env.TIZEN_HOME ? "set" : "not set",
    },
  };
}

function packageVersion(name) {
  try {
    return require(path.join(projectRoot, "node_modules", name, "package.json")).version;
  } catch {
    return "unavailable";
  }
}

function findSdbSerial(devicesOutput, host, requestedSerial) {
  const deviceLines = devicesOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\bdevice\b/i.test(line));
  if (requestedSerial) {
    return deviceLines.some((line) => line.split(/\s+/)[0] === requestedSerial)
      ? requestedSerial
      : null;
  }
  const matchingLine = deviceLines.find((line) => line.includes(host));
  if (!matchingLine) return null;
  return matchingLine.split(/\s+/)[0] || null;
}

function listSdbForwardedLocalPorts(sdb, sdbSerial, env) {
  const forwarded = run(sdb, ["forward", "--list"], { env });
  return new Set(forwarded.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns[0] === sdbSerial && /^tcp:\d+$/.test(columns[1] || ""))
    .map((columns) => columns[1]));
}

function removeNewSdbForwards(sdb, sdbSerial, initialPorts, env) {
  const currentPorts = listSdbForwardedLocalPorts(sdb, sdbSerial, env);
  const removed = [];
  for (const localPort of currentPorts) {
    if (initialPorts.has(localPort)) continue;
    run(sdb, ["-s", sdbSerial, "forward", "--remove", localPort], { env });
    removed.push(localPort);
  }
  return removed;
}

function appiumEnvironment() {
  fs.mkdirSync(appiumHome, { recursive: true, mode: 0o700 });
  return { ...vendorEnvironment(), APPIUM_HOME: appiumHome };
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
    if (error?.name === "AbortError") {
      throw new Error(`${method} ${pathname} timed out after ${timeoutMs}ms.`);
    }
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
  const child = spawn(appiumBin, ["server", "--address", "127.0.0.1", "--port", String(port), "--use-drivers", "tizentv"], {
    env,
    // Keep Appium and its Chromedriver descendants in an isolated local
    // process group so a stalled proxied screenshot cannot leave them behind.
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

async function stopProcess(child, { prompt = false } = {}) {
  if (!child || child.exitCode !== null) return;
  signalAppiumProcessGroup(child, "SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) signalAppiumProcessGroup(child, "SIGKILL");
      resolve();
    }, prompt ? 10_000 : 45_000);
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

async function captureEvidence(writer, label, sessionBase, secrets, { skipScreenshotGate = false } = {}) {
  return capturePocEvidence({
    label,
    readDomState: () => readDomState(sessionBase),
    requestScreenshot: () => appiumRequest(sessionBase, "/screenshot", "GET", undefined, { timeoutMs: 20_000 }),
    writer,
    secrets,
    skipScreenshotGate,
  });
}

async function waitForUsableDom(sessionBase, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastDom;
  while (Date.now() < deadline) {
    lastDom = await readDomState(sessionBase);
    const meaningfulText = String(lastDom.bodyText || "")
      .replace(/Version\s+\d+(?:\.\d+)*/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (meaningfulText || lastDom.focused || lastDom.active) return lastDom;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for MyTV DOM readiness; last body text: ${String(lastDom?.bodyText || "").slice(0, 200)}`);
}

function focusedIdentity(dom) {
  return `${dom.focused}\n${dom.active}`;
}

async function runPoc(args) {
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const host = args.host;
  const sdbSerialArgument = args["sdb-serial"];
  const model = args.model;
  const modelYear = Number(args["model-year"]);
  const appId = assertSafeSamsungAppId(args["app-id"]);
  const packageId = samsungPackageIdFromAppId(appId);
  const chromedriver = args.chromedriver;
  const rcToken = process.env.MYTV_TIZEN_RC_TOKEN;
  const dedicatedAccount = args["login-from-env"] ? requireDedicatedAccount() : null;
  const skipScreenshotGate = Boolean(args["skip-screenshot-gate"]);
  const semanticRequest = parseSemanticRequest(args);
  const port = Number(args.port || 4723);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be a valid unprivileged TCP port.");
  if (!host) throw new Error("--host is required.");
  if (!sdbSerialArgument) throw new Error("--sdb-serial is required; it may differ from the TV address.");
  if (!model) throw new Error("--model is required so POC evidence identifies the actual TV under test.");
  if (!Number.isInteger(modelYear) || modelYear < 2015 || modelYear > new Date().getUTCFullYear() + 1) {
    throw new Error("--model-year must be a plausible four-digit TV model year.");
  }
  if (!chromedriver || !fs.existsSync(chromedriver)) throw new Error("--chromedriver must name an existing compatible executable.");
  if (args.deploy && !args.package) throw new Error("--deploy requires --package.");
  if (args["verify-logout"] && !args["login-from-env"]) {
    throw new Error("--verify-logout requires --login-from-env so logout is proven with the dedicated test account after reset.");
  }
  if (args.package) assertSafePackage(args.package, appId);

  const env = appiumEnvironment();
  const runId = `samsung-tizen-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const writer = createEvidenceWriter(evidenceRoot, runId);
  const secrets = [rcToken, dedicatedAccount?.username, dedicatedAccount?.password];
  const manifest = {
    runId,
    platform: "samsung-tizen",
    status: "running",
    evidencePolicy: "local-only-redacted",
    visualCapture: visualCaptureStatus({ skipScreenshotGate }),
    device: {
      model,
      modelYear,
      firmwareReported: args.firmware || "not supplied",
      supportStatus: "POC in progress; this run cannot establish support until every required check passes",
      host: redactHost(host),
      appId,
      expectedTestAppId: EXPECTED_TEST_APP_ID,
      expectedIdUsed: isExpectedSamsungTestId(appId),
      remotePairingToken: rcToken ? "runtime environment" : "driver-local cache",
    },
    toolchain: toolchainSnapshot(env),
    checks: {},
  };
  manifest.toolchain.detected.chromedriver = commandVersion(path.resolve(chromedriver), ["--version"], env);
  if (skipScreenshotGate) {
    manifest.checks.appiumScreenshot = {
      passed: false,
      skipped: "Operator selected --skip-screenshot-gate; no Appium screenshot request was made.",
    };
  }
  writer.writeJson("manifest.json", manifest);
  let server;
  let sessionId;
  const appiumLogCapture = createCredentialSafeAppiumLogCapture({
    redact: (chunk) => redactValue(chunk, secrets),
  });
  let screenshotTimedOut = false;
  let sdb;
  let sdbSerial;
  let initialForwardedPorts;
  let completion;
  const appiumBase = `http://127.0.0.1:${port}`;

  try {
    sdb = vendorTool("sdb");
    const tizen = vendorTool("tizen");
    const sdbConnect = run(sdb, ["connect", host], { env });
    const devices = run(sdb, ["devices"], { env });
    sdbSerial = findSdbSerial(devices.stdout, host, sdbSerialArgument);
    manifest.checks.vendorConnection = {
      passed: Boolean(sdbSerial),
      output: redactValue(`${sdbConnect.stdout}\n${devices.stdout}`, secrets),
    };
    if (!manifest.checks.vendorConnection.passed) {
      throw new Error("SDB did not report the requested Samsung --sdb-serial after connection.");
    }
    initialForwardedPorts = listSdbForwardedLocalPorts(sdb, sdbSerial, env);

    if (args.deploy) {
      const packagePath = path.resolve(args.package);
      const deployment = run(tizen, buildTizenInstallArgs(sdbSerial, packagePath), { env });
      manifest.checks.deployment = { passed: true, output: redactValue(deployment.stdout, secrets) };
    } else {
      manifest.checks.deployment = { passed: false, skipped: "No --deploy flag. Existing test package only." };
    }

    const capabilities = buildTizenCapabilities({
      host,
      sdbSerial,
      appId,
      chromedriverPath: chromedriver,
      rcToken,
    });
    writer.writeJson("capabilities.redacted.json", {
      ...capabilities,
      "appium:deviceName": redactHost(host),
      "appium:deviceAddress": redactHost(host),
      "appium:udid": redactHost(sdbSerial),
      "appium:rcToken": "[REDACTED]",
    });
    server = startAppium(port, env, (chunk) => { appiumLogCapture.append(chunk); });
    await waitForAppium(appiumBase, server);
    manifest.checks.appiumStarted = { passed: true, boundTo: "127.0.0.1" };

    const session = await appiumRequest(appiumBase, "/session", "POST", {
      capabilities: { alwaysMatch: capabilities, firstMatch: [{}] },
    }, { timeoutMs: 120_000 });
    sessionId = session.sessionId || session?.capabilities?.sessionId;
    if (!sessionId) throw new Error("Appium did not return a session ID.");
    const sessionBase = `${appiumBase}/session/${sessionId}`;
    manifest.checks.session = { passed: true };

    await execute(sessionBase, "tizen: terminateApp", [{ pkgId: packageId }]);
    await execute(sessionBase, "tizen: activateApp", [{ appPackage: appId, debug: true }]);
    await execute(sessionBase, "tizen: clearApp", []);
    const resetDom = await waitForUsableDom(sessionBase);
    manifest.checks.resetRestart = {
      passed: Boolean(resetDom.bodyText || resetDom.focused),
      method: "tizen: terminateApp(distinct test package) then tizen: activateApp(debug=true) then tizen: clearApp",
      packageId,
      scope: "MyTV web storage only; vendor/developer-mode preservation still requires physical verification.",
    };
    const before = await captureEvidence(writer, "01-after-reset", sessionBase, secrets, { skipScreenshotGate });

    if (!dedicatedAccount) {
      await execute(sessionBase, "tizen: pressKey", [{ key: "KEY_UP" }]);
      const afterUp = await captureEvidence(writer, "02-after-up", sessionBase, secrets, { skipScreenshotGate });
      await execute(sessionBase, "tizen: pressKey", [{ key: "KEY_RIGHT" }]);
      const observedAfterRight = await waitForFocusChange({
        initialDom: afterUp,
        readDomState: () => readDomState(sessionBase),
      });
      const afterRight = await captureEvidence(writer, "03-after-right", sessionBase, secrets, { skipScreenshotGate });
      manifest.checks.realRemoteRight = {
        passed: focusedIdentity(afterUp) !== focusedIdentity(observedAfterRight),
        beforeFocus: afterUp.focused,
        afterFocus: observedAfterRight.focused,
      };
      if (!manifest.checks.realRemoteRight.passed) {
        throw new Error("The real KEY_RIGHT press did not produce a detectable focused/active DOM change.");
      }
      await execute(sessionBase, "tizen: pressKey", [{ key: "KEY_ENTER" }]);
      const afterOk = await captureEvidence(writer, "04-after-ok", sessionBase, secrets, { skipScreenshotGate });
      await execute(sessionBase, "tizen: pressKey", [{ key: "KEY_RETURN" }]);
      const afterBack = await captureEvidence(writer, "05-after-back", sessionBase, secrets, { skipScreenshotGate });
      manifest.checks.realRemoteKeys = { passed: true, keys: ["KEY_UP", "KEY_RIGHT", "KEY_ENTER", "KEY_RETURN"] };
      manifest.checks.domInspection = {
        passed: Boolean(afterRight.bodyText) && Boolean(afterRight.focused || afterOk.focused || afterBack.focused),
        selectors: ["body.innerText", ".focused", "dialog .active"],
      };
    } else {
      manifest.checks.realRemoteRight = {
        passed: false,
        skipped: "Dedicated-account runs activate the initial Đăng nhập control directly; no pre-login right/experience probe is performed.",
      };
      manifest.checks.realRemoteKeys = {
        passed: false,
        skipped: "Dedicated-account login and semantic navigation provide the real-remote evidence without leaving the welcome screen first.",
      };
      manifest.checks.domInspection = {
        passed: Boolean(resetDom.bodyText) && Boolean(resetDom.focused),
        selectors: ["body.innerText", ".focused", "dialog .active"],
      };
    }
    if (!manifest.checks.domInspection.passed) {
      throw new Error(`Required body/focus DOM inspection is not available on Samsung model ${model}.`);
    }

    if (dedicatedAccount) {
      appiumLogCapture.stop();
      manifest.checks.credentialPrivacy = {
        passed: true,
        method: "Stopped Appium process-log capture before virtual-keyboard credential entry.",
      };
      await prepareDedicatedLogin({
        execute: (script, commandArgs = []) => execute(sessionBase, script, commandArgs),
        appId,
        packageId,
        initialWelcomeReady: true,
      });
      manifest.checks.dedicatedAccountLoginStart = {
        passed: true,
        method: "Initial test-app reset followed by direct account-login control readiness; no experience-screen probe or second reset",
        packageId,
      };
      await loginWithDedicatedAccount({
        execute: (script, commandArgs = []) => execute(sessionBase, script, commandArgs),
        credentials: dedicatedAccount,
      });
      const loggedIn = await captureEvidence(writer, "06-after-dedicated-login", sessionBase, secrets, { skipScreenshotGate });
      manifest.checks.dedicatedAccountLogin = {
        passed: true,
        method: "Appium remote keys plus MyTV virtual keyboard, one character at a time",
        state: loggedIn,
      };
      manifest.checks.realRemoteKeys = {
        passed: true,
        method: "Direct initial Đăng nhập activation plus MyTV virtual-keyboard navigation through Appium Tizen remote keys",
      };
    } else {
      manifest.checks.dedicatedAccountLogin = { passed: false, skipped: "Pass --login-from-env with runtime-only dedicated-account credentials." };
    }

    if (semanticRequest) {
      try {
        const semantic = await runSemanticSearchPlayback({
          execute: (script, commandArgs = []) => execute(sessionBase, script, commandArgs),
          request: semanticRequest,
        });
        const semanticDom = await captureEvidence(writer, "07-after-semantic-playback", sessionBase, secrets, { skipScreenshotGate });
        manifest.checks.semanticSearch = {
          passed: true,
          method: "Real remote search menu/navigation and character-by-character MyTV virtual keyboard input",
          request: semanticRequest,
          result: semantic.searchResult,
        };
        manifest.checks.semanticPlayback = {
          passed: true,
          method: "DOM-only two-sample visible-video assessment after remote activation",
          player: semantic.player,
          state: semanticDom,
        };
        await leavePlayerAfterAssessment({
          semantic,
          wait: (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs)),
        });
        manifest.checks.semanticPlayerExit = {
          passed: true,
          method: "Real Back key followed by a two-second player-session unload wait before logout",
        };
      } catch (semanticError) {
        const semanticDom = await captureEvidence(writer, "07-semantic-failure", sessionBase, secrets, { skipScreenshotGate });
        manifest.checks.semanticSearch = {
          passed: false,
          request: semanticRequest,
          error: redactValue(semanticError.message, secrets),
        };
        manifest.checks.semanticPlayback = {
          passed: false,
          error: redactValue(semanticError.message, secrets),
          details: semanticError.details || null,
          state: semanticDom,
        };
        throw semanticError;
      }
    } else {
      manifest.checks.semanticSearch = {
        passed: false,
        skipped: "Pass --skip-screenshot-gate --login-from-env --verify-logout --search-name <known-playable-title> --content-type <channel|movie|content> for the Samsung DOM-only semantic POC.",
      };
      manifest.checks.semanticPlayback = {
        passed: false,
        skipped: "Semantic playback requires the same explicit DOM-only search request.",
      };
    }

    if (args["verify-logout"]) {
      await logoutToLoginScreen({
        execute: (script, commandArgs = []) => execute(sessionBase, script, commandArgs),
      });
      const loggedOut = await captureEvidence(writer, semanticRequest ? "08-after-logout" : "07-after-logout", sessionBase, secrets, { skipScreenshotGate });
      manifest.checks.automaticLogout = {
        passed: true,
        method: "trusted window.processLogOut, two-second wait, account-login confirmation, then MyTV localStorage clear",
        state: loggedOut,
      };
    } else {
      manifest.checks.automaticLogout = { passed: false, skipped: "Pass --login-from-env --verify-logout to prove automatic logout after the dedicated-account login." };
    }

    completion = pocCompletion({ skipScreenshotGate, evidenceDir: writer.evidenceDir });
    manifest.visualCapture = visualCaptureStatus({ skipScreenshotGate, captureSucceeded: true });
    manifest.status = completion.status;
    manifest.completedAt = new Date().toISOString();
  } catch (error) {
    screenshotTimedOut = /GET \/screenshot timed out after \d+ms\./.test(String(error?.message || error));
    if (error?.appiumScreenshotError) {
      manifest.visualCapture = "unavailable";
      manifest.checks.appiumScreenshot = {
        error: error.appiumScreenshotError,
        passed: false,
      };
    }
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.error = redactValue(error?.stack || error?.message || String(error), secrets);
    throw error;
  } finally {
    if (sessionId && !screenshotTimedOut) {
      try {
        await appiumRequest(`${appiumBase}/session/${sessionId}`, "", "DELETE", undefined, { timeoutMs: 90_000 });
        recordPocCleanup(manifest, "sessionClosed", { passed: true });
      } catch (cleanupError) {
        recordPocCleanup(manifest, "sessionClosed", {
          passed: false,
          error: redactValue(cleanupError.message, secrets),
        });
      }
    } else if (sessionId) {
      manifest.checks.sessionClosed = {
        passed: false,
        skipped: "The proxied Appium screenshot request timed out; Appium's local process group is terminated instead of queueing a second WebDriver request.",
      };
    }
    await stopProcess(server, { prompt: screenshotTimedOut });
    recordPocCleanup(manifest, "appiumStopped", { passed: !server || server.exitCode !== null });
    if (sdb && sdbSerial && initialForwardedPorts) {
      try {
        const removedPorts = removeNewSdbForwards(sdb, sdbSerial, initialForwardedPorts, env);
        recordPocCleanup(manifest, "sdbForwardsReleased", { passed: true, removedPorts });
      } catch (cleanupError) {
        recordPocCleanup(manifest, "sdbForwardsReleased", {
          passed: false,
          error: redactValue(cleanupError.message, secrets),
        });
      }
    }
    writer.writeJson("appium.redacted.log.json", { log: redactValue(appiumLogCapture.value(), secrets).slice(-50000) });
    writer.writeJson("manifest.json", manifest);
  }

  completion = pocCompletion({ skipScreenshotGate, evidenceDir: writer.evidenceDir, status: manifest.status });
  if (completion.status === "failed") throw new Error(completion.message);
  process.stdout.write(`${completion.message}\n`);
}

async function setupTizenDriver() {
  const env = appiumEnvironment();
  const appiumBin = path.join(projectRoot, "node_modules", ".bin", "appium");
  const driverPackage = `appium-tizen-tv-driver@${toolchain.tizenDriver}`;
  const install = run(appiumBin, ["driver", "install", "--source=npm", driverPackage], { env });
  const list = run(appiumBin, ["driver", "list", "--installed"], { env });
  process.stdout.write(`${install.stdout}${install.stderr}${list.stdout}${list.stderr}`);
}

function doctor() {
  const snapshot = toolchainSnapshot(appiumEnvironment());
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

function pairTizen(args) {
  if (!args.host) throw new Error("--host is required for remote pairing.");
  const env = appiumEnvironment();
  const appiumBin = path.join(projectRoot, "node_modules", ".bin", "appium");
  const pair = spawnSync(appiumBin, ["driver", "run", "tizentv", "pair-remote", "--host", args.host], { encoding: "utf8", env, stdio: "inherit" });
  if ((pair.status ?? 1) !== 0) throw new Error("Remote pairing did not complete. Resolve the on-TV prompt before retrying.");
}

async function main() {
  const command = ["setup", "doctor", "pair"].includes(process.argv[2]) ? process.argv[2] : "run";
  const rawArgs = command === "run" ? process.argv.slice(2) : process.argv.slice(3);
  const args = parseArgs(rawArgs);
  if (command === "setup") return setupTizenDriver();
  if (command === "doctor") return doctor();
  if (command === "pair") return pairTizen(args);
  return runPoc(args);
}

main().catch((error) => {
  process.stderr.write(`Samsung Tizen POC failed: ${redactValue(error?.message || String(error), [process.env.MYTV_TIZEN_RC_TOKEN])}\n`);
  process.exitCode = 1;
});
