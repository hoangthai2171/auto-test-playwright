"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createAppUpdateInstaller, macAppBundlePath, MACOS_SWAP_SCRIPT} = require("../../app/app-update-installer");

function harness({platform, isPackaged = true, executablePath, readdir = ["MyTV Auto Test.app"], run} = {}) {
  const spawned = [];
  const written = [];
  const removed = [];
  const revealed = [];
  let quits = 0;
  const installer = createAppUpdateInstaller({
    platform,
    isPackaged,
    executablePath,
    processId: 4242,
    fs: {
      async rm(target) { removed.push(target); },
      async mkdir() {},
      async readdir() { return readdir; },
      async writeFile(filePath, content, options) { written.push({filePath, content, options}); },
    },
    spawn: (command, args, options) => {
      spawned.push({command, args, options});
      return {unref() {}};
    },
    run: run ?? (async () => ({stdout: ""})),
    quitApp: () => { quits += 1; },
    revealPath: (target) => revealed.push(target),
  });
  return {installer, spawned, written, removed, revealed, quitCount: () => quits};
}

test("derives the running bundle from the executable path", () => {
  assert.equal(
    macAppBundlePath("/Applications/MyTV Auto Test.app/Contents/MacOS/MyTV Auto Test"),
    "/Applications/MyTV Auto Test.app"
  );
  assert.equal(macAppBundlePath("/usr/local/bin/node"), "");
  assert.equal(macAppBundlePath(""), "");
});

test("launches the Windows installer detached and then quits", async () => {
  const {installer, spawned, quitCount} = harness({platform: "win32", executablePath: "C:\\Program Files\\MyTV Auto Test\\MyTV Auto Test.exe"});
  const result = await installer.install({archivePath: "C:\\updates\\Setup.exe"});
  assert.deepEqual(result, {ok: true, status: "UPDATE_INSTALL_STARTED"});
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].command, "C:\\updates\\Setup.exe");
  assert.equal(spawned[0].options.detached, true);
  assert.equal(quitCount(), 1);
});

test("extracts the macOS archive and hands the swap to a detached script", async () => {
  const extracted = [];
  const {installer, spawned, written, quitCount} = harness({
    platform: "darwin",
    executablePath: "/Applications/MyTV Auto Test.app/Contents/MacOS/MyTV Auto Test",
    run: async (command, args) => { extracted.push({command, args}); return {stdout: ""}; },
  });

  const result = await installer.install({archivePath: "/updates/abc/app.zip"});
  assert.deepEqual(result, {ok: true, status: "UPDATE_INSTALL_STARTED"});
  assert.deepEqual(extracted, [{command: "/usr/bin/ditto", args: ["-x", "-k", "/updates/abc/app.zip", "/updates/abc/staged"]}]);
  assert.deepEqual(written, [{filePath: "/updates/abc/swap-app-bundle.sh", content: MACOS_SWAP_SCRIPT, options: {mode: 0o700}}]);
  assert.deepEqual(spawned, [{
    command: "/bin/sh",
    args: [
      "/updates/abc/swap-app-bundle.sh",
      "4242",
      "/Applications/MyTV Auto Test.app",
      "/updates/abc/staged/MyTV Auto Test.app",
      "/Applications/MyTV Auto Test.app.previous",
    ],
    options: {detached: true, stdio: "ignore"},
  }]);
  assert.equal(quitCount(), 1);
});

test("keeps the running app when the macOS archive holds no single bundle", async () => {
  const empty = harness({platform: "darwin", executablePath: "/Applications/MyTV Auto Test.app/Contents/MacOS/MyTV Auto Test", readdir: []});
  assert.deepEqual(await empty.installer.install({archivePath: "/updates/abc/app.zip"}), {ok: false, status: "UPDATE_ARCHIVE_INVALID"});
  assert.equal(empty.quitCount(), 0);

  const ambiguous = harness({
    platform: "darwin",
    executablePath: "/Applications/MyTV Auto Test.app/Contents/MacOS/MyTV Auto Test",
    readdir: ["One.app", "Two.app"],
  });
  assert.deepEqual(await ambiguous.installer.install({archivePath: "/updates/abc/app.zip"}), {ok: false, status: "UPDATE_ARCHIVE_INVALID"});
  assert.equal(ambiguous.quitCount(), 0);
});

test("reveals the download instead of installing over a source checkout", async () => {
  const {installer, spawned, revealed, quitCount} = harness({platform: "darwin", isPackaged: false, executablePath: "/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"});
  const result = await installer.install({archivePath: "/updates/abc/app.zip"});
  assert.deepEqual(result, {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED", archivePath: "/updates/abc/app.zip"});
  assert.deepEqual(revealed, ["/updates/abc/app.zip"]);
  assert.deepEqual(spawned, []);
  assert.equal(quitCount(), 0);
});

test("refuses an unsupported platform, a missing bundle and a missing archive", async () => {
  const linux = harness({platform: "linux", executablePath: "/opt/app/app"});
  assert.deepEqual(await linux.installer.install({archivePath: "/updates/app.zip"}), {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"});

  const unbundled = harness({platform: "darwin", executablePath: "/opt/app/app"});
  assert.deepEqual(await unbundled.installer.install({archivePath: "/updates/app.zip"}), {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED"});

  const {installer} = harness({platform: "win32", executablePath: "C:\\app.exe"});
  assert.deepEqual(await installer.install({}), {ok: false, status: "UPDATE_INSTALL_FAILED"});
});

test("reports a failed extraction without quitting", async () => {
  const {installer, quitCount} = harness({
    platform: "darwin",
    executablePath: "/Applications/MyTV Auto Test.app/Contents/MacOS/MyTV Auto Test",
    run: async () => { throw new Error("ditto failed"); },
  });
  assert.deepEqual(await installer.install({archivePath: "/updates/abc/app.zip"}), {ok: false, status: "UPDATE_INSTALL_FAILED"});
  assert.equal(quitCount(), 0);
});

test("restores the previous bundle in the swap script when the move fails", () => {
  assert.match(MACOS_SWAP_SCRIPT, /mv "\$backup" "\$current"/u);
  assert.match(MACOS_SWAP_SCRIPT, /kill -0 "\$pid"/u);
  assert.match(MACOS_SWAP_SCRIPT, /exec \/usr\/bin\/open "\$current"/u);
});
