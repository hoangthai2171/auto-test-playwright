function secretKey(deviceId, secretName) {
  if (typeof deviceId !== "string" || !deviceId) throw new Error("A device id is required for secrets.");
  if (typeof secretName !== "string" || !secretName) throw new Error("A secret name is required.");
  return `${deviceId}:${secretName}`;
}

function createDeviceSecretStore({safeStorage, store}) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== "function" || typeof safeStorage.encryptString !== "function" || typeof safeStorage.decryptString !== "function") {
    throw new Error("Electron safe storage with encryption is required.");
  }
  if (!store || typeof store.get !== "function" || typeof store.set !== "function" || typeof store.delete !== "function") {
    throw new Error("A secret store with get, set, and delete is required.");
  }

  return {
    async hasSecret(deviceId, secretName) {
      return Boolean(await store.get(secretKey(deviceId, secretName)));
    },
    async getSecret(deviceId, secretName) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Secret encryption is unavailable.");
      const encryptedPayload = await store.get(secretKey(deviceId, secretName));
      if (!encryptedPayload) return undefined;
      if (!Buffer.isBuffer(encryptedPayload)) throw new Error("Could not decrypt device secret: encrypted storage is invalid.");
      try {
        return safeStorage.decryptString(encryptedPayload);
      } catch (error) {
        throw new Error(`Could not decrypt device secret: ${error.message}`, {cause: error});
      }
    },
    async setSecret(deviceId, secretName, payload) {
      if (typeof payload !== "string") throw new Error("Secret payload must be an opaque string.");
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Secret encryption is unavailable.");
      let encryptedPayload;
      try {
        encryptedPayload = safeStorage.encryptString(payload);
      } catch (error) {
        throw new Error(`Could not encrypt device secret: ${error.message}`, {cause: error});
      }
      if (!encryptedPayload) throw new Error("Could not encrypt device secret: safe storage returned no encrypted payload.");
      await store.set(secretKey(deviceId, secretName), encryptedPayload);
    },
    async removeSecret(deviceId, secretName) {
      const key = secretKey(deviceId, secretName);
      return Boolean(await store.delete(key));
    },
  };
}

module.exports = {createDeviceSecretStore};
