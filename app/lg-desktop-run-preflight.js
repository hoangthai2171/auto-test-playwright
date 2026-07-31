"use strict";

const LG_PLATFORM = "webos";
const LG_APP_ID = "com.mytvb2c.app";

function classifiedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freezeValue(value) {
  if (Array.isArray(value)) value.forEach(freezeValue);
  else if (value && typeof value === "object") Object.values(value).forEach(freezeValue);
  return Object.freeze(value);
}

function safeError(code) {
  const messages = {
    DEVICE_NOT_FOUND: "The selected LG device is unavailable.",
    REGISTERED_TARGET_REQUIRED: "The selected LG device needs a registered target.",
    SAVED_CONNECTION_REQUIRED: "The selected LG device needs its saved connection.",
    TOOLCHAIN_UNAVAILABLE: "The selected LG toolchain is unavailable.",
    COMPATIBILITY_PROFILE_UNVERIFIED: "The selected LG device needs a verified compatibility profile.",
    DEVICE_MISMATCH: "The selected LG device does not match its saved profile.",
    APP_NOT_INSTALLED: "The required MyTV application is not installed on the selected LG device.",
    CONNECTION_UNAVAILABLE: "The selected LG device is unavailable.",
  };
  return classifiedError(code, messages[code] || "The selected LG device is unavailable.");
}

function requireDependency(value, name, methods) {
  if (!value || methods.some((method) => typeof value[method] !== "function")) {
    throw new Error(`An injected ${name} is required.`);
  }
}

function matchingProfile(profiles, deviceId) {
  const profile = Array.isArray(profiles)
    ? profiles.find((candidate) => candidate?.id === deviceId && candidate?.platform === LG_PLATFORM && candidate?.appId === LG_APP_ID)
    : undefined;
  if (!profile) throw safeError("DEVICE_NOT_FOUND");
  return profile;
}

function compatibilityFacts(profile) {
  return {
    model: text(profile.model),
    firmware: text(profile.firmwareVersion),
  };
}

async function selectedChromeDriver(catalog, facts, platform) {
  const selection = await catalog.select({...facts, platform});
  return selection?.status === "verified" && selection.artifact?.version ? selection.artifact : null;
}

async function managedChromeDriverIsReady(detector, version) {
  const inspection = await detector.inspect({chromedriverVersion: version});
  const component = Array.isArray(inspection?.components)
    ? inspection.components.find((entry) => entry?.id === "chromedriver")
    : undefined;
  return component?.status === "ready" && component.version === version;
}

function publicAvailability(error) {
  const statuses = new Set([
    "DEVICE_NOT_FOUND",
    "REGISTERED_TARGET_REQUIRED",
    "TOOLCHAIN_UNAVAILABLE",
    "COMPATIBILITY_PROFILE_UNVERIFIED",
  ]);
  return {ok: false, status: statuses.has(error?.code) ? error.code : "TOOLCHAIN_UNAVAILABLE"};
}

function createLgDesktopRunPreflight({registry, secrets, toolchainConfig, adapter, compatibilityCatalog, detector, platform = process.platform, redact} = {}) {
  requireDependency(registry, "LG device registry with list()", ["list"]);
  requireDependency(secrets, "LG device secret store with getSecret()", ["getSecret"]);
  requireDependency(toolchainConfig, "LG toolchain configuration with resolve()", ["resolve"]);
  requireDependency(adapter, "read-only LG adapter", ["deviceInfo", "listApps"]);
  requireDependency(compatibilityCatalog, "LG compatibility catalog", ["select"]);
  requireDependency(detector, "LG toolchain detector", ["inspect"]);
  if (typeof redact !== "function") throw new Error("An injected LG diagnostic redactor is required.");

  async function resolveLocal(deviceId) {
    const id = text(deviceId);
    if (!id) throw safeError("DEVICE_NOT_FOUND");
    const profile = matchingProfile(await registry.list(), id);
    const deviceName = text(profile.vendorDeviceName);
    if (!deviceName) throw safeError("REGISTERED_TARGET_REQUIRED");

    let toolchain;
    try {
      toolchain = await toolchainConfig.resolve();
    } catch {
      throw safeError("TOOLCHAIN_UNAVAILABLE");
    }
    if (!toolchain || !text(toolchain.appiumHome) || !text(toolchain.appiumBin) || !text(toolchain.chromedriverPath)) {
      throw safeError("TOOLCHAIN_UNAVAILABLE");
    }
    const chromedriverArtifact = await selectedChromeDriver(compatibilityCatalog, compatibilityFacts(profile), platform);
    if (!chromedriverArtifact) {
      throw safeError("COMPATIBILITY_PROFILE_UNVERIFIED");
    }
    if (!await managedChromeDriverIsReady(detector, chromedriverArtifact.version)) {
      throw safeError("TOOLCHAIN_UNAVAILABLE");
    }
    return {id, profile, deviceName, toolchain};
  }

  return Object.freeze({
    async availability({deviceId} = {}) {
      try {
        await resolveLocal(deviceId);
        return {ok: true, status: "READY"};
      } catch (error) {
        return publicAvailability(error);
      }
    },

    async prepare({deviceId} = {}) {
      const {id, profile, deviceName, toolchain} = await resolveLocal(deviceId);
      const host = text(await secrets.getSecret(id, "host"));
      const passphrase = String(await secrets.getSecret(id, "passphrase") || "");
      if (!host || !passphrase) throw safeError("SAVED_CONNECTION_REQUIRED");

      let info;
      let apps;
      try {
        [info, apps] = await Promise.all([
          adapter.deviceInfo({deviceName}),
          adapter.listApps({deviceName}),
        ]);
      } catch (error) {
        if (error?.code === "TOOLCHAIN_UNAVAILABLE") throw safeError("TOOLCHAIN_UNAVAILABLE");
        throw safeError("CONNECTION_UNAVAILABLE");
      }

      if (text(info?.model) !== text(profile.model)) throw safeError("DEVICE_MISMATCH");
      if (!Array.isArray(apps) || !apps.some((app) => app?.id === LG_APP_ID)) throw safeError("APP_NOT_INSTALLED");
      if (text(info?.firmware) !== text(profile.firmwareVersion)) {
        throw safeError("COMPATIBILITY_PROFILE_UNVERIFIED");
      }

      const redactionSecrets = [...new Set([
        host,
        passphrase,
        text(toolchain.webosSdkHome),
        text(toolchain.appiumHome),
        text(toolchain.appiumBin),
        text(toolchain.chromedriverPath),
      ].filter(Boolean))];
      return freezeValue({
        runtime: {
          profile: {...profile},
          host,
          connection: {
            deviceName,
            deviceHost: host,
            chromedriverPath: text(toolchain.chromedriverPath),
            remoteOnly: false,
            rcMode: "rc",
          },
          appium: {
            port: 4727,
            appiumHome: text(toolchain.appiumHome),
            appiumBin: text(toolchain.appiumBin),
          },
          transport: {
            secureWebsocket: true,
            allowSelfSignedTls: true,
          },
        },
        redactionSecrets,
      });
    },
  });
}

module.exports = {createLgDesktopRunPreflight};
