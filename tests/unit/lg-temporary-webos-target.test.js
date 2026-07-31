"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {createLgTemporaryWebOsTarget} = require("../../app/lg-temporary-webos-target");

function createHarness({listed = [], addStatus = 0, removeStatus = 0} = {}) {
  const calls = [];
  const target = createLgTemporaryWebOsTarget({
    webosSdkHome: "/private/sdk",
    createTargetName: () => "lgcompat-a1",
    spawnSync(command, args) {
      calls.push([command, args]);
      if (args[0] === "--listfull") return {status: 0, stdout: JSON.stringify(listed)};
      if (args[0] === "--add") return {status: addStatus, stdout: ""};
      if (args[0] === "--remove") return {status: removeStatus, stdout: ""};
      throw new Error("Unexpected command.");
    },
  });
  return {target, calls};
}

test("adds one unique temporary LG target with the Developer Mode passphrase as its CLI password", async () => {
  const {target, calls} = createHarness({listed: [{name: "emulator"}]});

  const lease = await target.acquire({host: "192.0.2.10", passphrase: "runtime-only"});
  assert.equal(lease.ok, true);
  assert.equal(lease.targetName, "lgcompat-a1");
  await lease.release();
  await lease.release();

  assert.deepEqual(calls.map(([, args]) => args[0]), ["--listfull", "--add", "--remove"]);
  assert.deepEqual(calls[1][1], [
    "--add", "lgcompat-a1",
    "--info", "host=192.0.2.10",
    "--info", "port=9922",
    "--info", "username=prisoner",
    "--info", "password=runtime-only",
  ]);
  assert.deepEqual(calls[2][1], ["--remove", "lgcompat-a1"]);
});

test("reuses only the default CLI target's local key reference with the entered passphrase", async () => {
  const {target, calls} = createHarness({listed: [
    {name: "other-device", default: false, details: {privatekey: "other-key"}},
    {name: "default-device", default: true, details: {privatekey: "default-key"}},
  ]});

  const lease = await target.acquire({host: "192.0.2.10", passphrase: "runtime-only"});
  assert.equal(lease.ok, true);
  await lease.release();

  assert.deepEqual(calls[1][1], [
    "--add", "lgcompat-a1",
    "--info", "host=192.0.2.10",
    "--info", "port=9922",
    "--info", "username=prisoner",
    "--info", "privatekey=default-key",
    "--info", "passphrase=runtime-only",
  ]);
});

test("never adds a temporary target for invalid input or an existing target name", async () => {
  const invalid = createHarness();
  assert.deepEqual(await invalid.target.acquire({host: "not a host", passphrase: "runtime-only"}), {
    ok: false,
    status: "INVALID_CONNECTION",
  });
  assert.deepEqual(invalid.calls, []);

  const conflicting = createHarness({listed: [{name: "lgcompat-a1"}]});
  assert.deepEqual(await conflicting.target.acquire({host: "192.0.2.10", passphrase: "runtime-only"}), {
    ok: false,
    status: "TARGET_NAME_CONFLICT",
  });
  assert.deepEqual(conflicting.calls.map(([, args]) => args[0]), ["--listfull"]);
});

test("does not remove a target when creation fails", async () => {
  const {target, calls} = createHarness({addStatus: 1});

  assert.deepEqual(await target.acquire({host: "192.0.2.10", passphrase: "runtime-only"}), {
    ok: false,
    status: "TARGET_REGISTRATION_FAILED",
  });
  assert.deepEqual(calls.map(([, args]) => args[0]), ["--listfull", "--add"]);
});
