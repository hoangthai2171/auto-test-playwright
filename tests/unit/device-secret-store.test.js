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
    decryptString: (value) => value.toString("utf8").replace(/^encrypted:/, ""),
  };
}

test("stores encrypted opaque secret payloads under a device-scoped key", async () => {
  const store = createMemoryStore();
  const secrets = createDeviceSecretStore({safeStorage: createSafeStorage(), store});

  await secrets.setSecret("living-room", "pairing-key", "opaque-payload");

  assert.deepEqual(store.values.get("living-room:pairing-key"), Buffer.from("encrypted:opaque-payload"));
  assert.equal(await secrets.hasSecret("living-room", "pairing-key"), true);
  assert.equal(await secrets.hasSecret("living-room", "missing"), false);
});

test("decrypts an existing secret only for a main-process caller", async () => {
  const store = createMemoryStore();
  const secrets = createDeviceSecretStore({safeStorage: createSafeStorage(), store});

  await secrets.setSecret("living-room", "passphrase", "current-input");

  assert.equal(await secrets.getSecret("living-room", "passphrase"), "current-input");
});

test("removes a stored secret and returns only booleans for availability", async () => {
  const store = createMemoryStore();
  const secrets = createDeviceSecretStore({safeStorage: createSafeStorage(), store});

  await secrets.setSecret("living-room", "token", "secret");
  assert.equal(await secrets.removeSecret("living-room", "token"), true);
  assert.equal(await secrets.hasSecret("living-room", "token"), false);
  assert.equal(await secrets.removeSecret("living-room", "token"), false);
});

test("rejects reads and writes when secure storage is unavailable or fails", async () => {
  const store = createMemoryStore();
  const unavailable = createDeviceSecretStore({
    safeStorage: {isEncryptionAvailable: () => false, encryptString: () => Buffer.from("never"), decryptString: () => "never"},
    store,
  });
  const broken = createDeviceSecretStore({
    safeStorage: {isEncryptionAvailable: () => true, encryptString: () => { throw new Error("keychain unavailable"); }, decryptString: () => { throw new Error("keychain unavailable"); }},
    store,
  });

  await assert.rejects(() => unavailable.setSecret("living-room", "token", "secret"), /encryption.*unavailable/i);
  await assert.rejects(() => unavailable.getSecret("living-room", "token"), /encryption.*unavailable/i);
  await assert.rejects(() => broken.setSecret("living-room", "token", "secret"), /could not encrypt.*keychain unavailable/i);
  assert.equal(store.values.size, 0);
});
