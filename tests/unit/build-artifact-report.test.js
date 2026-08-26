"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DOWNLOAD_URL_PLACEHOLDER,
  formatArtifactReport,
  formatBytes,
  isInstallableArtifact,
  manifestArtifactEntries,
  parseBuilderArtifactArchitectures,
  resolveArtifactTarget,
  selectBuiltArtifacts,
} = require("../../scripts/build-artifact-report");

const SHA256 = "a".repeat(64);

// Real electron-builder output. The Windows line carries no arch in the file
// name even though it packaged arm64, which is the case name-based inference
// gets wrong.
const BUILDER_OUTPUT = [
  "  • electron-builder  version=24.13.3 os=25.5.0",
  "  • packaging       platform=win32 arch=arm64 electron=43.2.0 appOutDir=dist/win-arm64-unpacked",
  "  • building        target=nsis file=dist/MyTV Auto Test Setup 1.0.9.exe archs=arm64 oneClick=true perMachine=false",
  "  • building block map  blockMapFile=dist/MyTV Auto Test Setup 1.0.9.exe.blockmap",
  "  • building        target=macOS zip arch=arm64 file=dist/MyTV Auto Test-1.0.9-arm64-mac.zip",
].join("\n");

test("reports only installable artifacts, never blockmaps or builder metadata", () => {
  assert.equal(isInstallableArtifact("MyTV Auto Test Setup 1.1.0.exe"), true);
  assert.equal(isInstallableArtifact("MyTV Auto Test-1.1.0-arm64-mac.zip"), true);
  assert.equal(isInstallableArtifact("MyTV Auto Test-1.1.0-arm64.dmg"), true);
  assert.equal(isInstallableArtifact("MyTV Auto Test Setup 1.1.0.exe.blockmap"), false);
  assert.equal(isInstallableArtifact("builder-effective-config.yaml"), false);
  assert.equal(isInstallableArtifact("latest.yml"), false);
  assert.equal(isInstallableArtifact("win-unpacked"), false);
});

test("reads each artifact's arch out of electron-builder's own build lines", () => {
  const architectures = parseBuilderArtifactArchitectures(BUILDER_OUTPUT);
  assert.deepEqual([...architectures.entries()], [
    ["MyTV Auto Test Setup 1.0.9.exe", "arm64"],
    ["MyTV Auto Test-1.0.9-arm64-mac.zip", "arm64"],
  ]);
  assert.deepEqual([...parseBuilderArtifactArchitectures("").entries()], []);
  assert.deepEqual([...parseBuilderArtifactArchitectures(undefined).entries()], []);
});

test("treats a multi-arch artifact as universal", () => {
  const architectures = parseBuilderArtifactArchitectures(
    "  • building        target=macOS zip archs=x64,arm64 file=dist/MyTV Auto Test-1.1.0-mac.zip"
  );
  assert.equal(architectures.get("MyTV Auto Test-1.1.0-mac.zip"), "universal");
});

// The regression the first attempt shipped: an unsuffixed .exe from an arm64
// build would have been published as x64.
test("prefers the reported arch over an unsuffixed file name", () => {
  const builderArchitectures = parseBuilderArtifactArchitectures(BUILDER_OUTPUT);
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test Setup 1.0.9.exe", {builderArchitectures, hostArch: "arm64"}),
    {platform: "win32", arch: "arm64", archSource: "builder"}
  );
  const [entry] = manifestArtifactEntries(
    [{fileName: "MyTV Auto Test Setup 1.0.9.exe", size: 10, sha256: SHA256}],
    {builderArchitectures, hostArch: "arm64"}
  );
  assert.equal(entry.arch, "arm64");
});

test("falls back to the file name, then to the host, and labels each source", () => {
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test Setup 1.1.0-arm64.exe", {hostArch: "x64"}),
    {platform: "win32", arch: "arm64", archSource: "name"}
  );
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test-1.1.0-x64-mac.zip", {hostArch: "arm64"}),
    {platform: "darwin", arch: "x64", archSource: "name"}
  );
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test-1.1.0-arm64.dmg", {}),
    {platform: "darwin", arch: "arm64", archSource: "name"}
  );
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test Setup 1.1.0.exe", {hostArch: "arm64"}),
    {platform: "win32", arch: "arm64", archSource: "host"}
  );
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test Setup 1.1.0.exe", {}),
    {platform: "win32", arch: "", archSource: "unknown"}
  );
  assert.match(
    formatArtifactReport({version: "1.1.0", artifacts: [{fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 10, sha256: SHA256}], hostArch: "arm64"}),
    /arm64 \(assumed from this machine - verify it\)/u
  );
});

test("omits the arch for a universal build so one entry serves both", () => {
  assert.deepEqual(
    resolveArtifactTarget("MyTV Auto Test-1.1.0-universal-mac.zip", {}),
    {platform: "darwin", arch: "universal", archSource: "name"}
  );
  const [entry] = manifestArtifactEntries([{fileName: "MyTV Auto Test-1.1.0-universal-mac.zip", size: 10, sha256: SHA256}]);
  assert.equal("arch" in entry, false);
});

test("leaves an arch the app rejects out of the manifest entry and flags it", () => {
  const artifacts = [{fileName: "MyTV Auto Test Setup 1.1.0-ia32.exe", size: 10, sha256: SHA256}];
  const [entry] = manifestArtifactEntries(artifacts);
  assert.equal("arch" in entry, false);
  assert.match(formatArtifactReport({version: "1.1.0", artifacts}), /ia32 \(the app does not accept this arch\)/u);
});

test("does not report a version that a previous build already left in dist", () => {
  const before = [
    {fileName: "MyTV Auto Test Setup 1.0.9.exe", size: 100, modifiedAt: 1000},
    {fileName: "MyTV Auto Test-1.0.9-arm64-mac.zip", size: 200, modifiedAt: 1000},
  ];
  const after = [
    ...before,
    {fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 300, modifiedAt: 2000},
    {fileName: "MyTV Auto Test Setup 1.1.0.exe.blockmap", size: 5, modifiedAt: 2000},
  ];
  assert.deepEqual(
    selectBuiltArtifacts({before, after}).map((entry) => entry.fileName),
    ["MyTV Auto Test Setup 1.1.0.exe"]
  );
});

test("reports a rebuild that overwrote the same file name", () => {
  const before = [{fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 300, modifiedAt: 1000}];
  assert.deepEqual(
    selectBuiltArtifacts({before, after: [{fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 300, modifiedAt: 2000}]}).length,
    1
  );
  assert.deepEqual(
    selectBuiltArtifacts({before, after: [{fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 310, modifiedAt: 1000}]}).length,
    1
  );
  assert.deepEqual(selectBuiltArtifacts({before, after: before}), []);
});

test("orders artifacts by name and tolerates an empty or missing dist listing", () => {
  const after = [
    {fileName: "b-1.1.0-mac.zip", size: 1, modifiedAt: 2},
    {fileName: "a Setup 1.1.0.exe", size: 1, modifiedAt: 2},
  ];
  assert.deepEqual(
    selectBuiltArtifacts({after}).map((entry) => entry.fileName),
    ["a Setup 1.1.0.exe", "b-1.1.0-mac.zip"]
  );
  assert.deepEqual(selectBuiltArtifacts({}), []);
});

test("logs the size and digest of each artifact with a paste-ready manifest", () => {
  const report = formatArtifactReport({
    version: "1.1.0",
    artifacts: [
      {fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 187695104, sha256: SHA256},
      {fileName: "MyTV Auto Test-1.1.0-arm64-mac.zip", size: 164626432, sha256: "b".repeat(64)},
    ],
    hostArch: "x64",
  });

  assert.match(report, /Build artifacts for version 1\.1\.0:/u);
  assert.match(report, /MyTV Auto Test Setup 1\.1\.0\.exe/u);
  assert.match(report, /platform {2}win32/u);
  assert.match(report, /arch {6}arm64/u);
  assert.match(report, /size {6}187695104 bytes \(179\.0 MB\)/u);
  assert.match(report, new RegExp(`sha256 {4}${SHA256}`, "u"));

  const manifest = JSON.parse(report.slice(report.indexOf("{\n")));
  assert.deepEqual(manifest, {
    version: "1.1.0",
    artifacts: [
      {
        platform: "win32",
        arch: "x64",
        url: `${DOWNLOAD_URL_PLACEHOLDER}/MyTV Auto Test Setup 1.1.0.exe`,
        fileName: "MyTV Auto Test Setup 1.1.0.exe",
        size: 187695104,
        sha256: SHA256,
      },
      {
        platform: "darwin",
        arch: "arm64",
        url: `${DOWNLOAD_URL_PLACEHOLDER}/MyTV Auto Test-1.1.0-arm64-mac.zip`,
        fileName: "MyTV Auto Test-1.1.0-arm64-mac.zip",
        size: 164626432,
        sha256: "b".repeat(64),
      },
    ],
  });
});

test("says so plainly when a build produced no installable artifact", () => {
  const report = formatArtifactReport({version: "1.1.0", artifacts: []});
  assert.match(report, /No installable artifact was produced/u);
  assert.equal(report.includes(DOWNLOAD_URL_PLACEHOLDER), false);
  assert.match(formatArtifactReport({}), /No installable artifact was produced/u);
});

test("formats byte counts the way the update modal does", () => {
  assert.equal(formatBytes(187695104), "179.0 MB");
  assert.equal(formatBytes(2 * 1024 * 1024 * 1024), "2.00 GB");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes("nope"), "0 B");
});

test("emits manifest entries the running app accepts", () => {
  const {validateAppUpdateManifest} = require("../../app/app-update-manifest");
  const apiDomain = "http://172.16.240.254:30100";
  const artifacts = manifestArtifactEntries([
    {fileName: "MyTV Auto Test Setup 1.1.0.exe", size: 187695104, sha256: SHA256},
    {fileName: "MyTV Auto Test-1.1.0-arm64-mac.zip", size: 164626432, sha256: SHA256},
  ]).map((entry) => ({...entry, url: entry.url.replace(DOWNLOAD_URL_PLACEHOLDER, `${apiDomain}/files`)}));

  const windows = validateAppUpdateManifest({version: "1.1.0", artifacts}, {
    platform: "win32",
    arch: "x64",
    currentVersion: "1.0.9",
    apiDomain,
  });
  assert.equal(windows.updateAvailable, true);
  assert.equal(windows.artifact.fileName, "MyTV Auto Test Setup 1.1.0.exe");

  const mac = validateAppUpdateManifest({version: "1.1.0", artifacts}, {
    platform: "darwin",
    arch: "arm64",
    currentVersion: "1.0.9",
    apiDomain,
  });
  assert.equal(mac.artifact.fileName, "MyTV Auto Test-1.1.0-arm64-mac.zip");
});
