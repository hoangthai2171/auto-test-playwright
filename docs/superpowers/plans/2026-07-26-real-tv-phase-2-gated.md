# Deferred Real-TV Appium Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trusted, main-process-only real-TV runner foundation after both pilot POCs pass their documented gates.

**Architecture:** Keep Browser execution unchanged. Add small, injection-tested main-process modules for non-secret device profiles, secret availability, local locks, vendor-aware validation, loopback Appium lifecycle, and a platform-neutral `TvSession` boundary. Platform adapters must send real remote keys and read mandatory DOM state; genuine screenshot capability is optional only for Samsung models that declare it unavailable, never synthetic.

**Tech Stack:** Node.js CommonJS, Electron main/preload IPC, `node:test`, Appium HTTP/WebDriver APIs, existing MyTV test-case contracts.

## Global Constraints

- **Execution gate:** Do not begin Task 1 until both named pilot POCs are recorded in `docs/real-tv-appium/HANDOFF.md` and the user explicitly authorizes Phase 2 implementation.
- Phase 2 is macOS/Windows main-process infrastructure; it adds no Electron renderer UI and runs no physical-TV/vendor command during unit work.
- Samsung production ID `PP2MTMRMs9.MyTV` is permanently ineligible. Samsung tests use `PP2MTMRMs8.MyTV` or another approved distinct test ID.
- Never return credentials, pairing tokens, vendor passphrases, executable paths, Appium capabilities, or shell commands to renderer code or logs.
- Retain Browser runner behavior and the existing flow-case API payload exactly.
- Screenshots and DOM diagnostics are local/redacted only. Do not add html2canvas, DOM, HDMI, camera, or synthetic image fallbacks.
- Do not stage or commit any work unless the user explicitly asks. Preserve unrelated worktree changes, including `docs/superpowers/` working notes.

---

### Task 0: Prove that implementation is authorized

**Files:**
- Read: `docs/real-tv-appium/HANDOFF.md`
- Read: `docs/real-tv-appium/phases.md`
- Read: `docs/real-tv-appium/architecture.md`
- Read: `docs/real-tv-appium/poc-runbook.md`
- Read: the two retained local pilot manifests

**Interfaces:**
- Consumes: phase-1 evidence and explicit user authorization.
- Produces: a written implementation-start decision; no source artifact changes.

- [ ] **Step 1: Check the evidence gate before opening implementation files**

Run:

```bash
rtk git status --short
rtk proxy rg -n "Samsung DOM-only semantic POC result|LG Phase 1|Phase 2" docs/real-tv-appium/HANDOFF.md docs/real-tv-appium/phases.md
```

Expected: the worktree is understood and both pilot POC records exist. Stop immediately if LG evidence is missing, the Samsung pilot is not the named pilot, or Phase 2 lacks explicit authorization.

- [ ] **Step 2: Record the go/no-go result without changing runtime code**

Use this exact decision format in the implementation handoff:

```text
Phase 2 execution gate: GO | NO-GO
Samsung named-pilot POC manifest: <local redacted manifest id or missing>
LG named-pilot POC manifest: <local redacted manifest id or missing>
Explicit user authorization: yes | no
Reason: <one evidence-backed sentence>
```

Expected: only `GO` proceeds to Task 1. A `NO-GO` ends the implementation session with no code, TV, vendor, or account action.

### Task 1: Establish TV session contracts and redacted DOM state

**Files:**
- Create: `tests/lib/tv-session/tv-session.js`
- Create: `tests/lib/tv-session/dom-state.js`
- Create: `tests/unit/tv-session.test.js`

**Interfaces:**
- Produces: `TV_CAPABILITIES`, `TvSessionError`, `normalizeRemoteKey(key)`, and `normalizeDomState(value, {secrets})`.
- Consumes: platform-specific adapter output only; it does not import Electron, Appium, Playwright, or vendor CLI modules.
- Returns: normalized DOM `{bodyText, focused, active, screenUrl}` and capability errors that carry `code`, `platform`, and `model`.

- [ ] **Step 1: Write failing contract tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalizeRemoteKey, TvSessionError} = require("../../tests/lib/tv-session/tv-session");
const {normalizeDomState} = require("../../tests/lib/tv-session/dom-state");

test("normalizes TV remote keys and rejects unsupported values", () => {
  assert.equal(normalizeRemoteKey("Enter"), "ok");
  assert.equal(normalizeRemoteKey("Backspace"), "back");
  assert.throws(() => normalizeRemoteKey("Space"), /Unsupported TV remote key/);
});

test("redacts secrets from normalized DOM state", () => {
  const dom = normalizeDomState({bodyText: "password=secret", focused: "secret", active: "", screenUrl: "http://tv/"}, {secrets: ["secret"]});
  assert.doesNotMatch(dom.bodyText, /secret/);
  assert.doesNotMatch(dom.focused, /secret/);
});

test("capability errors name the failed TV capability", () => {
  const error = new TvSessionError("VISUAL_CAPTURE_UNAVAILABLE", "No genuine Appium screenshot route.", {platform: "tizen", model: "QA65Q70TAKXXV"});
  assert.equal(error.code, "VISUAL_CAPTURE_UNAVAILABLE");
  assert.match(error.message, /tizen.*QA65Q70TAKXXV/i);
});
```

- [ ] **Step 2: Run the focused test to prove RED**

Run: `rtk proxy node --test tests/unit/tv-session.test.js`

Expected: failure because the contract modules do not exist.

- [ ] **Step 3: Implement the minimal pure contract modules**

```js
// tests/lib/tv-session/tv-session.js
const TV_CAPABILITIES = Object.freeze({DOM_INSPECTION: "domInspection", VISUAL_CAPTURE: "visualCapture"});
const REMOTE_KEYS = Object.freeze({Enter: "ok", Backspace: "back", Escape: "back", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right"});

class TvSessionError extends Error {
  constructor(code, message, {platform, model} = {}) {
    super(`${platform || "tv"}${model ? ` ${model}` : ""}: ${message}`);
    this.code = code;
    this.platform = platform;
    this.model = model;
  }
}

function normalizeRemoteKey(key) {
  const normalized = REMOTE_KEYS[key];
  if (!normalized) throw new Error(`Unsupported TV remote key: ${key}`);
  return normalized;
}

module.exports = {TV_CAPABILITIES, TvSessionError, normalizeRemoteKey};
```

`dom-state.js` must convert missing values to empty strings, redact every provided secret, cap `bodyText` at 12,000 characters and the other fields at 2,000 characters, and never retain raw cookie/token/password fields.

- [ ] **Step 4: Run the focused test to prove GREEN**

Run: `rtk proxy node --test tests/unit/tv-session.test.js`

Expected: all three contracts pass.

### Task 2: Build non-secret profiles, secret availability, and local locking

**Files:**
- Create: `app/device-registry.js`
- Create: `app/device-secret-store.js`
- Create: `app/device-lock.js`
- Create: `tests/unit/device-registry.test.js`
- Create: `tests/unit/device-secret-store.test.js`
- Create: `tests/unit/device-lock.test.js`

**Interfaces:**
- `createDeviceRegistry({filePath, fs})` → `{list, save, remove}`.
- `createDeviceSecretStore({safeStorage, store})` → `{hasSecret, setSecret, removeSecret}`; list/save profile methods never expose a raw secret.
- `createDeviceLock()` → `{acquire(deviceId), release(deviceId), isLocked(deviceId)}`.

- [ ] **Step 1: Write failing profile and lock tests**

```js
test("rejects the Samsung production app ID in a device profile", async () => {
  const registry = createDeviceRegistry({filePath: "/tmp/devices.json", fs: fakeFs});
  await assert.rejects(
    registry.save({id: "samsung-1", platform: "tizen", appId: "PP2MTMRMs9.MyTV", label: "Lab Samsung"}),
    /permanently ineligible/i
  );
});

test("returns redacted profiles without a pairing token", async () => {
  const registry = createDeviceRegistry({filePath: "/tmp/devices.json", fs: fakeFs});
  await registry.save({id: "samsung-1", platform: "tizen", appId: "PP2MTMRMs8.MyTV", label: "Lab Samsung"});
  assert.deepEqual(await registry.list(), [{id: "samsung-1", platform: "tizen", appId: "PP2MTMRMs8.MyTV", label: "Lab Samsung", lastKnownHost: undefined}]);
});

test("releases a local lock after a terminal path", () => {
  const lock = createDeviceLock();
  const lease = lock.acquire("samsung-1");
  assert.equal(lock.isLocked("samsung-1"), true);
  lease.release();
  assert.equal(lock.isLocked("samsung-1"), false);
});
```

- [ ] **Step 2: Run the focused contracts to prove RED**

Run: `rtk proxy node --test tests/unit/device-registry.test.js tests/unit/device-secret-store.test.js tests/unit/device-lock.test.js`

Expected: failure because the modules are missing.

- [ ] **Step 3: Implement validation and atomic persistence**

The registry accepts only `{id, label, platform, appId, model, modelYear, lastKnownHost?}`. It rejects unknown keys, a missing ID/label/platform/app ID, a Samsung production ID, non-string hosts, and unsupported platforms. Its `save` method writes `<filePath>.tmp`, then renames it to `filePath`; it replaces only the matching profile ID.

`device-secret-store.js` stores an opaque encrypted payload by `deviceId:secretName`, returns a boolean from `hasSecret`, and throws when Electron `safeStorage` is unavailable or encryption fails. It must not add secret fields to a returned profile.

`device-lock.js` returns a release closure that is idempotent and rejects a second acquire for the same device with `DEVICE_LOCKED`.

- [ ] **Step 4: Run focused contracts to prove GREEN**

Run: `rtk proxy node --test tests/unit/device-registry.test.js tests/unit/device-secret-store.test.js tests/unit/device-lock.test.js`

Expected: registry, secret-boundary, atomic-write, and lock-release tests pass without Electron or a real device.

### Task 3: Add loopback-only Appium lifecycle management

**Files:**
- Create: `app/appium-server-manager.js`
- Create: `tests/unit/appium-server-manager.test.js`

**Interfaces:**
- `createAppiumServerManager({spawn, fetch, kill, redact})` → `{start, stop}`.
- `start({port, appiumBin, appiumHome})` resolves `{baseUrl, stop}` only after `/status` is healthy.
- `stop()` terminates the manager-owned child/process group and does not kill unrelated Appium processes.

- [ ] **Step 1: Write the failing process-construction test**

```js
test("starts Appium only on loopback and waits for health", async () => {
  const calls = [];
  const manager = createAppiumServerManager({
    spawn: (_bin, args) => { calls.push(args); return fakeChild(); },
    fetch: async (url) => ({ok: url === "http://127.0.0.1:4723/status", json: async () => ({value: {ready: true}})}),
    kill: () => {},
    redact: (value) => value,
  });
  const server = await manager.start({port: 4723, appiumBin: "/tools/appium", appiumHome: "/tmp/appium-home"});
  assert.deepEqual(calls[0].slice(0, 6), ["server", "--address", "127.0.0.1", "--port", "4723", "--use-drivers"]);
  assert.equal(server.baseUrl, "http://127.0.0.1:4723");
});
```

- [ ] **Step 2: Run the test to prove RED**

Run: `rtk proxy node --test tests/unit/appium-server-manager.test.js`

Expected: failure because the manager module is missing.

- [ ] **Step 3: Implement bounded lifecycle and redacted logs**

`start` spawns `appium server --address 127.0.0.1 --port <port> --use-drivers <driver>`, captures only redacted log chunks, polls `/status` with a bounded timeout, and rejects if the child exits or reports unhealthy. `stop` sends `SIGTERM`, waits a bounded interval, then sends `SIGKILL` only to the manager-owned child/process group if needed.

The manager returns no raw command, environment, or Appium log to a renderer-facing caller; diagnostics are redacted strings suitable for local artifacts only.

- [ ] **Step 4: Run the lifecycle tests to prove GREEN**

Run: `rtk proxy node --test tests/unit/appium-server-manager.test.js`

Expected: loopback construction, health failure, child exit, redaction, graceful stop, and forced-stop tests pass through fakes.

### Task 4: Implement bounded device discovery and validation orchestration

**Files:**
- Create: `app/device-discovery.js`
- Create: `tests/unit/device-discovery.test.js`

**Interfaces:**
- `createDeviceDiscovery({tizen, webos, registry, redact})` → `{scan, validate}`.
- `scan({platform})` returns ephemeral redacted discovery records; it never saves a profile.
- `validate(profile, {host})` returns `{status, installedApp, needsPairing, diagnostics}` without starting an Appium session or reset.

- [ ] **Step 1: Write failing Samsung discovery tests**

```js
test("Samsung scan uses connected SDB targets instead of a LAN sweep", async () => {
  const discovery = createDeviceDiscovery({
    tizen: {listConnected: async () => [{serial: "192.168.1.42:26101", model: "QA65Q70TAKXXV"}]},
    webos: {}, registry: {list: async () => []}, redact: (value) => value,
  });
  const result = await discovery.scan({platform: "tizen"});
  assert.equal(result[0].platform, "tizen");
  assert.equal(result[0].host, "192.168.1.x");
});

test("validation blocks a Samsung production app before reset or Appium", async () => {
  const discovery = createDeviceDiscovery({tizen: fakeTizen, webos: {}, registry: fakeRegistry, redact: (value) => value});
  await assert.rejects(
    discovery.validate({platform: "tizen", appId: "PP2MTMRMs9.MyTV", id: "bad"}, {host: "192.168.1.42"}),
    /permanently ineligible/i
  );
});
```

- [ ] **Step 2: Run the focused test to prove RED**

Run: `rtk proxy node --test tests/unit/device-discovery.test.js`

Expected: failure because discovery orchestration does not exist.

- [ ] **Step 3: Implement platform-bounded discovery and identity checks**

For Tizen, call only the injected `listConnected`, `connect(host)`, and `listInstalledApps` adapters; do not enumerate the subnet. For webOS, call only injected vendor-target list/validate adapters. Redact host, serial, paths, and vendor diagnostics before returning values. Validate expected installed app identity/version before exposing a `ready` state, and return `needs_pairing` rather than retrying or handling a pairing prompt.

- [ ] **Step 4: Run the focused test to prove GREEN**

Run: `rtk proxy node --test tests/unit/device-discovery.test.js`

Expected: direct-IP behavior, no-save scan behavior, Samsung production-ID blocking, app mismatch, and pairing-needed cases pass through injected fakes.

### Task 5: Add Tizen and webOS Appium session adapters behind the shared contract

**Files:**
- Create: `tests/lib/tv-session/tizen-appium-session.js`
- Create: `tests/lib/tv-session/webos-appium-session.js`
- Create: `tests/unit/tizen-appium-session.test.js`
- Create: `tests/unit/webos-appium-session.test.js`

**Interfaces:**
- Both adapters implement `start`, `resetAppState`, `pressKey`, `getDomState`, `waitForDomState`, `screenshot`, `collectDiagnostics`, `cleanup`, and `close`.
- `screenshot()` returns genuine Appium bytes only when `visualCapture: available`; unavailable Samsung capability throws `VISUAL_CAPTURE_UNAVAILABLE`.
- All adapter dependencies are injected HTTP/client functions; no test reaches a TV, SDB, webOS CLI, or Appium process.

- [ ] **Step 1: Write failing adapter contracts**

```js
test("Tizen maps Enter to a real Tizen remote command", async () => {
  const commands = [];
  const session = createTizenAppiumSession({execute: async (script, args) => commands.push({script, args}), visualCapture: "unavailable"});
  await session.pressKey("Enter");
  assert.deepEqual(commands[0], {script: "tizen: pressKey", args: [{key: "KEY_ENTER"}]});
  await assert.rejects(session.screenshot(), {code: "VISUAL_CAPTURE_UNAVAILABLE"});
});

test("webOS normalizes DOM state without direct element clicks", async () => {
  const scripts = [];
  const session = createWebOsAppiumSession({execute: async (script) => { scripts.push(script); return {bodyText: "Home"}; }, visualCapture: "available"});
  const dom = await session.getDomState();
  assert.equal(dom.bodyText, "Home");
  assert.equal(scripts.some((script) => /click\(/i.test(script)), false);
});
```

- [ ] **Step 2: Run the focused adapter tests to prove RED**

Run: `rtk proxy node --test tests/unit/tizen-appium-session.test.js tests/unit/webos-appium-session.test.js`

Expected: failure because neither adapter module exists.

- [ ] **Step 3: Implement only remote-key and DOM/capability behavior**

Implement Tizen remote commands with `tizen: pressKey` and document the mapping in code. Implement the webOS mapping through the injected driver command interface. Both adapters may execute read-only DOM scripts and authorized app-state reset commands, but must not call element `.click()`, direct text injection, or arbitrary server-provided JavaScript.

Keep `screenshot` narrowly delegated to the Appium screenshot endpoint and surface a capability error when unavailable; do not add a fallback transport.

- [ ] **Step 4: Run the focused adapter tests to prove GREEN**

Run: `rtk proxy node --test tests/unit/tizen-appium-session.test.js tests/unit/webos-appium-session.test.js`

Expected: key mapping, DOM redaction, reset ordering, capability errors, and cleanup/close behavior pass through fakes.

### Task 6: Orchestrate one protected TV case without changing Browser semantics

**Files:**
- Create: `app/tv-runner.js`
- Create: `tests/run-test-case-tv.spec.js`
- Create: `tests/unit/tv-runner.test.js`
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- `createTvRunner({registry, secrets, locks, discovery, appium, sessions, report})` → `run(config)` and `stop()`.
- `run(config)` requires `{target: {kind: "tizen" | "webos", deviceId, app: {mode: "installed", appId}}, caseId, sharedAcknowledgedAt?}` and returns normalized redacted events.
- Existing `runTest(values)` keeps its Browser payload and behavior when `target` is omitted or `{kind: "browser"}`.

- [ ] **Step 1: Write failing orchestration tests**

```js
test("TV runner requires shared-manual acknowledgement before acquiring a session", async () => {
  const runner = createTvRunner(fakes);
  await assert.rejects(
    runner.run({caseId: "case-1", target: {kind: "tizen", deviceId: "shared-tv", app: {mode: "installed", appId: "PP2MTMRMs8.MyTV"}}}),
    /manual coordination acknowledgement/i
  );
  assert.equal(fakes.sessions.create.calls.length, 0);
});

test("Browser run payload remains unchanged", async () => {
  const result = normalizeRunTarget({TEST_CASE_ID: "case-1", APP_URL: "https://example.test/"});
  assert.deepEqual(result, {kind: "browser"});
});
```

- [ ] **Step 2: Run the focused test to prove RED**

Run: `rtk proxy node --test tests/unit/tv-runner.test.js`

Expected: failure because the runner and target normalization do not exist.

- [ ] **Step 3: Implement immutable config, local lock, and cleanup precedence**

Resolve profile/identity before Appium start, then acquire the local lock, start the loopback server, create the adapter, reset the selected installed test app, and execute the trusted TV-case entry point. In `finally`, always close the session, stop only the manager-owned server, release the lock, and preserve the original business failure over a later cleanup failure.

In `app/main.js`, keep the Browser branch intact and route only validated TV targets to `tv-runner`. In `app/preload.js`, expose only structured redacted device/validation/run methods—never an arbitrary command or capability object. Update renderer unit tests only to prove the Browser IPC payload remains unchanged; do not add target selector markup or controls.

- [ ] **Step 4: Run focused orchestration tests to prove GREEN**

Run: `rtk proxy node --test tests/unit/tv-runner.test.js tests/unit/renderer.test.js`

Expected: lock release, acknowledgement blocking, Browser compatibility, redaction, and original-error precedence pass with fakes.

### Task 7: Verify the Phase 2 foundation without live-device scope expansion

**Files:**
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/phases.md`
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`

**Interfaces:**
- Consumes: completed unit/syntax evidence and no live TV artifacts.
- Produces: a precise statement that Phase 2 local contracts are implemented but physical-device validation remains a separate, authorized activity.

- [ ] **Step 1: Run complete safe validation**

```bash
rtk npm run test:unit
rtk proxy node --check app/main.js
rtk proxy node --check app/preload.js
rtk proxy node --check app/device-registry.js
rtk proxy node --check app/device-secret-store.js
rtk proxy node --check app/device-lock.js
rtk proxy node --check app/device-discovery.js
rtk proxy node --check app/appium-server-manager.js
rtk proxy node --check app/tv-runner.js
rtk proxy node --check tests/lib/tv-session/tv-session.js
rtk proxy node --check tests/lib/tv-session/tizen-appium-session.js
rtk proxy node --check tests/lib/tv-session/webos-appium-session.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: unit tests pass, every changed module parses, the Browser generic spec lists successfully, and whitespace validation is empty.

- [ ] **Step 2: Update only observed implementation facts**

Record the modules and local test coverage. State clearly that no live vendor command, physical-TV session, deployment, login, screenshot, or playback validation occurred in this implementation pass unless separately authorized and evidenced. Do not claim Samsung/LG support or GUI availability.

- [ ] **Step 3: Preserve the handoff boundary**

Do not stage or commit without explicit user authorization. Report the complete list of changed files, test output counts, skipped live validations, and the remaining Phase 2 physical integration gate.
