"use strict";

const {createHash: defaultCreateHash} = require("node:crypto");
const {createReadStream: defaultCreateReadStream} = require("node:fs");
const {execFile} = require("node:child_process");
const {promisify} = require("node:util");

const runDefault = promisify(execFile);
const SUPPORTED_PLATFORMS = new Set(["darwin", "win32"]);
const WINDOWS_EXTRACT_COMMAND = "& { param($archivePath, $destinationPath) Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath -Force }";

function requirePath(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`An LG CLI ${label} is required.`);
  return value;
}

function createLgCliImportOperations({platform, createReadStream = defaultCreateReadStream, createHash = defaultCreateHash, run = runDefault} = {}) {
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new Error("LG toolchain setup supports only macOS and Windows.");
  if (typeof createReadStream !== "function" || typeof createHash !== "function" || typeof run !== "function") {
    throw new Error("LG CLI import operations are unavailable.");
  }

  return {
    async hashFile(archivePath) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(requirePath(archivePath, "archive path"))) hash.update(chunk);
      return hash.digest("hex");
    },
    async extract({archivePath, destination} = {}) {
      const source = requirePath(archivePath, "archive path");
      const target = requirePath(destination, "staging directory");
      if (platform === "darwin") {
        await run("/usr/bin/tar", ["-xzf", source, "-C", target], {windowsHide: true, shell: false});
        return;
      }
      await run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        WINDOWS_EXTRACT_COMMAND,
        source,
        target,
      ], {windowsHide: true, shell: false});
    },
  };
}

module.exports = {createLgCliImportOperations};
