# LG-only Real-TV Phase 2 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable, Electron-main-process-only LG webOS Appium foundation for one installed MyTV target while keeping Samsung unsupported and Browser execution unchanged.

**Architecture:** Introduce pure session contracts, non-secret device services, loopback Appium lifecycle management, an LG-only Appium session adapter, and a lock-owning runner. Each boundary is injected and unit-tested; renderer code receives no new capability in this phase.

**Tech Stack:** Node.js CommonJS, `node:test`, Electron main-process modules, Appium HTTP/WebDriver APIs, webOS CLI adapter injection.

## Global Constraints

- Implement LG only: `com.mytvb2c.app` is the sole accepted app ID; Samsung produces `PLATFORM_UNSUPPORTED` and invokes no Samsung tooling.
- Do not add Electron UI, renderer/preload methods, Electron GUI launch, credentials, login/search/playback flows, package deployment, or live TV commands.
- Appium binds only to `127.0.0.1`; only manager-owned child/process groups may be terminated.
- LG requires genuine Appium screenshots and DOM inspection. Do not add screenshot bypasses or synthetic visual sources.
- Secure WebSocket and self-signed TLS use are per-run explicit options; TLS verification is disabled only inside the manager-owned Appium child environment.
- Profiles, events, diagnostics, and logs are redacted. Never persist or return pairing keys, passphrases, credentials, raw host values, PNG proxy payloads, tool paths, or shell commands.
- The LG office-TV host is runtime-only: keep it only in the active in-memory run configuration, never in registry data, documents, retained evidence, or responses.
- Preserve existing Browser runner and flow-case API payload behavior exactly.
- Preserve the dirty worktree. Do not stage or commit; replace every plan commit checkpoint with `rtk git diff --check` plus a status review.
- After every repository edit, run the project-required full validation commands.

---

## File map

| File | Responsibility |
| --- | --- |
| `tests/lib/tv-session/tv-session.js` | Platform-neutral key, capability, and error contract. |
| `tests/lib/tv-session/dom-state.js` | Redacted, bounded DOM normalization. |
| `app/device-registry.js` | Atomic non-secret LG profile persistence and redacted views. |
| `app/device-secret-store.js` | Opaque main-process secret availability boundary. |
| `app/device-lock.js` | In-process profile lock with idempotent release. |
| `app/device-discovery.js` | Read-only injected LG identity/app validation. |
| `app/appium-server-manager.js` | Loopback Appium lifecycle and safe redacted diagnostics. |
| `tests/lib/tv-session/webos-appium-session.js` | Installed-app-only webOS Appium adapter. |
| `app/tv-runner.js` | Immutable LG run resolution, lock, validation, session, and cleanup orchestration. |
| `tests/unit/*` | Contract coverage using only fakes; no live device use. |

### Task 1: Define TV contracts and redacted DOM state

**Files:**
- Create: `tests/lib/tv-session/tv-session.js`
- Create: `tests/lib/tv-session/dom-state.js`
- Create: `tests/unit/tv-session.test.js`

**Interfaces:**
- Produces `TV_CAPABILITIES`, `TvSessionError`, `normalizeRemoteKey(key)`, and `normalizeDomState(value, {secrets})`.
- Later tasks consume `normalizeRemoteKey` and `TvSessionError`; no module here imports Electron, Appium, Playwright, or a vendor CLI.

- [ ] **Step 1: Write the failing contract test**

```js
const {normalizeRemoteKey, TvSessionError} = require("../lib/tv-session/tv-session");
const {normalizeDomState} = require("../lib/tv-session/dom-state");

test("normalizes supported TV remote keys", () => {
  assert.equal(normalizeRemoteKey("Enter"), "ok");
  assert.equal(normalizeRemoteKey("ArrowRight"), "right");
  assert.throws(() => normalizeRemoteKey("Space"), /Unsupported TV remote key/);
});

test("redacts and bounds DOM state", () => {
  const state = normalizeDomState({bodyText: "password=secret", focused: "secret", active: "", screenUrl: "http://example/"}, {secrets: ["secret"]});
  assert.doesNotMatch(state.bodyText + state.focused, /secret/);
  assert.equal(state.screenUrl, "http://example/");
});

test("attaches capability context to session errors", () => {
  const error = new TvSessionError("VISUAL_CAPTURE_UNAVAILABLE", "No genuine screenshot route.", {platform: "lg", model: "model"});
  assert.equal(error.code, "VISUAL_CAPTURE_UNAVAILABLE");
  assert.match(error.message, /lg.*model/i);
});
```

- [ ] **Step 2: Prove the test is red**

Run: `rtk node --test tests/unit/tv-session.test.js`

Expected: module-not-found failure for the new contracts.

- [ ] **Step 3: Implement the minimal pure modules**

```js
const REMOTE_KEYS = Object.freeze({Enter: "ok", Backspace: "back", Escape: "back", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right"});
function normalizeRemoteKey(key) {
  if (!REMOTE_KEYS[key]) throw new Error(`Unsupported TV remote key: ${key}`);
  return REMOTE_KEYS[key];
}
class TvSessionError extends Error {
  constructor(code, message, {platform, model} = {}) {
    super(`${platform || "tv"}${model ? ` ${model}` : ""}: ${message}`);
    this.code = code;
    this.platform = platform;
    this.model = model;
  }
}
```

`normalizeDomState` converts absent values to empty strings, removes all supplied secrets and `password`, `token`, `authorization`, `cookie`, and pairing-key fields, truncates body text at 12,000 characters and the other fields at 2,000 characters.

- [ ] **Step 4: Prove the contract is green**

Run: `rtk node --test tests/unit/tv-session.test.js`

Expected: all three tests pass.

- [ ] **Step 5: Check the bounded change**

Run: `rtk git diff --check && rtk git status --short`

Expected: only the three Task 1 files are new or modified for this task.

### Task 2: Add non-secret LG profiles, secret availability, and local locks

**Files:**
- Create: `app/device-registry.js`
- Create: `app/device-secret-store.js`
- Create: `app/device-lock.js`
- Create: `tests/unit/device-registry.test.js`
- Create: `tests/unit/device-secret-store.test.js`
- Create: `tests/unit/device-lock.test.js`

**Interfaces:**
- `createDeviceRegistry({filePath, fs})` returns async `{list, save, remove}`.
- `createDeviceSecretStore({safeStorage, store})` returns `{hasSecret, setSecret, removeSecret}`.
- `createDeviceLock()` returns `{acquire, isLocked}`; `acquire(id)` returns `{release}`.

- [ ] **Step 1: Write the failing profile, redaction, and lock tests**

```js
test("registry stores only a valid non-secret LG profile", async () => {
  const registry = createDeviceRegistry({filePath: "/devices.json", fs: fakeFs});
  await registry.save({id: "lg-1", label: "LG", platform: "lg", appId: "com.mytvb2c.app", model: "model"});
  assert.deepEqual(await registry.list(), [{id: "lg-1", label: "LG", platform: "lg", appId: "com.mytvb2c.app", model: "model"}]);
});

test("registry rejects secrets and unsupported Samsung", async () => {
  await assert.rejects(registry.save({id: "lg", label: "LG", platform: "lg", appId: "com.mytvb2c.app", pairingKey: "secret"}), /unknown profile field/i);
  await assert.rejects(registry.save({id: "sam", label: "Samsung", platform: "tizen", appId: "PP2MTMRMs9.MyTV"}), /PLATFORM_UNSUPPORTED|ineligible/i);
});

test("lock release is idempotent", () => {
  const lock = createDeviceLock();
  const lease = lock.acquire("lg-1");
  assert.throws(() => lock.acquire("lg-1"), /DEVICE_LOCKED/);
  lease.release(); lease.release();
  assert.equal(lock.isLocked("lg-1"), false);
});
```

- [ ] **Step 2: Prove the tests are red**

Run: `rtk node --test tests/unit/device-registry.test.js tests/unit/device-secret-store.test.js tests/unit/device-lock.test.js`

Expected: module-not-found failures.

- [ ] **Step 3: Implement atomic persistence and opaque secrets**

`save` validates exactly `{id,label,platform,appId,model,modelYear?}`, accepts only `platform: "lg"` plus `appId: "com.mytvb2c.app"`, writes JSON to `${filePath}.tmp`, and atomically renames it. A host belongs only to `validate`/`run` call arguments and is never persisted or returned. `list` never returns raw secret fields. The secret store encrypts opaque values through injected `safeStorage`, and `hasSecret` returns only a boolean.

- [ ] **Step 4: Prove the modules are green**

Run: `rtk node --test tests/unit/device-registry.test.js tests/unit/device-secret-store.test.js tests/unit/device-lock.test.js`

Expected: atomic replacement, redaction, unavailable encryption, lock collision, and release tests pass.

- [ ] **Step 5: Check the bounded change**

Run: `rtk git diff --check && rtk git status --short`

Expected: no user-owned file is reverted or staged.

### Task 3: Implement read-only LG validation and loopback Appium lifecycle

**Files:**
- Create: `app/device-discovery.js`
- Create: `app/appium-server-manager.js`
- Create: `tests/unit/device-discovery.test.js`
- Create: `tests/unit/appium-server-manager.test.js`

**Interfaces:**
- `createDeviceDiscovery({webos, redact})` returns async `{validate}`.
- `validate(profile, {host})` returns `{status, identity, installedApp, diagnostics}` and does not create a session.
- `createAppiumServerManager({spawn, fetch, kill, redact, wait})` returns async `{start}`; `start` resolves `{baseUrl, stop, diagnostics}`.

- [ ] **Step 1: Write the failing read-only and lifecycle tests**

```js
test("LG validation never launches or installs an app", async () => {
  const calls = [];
  const discovery = createDeviceDiscovery({webos: {deviceInfo: async () => ({model: "model", firmware: "fw"}), listApps: async () => [{id: "com.mytvb2c.app", version: "3.5.0"}], launch: () => calls.push("launch"), install: () => calls.push("install")}, redact: (value) => value});
  const result = await discovery.validate({platform: "lg", appId: "com.mytvb2c.app"}, {host: "192.168.1.9"});
  assert.equal(result.status, "ready");
  assert.deepEqual(calls, []);
});

test("Appium manager binds only to loopback and stops only its child", async () => {
  const args = [];
  const manager = createAppiumServerManager({spawn: (_bin, value) => { args.push(value); return fakeChild(); }, fetch: healthyFetch, kill: captureKill, redact: (value) => value, wait: async () => {}});
  const server = await manager.start({port: 4725, appiumBin: "/appium", appiumHome: "/home", driver: "webos"});
  assert.deepEqual(args[0].slice(0, 6), ["server", "--address", "127.0.0.1", "--port", "4725", "--use-drivers"]);
  await server.stop();
  assert.equal(killed[0], fakeChild.pid);
});
```

- [ ] **Step 2: Prove the tests are red**

Run: `rtk node --test tests/unit/device-discovery.test.js tests/unit/appium-server-manager.test.js`

Expected: module-not-found failures.

- [ ] **Step 3: Implement bounded validation and manager cleanup**

`validate` rejects non-LG profiles before calling injected adapters, compares the required app ID against inventory, redacts host/diagnostics, and returns `APP_NOT_INSTALLED` without changing the device. `start` invokes `appium server --address 127.0.0.1 --port <port> --use-drivers webos`, sets an isolated `APPIUM_HOME`, polls `/status`, redacts captured output, and terminates only its returned child on health failure or `stop`.

- [ ] **Step 4: Prove read-only and lifecycle behavior is green**

Run: `rtk node --test tests/unit/device-discovery.test.js tests/unit/appium-server-manager.test.js`

Expected: no launch/install path exists, loopback args are exact, unhealthy child cleanup occurs, and diagnostics redact host/key/payload content.

- [ ] **Step 5: Check the bounded change**

Run: `rtk git diff --check && rtk git status --short`

Expected: only Task 3 files changed.

### Task 4: Implement the installed-app webOS session adapter

**Files:**
- Create: `tests/lib/tv-session/webos-appium-session.js`
- Create: `tests/unit/webos-appium-session.test.js`

**Interfaces:**
- `createWebOsAppiumSession({client, appId, model, secrets})` returns async `{start, readDomState, captureScreenshot, pressKey, reset, close, diagnostics}`.
- Consumes Task 1's `normalizeRemoteKey`, `normalizeDomState`, and `TvSessionError`.
- Produces genuine screenshot data only from the injected Appium `screenshot` command; no fallback exists.

- [ ] **Step 1: Write the failing adapter tests**

```js
test("webOS session rejects an unapproved app identity", () => {
  assert.throws(() => createWebOsAppiumSession({client: fakeClient, appId: "other", model: "model"}), /com\.mytvb2c\.app/);
});

test("webOS session sends normalized keys and redacts DOM", async () => {
  const session = createWebOsAppiumSession({client: fakeClient, appId: "com.mytvb2c.app", model: "model", secrets: ["secret"]});
  await session.start();
  await session.pressKey("ArrowRight");
  assert.deepEqual(fakeClient.executions.at(-1), ["webos: pressKey", [{key: "right"}]]);
  assert.doesNotMatch((await session.readDomState()).bodyText, /secret/);
});

test("webOS session fails without a genuine screenshot", async () => {
  fakeClient.screenshot = async () => { throw new Error("missing"); };
  await assert.rejects(session.captureScreenshot(), (error) => error.code === "VISUAL_CAPTURE_UNAVAILABLE");
});
```

- [ ] **Step 2: Prove the tests are red**

Run: `rtk node --test tests/unit/webos-appium-session.test.js`

Expected: module-not-found failure.

- [ ] **Step 3: Implement only Appium-backed behavior**

`start` creates one normal webOS session with the installed LG app ID and no deployment path. `reset` invokes the adapter's clean-state operation only after identity validation. `readDomState` executes the existing DOM probe through the injected client and normalizes it. `captureScreenshot` calls the Appium screenshot route and raises `VISUAL_CAPTURE_UNAVAILABLE` on any failure. `close` is idempotent and redacts diagnostics.

- [ ] **Step 4: Prove the adapter is green**

Run: `rtk node --test tests/unit/webos-appium-session.test.js`

Expected: approved identity, real Appium command mapping, mandatory screenshot failure, DOM redaction, and idempotent close tests pass.

- [ ] **Step 5: Check the bounded change**

Run: `rtk git diff --check && rtk git status --short`

Expected: the adapter contains no CLI spawning, package install, or fallback capture code.

### Task 5: Orchestrate one immutable LG run and terminal harness contract

**Files:**
- Create: `app/tv-runner.js`
- Create: `tests/run-test-case-tv.spec.js`
- Create: `tests/unit/tv-runner.test.js`
- Modify: `package.json`

**Interfaces:**
- `createTvRunner({registry, discovery, lock, serverManager, sessionFactory, redact})` returns async `{run}`.
- `run({profileId, host, sharedDeviceAcknowledged, secureWebsocket, allowSelfSignedTls})` returns redacted `{status, events, artifactMetadata}`.
- `package.json` adds a terminal-only `test:tv:contract` command that runs `tests/run-test-case-tv.spec.js`; it does not start Electron or a live TV session by default.

- [ ] **Step 1: Write the failing runner and terminal-harness tests**

```js
test("runner refuses Samsung before starting discovery or Appium", async () => {
  await assert.rejects(runner.run({profileId: "sam", host: "192.168.1.9", sharedDeviceAcknowledged: true}), (error) => error.code === "PLATFORM_UNSUPPORTED");
  assert.equal(serverStarts, 0);
});

test("runner releases lock and stops Appium after a session failure", async () => {
  sessionFactory.create = async () => { throw new Error("session failed"); };
  await assert.rejects(runner.run({profileId: "lg", host: "192.168.1.9", sharedDeviceAcknowledged: true}), /session failed/);
  assert.equal(lock.isLocked("lg"), false);
  assert.equal(serverStops, 1);
});

test("terminal harness uses only injected LG fakes", async () => {
  const result = await runTvContractCase(createFakeTvRunner());
  assert.equal(result.status, "passed");
});
```

- [ ] **Step 2: Prove the tests are red**

Run: `rtk node --test tests/unit/tv-runner.test.js tests/run-test-case-tv.spec.js`

Expected: module-not-found failure for the runner and harness.

- [ ] **Step 3: Implement immutable orchestration**

`run` loads a redacted profile, requires `sharedDeviceAcknowledged === true`, rejects non-LG before any vendor/Appium invocation, validates the installed app, acquires the lock, starts the loopback manager, creates the webOS session, requires DOM plus screenshot capability, then closes session, manager, and lock in `finally`. It returns only redacted events and local artifact metadata; it does not submit API results, deploy, or invoke Browser code.

- [ ] **Step 4: Add the terminal-only contract script and prove green**

Add to `package.json`:

```json
"test:tv:contract": "node --test tests/run-test-case-tv.spec.js"
```

Run: `rtk npm run test:tv:contract && rtk node --test tests/unit/tv-runner.test.js`

Expected: injected LG path passes, Samsung path is blocked without side effects, and every failure path releases the lock/manager.

- [ ] **Step 5: Run final project validation**

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
rtk git status --short
```

Expected: all existing Browser contracts remain green, LG-only foundation contracts pass, and no files are staged or committed.

## Plan self-review

- Spec coverage: Tasks 1–5 map respectively to contracts, device boundaries, validation/lifecycle, the LG Appium adapter, and runner/harness completion criteria.
- Safety coverage: every task preserves installed-app-only LG operation, loopback lifecycle, screenshot gate, redaction, and Samsung blocking.
- Scope coverage: no task modifies renderer/preload/main IPC, launches Electron, executes a live vendor command, or adds a product flow.
- Consistency: Task 5 consumes the exact interfaces produced in Tasks 1–4; all live-facing collaborators are injected in tests.
