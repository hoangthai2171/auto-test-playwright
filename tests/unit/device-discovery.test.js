const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceDiscovery} = require("../../app/device-discovery");

const approvedProfile = {
  id: "office-lg",
  label: "Office LG",
  platform: "webos",
  appId: "com.mytvb2c.app",
  model: "OLED55C4",
  vendorDeviceName: "registered-lg",
};

function redactor(value) {
  return String(value).replaceAll("192.168.1.9", "[host]").replaceAll("pairing-secret", "[secret]");
}

test("rejects unsupported profiles before contacting a webOS adapter", async () => {
  let adapterCalls = 0;
  const discovery = createDeviceDiscovery({
    webos: {
      async deviceInfo() { adapterCalls += 1; },
      async listApps() { adapterCalls += 1; },
    },
    redact: redactor,
  });

  await assert.rejects(
    discovery.validate({...approvedProfile, platform: "tizen"}, {host: "192.168.1.9"}),
    (error) => error.code === "PLATFORM_UNSUPPORTED",
  );
  await assert.rejects(
    discovery.validate({...approvedProfile, appId: "org.example.other"}, {host: "192.168.1.9"}),
    (error) => error.code === "APP_ID_UNSUPPORTED",
  );
  assert.equal(adapterCalls, 0);
});

test("requires a registered webOS device name before contacting the adapter", async () => {
  let adapterCalls = 0;
  const discovery = createDeviceDiscovery({
    webos: {
      async deviceInfo() { adapterCalls += 1; },
      async listApps() { adapterCalls += 1; },
    },
    redact: redactor,
  });

  await assert.rejects(
    discovery.validate({...approvedProfile, vendorDeviceName: ""}, {host: "192.168.1.9"}),
    (error) => error.code === "DEVICE_NAME_REQUIRED",
  );
  assert.equal(adapterCalls, 0);
});

test("returns redacted read-only LG identity and installed-app evidence", async () => {
  const calls = [];
  const discovery = createDeviceDiscovery({
    webos: {
      async deviceInfo(connection) {
        calls.push(["deviceInfo", connection]);
        return {model: "OLED55C4", firmware: "23.20.56", pairingState: "paired"};
      },
      async listApps(connection) {
        calls.push(["listApps", connection]);
        return [{id: "com.other.app", version: "1"}, {id: "com.mytvb2c.app", version: "3.5.0"}];
      },
      launch() { throw new Error("launch must not run"); },
      install() { throw new Error("install must not run"); },
      reset() { throw new Error("reset must not run"); },
    },
    redact: redactor,
  });

  const result = await discovery.validate(approvedProfile, {host: "192.168.1.9"});

  assert.equal(result.status, "ready");
  assert.deepEqual(result.identity, {model: "OLED55C4", firmware: "23.20.56"});
  assert.deepEqual(result.installedApp, {id: "com.mytvb2c.app", version: "3.5.0"});
  assert.deepEqual(calls, [["deviceInfo", {deviceName: "registered-lg", host: "192.168.1.9"}], ["listApps", {deviceName: "registered-lg", host: "192.168.1.9"}]]);
  assert.match(JSON.stringify(result.diagnostics), /\[host\]/);
  assert.doesNotMatch(JSON.stringify(result), /192\.168\.1\.9|pairing-secret/);
});

test("blocks a different observed LG model before reporting ready", async () => {
  const discovery = createDeviceDiscovery({
    webos: {
      async deviceInfo() { return {model: "OLED65C4", firmware: "23.20.56"}; },
      async listApps() { return [{id: "com.mytvb2c.app", version: "3.5.0"}]; },
    },
    redact: redactor,
  });

  const result = await discovery.validate(approvedProfile, {host: "192.168.1.9"});

  assert.equal(result.status, "MODEL_MISMATCH");
  assert.equal(result.installedApp.id, "com.mytvb2c.app");
  assert.equal(result.diagnostics.code, "MODEL_MISMATCH");
  assert.match(JSON.stringify(result.diagnostics), /\[host\]/);
});

test("classifies a missing installed app without making a changing webOS call", async () => {
  const calls = [];
  const discovery = createDeviceDiscovery({
    webos: {
      async deviceInfo(connection) {
        calls.push(["deviceInfo", connection]);
        return {model: "OLED55C4", firmware: "23.20.56"};
      },
      async listApps(connection) {
        calls.push(["listApps", connection]);
        return [];
      },
      launch() { calls.push(["launch"]); },
      install() { calls.push(["install"]); },
      reset() { calls.push(["reset"]); },
    },
    redact: redactor,
  });

  const result = await discovery.validate(approvedProfile, {host: "192.168.1.9"});

  assert.equal(result.status, "APP_NOT_INSTALLED");
  assert.equal(result.installedApp, null);
  assert.deepEqual(calls, [["deviceInfo", {deviceName: "registered-lg", host: "192.168.1.9"}], ["listApps", {deviceName: "registered-lg", host: "192.168.1.9"}]]);
  assert.doesNotMatch(JSON.stringify(result), /192\.168\.1\.9/);
});
