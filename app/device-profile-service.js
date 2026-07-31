const {randomUUID} = require("node:crypto");

const LG_APP_ID = "com.mytvb2c.app";
const VERIFIED_FACT_FIELDS = ["model", "modelYear", "vendorDeviceName", "firmwareVersion", "osVersion"];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function publicProfile(profile, availability = {}) {
  const {lastKnownHost, ...device} = profile;
  return {
    ...device,
    hasConnection: Boolean(availability.hasConnection || lastKnownHost),
    hasPassphrase: Boolean(availability.hasPassphrase),
  };
}

function verifiedFacts(facts) {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return null;
  const normalized = {};
  for (const field of VERIFIED_FACT_FIELDS) {
    if (facts[field] === undefined) continue;
    const value = text(facts[field]);
    if (!value) return null;
    normalized[field] = value;
  }
  return normalized.model ? normalized : null;
}

function createDeviceProfileService({registry, secrets, validator, createId = () => `lg-${randomUUID()}`} = {}) {
  if (!registry || typeof registry.list !== "function" || typeof registry.save !== "function") throw new Error("A device registry with list and save is required.");
  if (!secrets || typeof secrets.hasSecret !== "function" || typeof secrets.getSecret !== "function" || typeof secrets.setSecret !== "function") {
    throw new Error("A device secret store is required.");
  }
  if (!validator || typeof validator.validate !== "function") throw new Error("A device candidate validator is required.");
  if (typeof createId !== "function") throw new Error("A device identifier factory is required.");

  async function storedAvailability(profile) {
    return {
      hasConnection: Boolean(profile.lastKnownHost) || await secrets.hasSecret(profile.id, "host"),
      hasPassphrase: await secrets.hasSecret(profile.id, "passphrase"),
    };
  }

  async function restoreSecret(deviceId, name, value) {
    if (value === undefined) {
      if (typeof secrets.removeSecret === "function") await secrets.removeSecret(deviceId, name);
      return;
    }
    await secrets.setSecret(deviceId, name, value);
  }

  return {
    async listPublicProfiles() {
      const profiles = await registry.list();
      return Promise.all(profiles.map(async (profile) => publicProfile(profile, await storedAvailability(profile))));
    },

    async validateAndSave(input = {}) {
      const requestedId = text(input.deviceId);
      const label = text(input.label);
      if (!label) return {ok: false, status: "CANDIDATE_INVALID"};

      const profiles = await registry.list();
      const existing = requestedId ? profiles.find((profile) => profile.id === requestedId) : undefined;
      if (requestedId && !existing) return {ok: false, status: "PROFILE_NOT_FOUND"};

      const id = requestedId || text(createId());
      if (!id) return {ok: false, status: "CANDIDATE_INVALID"};
      const suppliedHost = text(input.host);
      const suppliedPassphrase = typeof input.passphrase === "string" ? input.passphrase : "";
      const previousHost = existing ? await secrets.getSecret(id, "host") : undefined;
      const previousPassphrase = existing ? await secrets.getSecret(id, "passphrase") : undefined;
      const host = suppliedHost || previousHost || text(existing?.lastKnownHost);
      const passphrase = suppliedPassphrase || previousPassphrase || "";
      if (!host || !passphrase) return {ok: false, status: "CANDIDATE_INVALID"};

      let validation;
      try {
        validation = await validator.validate({id, label, host, passphrase, port: 9922, username: "prisoner"});
      } catch {
        return {ok: false, status: "VALIDATION_FAILED"};
      }
      if (!validation?.ok) return {ok: false, status: String(validation?.status || "VALIDATION_FAILED")};
      const facts = verifiedFacts(validation.facts);
      if (!facts) return {ok: false, status: "VALIDATION_FAILED"};

      const profile = {
        id,
        label,
        platform: "webos",
        appId: LG_APP_ID,
        backendEnvironment: "production",
        ...facts,
      };
      try {
        await secrets.setSecret(id, "host", host);
        await secrets.setSecret(id, "passphrase", passphrase);
        const saved = await registry.save(profile);
        return {ok: true, device: publicProfile(saved, {hasConnection: true, hasPassphrase: true})};
      } catch {
        try {
          await restoreSecret(id, "host", previousHost);
          await restoreSecret(id, "passphrase", previousPassphrase);
        } catch {
          // Preserve the original safe failure result; encrypted storage details stay private.
        }
        return {ok: false, status: "PROFILE_SAVE_FAILED"};
      }
    },
  };
}

module.exports = {createDeviceProfileService};
