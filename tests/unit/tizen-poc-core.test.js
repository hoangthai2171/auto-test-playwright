const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EXPECTED_TEST_APP_ID,
  PRODUCTION_APP_ID,
  assertSdbSerial,
  assertSafePackage,
  assertSafeSamsungAppId,
  buildTizenInstallArgs,
  buildTizenCapabilities,
  capturePocEvidence,
  createCredentialSafeAppiumLogCapture,
  packageAppId,
  pocCompletion,
  recordPocCleanup,
  redactDomState,
  redactHost,
  samsungPackageIdFromAppId,
  visualCaptureStatus,
  waitForFocusChange,
} = require("../../scripts/real-tv-appium/tizen-poc-core");

test("Samsung POC default evidence requires a genuine Appium screenshot", async () => {
  const writes = [];
  await assert.rejects(
    capturePocEvidence({
      label: "01-after-reset",
      readDomState: async () => ({ bodyText: "Welcome", focused: "", active: "", screenUrl: "" }),
      requestScreenshot: async () => { throw new Error("GET /screenshot timed out after 20000ms."); },
      writer: {
        writeJson: (...args) => writes.push(["json", ...args]),
        writeScreenshot: () => writes.push(["png"]),
      },
      secrets: [],
      skipScreenshotGate: false,
    }),
    /GET \/screenshot timed out/
  );
  assert.equal(writes[0][0], "json");
});

test("Samsung POC skip mode records DOM without requesting a screenshot", async () => {
  let requests = 0;
  const result = await capturePocEvidence({
    label: "02-after-up",
    readDomState: async () => ({ bodyText: "password=secret", focused: "", active: "", screenUrl: "" }),
    requestScreenshot: async () => { requests += 1; return "not-used"; },
    writer: {
      writeJson() {},
      writeScreenshot() { throw new Error("must not write PNG"); },
    },
    secrets: ["secret"],
    skipScreenshotGate: true,
  });
  assert.equal(requests, 0);
  assert.doesNotMatch(result.bodyText, /secret/);
});

test("Samsung POC skip mode cannot report a complete screenshot-gated pass", () => {
  assert.deepEqual(
    pocCompletion({ skipScreenshotGate: true, evidenceDir: "/private/evidence" }),
    {
      status: "passed_without_screenshot_gate",
      message: "Samsung Tizen partial POC passed without the screenshot gate. Redacted local evidence: /private/evidence",
    }
  );
});

test("Samsung DOM-only POC records visual capture as unavailable", () => {
  assert.equal(visualCaptureStatus({ skipScreenshotGate: true }), "unavailable");
});

test("Samsung partial POC fails when required cleanup fails", () => {
  const manifest = { status: "passed_without_screenshot_gate", checks: {} };

  recordPocCleanup(manifest, "sessionClosed", { passed: false, error: "close failed" });

  assert.equal(manifest.checks.sessionClosed.passed, false);
  assert.equal(manifest.status, "failed");
});

test("Samsung partial POC never formats a failed cleanup as success", () => {
  assert.deepEqual(
    pocCompletion({
      skipScreenshotGate: true,
      evidenceDir: "/private/evidence",
      status: "failed",
    }),
    {
      status: "failed",
      message: "Samsung Tizen POC failed during required cleanup. Redacted local evidence: /private/evidence",
    }
  );
});

test("Samsung POC hard-blocks the production store app with no override", () => {
  assert.throws(() => assertSafeSamsungAppId(PRODUCTION_APP_ID), /refusing production/i);
  assert.equal(assertSafeSamsungAppId(EXPECTED_TEST_APP_ID), EXPECTED_TEST_APP_ID);
});

test("Samsung POC requires a distinct test ID and SDB serial, with a pairing token only as an optional runtime override", () => {
  assert.throws(() => assertSdbSerial("not-a-serial"), /SDB serial/i);
  assert.throws(() => buildTizenCapabilities({ host: "192.168.1.6", appId: EXPECTED_TEST_APP_ID, chromedriverPath: "/tmp/chromedriver" }), /SDB serial/i);
  const cachedTokenCapabilities = buildTizenCapabilities({
    host: "192.168.1.6",
    sdbSerial: "192.168.1.8:26101",
    appId: EXPECTED_TEST_APP_ID,
    chromedriverPath: "/tmp/chromedriver",
  });
  assert.equal(cachedTokenCapabilities["appium:rcToken"], undefined);
  const capabilities = buildTizenCapabilities({
    host: "192.168.1.6",
    sdbSerial: "192.168.1.8:26101",
    appId: EXPECTED_TEST_APP_ID,
    chromedriverPath: "/tmp/chromedriver",
    rcToken: "private-token",
  });
  assert.equal(capabilities["appium:appPackage"], EXPECTED_TEST_APP_ID);
  assert.equal(capabilities["appium:udid"], "192.168.1.8:26101");
  assert.equal(capabilities["appium:rcMode"], "remote");
  assert.equal(capabilities["appium:rcOnly"], true);
  assert.equal(capabilities["appium:rcToken"], "private-token");
  assert.equal(capabilities["appium:noReset"], true);
});

test("Samsung POC derives a terminate-safe test package ID from the distinct app ID", () => {
  assert.equal(samsungPackageIdFromAppId(EXPECTED_TEST_APP_ID), "PP2MTMRMs8");
  assert.throws(() => samsungPackageIdFromAppId(PRODUCTION_APP_ID), /refusing production/i);
});

test("Samsung POC verifies a WGT app identity before deployment", () => {
  const runCommand = () => ({
    status: 0,
    stdout: '<widget><tizen:application id="PP2MTMRMs8.MyTV"/></widget>',
    stderr: "",
  });
  assert.equal(packageAppId("/private/test.wgt", runCommand), EXPECTED_TEST_APP_ID);
  assert.equal(assertSafePackage("/private/test.wgt", EXPECTED_TEST_APP_ID, runCommand), EXPECTED_TEST_APP_ID);
  assert.throws(() => assertSafePackage("/private/test.wgt", "different.id", runCommand), /does not match/i);
});

test("Samsung POC uses the Tizen TV installer with only the verified package directory", () => {
  assert.deepEqual(
    buildTizenInstallArgs("10.0.0.2:26101", "/private/build/MyTV-test.wgt"),
    ["install", "-s", "10.0.0.2:26101", "--name", "MyTV-test.wgt", "--", "/private/build"]
  );
  assert.throws(() => buildTizenInstallArgs("", "/private/build/MyTV-test.wgt"), /serial/i);
  assert.throws(() => buildTizenInstallArgs("device", "/private/build/MyTV-test.ipk"), /.wgt/i);
});

test("Samsung POC redacts host and sensitive DOM text before local evidence is written", () => {
  assert.equal(redactHost("192.168.1.40"), "192.168.1.x");
  const redacted = redactDomState({
    bodyText: "password=secret host 192.168.1.40",
    focused: "<button>Continue</button>",
    active: "",
    screenUrl: "http://192.168.1.40/app",
  }, ["secret"]);
  assert.doesNotMatch(redacted.bodyText, /secret|192\.168\.1\.40/);
  assert.equal(redacted.screenUrl, "http://192.168.1.x/app");
});

test("Samsung POC redacts profile labels and IDs from logout DOM evidence", () => {
  const redacted = redactDomState({
    bodyText: "Profile names and identifiers",
    focused: '<span profile_id="private-id" profile_name="private-name">private-name</span>',
    active: "",
    screenUrl: "file:///index.html#chooseProfile?_d=-1",
  });

  assert.equal(redacted.bodyText, "[REDACTED PROFILE SELECTION SCREEN]");
  assert.equal(redacted.focused, "[REDACTED PROFILE ITEM]");
  assert.doesNotMatch(redacted.screenUrl, /private/);
});

test("Samsung POC waits briefly for an asynchronous remote-focus DOM update", async () => {
  const initialDom = { focused: "<span>Đăng nhập</span>", active: "" };
  const observed = [
    initialDom,
    { focused: "<span>Trải nghiệm</span>", active: "" },
  ];
  const result = await waitForFocusChange({
    initialDom,
    readDomState: async () => observed.shift() || initialDom,
    timeoutMs: 20,
    pollMs: 0,
  });

  assert.equal(result.focused, "<span>Trải nghiệm</span>");
});

test("Samsung POC stops capturing Appium logs before virtual-keyboard credentials are used", () => {
  const capture = createCredentialSafeAppiumLogCapture({ redact: (value) => String(value).replace(/private/g, "[REDACTED]") });
  capture.append("safe startup log");
  capture.stop();
  capture.append("private key-a-v2");

  assert.equal(capture.value(), "safe startup log");
});
