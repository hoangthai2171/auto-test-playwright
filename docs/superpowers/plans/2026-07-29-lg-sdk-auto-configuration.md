# LG SDK Auto-Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LG local-toolchain setup into Settings and provide a user-confirmed, pinned macOS/Windows installer for the currently LG-verified bundle, with the legacy LG CLI selected by the operator from LG's official page.

**Architecture:** Keep every filesystem, download, selected-archive import, checksum, process, and manifest operation inside Electron's main process. The renderer presents redacted state through narrow preload IPC, while a managed per-user toolchain becomes the default source for the existing LG inspector and read-only adapter. Separate pure manifest, detection, planning, installation, and verification modules so all behavior is deterministic under injected fakes.

**Tech Stack:** Electron main/preload/renderer, Node.js CommonJS, built-in `node:crypto`, `node:fs/promises`, `node:path`, `node:stream`, `node:child_process`, `node:test`, existing `rtk` validation commands.

## Global Constraints

- LG-only. Do not add Samsung setup, support, UI, or commands.
- Do not contact, pair with, register, validate, navigate, reset, deploy to, install on, uninstall from, or otherwise operate a TV.
- Do not use `rcMode: "js"` or `webos: clearApp`.
- The default bundle is pinned: Node/npm `24.18.0`, webOS TV CLI `1.12.4`, Appium `2.19.0`, `appium-lg-webos-driver` `0.5.0`, and ChromeDriver `2.36.540469`.
- Automatically acquired packages must use HTTPS official sources and every archive must have a non-empty, reviewed SHA-256 before it can be installed. Never substitute `latest`, a mirror, or an unchecked artifact.
- The legacy webOS TV CLI is operator-selected: never bundle or download it. Its review offers LG's official page and a native archive picker. The picker may import only the exact platform filename after a MyTV-audited SHA-256 is added to the manifest. LG does not publish that checksum, so strict import remains release-gated rather than trusting filename or version alone.
- Managed tools live below Electron `userData`; do not install or configure NVM, mutate shell profiles/PATH, or replace an existing system Node/npm installation.
- Existing manual/system/NVM paths remain an Advanced, locally validated opt-in. Resolved paths, hosts, credentials, pairing material, archive locations, raw command output, and raw download errors never cross preload IPC.
- **Auto configure** only detects and returns a review plan. Only **Install missing tools** may write/download, and it requires a separate renderer confirmation.
- A compatibility profile is selected only after a separately approved read-only TV validation. Unknown model/firmware facts return `COMPATIBILITY_PROFILE_UNVERIFIED`; never download a guessed ChromeDriver.
- Use `apply_patch` for every edit. Run the six project validation commands after every edit. Do not stage, commit, merge, push, reset, or touch unrelated work.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/lg-toolchain-manifest.js` | Validates a frozen app-shipped manifest, selects the host bundle, and resolves an already verified ChromeDriver profile. |
| `app/lg-toolchain-detector.js` | Detects managed and Advanced override components from injected filesystem/process dependencies without writes or network access. |
| `app/lg-toolchain-installer.js` | Builds the approved install plan, downloads non-CLI artifacts to staging, imports an operator-selected LG CLI archive only after hash verification, runs fixed verification commands, and atomically activates a managed bundle. |
| `app/tv-toolchain-config.js` | Migrates from raw mandatory paths to a versioned source selection (`managed` or validated `advanced`) while keeping raw configuration main-process-only. |
| `app/tv-toolchain.js` | Inspects the configured source and reports the five user-facing components without paths. |
| `app/tv-device-ipc.js` | Owns safe status/plan/install/compatibility IPC and redacts every response. |
| `app/main.js` / `app/preload.js` | Wires user-data managed directory and narrowly named IPC methods. |
| `app/renderer/{index.html,renderer.js,styles.css}` | Removes setup from the run workspace and adds the Settings SDK configuration panel, confirmation, progress, Help, and Advanced path controls. |
| `tests/unit/lg-toolchain-*.test.js` | Pure, fake-only manifest, detector, installer, config, IPC, and renderer contracts. |
| `docs/real-tv-appium/{architecture.md,phases.md,HANDOFF.md}` | Records the completed local-only UI/toolchain behavior and preserves the separate live-validation boundary. |

## Task 1: Define the pinned bundle and compatibility contracts

**Files:**
- Create: `app/lg-toolchain-manifest.js`
- Create: `tests/unit/lg-toolchain-manifest.test.js`

**Interfaces:**
- Produces `createLgToolchainManifest({platform, manifest})` with:
  - `bundle()` → `{id, version, components}` for `darwin` or `win32`
  - `installationPlan(detected)` → `{status: "ready"|"installable", components}`
  - `selectCompatibilityProfile({model, firmware, appId})` → `{status: "verified", chromedriver}` or `{status: "COMPATIBILITY_PROFILE_UNVERIFIED"}`
- Consumed by the detector, installer, configuration resolver, and IPC layer.

- [ ] **Step 0: Define the self-contained test fixture before the first test**

```js
const SHA = "a".repeat(64);
const FIXED_MANIFEST = {
  version: 1,
  bundles: {
    darwin: {id: "lg-verified-darwin", components: {
      node: {version: "24.18.0", official: true, url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-darwin-arm64.tar.gz", sha256: SHA},
      webosCli: {version: "1.12.4", operatorSelected: true, helpUrl: "https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1", archiveName: "webOS_TV_CLI_mac_1.12.4-j27.tgz", sha256: SHA},
      appium: {version: "2.19.0", official: true, url: "https://registry.npmjs.org/appium/-/appium-2.19.0.tgz", sha256: SHA},
      lgDriver: {version: "0.5.0", official: true, url: "https://registry.npmjs.org/appium-lg-webos-driver/-/appium-lg-webos-driver-0.5.0.tgz", sha256: SHA},
      chromedriver: {version: "2.36.540469", official: true, url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip", sha256: SHA},
    }},
    win32: {id: "lg-verified-win32", components: {
      node: {version: "24.18.0", official: true, url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-x64.zip", sha256: SHA},
      webosCli: {version: "1.12.4", operatorSelected: true, helpUrl: "https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1", archiveName: "webOS_TV_CLI_win_1.12.4-j27.zip", sha256: SHA},
      appium: {version: "2.19.0", official: true, url: "https://registry.npmjs.org/appium/-/appium-2.19.0.tgz", sha256: SHA},
      lgDriver: {version: "0.5.0", official: true, url: "https://registry.npmjs.org/appium-lg-webos-driver/-/appium-lg-webos-driver-0.5.0.tgz", sha256: SHA},
      chromedriver: {version: "2.36.540469", official: true, url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_win32.zip", sha256: SHA},
    }},
  },
  profiles: [{appId: "com.mytvb2c.app", chromedriver: "2.36.540469"}],
};
const withBadArtifact = structuredClone(FIXED_MANIFEST);
withBadArtifact.bundles.darwin.components.node = {version: "24.18.0", official: false, url: "http://mirror.invalid/node.tgz", sha256: ""};
```

The production manifest must replace every fixture checksum with a MyTV-audited,
artifact-specific SHA-256. Automatically acquired artifacts require an exact
official HTTPS archive URL; the legacy CLI requires `operatorSelected: true`,
LG's official `helpUrl`, and the exact platform archive name. A blank checksum,
non-official automatic source, or missing selected-archive metadata is invalid.

- [ ] **Step 1: Write the failing manifest tests**

```js
test("selects the pinned macOS bundle without a floating version", () => {
  const manifest = createLgToolchainManifest({platform: "darwin", manifest: FIXED_MANIFEST});

  assert.equal(manifest.bundle().components.node.version, "24.18.0");
  assert.equal(manifest.bundle().components.appium.version, "2.19.0");
  assert.equal(manifest.bundle().components.lgDriver.version, "0.5.0");
  assert.equal(manifest.bundle().components.chromedriver.version, "2.36.540469");
  assert.doesNotMatch(JSON.stringify(manifest.bundle()), /latest/i);
});

test("rejects a component with a non-official URL or blank SHA-256", () => {
  assert.throws(
    () => createLgToolchainManifest({platform: "darwin", manifest: withBadArtifact}),
    /pinned official artifact/i,
  );
});

test("requires reviewed selected-archive metadata for the LG CLI", () => {
  const invalid = structuredClone(FIXED_MANIFEST);
  invalid.bundles.darwin.components.webosCli.sha256 = "";

  assert.throws(
    () => createLgToolchainManifest({platform: "darwin", manifest: invalid}),
    /selected LG CLI artifact/i,
  );
});

test("does not select a ChromeDriver profile for unknown TV facts", () => {
  const manifest = createLgToolchainManifest({platform: "win32", manifest: FIXED_MANIFEST});

  assert.deepEqual(manifest.selectCompatibilityProfile({model: "unknown", firmware: "unknown", appId: "com.mytvb2c.app"}), {
    status: "COMPATIBILITY_PROFILE_UNVERIFIED",
  });
});
```

- [ ] **Step 2: Run the manifest tests to verify they fail**

Run: `rtk node --test tests/unit/lg-toolchain-manifest.test.js`

Expected: FAIL because `app/lg-toolchain-manifest.js` does not exist.

- [ ] **Step 3: Implement the minimal manifest module**

```js
const SUPPORTED_PLATFORMS = new Set(["darwin", "win32"]);
const SHA256 = /^[a-f0-9]{64}$/u;

function officialArtifact(artifact) {
  const url = new URL(artifact.url);
  if (url.protocol !== "https:" || !SHA256.test(artifact.sha256) || !artifact.official) {
    throw new Error("Each LG toolchain artifact must be a pinned official artifact.");
  }
  return Object.freeze({...artifact});
}

function selectedCliArtifact(artifact) {
  const helpUrl = new URL(artifact.helpUrl);
  if (helpUrl.protocol !== "https:" || !artifact.operatorSelected || !artifact.archiveName || !SHA256.test(artifact.sha256)) {
    throw new Error("Each selected LG CLI artifact must be pinned and reviewed.");
  }
  return Object.freeze({...artifact});
}

function createLgToolchainManifest({platform, manifest}) {
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new Error("LG toolchain setup supports only macOS and Windows.");
  const bundle = manifest?.bundles?.[platform];
  if (!bundle?.components) throw new Error("The pinned LG toolchain bundle is unavailable.");
  const components = Object.fromEntries(Object.entries(bundle.components).map(([id, artifact]) => [id, id === "webosCli" ? selectedCliArtifact(artifact) : officialArtifact(artifact)]));
  return Object.freeze({
    bundle: () => ({id: bundle.id, components: structuredClone(components)}),
    installationPlan: (detected) => ({status: detected.every((component) => component.status === "ready") ? "ready" : "installable", components: structuredClone(components)}),
    selectCompatibilityProfile: (facts) => manifest.profiles.some((profile) => profile.appId === facts?.appId && profile.model === facts?.model && profile.firmware === facts?.firmware)
      ? {status: "verified", chromedriver: components.chromedriver.version}
      : {status: "COMPATIBILITY_PROFILE_UNVERIFIED"},
  });
}
```

Populate the two platform records with the pinned component versions from the global constraints and only audited artifact records. Include source/license text, archive kind, size, `sha256`, and fixed verification data. `webosCli` uses the operator-selected metadata shown above instead of an application download URL. Include exactly one currently verified LG ChromeDriver profile; do not encode a host, pairing material, or a model year.

- [ ] **Step 4: Run the manifest tests to verify they pass**

Run: `rtk node --test tests/unit/lg-toolchain-manifest.test.js`

Expected: PASS, including rejection of every unpinned/unofficial artifact and unknown profile.

- [ ] **Step 5: Record the checkpoint without staging or committing**

Run: `rtk git diff --check`

Expected: PASS. Leave all files unstaged.

## Task 2: Detect managed and Advanced sources without writes

**Files:**
- Create: `app/lg-toolchain-detector.js`
- Create: `tests/unit/lg-toolchain-detector.test.js`
- Modify: `app/tv-toolchain-config.js`
- Modify: `tests/unit/tv-toolchain-config.test.js`

**Interfaces:**
- Consumes `createLgToolchainManifest`.
- Produces `createLgToolchainDetector({manifest, managedRoot, fs, spawnSync})` with `inspect()` and `inspectAdvanced(rawPaths)`.
- Produces configuration methods `saveAdvanced(input)`, `activateManaged()`, `resolve()`, and `status()`.

- [ ] **Step 0: Define detector fixtures used by the contract tests**

```js
const spawnCalls = [];
const writeCalls = [];
const missingFs = {
  async stat() { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
  async readFile() { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
  async writeFile(path) { writeCalls.push(path); },
  async rename() {},
};
const expectedMissingComponents = [
  {id: "node", label: "Node.js and npm", status: "missing"},
  {id: "webos-cli", label: "webOS CLI", status: "missing"},
  {id: "appium", label: "Appium", status: "missing"},
  {id: "appium-lg-webos-driver", label: "LG webOS driver", status: "missing"},
  {id: "chromedriver", label: "ChromeDriver", status: "missing"},
];
const expectedReadyComponents = expectedMissingComponents.map((component) => ({...component, status: "ready"}));
const spawnSync = (...args) => { spawnCalls.push(args); return {status: 0, stdout: ""}; };
```

- [ ] **Step 1: Write failing detector and migration tests**

```js
test("detects an incomplete managed bundle without spawning or writing", async () => {
  const detector = createLgToolchainDetector({manifest, managedRoot: "/user-data/lg-tools", fs: missingFs, spawnSync});

  assert.deepEqual(await detector.inspect(), {
    source: "managed",
    state: "missing",
    components: expectedMissingComponents,
  });
  assert.deepEqual(spawnCalls, []);
  assert.deepEqual(writeCalls, []);
});

test("preserves a legacy manual configuration as Advanced source", async () => {
  const config = createTvToolchainConfig({filePath, fs: legacyFs, detector});

  assert.equal((await config.status()).source, "advanced");
  assert.doesNotMatch(JSON.stringify(await config.status()), /\/toolchain\//);
});

test("activates a verified managed source without retaining its filesystem path in status", async () => {
  await config.activateManaged();

  assert.deepEqual(await config.status(), {configured: true, source: "managed", platform: "webos", components: expectedReadyComponents});
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `rtk node --test tests/unit/lg-toolchain-detector.test.js tests/unit/tv-toolchain-config.test.js`

Expected: FAIL because the detector and source-selection methods do not exist.

- [ ] **Step 3: Implement pure detection and source migration**

```js
function createLgToolchainDetector({manifest, managedRoot, fs, spawnSync}) {
  async function inspectSource(source) {
    // Validate fixed expected directories/files and run only fixed --version/list commands.
    // Return component id, label, exact expected version, observed version, and ready/missing/repair-needed.
  }
  return {
    inspect: () => inspectSource({kind: "managed", root: managedRoot}),
    inspectAdvanced: (raw) => inspectSource({kind: "advanced", raw}),
  };
}

async function saveSource(source) {
  // Write {version: 2, source: "managed"} or {version: 2, source: "advanced", ...rawPaths}
  // through the existing temporary-file then rename atomic pattern.
}
```

Keep raw Advanced paths only in the version-2 config record returned by `resolve()`. `status()` returns source, component statuses, and versions only. Preserve version-1 records by treating their current valid paths as Advanced input; do not delete or rewrite them until the user selects a source.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `rtk node --test tests/unit/lg-toolchain-detector.test.js tests/unit/tv-toolchain-config.test.js`

Expected: PASS with no writes during inspection and no raw paths in public status.

- [ ] **Step 5: Record the checkpoint without staging or committing**

Run: `rtk git diff --check`

Expected: PASS. Leave all files unstaged.

## Task 3: Build a confirmed-only, atomic installer

**Files:**
- Create: `app/lg-toolchain-installer.js`
- Create: `tests/unit/lg-toolchain-installer.test.js`

**Interfaces:**
- Consumes manifest and detector.
- Produces `createLgToolchainInstaller({manifest, detector, managedRoot, fs, fetch, spawn, hashFile, extract})` with:
  - `plan()` → redacted `{ok, state, components}`; no network/writes
  - `install({confirmed: true, onProgress})` → `{ok, state, components}`
  - `importSelectedWebOsCli({archivePath, confirmed: true})` → `{ok, state, components}`
  - `install({confirmed: false})` → `{ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"}`

- [ ] **Step 0: Define installer fixture paths and fakes**

```js
const managedRoot = "/user-data/lg-toolchain";
const stagingBundle = `${managedRoot}.staging`;
const activeMarker = `${managedRoot}/bundle.json`;
const priorMarker = '{"version":1}';
const fetchCalls = [];
const fsWrites = [];
const renameCalls = [];
const fs = createMemoryFs({[activeMarker]: priorMarker, onWrite: (path) => fsWrites.push(path), onRename: (...args) => renameCalls.push(args)});
const fetch = async (url) => { fetchCalls.push(url); return fakeArchiveResponse; };
const hashFile = async () => "a".repeat(64);
const extract = async () => {};
```

- [ ] **Step 1: Write failing installer tests**

```js
test("returns an install review without a network request or write", async () => {
  const review = await installer.plan();

  assert.equal(review.state, "installable");
  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(fsWrites, []);
});

test("refuses an unconfirmed installation", async () => {
  assert.deepEqual(await installer.install({confirmed: false}), {
    ok: false,
    status: "INSTALL_CONFIRMATION_REQUIRED",
  });
  assert.deepEqual(fetchCalls, []);
});

test("does not download LG's CLI and rejects selected import without an audited hash", async () => {
  const result = await installer.importSelectedWebOsCli({archivePath: "/picker/archive.tgz", confirmed: true});

  assert.deepEqual(result, {ok: false, status: "LG_CLI_AUDIT_REQUIRED"});
  assert.deepEqual(fetchCalls, []);
});

test("retains a prior healthy bundle when checksum verification fails", async () => {
  const result = await installer.install({confirmed: true});

  assert.deepEqual(result, {ok: false, status: "CHECKSUM_MISMATCH"});
  assert.equal(await fs.readFile(activeMarker), priorMarker);
  assert.equal(await fs.exists(stagingBundle), false);
});

test("atomically activates only a fully verified staged bundle", async () => {
  const result = await installer.install({confirmed: true});

  assert.equal(result.ok, true);
  assert.deepEqual(renameCalls.at(-1), [stagingBundle, managedRoot]);
  assert.equal(await detector.inspect().then((state) => state.state), "ready");
});
```

- [ ] **Step 2: Run focused installer tests to verify they fail**

Run: `rtk node --test tests/unit/lg-toolchain-installer.test.js`

Expected: FAIL because the installer module does not exist.

- [ ] **Step 3: Implement the installer with explicit staging lifecycle**

```js
async function install({confirmed, onProgress = () => {}} = {}) {
  if (confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
  const review = await plan();
  if (review.state === "ready") return {ok: true, state: "ready", components: review.components};
  const staging = `${managedRoot}.staging`;
  await fs.rm(staging, {recursive: true, force: true});
  try {
    for (const artifact of reviewedAutomaticArtifacts(review)) {
      onProgress({componentId: artifact.id, state: "downloading"});
      const archive = await downloadOfficialArtifact(artifact, staging);
      if (await hashFile(archive) !== artifact.sha256) return failure("CHECKSUM_MISMATCH");
      await extract(artifact, archive, staging);
    }
    await verifyFixedBundle(staging);
    await atomicActivate(staging, managedRoot);
    return redactedReadyResult();
  } finally {
    await fs.rm(staging, {recursive: true, force: true});
  }
}
```

Implement `downloadOfficialArtifact` with injected `fetch`, a strict HTTPS URL check against a non-CLI manifest entry, bounded response status/size handling, and file streaming. `importSelectedWebOsCli` receives its `archivePath` only from the main-process native picker, rejects it unless the manifest holds a non-empty MyTV-audited SHA-256, matches the exact platform filename and hash before extraction, and never calls `fetch`. Implement extractors with fixed archive-kind dispatch; do not pass archive names or user strings to a shell. Install Appium and its exact driver only by spawning the managed Node/npm executable with a fixed argument array and a managed `APPIUM_HOME`. Verify fixed `--version` and `driver list --installed --json` output before activation. Map cancellation, network, source, permission, extraction, checksum, and verification failures to safe codes; do not return exception text.

- [ ] **Step 4: Run focused installer tests to verify they pass**

Run: `rtk node --test tests/unit/lg-toolchain-installer.test.js`

Expected: PASS for review-only behavior, confirmation, checksum rejection, cleanup, atomic activation, and cancellation.

- [ ] **Step 5: Record the checkpoint without staging or committing**

Run: `rtk git diff --check`

Expected: PASS. Leave all files unstaged.

## Task 4: Replace workspace setup with safe SDK settings IPC

**Files:**
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `app/tv-device-ipc.js`
- Modify: `tests/unit/tv-device-ipc.test.js`

**Interfaces:**
- Produces preload methods:
  - `getLgToolchainStatus()`
  - `planLgToolchainSetup()`
  - `installLgToolchain({confirmed: true})`
  - `openLgCliDownloadPage()`
  - `chooseLgCliArchive()`
  - `saveAdvancedLgToolchainPaths(input)`
  - `activateManagedLgToolchain()`
- Existing `inspectTvToolchain`, target registration, and validation consume the resolved source and retain their existing safety boundaries.

- [ ] **Step 0: Define public IPC fixture data**

```js
const publicComponents = [{id: "node", label: "Node.js and npm", status: "missing", version: "24.18.0"}];
const calls = [];
const installer = {
  async plan() { calls.push("plan"); return {ok: true, state: "installable", components: publicComponents}; },
  async install({confirmed}) { calls.push(["install", confirmed]); return {ok: true, state: "ready", components: publicComponents}; },
};
```

- [ ] **Step 1: Write failing IPC tests**

```js
test("returns a setup review without invoking installation, discovery, or registration", async () => {
  const result = await handlers.get("plan-lg-toolchain-setup")();

  assert.deepEqual(result, {ok: true, state: "installable", components: publicComponents});
  assert.deepEqual(calls, ["plan"]);
});

test("requires an explicit confirmation before installation", async () => {
  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: false});

  assert.deepEqual(result, {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"});
  assert.deepEqual(calls, []);
});

test("never returns paths or raw installer diagnostics", async () => {
  const result = await handlers.get("install-lg-toolchain")(undefined, {confirmed: true});

  assert.doesNotMatch(JSON.stringify(result), /\/user-data\/|https?:\/\/|secret|host/i);
});
```

- [ ] **Step 2: Run focused IPC tests to verify they fail**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js`

Expected: FAIL because the new handlers and dependencies are absent.

- [ ] **Step 3: Wire main, IPC, and preload**

```js
ipcMain.handle("plan-lg-toolchain-setup", async () => redactValue(redact, await installer.plan()));
ipcMain.handle("install-lg-toolchain", async (_event, request) => {
  if (request?.confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
  return redactValue(redact, await installer.install({confirmed: true}));
});
```

Create the manifest, detector, and installer once in `app/main.js` using `path.join(app.getPath("userData"), "lg-toolchain")`. `openLgCliDownloadPage` uses Electron `shell.openExternal` with LG's exact official CLI page; `chooseLgCliArchive` opens a platform-filtered native file picker in the main process and passes its result only to `importSelectedWebOsCli`. Do not inject a device, host, target name, or TV adapter into setup handlers. Extend `redactValue` to exclude managed-root, archive, URL, path, host, credentials, pairing, and raw diagnostic keys recursively. Preserve the existing target-registration handler as an explicit, separate operation.

- [ ] **Step 4: Run focused IPC tests to verify they pass**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js`

Expected: PASS, with no discovery/registration calls and no unsafe values in results.

- [ ] **Step 5: Record the checkpoint without staging or committing**

Run: `rtk git diff --check`

Expected: PASS. Leave all files unstaged.

## Task 5: Move the controls into Settings → SDK configuration

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Consumes the Task 4 preload methods.
- Produces a `sdk` settings panel and controller methods `loadLgToolchainStatus()`, `planLgToolchainSetup()`, `confirmLgToolchainInstall()`, and `saveAdvancedLgToolchainPaths()`.

- [ ] **Step 0: Extend the renderer fixture with named SDK elements and fake IPC**

```js
Object.assign(elements, {
  "sdk-settings-nav": new FakeElement("button"),
  "sdk-settings-panel": new FakeElement("section"),
  "sdk-status": new FakeElement("p"),
  "sdk-auto-configure-button": new FakeElement("button"),
  "sdk-install-confirm-button": new FakeElement("button"),
});
const calls = [];
const dependencies = {
  document: fixture.document,
  window: {mytvRunner: {
    getLgToolchainStatus: async () => missingStatus,
    planLgToolchainSetup: async () => { calls.push("planLgToolchainSetup"); return installableReview; },
    installLgToolchain: async (request) => { calls.push(["installLgToolchain", request]); return readyStatus; },
  }},
};
```

Use the existing `createRendererFixture` helper; `createToolchainRendererHarness()` returns `{controller: createRendererController(dependencies), calls, elements}`.

- [ ] **Step 1: Write failing renderer tests**

```js
test("keeps LG setup controls out of the workspace and shows SDK configuration in Settings", async () => {
  const fixture = createRendererFixture({toolchainStatus: missingStatus});
  const controller = createRendererController(fixture.dependencies);

  assert.equal(fixture.elements["tv-toolchain-save-button"], undefined);
  fixture.elements["settings-button"].dispatchEvent("click");
  fixture.elements["sdk-settings-nav"].dispatchEvent("click");
  assert.match(fixture.elements["sdk-settings-panel"].textContent, /Node\.js.*webOS CLI.*Appium.*ChromeDriver/s);
});

test("Auto configure requests only a review until the user confirms install", async () => {
  const {controller, calls, elements} = createToolchainRendererHarness();

  await controller.planLgToolchainSetup();
  assert.deepEqual(calls, ["planLgToolchainSetup"]);
  elements["sdk-install-confirm-button"].dispatchEvent("click");
  assert.deepEqual(calls, ["planLgToolchainSetup", ["installLgToolchain", {confirmed: true}]]);
});

test("renders a safe repair state without a local path or raw failure", async () => {
  await controller.loadLgToolchainStatus();
  assert.doesNotMatch(elements["sdk-status"].textContent, /\/Users\/|https?:\/\//);
  assert.match(elements["sdk-status"].textContent, /Open Help|Advanced paths/);
});
```

- [ ] **Step 2: Run focused renderer tests to verify they fail**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: FAIL because the SDK navigation, settings panel, and reviewed-install interaction do not exist.

- [ ] **Step 3: Implement the settings panel and remove workspace controls**

```html
<button id="sdk-settings-nav" class="settings-nav-item" data-settings-panel="sdk">SDK configuration</button>
<div id="sdk-settings-panel" class="settings-panel hidden" data-settings-content="sdk">
  <h3>LG SDK configuration</h3>
  <p>Check this computer and install only the supported LG compatibility bundle.</p>
  <div id="sdk-component-list"></div>
  <button id="sdk-auto-configure-button" class="secondary-button">Auto configure</button>
  <section id="sdk-install-review" class="hidden"></section>
  <button id="sdk-download-lg-cli-button" class="secondary-button">Download from LG</button>
  <button id="sdk-choose-lg-cli-button" class="secondary-button">Choose downloaded CLI archive</button>
  <details id="sdk-advanced-paths"><summary>Advanced paths</summary><!-- validated path fields --></details>
  <button id="sdk-help-button" class="secondary-button">Open Help</button>
</div>
```

Remove `tv-toolchain-editor`, its path inputs/save/check button, and local target registration from the workspace. Retain device profile save, explicit read-only validation, and Run-disabled behavior. Settings opens on `gui` as today, does not auto-detect on startup, and loads SDK status only when the user selects the SDK tab. Disable actions while awaited IPC is in flight. The confirmation copy must enumerate the exact pinned component versions and tell the user installation is local to this app; only the confirm button calls `installLgToolchain({confirmed: true})`. For a missing CLI, show **Download from LG** and **Choose downloaded CLI archive** with the operator-guide steps; never imply the app downloads or distributes LG's archive. Render `ready`, `missing`, `downloading`, `verifying`, `repair-needed`, and `unsupported-profile` with safe text plus Retry/Open Help/Advanced paths as applicable.

- [ ] **Step 4: Run focused renderer tests to verify they pass**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: PASS; workspace has no setup fields, planning never installs, and status text contains no unsafe data.

- [ ] **Step 5: Record the checkpoint without staging or committing**

Run: `rtk git diff --check`

Expected: PASS. Leave all files unstaged.

## Task 6: Integrate inspector/configuration source and document local-only behavior

**Files:**
- Modify: `app/tv-toolchain.js`
- Modify: `app/webos-read-only-adapter.js`
- Modify: `app/webos-target-registration.js`
- Modify: `tests/unit/tv-toolchain.test.js`
- Modify: `tests/unit/webos-read-only-adapter.test.js`
- Modify: `tests/unit/webos-target-registration.test.js`
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`

**Interfaces:**
- Existing `toolchainConfig.resolve()` now returns the active managed or Advanced configuration only in the main process.
- `createTvToolchainInspector`, `createConfiguredWebOsReadOnlyAdapter`, and `createWebOsTargetRegistration` consume that resolved source without changing their command allowlists.

- [ ] **Step 1: Write failing integration contracts**

```js
test("inspector uses an activated managed source without exposing its root", async () => {
  const result = await inspector.inspect();

  assert.equal(result.configured, true);
  assert.doesNotMatch(JSON.stringify(result), /\/user-data\/lg-toolchain/);
});

test("the configured read-only adapter resolves the active source only when a separately approved command is requested", async () => {
  await adapter.deviceInfo({deviceName: "registered-target"});

  assert.deepEqual(calls, [["ares-device-info", ["--device", "registered-target"]]]);
});

test("target registration command allowlist remains listfull then add only", async () => {
  const result = await registration.register({targetName: "new-target", host: "192.0.2.1"});

  assert.equal(result.status, "TARGET_REGISTERED");
  assert.equal(calls.some(([, args]) => args.includes("--modify") || args.includes("--remove") || args.includes("--default")), false);
});
```

- [ ] **Step 2: Run focused integration contracts to verify they fail**

Run: `rtk node --test tests/unit/tv-toolchain.test.js tests/unit/webos-read-only-adapter.test.js tests/unit/webos-target-registration.test.js`

Expected: FAIL until managed-source resolution is supported by all consumers.

- [ ] **Step 3: Implement source integration and docs**

Keep the existing `ares-device-info`, `ares-install --list`, `ares-setup-device --listfull`, and conditional `--add` allowlists unchanged. Do not cause inspection or adapter construction to perform a vendor command. Update the three real-TV documents to record Settings placement, confirmation-only installation, manifest/profile safety, macOS/Windows scope, no-NVM policy, and the unchanged live-operation approval boundary. Do not record host, credentials, pairing data, screenshots, local paths, or a claim of a live validation.

- [ ] **Step 4: Run focused integration contracts to verify they pass**

Run: `rtk node --test tests/unit/tv-toolchain.test.js tests/unit/webos-read-only-adapter.test.js tests/unit/webos-target-registration.test.js`

Expected: PASS, with existing command restrictions preserved.

- [ ] **Step 5: Run final required validation**

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: all unit tests pass, syntax checks exit 0, the Playwright list reports no runnable generic case without environment selection, and whitespace validation exits 0. Report any broader environment-dependent browser-suite failure separately; do not alter unrelated staging/legacy behavior.

- [ ] **Step 6: Record the checkpoint without staging or committing**

Run: `rtk git status --short --branch`

Expected: only intended LG SDK design/implementation changes plus the existing preserved worktree changes; no staged files and no live evidence.

## Manual QA inventory (after automated contracts pass)

1. Launch Electron on macOS and Windows with no configured managed bundle; verify the workspace contains no SDK paths, Settings has **SDK configuration**, and opening Settings contacts no TV.
2. Select the SDK tab; verify component status appears without downloads or vendor commands.
3. Click **Auto configure**; verify a review shows the exact five pinned components and no write/network begins.
4. Close or cancel the review; verify no bundle is created and any prior bundle remains unchanged.
5. Confirm install only in a network-isolated fake/local test environment; verify progress, checksum failure, cancellation, repair, and Help/Advanced UI states without a TV.
6. With a fully fake verified bundle, verify `Ready` and that manual Advanced paths remain collapsed; do not register or validate a physical target.
7. If a later user separately approves it, perform the mandatory preflight and read-only validation before any real LG operation. Pairing prompts stop for manual on-TV approval.
