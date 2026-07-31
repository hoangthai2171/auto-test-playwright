#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const {createReadStream} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {createWebOsReadOnlyAdapter} = require("../../app/webos-read-only-adapter");
const {
  applyCompatibilityProfile,
  buildCandidateGateArgs,
  parseCompatibilityCandidate,
} = require("./lg-device-compatibility-check-core");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PLATFORMS = new Set(["darwin", "win32"]);

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (["--validate-candidate", "--record-candidate", "--confirm-record", "--replace-existing", "--help", "-h"].includes(item)) {
      args[item.replace(/^--/, "")] = true;
      continue;
    }
    if (!item.startsWith("--")) throw new Error("An unsupported compatibility command argument was supplied.");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("A compatibility command value is required.");
    args[item.slice(2)] = value;
    index += 1;
  }
  if (!args.help && Boolean(args["validate-candidate"]) === Boolean(args["record-candidate"])) {
    throw new Error("Choose exactly one compatibility command mode.");
  }
  return args;
}

async function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function downloadArtifact(artifact, destination, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(artifact.url, {redirect: "error"});
  if (!response?.ok || typeof response.arrayBuffer !== "function") throw new Error("The reviewed ChromeDriver archive is unavailable.");
  const archivePath = path.join(destination, artifact.archiveName);
  await fs.writeFile(archivePath, Buffer.from(await response.arrayBuffer()), {flag: "wx", mode: 0o600});
  return archivePath;
}

async function verifyArchive(archivePath, artifact) {
  return (await sha256(archivePath)).toLowerCase() === artifact.sha256;
}

function run(command, args) {
  const result = spawnSync(command, args, {encoding: "utf8", stdio: ["ignore", "ignore", "ignore"], windowsHide: true});
  return result?.status === 0;
}

async function listFiles(root, name) {
  const matches = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, {withFileTypes: true});
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile() && entry.name === name) matches.push(child);
    }
  }
  await walk(root);
  return matches;
}

async function extractChromeDriver({archivePath, destination, platform}) {
  const extracted = platform === "darwin"
    ? run("/usr/bin/unzip", ["-q", archivePath, "-d", destination])
    : run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force", archivePath, destination]);
  if (!extracted) throw new Error("The reviewed ChromeDriver archive could not be extracted.");
  const matches = await listFiles(destination, platform === "win32" ? "chromedriver.exe" : "chromedriver");
  if (matches.length !== 1) throw new Error("The reviewed ChromeDriver archive layout is invalid.");
  return matches[0];
}

async function verifyChromeDriver(executablePath, version) {
  const result = spawnSync(executablePath, ["--version"], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true});
  return result?.status === 0 && new RegExp(`^ChromeDriver ${String(version).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\s|$)`, "u").test(String(result.stdout || "").trim());
}

function createReadDeviceInfo(webosSdkHome) {
  const adapter = createWebOsReadOnlyAdapter({webosSdkHome});
  return ({deviceName}) => adapter.deviceInfo({deviceName});
}

function runGate({gateArgs, deviceHost}) {
  const args = [...gateArgs.slice(1), "--host", required(deviceHost, "Runtime LG host")];
  return {ok: run(process.execPath, args)};
}

async function validateCandidate({
  candidate,
  platform = process.platform,
  runtime,
  createTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), "mytv-lg-compatibility-")),
  removeTempDir = (directory) => fs.rm(directory, {recursive: true, force: true}),
  downloadArtifact: download = downloadArtifact,
  verifyArchive: verify = verifyArchive,
  extractChromeDriver: extract = extractChromeDriver,
  verifyChromeDriver: verifyDriver = verifyChromeDriver,
  readDeviceInfo,
  runGate: executeGate = runGate,
} = {}) {
  if (!PLATFORMS.has(platform)) return {ok: false, status: "PLATFORM_UNSUPPORTED"};
  let temporaryRoot;
  try {
    const safeCandidate = parseCompatibilityCandidate(candidate);
    const deviceInfo = await readDeviceInfo({deviceName: required(runtime?.deviceName, "Registered LG device name")});
    if (deviceInfo?.model !== safeCandidate.model || deviceInfo?.firmware !== safeCandidate.firmware) {
      return {ok: false, status: "DEVICE_IDENTITY_MISMATCH"};
    }
    temporaryRoot = await createTempDir();
    const artifact = safeCandidate.chromedriver[platform];
    const archivePath = await download(artifact, temporaryRoot);
    if (await verify(archivePath, artifact) !== true) return {ok: false, status: "ARCHIVE_UNVERIFIED"};
    const executablePath = await extract({archivePath, destination: temporaryRoot, platform});
    if (await verifyDriver(executablePath, artifact.version) !== true) return {ok: false, status: "CHROMEDRIVER_UNVERIFIED"};
    const gateArgs = buildCandidateGateArgs({
      candidate: safeCandidate,
      runtime: {
        ...runtime,
        chromedriverPath: executablePath,
        model: deviceInfo.model,
      },
    });
    return (await executeGate({gateArgs, deviceHost: runtime?.deviceHost}))?.ok === true
      ? {ok: true, status: "CANDIDATE_VALIDATED"}
      : {ok: false, status: "PRODUCT_GATE_FAILED"};
  } catch {
    return {ok: false, status: "CANDIDATE_VALIDATION_FAILED"};
  } finally {
    if (temporaryRoot) {
      try {
        await removeTempDir(temporaryRoot);
      } catch {
        // Cleanup failures do not expose local paths or alter the result classification.
      }
    }
  }
}

async function recordCandidate({catalog, candidate, confirmed, replaceExisting} = {}) {
  if (confirmed !== true) return {ok: false, status: "RECORD_CONFIRMATION_REQUIRED"};
  try {
    return {ok: true, status: "CATALOG_RECORDED", catalog: applyCompatibilityProfile({catalog, candidate, confirmed, replaceExisting})};
  } catch (error) {
    if (/update confirmation/i.test(String(error?.message || ""))) return {ok: false, status: "UPDATE_CONFIRMATION_REQUIRED"};
    return {ok: false, status: "RECORD_REJECTED"};
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeCatalog(destination, catalog) {
  const temporary = `${destination}.next`;
  await fs.writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, {encoding: "utf8", mode: 0o600});
  await fs.rename(temporary, destination);
}

function usage() {
  return "Use this maintainer command only through the device-compatibility-check skill.";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(`${usage()}\n`); return; }
  const candidate = await readJson(required(args["catalog-candidate"], "Compatibility candidate file"));
  const catalogPath = path.join(PROJECT_ROOT, "DEVICE-COMPATIBILITY.json");
  if (args["record-candidate"]) {
    const result = await recordCandidate({
      catalog: await readJson(catalogPath),
      candidate,
      confirmed: args["confirm-record"] === true,
      replaceExisting: args["replace-existing"] === true,
    });
    if (result.ok) await writeCatalog(catalogPath, result.catalog);
    process.stdout.write(`${result.status}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  const result = await validateCandidate({
    candidate,
    runtime: {
      deviceName: required(args.device, "Registered LG device name"),
      deviceHost: required(args.host, "Runtime LG host"),
      searchName: required(args["search-name"], "LG search name"),
      contentType: required(args["content-type"], "LG content type"),
      runtimeRoot: args["runtime-root"] || PROJECT_ROOT,
    },
    readDeviceInfo: createReadDeviceInfo(required(args["webos-sdk"], "webOS SDK home")),
  });
  process.stdout.write(`${result.status}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("CANDIDATE_VALIDATION_FAILED\n");
    process.exitCode = 1;
  });
}

module.exports = {parseArgs, recordCandidate, validateCandidate};
