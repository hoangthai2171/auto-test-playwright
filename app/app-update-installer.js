"use strict";

const path = require("node:path");
const fsPromises = require("node:fs/promises");
const {promisify} = require("node:util");
const {execFile} = require("node:child_process");

const runDefault = promisify(execFile);

// The swap runs after this process exits, so it cannot report back. It therefore
// keeps the old bundle until the new one is in place and restores it when the
// move fails, so a failed update never leaves the machine without an app.
const MACOS_SWAP_SCRIPT = `#!/bin/sh
set -u
pid="$1"
current="$2"
staged="$3"
backup="$4"
waited=0
while kill -0 "$pid" 2>/dev/null; do
  sleep 1
  waited=$((waited + 1))
  if [ "$waited" -ge 120 ]; then exit 1; fi
done
rm -rf "$backup" || exit 1
mv "$current" "$backup" || exit 1
if mv "$staged" "$current"; then
  rm -rf "$backup"
else
  mv "$backup" "$current"
  exit 1
fi
exec /usr/bin/open "$current"
`;

// macOS bundle paths are always POSIX, so this stays independent of the host
// separator and remains testable from a Windows checkout.
function macAppBundlePath(executablePath) {
  const index = String(executablePath ?? "").indexOf("/Contents/MacOS/");
  if (index <= 0) return "";
  const bundle = executablePath.slice(0, index);
  return bundle.endsWith(".app") ? bundle : "";
}

function createAppUpdateInstaller({
  platform,
  isPackaged,
  executablePath,
  processId,
  fs = fsPromises,
  spawn,
  run = runDefault,
  quitApp,
  revealPath,
} = {}) {
  if (typeof spawn !== "function" || typeof quitApp !== "function") {
    throw new Error("App update installation dependencies are required.");
  }

  async function launchWindowsInstaller(archivePath) {
    const child = spawn(archivePath, [], {detached: true, stdio: "ignore", windowsHide: false});
    child.unref?.();
    return {ok: true, status: "UPDATE_INSTALL_STARTED"};
  }

  async function stagedMacApp(archivePath) {
    const stagingPath = path.join(path.dirname(archivePath), "staged");
    await fs.rm(stagingPath, {recursive: true, force: true});
    await fs.mkdir(stagingPath, {recursive: true});
    await run("/usr/bin/ditto", ["-x", "-k", archivePath, stagingPath], {shell: false});
    const entries = (await fs.readdir(stagingPath)).filter((entry) => entry.endsWith(".app"));
    if (entries.length !== 1) return {status: "UPDATE_ARCHIVE_INVALID"};
    return {stagedApp: path.join(stagingPath, entries[0])};
  }

  async function launchMacSwap(archivePath) {
    const currentApp = macAppBundlePath(executablePath);
    if (!currentApp) return {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED"};
    const staged = await stagedMacApp(archivePath);
    if (!staged.stagedApp) return {ok: false, status: staged.status};

    const scriptPath = path.join(path.dirname(archivePath), "swap-app-bundle.sh");
    await fs.writeFile(scriptPath, MACOS_SWAP_SCRIPT, {mode: 0o700});
    const backupPath = `${currentApp}.previous`;
    const child = spawn(
      "/bin/sh",
      [scriptPath, String(processId), currentApp, staged.stagedApp, backupPath],
      {detached: true, stdio: "ignore"}
    );
    child.unref?.();
    return {ok: true, status: "UPDATE_INSTALL_STARTED"};
  }

  return {
    // A development run has no bundle to replace, so the verified download is
    // only revealed - never installed over a source checkout.
    async install({archivePath} = {}) {
      if (typeof archivePath !== "string" || !archivePath) return {ok: false, status: "UPDATE_INSTALL_FAILED"};
      if (isPackaged !== true) {
        try { revealPath?.(archivePath); } catch {}
        return {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED", archivePath};
      }
      if (platform !== "win32" && platform !== "darwin") return {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"};

      let started;
      try {
        started = platform === "win32" ? await launchWindowsInstaller(archivePath) : await launchMacSwap(archivePath);
      } catch {
        return {ok: false, status: "UPDATE_INSTALL_FAILED"};
      }
      if (!started?.ok) return started;

      quitApp();
      return {ok: true, status: "UPDATE_INSTALL_STARTED"};
    },
  };
}

module.exports = {createAppUpdateInstaller, macAppBundlePath, MACOS_SWAP_SCRIPT};
