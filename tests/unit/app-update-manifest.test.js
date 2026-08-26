"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  compareVersions,
  isNewerVersion,
  normalizeChangelog,
  resolveUpdateTarget,
  validateAppUpdateManifest,
} = require("../../app/app-update-manifest");

const API_DOMAIN = "http://172.16.240.254:30100";
const SHA256 = "a".repeat(64);

function manifest(overrides = {}) {
  return {
    version: "1.1.0",
    releaseName: "MyTV Auto Test 1.1.0",
    changelog: ["- Thêm mục Check for updates", "* Sửa lỗi player"],
    artifacts: [
      {platform: "win32", arch: "x64", url: `${API_DOMAIN}/files/MyTV Auto Test Setup 1.1.0.exe`, size: 1024, sha256: SHA256},
      {platform: "darwin", arch: "arm64", url: `${API_DOMAIN}/files/MyTV Auto Test-1.1.0-arm64-mac.zip`, size: 2048, sha256: SHA256},
    ],
    ...overrides,
  };
}

test("orders numeric segments and sorts a prerelease below its release", () => {
  assert.equal(compareVersions("1.0.10", "1.0.9"), 1);
  assert.equal(compareVersions("1.0.9", "1.0.9"), 0);
  assert.equal(compareVersions("v1.1.0", "1.1.0"), 0);
  assert.equal(compareVersions("1.1.0-rc.1", "1.1.0"), -1);
  assert.equal(compareVersions("1.1", "1.1.0"), 0);
  assert.equal(compareVersions("not-a-version", "1.0.0"), null);
  assert.equal(isNewerVersion("1.2.0", "1.10.0"), false);
  assert.equal(isNewerVersion("", "1.0.0"), false);
});

test("accepts only the supported desktop targets", () => {
  assert.deepEqual(resolveUpdateTarget({platform: "darwin", arch: "arm64"}), {platform: "darwin", arch: "arm64"});
  assert.equal(resolveUpdateTarget({platform: "linux", arch: "x64"}), null);
  assert.equal(resolveUpdateTarget({platform: "win32", arch: "ia32"}), null);
});

test("selects the artifact for this platform and strips list markers from the changelog", () => {
  const result = validateAppUpdateManifest(manifest(), {
    platform: "win32",
    arch: "x64",
    currentVersion: "1.0.9",
    apiDomain: API_DOMAIN,
  });
  assert.equal(result.ok, true);
  assert.equal(result.updateAvailable, true);
  assert.equal(result.version, "1.1.0");
  assert.equal(result.mandatory, false);
  assert.deepEqual(result.changelog, ["Thêm mục Check for updates", "Sửa lỗi player"]);
  assert.deepEqual(result.artifact, {
    platform: "win32",
    arch: "x64",
    url: `${API_DOMAIN}/files/MyTV%20Auto%20Test%20Setup%201.1.0.exe`,
    fileName: "MyTV Auto Test Setup 1.1.0.exe",
    size: 1024,
    sha256: SHA256,
  });
});

test("reports no update when the served version is not newer", () => {
  const result = validateAppUpdateManifest(manifest({version: "1.0.9"}), {
    platform: "win32",
    arch: "x64",
    currentVersion: "1.0.9",
    apiDomain: API_DOMAIN,
  });
  assert.deepEqual(result, {ok: true, updateAvailable: false, currentVersion: "1.0.9", version: "1.0.9"});
});

test("unwraps a data envelope and derives the file name from the URL", () => {
  const result = validateAppUpdateManifest({data: manifest()}, {
    platform: "darwin",
    arch: "arm64",
    currentVersion: "1.0.9",
    apiDomain: API_DOMAIN,
  });
  assert.equal(result.updateAvailable, true);
  assert.equal(result.artifact.fileName, "MyTV Auto Test-1.1.0-arm64-mac.zip");
});

test("rejects an artifact hosted outside the configured API domain", () => {
  const result = validateAppUpdateManifest(
    manifest({artifacts: [{platform: "win32", arch: "x64", url: "http://attacker.example/Setup.exe", size: 1024, sha256: SHA256}]}),
    {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(result, {ok: false, status: "UPDATE_ARTIFACT_UNTRUSTED"});
});

test("rejects a non-http artifact scheme", () => {
  const result = validateAppUpdateManifest(
    manifest({artifacts: [{platform: "win32", arch: "x64", url: "file:///tmp/Setup.exe", size: 1024, sha256: SHA256}]}),
    {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(result, {ok: false, status: "UPDATE_ARTIFACT_UNTRUSTED"});
});

test("refuses an artifact that cannot be verified or sized", () => {
  const withoutDigest = validateAppUpdateManifest(
    manifest({artifacts: [{platform: "win32", url: `${API_DOMAIN}/Setup.exe`, size: 1024}]}),
    {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(withoutDigest, {ok: false, status: "UPDATE_ARTIFACT_UNVERIFIABLE"});

  const withoutSize = validateAppUpdateManifest(
    manifest({artifacts: [{platform: "win32", url: `${API_DOMAIN}/Setup.exe`, sha256: SHA256}]}),
    {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(withoutSize, {ok: false, status: "UPDATE_ARTIFACT_UNAVAILABLE"});
});

test("refuses an artifact whose extension does not match the platform", () => {
  const result = validateAppUpdateManifest(
    manifest({artifacts: [{platform: "win32", arch: "x64", url: `${API_DOMAIN}/Setup.zip`, size: 1024, sha256: SHA256}]}),
    {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(result, {ok: false, status: "UPDATE_ARTIFACT_UNAVAILABLE"});
});

test("reports a missing platform build separately from an invalid manifest", () => {
  assert.deepEqual(
    validateAppUpdateManifest(manifest({artifacts: []}), {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}),
    {ok: false, status: "UPDATE_ARTIFACT_UNAVAILABLE"}
  );
  assert.deepEqual(
    validateAppUpdateManifest({version: "nope"}, {platform: "win32", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}),
    {ok: false, status: "UPDATE_MANIFEST_INVALID"}
  );
  assert.deepEqual(
    validateAppUpdateManifest(manifest(), {platform: "linux", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}),
    {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"}
  );
});

test("accepts a single artifact object and a newline changelog", () => {
  const result = validateAppUpdateManifest(
    {
      version: "1.1.0",
      changelog: "- one\n\n- two\n",
      mandatory: true,
      artifact: {platform: "darwin", url: `${API_DOMAIN}/app.zip`, size: 10, sha256: SHA256},
    },
    {platform: "darwin", arch: "x64", currentVersion: "1.0.9", apiDomain: API_DOMAIN}
  );
  assert.deepEqual(result.changelog, ["one", "two"]);
  assert.equal(result.mandatory, true);
  assert.equal(result.artifact.arch, "x64");
});

test("caps and trims changelog entries", () => {
  const entries = normalizeChangelog(Array.from({length: 80}, (_value, index) => `entry ${index}`));
  assert.equal(entries.length, 60);
  assert.equal(normalizeChangelog(["x".repeat(400)])[0].length, 301);
  assert.deepEqual(normalizeChangelog(null), []);
});
