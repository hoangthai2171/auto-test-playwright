"use strict";

const path = require("node:path");
const fs = require("node:fs");
const {spawnSync: defaultSpawnSync} = require("node:child_process");

function commandOutput(spawnSync, command, args, appiumHome) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {...process.env, APPIUM_HOME: appiumHome},
  });
  return result?.error || result?.status !== 0 ? "" : String(result.stdout || "").trim();
}

function installedDriverVersion(output) {
  try {
    const drivers = JSON.parse(output);
    const driver = drivers?.["appium-lg-webos-driver"] || drivers?.drivers?.["appium-lg-webos-driver"];
    return String(driver?.version || "").trim();
  } catch {
    return "";
  }
}

function createTvToolchainInspector({toolchainConfig, existsSync = fs.existsSync, spawnSync = defaultSpawnSync} = {}) {
  if (!toolchainConfig || typeof toolchainConfig.resolve !== "function" || typeof toolchainConfig.status !== "function") {
    throw new Error("A local toolchain configuration is required.");
  }
  if (typeof existsSync !== "function") throw new Error("A file availability check is required.");
  if (typeof spawnSync !== "function") throw new Error("A synchronous process launcher is required.");

  return {
    async inspect() {
      const status = await toolchainConfig.status();
      if (!status?.configured) {
        return {
          ok: false,
          platform: "webos",
          configured: false,
          components: Array.isArray(status?.components) ? status.components : [],
          tools: [
            {id: "webos-cli", label: "webOS CLI", status: "missing"},
            {id: "appium", label: "Appium", status: "missing"},
            {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing"},
          ],
        };
      }
      let configuration;
      try {
        configuration = await toolchainConfig.resolve();
      } catch {
        return {
          ok: false,
          platform: "webos",
          configured: false,
          components: Array.isArray(status.components) ? status.components : [],
          tools: [
            {id: "webos-cli", label: "webOS CLI", status: "missing"},
            {id: "appium", label: "Appium", status: "missing"},
            {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing"},
          ],
        };
      }
      const cliDirectory = path.join(configuration.webosSdkHome, "CLI", "bin");
      const webosCliReady = ["ares", "ares-setup-device", "ares-device-info", "ares-install"]
        .every((command) => existsSync(path.join(cliDirectory, command)));
      const resolvedAppiumBin = configuration.appiumBin;
      const appiumVersion = commandOutput(spawnSync, resolvedAppiumBin, ["--version"], configuration.appiumHome);
      const driverVersion = installedDriverVersion(commandOutput(
        spawnSync,
        resolvedAppiumBin,
        ["driver", "list", "--installed", "--json"],
        configuration.appiumHome
      ));
      const tools = [
        {id: "webos-cli", label: "webOS CLI", status: webosCliReady ? "ready" : "missing"},
        appiumVersion
          ? {id: "appium", label: "Appium", status: "ready", version: appiumVersion}
          : {id: "appium", label: "Appium", status: "missing"},
        driverVersion
          ? {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "ready", version: driverVersion}
          : {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing"},
      ];
      return {
        ok: tools.every((tool) => tool.status === "ready"),
        platform: "webos",
        configured: true,
        source: status.source === "managed" ? "managed" : "advanced",
        components: Array.isArray(status.components) ? status.components : [],
        tools,
      };
    },
  };
}

module.exports = {createTvToolchainInspector};
