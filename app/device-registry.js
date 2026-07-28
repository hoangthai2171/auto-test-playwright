const ALLOWED_FIELDS = new Set(["id", "label", "platform", "appId", "model", "modelYear"]);
const REQUIRED_FIELDS = ["id", "label", "platform", "appId", "model"];
const LG_APP_ID = "com.mytvb2c.app";
const SECRET_FIELD_PATTERN = /password|secret|token|authorization|credential|host/i;

function invalidProfile(message) {
  return new Error(`Device profile is ineligible: ${message}`);
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw invalidProfile("a profile object is required.");
  }

  for (const field of Object.keys(profile)) {
    if (SECRET_FIELD_PATTERN.test(field)) {
      throw invalidProfile(`secret field '${field}' is not allowed in device profiles.`);
    }
    if (!ALLOWED_FIELDS.has(field)) {
      throw invalidProfile(`unknown field '${field}' is not allowed.`);
    }
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof profile[field] !== "string" || !profile[field].trim()) {
      throw invalidProfile(`required field '${field}' must be a non-empty string.`);
    }
  }
  if (profile.platform !== "lg") {
    throw invalidProfile("only the LG platform is supported.");
  }
  if (profile.appId !== LG_APP_ID) {
    throw invalidProfile(`appId '${profile.appId}' is unsupported; use '${LG_APP_ID}'.`);
  }
  if (profile.modelYear !== undefined && (typeof profile.modelYear !== "string" || !profile.modelYear.trim())) {
    throw invalidProfile("optional field 'modelYear' must be a non-empty string when supplied.");
  }

  const normalized = {
    id: profile.id,
    label: profile.label,
    platform: profile.platform,
    appId: profile.appId,
    model: profile.model,
  };
  if (profile.modelYear !== undefined) normalized.modelYear = profile.modelYear;
  return normalized;
}

function createDeviceRegistry({filePath, fs}) {
  if (typeof filePath !== "string" || !filePath) throw new Error("A device registry filePath is required.");
  if (!fs || typeof fs.readFile !== "function" || typeof fs.writeFile !== "function" || typeof fs.rename !== "function") {
    throw new Error("A filesystem with readFile, writeFile, and rename is required.");
  }

  async function readProfiles() {
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw new Error(`Could not read device registry ${filePath}: ${error.message}`, {cause: error});
    }
    let profiles;
    try {
      profiles = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Could not parse device registry ${filePath}: ${error.message}`, {cause: error});
    }
    if (!Array.isArray(profiles)) throw new Error(`Could not parse device registry ${filePath}: expected an array.`);
    return profiles.map(normalizeProfile);
  }

  async function writeProfiles(profiles) {
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  return {
    async list() {
      return readProfiles();
    },
    async save(profile) {
      const savedProfile = normalizeProfile(profile);
      const profiles = await readProfiles();
      const index = profiles.findIndex((candidate) => candidate.id === savedProfile.id);
      if (index === -1) profiles.push(savedProfile);
      else profiles[index] = savedProfile;
      await writeProfiles(profiles);
      return savedProfile;
    },
    async remove(deviceId) {
      if (typeof deviceId !== "string" || !deviceId) throw new Error("A device id is required to remove a profile.");
      const profiles = await readProfiles();
      const nextProfiles = profiles.filter((profile) => profile.id !== deviceId);
      if (nextProfiles.length === profiles.length) return false;
      await writeProfiles(nextProfiles);
      return true;
    },
  };
}

module.exports = {createDeviceRegistry};
