"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {Readable} = require("node:stream");
const {createHash} = require("node:crypto");
const {createAppUpdateService} = require("../../app/app-update-service");

const API_DOMAIN = "http://172.16.240.254:30100";
const PAYLOAD = Buffer.from("installer-bytes");
const DIGEST = createHash("sha256").update(PAYLOAD).digest("hex");

function updateManifest(overrides = {}) {
  return {
    version: "1.1.0",
    releaseName: "MyTV Auto Test 1.1.0",
    changelog: ["Thêm mục Check for updates"],
    artifact: {
      platform: "win32",
      arch: "x64",
      url: `${API_DOMAIN}/files/Setup.exe`,
      size: PAYLOAD.length,
      sha256: DIGEST,
      ...overrides,
    },
  };
}

function fakeFs() {
  const files = new Map();
  const removed = [];
  return {
    files,
    removed,
    async rm(target) { removed.push(target); },
    async mkdir() {},
    async open(filePath) {
      const chunks = [];
      files.set(filePath, chunks);
      return {
        async write(chunk) { chunks.push(Buffer.from(chunk)); },
        async close() {},
      };
    },
  };
}

function fileReader(fs) {
  return (filePath) => Readable.from(fs.files.get(filePath) || []);
}

function serviceWith({manifestResponse, body = PAYLOAD, install, fetchOk = true, fs = fakeFs()} = {}) {
  const requests = [];
  const installs = [];
  const service = createAppUpdateService({
    currentVersion: "1.0.9",
    platform: "win32",
    arch: "x64",
    downloadRoot: "/userData/app-updates",
    fs,
    createReadStream: fileReader(fs),
    fetchManifest: async (request) => {
      requests.push(request);
      return manifestResponse ?? {ok: true, manifest: updateManifest()};
    },
    fetch: async (url, options) => {
      requests.push({url, options});
      if (!fetchOk) return {ok: false};
      return {ok: true, body: Readable.from([body])};
    },
    installer: {
      async install(request) {
        installs.push(request);
        return install ?? {ok: true, status: "UPDATE_INSTALL_STARTED"};
      },
    },
  });
  return {service, requests, installs, fs};
}

test("requires an API domain, a manifest fetcher and an installer", () => {
  assert.throws(() => createAppUpdateService({}), /App update dependencies are required/u);
  assert.throws(
    () => createAppUpdateService({fetchManifest: async () => ({}), fetch: async () => ({})}),
    /download root and installer are required/u
  );
});

test("asks the server for the plain manifest and reports the newer version", async () => {
  const {service, requests} = serviceWith();
  const result = await service.check({apiDomain: API_DOMAIN, authorization: "token", timeoutMs: 5000});
  assert.deepEqual(requests[0], {apiDomain: API_DOMAIN, authorization: "token", timeoutMs: 5000});
  assert.equal(result.updateAvailable, true);
  assert.equal(result.version, "1.1.0");
  assert.equal(result.downloadSize, PAYLOAD.length);
  assert.equal(result.fileName, "Setup.exe");
  assert.equal(result.artifact, undefined);
});

test("distinguishes a timeout from a failed check and refuses an empty domain", async () => {
  const timedOut = serviceWith({manifestResponse: {ok: false, timeout: true}});
  assert.deepEqual(await timedOut.service.check({apiDomain: API_DOMAIN}), {ok: false, status: "UPDATE_CHECK_TIMEOUT"});

  const failed = serviceWith({manifestResponse: {ok: false}});
  assert.deepEqual(await failed.service.check({apiDomain: API_DOMAIN}), {ok: false, status: "UPDATE_CHECK_FAILED"});

  const {service} = serviceWith();
  assert.deepEqual(await service.check({apiDomain: "  "}), {ok: false, status: "UPDATE_CHECK_UNAVAILABLE"});
});

test("reports an unsupported platform without contacting the server", async () => {
  let called = false;
  const service = createAppUpdateService({
    currentVersion: "1.0.9",
    platform: "linux",
    arch: "x64",
    downloadRoot: "/userData/app-updates",
    fetchManifest: async () => { called = true; return {ok: true, manifest: updateManifest()}; },
    fetch: async () => ({ok: true}),
    installer: {install: async () => ({ok: true})},
  });
  assert.deepEqual(await service.check({apiDomain: API_DOMAIN}), {ok: false, status: "UPDATE_PLATFORM_UNSUPPORTED"});
  assert.equal(called, false);
});

test("downloads, verifies and hands the staged archive to the installer", async () => {
  const {service, installs, fs} = serviceWith();
  await service.check({apiDomain: API_DOMAIN, authorization: "token"});
  const events = [];
  const result = await service.install({version: "1.1.0", onProgress: (event) => events.push(event)});

  assert.deepEqual(result, {ok: true, status: "UPDATE_INSTALL_STARTED"});
  assert.deepEqual(installs, [{archivePath: `/userData/app-updates/${DIGEST}/Setup.exe`, version: "1.1.0"}]);
  assert.deepEqual(fs.files.get(`/userData/app-updates/${DIGEST}/Setup.exe`), [PAYLOAD]);
  assert.deepEqual(events.map((event) => event.code), ["downloading", "downloading", "verifying", "installing", "complete"]);
  assert.equal(events.at(1).percent, 100);
});

test("sends the service token with the artifact request and forbids redirects", async () => {
  const {service, requests} = serviceWith();
  await service.check({apiDomain: API_DOMAIN, authorization: "token"});
  await service.install({version: "1.1.0"});
  const download = requests.find((request) => request.url === `${API_DOMAIN}/files/Setup.exe`);
  assert.equal(download.options.redirect, "error");
  assert.equal(download.options.headers["X-FlowTest-Service-Token"], "token");
});

test("refuses to install a version other than the one just checked", async () => {
  const {service, installs} = serviceWith();
  assert.deepEqual(await service.install({version: "1.1.0"}), {ok: false, status: "UPDATE_NOT_CHECKED"});
  await service.check({apiDomain: API_DOMAIN});
  assert.deepEqual(await service.install({version: "9.9.9"}), {ok: false, status: "UPDATE_VERSION_MISMATCH"});
  assert.deepEqual(installs, []);
});

test("clears the pending update after a check that finds nothing and after cancel", async () => {
  const upToDate = serviceWith({manifestResponse: {ok: true, manifest: {...updateManifest(), version: "1.0.9"}}});
  assert.deepEqual(await upToDate.service.check({apiDomain: API_DOMAIN}), {
    ok: true,
    updateAvailable: false,
    currentVersion: "1.0.9",
    version: "1.0.9",
  });
  assert.deepEqual(await upToDate.service.install({version: "1.0.9"}), {ok: false, status: "UPDATE_NOT_CHECKED"});

  const {service} = serviceWith();
  await service.check({apiDomain: API_DOMAIN});
  service.cancel();
  assert.deepEqual(await service.install({version: "1.1.0"}), {ok: false, status: "UPDATE_NOT_CHECKED"});
});

test("never installs an archive whose digest or length does not match the manifest", async () => {
  const wrongBytes = serviceWith({body: Buffer.from("tampered-bytes!")});
  await wrongBytes.service.check({apiDomain: API_DOMAIN});
  assert.deepEqual(await wrongBytes.service.install({version: "1.1.0"}), {ok: false, status: "UPDATE_VERIFICATION_FAILED"});
  assert.deepEqual(wrongBytes.installs, []);

  const tooLong = serviceWith({body: Buffer.concat([PAYLOAD, Buffer.from("extra")])});
  await tooLong.service.check({apiDomain: API_DOMAIN});
  assert.deepEqual(await tooLong.service.install({version: "1.1.0"}), {ok: false, status: "UPDATE_VERIFICATION_FAILED"});
  assert.deepEqual(tooLong.installs, []);

  const tooShort = serviceWith({body: PAYLOAD.subarray(0, 4)});
  await tooShort.service.check({apiDomain: API_DOMAIN});
  assert.deepEqual(await tooShort.service.install({version: "1.1.0"}), {ok: false, status: "UPDATE_VERIFICATION_FAILED"});
  assert.deepEqual(tooShort.installs, []);
});

test("reports a failed download and a failed install through progress", async () => {
  const download = serviceWith({fetchOk: false});
  await download.service.check({apiDomain: API_DOMAIN});
  const downloadEvents = [];
  assert.deepEqual(
    await download.service.install({version: "1.1.0", onProgress: (event) => downloadEvents.push(event)}),
    {ok: false, status: "UPDATE_DOWNLOAD_FAILED"}
  );
  assert.deepEqual(downloadEvents.at(-1), {code: "failed", status: "UPDATE_DOWNLOAD_FAILED"});

  const install = serviceWith({install: {ok: false, status: "UPDATE_INSTALL_UNSUPPORTED", archivePath: "/staged/Setup.exe"}});
  await install.service.check({apiDomain: API_DOMAIN});
  const installEvents = [];
  const result = await install.service.install({version: "1.1.0", onProgress: (event) => installEvents.push(event)});
  assert.equal(result.status, "UPDATE_INSTALL_UNSUPPORTED");
  assert.equal(result.archivePath, "/staged/Setup.exe");
  assert.deepEqual(installEvents.at(-1), {code: "failed", status: "UPDATE_INSTALL_UNSUPPORTED"});
});

test("falls back to a buffered body when the response is not streamable", async () => {
  const fs = fakeFs();
  const service = createAppUpdateService({
    currentVersion: "1.0.9",
    platform: "win32",
    arch: "x64",
    downloadRoot: "/userData/app-updates",
    fs,
    createReadStream: fileReader(fs),
    fetchManifest: async () => ({ok: true, manifest: updateManifest()}),
    fetch: async () => ({ok: true, arrayBuffer: async () => PAYLOAD}),
    installer: {install: async () => ({ok: true, status: "UPDATE_INSTALL_STARTED"})},
  });
  await service.check({apiDomain: API_DOMAIN});
  assert.deepEqual(await service.install({version: "1.1.0"}), {ok: true, status: "UPDATE_INSTALL_STARTED"});
});

test("replaces a stale staging directory before writing the archive", async () => {
  const {service, fs} = serviceWith();
  await service.check({apiDomain: API_DOMAIN});
  await service.install({version: "1.1.0"});
  assert.deepEqual(fs.removed, [`/userData/app-updates/${DIGEST}`]);
});

// The endpoint is parameterless now, so one response has to serve every build
// and each running app must pick its own artifact out of it.
test("picks this build's artifact out of a manifest listing every platform", async () => {
  const shared = {
    version: "1.1.0",
    changelog: ["Thêm mục Check for updates"],
    artifacts: [
      {platform: "win32", arch: "x64", url: `${API_DOMAIN}/files/Setup.exe`, size: PAYLOAD.length, sha256: DIGEST},
      {platform: "darwin", arch: "x64", url: `${API_DOMAIN}/files/app-x64.zip`, size: PAYLOAD.length, sha256: DIGEST},
      {platform: "darwin", arch: "arm64", url: `${API_DOMAIN}/files/app-arm64.zip`, size: PAYLOAD.length, sha256: DIGEST},
    ],
  };

  const downloads = [];
  const build = (platform, arch) => {
    const fs = fakeFs();
    return createAppUpdateService({
      currentVersion: "1.0.9",
      platform,
      arch,
      downloadRoot: "/userData/app-updates",
      fs,
      createReadStream: fileReader(fs),
      fetchManifest: async () => ({ok: true, manifest: shared}),
      fetch: async (url) => { downloads.push(url); return {ok: true, body: Readable.from([PAYLOAD])}; },
      installer: {install: async () => ({ok: true, status: "UPDATE_INSTALL_STARTED"})},
    });
  };

  for (const [platform, arch, fileName] of [
    ["win32", "x64", "Setup.exe"],
    ["darwin", "arm64", "app-arm64.zip"],
    ["darwin", "x64", "app-x64.zip"],
  ]) {
    const service = build(platform, arch);
    const check = await service.check({apiDomain: API_DOMAIN});
    assert.equal(check.version, "1.1.0");
    assert.equal(check.fileName, fileName, `${platform}/${arch}`);
    assert.deepEqual(await service.install({version: "1.1.0"}), {ok: true, status: "UPDATE_INSTALL_STARTED"});
  }

  assert.deepEqual(downloads, [
    `${API_DOMAIN}/files/Setup.exe`,
    `${API_DOMAIN}/files/app-arm64.zip`,
    `${API_DOMAIN}/files/app-x64.zip`,
  ]);
});
