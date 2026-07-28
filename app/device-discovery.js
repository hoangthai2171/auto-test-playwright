"use strict";

const LG_PLATFORM = "lg";
const LG_APP_ID = "com.mytvb2c.app";

function classifiedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireReadOnlyAdapter(webos) {
  if (!webos || typeof webos.deviceInfo !== "function" || typeof webos.listApps !== "function") {
    throw new Error("A webOS adapter with read-only deviceInfo and listApps methods is required.");
  }
}

function redactText(redact, value) {
  try {
    return String(redact(String(value ?? "")));
  } catch {
    return "[REDACTED]";
  }
}

function readIdentity(info, redact) {
  return {
    model: redactText(redact, info?.model ?? ""),
    firmware: redactText(redact, info?.firmware ?? ""),
  };
}

function readInstalledApp(apps, redact) {
  if (!Array.isArray(apps)) return null;
  const app = apps.find((candidate) => candidate && candidate.id === LG_APP_ID);
  if (!app) return null;
  return {
    id: LG_APP_ID,
    version: redactText(redact, app.version ?? ""),
  };
}

function createDeviceDiscovery({webos, redact}) {
  requireReadOnlyAdapter(webos);
  if (typeof redact !== "function") throw new Error("A diagnostic redactor is required.");

  return {
    async validate(profile, {host} = {}) {
      if (!profile || typeof profile !== "object" || profile.platform !== LG_PLATFORM) {
        throw classifiedError("PLATFORM_UNSUPPORTED", "Only LG device profiles are supported.");
      }
      if (profile.appId !== LG_APP_ID) {
        throw classifiedError("APP_ID_UNSUPPORTED", `Only the installed LG app ${LG_APP_ID} is supported.`);
      }
      if (typeof host !== "string" || !host.trim()) {
        throw classifiedError("HOST_REQUIRED", "A runtime LG host is required for validation.");
      }

      const runtimeHost = host.trim();
      let info;
      let apps;
      try {
        [info, apps] = await Promise.all([webos.deviceInfo(runtimeHost), webos.listApps(runtimeHost)]);
      } catch (error) {
        return {
          status: "DISCOVERY_FAILED",
          identity: null,
          installedApp: null,
          diagnostics: {
            host: redactText(redact, runtimeHost),
            code: "DISCOVERY_FAILED",
            message: redactText(redact, error?.message ?? "Unknown webOS discovery failure."),
          },
        };
      }

      const identity = readIdentity(info, redact);
      const installedApp = readInstalledApp(apps, redact);
      if (!installedApp) {
        return {
          status: "APP_NOT_INSTALLED",
          identity,
          installedApp: null,
          diagnostics: {
            host: redactText(redact, runtimeHost),
            code: "APP_NOT_INSTALLED",
            message: "The required MyTV application is not installed.",
          },
        };
      }

      return {
        status: "ready",
        identity,
        installedApp,
        diagnostics: {
          host: redactText(redact, runtimeHost),
          code: "READY",
          transport: "read_only",
        },
      };
    },
  };
}

module.exports = {createDeviceDiscovery, LG_APP_ID};
