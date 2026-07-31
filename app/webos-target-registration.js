"use strict";

const net = require("node:net");
const path = require("node:path");
const {spawnSync: defaultSpawnSync} = require("node:child_process");

const TARGET_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const HOSTNAME = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/u;

function isHost(value) {
  if (typeof value !== "string" || !value || /\s|[/:@]/u.test(value)) return false;
  if (net.isIP(value)) return true;
  if (/^[0-9.]+$/u.test(value)) return false;
  return HOSTNAME.test(value);
}

function parseTargetNames(output) {
  const names = new Set();
  for (const line of String(output || "").split(/\r?\n/u)) {
    const match = line.match(/^\s*name\s*:\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*$/u);
    if (match) names.add(match[1]);
  }
  return names.size ? names : null;
}

function createWebOsTargetRegistration({webosSdkHome, spawnSync = defaultSpawnSync} = {}) {
  if (typeof webosSdkHome !== "string" || !webosSdkHome.trim()) {
    throw new Error("A webOS SDK home is required.");
  }
  if (typeof spawnSync !== "function") throw new Error("A synchronous process launcher is required.");

  const command = path.join(webosSdkHome, "CLI", "bin", "ares-setup-device");
  const run = (args, failureStatus) => {
    let result;
    try {
      result = spawnSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch {
      return {ok: false, status: failureStatus};
    }
    if (result?.error?.code === "ENOENT") return {ok: false, status: "TOOLCHAIN_UNAVAILABLE"};
    if (result?.error || result?.status !== 0) return {ok: false, status: failureStatus};
    return {ok: true, stdout: String(result.stdout || "")};
  };

  return {
    async register({targetName, host} = {}) {
      if (typeof targetName !== "string" || !TARGET_NAME.test(targetName)) {
        return {ok: false, status: "INVALID_TARGET_NAME"};
      }
      if (!isHost(host)) return {ok: false, status: "INVALID_HOST"};

      const listed = run(["--listfull"], "TARGET_LIST_FAILED");
      if (!listed.ok) return listed;
      const names = parseTargetNames(listed.stdout);
      if (!names) return {ok: false, status: "TARGET_LIST_UNREADABLE"};
      if (names.has(targetName)) return {ok: false, status: "TARGET_NAME_CONFLICT"};

      const added = run([
        "--add",
        targetName,
        "--info",
        `host=${host},port=9922,username=prisoner`,
      ], "TARGET_REGISTRATION_FAILED");
      return added.ok
        ? {ok: true, status: "TARGET_REGISTERED", targetName}
        : {ok: false, status: added.status};
    },
  };
}

module.exports = {createWebOsTargetRegistration};
