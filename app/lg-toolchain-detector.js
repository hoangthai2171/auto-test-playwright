"use strict";

const path = require("node:path");

const COMPONENTS = [
  ["node", "Node.js and npm", "24.18.0"],
  ["webos-cli", "webOS CLI", "1.12.4"],
  ["appium", "Appium", "2.19.0"],
  ["appium-lg-webos-driver", "LG webOS driver", "0.5.0"],
  ["chromedriver", "ChromeDriver", "2.36.540469"],
];
const CHROMEDRIVER_METADATA_FILE = "metadata.json";

function managedChecks(platform, root) {
  const node = platform === "win32"
    ? [path.join(root, "node", "node.exe"), path.join(root, "node", "npm.cmd")]
    : [path.join(root, "node", "bin", "node"), path.join(root, "node", "bin", "npm")];
  return {
    node,
    "webos-cli": ["ares", "ares-setup-device", "ares-device-info", "ares-install"].map((command) => path.join(root, "webos-cli", "CLI", "bin", command)),
    appium: [path.join(root, "appium", "node_modules", ".bin", platform === "win32" ? "appium.cmd" : "appium")],
    "appium-lg-webos-driver": [path.join(root, "appium", "node_modules", "appium-lg-webos-driver", "package.json")],
    chromedriver: [path.join(root, "chromedriver", platform === "win32" ? "chromedriver.exe" : "chromedriver")],
  };
}

async function filesAvailable(fs, paths) {
  for (const targetPath of paths) {
    try {
      const entry = await fs.stat(targetPath);
      if (!entry?.isFile?.()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function createLgToolchainDetector({platform, managedRoot, fs} = {}) {
  if (!new Set(["darwin", "win32"]).has(platform)) throw new Error("LG toolchain setup supports only macOS and Windows.");
  if (typeof managedRoot !== "string" || !managedRoot || !fs || typeof fs.stat !== "function") throw new Error("A managed filesystem is required.");
  const checks = managedChecks(platform, managedRoot);
  return {
    async inspect({chromedriverVersion} = {}) {
      const components = [];
      for (const [id, label, version] of COMPONENTS) {
        const expectedVersion = id === "chromedriver" && typeof chromedriverVersion === "string" && chromedriverVersion.trim()
          ? chromedriverVersion.trim()
          : version;
        const available = await filesAvailable(fs, checks[id]);
        let status = available ? "ready" : "missing";
        if (id === "chromedriver" && available && chromedriverVersion) {
          try {
            const metadata = JSON.parse(await fs.readFile(path.join(managedRoot, "chromedriver", CHROMEDRIVER_METADATA_FILE), "utf8"));
            if (metadata?.version !== expectedVersion) status = "repair-needed";
          } catch {
            status = "repair-needed";
          }
        }
        components.push({id, label, status, version: expectedVersion});
      }
      return {source: "managed", state: components.every((component) => component.status === "ready") ? "ready" : "missing", components};
    },
  };
}

module.exports = {CHROMEDRIVER_METADATA_FILE, createLgToolchainDetector};
