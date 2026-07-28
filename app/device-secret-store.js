function secretKey(deviceId, secretName) {
  if (typeof deviceId !== "string" || !deviceId) throw new Error("A device id is required for secrets.");
  if (typeof secretName !== "string" || !secretName) throw new Error("A secret name is required.");
  return `${deviceId}:${secretName}`;
}

function createDeviceSecretStore({safeStorage, store}) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== "function" || typeof safeStorage.encryptString !== "function") {
    throw new Error("Electron safe storage with encryption is required.");
  }
  if (!store || typeof store.get !== "function" || typeof store.set !== "function" || typeof store.delete !== "function") {
    throw new Error("A secret store with get, set, and delete is required.");
  }

  return {
    hasSecret(deviceId, secretName) {
      return Boolean(store.get(secretKey(deviceId, secretName)));
    },
    setSecret(deviceId, secretName, payload) {
      if (typeof payload !== "string") throw new Error("Secret payload must be an opaque string.");
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Secret encryption is unavailable.");
      let encryptedPayload;
      try {
        encryptedPayload = safeStorage.encryptString(payload);
      } catch (error) {
        throw new Error(`Could not encrypt device secret: ${error.message}`, {cause: error});
      }
      if (!encryptedPayload) throw new Error("Could not encrypt device secret: safe storage returned no encrypted payload.");
      store.set(secretKey(deviceId, secretName), encryptedPayload);
    },
    removeSecret(deviceId, secretName) {
      const key = secretKey(deviceId, secretName);
      const exists = Boolean(store.get(key));
      if (exists) store.delete(key);
      return exists;
    },
  };
}

module.exports = {createDeviceSecretStore};
