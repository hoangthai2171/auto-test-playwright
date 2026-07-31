"use strict";

const path = require("node:path");
const {spawnSync: defaultSpawnSync} = require("node:child_process");

function classifiedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function readDeviceName(connection) {
  const deviceName = String(connection?.deviceName || "").trim();
  if (!deviceName) throw classifiedError("DEVICE_NAME_REQUIRED", "A registered webOS device name is required.");
  return deviceName;
}

function readDeviceInfo(output) {
  const text = String(output || "").trim();
  try {
    const parsed = JSON.parse(text);
    return {
      model: String(parsed?.modelName ?? parsed?.model ?? ""),
      firmware: String(parsed?.firmwareVersion ?? parsed?.firmware ?? ""),
    };
  } catch {
    const readValue = (key) => text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "mu"))?.[1]?.trim() || "";
    return {model: readValue("modelName"), firmware: readValue("firmwareVersion")};
  }
}

function readInstalledApps(output) {
  const match = String(output || "").match(/^\s*(com\.mytvb2c\.app)(?:\s+([^\s]+))?\s*$/mu);
  return match ? [{id: match[1], version: match[2] || ""}] : [];
}

function createWebOsReadOnlyAdapter({webosSdkHome, spawnSync = defaultSpawnSync} = {}) {
  if (typeof webosSdkHome !== "string" || !webosSdkHome.trim()) {
    throw new Error("A webOS SDK home is required.");
  }
  if (typeof spawnSync !== "function") throw new Error("A synchronous process launcher is required.");

  const cliPath = (command) => path.join(webosSdkHome, "CLI", "bin", command);
  const run = (command, args) => {
    let result;
    try {
      result = spawnSync(cliPath(command), args, {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true});
    } catch {
      throw classifiedError("DISCOVERY_FAILED", "The webOS read-only discovery command failed.");
    }
    if (result?.error?.code === "ENOENT") {
      throw classifiedError("TOOLCHAIN_UNAVAILABLE", "The webOS CLI is unavailable.");
    }
    if (result?.error || result?.status !== 0) {
      throw classifiedError("DISCOVERY_FAILED", "The webOS read-only discovery command failed.");
    }
    return String(result.stdout || "");
  };

  return {
    async deviceInfo(connection) {
      const deviceName = readDeviceName(connection);
      const legacyInfo = readDeviceInfo(run("ares-device-info", ["--device", deviceName]));
      if (legacyInfo.model && legacyInfo.firmware) return legacyInfo;
      return readDeviceInfo(run("ares-device", ["--system-info", "--device", deviceName]));
    },
    async listApps(connection) {
      return readInstalledApps(run("ares-install", ["--device", readDeviceName(connection), "--list"]));
    },
  };
}

function createConfiguredWebOsReadOnlyAdapter({toolchainConfig, spawnSync = defaultSpawnSync} = {}) {
  if (!toolchainConfig || typeof toolchainConfig.resolveReadOnlyWebOsCli !== "function") {
    throw new Error("A local read-only webOS CLI configuration is required.");
  }
  if (typeof spawnSync !== "function") throw new Error("A synchronous process launcher is required.");

  async function adapter() {
    const webosSdkHome = await toolchainConfig.resolveReadOnlyWebOsCli();
    return createWebOsReadOnlyAdapter({webosSdkHome, spawnSync});
  }

  return {
    async deviceInfo(connection) {
      return (await adapter()).deviceInfo(connection);
    },
    async listApps(connection) {
      return (await adapter()).listApps(connection);
    },
  };
}

module.exports = {createWebOsReadOnlyAdapter, createConfiguredWebOsReadOnlyAdapter};
