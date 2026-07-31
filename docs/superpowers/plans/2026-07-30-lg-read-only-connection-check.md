# LG Read-only Connection Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator explicitly check a selected, already registered LG target and see a redacted connection result without changing the TV or local vendor configuration.

**Architecture:** A new main-process checker resolves only the active managed or Advanced toolchain, reads the saved LG profile, and invokes the existing read-only webOS identity and installed-app adapter. IPC accepts only a profile ID and returns an allowlisted status. The renderer invokes it only after a Check connection click and renders neutral, checking, connected, or unavailable state.

**Tech Stack:** Electron main/preload/renderer, CommonJS, Node built-in test runner, existing webOS CLI read-only adapter.

## Global Constraints

- LG/webOS only; Samsung is out of scope.
- The operation is explicit and read-only: no target registration, pairing, Appium, remote keys, reset, launch, navigation, deployment, install, uninstall, or app mutation.
- Use only the active app-managed or Advanced webOS CLI configuration; never fall back to PATH, NVM, a shell profile, or a system SDK.
- The IPC request contains only `{deviceId}`; it returns only fixed status codes and never connection values, vendor command output, paths, credentials, pairing material, model facts, firmware, or app inventory.
- A profile without an existing `vendorDeviceName` returns `REGISTERED_TARGET_REQUIRED`; the check never creates or repairs that target.
- The expected app is the profile's already-approved LG MyTV app ID. A missing or mismatched app returns a fixed non-ready status without changing the profile.
- Use test-first development, `apply_patch` for edits, and `rtk` before every shell command.
- After every repository edit run the six required unit, syntax, Playwright-list, and diff checks; update and check Graphify after code changes.
- Do not stage, commit, reset, clean, deploy, or retain live evidence in the repository.

---

### Task 1: Add a main-process read-only checker

**Files:**
- Create: `app/lg-device-connection-check.js`
- Create: `tests/unit/lg-device-connection-check.test.js`

**Interfaces:**
- Consumes: `{registry, adapter}` where `registry.list()` returns internal profiles and `adapter.deviceInfo({deviceName})` plus `adapter.listApps({deviceName})` are the established read-only operations.
- Produces: `createLgDeviceConnectionChecker({registry, adapter}).check({deviceId})` returning one of `{ok: true, status: "CONNECTED"}` or `{ok: false, status: "DEVICE_NOT_FOUND" | "REGISTERED_TARGET_REQUIRED" | "APP_NOT_INSTALLED" | "DEVICE_MISMATCH" | "CONNECTION_UNAVAILABLE"}`.

- [x] **Step 1: Write focused failing contracts.**

```js
test("checks only the registered target identity and installed MyTV app", async () => {
  const result = await checker.check({deviceId: "lab-lg"});
  assert.deepEqual(result, {ok: true, status: "CONNECTED"});
  assert.deepEqual(calls, [
    ["deviceInfo", {deviceName: "lg-target"}],
    ["listApps", {deviceName: "lg-target"}],
  ]);
});

test("does not contact an unregistered profile", async () => {
  assert.deepEqual(await checker.check({deviceId: "unregistered"}), {
    ok: false, status: "REGISTERED_TARGET_REQUIRED",
  });
  assert.deepEqual(calls, []);
});
```

- [x] **Step 2: Run `rtk node --test tests/unit/lg-device-connection-check.test.js` and confirm the missing module fails.**

- [x] **Step 3: Implement the minimal checker.**

```js
async function check({deviceId} = {}) {
  const profile = (await registry.list()).find((item) => item.id === deviceId);
  if (!profile) return {ok: false, status: "DEVICE_NOT_FOUND"};
  const deviceName = String(profile.vendorDeviceName || "").trim();
  if (!deviceName) return {ok: false, status: "REGISTERED_TARGET_REQUIRED"};
  try {
    const info = await adapter.deviceInfo({deviceName});
    const apps = await adapter.listApps({deviceName});
    if (String(info?.model || "").trim() !== profile.model) return {ok: false, status: "DEVICE_MISMATCH"};
    if (!apps.some((app) => app?.id === profile.appId)) return {ok: false, status: "APP_NOT_INSTALLED"};
    return {ok: true, status: "CONNECTED"};
  } catch {
    return {ok: false, status: "CONNECTION_UNAVAILABLE"};
  }
}
```

- [x] **Step 4: Run the focused checker test and confirm all status branches are redacted and side-effect-free.**

### Task 2: Expose a narrow main/preload/renderer interaction

**Files:**
- Modify: `app/main.js`
- Modify: `app/tv-device-ipc.js`
- Modify: `app/preload.js`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/tv-device-ipc.test.js`
- Modify: `tests/unit/preload.test.js`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- IPC: `check-tv-device-connection` accepts `{deviceId}` and delegates only to `connectionChecker.check`.
- Preload: `checkTvDeviceConnection(deviceId)` invokes the IPC channel.
- Renderer: `checkTvDeviceConnection()` runs only on button click and updates only its existing status row.

- [x] **Step 1: Write failing IPC, preload, and renderer tests.**

```js
assert.deepEqual(await handlers.get("check-tv-device-connection")(undefined, {deviceId: "lab-lg"}), {
  ok: true, status: "CONNECTED",
});
assert.equal(calls.some(([name]) => name === "check"), true);
assert.doesNotMatch(JSON.stringify(result), /host|passphrase|path|stdout|stderr/i);

fixture.elements["tv-device-check-connection-button"].dispatchEvent("click");
await new Promise((resolve) => setImmediate(resolve));
assert.match(fixture.elements["tv-device-connection-status"].textContent, /connected/i);
assert.match(fixture.elements["tv-device-connection-dot"].className, /connected/);
```

- [x] **Step 2: Run the focused tests and confirm they fail because no public handler or renderer action exists.**

- [x] **Step 3: Wire the checker in `main.js` with `createConfiguredWebOsReadOnlyAdapter({toolchainConfig})`.**

Pass the new checker to `registerTvDeviceIpc`. Do not create target-registration, discovery, pairing, Appium, or device-profile-save dependencies.

- [x] **Step 4: Add the IPC and preload methods.**

Require an object with a non-empty string `deviceId`; return `{ok: false, status: "DEVICE_NOT_FOUND"}` for invalid input or unavailable checker. Redact the returned fixed status object before sending it to the renderer.

- [x] **Step 5: Implement renderer status mapping and styles.**

Enable the button only when LG is selected, a saved device is selected, and the preload method exists. While awaiting, show `Checking connection…` with a neutral dot. Map `CONNECTED` to `Connected` and green; map every non-ready status to `Connection unavailable` and red. Reset to `Connection not checked` on target/profile changes. Do not display returned facts or raw errors.

- [x] **Step 6: Run the focused IPC, preload, and renderer tests.**

### Task 3: Record the safety boundary and complete verification

**Files:**
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`

- [x] **Step 1: Document that Check connection is explicit, read-only, registered-target-only, and redacted.**

- [x] **Step 2: Run the required validation commands.**

```text
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

- [x] **Step 3: Run `rtk graphify update .` and `rtk graphify check-update .`, then repeat the required validation commands.**

## Plan self-review

- **Coverage:** Task 1 confines all device interaction to the two approved CLI reads; Task 2 keeps the public boundary redacted and user-initiated; Task 3 records and verifies the safety contract.
- **No placeholders:** Each task names exact files, interfaces, fixed statuses, test behavior, and commands.
- **Type consistency:** Renderer sends only `deviceId`; IPC forwards `{deviceId}`; checker consumes that shape and returns the exact statuses mapped by the renderer.
