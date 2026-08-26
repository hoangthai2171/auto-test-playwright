"use strict";

// The update manifest arrives from the internal flow-test server, so nothing in
// it is trusted: the version has to be strictly newer than the running build,
// the artifact has to match this platform/architecture, and it has to carry a
// size and a SHA-256 digest that the downloader can verify before anything is
// installed. An artifact host that does not belong to the configured API domain
// is rejected outright - a spoofed manifest must not be able to point the
// installer at an arbitrary server.

const UPDATE_PLATFORMS = new Set(["win32", "darwin"]);
const UPDATE_ARCHITECTURES = new Set(["x64", "arm64"]);
const ARTIFACT_EXTENSIONS = {win32: ".exe", darwin: ".zip"};
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u;
const FILE_NAME_PATTERN = /^[0-9A-Za-z][0-9A-Za-z ._+-]{0,119}$/u;
const MAX_CHANGELOG_ENTRIES = 60;
const MAX_CHANGELOG_ENTRY_LENGTH = 300;
const MAX_RELEASE_NAME_LENGTH = 120;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024;

function normalizeVersion(value) {
  return String(value ?? "").trim().replace(/^v/iu, "");
}

function parseVersion(value) {
  const normalized = normalizeVersion(value);
  if (!VERSION_PATTERN.test(normalized)) return null;
  const [release, prerelease = ""] = normalized.split("-", 2);
  const numbers = release.split(".").map((part) => Number(part));
  if (numbers.some((part) => !Number.isSafeInteger(part) || part < 0)) return null;
  while (numbers.length < 4) numbers.push(0);
  return {numbers, prerelease};
}

// A prerelease sorts below the matching release (1.1.0-rc.1 < 1.1.0), which is
// how electron-builder names its own prerelease artifacts.
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < a.numbers.length; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] > b.numbers[index] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease > b.prerelease ? 1 : -1;
}

function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) === 1;
}

function resolveUpdateTarget({platform, arch} = {}) {
  const normalizedPlatform = String(platform ?? "").trim();
  const normalizedArch = String(arch ?? "").trim();
  if (!UPDATE_PLATFORMS.has(normalizedPlatform) || !UPDATE_ARCHITECTURES.has(normalizedArch)) return null;
  return {platform: normalizedPlatform, arch: normalizedArch};
}

function unwrapManifest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (typeof payload.version === "string" || Array.isArray(payload.artifacts) || payload.artifact) return payload;
  if (payload.data && typeof payload.data === "object") return unwrapManifest(payload.data);
  return null;
}

function manifestArtifacts(manifest) {
  if (Array.isArray(manifest.artifacts)) return manifest.artifacts;
  if (manifest.artifact && typeof manifest.artifact === "object") return [manifest.artifact];
  return [];
}

function normalizeChangelog(value) {
  const lines = Array.isArray(value)
    ? value
    : String(value ?? "").split(/\r?\n/u);
  return lines
    .map((line) => String(line ?? "").trim().replace(/^[-*•]\s*/u, ""))
    .filter(Boolean)
    .slice(0, MAX_CHANGELOG_ENTRIES)
    .map((line) => (line.length > MAX_CHANGELOG_ENTRY_LENGTH ? `${line.slice(0, MAX_CHANGELOG_ENTRY_LENGTH)}…` : line));
}

function artifactFileName(artifact, url, platform) {
  const declared = String(artifact.fileName ?? artifact.name ?? "").trim();
  if (declared) return declared;
  const fromUrl = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
  return fromUrl || `mytv-auto-test-update${ARTIFACT_EXTENSIONS[platform]}`;
}

function parseArtifactUrl(value, apiDomain) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    return {status: "UPDATE_ARTIFACT_UNAVAILABLE"};
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return {status: "UPDATE_ARTIFACT_UNTRUSTED"};
  let expectedHost = "";
  try {
    expectedHost = new URL(String(apiDomain ?? "").trim()).hostname;
  } catch {
    return {status: "UPDATE_ARTIFACT_UNTRUSTED"};
  }
  if (!expectedHost || url.hostname !== expectedHost) return {status: "UPDATE_ARTIFACT_UNTRUSTED"};
  return {url};
}

function selectArtifact(manifest, {platform, arch, apiDomain}) {
  const candidates = manifestArtifacts(manifest).filter((artifact) => {
    if (!artifact || typeof artifact !== "object") return false;
    const artifactPlatform = String(artifact.platform ?? platform).trim();
    if (artifactPlatform !== platform) return false;
    const artifactArch = String(artifact.arch ?? "").trim();
    return !artifactArch || artifactArch === arch;
  });
  if (!candidates.length) return {status: "UPDATE_ARTIFACT_UNAVAILABLE"};

  // An artifact naming this architecture wins over one that leaves it open.
  const artifact = candidates.find((item) => String(item.arch ?? "").trim() === arch) || candidates[0];
  const parsed = parseArtifactUrl(artifact.url, apiDomain);
  if (!parsed.url) return {status: parsed.status};

  const size = Number(artifact.size ?? artifact.bytes);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ARTIFACT_BYTES) return {status: "UPDATE_ARTIFACT_UNAVAILABLE"};

  const sha256 = String(artifact.sha256 ?? artifact.sha256sum ?? "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) return {status: "UPDATE_ARTIFACT_UNVERIFIABLE"};

  const fileName = artifactFileName(artifact, parsed.url, platform);
  if (!FILE_NAME_PATTERN.test(fileName) || !fileName.toLowerCase().endsWith(ARTIFACT_EXTENSIONS[platform])) {
    return {status: "UPDATE_ARTIFACT_UNAVAILABLE"};
  }

  return {artifact: {platform, arch, url: parsed.url.toString(), fileName, size, sha256}};
}

function validateAppUpdateManifest(payload, {platform, arch, currentVersion, apiDomain} = {}) {
  const target = resolveUpdateTarget({platform, arch});
  if (!target) return {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"};
  if (!parseVersion(currentVersion)) return {ok: false, status: "UPDATE_MANIFEST_INVALID"};

  const manifest = unwrapManifest(payload);
  if (!manifest) return {ok: false, status: "UPDATE_MANIFEST_INVALID"};

  const version = normalizeVersion(manifest.version ?? manifest.latestVersion);
  if (!parseVersion(version)) return {ok: false, status: "UPDATE_MANIFEST_INVALID"};
  if (!isNewerVersion(version, currentVersion)) {
    return {ok: true, updateAvailable: false, currentVersion: normalizeVersion(currentVersion), version};
  }

  const selected = selectArtifact(manifest, {...target, apiDomain});
  if (!selected.artifact) return {ok: false, status: selected.status};

  const releaseName = String(manifest.releaseName ?? manifest.name ?? "").trim().slice(0, MAX_RELEASE_NAME_LENGTH);

  return {
    ok: true,
    updateAvailable: true,
    currentVersion: normalizeVersion(currentVersion),
    version,
    releaseName,
    changelog: normalizeChangelog(manifest.changelog ?? manifest.changelogs ?? manifest.releaseNotes),
    mandatory: manifest.mandatory === true,
    artifact: selected.artifact,
  };
}

module.exports = {
  UPDATE_PLATFORMS,
  UPDATE_ARCHITECTURES,
  ARTIFACT_EXTENSIONS,
  MAX_ARTIFACT_BYTES,
  normalizeVersion,
  parseVersion,
  compareVersions,
  isNewerVersion,
  resolveUpdateTarget,
  normalizeChangelog,
  validateAppUpdateManifest,
};
