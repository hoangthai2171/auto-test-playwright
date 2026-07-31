"use strict";

const {Readable} = require("node:stream");
const {createHash} = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const {createLgCliImportOperations} = require("../../app/lg-cli-import-operations");

test("hashes an archive from a stream without loading it into memory", async () => {
  const sourcePaths = [];
  const operations = createLgCliImportOperations({
    platform: "darwin",
    createReadStream(sourcePath) {
      sourcePaths.push(sourcePath);
      return Readable.from([Buffer.from("abc")]);
    },
    createHash,
    run: async () => {},
  });

  assert.equal(await operations.hashFile("/picker/archive.tgz"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.deepEqual(sourcePaths, ["/picker/archive.tgz"]);
});

test("extracts a macOS archive with a fixed tar executable and argument list", async () => {
  const calls = [];
  const operations = createLgCliImportOperations({
    platform: "darwin",
    createReadStream: () => Readable.from([]),
    createHash,
    async run(command, args, options) { calls.push([command, args, options]); },
  });

  await operations.extract({archivePath: "/picker/archive.tgz", destination: "/user-data/staging"});

  assert.deepEqual(calls, [[
    "/usr/bin/tar",
    ["-xzf", "/picker/archive.tgz", "-C", "/user-data/staging"],
    {windowsHide: true, shell: false},
  ]]);
});

test("extracts a Windows archive with a fixed PowerShell command and literal arguments", async () => {
  const calls = [];
  const operations = createLgCliImportOperations({
    platform: "win32",
    createReadStream: () => Readable.from([]),
    createHash,
    async run(command, args, options) { calls.push([command, args, options]); },
  });

  await operations.extract({archivePath: "C:\\Downloads\\archive.zip", destination: "C:\\User Data\\staging"});

  assert.deepEqual(calls, [[
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "& { param($archivePath, $destinationPath) Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath -Force }",
      "C:\\Downloads\\archive.zip",
      "C:\\User Data\\staging",
    ],
    {windowsHide: true, shell: false},
  ]]);
});

test("rejects unsupported host platforms before hashing or extraction", () => {
  assert.throws(
    () => createLgCliImportOperations({platform: "linux", createReadStream: () => Readable.from([]), createHash, run: async () => {}}),
    /macOS and Windows/i,
  );
});
