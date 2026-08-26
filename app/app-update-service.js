"use strict";

const path = require("node:path");
const fsPromises = require("node:fs/promises");
const {createReadStream: defaultCreateReadStream} = require("node:fs");
const {createHash: defaultCreateHash} = require("node:crypto");
const {normalizeVersion, resolveUpdateTarget, validateAppUpdateManifest} = require("./app-update-manifest");

const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

// Only the manifest recorded by the last check can be installed. The renderer
// never supplies a download URL - it names a version, and a mismatch means the
// user is acting on a dialog that no longer matches what the server offered.
function createAppUpdateService({
  currentVersion,
  platform,
  arch,
  downloadRoot,
  installer,
  fetchManifest,
  fetch = globalThis.fetch,
  fs = fsPromises,
  createReadStream = defaultCreateReadStream,
  createHash = defaultCreateHash,
} = {}) {
  if (typeof fetchManifest !== "function" || typeof fetch !== "function") {
    throw new Error("App update dependencies are required.");
  }
  if (typeof downloadRoot !== "string" || !downloadRoot || !installer?.install) {
    throw new Error("An app update download root and installer are required.");
  }

  const target = resolveUpdateTarget({platform, arch});
  const version = normalizeVersion(currentVersion);
  let pending = null;

  function publicUpdate(update) {
    return {
      ok: true,
      updateAvailable: true,
      currentVersion: update.currentVersion,
      version: update.version,
      releaseName: update.releaseName,
      changelog: update.changelog,
      mandatory: update.mandatory,
      downloadSize: update.artifact.size,
      fileName: update.artifact.fileName,
    };
  }

  async function check({apiDomain, authorization, timeoutMs} = {}) {
    if (!target) return {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"};
    const normalizedDomain = String(apiDomain ?? "").trim();
    if (!normalizedDomain) return {ok: false, status: "UPDATE_CHECK_UNAVAILABLE"};

    // The endpoint takes no parameters: it serves one manifest listing every
    // build, and this process picks the artifact for its own platform.
    let response;
    try {
      response = await fetchManifest({apiDomain: normalizedDomain, authorization, timeoutMs});
    } catch {
      return {ok: false, status: "UPDATE_CHECK_FAILED"};
    }
    if (!response?.ok) {
      return {ok: false, status: response?.timeout ? "UPDATE_CHECK_TIMEOUT" : "UPDATE_CHECK_FAILED"};
    }

    const validated = validateAppUpdateManifest(response.manifest, {
      platform: target.platform,
      arch: target.arch,
      currentVersion: version,
      apiDomain: normalizedDomain,
    });
    if (!validated.ok) {
      pending = null;
      return validated;
    }
    if (!validated.updateAvailable) {
      pending = null;
      return {ok: true, updateAvailable: false, currentVersion: validated.currentVersion, version: validated.version};
    }

    pending = {...validated, apiDomain: normalizedDomain, authorization: String(authorization ?? ""), timeoutMs};
    return publicUpdate(validated);
  }

  async function* iterateBody(response) {
    const body = response?.body;
    if (body && typeof body[Symbol.asyncIterator] === "function") {
      yield* body;
      return;
    }
    if (typeof response?.arrayBuffer !== "function") throw new Error("The update artifact stream is unavailable.");
    yield Buffer.from(await response.arrayBuffer());
  }

  async function downloadArtifact({artifact, authorization, emit}) {
    const directory = path.join(downloadRoot, artifact.sha256);
    await fs.rm(directory, {recursive: true, force: true});
    await fs.mkdir(directory, {recursive: true});
    const archivePath = path.join(directory, artifact.fileName);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const token = String(authorization ?? "").trim();
    let received = 0;
    let reported = -1;
    try {
      const response = await fetch(artifact.url, {
        redirect: "error",
        signal: controller.signal,
        headers: token ? {"X-FlowTest-Service-Token": token} : {},
      });
      if (!response?.ok) return {status: "UPDATE_DOWNLOAD_FAILED"};

      const handle = await fs.open(archivePath, "w", 0o600);
      try {
        for await (const chunk of iterateBody(response)) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.length;
          // A body longer than the manifest declared is a mismatched artifact,
          // and must not be allowed to keep filling the disk.
          if (received > artifact.size) return {status: "UPDATE_VERIFICATION_FAILED"};
          await handle.write(buffer);
          const percent = Math.floor((received / artifact.size) * 100);
          if (percent > reported) {
            reported = percent;
            emit({code: "downloading", percent, receivedBytes: received, totalBytes: artifact.size});
          }
        }
      } finally {
        await handle.close();
      }
    } catch {
      return {status: "UPDATE_DOWNLOAD_FAILED"};
    } finally {
      clearTimeout(timer);
    }

    if (received !== artifact.size) return {status: "UPDATE_VERIFICATION_FAILED"};

    emit({code: "verifying"});
    let digest;
    try {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(archivePath)) hash.update(chunk);
      digest = hash.digest("hex");
    } catch {
      return {status: "UPDATE_VERIFICATION_FAILED"};
    }
    if (digest !== artifact.sha256) return {status: "UPDATE_VERIFICATION_FAILED"};

    return {archivePath};
  }

  return Object.freeze({
    currentVersion: version,

    async check(request) {
      return check(request);
    },

    async install({version: requestedVersion, onProgress} = {}) {
      const emit = (event) => { try { onProgress?.(event); } catch {} };
      if (!pending) return {ok: false, status: "UPDATE_NOT_CHECKED"};
      if (normalizeVersion(requestedVersion) !== pending.version) return {ok: false, status: "UPDATE_VERSION_MISMATCH"};

      emit({code: "downloading", percent: 0, receivedBytes: 0, totalBytes: pending.artifact.size});
      const downloaded = await downloadArtifact({
        artifact: pending.artifact,
        authorization: pending.authorization,
        emit,
      });
      if (!downloaded.archivePath) {
        emit({code: "failed", status: downloaded.status});
        return {ok: false, status: downloaded.status};
      }

      emit({code: "installing"});
      let result;
      try {
        result = await installer.install({archivePath: downloaded.archivePath, version: pending.version});
      } catch {
        result = {ok: false, status: "UPDATE_INSTALL_FAILED"};
      }
      if (!result?.ok) {
        emit({code: "failed", status: result?.status || "UPDATE_INSTALL_FAILED"});
        return {ok: false, status: result?.status || "UPDATE_INSTALL_FAILED", archivePath: result?.archivePath};
      }

      emit({code: "complete"});
      return {ok: true, status: result.status || "UPDATE_INSTALL_STARTED"};
    },

    cancel() {
      pending = null;
    },
  });
}

module.exports = {createAppUpdateService, DOWNLOAD_TIMEOUT_MS};
