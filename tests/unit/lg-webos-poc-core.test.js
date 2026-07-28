const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXPECTED_LG_APP_ID,
  assertSafeLgAppId,
  buildLgCapabilities,
  buildLgPocEnvironment,
  buildLgRuntimeRedactionSecrets,
  captureGenuinePocEvidence,
  hasFocusedText,
  parseLgPocArgs,
  runVisibleFocusCheck,
} = require("../../scripts/real-tv-appium/lg-webos-poc-core");
const {redactValue} = require("../../scripts/real-tv-appium/tizen-poc-core");

test("LG POC accepts only the inspected MyTV app ID", () => {
  assert.equal(assertSafeLgAppId(EXPECTED_LG_APP_ID), "com.mytvb2c.app");
  assert.throws(() => assertSafeLgAppId("com.example.other"), /expected LG MyTV app ID/i);
});

test("LG POC capabilities preserve the Developer Mode timer and use the native remote-control path", () => {
  const capabilities = buildLgCapabilities({
    deviceName: "LG2022",
    deviceHost: "192.168.1.8",
    appId: EXPECTED_LG_APP_ID,
    chromedriverPath: "/private/chromedriver",
  });

  assert.equal(capabilities.platformName, "LGTV");
  assert.equal(capabilities["appium:automationName"], "webOS");
  assert.equal(capabilities["appium:appId"], "com.mytvb2c.app");
  assert.equal(capabilities["appium:autoExtendDevMode"], false);
  assert.equal(capabilities["appium:noReset"], false);
  assert.equal(capabilities["appium:fullReset"], false);
  assert.equal(capabilities["appium:remoteOnly"], false);
  assert.equal(capabilities["appium:rcMode"], "rc");
  assert.equal(capabilities["appium:useSecureWebsocket"], false);
  assert.throws(() => buildLgCapabilities({ deviceName: "LG2022", appId: EXPECTED_LG_APP_ID, chromedriverPath: "/private/chromedriver" }), /host/i);
});

test("LG POC uses the secure remote transport only when explicitly requested", () => {
  const capabilities = buildLgCapabilities({
    deviceName: "LG2022",
    deviceHost: "192.168.1.8",
    appId: EXPECTED_LG_APP_ID,
    chromedriverPath: "/private/chromedriver",
    useSecureWebsocket: true,
  });

  assert.equal(capabilities["appium:useSecureWebsocket"], true);
  assert.deepEqual(parseLgPocArgs(["--device", "LG2022", "--secure-websocket"]), {
    device: "LG2022",
    "secure-websocket": true,
  });
});

test("LG POC accepts an explicit visible focus-check mode", () => {
  assert.deepEqual(parseLgPocArgs(["--visible-focus-check"]), {
    "visible-focus-check": true,
  });
});

test("LG POC accepts an explicit MyTV-local-storage reset-only mode", () => {
  assert.deepEqual(parseLgPocArgs(["--reset-only"]), {
    "reset-only": true,
  });
});

test("LG POC recognizes a required stable focused target", () => {
  assert.equal(hasFocusedText({ focused: '<span class="focused">Trải nghiệm</span>' }, "Trải nghiệm"), true);
  assert.equal(hasFocusedText({ focused: '<span class="focused">Đăng nhập</span>' }, "Trải nghiệm"), false);
});

test("LG visible focus check waits for the initial login focus before one Right", async () => {
  const calls = [];
  const login = { focused: '<button class="focused">Đăng nhập</button>' };
  const experience = { focused: '<button class="focused">Trải nghiệm</button>' };

  const result = await runVisibleFocusCheck({
    waitForFocusedText: async (text) => {
      calls.push(["wait", text]);
      return text === "Đăng nhập" ? login : experience;
    },
    capture: async (label, dom) => calls.push(["capture", label, dom]),
    pressRight: async () => calls.push(["right"]),
    hold: async (milliseconds) => calls.push(["hold", milliseconds]),
  });

  assert.deepEqual(calls, [
    ["wait", "Đăng nhập"],
    ["capture", "02-before-visible-right", login],
    ["right"],
    ["wait", "Trải nghiệm"],
    ["capture", "03-after-visible-right", experience],
    ["hold", 5000],
  ]);
  assert.equal(result.focusBeforeRight, login);
  assert.equal(result.afterRight, experience);
});

test("LG POC limits the self-signed TLS exception to an explicitly authorized child environment", () => {
  const normal = buildLgPocEnvironment({
    baseEnv: { PATH: "/bin", NODE_TLS_REJECT_UNAUTHORIZED: "1" },
    appiumHome: "/private/appium-home",
    webosSdkHome: "/private/webos-sdk",
  });
  assert.equal(normal.NODE_TLS_REJECT_UNAUTHORIZED, undefined);

  const approved = buildLgPocEnvironment({
    baseEnv: { PATH: "/bin" },
    appiumHome: "/private/appium-home",
    webosSdkHome: "/private/webos-sdk",
    allowSelfSignedTls: true,
  });
  assert.equal(approved.NODE_TLS_REJECT_UNAUTHORIZED, "0");
  assert.equal(approved.APPIUM_HOME, "/private/appium-home");
  assert.equal(approved.LG_WEBOS_TV_SDK_HOME, "/private/webos-sdk");
  assert.deepEqual(parseLgPocArgs(["--secure-websocket", "--allow-self-signed-tls"]), {
    "secure-websocket": true,
    "allow-self-signed-tls": true,
  });
});

test("LG POC redacts hostname and IPv6 runtime-host forms from persisted diagnostics", () => {
  const hostname = "lab-tv.example.test";
  const ipv6 = "[fd00:1234::42]";
  const hostnameDiagnostic = redactValue(`wss://${hostname}:3001`, buildLgRuntimeRedactionSecrets(hostname));
  const ipv6Diagnostic = redactValue(`wss://${ipv6}:3001 also fd00:1234::42`, buildLgRuntimeRedactionSecrets(ipv6));

  assert.doesNotMatch(hostnameDiagnostic, /lab-tv\.example\.test/i);
  assert.doesNotMatch(ipv6Diagnostic, /fd00:1234::42/i);
});

test("LG POC always saves a genuine Appium screenshot before continuing", async () => {
  const writes = [];
  await assert.rejects(
    captureGenuinePocEvidence({
      label: "01-after-reset",
      readDomState: async () => ({ bodyText: "Welcome", focused: "", active: "", screenUrl: "" }),
      requestScreenshot: async () => { throw new Error("GET /screenshot timed out"); },
      writer: {
        writeJson: (...args) => writes.push(["json", ...args]),
        writeScreenshot: (...args) => writes.push(["png", ...args]),
      },
    }),
    /GET \/screenshot timed out/
  );
  assert.equal(writes[0][0], "json");
  assert.equal(writes.some(([type]) => type === "png"), false);
});

test("LG POC rejects the Samsung-only screenshot bypass flag", () => {
  assert.throws(
    () => parseLgPocArgs(["--device", "LG2022", "--skip-screenshot-gate"]),
    /does not support --skip-screenshot-gate/i
  );
});
