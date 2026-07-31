function invalidStore(message) {
  return new Error(`Device secret store is invalid: ${message}`);
}

function requireKey(key) {
  if (typeof key !== "string" || !key) throw invalidStore("a non-empty secret key is required.");
}

function decodeEnvelope(raw) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    throw invalidStore(`could not parse the encrypted envelope: ${error.message}`);
  }
  if (!envelope || envelope.version !== 1 || !envelope.secrets || typeof envelope.secrets !== "object" || Array.isArray(envelope.secrets)) {
    throw invalidStore("expected a version 1 encrypted envelope.");
  }
  for (const [key, value] of Object.entries(envelope.secrets)) {
    requireKey(key);
    if (typeof value !== "string" || Buffer.from(value, "base64").toString("base64") !== value) {
      throw invalidStore("encrypted entries must use canonical base64.");
    }
  }
  return envelope;
}

function createDeviceSecretFileStore({filePath, fs}) {
  if (typeof filePath !== "string" || !filePath) throw invalidStore("a file path is required.");
  if (!fs || typeof fs.readFile !== "function" || typeof fs.writeFile !== "function" || typeof fs.rename !== "function") {
    throw invalidStore("an atomic filesystem is required.");
  }

  async function readEnvelope() {
    try {
      return decodeEnvelope(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {version: 1, secrets: {}};
      throw error;
    }
  }

  async function writeEnvelope(envelope) {
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(envelope)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  return {
    async get(key) {
      requireKey(key);
      const value = (await readEnvelope()).secrets[key];
      return value === undefined ? undefined : Buffer.from(value, "base64");
    },
    async set(key, value) {
      requireKey(key);
      if (!Buffer.isBuffer(value)) throw invalidStore("encrypted values must be Buffers.");
      const envelope = await readEnvelope();
      envelope.secrets[key] = value.toString("base64");
      await writeEnvelope(envelope);
    },
    async delete(key) {
      requireKey(key);
      const envelope = await readEnvelope();
      if (!Object.hasOwn(envelope.secrets, key)) return false;
      delete envelope.secrets[key];
      await writeEnvelope(envelope);
      return true;
    },
  };
}

module.exports = {createDeviceSecretFileStore};
