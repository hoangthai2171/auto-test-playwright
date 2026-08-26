"use strict";

// The update manifest served at /api/v1/app-updates/latest has to carry the
// exact size and SHA-256 of every published installer, and the app refuses an
// artifact whose digest does not match. Reporting both right after the build
// keeps the manifest from being written by hand off a separate checksum run.

const INSTALLABLE_EXTENSIONS = new Set([".exe", ".zip", ".dmg"]);
const DOWNLOAD_URL_PLACEHOLDER = "REPLACE_WITH_DOWNLOAD_BASE_URL";
const MANIFEST_ARCHITECTURES = new Set(["x64", "arm64"]);

function fileExtension(fileName) {
  const index = String(fileName ?? "").lastIndexOf(".");
  return index <= 0 ? "" : fileName.slice(index).toLowerCase();
}

function isInstallableArtifact(fileName) {
  return INSTALLABLE_EXTENSIONS.has(fileExtension(fileName));
}

function artifactPlatform(fileName) {
  return fileExtension(fileName) === ".exe" ? "win32" : "darwin";
}

// electron-builder leaves the architecture out of an artifact name whenever it
// builds a single architecture, so an unsuffixed `Setup 1.0.9.exe` is arm64 on
// an Apple Silicon host and x64 elsewhere. Guessing from the name would publish
// an arm64 installer as x64, so the arch is read from electron-builder's own
// `• building ... file=… arch(s)=…` lines instead.
function parseBuilderArtifactArchitectures(output) {
  const architectures = new Map();
  String(output ?? "").split(/\r?\n/u).forEach((line) => {
    if (!/•\s*building\s/u.test(line)) return;
    const fields = new Map();
    line.split(/\s(?=[A-Za-z][A-Za-z0-9]*=)/u).forEach((chunk) => {
      const separator = chunk.indexOf("=");
      if (separator <= 0) return;
      fields.set(chunk.slice(0, separator).trim(), chunk.slice(separator + 1).trim());
    });
    const file = fields.get("file");
    const arch = fields.get("arch") ?? fields.get("archs");
    if (!file || !arch) return;
    const values = arch.split(/[,\s]+/u).filter(Boolean);
    if (!values.length) return;
    architectures.set(file.split(/[\\/]/u).pop(), values.length === 1 ? values[0] : "universal");
  });
  return architectures;
}

function architectureFromName(fileName) {
  const name = String(fileName ?? "");
  if (/[-_]universal(?=[-_.])/iu.test(name)) return "universal";
  if (/[-_]arm64(?=[-_.])/iu.test(name)) return "arm64";
  if (/[-_](?:x64|x86_64|amd64)(?=[-_.])/iu.test(name)) return "x64";
  if (/[-_]ia32(?=[-_.])/iu.test(name)) return "ia32";
  return "";
}

// The architecture electron-builder reported is authoritative. The file name is
// the next best source. Falling back to the host architecture matches what
// electron-builder defaults to, and is labelled as assumed so it gets reviewed.
function resolveArtifactTarget(fileName, {builderArchitectures, hostArch} = {}) {
  const platform = artifactPlatform(fileName);
  const reported = builderArchitectures?.get?.(fileName);
  if (reported) return {platform, arch: reported, archSource: "builder"};
  const named = architectureFromName(fileName);
  if (named) return {platform, arch: named, archSource: "name"};
  const host = String(hostArch ?? "").trim();
  if (host) return {platform, arch: host, archSource: "host"};
  return {platform, arch: "", archSource: "unknown"};
}

// A build directory keeps older releases, so only files this run created or
// rewrote are reported. Comparing size and mtime catches a rebuild of the same
// version, which reuses the file name.
function selectBuiltArtifacts({before = [], after = []} = {}) {
  const previous = new Map(before.map((entry) => [entry.fileName, entry]));
  return after
    .filter((entry) => isInstallableArtifact(entry.fileName))
    .filter((entry) => {
      const earlier = previous.get(entry.fileName);
      return !earlier || earlier.size !== entry.size || earlier.modifiedAt !== entry.modifiedAt;
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function formatBytes(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(2)} GB` : `${megabytes.toFixed(1)} MB`;
}

// A universal build deliberately carries no arch so one entry serves both, and
// an architecture the app does not accept (ia32) is left out rather than
// published as a wildcard that every machine would download.
function manifestArtifactEntries(artifacts, options = {}) {
  return artifacts.map((artifact) => {
    const {platform, arch} = resolveArtifactTarget(artifact.fileName, options);
    return {
      platform,
      ...(MANIFEST_ARCHITECTURES.has(arch) ? {arch} : {}),
      url: `${DOWNLOAD_URL_PLACEHOLDER}/${artifact.fileName}`,
      fileName: artifact.fileName,
      size: artifact.size,
      sha256: artifact.sha256,
    };
  });
}

function architectureLabel({arch, archSource}) {
  if (arch === "universal") return "universal (no arch in the manifest entry)";
  if (!arch) return "could not be determined - set it manually";
  if (!MANIFEST_ARCHITECTURES.has(arch)) return `${arch} (the app does not accept this arch)`;
  if (archSource === "host") return `${arch} (assumed from this machine - verify it)`;
  if (archSource === "name") return `${arch} (from the file name)`;
  return arch;
}

function formatArtifactReport({version, artifacts = [], builderArchitectures, hostArch} = {}) {
  const lines = [];
  if (!artifacts.length) {
    lines.push("No installable artifact was produced by this build.");
    lines.push("Nothing to publish: SHA-256 values are reported only for a new .exe, .zip, or .dmg.");
    return lines.join("\n");
  }

  const options = {builderArchitectures, hostArch};
  lines.push(`Build artifacts for version ${version}:`);
  artifacts.forEach((artifact) => {
    const target = resolveArtifactTarget(artifact.fileName, options);
    lines.push("");
    lines.push(`  ${artifact.fileName}`);
    lines.push(`    platform  ${target.platform}`);
    lines.push(`    arch      ${architectureLabel(target)}`);
    lines.push(`    size      ${artifact.size} bytes (${formatBytes(artifact.size)})`);
    lines.push(`    sha256    ${artifact.sha256}`);
  });

  lines.push("");
  lines.push("Manifest entries for GET {API_DOMAIN}/api/v1/app-updates/latest");
  lines.push(`(replace ${DOWNLOAD_URL_PLACEHOLDER} with a download base URL on the API domain's host):`);
  lines.push("");
  lines.push(JSON.stringify({version, artifacts: manifestArtifactEntries(artifacts, options)}, null, 2));
  return lines.join("\n");
}

module.exports = {
  INSTALLABLE_EXTENSIONS,
  DOWNLOAD_URL_PLACEHOLDER,
  MANIFEST_ARCHITECTURES,
  isInstallableArtifact,
  parseBuilderArtifactArchitectures,
  resolveArtifactTarget,
  selectBuiltArtifacts,
  manifestArtifactEntries,
  formatBytes,
  formatArtifactReport,
};
