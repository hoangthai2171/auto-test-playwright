# LG Compatibility Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators explicitly refresh a model-and-firmware LG ChromeDriver catalog from the existing authenticated API, then install only the catalog-approved platform artifact into private managed storage.

**Architecture:** Keep catalog parsing, cache access, HTTP fetching, profile selection, and artifact handling in Electron's main process. `DEVICE-COMPATIBILITY.json` is the packaged baseline; a fully validated API response atomically replaces only the per-user cache. The renderer receives a fixed catalog state and uses narrow IPC for its explicit refresh button; it never receives catalog artifact details or Authorization.

**Tech Stack:** Electron main/preload/renderer, CommonJS, `node:fs/promises`, `node:test`, existing `flow-case-api` fetch boundary, and the existing managed LG installer.

## Global Constraints

- LG only; do not add Samsung support, commands, or UI.
- Do not contact a TV for any task in this plan. Catalog refresh is a desktop API request only.
- Match a profile only by exact device `model` and `firmwareVersion`; ignore MyTV app ID.
- Reuse the existing API domain, Authorization value, and timeout. Do not add, default, log, package, or expose a token.
- Fetch only `GET /api/v1/device-compatibility` after a user clicks **Update compatibility catalog**.
- The project baseline and every accepted response must have both macOS and Windows ChromeDriver artifacts with an official HTTPS URL, filename, version, and audited SHA-256.
- Reject redirects and unapproved vendor hosts; verify an archive's SHA-256 and the installed executable version before activation.
- Preserve the last valid catalog and the active managed toolchain after every failure.
- Keep all raw catalog details, URLs, hashes, file paths, hosts, credentials, pairing data, and API responses out of preload IPC, renderer UI, logs, and reports.
- Use `apply_patch` for edits. After every edit run: `rtk npm run test:unit`, the three required `rtk node --check` commands, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.
- Do not stage, commit, merge, push, reset, clean, or modify unrelated work.

---

## File structure

| File | Responsibility |
| --- | --- |
| `DEVICE-COMPATIBILITY.json` | Packaged, maintainer-reviewed baseline catalog containing only device facts and ChromeDriver artifacts. |
| `app/lg-compatibility-catalog.js` | Pure schema validation, immutable cloning, exact profile lookup, and safe public status projection. |
| `app/lg-compatibility-catalog-store.js` | Per-user cached catalog envelope, atomic write, and fallback selection. |
| `app/flow-case-api.js` | Builds and fetches the authenticated compatibility-catalog endpoint through the existing HTTP conventions. |
| `app/lg-toolchain-manifest.js` | Keeps Node/Appium/LG-driver pins and accepts a separately validated ChromeDriver artifact instead of an app-ID-bound static profile. |
| `app/lg-managed-install-dependencies.js` | Validates/downloads/extracts/verifies catalog-approved historic or Chrome-for-Testing ChromeDriver artifacts. |
| `app/lg-managed-install-operations.js` | Stages a matching dynamic ChromeDriver and writes trusted managed-toolchain metadata before atomic activation. |
| `app/lg-toolchain-detector.js` | Reads trusted managed metadata and classifies a selected expected ChromeDriver version as ready or repair-needed. |
| `app/lg-toolchain-installer.js` | Plans and installs the selected catalog artifact only after existing explicit confirmation. |
| `app/lg-desktop-run-preflight.js` | Requires both a selected catalog match and the matching installed managed ChromeDriver before live-run readiness. |
| `app/main.js`, `app/tv-device-ipc.js`, `app/preload.js` | Own catalog service, profile resolution, redacted status/refresh IPC, and narrow renderer bridge. |
| `app/renderer/{index.html,renderer.js,styles.css}` | Renders a compact catalog card, refresh action, and fixed outcomes in SDK configuration. |
| `tests/unit/*compatibility*.test.js` | Covers parsing, persistence, API fetch, dynamic install, IPC redaction, preflight, and renderer behavior. |

### Task 1: Add the baseline catalog and pure catalog contract

**Files:**
- Create: `DEVICE-COMPATIBILITY.json`
- Create: `app/lg-compatibility-catalog.js`
- Create: `tests/unit/lg-compatibility-catalog.test.js`
- Modify: `app/lg-toolchain-manifest.js`
- Modify: `tests/unit/lg-toolchain-manifest.test.js`
- Modify: `package.json`
- Modify: `tests/unit/package-config.test.js`

**Interfaces:**
- Produces `validateLgCompatibilityCatalog(document)` returning a deeply frozen `{profiles}` document.
- Produces `selectChromeDriver(catalog, {model, firmware, platform})` returning `{status: "verified", artifact}` or `{status: "COMPATIBILITY_PROFILE_UNVERIFIED"}`.
- Produces `publicCatalogStatus({source, refreshedAt, catalog})` returning only `{ok, state, source, refreshedAt, profileCount}`.
- Changes `createLgToolchainManifest(...).withChromeDriver(artifact)` to return a cloned bundle with that validated artifact; it does not resolve device facts.

- [ ] **Step 1: Write the failing catalog and packaging tests**

```js
const validCatalog = {
  profiles: [{
    model: "model-a",
    firmware: "firmware-a",
    chromedriver: {
      darwin: {version: "2.36.540469", url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_mac64.zip", archiveName: "chromedriver_mac64.zip", sha256: "a".repeat(64)},
      win32: {version: "2.36.540469", url: "https://chromedriver.storage.googleapis.com/2.36/chromedriver_win32.zip", archiveName: "chromedriver_win32.zip", sha256: "b".repeat(64)},
    },
  }],
};

test("selects only the matching current-platform artifact", () => {
  const catalog = validateLgCompatibilityCatalog(validCatalog);
  const result = selectChromeDriver(catalog, {model: "model-a", firmware: "firmware-a", platform: "win32"});
  assert.equal(result.status, "verified");
  assert.equal(result.artifact.archiveName, "chromedriver_win32.zip");
});

test("rejects a duplicate device pair and incomplete platform artifacts", () => {
  assert.throws(() => validateLgCompatibilityCatalog({...validCatalog, profiles: [validCatalog.profiles[0], validCatalog.profiles[0]]}), /duplicate/i);
  assert.throws(() => validateLgCompatibilityCatalog({profiles: [{...validCatalog.profiles[0], chromedriver: {darwin: validCatalog.profiles[0].chromedriver.darwin}}]}), /win32/i);
});
```

Also add a packaging assertion that `build.files` includes `DEVICE-COMPATIBILITY.json` and a manifest test that a static app-ID profile cannot authorize ChromeDriver.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/lg-compatibility-catalog.test.js tests/unit/lg-toolchain-manifest.test.js tests/unit/package-config.test.js`

Expected: FAIL because the catalog module, package inclusion, and artifact-injection contract do not exist.

- [ ] **Step 3: Implement the smallest catalog contract and baseline**

```js
const PLATFORM_KEYS = new Set(["darwin", "win32"]);
const SHA256 = /^[a-f0-9]{64}$/u;

function selectChromeDriver(catalog, {model, firmware, platform} = {}) {
  const profile = catalog.profiles.find((entry) => entry.model === model && entry.firmware === firmware);
  return profile && PLATFORM_KEYS.has(platform)
    ? {status: "verified", artifact: structuredClone(profile.chromedriver[platform])}
    : {status: "COMPATIBILITY_PROFILE_UNVERIFIED"};
}
```

Validate non-empty model/firmware, one unique model-and-firmware pair, both platform records, lower-case SHA-256, HTTPS URL, archive filename, and an approved official ChromeDriver host. Accept only `chromedriver.storage.googleapis.com` or `storage.googleapis.com` paths rooted at `chrome-for-testing-public`; reject every other host/path. Deep-freeze accepted data. Move the existing audited historical profile and its two artifact records from `app/lg-toolchain-manifest.js` into `DEVICE-COMPATIBILITY.json` without changing their values. Remove the static `TRUSTED_LG_COMPATIBILITY_PROFILES` and `appId` matching requirement. Add `withChromeDriver(artifact)` so the Node/Appium/LG-driver bundle stays pinned while ChromeDriver is supplied only from the catalog contract.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/lg-compatibility-catalog.test.js tests/unit/lg-toolchain-manifest.test.js tests/unit/package-config.test.js`

Expected: PASS; static/static-like raw objects and unapproved URLs must not authorize an artifact.

- [ ] **Step 5: Run the required repository validation**

Run the six required validation commands from Global Constraints.

Expected: unit suite, syntax checks, Playwright list, and diff check all pass.

### Task 2: Fetch, validate, and atomically cache the catalog in the main process

**Files:**
- Create: `app/lg-compatibility-catalog-store.js`
- Create: `app/lg-compatibility-catalog-service.js`
- Create: `tests/unit/lg-compatibility-catalog-store.test.js`
- Create: `tests/unit/lg-compatibility-catalog-service.test.js`
- Modify: `app/flow-case-api.js`
- Modify: `tests/unit/flow-case-api.test.js`
- Modify: `app/main.js`

**Interfaces:**
- Produces `buildDeviceCompatibilityUrl({apiDomain})` → normalized `${domain}/api/v1/device-compatibility`.
- Produces `fetchDeviceCompatibilityCatalog({apiDomain, authorization, timeoutMs, fetchImpl})` → `{ok, catalog}` or existing safe HTTP failure shape.
- Produces `createLgCompatibilityCatalogStore({filePath, fs, now})` with `read()` and `replace(catalog)`.
- Produces `createLgCompatibilityCatalogService({bundledCatalog, store, fetchCatalog, now})` with `status()`, `refresh(request)`, and `select(request)`.

- [ ] **Step 1: Write failing API, storage, and service tests**

```js
test("fetches the catalog through the existing Authorization header", async () => {
  const calls = [];
  await fetchDeviceCompatibilityCatalog({apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500, fetchImpl: async (url, options) => {
    calls.push({url, options});
    return {ok: true, json: async () => validCatalog};
  }});
  assert.equal(calls[0].url, "https://api.example.test/api/v1/device-compatibility");
  assert.equal(calls[0].options.headers.Authorization, "Bearer private");
});

test("retains the previous valid cache when a refresh response is invalid", async () => {
  const service = createLgCompatibilityCatalogService({bundledCatalog: validCatalog, store: memoryStore(validCatalog), fetchCatalog: async () => ({ok: true, catalog: {profiles: []}}), now: () => "2026-07-30T00:00:00.000Z"});
  const result = await service.refresh({apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500});
  assert.deepEqual(result, {ok: false, status: "CATALOG_INVALID"});
  assert.equal((await service.select({model: "model-a", firmware: "firmware-a", platform: "darwin"})).status, "verified");
});
```

Assert that read corruption falls back to bundled data, writes use a temporary file followed by rename, missing API domain/Authorization makes no request, and `status()` never returns artifacts or request data.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/flow-case-api.test.js tests/unit/lg-compatibility-catalog-store.test.js tests/unit/lg-compatibility-catalog-service.test.js`

Expected: FAIL because no catalog API, cache, or service exists.

- [ ] **Step 3: Implement fetch, cache, and service isolation**

```js
function buildDeviceCompatibilityUrl({apiDomain}) {
  return `${normalizeApiDomain(apiDomain)}/api/v1/device-compatibility`;
}

async function refresh({apiDomain, authorization, timeoutMs} = {}) {
  if (!String(apiDomain || "").trim() || !String(authorization || "").trim()) return {ok: false, status: "CATALOG_REFRESH_UNAVAILABLE"};
  const result = await fetchCatalog({apiDomain, authorization, timeoutMs});
  if (!result.ok) return {ok: false, status: "CATALOG_REFRESH_FAILED"};
  let catalog;
  try { catalog = validateLgCompatibilityCatalog(result.catalog); } catch { return {ok: false, status: "CATALOG_INVALID"}; }
  await store.replace(catalog);
  return publicCatalogStatus({source: "cached", refreshedAt: now(), catalog});
}
```

Reuse `requestJson` internally in `flow-case-api.js`; do not add API logs for this request. Store `{refreshedAt, catalog}` at `path.join(app.getPath("userData"), "lg-compatibility-catalog.json")` using temporary write then rename. On read, reject malformed envelopes and fall back to the bundled catalog. Instantiate the service once in `app/main.js` using the packaged root `DEVICE-COMPATIBILITY.json` and the per-user cache path.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/flow-case-api.test.js tests/unit/lg-compatibility-catalog-store.test.js tests/unit/lg-compatibility-catalog-service.test.js`

Expected: PASS, including no-request/no-write failure cases and cache preservation.

- [ ] **Step 5: Run the required repository validation**

Run the six required validation commands from Global Constraints.

Expected: all commands pass.

### Task 3: Route selected catalog artifacts through managed installation and run readiness

**Files:**
- Modify: `app/lg-managed-install-dependencies.js`
- Modify: `app/lg-managed-install-operations.js`
- Modify: `app/lg-toolchain-detector.js`
- Modify: `app/lg-toolchain-installer.js`
- Modify: `app/lg-desktop-run-preflight.js`
- Modify: `app/main.js`
- Modify: `tests/unit/lg-managed-install-dependencies.test.js`
- Modify: `tests/unit/lg-managed-install-operations.test.js`
- Modify: `tests/unit/lg-toolchain-detector.test.js`
- Modify: `tests/unit/lg-toolchain-installer.test.js`
- Modify: `tests/unit/lg-desktop-run-preflight.test.js`

**Interfaces:**
- `createLgToolchainDetector(...).inspect({chromedriverVersion})` returns a ChromeDriver component with `ready`, `missing`, or `repair-needed` for the expected selected artifact.
- `createLgToolchainInstaller(...).install({confirmed, chromedriverArtifact, onProgress})` accepts the artifact only after IPC profile resolution; omission preserves the existing Node/Appium-only install.
- `createLgDesktopRunPreflight({..., compatibilityCatalog, detector})` requires an exact selected artifact and a managed driver with its exact version.

- [ ] **Step 1: Write failing dynamic-driver tests**

```js
test("uses a matching catalog artifact rather than the historical fixed version", async () => {
  const installed = [];
  const installer = createLgToolchainInstaller({platform: "darwin", detector: {inspect: async () => ({state: "missing", components: []})}, installManagedBundle: async (input) => { installed.push(input); return {ok: true}; }});
  await installer.install({confirmed: true, chromedriverArtifact: {version: "120.0", url: "https://storage.googleapis.com/chrome-for-testing-public/120.0/mac-arm64/chromedriver-mac-arm64.zip", archiveName: "chromedriver-mac-arm64.zip", sha256: "a".repeat(64)}});
  assert.equal(installed[0].bundle.components.chromedriver.version, "120.0");
});

test("marks a different installed ChromeDriver as repair-needed", async () => {
  const result = await detector.inspect({chromedriverVersion: "120.0"});
  assert.equal(result.components.find((item) => item.id === "chromedriver").status, "repair-needed");
});
```

Add tests that reject an unapproved vendor URL, preserve the active root after dynamic artifact checksum/version failure, verify a nested Chrome-for-Testing binary by finding exactly one `chromedriver` executable after extraction, and block preflight when the selected device expects a different installed driver.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/lg-managed-install-dependencies.test.js tests/unit/lg-managed-install-operations.test.js tests/unit/lg-toolchain-detector.test.js tests/unit/lg-toolchain-installer.test.js tests/unit/lg-desktop-run-preflight.test.js`

Expected: FAIL because the installer and preflight still use the historic fixed ChromeDriver contract.

- [ ] **Step 3: Implement dynamic artifact staging without weakening verification**

```js
async function install({confirmed, chromedriverArtifact, onProgress} = {}) {
  if (confirmed !== true) return {ok: false, status: "INSTALL_CONFIRMATION_REQUIRED"};
  const bundle = chromedriverArtifact ? manifest.withChromeDriver(chromedriverArtifact) : manifest.bundle();
  const review = await detector.inspect({chromedriverVersion: chromedriverArtifact?.version});
  if (review.state === "ready") return publicReview(review);
  return installManagedBundle({bundle, npmClosure, includeChromeDriver: Boolean(chromedriverArtifact), onProgress});
}
```

Generalize ChromeDriver dependency checks to enforce the catalog artifact's exact version, archive name, HTTPS approved-host/path rule, checksum, and executable output. Do not permit a redirect or any fallback release. After extracting, locate exactly one platform executable named `chromedriver`/`chromedriver.exe`; reject zero or multiple candidates. Write a small trusted, non-secret metadata file into staging with the installed ChromeDriver version before atomic activation. The detector reads only that metadata plus fixed files, and reports `repair-needed` when an expected selected version differs. Inject `compatibilityCatalog.select(...)` and detector inspection into the desktop preflight so readiness requires catalog match plus driver-version match; all of those reads remain local until the existing separate live preflight begins.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/lg-managed-install-dependencies.test.js tests/unit/lg-managed-install-operations.test.js tests/unit/lg-toolchain-detector.test.js tests/unit/lg-toolchain-installer.test.js tests/unit/lg-desktop-run-preflight.test.js`

Expected: PASS; no test may permit an artifact from outside the approved vendor path or a mismatched installed version.

- [ ] **Step 5: Run the required repository validation**

Run the six required validation commands from Global Constraints.

Expected: all commands pass.

### Task 4: Expose catalog status and explicit refresh in SDK configuration

**Files:**
- Modify: `app/tv-device-ipc.js`
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/tv-device-ipc.test.js`
- Modify: `tests/unit/preload.test.js`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Adds `get-lg-compatibility-catalog-status` → fixed public status.
- Adds `refresh-lg-compatibility-catalog` accepting only `{apiDomain, authorization, timeoutMs}` and returning a fixed public status.
- Adds preload methods `getLgCompatibilityCatalogStatus()` and `refreshLgCompatibilityCatalog(request)`.

- [ ] **Step 1: Write failing IPC, preload, and renderer tests**

```js
test("refreshes only through narrow catalog IPC and redacts credentials", async () => {
  const result = await handlers.get("refresh-lg-compatibility-catalog")(undefined, {apiDomain: "https://api.example.test", authorization: "Bearer private", timeoutMs: 500});
  assert.deepEqual(result, {ok: true, state: "available", source: "cached", refreshedAt: "2026-07-30T00:00:00.000Z", profileCount: 1});
  assert.doesNotMatch(JSON.stringify(result), /private|https?:/i);
});

test("renders a compact catalog card and does not refresh until clicked", async () => {
  await controller.loadSdkToolchainStatus();
  assert.match(document.querySelector("#sdk-compatibility-catalog-status").textContent, /catalog/i);
  assert.equal(refreshCalls.length, 0);
  await controller.refreshLgCompatibilityCatalog();
  assert.equal(refreshCalls.length, 1);
});
```

Cover no configured Authorization, refresh failure preserving prior visual status, unverified selected-device copy with no manual download suggestion, and passing the selected artifact only through main-process installation dependencies.

- [ ] **Step 2: Run focused tests to verify red**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js tests/unit/preload.test.js tests/unit/renderer.test.js`

Expected: FAIL because catalog IPC and UI controls do not exist.

- [ ] **Step 3: Implement narrow IPC and compact UI**

```js
ipcMain.handle("refresh-lg-compatibility-catalog", async (_event, request) => {
  const result = await lgCompatibilityCatalog.refresh({
    apiDomain: String(request?.apiDomain || ""),
    authorization: String(request?.authorization || ""),
    timeoutMs: Number(request?.timeoutMs),
  });
  return publicCatalogStatus(result);
});
```

Register the status and refresh handlers beside existing LG toolchain IPC. Update `resolveLgCompatibilityProfile` to return the selected artifact only to `lgToolchainInstaller`, never through renderer IPC. Add the catalog card beneath **Component status**: a short status line, **Update compatibility catalog**, and fixed result copy. The refresh action uses `currentSettings()` to pass the existing API values to preload, disables itself while pending, and never runs during startup or Auto configure. Keep existing Styling tokens and spacing; add no new modal or Settings field.

- [ ] **Step 4: Run focused tests to verify green**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js tests/unit/preload.test.js tests/unit/renderer.test.js`

Expected: PASS with no token, URL, hash, path, or raw response in public data.

- [ ] **Step 5: Update documentation and run final verification**

Modify `README.md`, `AGENTS.md`, `docs/real-tv-appium/architecture.md`, and `docs/real-tv-appium/HANDOFF.md` to document the explicit catalog refresh, per-user cache, model-and-firmware matching, offline fallback, and maintainer ownership. Run `rtk graphify update .`, `rtk graphify check-update .`, then the six required repository validation commands.

Expected: all commands pass. Do not perform a live-TV or real API request while implementing this task.
