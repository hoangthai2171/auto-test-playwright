const test = require("node:test");
const assert = require("node:assert/strict");

const {createWebOsReadOnlyAdapter, createConfiguredWebOsReadOnlyAdapter} = require("../../app/webos-read-only-adapter");

test("uses only registered-device identity and installed-app inventory commands", async () => {
  const calls = [];
  const adapter = createWebOsReadOnlyAdapter({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(command, args, options) {
      calls.push([command, args, options]);
      if (command.endsWith("ares-device-info")) {
        return {status: 0, stdout: JSON.stringify({modelName: "55QNED80SRA", firmwareVersion: "33.31.61"})};
      }
      return {status: 0, stdout: "com.mytvb2c.app 3.5.0\n"};
    },
  });

  const connection = {deviceName: "registered-lg", host: "192.0.2.1"};
  assert.deepEqual(await adapter.deviceInfo(connection), {model: "55QNED80SRA", firmware: "33.31.61"});
  assert.deepEqual(await adapter.listApps(connection), [{id: "com.mytvb2c.app", version: "3.5.0"}]);

  assert.deepEqual(calls.map(([command, args]) => [command, args]), [
    ["/toolchain/webos-sdk/CLI/bin/ares-device-info", ["--device", "registered-lg"]],
    ["/toolchain/webos-sdk/CLI/bin/ares-install", ["--device", "registered-lg", "--list"]],
  ]);
  assert.equal(calls.some(([, args]) => args.includes("--install") || args.includes("--launch")), false);
});

test("reads line-oriented webOS CLI identity and app-inventory output", async () => {
  const adapter = createWebOsReadOnlyAdapter({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(command) {
      if (command.endsWith("ares-device-info")) {
        return {status: 0, stdout: "modelName : 55QNED80SRA\nfirmwareVersion : 33.31.61\n"};
      }
      return {status: 0, stdout: "com.mytvb2c.app\n"};
    },
  });

  assert.deepEqual(
    await adapter.deviceInfo({deviceName: "registered-lg"}),
    {model: "55QNED80SRA", firmware: "33.31.61"},
  );
  assert.deepEqual(
    await adapter.listApps({deviceName: "registered-lg"}),
    [{id: "com.mytvb2c.app", version: ""}],
  );
});

test("falls back to the supported device-information command when the legacy command returns no identity", async () => {
  const calls = [];
  const adapter = createWebOsReadOnlyAdapter({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(command, args) {
      calls.push([command, args]);
      if (command.endsWith("ares-device-info")) {
        return {status: 0, stdout: "This command is deprecated. Use ares-device instead."};
      }
      return {status: 0, stdout: "modelName : 55QNED80SRA\nfirmwareVersion : 33.31.61\n"};
    },
  });

  assert.deepEqual(
    await adapter.deviceInfo({deviceName: "registered-lg"}),
    {model: "55QNED80SRA", firmware: "33.31.61"},
  );
  assert.deepEqual(calls, [
    ["/toolchain/webos-sdk/CLI/bin/ares-device-info", ["--device", "registered-lg"]],
    ["/toolchain/webos-sdk/CLI/bin/ares-device", ["--system-info", "--device", "registered-lg"]],
  ]);
});

test("reports a missing webOS CLI without exposing runtime connection data", async () => {
  const adapter = createWebOsReadOnlyAdapter({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync() { return {status: 1, error: {code: "ENOENT"}}; },
  });

  await assert.rejects(
    adapter.deviceInfo({deviceName: "registered-lg", host: "192.0.2.1"}),
    (error) => error.code === "TOOLCHAIN_UNAVAILABLE" && !/192\.0\.2\.1/.test(error.message),
  );
});

test("resolves the CLI-only SDK home before a future approved read-only command", async () => {
  const calls = [];
  const adapter = createConfiguredWebOsReadOnlyAdapter({
    toolchainConfig: {
      async resolveReadOnlyWebOsCli() {
        calls.push(["resolveReadOnlyWebOsCli"]);
        return "/toolchain/webos-sdk";
      },
    },
    spawnSync(command, args) {
      calls.push([command, args]);
      return {status: 0, stdout: "modelName : OLED\nfirmwareVersion : 1.0\n"};
    },
  });

  assert.deepEqual(await adapter.deviceInfo({deviceName: "registered-lg"}), {model: "OLED", firmware: "1.0"});
  assert.deepEqual(calls, [
    ["resolveReadOnlyWebOsCli"],
    ["/toolchain/webos-sdk/CLI/bin/ares-device-info", ["--device", "registered-lg"]],
  ]);
});
