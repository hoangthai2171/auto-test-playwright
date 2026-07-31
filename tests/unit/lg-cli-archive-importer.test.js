"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgCliArchiveImporter} = require("../../app/lg-cli-archive-importer");

const managedRoot = "/user-data/lg-toolchain/webos-cli";
const sourceArchive = "/picker/webOS_TV_CLI_mac_1.12.4-j27.tgz";
const archive = {
  version: "1.12.4",
  archiveName: "webOS_TV_CLI_mac_1.12.4-j27.tgz",
  sha256: "a".repeat(64),
};
const CLI_COMMANDS = ["ares", "ares-setup-device", "ares-device-info", "ares-install"];

function createMemoryFs({withExistingManagedRoot = true} = {}) {
  const directories = new Set(withExistingManagedRoot ? [managedRoot] : []);
  const files = new Set();
  const removed = [];
  function moveEntries(entries, fromPath, toPath) {
    const matching = [...entries].filter((entry) => entry === fromPath || entry.startsWith(`${fromPath}/`));
    if (!matching.length) {
      const error = new Error("not found");
      error.code = "ENOENT";
      throw error;
    }
    for (const entry of matching) {
      entries.delete(entry);
      entries.add(`${toPath}${entry.slice(fromPath.length)}`);
    }
  }
  return {
    directories,
    files,
    removed,
    fs: {
      async stat(targetPath) {
        if (directories.has(targetPath)) return {isDirectory: () => true, isFile: () => false};
        if (files.has(targetPath)) return {isDirectory: () => false, isFile: () => true};
        const error = new Error("not found");
        error.code = "ENOENT";
        throw error;
      },
      async mkdir(targetPath) { directories.add(targetPath); },
      async rm(targetPath) {
        removed.push(targetPath);
        for (const entries of [directories, files]) {
          for (const entry of [...entries]) {
            if (entry === targetPath || entry.startsWith(`${targetPath}/`)) entries.delete(entry);
          }
        }
      },
      async rename(fromPath, toPath) {
        moveEntries(directories, fromPath, toPath);
        for (const filePath of [...files]) {
          if (filePath === fromPath || filePath.startsWith(`${fromPath}/`)) {
            files.delete(filePath);
            files.add(`${toPath}${filePath.slice(fromPath.length)}`);
          }
        }
      },
    },
  };
}

function createHarness({hash = archive.sha256, withExistingManagedRoot = true} = {}) {
  const memory = createMemoryFs({withExistingManagedRoot});
  const extracted = [];
  const importer = createLgCliArchiveImporter({
    platform: "darwin",
    managedRoot,
    fs: memory.fs,
    trustedArchive: () => archive,
    async hashFile() { return hash; },
    async extract({destination}) {
      extracted.push(destination);
      memory.directories.add(`${destination}/CLI`);
      memory.directories.add(`${destination}/CLI/bin`);
      for (const command of CLI_COMMANDS) memory.files.add(`${destination}/CLI/bin/${command}`);
    },
  });
  return {importer, memory, extracted};
}

test("requires explicit confirmation before it reads or changes a selected archive", async () => {
  const {importer, memory, extracted} = createHarness();

  assert.deepEqual(await importer.importArchive({archivePath: sourceArchive, confirmed: false}), {
    ok: false,
    status: "INSTALL_CONFIRMATION_REQUIRED",
  });
  assert.deepEqual(extracted, []);
  assert.equal(memory.directories.has(managedRoot), true);
  assert.deepEqual(memory.removed, []);
});

test("preserves the active CLI when the selected archive fingerprint is wrong", async () => {
  const {importer, memory, extracted} = createHarness({hash: "b".repeat(64)});

  assert.deepEqual(await importer.importArchive({archivePath: sourceArchive, confirmed: true}), {
    ok: false,
    status: "LG_CLI_CHECKSUM_MISMATCH",
  });
  assert.equal(memory.directories.has(managedRoot), true);
  assert.deepEqual(extracted, []);
  assert.deepEqual(memory.removed, []);
});

test("activates only a verified archive with the required CLI layout", async () => {
  const {importer, memory, extracted} = createHarness();

  assert.deepEqual(await importer.importArchive({archivePath: sourceArchive, confirmed: true}), {
    ok: true,
    status: "LG_CLI_IMPORTED",
    component: {id: "webos-cli", version: "1.12.4"},
  });
  assert.deepEqual(extracted, [`${managedRoot}.staging`]);
  for (const command of CLI_COMMANDS) assert.equal(memory.files.has(`${managedRoot}/CLI/bin/${command}`), true);
  assert.equal(memory.directories.has(`${managedRoot}.staging`), false);
});

test("rejects a differently named archive before hashing or extraction", async () => {
  const {importer, memory, extracted} = createHarness();

  assert.deepEqual(await importer.importArchive({archivePath: "/picker/other.zip", confirmed: true}), {
    ok: false,
    status: "LG_CLI_ARCHIVE_INVALID",
  });
  assert.deepEqual(extracted, []);
  assert.equal(memory.directories.has(managedRoot), true);
  assert.deepEqual(memory.removed, []);
});
