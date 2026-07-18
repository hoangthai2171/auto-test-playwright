# Flow-case API Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable API-backed folder/test-case loading with user-data caching, while moving `APP_URL` and network settings into Settings.

**Architecture:** Keep HTTP and cache access in the Electron main process behind preload IPC. Use small pure modules for API URL/timeout/list normalization and cache replacement, then let the renderer manage settings, folder selection, loading lock, and active cached folder ID. The Playwright entry point will resolve API-downloaded cases from the cache when a folder ID is supplied, while retaining the local fixture path as fallback.

**Tech Stack:** CommonJS JavaScript, Electron IPC, Node 20 `fetch`/`AbortController`, Node `node:test`, Playwright.

## Global Constraints

- `APP_URL` lives in Settings and defaults to `https://html5stage.mytv.vn/`.
- API domain defaults to `http://172.16.240.254:30100`; project ID defaults to `1`; environment defaults to `UI`.
- API timeout defaults to 30 seconds and invalid/non-positive values fall back to 30 seconds.
- Folder option labels use `name`; option values use `fullPath`; cache entries are keyed by folder `id`.
- API requests run in the main process and must not use server-provided JavaScript, selectors, or function names.
- During folder/case API calls, a loading overlay blocks app interaction; timeout failures show an alert and preserve existing data.
- Existing local fixture loading, keyboard-only TV interaction, one-worker Playwright execution, and credential redaction remain intact.
- Never execute deployment scripts under `bash-script/`.

---

### Task 1: Add tested API and cache primitives

**Files:**
- Create: `app/flow-case-api.js`
- Create: `app/test-case-cache.js`
- Test: `tests/unit/flow-case-api.test.js`
- Test: `tests/unit/test-case-cache.test.js`

**Interfaces:**
- `app/flow-case-api.js` produces:
  - `DEFAULT_API_DOMAIN`, `DEFAULT_TIMEOUT_SECONDS`, `DEFAULT_TIMEOUT_MS`.
  - `normalizeApiDomain(value)` → trimmed domain without trailing slash.
  - `normalizeTimeoutMs(value)` → positive numeric seconds converted to milliseconds or the 30-second default.
  - `buildFlowCaseFoldersUrl({apiDomain, projectId})` → URL string.
  - `buildFlowCasesUrl({apiDomain, projectId, folderName, environment})` → URL string with encoded query parameters.
  - `flattenFlowCaseFolders(nodes)` → depth-first array of `{id, name, fullPath}`.
  - `fetchFlowCaseFolders(options)` and `fetchFlowCases(options)` → `{ok: true, folders/cases}` or `{ok: false, message, timeout}`; folder results are already flattened to `{id, name, fullPath}`.
- `app/test-case-cache.js` produces:
  - `readTestCaseCache(cachePath)` → object keyed by folder ID, treating a missing cache as `{}`.
  - `replaceFolderCacheEntry({cachePath, folder, cases})` → atomically replaces only that folder ID and returns the new cache.
  - `readFolderCacheEntry({cachePath, folderId})` → stored entry or `null`.

- [ ] **Step 1: Write the failing API tests.**

Add tests that assert exact URLs, recursive folder flattening, `{data: [...]}` response support, non-2xx errors, and a timeout result when an injected fetch never resolves until its signal aborts:

```js
test("builds encoded folder-case URL and uses the configured environment", () => {
  assert.equal(
    buildFlowCasesUrl({
      apiDomain: "http://api.test/",
      projectId: "1",
      folderName: "/Root/Play kênh",
      environment: "UI",
    }),
    "http://api.test/api/v1/projects/1/flow-cases/by-folder?folderName=%2FRoot%2FPlay+k%C3%AAnh&environment=UI"
  );
});

test("flattens nested folders while retaining each folder identity", () => {
  assert.deepEqual(flattenFlowCaseFolders([
    {id: "1", name: "Root", fullPath: "/Root", children: [
      {id: "2", name: "Child", fullPath: "/Root/Child", children: []},
    ]},
  ]), [
    {id: "1", name: "Root", fullPath: "/Root"},
    {id: "2", name: "Child", fullPath: "/Root/Child"},
  ]);
});

test("reports an API timeout distinctly", async () => {
  const result = await fetchFlowCaseFolders({
    apiDomain: "http://api.test",
    projectId: "1",
    timeoutMs: 5,
    fetchImpl: (_url, {signal}) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), {name: "AbortError"})));
    }),
  });
  assert.deepEqual(result, {ok: false, message: "API request timed out after 5 ms.", timeout: true});
});
```

- [ ] **Step 2: Run the API tests and verify the expected red failure.**

Run: `node --test tests/unit/flow-case-api.test.js`

Expected: FAIL because `app/flow-case-api.js` does not exist yet.

- [ ] **Step 3: Implement the minimal API module.**

Use `URL`, `URLSearchParams`, `AbortController`, and a timer. Clear the timer in every completion path. Return a timeout result only when the module’s timer caused the abort; return HTTP status errors for non-2xx responses and parse list data from a bare array or the requested `data`/`folders`/`cases` envelope.

- [ ] **Step 4: Run the API tests and verify green.**

Run: `node --test tests/unit/flow-case-api.test.js`

Expected: all API URL, list, HTTP error, and timeout tests pass.

- [ ] **Step 5: Write the failing cache tests.**

Use a temporary directory and assert that a missing cache reads as `{}`, replacing folder `12` preserves folder `9`, replacing folder `12` removes its old cases, and the final JSON is valid after the atomic write.

- [ ] **Step 6: Run the cache tests and verify the expected red failure.**

Run: `node --test tests/unit/test-case-cache.test.js`

Expected: FAIL because `app/test-case-cache.js` does not exist yet.

- [ ] **Step 7: Implement atomic cache replacement.**

Read an existing object when present, assign `cache[String(folder.id)] = {folder, cases}`, create the parent directory, write JSON to a sibling temporary path, then rename the temporary path to `cachePath`. Do not mutate or delete unrelated folder keys.

- [ ] **Step 8: Run cache and full unit tests.**

Run: `node --test tests/unit/flow-case-api.test.js tests/unit/test-case-cache.test.js`

Expected: all new tests pass.

---

### Task 2: Connect main-process IPC, cache-backed execution, and preload

**Files:**
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `tests/lib/test-case-source.js`
- Modify: `tests/run-test-case-mytv.spec.js`
- Test: `tests/unit/test-case-source.test.js`

**Interfaces:**
- Preload exposes `loadFlowCaseFolders(settings)` and `loadFlowCases(settings)`.
- Main IPC handlers return `{ok, folders}` or `{ok, cases, folder}` and return `{ok:false, timeout:true}` on timeout.
- `loadCachedTestCases(cachePath, folderId)` validates and returns the cached case list.
- A run payload may include `TEST_CASE_FOLDER_ID`; its presence selects the cache entry, otherwise the local fixture is used.

- [ ] **Step 1: Add a failing cached-source contract test.**

Create a temporary cache containing folder `12` and a valid case, call `loadCachedTestCases(cachePath, "12")`, and assert the case is returned. Assert a missing folder ID throws `Test case cache entry for folder "missing" not found`.

- [ ] **Step 2: Run the source test and verify it fails.**

Run: `node --test tests/unit/test-case-source.test.js`

Expected: FAIL because `loadCachedTestCases` is not exported.

- [ ] **Step 3: Implement cached case loading.**

Read the JSON cache entry, require an object entry with an array `cases`, and pass that list through the existing `validateTestCaseList` before returning it. Export the new loader without changing local fixture behavior.

- [ ] **Step 4: Run the source tests and verify green.**

Run: `node --test tests/unit/test-case-source.test.js`

Expected: all local and cache-source tests pass.

- [ ] **Step 5: Add main IPC handlers and cache-aware run environment.**

In `app/main.js`:

```js
const {fetchFlowCaseFolders, fetchFlowCases, normalizeTimeoutMs} = require("./flow-case-api");
const {replaceFolderCacheEntry} = require("./test-case-cache");
const {loadLocalTestCases, loadCachedTestCases, findTestCaseById} = require("../tests/lib/test-case-source");

function testCasesCachePath() {
  return path.join(app.getPath("userData"), "testcases-cache.json");
}

ipcMain.handle("load-flow-case-folders", async (_event, settings = {}) => {
  return fetchFlowCaseFolders({
    apiDomain: settings.API_DOMAIN,
    projectId: settings.PROJECT_ID,
    timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
  });
});

ipcMain.handle("load-flow-cases", async (_event, settings = {}) => {
  const result = await fetchFlowCases({
    apiDomain: settings.API_DOMAIN,
    projectId: settings.PROJECT_ID,
    folderName: settings.FOLDER_NAME,
    environment: settings.ENVIRONMENT,
    timeoutMs: normalizeTimeoutMs(settings.API_TIMEOUT_SECONDS),
  });
  if (!result.ok) return result;
  const folder = {id: settings.FOLDER_ID, name: settings.FOLDER_NAME_LABEL, fullPath: settings.FOLDER_NAME};
  const validatedCases = validateTestCaseList(result.cases, "flow-case API");
  await replaceFolderCacheEntry({cachePath: testCasesCachePath(), folder, cases: validatedCases});
  return {ok: true, folder, cases: validatedCases.map(sanitizeCaseForUi), source: "api"};
});
```

Import `validateTestCaseList` from `../tests/lib/test-case-schema` alongside the
source-loader imports.

Use the existing `sanitizeCaseForUi` for returned cases. In `run-test`, choose `loadCachedTestCases(testCasesCachePath(), values.TEST_CASE_FOLDER_ID)` when a folder ID is supplied, otherwise choose `loadLocalTestCases(fixturePath)`. Set `TEST_CASE_CACHE_PATH` and `TEST_CASE_FOLDER_ID` in the child environment only for cache-backed runs.

- [ ] **Step 6: Update the generic Playwright source selection.**

In `tests/run-test-case-mytv.spec.js`, choose:

```js
const cases = process.env.TEST_CASE_FOLDER_ID
  ? await loadCachedTestCases(process.env.TEST_CASE_CACHE_PATH, process.env.TEST_CASE_FOLDER_ID)
  : await loadLocalTestCases(fixturePath);
const source = process.env.TEST_CASE_FOLDER_ID ? "api-cache" : "local";
await runTestCase(page, testInfo, testCase, {source, APP_URL: options.APP_URL});
```

- [ ] **Step 7: Update preload methods.**

Expose only the two structured methods:

```js
loadFlowCaseFolders: (settings) => ipcRenderer.invoke("load-flow-case-folders", settings),
loadFlowCases: (settings) => ipcRenderer.invoke("load-flow-cases", settings),
```

- [ ] **Step 8: Run source and syntax checks.**

Run: `node --test tests/unit/test-case-source.test.js`

Run: `node --check app/main.js && node --check app/preload.js && node --check tests/run-test-case-mytv.spec.js`

Expected: tests pass and all checks exit successfully.

---

### Task 3: Replace sidebar APP_URL with folders and add Settings/network controls

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/styles.css`
- Modify: `app/renderer/renderer.js`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Renderer settings keys are `APP_URL`, `API_DOMAIN`, `PROJECT_ID`, `ENVIRONMENT`, `API_TIMEOUT_SECONDS`, and `PREVIEW_TYPE` under `mytv-auto-test-settings`.
- Controller exposes `loadFolders()` and `loadCasesFromFolder()` for tests/bootstrap.
- Run payloads include `APP_URL`, `PREVIEW_TYPE`, and `TEST_CASE_FOLDER_ID` when the active case list came from a downloaded folder.

- [ ] **Step 1: Extend the fake renderer fixture and add failing UI tests.**

Add fake elements for `folder-select`, `refresh-folders-button`, `get-test-cases-button`, `api-loading-overlay`, `settings-app-url-input`, `api-domain-input`, `project-id-input`, `environment-select`, and `api-timeout-input`. Add tests asserting:

```js
test("loads and renders folders by name with fullPath values", async () => {
  const fixture = createRendererFixture();
  fixture.runner.loadFlowCaseFolders = async () => ({ok: true, folders: [
    {id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"},
  ]});
  const controller = renderer.createRendererController(fixture);
  await controller.loadFolders();
  const option = fixture.elements["folder-select"].querySelector("option");
  assert.equal(option.textContent, "Play kênh");
  assert.equal(option.value, "/Root/Play kênh");
  assert.equal(option.dataset.folderId, "12");
});

test("downloads selected-folder cases and includes the folder ID in runs", async () => {
  const fixture = createRendererFixture();
  fixture.runner.loadFlowCases = async (values) => ({ok: true, folder: {
    id: values.FOLDER_ID, name: "Play kênh", fullPath: values.FOLDER_NAME,
  }, cases: [{id: "case-1", name: "Remote case", actions: []}]});
  const controller = renderer.createRendererController(fixture);
  controller.renderFolders([{id: "12", name: "Play kênh", fullPath: "/Root/Play kênh"}]);
  fixture.elements["folder-select"].value = "/Root/Play kênh";
  await controller.loadCasesFromFolder();
  assert.match(fixture.elements["test-case-list"].textContent, /Remote case/);
  assert.equal(controller.getActiveFolderId(), "12");
});

test("shows timeout alerts and always removes the loading overlay", async () => {
  const fixture = createRendererFixture();
  fixture.runner.loadFlowCaseFolders = async () => ({ok: false, timeout: true, message: "timed out"});
  const alerts = [];
  fixture.windowRef.alert = (message) => alerts.push(message);
  const controller = renderer.createRendererController(fixture);
  await controller.loadFolders();
  assert.equal(fixture.elements["api-loading-overlay"].classList.contains("hidden"), true);
  assert.match(alerts[0], /timed out/i);
});

test("markup contains the folder, settings, and API loading controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../app/renderer/index.html"), "utf8");
  [
    "folder-select", "refresh-folders-button", "get-test-cases-button",
    "settings-app-url-input", "api-domain-input", "project-id-input",
    "environment-select", "api-timeout-input", "api-loading-overlay",
  ].forEach((id) => assert.match(html, new RegExp(`id=\"${id}\"`)));
  assert.doesNotMatch(html, /id=\"app-url-input\"/);
});
```

- [ ] **Step 2: Run the renderer tests and verify the expected red failure.**

Run: `node --test tests/unit/renderer.test.js`

Expected: FAIL because the new elements/controller methods do not exist.

- [ ] **Step 3: Add the markup and styles.**

Remove the sidebar `app-url-input`. Add a folder section at that location with `select#folder-select`, `button#refresh-folders-button` using `aria-label="Refresh folders"`, and `button#get-test-cases-button`. Add a Settings Connection section with the four connection controls and a Network config section with `input#api-timeout-input type="number" min="1" step="1"`. Add `#api-loading-overlay` with a CSS spinner and a status label. The overlay must be fixed, full-screen, above modals, and use `pointer-events: all` while visible.

- [ ] **Step 4: Implement settings state and API loading lock.**

Refactor `loadPreviewSettings` into a settings loader that reads the existing storage key, applies defaults, and fills all new settings controls. Refactor the save handler to persist all six settings keys. Add `beginApiRequest`/`endApiRequest` with a depth counter; while depth is positive, remove `hidden` from the overlay, set `aria-busy="true"`, blur the active element, and install a capture-phase keydown blocker. Always call `endApiRequest` in `finally`.

- [ ] **Step 5: Implement folders and remote case loading.**

Add `renderFolders(folders)`, a `Map` from fullPath to folder, `loadFolders()`, and `loadCasesFromFolder()`. `renderFolders` creates options with exact `textContent = folder.name`, `value = folder.fullPath`, and `dataset.folderId = String(folder.id)`. `loadFolders` calls `api.loadFlowCaseFolders(currentSettings())`; `loadCasesFromFolder` calls `api.loadFlowCases` with `FOLDER_ID`, `FOLDER_NAME`, `FOLDER_NAME_LABEL`, and the current API settings. On success it sets `activeFolderId`, calls `renderCaseList(response.cases)`, and leaves the cache operation to main IPC. On timeout call `windowRef.alert`, keep existing folders/cases, and otherwise set the existing inline error message.

- [ ] **Step 6: Include the active folder in execution and bootstrap API loading.**

Add `TEST_CASE_FOLDER_ID: activeFolderId || ""` to the per-case run values. Wire refresh and Get buttons, disable Get until a folder is selected, and call `loadFolders()` during bootstrap after settings are loaded. Keep initial local `loadCases()` so the existing fixture remains the fallback when the API is unavailable.

- [ ] **Step 7: Run renderer tests and full unit tests.**

Run: `node --test tests/unit/renderer.test.js`

Run: `npm run test:unit`

Expected: the new folder/settings/loading tests and all existing unit tests pass.

---

### Task 4: Update project documentation and verify the complete change

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Test: `tests/unit/renderer.test.js`

**Interfaces:**
- Documentation must describe API settings, folder loading, cache location/keying, timeout behavior, and the cache-backed run source.

- [ ] **Step 1: Document the new workflow.**

Update `README.md` and the relevant architecture/environment sections of `AGENTS.md` to state that the app loads folders/cases through main-process IPC, stores successful downloaded cases in `<userData>/testcases-cache.json` keyed by folder ID, uses `UI` by default, and uses a configurable 30-second API timeout with a blocking spinner and timeout alert.

- [ ] **Step 2: Run final verification.**

Run: `npm run test:unit`

Run: `node --check app/main.js && node --check app/preload.js && node --check app/renderer/renderer.js`

Run: `npx playwright test tests/run-test-case-mytv.spec.js --list`

Run: `rtk git diff --check`

Expected: unit tests pass, syntax checks pass, Playwright lists the generic test without running a live app, and diff check is clean. Live API/Electron smoke testing remains environment-dependent and must be reported separately if unavailable.

- [ ] **Step 3: Commit the implementation.**

Stage only the implementation files and documentation, leaving the user-provided untracked `API-SPEC.md` untouched, then commit:

```bash
git add app tests README.md AGENTS.md
git commit -m "feat: load test cases from flow folders"
```
