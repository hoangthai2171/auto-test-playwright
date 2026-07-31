"use strict";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createLgDeviceConnectionChecker({registry, adapter} = {}) {
  if (!registry || typeof registry.list !== "function") {
    throw new Error("An LG device registry is required.");
  }
  if (!adapter || typeof adapter.deviceInfo !== "function" || typeof adapter.listApps !== "function") {
    throw new Error("A read-only LG device adapter is required.");
  }

  return {
    async check({deviceId} = {}) {
      const id = text(deviceId);
      if (!id) return {ok: false, status: "DEVICE_NOT_FOUND"};

      const profiles = await registry.list();
      const profile = Array.isArray(profiles)
        ? profiles.find((candidate) => candidate?.id === id && candidate?.platform === "webos")
        : undefined;
      if (!profile) return {ok: false, status: "DEVICE_NOT_FOUND"};

      const deviceName = text(profile.vendorDeviceName);
      if (!deviceName) return {ok: false, status: "REGISTERED_TARGET_REQUIRED"};

      try {
        const info = await adapter.deviceInfo({deviceName});
        const apps = await adapter.listApps({deviceName});
        if (text(info?.model) !== text(profile.model)) {
          return {ok: false, status: "DEVICE_MISMATCH"};
        }
        if (!Array.isArray(apps) || !apps.some((app) => app?.id === profile.appId)) {
          return {ok: false, status: "APP_NOT_INSTALLED"};
        }
        return {ok: true, status: "CONNECTED"};
      } catch {
        return {ok: false, status: "CONNECTION_UNAVAILABLE"};
      }
    },
  };
}

module.exports = {createLgDeviceConnectionChecker};
