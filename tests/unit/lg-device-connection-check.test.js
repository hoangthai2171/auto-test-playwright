const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgDeviceConnectionChecker} = require("../../app/lg-device-connection-check");

function createHarness({profiles, deviceInfo, apps, failure} = {}) {
  const calls = [];
  const checker = createLgDeviceConnectionChecker({
    registry: {
      async list() {
        return profiles || [{
          id: "lab-lg",
          platform: "webos",
          appId: "com.mytvb2c.app",
          model: "OLED55",
          vendorDeviceName: "registered-lg",
        }];
      },
    },
    adapter: {
      async deviceInfo(connection) {
        calls.push(["deviceInfo", connection]);
        if (failure) throw new Error("connection failed");
        return deviceInfo || {model: "OLED55", firmware: "1.0"};
      },
      async listApps(connection) {
        calls.push(["listApps", connection]);
        if (failure) throw new Error("connection failed");
        return apps || [{id: "com.mytvb2c.app", version: "3.5.0"}];
      },
    },
  });
  return {checker, calls};
}

test("checks only the registered LG target identity and installed MyTV app", async () => {
  const {checker, calls} = createHarness();

  assert.deepEqual(await checker.check({deviceId: "lab-lg"}), {ok: true, status: "CONNECTED"});
  assert.deepEqual(calls, [
    ["deviceInfo", {deviceName: "registered-lg"}],
    ["listApps", {deviceName: "registered-lg"}],
  ]);
});

test("does not contact an LG profile without an existing vendor target", async () => {
  const {checker, calls} = createHarness({
    profiles: [{
      id: "lab-lg",
      platform: "webos",
      appId: "com.mytvb2c.app",
      model: "OLED55",
    }],
  });

  assert.deepEqual(await checker.check({deviceId: "lab-lg"}), {
    ok: false,
    status: "REGISTERED_TARGET_REQUIRED",
  });
  assert.deepEqual(calls, []);
});

test("does not report connected when the installed MyTV app is absent", async () => {
  const {checker} = createHarness({apps: []});

  assert.deepEqual(await checker.check({deviceId: "lab-lg"}), {
    ok: false,
    status: "APP_NOT_INSTALLED",
  });
});

test("returns a fixed unavailable status when a read-only adapter fails", async () => {
  const {checker} = createHarness({failure: true});

  assert.deepEqual(await checker.check({deviceId: "lab-lg"}), {
    ok: false,
    status: "CONNECTION_UNAVAILABLE",
  });
});
