const test = require("node:test");
const assert = require("node:assert/strict");

const {registerTvDeviceIpc} = require("../../app/tv-device-ipc");
const {redactSensitiveText} = require("../../app/credential-redaction");

const profile = {
  id: "lab-lg",
  label: "Lab LG",
  platform: "webos",
  appId: "com.mytvb2c.app",
  backendEnvironment: "production",
  model: "55QNED80SRA",
  lastKnownHost: "192.0.2.1",
};
const {lastKnownHost: _lastKnownHost, ...publicProfile} = profile;

function createHarness({profiles = [profile], candidateResult, connectionChecker, toolchain, toolchainConfig, createTargetRegistration, lgToolchainDetector, lgToolchainInstaller, lgCliArchiveImporter, lgCliPlatform, dialog, shell, resolveLgCompatibilityProfile, compatibilityCatalog, redact = (value) => String(value).replaceAll("192.0.2.1", "[host]")} = {}) {
  const handlers = new Map();
  const calls = [];
  const registry = {
    async list() { return profiles; },
    async save(nextProfile) {
      calls.push(["save", nextProfile]);
      return nextProfile;
    },
  };
  const deviceProfiles = {
    async listPublicProfiles() {
      calls.push(["listPublicProfiles"]);
      return profiles.map(({lastKnownHost, ...device}) => ({...device, hasConnection: Boolean(lastKnownHost), hasPassphrase: false}));
    },
    async validateAndSave(candidate) {
      calls.push(["validateAndSave", candidate]);
      return candidateResult || {ok: false, status: "VALIDATION_UNAVAILABLE"};
    },
  };
  registerTvDeviceIpc({
    ipcMain: {handle(channel, handler) { handlers.set(channel, handler); }},
    registry,
    deviceProfiles,
    connectionChecker,
    toolchain,
    toolchainConfig,
    createTargetRegistration,
    lgToolchainDetector,
    lgToolchainInstaller,
    lgCliArchiveImporter,
    lgCliPlatform,
    resolveLgCompatibilityProfile,
    compatibilityCatalog,
    dialog,
    shell,
    redact,
  });
  return {handlers, calls};
}

test("refreshes only through narrow catalog IPC and returns a redacted status", async () => {
  const requests = [];
  const {handlers} = createHarness({
    compatibilityCatalog: {
      async status() { return {ok: true, state: "available", source: "bundled", refreshedAt: null, profileCount: 1}; },
      async refresh(request) {
        requests.push(request);
        return {ok: true, state: "available", source: "cached", refreshedAt: "2026-07-30T00:00:00.000Z", profileCount: 1};
      },
    },
  });

  const result = await handlers.get("refresh-lg-compatibility-catalog")(undefined, {
    apiDomain: "https://api.example.test",
    authorization: "Bearer private",
    timeoutMs: 500,
  });

  assert.deepEqual(result, {ok: true, state: "available", source: "cached", refreshedAt: "2026-07-30T00:00:00.000Z", profileCount: 1});
  assert.deepEqual(requests, [{apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500}]);
  assert.doesNotMatch(JSON.stringify(result), /private|https?:/i);
});

test("lists redacted LG profiles only through the public profile service", async () => {
  const {handlers, calls} = createHarness();

  const result = await handlers.get("list-tv-devices")();

  assert.deepEqual(result, {
    ok: true,
    devices: [{...publicProfile, hasConnection: true, hasPassphrase: false}],
  });
  assert.deepEqual(calls, [["listPublicProfiles"]]);
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|lastKnownHost/);
});

test("validates and saves only a redacted candidate through the profile service", async () => {
  const {handlers, calls} = createHarness();
  const candidate = {label: "Living room", host: "candidate-host", passphrase: "candidate-passphrase"};

  const result = await handlers.get("validate-and-save-tv-device")(undefined, candidate);

  assert.deepEqual(calls, [["validateAndSave", candidate]]);
  assert.deepEqual(result, {ok: false, status: "VALIDATION_UNAVAILABLE"});
  assert.doesNotMatch(JSON.stringify(result), /candidate-host|candidate-passphrase/);
});

test("never registers a direct saved-profile validation handler", () => {
  const {handlers} = createHarness();

  assert.equal(handlers.has("validate-tv-device"), false);
});

test("checks only the selected saved device through a redacted connection-check handler", async () => {
  const checks = [];
  const {handlers} = createHarness({
    connectionChecker: {
      async check(request) {
        checks.push(request);
        return {ok: true, status: "CONNECTED", host: "192.0.2.1", stdout: "private"};
      },
    },
  });

  const result = await handlers.get("check-tv-device-connection")(undefined, {
    deviceId: "lab-lg",
    host: "candidate-host",
    passphrase: "candidate-passphrase",
  });

  assert.deepEqual(checks, [{deviceId: "lab-lg"}]);
  assert.deepEqual(result, {ok: true, status: "CONNECTED"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|candidate-host|candidate-passphrase|private/);
});

test("redacts a successful candidate result even when the diagnostic redactor does not recognize the input", async () => {
  const candidate = {label: "Living room", host: "candidate-host", passphrase: "candidate-passphrase"};
  const {handlers} = createHarness({
    redact: redactSensitiveText,
    candidateResult: {ok: true, device: {...publicProfile, hasConnection: true, hasPassphrase: true}},
  });

  const result = await handlers.get("validate-and-save-tv-device")(undefined, candidate);

  assert.deepEqual(result, {ok: true, device: {...publicProfile, hasConnection: true, hasPassphrase: true}});
  assert.doesNotMatch(JSON.stringify(result), /candidate-host|candidate-passphrase|192\.0\.2\.1/);
});

test("reports local LG toolchain status without a profile or discovery operation", async () => {
  const {handlers, calls} = createHarness({
    toolchain: {
      inspect() {
        return {
          ok: true,
          platform: "webos",
          tools: [{id: "appium", label: "Appium", status: "ready", version: "2.19.0"}],
        };
      },
    },
  });

  const result = await handlers.get("inspect-tv-toolchain")();

  assert.deepEqual(result, {
    ok: true,
    platform: "webos",
    tools: [{id: "appium", label: "Appium", status: "ready", version: "2.19.0"}],
  });
  assert.deepEqual(calls, []);
});

test("plans a redacted managed LG setup review without invoking inspection, picker, registration, validation, or a TV operation", async () => {
  const calls = [];
  const {handlers, calls: harnessCalls} = createHarness({
    toolchain: {inspect() { throw new Error("must not inspect"); }},
    lgToolchainDetector: {
      async inspect() {
        calls.push("inspect");
        return {
          source: "managed",
          state: "missing",
          managedRoot: "/user-data/lg-toolchain",
          url: "https://example.invalid/archive",
          components: [
            {id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0", path: "/user-data/lg-toolchain/node"},
            {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4", archivePath: "/Downloads/cli.tgz"},
          ],
        };
      },
    },
    dialog: {showOpenDialog() { throw new Error("must not open picker"); }},
    shell: {openExternal() { throw new Error("must not open browser"); }},
    lgCliArchiveImporter: {importArchive() { throw new Error("must not import"); }},
  });

  const result = await handlers.get("plan-lg-toolchain-setup")();

  assert.deepEqual(result, {
    ok: true,
    source: "managed",
    state: "missing",
    components: [
      {id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"},
      {id: "webos-cli", label: "webOS CLI", status: "missing", version: "1.12.4"},
    ],
  });
  assert.deepEqual(calls, ["inspect"]);
  assert.deepEqual(harnessCalls, []);
  assert.doesNotMatch(JSON.stringify(result), /user-data|Downloads|https?:\/\//i);
});

test("gets a redacted managed LG status without planning setup or invoking a TV operation", async () => {
  const calls = [];
  const {handlers, calls: harnessCalls} = createHarness({
    toolchain: {inspect() { throw new Error("must not inspect"); }},
    lgToolchainDetector: {
      async inspect() {
        calls.push("inspect");
        return {
          source: "managed",
          state: "ready",
          managedRoot: "/user-data/lg-toolchain",
          components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0", path: "/user-data/lg-toolchain/node"}],
        };
      },
    },
  });

  const result = await handlers.get("get-lg-toolchain-status")();

  assert.deepEqual(result, {
    ok: true,
    source: "managed",
    state: "ready",
    components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0"}],
  });
  assert.deepEqual(calls, ["inspect"]);
  assert.deepEqual(harnessCalls, []);
  assert.doesNotMatch(JSON.stringify(result), /user-data|https?:\/\//i);
});

test("requires explicit confirmation before managed LG installation and redacts its result", async () => {
  const calls = [];
  const {handlers, calls: harnessCalls} = createHarness({
    toolchain: {inspect() { throw new Error("must not inspect"); }},
    lgToolchainInstaller: {
      async install(request) {
        calls.push(request);
        return {
          ok: true,
          state: "installable",
          managedRoot: "/user-data/lg-toolchain",
          url: "https://example.invalid/archive",
          components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0", path: "/user-data/lg-toolchain/node"}],
        };
      },
    },
  });

  assert.deepEqual(await handlers.get("install-lg-toolchain")(undefined, {confirmed: false}), {
    ok: false,
    status: "INSTALL_CONFIRMATION_REQUIRED",
  });
  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: true});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].confirmed, true);
  assert.equal(typeof calls[0].onProgress, "function");
  assert.deepEqual(harnessCalls, []);
  assert.deepEqual(result, {
    ok: true,
    state: "installable",
    components: [{id: "node", label: "Node.js and npm", status: "ready", version: "24.18.0"}],
  });
  assert.doesNotMatch(JSON.stringify(result), /user-data|https?:\/\//i);
});

test("passes a selected catalog ChromeDriver artifact only through main-process installation", async () => {
  const calls = [];
  const artifact = {
    version: "120.0",
    url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/mac-arm64/chromedriver-mac-arm64.zip",
    archiveName: "chromedriver-mac-arm64.zip",
    sha256: "a".repeat(64),
  };
  const {handlers} = createHarness({
    resolveLgCompatibilityProfile: async ({deviceId}) => {
      calls.push(["profile", deviceId]);
      return {status: "verified", artifact};
    },
    lgToolchainInstaller: {
      async install(request) {
        calls.push(["install", request]);
        return {ok: true, state: "installable", components: []};
      },
    },
  });

  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: true, deviceId: "lab-lg"});

  assert.deepEqual(result, {ok: true, state: "installable", components: []});
  assert.deepEqual(calls.map(([name]) => name), ["profile", "install"]);
  assert.equal(calls[1][1].confirmed, true);
  assert.deepEqual(calls[1][1].chromedriverArtifact, artifact);
  assert.equal(typeof calls[1][1].onProgress, "function");
});

test("blocks ChromeDriver installation without invoking the installer for an unverified profile", async () => {
  const calls = [];
  const {handlers} = createHarness({
    resolveLgCompatibilityProfile: async () => ({status: "COMPATIBILITY_PROFILE_UNVERIFIED"}),
    lgToolchainInstaller: {
      async install() {
        calls.push("install");
        return {ok: true};
      },
    },
  });

  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: true, deviceId: "lab-lg"});

  assert.deepEqual(result, {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED"});
  assert.deepEqual(calls, []);
});

test("forwards only allowlisted managed-install milestones to the requesting renderer", async () => {
  const sent = [];
  const {handlers} = createHarness({
    lgToolchainInstaller: {
      async install({confirmed, onProgress}) {
        assert.equal(confirmed, true);
        onProgress({code: "installing-appium", path: "/user-data/lg-toolchain/appium"});
        onProgress({code: "unexpected", detail: "raw command output"});
        onProgress({code: "failed", status: "VERIFICATION_FAILED", host: "candidate-host"});
        return {ok: false, status: "VERIFICATION_FAILED", verification: "LG_DRIVER_UNVERIFIED"};
      },
    },
  });

  const result = await handlers.get("install-lg-toolchain")({
    sender: {send(channel, payload) { sent.push([channel, payload]); }},
  }, {confirmed: true});

  assert.deepEqual(sent, [
    ["lg-toolchain-install-progress", {code: "installing-appium"}],
    ["lg-toolchain-install-progress", {code: "failed", status: "VERIFICATION_FAILED"}],
  ]);
  assert.deepEqual(result, {ok: false, status: "VERIFICATION_FAILED", verification: "LG_DRIVER_UNVERIFIED"});
  assert.doesNotMatch(JSON.stringify({sent, result}), /user-data|candidate-host|raw command/i);
});

test("returns only a safe managed component verification result", async () => {
  const {handlers} = createHarness({
    toolchain: {inspect() { throw new Error("must not inspect"); }},
    lgToolchainInstaller: {
      async install() {
        return {
          ok: false,
          status: "VERIFICATION_FAILED",
          verification: "LG_DRIVER_UNVERIFIED",
          path: "/user-data/lg-toolchain/appium",
          detail: "raw command output",
        };
      },
    },
  });

  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: true});

  assert.deepEqual(result, {
    ok: false,
    status: "VERIFICATION_FAILED",
    verification: "LG_DRIVER_UNVERIFIED",
  });
  assert.doesNotMatch(JSON.stringify(result), /user-data|raw command|https?:\/\//i);
});

test("activates a verified managed source without an installation or TV operation", async () => {
  const calls = [];
  const {handlers, calls: harnessCalls} = createHarness({
    toolchain: {inspect() { throw new Error("must not inspect"); }},
    toolchainConfig: {
      async activateManaged() {
        calls.push("activate");
        return {
          configured: true,
          source: "managed",
          platform: "webos",
          managedRoot: "/user-data/lg-toolchain",
          components: [{id: "appium-home", label: "Appium home", status: "ready", path: "/user-data/lg-toolchain/appium"}],
        };
      },
    },
    lgToolchainInstaller: {install() { throw new Error("must not install"); }},
  });

  const result = await handlers.get("activate-managed-lg-toolchain")();

  assert.deepEqual(calls, ["activate"]);
  assert.deepEqual(harnessCalls, []);
  assert.deepEqual(result, {
    ok: true,
    configured: true,
    source: "managed",
    platform: "webos",
    components: [{id: "appium-home", label: "Appium home", status: "ready"}],
  });
  assert.doesNotMatch(JSON.stringify(result), /user-data|https?:\/\//i);
});

test("does not register a vendor target from the non-live device IPC", () => {
  const harness = createHarness();

  assert.equal(harness.handlers.has("register-webos-target"), false);
  assert.deepEqual(harness.calls, []);
});

test("returns redacted local toolchain configuration status and save results", async () => {
  const calls = [];
  const toolchainConfig = {
    async status() {
      calls.push("status");
      return {configured: false, platform: "webos", components: [{id: "webos-sdk", status: "missing"}]};
    },
    async save(input) {
      calls.push(["save", input]);
      return {configured: true, platform: "webos", components: [{id: "webos-sdk", status: "ready"}]};
    },
  };
  const {handlers} = createHarness({toolchainConfig});

  assert.deepEqual(await handlers.get("get-tv-toolchain-configuration")(), {
    ok: true,
    configured: false,
    platform: "webos",
    components: [{id: "webos-sdk", status: "missing"}],
  });
  const saved = await handlers.get("save-tv-toolchain-configuration")(undefined, {
    webosSdkHome: "/toolchain/webos-sdk",
    appiumHome: "/toolchain/appium-home",
    chromedriverPath: "/toolchain/chromedriver",
  });
  assert.equal(saved.ok, true);
  assert.doesNotMatch(JSON.stringify(saved), /\/toolchain\//);
  assert.equal(calls[0], "status");
});

test("opens only LG's approved CLI page and imports through the main-process picker", async () => {
  const shellCalls = [];
  const pickerCalls = [];
  const importCalls = [];
  const {handlers} = createHarness({
    lgCliPlatform: "darwin",
    shell: {async openExternal(url) { shellCalls.push(url); }},
    dialog: {
      async showOpenDialog(options) {
        pickerCalls.push(options);
        return {canceled: false, filePaths: ["/Downloads/webOS_TV_CLI_mac_1.12.4-j27.tgz"]};
      },
    },
    lgCliArchiveImporter: {
      async importArchive(request) {
        importCalls.push(request);
        return {ok: true, status: "LG_CLI_IMPORTED", component: {id: "webos-cli", version: "1.12.4"}};
      },
    },
  });

  assert.deepEqual(await handlers.get("open-lg-cli-download-page")(), {ok: true});
  assert.deepEqual(await handlers.get("choose-lg-cli-archive")(), {
    ok: true,
    status: "LG_CLI_IMPORTED",
    component: {id: "webos-cli", version: "1.12.4"},
  });
  assert.deepEqual(shellCalls, ["https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1"]);
  assert.deepEqual(importCalls, [{archivePath: "/Downloads/webOS_TV_CLI_mac_1.12.4-j27.tgz", confirmed: true}]);
  assert.deepEqual(pickerCalls, [{
    properties: ["openFile"],
    filters: [{name: "LG webOS TV CLI", extensions: ["tgz"]}],
  }]);
});
