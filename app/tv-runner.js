"use strict";

const path = require("node:path");

const LG_PLATFORM = "lg";
const LG_APP_ID = "com.mytvb2c.app";
const SAFE_ERROR_CODES = new Set([
  "PLATFORM_UNSUPPORTED",
  "PROFILE_NOT_FOUND",
  "SHARED_DEVICE_ACKNOWLEDGEMENT_REQUIRED",
  "RUNTIME_CONNECTION_INVALID",
  "RUNTIME_APPIUM_INVALID",
  "HOST_REQUIRED",
  "APP_NOT_INSTALLED",
  "DISCOVERY_FAILED",
  "APP_ID_UNSUPPORTED",
  "DOM_INSPECTION_UNAVAILABLE",
  "VISUAL_CAPTURE_UNAVAILABLE",
  "SESSION_UNAVAILABLE",
  "SESSION_CLOSED",
  "TV_RUN_FAILED",
  "TV_CLEANUP_FAILED",
]);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredDependency(value, name, method) {
  if (!value || typeof value[method] !== "function") {
    throw new Error(`An injected ${name} with ${method}() is required.`);
  }
}

function redactedText(redact, value) {
  try {
    return String(redact(String(value ?? "")));
  } catch {
    return "[REDACTED]";
  }
}

function redactValue(redact, value) {
  if (typeof value === "string") return redactedText(redact, value);
  if (Array.isArray(value)) return value.map((item) => redactValue(redact, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(redact, item)]));
  }
  return value;
}

function freezeValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) freezeValue(item);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) freezeValue(item);
  }
  return Object.freeze(value);
}

function safeErrorCode(code, fallback) {
  return SAFE_ERROR_CODES.has(code) ? code : fallback;
}

function safeFailure(redact, error, fallbackCode, cleanupEvents) {
  const failure = createError(
    safeErrorCode(error?.code, fallbackCode),
    redactedText(redact, error?.message || "The LG TV run failed."),
  );
  if (cleanupEvents.length) failure.cleanupEvents = freezeValue(redactValue(redact, cleanupEvents));
  return failure;
}

function requireRuntimeHost(host) {
  if (typeof host !== "string" || !host.trim()) {
    throw createError("HOST_REQUIRED", "A runtime LG host is required.");
  }
  return host.trim();
}

function buildRuntimeConnection(connection, runtimeHost, secureWebsocket) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    throw createError("RUNTIME_CONNECTION_INVALID", "A complete ephemeral LG runtime connection is required.");
  }
  if (typeof connection.deviceName !== "string" || !connection.deviceName.trim()
    || typeof connection.deviceHost !== "string" || !connection.deviceHost.trim()
    || typeof connection.chromedriverPath !== "string" || !connection.chromedriverPath.trim()
    || connection.remoteOnly !== false || connection.rcMode !== "rc") {
    throw createError("RUNTIME_CONNECTION_INVALID", "The ephemeral LG runtime connection is incomplete.");
  }
  if (connection.deviceHost.trim() !== runtimeHost || !path.isAbsolute(connection.chromedriverPath.trim())) {
    throw createError("RUNTIME_CONNECTION_INVALID", "The ephemeral LG runtime connection does not match this run.");
  }
  if (typeof secureWebsocket !== "boolean") {
    throw createError("RUNTIME_CONNECTION_INVALID", "secureWebsocket must be an explicit boolean run option.");
  }
  return Object.freeze({
    deviceName: connection.deviceName.trim(),
    deviceHost: runtimeHost,
    chromedriverPath: connection.chromedriverPath.trim(),
    remoteOnly: connection.remoteOnly,
    rcMode: "rc",
    useSecureWebsocket: secureWebsocket,
  });
}

function buildRuntimeAppium(appium) {
  if (!appium || typeof appium !== "object" || Array.isArray(appium)) {
    throw createError("RUNTIME_APPIUM_INVALID", "A complete ephemeral Appium runtime configuration is required.");
  }
  if (!Number.isInteger(appium.port) || appium.port < 1 || appium.port > 65535
    || typeof appium.appiumHome !== "string" || !appium.appiumHome.trim()
    || (appium.appiumBin !== undefined && (typeof appium.appiumBin !== "string" || !appium.appiumBin.trim()))) {
    throw createError("RUNTIME_APPIUM_INVALID", "The ephemeral Appium runtime configuration is invalid.");
  }
  const runtimeAppium = {
    port: appium.port,
    appiumHome: appium.appiumHome.trim(),
  };
  if (appium.appiumBin !== undefined) runtimeAppium.appiumBin = appium.appiumBin.trim();
  return Object.freeze(runtimeAppium);
}

function requireSessionMethod(session, method, code, message) {
  if (!session || typeof session[method] !== "function") throw createError(code, message);
}

function nonEmptyScreenshot(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return Buffer.isBuffer(value) || ArrayBuffer.isView(value) ? value.byteLength > 0 : false;
}

function createTvRunner({registry, discovery, lock, serverManager, sessionFactory, redact, caseExecutor} = {}) {
  requiredDependency(registry, "device registry", "list");
  requiredDependency(discovery, "device discovery", "validate");
  requiredDependency(lock, "device lock", "acquire");
  requiredDependency(serverManager, "Appium server manager", "start");
  requiredDependency(sessionFactory, "TV session factory", "create");
  if (typeof redact !== "function") throw new Error("An injected redaction function is required.");

  return {
    async run({profileId, host, sharedDeviceAcknowledged, secureWebsocket, allowSelfSignedTls, connection, appium, testCase, caseHelpers, testInfo} = {}) {
      const profiles = await registry.list();
      const profile = Array.isArray(profiles) ? profiles.find((candidate) => candidate?.id === profileId) : null;
      if (!profile) throw createError("PROFILE_NOT_FOUND", "The requested TV profile was not found.");
      if (profile.platform !== LG_PLATFORM || profile.appId !== LG_APP_ID) {
        throw createError("PLATFORM_UNSUPPORTED", "Only the approved LG MyTV profile is supported.");
      }
      if (sharedDeviceAcknowledged !== true) {
        throw createError("SHARED_DEVICE_ACKNOWLEDGEMENT_REQUIRED", "Shared-device acknowledgement is required before an LG TV run.");
      }

      const runtimeHost = requireRuntimeHost(host);
      const runtimeConnection = buildRuntimeConnection(connection, runtimeHost, secureWebsocket);
      const runtimeAppium = buildRuntimeAppium(appium);
      if (typeof allowSelfSignedTls !== "boolean") {
        throw createError("RUNTIME_CONNECTION_INVALID", "allowSelfSignedTls must be an explicit boolean run option.");
      }

      let discoveryResult;
      try {
        discoveryResult = await discovery.validate(profile, {host: runtimeHost});
      } catch (error) {
        throw safeFailure(redact, error, "DISCOVERY_FAILED", []);
      }
      if (discoveryResult?.status !== "ready") {
        throw createError(
          safeErrorCode(discoveryResult?.status, "DISCOVERY_FAILED"),
          "Read-only LG discovery did not verify an installed MyTV application.",
        );
      }

      const events = ["profile_loaded", "discovery_ready"];
      const cleanupEvents = [];
      let primaryError;
      let lease;
      let server;
      let session;
      let caseResult;

      try {
        lease = await lock.acquire(profile.id);
        if (!lease || typeof lease.release !== "function") throw createError("TV_RUN_FAILED", "The device lock did not return a releasable lease.");
        events.push("lock_acquired");

        server = await serverManager.start({...runtimeAppium, secureWebsocket, allowSelfSignedTls});
        if (!server || typeof server.stop !== "function") throw createError("TV_RUN_FAILED", "The loopback Appium manager did not return a stoppable server.");
        events.push("server_started");

        session = await sessionFactory.create({
          profile,
          server: {baseUrl: server.baseUrl},
          connection: runtimeConnection,
        });
        requireSessionMethod(session, "start", "SESSION_UNAVAILABLE", "The injected LG session cannot start.");
        requireSessionMethod(session, "getDomState", "DOM_INSPECTION_UNAVAILABLE", "The injected LG session cannot inspect the DOM.");
        requireSessionMethod(session, "screenshot", "VISUAL_CAPTURE_UNAVAILABLE", "The injected LG session cannot capture a genuine Appium screenshot.");
        requireSessionMethod(session, "cleanup", "SESSION_UNAVAILABLE", "The injected LG session cannot clean up.");
        requireSessionMethod(session, "close", "SESSION_UNAVAILABLE", "The injected LG session cannot close.");

        await session.start();
        events.push("session_started");
        await session.getDomState();
        events.push("dom_inspected");
        const screenshot = await session.screenshot();
        if (!nonEmptyScreenshot(screenshot)) {
          throw createError("VISUAL_CAPTURE_UNAVAILABLE", "The injected LG session did not return a genuine Appium screenshot.");
        }
        events.push("genuine_appium_screenshot_verified");
        if (testCase !== undefined) {
          if (typeof caseExecutor !== "function") {
            throw createError("TV_CASE_EXECUTOR_UNAVAILABLE", "The trusted TV case executor is unavailable.");
          }
          caseResult = await caseExecutor({
            tvSession: session,
            testCase,
            helpers: caseHelpers || {},
            testInfo,
            capabilities: Object.freeze({
              domInspection: true,
              visualCapture: true,
              targetSemanticActions: true,
              playerInspection: true,
            }),
          });
          events.push("case_completed");
        }
      } catch (error) {
        primaryError = error;
      } finally {
        if (session) {
          try {
            await session.cleanup();
            events.push("session_cleaned_up");
          } catch {
            cleanupEvents.push({type: "cleanup_failure", resource: "session"});
          }
        }
        if (session) {
          try {
            await session.close();
            events.push("session_closed");
          } catch {
            cleanupEvents.push({type: "cleanup_failure", resource: "session"});
          }
        }
        if (server) {
          try {
            await server.stop();
            events.push("server_stopped");
          } catch {
            cleanupEvents.push({type: "cleanup_failure", resource: "appium_server"});
          }
        }
        if (lease) {
          try {
            await lease.release();
            events.push("lock_released");
          } catch {
            cleanupEvents.push({type: "cleanup_failure", resource: "device_lock"});
          }
        }
      }

      if (primaryError) throw safeFailure(redact, primaryError, "TV_RUN_FAILED", cleanupEvents);
      if (cleanupEvents.length) {
        const cleanupError = createError("TV_CLEANUP_FAILED", "LG TV run cleanup did not complete.");
        cleanupError.cleanupEvents = freezeValue(redactValue(redact, cleanupEvents));
        throw cleanupError;
      }

      return freezeValue(redactValue(redact, {
        status: "passed",
        events,
        artifactMetadata: {domInspected: true, genuineAppiumScreenshot: true},
        ...(caseResult ? {caseResult} : {}),
      }));
    },
  };
}

module.exports = {createTvRunner};
