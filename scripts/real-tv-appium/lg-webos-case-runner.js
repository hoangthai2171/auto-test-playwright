#!/usr/bin/env node
"use strict";

const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");
const {createTvRunner} = require("../../app/tv-runner");
const {createDeviceLock} = require("../../app/device-lock");
const {createAppiumServerManager} = require("../../app/appium-server-manager");
const {createWebOsSessionFactory} = require("../../tests/lib/tv-session/webos-appium-session");
const {EXPECTED_LG_APP_ID, buildLgRuntimeRedactionSecrets} = require("./lg-webos-poc-core");
const {createLgProductGateCase, parseLgCaseRunnerArgs, withoutLgProductGateCredentials} = require("./lg-webos-case-runner-core");

function usage() {
  return "Usage: node scripts/real-tv-appium/lg-webos-case-runner.js --device <registered-name> --host <runtime-host> --model <observed-model> --app-id com.mytvb2c.app --chromedriver <absolute-path> --search-name <known-title> --content-type <channel|movie|content> --runtime-root <local-runtime-root> [--port <loopback-port>] --secure-websocket --allow-self-signed-tls";
}

function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function redactFactory(secrets) {
  return (value) => secrets.reduce((text, secret) => String(text).split(String(secret)).join("[REDACTED]"), String(value ?? ""));
}

async function appiumRequest(baseUrl, pathname, method = "GET", body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: body ? {"content-type": "application/json"} : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Loopback Appium request failed.");
  return payload.value;
}

function createAppiumClient({baseUrl}) {
  let sessionId = "";
  function sessionPath(suffix) {
    if (!sessionId) throw new Error("Appium session is unavailable.");
    return `/session/${sessionId}${suffix}`;
  }
  return {
    async createSession(capabilities) {
      const session = await appiumRequest(baseUrl, "/session", "POST", capabilities);
      sessionId = session?.sessionId || session?.capabilities?.sessionId || "";
      if (!sessionId) throw new Error("Appium did not return a session ID.");
    },
    execute: (script, args) => appiumRequest(baseUrl, sessionPath("/execute/sync"), "POST", {script, args}),
    screenshot: () => appiumRequest(baseUrl, sessionPath("/screenshot")),
    deleteSession: () => appiumRequest(baseUrl, sessionPath(""), "DELETE"),
  };
}

function runReadOnly(command, args, env) {
  const result = spawnSync(command, args, {encoding: "utf8", env, timeout: 60_000});
  if (result.status !== 0) throw new Error("Read-only LG preflight failed.");
  return String(result.stdout || "");
}

async function main() {
  const args = parseLgCaseRunnerArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(`${usage()}\n`); return; }
  if (!args["secure-websocket"] || !args["allow-self-signed-tls"]) throw new Error("The approved LG gate requires secure WebSocket transport and the process-scoped TLS exception.");
  if (args["app-id"] !== EXPECTED_LG_APP_ID) throw new Error("The approved installed MyTV app ID is required.");
  const username = String(process.env.MYTV_LG_TEST_USERNAME || "");
  const password = String(process.env.MYTV_LG_TEST_PASSWORD || "");
  const vendorEnv = withoutLgProductGateCredentials(process.env);
  const testCase = createLgProductGateCase({username, password, searchName: args["search-name"], contentType: args["content-type"]});
  const runtimeRoot = path.resolve(args["runtime-root"] || path.resolve(__dirname, "../.."));
  const runtime = {
    appiumHome: path.join(runtimeRoot, ".real-tv-appium", "appium-home"),
    appiumBin: path.join(runtimeRoot, "node_modules", ".bin", "appium"),
    webosSdk: path.join(runtimeRoot, ".real-tv-appium", "webos-sdk"),
  };
  const port = Number(args.port || 4727);
  const redactor = redactFactory([...buildLgRuntimeRedactionSecrets(args.host), username, password]);
  const aresInfo = path.join(runtime.webosSdk, "CLI", "bin", "ares-device-info");
  const aresInstall = path.join(runtime.webosSdk, "CLI", "bin", "ares-install");
  const profile = {id: "lg-product-gate", label: "LG product gate", platform: "lg", appId: EXPECTED_LG_APP_ID, model: args.model};
  const discovery = {
    async validate() {
      const info = runReadOnly(aresInfo, ["--device", args.device], vendorEnv);
      const apps = runReadOnly(aresInstall, ["--device", args.device, "--list"], vendorEnv);
      if (!info.includes(args.model) || !apps.includes(EXPECTED_LG_APP_ID)) return {status: "APP_NOT_INSTALLED"};
      return {status: "ready"};
    },
  };
  const serverManager = createAppiumServerManager({spawn, fetch, kill: process.kill.bind(process), redact: redactor, wait});
  const runner = createTvRunner({
    registry: {async list() { return [profile]; }},
    discovery,
    lock: createDeviceLock(),
    serverManager,
    sessionFactory: createWebOsSessionFactory({clientFactory: async (options) => createAppiumClient(options), secrets: [args.host, username, password]}),
    redact: redactor,
  });
  delete process.env.MYTV_LG_TEST_USERNAME;
  delete process.env.MYTV_LG_TEST_PASSWORD;
  try {
    await runner.run({
      profileId: profile.id,
      host: args.host,
      sharedDeviceAcknowledged: true,
      secureWebsocket: true,
      allowSelfSignedTls: true,
      connection: {deviceName: args.device, deviceHost: args.host, chromedriverPath: path.resolve(args.chromedriver), remoteOnly: false, rcMode: "rc"},
      appium: {port, appiumHome: runtime.appiumHome, appiumBin: runtime.appiumBin},
      testCase,
    });
  } finally {
    process.env.MYTV_LG_TEST_USERNAME = username;
    process.env.MYTV_LG_TEST_PASSWORD = password;
  }
  process.stdout.write("LG product gate passed.\n");
}

main().catch(() => { process.stderr.write("LG product gate failed. Inspect only redacted local diagnostics.\n"); process.exitCode = 1; });
