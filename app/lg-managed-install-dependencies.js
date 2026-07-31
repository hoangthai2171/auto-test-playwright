"use strict";

const path = require("node:path");
const fsPromises = require("node:fs/promises");
const {createReadStream: defaultCreateReadStream} = require("node:fs");
const {createHash: defaultCreateHash} = require("node:crypto");
const {execFile} = require("node:child_process");
const {promisify} = require("node:util");
const {validateChromeDriverArtifact} = require("./lg-compatibility-catalog");

const runDefault = promisify(execFile);
const WINDOWS_NODE_EXTRACT_COMMAND = "& { param($archivePath, $destinationPath) $temporaryPath = Join-Path (Split-Path -Parent $destinationPath) '.node-extract'; Remove-Item -LiteralPath $temporaryPath -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive -LiteralPath $archivePath -DestinationPath $temporaryPath -Force; $children = @(Get-ChildItem -LiteralPath $temporaryPath -Force); if ($children.Count -ne 1) { exit 1 }; Move-Item -LiteralPath $children[0].FullName -Destination $destinationPath; Remove-Item -LiteralPath $temporaryPath -Recurse -Force -ErrorAction SilentlyContinue }";
const WINDOWS_CHROMEDRIVER_EXTRACT_COMMAND = "& { param($archivePath, $destinationPath) Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath -Force }";
const PINNED_NODE_VERSION = "24.18.0";
const PINNED_APPIUM_VERSION = "2.19.0";
const PINNED_LG_DRIVER_VERSION = "0.5.0";
const PINNED_CHROMEDRIVER_VERSION = "2.36.540469";

function rootDependencies(npmClosure) {
  const dependencies = npmClosure?.packages?.[""]?.dependencies;
  if (
    npmClosure?.lockfileVersion !== 3
    || !dependencies?.appium
    || !dependencies?.["appium-lg-webos-driver"]
  ) {
    throw new Error("The audited LG Appium closure is required.");
  }
  return dependencies;
}

function approvedNodeArtifact(platform, artifact) {
  const platformName = platform === "darwin" ? "darwin-arm64" : "win-x64";
  const extension = platform === "darwin" ? "tar.gz" : "zip";
  const expectedArchiveName = `node-v${artifact?.version}-${platformName}.${extension}`;
  try {
    const source = new URL(artifact?.url);
    return Boolean(
      artifact?.official
      && artifact.version
      && artifact.archiveName === expectedArchiveName
      && source.protocol === "https:"
      && source.hostname === "nodejs.org"
      && source.pathname === `/dist/v${artifact.version}/${expectedArchiveName}`,
    );
  } catch {
    return false;
  }
}

function approvedChromeDriverArtifact(platform, artifact) {
  try {
    validateChromeDriverArtifact(artifact);
    return Boolean(artifact?.official && ["darwin", "win32"].includes(platform));
  } catch {
    return false;
  }
}

function exactChromeDriverVersion(output, version) {
  const escaped = String(version || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^ChromeDriver ${escaped}(?:\\s|$)`, "u").test(output);
}

function commandStdout(result) {
  return String(result?.stdout || "").trim();
}

function installedLgDriverVersion(output) {
  try {
    const drivers = JSON.parse(output);
    return String(drivers?.webos?.version || "").trim();
  } catch {
    return "";
  }
}

function createLgManagedInstallDependencies({
  platform,
  fs = fsPromises,
  run = runDefault,
  fetch = globalThis.fetch,
  createReadStream = defaultCreateReadStream,
  createHash = defaultCreateHash,
} = {}) {
  if (!new Set(["darwin", "win32"]).has(platform)) throw new Error("LG toolchain setup supports only macOS and Windows.");
  if (!fs || typeof fs.writeFile !== "function" || typeof run !== "function" || typeof fetch !== "function" || typeof createReadStream !== "function" || typeof createHash !== "function") {
    throw new Error("LG managed-install dependencies are unavailable.");
  }

  return {
    async verify({nodeRoot, appiumRoot} = {}) {
      if (typeof nodeRoot !== "string" || !nodeRoot || typeof appiumRoot !== "string" || !appiumRoot) return false;
      const nodeBin = path.join(nodeRoot, platform === "win32" ? "" : "bin");
      const nodeExecutable = path.join(nodeBin, platform === "win32" ? "node.exe" : "node");
      const appiumExecutable = path.join(appiumRoot, "node_modules", ".bin", platform === "win32" ? "appium.cmd" : "appium");
      const options = {
        env: {...process.env, PATH: `${nodeBin}${path.delimiter}${process.env.PATH || ""}`, APPIUM_HOME: appiumRoot},
        shell: false,
        windowsHide: true,
      };
      let verification = "NODE_UNVERIFIED";
      try {
        if (commandStdout(await run(nodeExecutable, ["--version"], options)) !== `v${PINNED_NODE_VERSION}`) {
          return {ok: false, verification};
        }
        verification = "APPIUM_UNVERIFIED";
        if (commandStdout(await run(appiumExecutable, ["--version"], options)) !== PINNED_APPIUM_VERSION) {
          return {ok: false, verification};
        }
        verification = "LG_DRIVER_UNVERIFIED";
        if (installedLgDriverVersion(commandStdout(await run(
          appiumExecutable,
          ["driver", "list", "--installed", "--json"],
          options,
        ))) !== PINNED_LG_DRIVER_VERSION) return {ok: false, verification};
        return {ok: true};
      } catch {
        return {ok: false, verification};
      }
    },
    async hashFile(archivePath) {
      if (typeof archivePath !== "string" || !archivePath) throw new Error("A staged Node archive is required.");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(archivePath)) hash.update(chunk);
      return hash.digest("hex");
    },
    async download({artifact, destination} = {}) {
      if (typeof destination !== "string" || !destination || !approvedNodeArtifact(platform, artifact)) {
        throw new Error("An approved Node artifact is required.");
      }
      const response = await fetch(artifact.url, {redirect: "error"});
      if (!response?.ok || typeof response.arrayBuffer !== "function") {
        throw new Error("The approved Node artifact is unavailable.");
      }
      const archivePath = path.join(destination, artifact.archiveName);
      await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()), {flag: "wx", mode: 0o600});
      return archivePath;
    },
    async downloadChromeDriver({artifact, destination} = {}) {
      if (typeof destination !== "string" || !destination || !approvedChromeDriverArtifact(platform, artifact)) {
        throw new Error("An approved ChromeDriver artifact is required.");
      }
      const response = await fetch(artifact.url, {redirect: "error"});
      if (!response?.ok || typeof response.arrayBuffer !== "function") {
        throw new Error("The approved ChromeDriver artifact is unavailable.");
      }
      const archivePath = path.join(destination, artifact.archiveName);
      await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()), {flag: "wx", mode: 0o600});
      return archivePath;
    },
    async extractNode({archivePath, destination} = {}) {
      if (typeof archivePath !== "string" || !archivePath || typeof destination !== "string" || !destination) {
        throw new Error("A staged Node archive and destination are required.");
      }
      if (platform === "darwin") {
        await run("/usr/bin/tar", ["-xzf", archivePath, "-C", destination, "--strip-components", "1"], {shell: false, windowsHide: true});
        return;
      }
      await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        WINDOWS_NODE_EXTRACT_COMMAND,
        archivePath,
        destination,
      ], {shell: false, windowsHide: true});
    },
    async extractChromeDriver({archivePath, destination} = {}) {
      if (typeof archivePath !== "string" || !archivePath || typeof destination !== "string" || !destination) {
        throw new Error("A staged ChromeDriver archive and destination are required.");
      }
      if (platform === "darwin") {
        await run("/usr/bin/unzip", ["-q", archivePath, "-d", destination], {shell: false, windowsHide: true});
        return;
      }
      await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        WINDOWS_CHROMEDRIVER_EXTRACT_COMMAND,
        archivePath,
        destination,
      ], {shell: false, windowsHide: true});
    },
    async installNpmClosure({npmClosure, nodeRoot, destination} = {}) {
      if (typeof nodeRoot !== "string" || !nodeRoot || typeof destination !== "string" || !destination) {
        throw new Error("Managed Node and Appium paths are required.");
      }
      const dependencies = rootDependencies(npmClosure);
      await fs.writeFile(
        path.join(destination, "package.json"),
        `${JSON.stringify({name: "lg-toolchain-managed-appium", private: true, dependencies}, null, 2)}\n`,
        "utf8",
      );
      await fs.writeFile(path.join(destination, "package-lock.json"), `${JSON.stringify(npmClosure, null, 2)}\n`, "utf8");
      const nodeBin = path.join(nodeRoot, platform === "win32" ? "" : "bin");
      const npmBin = path.join(nodeBin, platform === "win32" ? "npm.cmd" : "npm");
      await run(npmBin, ["ci", "--ignore-scripts", "--omit=dev", "--prefix", destination], {
        cwd: destination,
        env: {
          ...process.env,
          PATH: `${nodeBin}${path.delimiter}${process.env.PATH || ""}`,
          npm_config_audit: "false",
          npm_config_fund: "false",
          npm_config_ignore_scripts: "true",
        },
        shell: false,
        windowsHide: true,
      });
    },
    async verifyChromeDriver({chromedriverRoot, version = PINNED_CHROMEDRIVER_VERSION} = {}) {
      if (typeof chromedriverRoot !== "string" || !chromedriverRoot) return false;
      const executable = path.join(chromedriverRoot, platform === "win32" ? "chromedriver.exe" : "chromedriver");
      try {
        return exactChromeDriverVersion(
          commandStdout(await run(executable, ["--version"], {shell: false, windowsHide: true})),
          version,
        );
      } catch {
        return false;
      }
    },
  };
}

module.exports = {createLgManagedInstallDependencies};
