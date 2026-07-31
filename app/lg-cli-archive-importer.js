"use strict";

const path = require("node:path");

const {trustedLgCliArchive} = require("./lg-toolchain-manifest");

const REQUIRED_CLI_COMMANDS = ["ares", "ares-setup-device", "ares-device-info", "ares-install"];

function hasExpectedArchiveName(archivePath, archive) {
  return typeof archivePath === "string" && path.basename(archivePath) === archive.archiveName;
}

async function exists(fs, targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function verifyCliLayout(fs, root) {
  for (const command of REQUIRED_CLI_COMMANDS) {
    const entry = await fs.stat(path.join(root, "CLI", "bin", command));
    if (!entry?.isFile?.()) return false;
  }
  return true;
}

function createLgCliArchiveImporter({platform, managedRoot, fs, hashFile, extract, trustedArchive = trustedLgCliArchive} = {}) {
  if (typeof managedRoot !== "string" || !managedRoot) throw new Error("An LG CLI managed root is required.");
  if (!fs || ["stat", "mkdir", "rm", "rename"].some((method) => typeof fs[method] !== "function")) {
    throw new Error("A filesystem with staged-install methods is required.");
  }
  if (typeof hashFile !== "function" || typeof extract !== "function" || typeof trustedArchive !== "function") {
    throw new Error("LG CLI import dependencies are required.");
  }

  async function importArchive({archivePath, confirmed} = {}) {
    if (confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
    const archive = trustedArchive(platform);
    if (!hasExpectedArchiveName(archivePath, archive)) return {ok: false, status: "LG_CLI_ARCHIVE_INVALID"};

    let observedHash;
    try {
      observedHash = await hashFile(archivePath);
    } catch {
      return {ok: false, status: "LG_CLI_HASH_FAILED"};
    }
    if (String(observedHash || "").toLowerCase() !== archive.sha256) {
      return {ok: false, status: "LG_CLI_CHECKSUM_MISMATCH"};
    }

    const stagingRoot = `${managedRoot}.staging`;
    const previousRoot = `${managedRoot}.previous`;
    let movedPrevious = false;
    let activated = false;
    try {
      const hasCurrentInstall = await exists(fs, managedRoot);
      await fs.rm(stagingRoot, {recursive: true, force: true});
      await fs.mkdir(stagingRoot, {recursive: true});
      await extract({archivePath, destination: stagingRoot, platform});
      if (!(await verifyCliLayout(fs, stagingRoot))) {
        return {ok: false, status: "LG_CLI_LAYOUT_INVALID"};
      }
      await fs.rm(previousRoot, {recursive: true, force: true});
      if (hasCurrentInstall) {
        await fs.rename(managedRoot, previousRoot);
        movedPrevious = true;
      }
      await fs.rename(stagingRoot, managedRoot);
      activated = true;
      if (movedPrevious) await fs.rm(previousRoot, {recursive: true, force: true});
      return {ok: true, status: "LG_CLI_IMPORTED", component: {id: "webos-cli", version: archive.version}};
    } catch {
      if (movedPrevious && !activated) {
        try {
          await fs.rename(previousRoot, managedRoot);
        } catch {
          // Preserve the original import failure without exposing local paths.
        }
      }
      return {ok: false, status: "LG_CLI_IMPORT_FAILED"};
    } finally {
      try {
        await fs.rm(stagingRoot, {recursive: true, force: true});
      } catch {
        // Staging cleanup is best effort and never changes the public result.
      }
    }
  }

  return {importArchive};
}

module.exports = {createLgCliArchiveImporter};
