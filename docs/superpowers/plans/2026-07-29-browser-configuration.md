# Browser Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove bundled Chromium from Electron releases and provide a user-confirmed, project-pinned Playwright Chromium installation in app-private per-user storage.

**Architecture:** Add a small Browser toolchain boundary independent of the LG toolchain. It resolves a managed Chromium root below Electron `userData`, sets that root before loading Playwright, then detects the exact executable through Playwright's public `chromium.executablePath()` API and invokes only that package's CLI after explicit confirmation. Main-process IPC returns fixed statuses and progress; the renderer renders Browser configuration and blocks Browser runs until the managed executable is ready.

**Tech Stack:** Electron main/preload/renderer, CommonJS Node.js, Playwright `1.61.1`, built-in `node:fs/promises`, `node:path`, `node:child_process`, `node:test`, Electron Builder.

## Global Constraints

- Browser-only work. LG-only SDK behavior and all TV safety boundaries are unchanged.
- Pin Playwright to `1.61.1`; never use `latest`, a user-selected executable, system Chrome, or an unpinned browser revision.
- The packaged application must not include `.playwright-browsers` in `extraResources`.
- Managed Chromium must live below Electron `userData`; terminal development scripts may retain the project-local cache.
- Auto configure and status are read-only. Download/install requires a separate explicit renderer confirmation.
- The installer invokes the packaged Playwright CLI without a shell and forces only the app-managed browser root. It must not forward custom browser download-host overrides.
- All renderer IPC responses and progress events are fixed, redacted status values; never expose paths, URLs, subprocess output, environment data, or raw errors.
- A missing browser disables Browser runs and provides a Settings deep-link labelled `Configure Browser`.
- No in-app Chromium update action. A future app release changes the pinned Playwright version.
- Do not contact, pair with, register, validate, or operate a TV. Do not stage, commit, merge, push, reset, or touch unrelated work.
- Use `apply_patch` for edits. After every repository edit run:
  `rtk npm run test:unit`, `rtk node --check app/main.js`, `rtk node --check app/preload.js`, `rtk node --check app/renderer/renderer.js`, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/browser-toolchain.js` | Read-only readiness status for the exact Playwright Chromium executable resolved by an app-owned adapter. |
| `app/browser-toolchain-installer.js` | Confirmed-only, fixed Playwright CLI installation with classified progress and verification. |
| `app/browser-toolchain-ipc.js` | Safe browser status/plan/install IPC handlers and event redaction. |
| `app/browser-run-launcher.js` | Resolves the managed Chromium before a Browser Playwright child may launch. |
| `app/main.js` | Supplies `userData` paths, registers Browser IPC, and prevents Browser runner launch when managed Chromium is missing. |
| `app/preload.js` | Exposes only named Browser configuration methods and a removable progress listener. |
| `app/renderer/{index.html,renderer.js,styles.css}` | Adds Browser configuration, Browser-run CTA, and safe transient progress UI. |
| `scripts/install-playwright-browsers.js` | Remains a terminal-only development cache installer. |
| `package.json` / `README.md` | Removes bundled browser resources, pins Playwright, and documents on-demand app installation. |
| `tests/unit/browser-toolchain*.test.js` | Fake-only detector, installer, and IPC contracts. |
| `tests/unit/renderer.test.js` | Browser configuration and missing-browser UI contracts. |
| `tests/unit/package-config.test.js` | Release package assertion that Chromium is not bundled. |

## Task 1: Establish a pinned managed-browser detector

**Files:**
- Create: `app/browser-toolchain.js`
- Create: `tests/unit/browser-toolchain.test.js`
- Modify: `package.json`
- Modify: `tests/unit/package-config.test.js`

**Interfaces:**
- Produces `createBrowserToolchain({managedRoot, fs, resolveExecutablePath})`.
- `status()` returns only `{ok, state, component}` where `state` is `ready` or `missing` and `component` is `{id: "playwright-chromium", label: "Playwright Chromium", version, status}`.
- `resolve()` returns the executable path only to main-process callers after readiness succeeds.

- [ ] **Step 1: Write detector and package regression tests**

```js
test("reports a missing managed Chromium without exposing its path", async () => {
  const toolchain = createBrowserToolchain({
    managedRoot: "/user-data/browser-tools",
    fs: {stat: async () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; }},
    resolveExecutablePath: () => "/user-data/browser-tools/chromium/chrome",
  });

  assert.deepEqual(await toolchain.status(), {
    ok: true,
    state: "missing",
    component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "missing"},
  });
});

test("release packaging does not copy the browser cache", () => {
  const config = require("../../package.json");
  assert.equal(config.dependencies.playwright, "1.61.1");
  assert.equal(config.build.extraResources, undefined);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `rtk node --test tests/unit/browser-toolchain.test.js tests/unit/package-config.test.js`

Expected: FAIL because `browser-toolchain.js` does not exist and release packaging still declares `.playwright-browsers`.

- [ ] **Step 3: Implement the detector and lean package metadata**

```js
function createBrowserToolchain({managedRoot, fs, resolveExecutablePath, version = "1.61.1"}) {
  async function executable() {
    const target = resolveExecutablePath();
    const entry = await fs.stat(target);
    if (!entry?.isFile?.()) {
      const error = new Error("Managed Playwright Chromium is unavailable.");
      error.code = "BROWSER_UNAVAILABLE";
      throw error;
    }
    return target;
  }

  return {
    async status() {
      try {
        await executable();
        return {ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version, status: "ready"}};
      } catch {
        return {ok: true, state: "missing", component: {id: "playwright-chromium", label: "Playwright Chromium", version, status: "missing"}};
      }
    },
    resolve: executable,
  };
}
```

Set `dependencies.playwright` and the root package-lock dependency entry to `"1.61.1"`, then remove Electron Builder's `extraResources` browser-cache entry. In the Electron main-process adapter, set `PLAYWRIGHT_BROWSERS_PATH` to the app-managed root before the first `require("playwright")`, then call the public `chromium.executablePath()` method. Inject that adapter into the detector; do not use Playwright private APIs or reproduce OS-specific executable paths.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `rtk node --test tests/unit/browser-toolchain.test.js tests/unit/package-config.test.js`

Expected: PASS. The public status contains no managed path and the package has no bundled browser resource.

- [ ] **Step 5: Run the required repository validation set**

Run all six commands in Global Constraints.

Expected: PASS. Leave every changed file unstaged.

## Task 2: Add confirmed-only browser installation and fixed progress

**Files:**
- Create: `app/browser-toolchain-installer.js`
- Create: `tests/unit/browser-toolchain-installer.test.js`

**Interfaces:**
- Consumes `browserToolchain.resolve`, managed root, `process.execPath`, a resolved `playwright/cli` path, and injected `spawn`.
- Produces `install({confirmed, onProgress})` with redacted `{ok, state, component}` responses.
- Emits only `preparing`, `downloading-chromium`, `verifying-chromium`, `complete`, or `{code: "failed", status}`.

- [ ] **Step 1: Write a failing confirmed-install contract**

```js
test("installs the pinned Chromium only after confirmation and emits fixed progress", async () => {
  const events = [];
  const spawnCalls = [];
  const installer = createBrowserToolchainInstaller({
    browserToolchain: {resolve: async () => "/managed/chromium"},
    managedRoot: "/managed",
    nodePath: "/node",
    playwrightCliPath: "/playwright/cli.js",
    spawn(command, args, options) {
      spawnCalls.push({command, args, env: options.env});
      return completedChild(0);
    },
  });

  const response = await installer.install({confirmed: true, onProgress: (event) => events.push(event)});

  assert.deepEqual(events, [
    {code: "preparing"}, {code: "downloading-chromium"}, {code: "verifying-chromium"}, {code: "complete"},
  ]);
  assert.deepEqual(spawnCalls[0].args, ["/playwright/cli.js", "install", "chromium"]);
  assert.equal(spawnCalls[0].env.PLAYWRIGHT_BROWSERS_PATH, "/managed");
  assert.equal("PLAYWRIGHT_DOWNLOAD_HOST" in spawnCalls[0].env, false);
  assert.deepEqual(response, {ok: true, state: "ready", component: {id: "playwright-chromium", label: "Playwright Chromium", version: "1.61.1", status: "ready"}});
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk node --test tests/unit/browser-toolchain-installer.test.js`

Expected: FAIL because the installer module does not exist.

- [ ] **Step 3: Implement the minimal installer**

```js
function spawnPlaywrightInstall({spawn, nodePath, playwrightCliPath, managedRoot}) {
  const env = {...process.env, PLAYWRIGHT_BROWSERS_PATH: managedRoot};
  delete env.PLAYWRIGHT_DOWNLOAD_HOST;
  return spawn(nodePath, [playwrightCliPath, "install", "chromium"], {env, shell: false, stdio: "ignore"});
}
```

Reject a false confirmation before spawning. Convert child errors, non-zero exits, and post-install `resolve()` failures to fixed classified statuses. Observer callback errors are ignored so UI observation cannot change installation behavior. Do not return child output or paths.

- [ ] **Step 4: Run the focused installer test to verify it passes**

Run: `rtk node --test tests/unit/browser-toolchain-installer.test.js`

Expected: PASS, including no-confirmation, failed-child, and failed-verification tests.

- [ ] **Step 5: Run the required repository validation set**

Run all six commands in Global Constraints.

Expected: PASS. Leave every changed file unstaged.

## Task 3: Wire safe Browser IPC and Browser-run gating

**Files:**
- Create: `app/browser-toolchain-ipc.js`
- Create: `app/browser-run-launcher.js`
- Create: `tests/unit/browser-toolchain-ipc.test.js`
- Create: `tests/unit/browser-run-launcher.test.js`
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `tests/unit/preload.test.js`

**Interfaces:**
- Preload exposes `getBrowserToolchainStatus()`, `planBrowserToolchainSetup()`, `installBrowserToolchain({confirmed})`, and `onBrowserToolchainInstallProgress(callback)`.
- Main accepts `browser-toolchain-status`, `browser-toolchain-plan`, and `browser-toolchain-install` only from the renderer.
- `createBrowserRunLauncher({browserToolchain, managedRoot})` produces
  `prepare()` which returns `{ok: true, browsersPath}` or
  `{ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"}` before the main
  process creates the Playwright child.

- [ ] **Step 1: Write failing IPC and gating tests**

```js
test("sends only fixed Browser installer progress to the requesting renderer", async () => {
  const sent = [];
  const handlers = registerBrowserToolchainIpc({
    ipcMain: fakeIpcMain,
    browserInstaller: {install: async ({onProgress}) => {
      onProgress({code: "downloading-chromium", path: "/managed", output: "private"});
      return {ok: true, state: "ready", component: readyComponent};
    }},
  });

  await handlers.install({sender: {send: (_channel, value) => sent.push(value)}}, {confirmed: true});
  assert.deepEqual(sent, [{code: "downloading-chromium"}]);
});

test("does not prepare a Browser run when managed Chromium is missing", async () => {
  const launcher = createBrowserRunLauncher({
    managedRoot: "/managed",
    browserToolchain: {resolve: async () => { throw unavailable(); }},
  });
  const result = await launcher.prepare();
  assert.deepEqual(result, {ok: false, status: "BROWSER_TOOLCHAIN_UNAVAILABLE"});
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `rtk node --test tests/unit/browser-toolchain-ipc.test.js tests/unit/browser-run-launcher.test.js tests/unit/preload.test.js`

Expected: FAIL because browser IPC and preload methods do not exist.

- [ ] **Step 3: Implement narrow IPC, preload, and runner integration**

Register only the named handlers. Sanitize progress through an allowlist and return only component status. In `app/browser-run-launcher.js`, require `browserToolchain.resolve()` before returning the managed root. In `main.js`, derive that root from `app.getPath("userData")`, set it before loading Playwright's public API, instantiate the detector/installer/launcher once, call `launcher.prepare()` before constructing the Browser child environment, and use its returned path as `PLAYWRIGHT_BROWSERS_PATH`. Retain project-local `.playwright-browsers` behavior for terminal scripts only.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `rtk node --test tests/unit/browser-toolchain-ipc.test.js tests/unit/browser-run-launcher.test.js tests/unit/preload.test.js`

Expected: PASS. No renderer contract exposes an executable path or raw child output.

- [ ] **Step 5: Run the required repository validation set**

Run all six commands in Global Constraints.

Expected: PASS. Leave every changed file unstaged.

## Task 4: Add Browser configuration and the missing-browser call to action

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Browser configuration presents a redacted component status, `Auto configure`, and `Install reviewed Chromium`.
- Browser target missing state shows `Configure Browser`, which opens Settings and selects the Browser configuration section.

- [ ] **Step 1: Write renderer tests for Browser setup flow**

```js
test("disables Browser runs and opens Browser configuration when Chromium is missing", async () => {
  const fixture = createRendererFixture();
  fixture.runner.getBrowserToolchainStatus = async () => ({ok: true, state: "missing", component: missingComponent});
  const controller = renderer.createRendererController(fixture);

  await controller.loadBrowserToolchainStatus();
  fixture.elements["configure-browser-button"].dispatchEvent("click");

  assert.equal(fixture.elements["run-button"].disabled, true);
  assert.equal(fixture.elements["settings-modal"].classList.contains("hidden"), false);
  assert.equal(fixture.elements["browser-configuration-panel"].classList.contains("hidden"), false);
});

test("requires confirmation before Browser installation and renders only fixed progress", async () => {
  const fixture = createRendererFixture();
  const requests = [];
  let listener;
  fixture.runner.onBrowserToolchainInstallProgress = (callback) => { listener = callback; return () => {}; };
  fixture.runner.installBrowserToolchain = async (request) => {
    requests.push(request);
    listener({code: "downloading-chromium", path: "/managed", output: "private"});
    return {ok: true, state: "ready", component: readyComponent};
  };
  const controller = renderer.createRendererController(fixture);

  await controller.installBrowserToolchain();

  assert.deepEqual(requests, [{confirmed: true}]);
  assert.match(fixture.elements["browser-install-progress"].textContent, /Downloading reviewed Chromium/i);
  assert.doesNotMatch(fixture.elements["browser-install-progress"].textContent, /managed|private/i);
  assert.match(fixture.elements["browser-component-list"].textContent, /Ready/i);
});
```

- [ ] **Step 2: Run renderer tests to verify they fail**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: FAIL because Browser configuration controls and handlers do not exist.

- [ ] **Step 3: Implement the smallest Settings UI**

Add Browser configuration before LG configuration, reuse the existing component-card and transient-progress visual language, and add a `Configure Browser` button adjacent to the disabled Browser run state. Browser setup calls only Browser IPC; it never invokes LG inspection, installation, target registration, validation, or a TV action. Reset progress when Settings closes, as the existing installer panels do.

- [ ] **Step 4: Run renderer tests to verify they pass**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: PASS. Browser status and progress remain redacted and a ready response re-enables Browser runs.

- [ ] **Step 5: Run the required repository validation set**

Run all six commands in Global Constraints.

Expected: PASS. Leave every changed file unstaged.

## Task 5: Document release behavior and maintain the graph

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`

- [ ] **Step 1: Update documentation**

Replace bundled-browser instructions with Browser configuration instructions: packaged users install the pinned Chromium from Settings; development terminal users may run `npm run browsers:install`; Chromium is stored under app user data for Electron and is not bundled in macOS/Windows artifacts. Record the safe IPC boundary and no-TV scope in architecture and handoff docs.


- [ ] **Step 2: Run full validation checks**

Run: `rtk node --test tests/unit/package-config.test.js`, then all six commands in Global Constraints.

Expected: PASS. Do not create a package build or download Chromium during validation.


- [ ] **Step 3: Update Graphify after code changes**

Run the project's sequential Graphify rebuild workaround, then rerun all six commands and `rtk graphify check-update .`.

Expected: Graph update and all checks PASS. Leave all files unstaged.
