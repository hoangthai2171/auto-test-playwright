"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createWebOsTargetRegistration} = require("../../app/webos-target-registration");

test("adds an unused target with fixed local-only connection arguments", async () => {
  const calls = [];
  const registration = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(command, args, options) {
      calls.push([command, args, options]);
      return args[0] === "--listfull"
        ? {status: 0, stdout: "name : another-target\n"}
        : {status: 0, stdout: ""};
    },
  });

  const result = await registration.register({targetName: "office-lg", host: "192.0.2.1"});

  assert.deepEqual(result, {ok: true, status: "TARGET_REGISTERED", targetName: "office-lg"});
  assert.deepEqual(calls.map(([command, args]) => [command, args]), [
    ["/toolchain/webos-sdk/CLI/bin/ares-setup-device", ["--listfull"]],
    ["/toolchain/webos-sdk/CLI/bin/ares-setup-device", ["--add", "office-lg", "--info", "host=192.0.2.1,port=9922,username=prisoner"]],
  ]);
  assert.equal(calls.every(([, , options]) => options.shell === undefined), true);
});

test("rejects an existing target without an add, modify, remove, or default command", async () => {
  const calls = [];
  const registration = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(_command, args) {
      calls.push(args);
      return {status: 0, stdout: "name : office-lg\n"};
    },
  });

  assert.deepEqual(await registration.register({targetName: "office-lg", host: "192.0.2.1"}), {
    ok: false,
    status: "TARGET_NAME_CONFLICT",
  });
  assert.deepEqual(calls, [["--listfull"]]);
});

test("rejects invalid registration input before it invokes the vendor CLI", async () => {
  const calls = [];
  const registration = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(_command, args) {
      calls.push(args);
      return {status: 0, stdout: "name : another-target\n"};
    },
  });

  assert.deepEqual(await registration.register({targetName: "not safe", host: "192.0.2.1"}), {
    ok: false,
    status: "INVALID_TARGET_NAME",
  });
  assert.deepEqual(await registration.register({targetName: "office-lg", host: "https://192.0.2.1"}), {
    ok: false,
    status: "INVALID_HOST",
  });
  assert.deepEqual(calls, []);
});

test("returns a stable toolchain status when target listing cannot start", async () => {
  const registration = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync() {
      return {status: 1, error: {code: "ENOENT"}, stderr: "host=192.0.2.1"};
    },
  });

  const result = await registration.register({targetName: "office-lg", host: "192.0.2.1"});

  assert.deepEqual(result, {ok: false, status: "TOOLCHAIN_UNAVAILABLE"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|host/);
});

test("does not add when vendor target output is unparseable or the add fails", async () => {
  const unreadableCalls = [];
  const unreadable = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(_command, args) {
      unreadableCalls.push(args);
      return {status: 0, stdout: "unexpected target response"};
    },
  });
  assert.deepEqual(await unreadable.register({targetName: "office-lg", host: "192.0.2.1"}), {
    ok: false,
    status: "TARGET_LIST_UNREADABLE",
  });
  assert.deepEqual(unreadableCalls, [["--listfull"]]);

  const failedAdd = createWebOsTargetRegistration({
    webosSdkHome: "/toolchain/webos-sdk",
    spawnSync(_command, args) {
      return args[0] === "--listfull"
        ? {status: 0, stdout: "name : another-target\n"}
        : {status: 1, stderr: "host=192.0.2.1 pairingKey=secret"};
    },
  });
  const result = await failedAdd.register({targetName: "office-lg", host: "192.0.2.1"});
  assert.deepEqual(result, {ok: false, status: "TARGET_REGISTRATION_FAILED"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|secret|pairing/i);
});
