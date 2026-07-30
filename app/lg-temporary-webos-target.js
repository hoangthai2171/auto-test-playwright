"use strict";

const net = require("node:net");
const path = require("node:path");
const {spawnSync: defaultSpawnSync} = require("node:child_process");

const TARGET_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const HOSTNAME = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/u;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isHost(value) {
  if (!value || /\s|[/:@]/u.test(value)) return false;
  if (net.isIP(value)) return true;
  return !/^[0-9.]+$/u.test(value) && HOSTNAME.test(value);
}

function targetNames(output) {
  try {
    const entries = JSON.parse(String(output || ""));
    if (Array.isArray(entries)) {
      return new Set(entries.map((entry) => text(entry?.name)).filter((name) => TARGET_NAME.test(name)));
    }
  } catch {
    // Some supported CLI releases use line-oriented --listfull output.
  }
  const names = new Set();
  for (const line of String(output || "").split(/\r?\n/u)) {
    const match = line.match(/^\s*name\s*:\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*$/u);
    if (match) names.add(match[1]);
  }
  return names.size ? names : null;
}

function createLgTemporaryWebOsTarget({webosSdkHome, spawnSync = defaultSpawnSync, createTargetName} = {}) {
  if (!text(webosSdkHome)) throw new Error("A webOS SDK home is required.");
  if (typeof spawnSync !== "function") throw new Error("A synchronous process launcher is required.");
  if (typeof createTargetName !== "function") throw new Error("A temporary target name factory is required.");

  const command = path.join(text(webosSdkHome), "CLI", "bin", "ares-setup-device");

  function run(args) {
    try {
      const result = spawnSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      if (result?.error?.code === "ENOENT") return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
      if (result?.error || result?.status !== 0) return {ok: false, status: "TARGET_REGISTRATION_FAILED"};
      return {ok: true, stdout: String(result.stdout || "")};
    } catch {
      return {ok: false, status: "TARGET_REGISTRATION_FAILED"};
    }
  }

  return Object.freeze({
    async acquire({host, passphrase} = {}) {
      const safeHost = text(host);
      const safePassphrase = text(passphrase);
      if (!isHost(safeHost) || !safePassphrase) return {ok: false, status: "INVALID_CONNECTION"};

      const name = text(createTargetName());
      if (!TARGET_NAME.test(name)) return {ok: false, status: "TARGET_REGISTRATION_FAILED"};

      const listed = run(["--listfull"]);
      if (!listed.ok) return {ok: false, status: listed.status === "TOOLCHAIN_UNAVAILABLE" ? listed.status : "TARGET_LIST_FAILED"};
      const names = targetNames(listed.stdout);
      if (!names) return {ok: false, status: "TARGET_LIST_FAILED"};
      if (names.has(name)) return {ok: false, status: "TARGET_NAME_CONFLICT"};

      const added = run([
        "--add", name,
        "--info", `host=${safeHost}`,
        "--info", "port=9922",
        "--info", "username=prisoner",
        "--info", `passphrase=${safePassphrase}`,
      ]);
      if (!added.ok) return {ok: false, status: added.status};

      let released = false;
      return Object.freeze({
        ok: true,
        targetName: name,
        async release() {
          if (released) return;
          released = true;
          run(["--remove", name]);
        },
      });
    },
  });
}

module.exports = {createLgTemporaryWebOsTarget};
