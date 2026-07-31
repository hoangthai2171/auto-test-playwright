const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceProfileService} = require("../../app/device-profile-service");

function createRegistry(initialProfiles = []) {
  const profiles = initialProfiles.map((profile) => ({...profile}));
  return {
    async list() {
      return profiles.map((profile) => ({...profile}));
    },
    async save(profile) {
      const index = profiles.findIndex((candidate) => candidate.id === profile.id);
      if (index === -1) profiles.push({...profile});
      else profiles[index] = {...profile};
      return {...profile};
    },
  };
}

function createSecrets() {
  const values = new Map();
  return {
    values,
    async hasSecret(deviceId, name) {
      return values.has(`${deviceId}:${name}`);
    },
    async getSecret(deviceId, name) {
      return values.get(`${deviceId}:${name}`);
    },
    async setSecret(deviceId, name, value) {
      values.set(`${deviceId}:${name}`, value);
    },
    async removeSecret(deviceId, name) {
      return values.delete(`${deviceId}:${name}`);
    },
  };
}

test("does not persist a candidate when its injected validator is unavailable", async () => {
  const registry = createRegistry();
  const secrets = createSecrets();
  const calls = [];
  const service = createDeviceProfileService({
    registry,
    secrets,
    createId: () => "lg-device-a",
    validator: {
      async validate(candidate) {
        calls.push(candidate);
        return {ok: false, status: "VALIDATION_UNAVAILABLE"};
      },
    },
  });

  const result = await service.validateAndSave({
    label: "Living room",
    host: "candidate-host",
    passphrase: "candidate-passphrase",
  });

  assert.deepEqual(result, {ok: false, status: "VALIDATION_UNAVAILABLE"});
  assert.deepEqual(await registry.list(), []);
  assert.equal(secrets.values.size, 0);
  assert.deepEqual(calls, [{
    id: "lg-device-a",
    label: "Living room",
    host: "candidate-host",
    passphrase: "candidate-passphrase",
    port: 9922,
    username: "prisoner",
  }]);
});

test("saves only verified metadata and returns a redacted public profile", async () => {
  const registry = createRegistry();
  const secrets = createSecrets();
  const service = createDeviceProfileService({
    registry,
    secrets,
    createId: () => "lg-device-a",
    validator: {
      async validate() {
        return {ok: true, facts: {model: "OLED55C4", firmwareVersion: "verified"}};
      },
    },
  });

  const result = await service.validateAndSave({
    label: "Living room",
    host: "candidate-host",
    passphrase: "candidate-passphrase",
  });

  assert.deepEqual(result, {
    ok: true,
    device: {
      id: "lg-device-a",
      label: "Living room",
      platform: "webos",
      appId: "com.mytvb2c.app",
      backendEnvironment: "production",
      model: "OLED55C4",
      firmwareVersion: "verified",
      hasConnection: true,
      hasPassphrase: true,
    },
  });
  assert.deepEqual(await registry.list(), [{
    id: "lg-device-a",
    label: "Living room",
    platform: "webos",
    appId: "com.mytvb2c.app",
    backendEnvironment: "production",
    model: "OLED55C4",
    firmwareVersion: "verified",
  }]);
  assert.doesNotMatch(JSON.stringify(result), /candidate-host|candidate-passphrase/);
});
