"use strict";

const APPIUM_FAILURE_CODES = new Set([
  "APPIUM_CAPABILITY_APP_ID",
  "APPIUM_CAPABILITY_APP_LAUNCH_PARAMS",
  "APPIUM_CAPABILITY_AUTO_EXTEND_DEV_MODE",
  "APPIUM_CAPABILITY_AUTOMATION_NAME",
  "APPIUM_CAPABILITY_CHROMEDRIVER_EXECUTABLE",
  "APPIUM_CAPABILITY_DEVICE_HOST",
  "APPIUM_CAPABILITY_DEVICE_NAME",
  "APPIUM_CAPABILITY_FULL_RESET",
  "APPIUM_CAPABILITY_NO_RESET",
  "APPIUM_CAPABILITY_PLATFORM_NAME",
  "APPIUM_CAPABILITY_RC_MODE",
  "APPIUM_CAPABILITY_REMOTE_ONLY",
  "APPIUM_CAPABILITY_USE_SECURE_WEBSOCKET",
  "APPIUM_CAPABILITIES",
  "APPIUM_CHROMEDRIVER",
  "APPIUM_DEVICE_CONNECTION",
  "APPIUM_DRIVER",
  "APPIUM_SESSION",
]);

function classifyAppiumFailure(payload) {
  const value = payload?.value;
  const error = String(value?.error || payload?.error || "").toLowerCase();
  const message = String(value?.message || payload?.message || "").toLowerCase();
  const text = `${error} ${message}`;
  if (/chromedriver|chrome driver|session\s+not\s+created|could\s+not\s+start\s+(?:the\s+)?(?:chrome|driver)/.test(text)) return "APPIUM_CHROMEDRIVER";
  if (/capabilit|invalid argument/.test(text)) {
    const capabilityCodes = [
      ["appId", "APPIUM_CAPABILITY_APP_ID"],
      ["appLaunchParams", "APPIUM_CAPABILITY_APP_LAUNCH_PARAMS"],
      ["autoExtendDevMode", "APPIUM_CAPABILITY_AUTO_EXTEND_DEV_MODE"],
      ["automationName", "APPIUM_CAPABILITY_AUTOMATION_NAME"],
      ["chromedriverExecutable", "APPIUM_CAPABILITY_CHROMEDRIVER_EXECUTABLE"],
      ["deviceHost", "APPIUM_CAPABILITY_DEVICE_HOST"],
      ["deviceName", "APPIUM_CAPABILITY_DEVICE_NAME"],
      ["fullReset", "APPIUM_CAPABILITY_FULL_RESET"],
      ["noReset", "APPIUM_CAPABILITY_NO_RESET"],
      ["platformName", "APPIUM_CAPABILITY_PLATFORM_NAME"],
      ["rcMode", "APPIUM_CAPABILITY_RC_MODE"],
      ["remoteOnly", "APPIUM_CAPABILITY_REMOTE_ONLY"],
      ["useSecureWebsocket", "APPIUM_CAPABILITY_USE_SECURE_WEBSOCKET"],
    ];
    for (const [name, code] of capabilityCodes) {
      const capability = `(?:appium:)?${name}`;
      const rejectedBefore = new RegExp(`(?:invalid|unsupported|unknown|not\\s+(?:valid|supported|recognized)|must\\s+be|expected|required)[^\\n]{0,96}${capability}`, "i");
      const rejectedAfter = new RegExp(`${capability}[^\\n]{0,96}(?:invalid|unsupported|unknown|not\\s+(?:valid|supported|recognized)|must\\s+be|expected|required)`, "i");
      if (rejectedBefore.test(message) || rejectedAfter.test(message)) return code;
    }
  }
  if (/driver(?:\s+not|.*not found|.*missing)|no such driver/.test(text)) return "APPIUM_DRIVER";
  if (/capabilit|invalid argument/.test(text)) return "APPIUM_CAPABILITIES";
  if (/device|websocket|socket|connection|connect|remote/.test(text)) return "APPIUM_DEVICE_CONNECTION";
  if (error || message) return "APPIUM_SESSION";
  return "";
}

function clientError(appiumFailureCode = "") {
  const error = new Error("The loopback Appium client is unavailable.");
  error.code = "APPIUM_CLIENT_UNAVAILABLE";
  if (APPIUM_FAILURE_CODES.has(appiumFailureCode)) error.appiumFailureCode = appiumFailureCode;
  return error;
}

function normalizeLoopbackBaseUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("A loopback Appium base URL is required.");
  }
  if (
    url.protocol !== "http:"
    || url.hostname !== "127.0.0.1"
    || !url.port
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new Error("A loopback Appium base URL is required.");
  }
  return url.origin;
}

function createLoopbackAppiumClient({baseUrl, fetchImpl = fetch} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A loopback Appium fetch implementation is required.");
  const origin = normalizeLoopbackBaseUrl(baseUrl);
  let sessionId = "";

  function sessionPath(suffix) {
    if (!sessionId) throw clientError();
    return `/session/${sessionId}${suffix}`;
  }

  async function request(pathname, method = "GET", body) {
    try {
      const response = await fetchImpl(`${origin}${pathname}`, {
        method,
        headers: body ? {"content-type": "application/json"} : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response?.json?.();
      if (!response?.ok) throw clientError(classifyAppiumFailure(payload));
      return payload?.value;
    } catch (error) {
      if (error?.code === "APPIUM_CLIENT_UNAVAILABLE") throw error;
      throw clientError();
    }
  }

  return Object.freeze({
    async createSession(capabilities) {
      const session = await request("/session", "POST", capabilities);
      const nextSessionId = typeof session?.sessionId === "string"
        ? session.sessionId
        : typeof session?.capabilities?.sessionId === "string"
          ? session.capabilities.sessionId
          : "";
      if (!nextSessionId) throw clientError();
      sessionId = nextSessionId;
    },
    execute(script, args = []) {
      return request(sessionPath("/execute/sync"), "POST", {script, args});
    },
    screenshot() {
      return request(sessionPath("/screenshot"));
    },
    deleteSession() {
      return request(sessionPath(""), "DELETE");
    },
  });
}

module.exports = {createLoopbackAppiumClient};
