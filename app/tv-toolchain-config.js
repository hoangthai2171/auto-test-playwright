"use strict";

const path = require("node:path");

const REQUIRED_SDK_TOOLS = ["ares", "ares-setup-device", "ares-device-info", "ares-install"];

function classifiedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function missingComponents() {
  return [
    {id: "webos-sdk", label: "webOS SDK", status: "missing"},
    {id: "appium-home", label: "Appium home", status: "missing"},
    {id: "chromedriver", label: "ChromeDriver", status: "missing"},
  ];
}

function readyStatus(source) {
  return {
    configured: true,
    source,
    platform: "webos",
    components: missingComponents().map((component) => ({...component, status: "ready"})),
  };
}

function unconfiguredStatus() {
  return {configured: false, platform: "webos", components: missingComponents()};
}

function normalizeConfiguration(input) {
  const configuration = {
    webosSdkHome: typeof input?.webosSdkHome === "string" ? input.webosSdkHome.trim() : "",
    appiumHome: typeof input?.appiumHome === "string" ? input.appiumHome.trim() : "",
    appiumBin: typeof input?.appiumBin === "string" ? input.appiumBin.trim() : "",
    chromedriverPath: typeof input?.chromedriverPath === "string" ? input.chromedriverPath.trim() : "",
  };
  if (Object.values(configuration).some((value) => !value)) {
    throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain configuration is incomplete.");
  }
  return configuration;
}

async function requireType(fs, targetPath, expectedType) {
  let entry;
  try {
    entry = await fs.stat(targetPath);
  } catch {
    throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain files are unavailable.");
  }
  if (!entry || (expectedType === "directory" ? !entry.isDirectory?.() : !entry.isFile?.())) {
    throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain files are unavailable.");
  }
}

function createTvToolchainConfig({filePath, fs, platform = process.platform, managedRoot} = {}) {
  if (typeof filePath !== "string" || !filePath) throw new Error("A local toolchain configuration path is required.");
  if (!fs || ["readFile", "writeFile", "rename", "stat"].some((method) => typeof fs[method] !== "function")) {
    throw new Error("A filesystem with atomic configuration methods is required.");
  }

  async function validate(configuration) {
    await requireType(fs, configuration.webosSdkHome, "directory");
    await requireType(fs, configuration.appiumHome, "directory");
    await requireType(fs, configuration.appiumBin, "file");
    await requireType(fs, configuration.chromedriverPath, "file");
    for (const tool of REQUIRED_SDK_TOOLS) {
      await requireType(fs, path.join(configuration.webosSdkHome, "CLI", "bin", tool), "file");
    }
    return configuration;
  }

  async function validateCompatibilityRuntime(configuration) {
    await requireType(fs, configuration.webosSdkHome, "directory");
    await requireType(fs, configuration.appiumHome, "directory");
    await requireType(fs, configuration.appiumBin, "file");
    for (const tool of REQUIRED_SDK_TOOLS) {
      await requireType(fs, path.join(configuration.webosSdkHome, "CLI", "bin", tool), "file");
    }
    return {
      webosSdkHome: configuration.webosSdkHome,
      appiumHome: configuration.appiumHome,
      appiumBin: configuration.appiumBin,
    };
  }

  async function validateReadOnlyWebOsCli(webosSdkHome) {
    await requireType(fs, webosSdkHome, "directory");
    for (const tool of REQUIRED_SDK_TOOLS) {
      await requireType(fs, path.join(webosSdkHome, "CLI", "bin", tool), "file");
    }
    return webosSdkHome;
  }

  function managedConfiguration() {
    if (typeof managedRoot !== "string" || !managedRoot) {
      throw classifiedError("TOOLCHAIN_NOT_CONFIGURED", "The managed LG toolchain is unavailable.");
    }
    return {
      webosSdkHome: path.join(managedRoot, "webos-cli"),
      appiumHome: path.join(managedRoot, "appium"),
      appiumBin: path.join(managedRoot, "appium", "node_modules", ".bin", platform === "win32" ? "appium.cmd" : "appium"),
      chromedriverPath: path.join(managedRoot, "chromedriver", platform === "win32" ? "chromedriver.exe" : "chromedriver"),
    };
  }

  async function writeStoredConfiguration(stored) {
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  async function readStoredConfiguration() {
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw classifiedError("TOOLCHAIN_NOT_CONFIGURED", "Local LG toolchain configuration has not been saved.");
      }
      throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain configuration is unavailable.");
    }
    let stored;
    try {
      stored = JSON.parse(raw);
    } catch {
      throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain configuration is invalid.");
    }
    if (stored?.version === 1) {
      return {source: "advanced", configuration: normalizeConfiguration(stored)};
    }
    if (stored?.version === 2 && stored.source === "advanced") {
      return {source: "advanced", configuration: normalizeConfiguration(stored.advanced)};
    }
    if (stored?.version === 2 && stored.source === "managed") {
      return {source: "managed", configuration: managedConfiguration()};
    }
    if (!stored) {
      throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain configuration is invalid.");
    }
    throw classifiedError("TOOLCHAIN_INVALID", "Local LG toolchain configuration is invalid.");
  }

  return {
    async save(input) {
      const configuration = await validate(normalizeConfiguration(input));
      await writeStoredConfiguration({version: 2, source: "advanced", advanced: configuration});
      return readyStatus("advanced");
    },
    async activateManaged() {
      await validate(managedConfiguration());
      await writeStoredConfiguration({version: 2, source: "managed"});
      return readyStatus("managed");
    },
    async resolve() {
      const stored = await readStoredConfiguration();
      return validate(stored.configuration);
    },
    async resolveCompatibilityRuntime() {
      try {
        const stored = await readStoredConfiguration();
        return validateCompatibilityRuntime(stored.configuration);
      } catch (error) {
        if (error?.code !== "TOOLCHAIN_NOT_CONFIGURED" || typeof managedRoot !== "string" || !managedRoot) throw error;
        return validateCompatibilityRuntime(managedConfiguration());
      }
    },
    async resolveReadOnlyWebOsCli() {
      try {
        const stored = await readStoredConfiguration();
        return validateReadOnlyWebOsCli(stored.configuration.webosSdkHome);
      } catch (error) {
        if (error?.code !== "TOOLCHAIN_NOT_CONFIGURED" || typeof managedRoot !== "string" || !managedRoot) throw error;
        return validateReadOnlyWebOsCli(path.join(managedRoot, "webos-cli"));
      }
    },
    async status() {
      try {
        const stored = await readStoredConfiguration();
        await validate(stored.configuration);
        return readyStatus(stored.source);
      } catch {
        return unconfiguredStatus();
      }
    },
  };
}

module.exports = {createTvToolchainConfig};
