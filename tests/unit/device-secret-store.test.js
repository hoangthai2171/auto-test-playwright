const test = require("node:test");
const assert = require("node:assert/strict");

const {createDeviceSecretStore} = require("../../app/device-secret-store");

function createMemoryStore() {
  const values = new Map();
  return {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
    values,
  };
}

function createSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
  };
}

test("stores encrypted opaque secret payloads under a device-scoped key", () => {
  const store = createMemoryStore();
  const secrets = createDeviceSecretStore({safeStorage: createSafeStorage(), store});

  secrets.setSecret("living-room", "pairing-key", "opaque-payload");

  assert.deepEqual(store.values.get("living-room:pairing-key"), Buffer.from("encrypted:opaque-payload"));
  assert.equal(secrets.hasSecret("living-room", "pairing-key"), true);
  assert.equal(secrets.hasSecret("living-room", "missing"), false);
});

test("removes a stored secret and returns only booleans for availability", () => {
  const store = createMemoryStore();
  const secrets = createDeviceSecretStore({safeStorage: createSafeStorage(), store});

  secrets.setSecret("living-room", "token", "secret");
  assert.equal(secrets.removeSecret("living-room", "token"), true);
  assert.equal(secrets.hasSecret("living-room", "token"), false);
  assert.equal(secrets.removeSecret("living-room", "token"), false);
});

test("throws when secure storage is unavailable or encryption fails", () => {
  const store = createMemoryStore();
  const unavailable = createDeviceSecretStore({
    safeStorage: {isEncryptionAvailable: () => false, encryptString: () => Buffer.from("never")},
    store,
  });
  const broken = createDeviceSecretStore({
    safeStorage: {isEncryptionAvailable: () => true, encryptString: () => { throw new Error("keychain unavailable"); }},
    store,
  });

  assert.throws(() => unavailable.setSecret("living-room", "token", "secret"), /encryption.*unavailable/i);
  assert.throws(() => broken.setSecret("living-room", "token", "secret"), /could not encrypt.*keychain unavailable/i);
  assert.equal(store.values.size, 0);
});
