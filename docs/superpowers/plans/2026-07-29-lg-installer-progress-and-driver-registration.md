# LG Installer Progress and Driver Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the locally installed `webos` Appium driver correctly and show only fixed, safe installation milestones during an explicitly confirmed LG managed install.

**Architecture:** Keep driver parsing and ordered milestone emission in the managed-install layer. Forward only allowlisted milestone codes from main-process IPC to the requesting renderer through a narrow preload subscription, then map them to fixed UI copy and state. The final install response remains authoritative.

**Tech Stack:** Electron, CommonJS, Node built-in test runner, fake filesystem/process/IPC dependencies.

## Global Constraints

- LG/webOS only; Samsung is out of scope.
- No production test may download, install, start Appium, start Electron, contact a TV, pair, register a target, validate a device, or operate the MyTV app.
- The only real command shape represented by tests is the existing managed local `appium driver list --installed --json` verification; it uses no TV data.
- Verify the reviewed LG driver only as a flat top-level `webos.version` response with the pinned version; do not guess alternate layouts.
- Progress payloads are fixed allowlisted codes only. They must contain no path, URL, host, archive, command, credentials, output, or error text.
- `apply_patch` only; every shell command begins with `rtk`; do not stage, commit, reset, checkout, or push.
- After every repository edit, run `rtk npm run test:unit`, all three required syntax checks, the generic Playwright list, and `rtk git diff --check`.
- After code edits, refresh Graphify with the documented sequential workaround and run `rtk graphify check-update .` plus the required checks.

---

### Task 1: Correct the flat Appium driver verification contract

**Files:**
- Modify: `tests/unit/lg-managed-install-dependencies.test.js`
- Modify: `app/lg-managed-install-dependencies.js`

**Interfaces:**
- Consumes: Appium `driver list --installed --json` stdout.
- Produces: `verify()` returns `{ok: true}` only when the parsed top-level `webos.version` equals the reviewed LG driver version; otherwise `{ok: false, verification: "LG_DRIVER_UNVERIFIED"}`.

- [ ] **Step 1: Write the failing flat-response test**

  Change the successful fixture to the actual Appium response shape and add a
  negative test that the old nested layout is not treated as a supported
  contract.

  ```js
  return {stdout: JSON.stringify({webos: {version: "0.5.0"}})};
  assert.deepEqual(await dependencies.verify(input), {ok: true});

  return {stdout: JSON.stringify({drivers: {webos: {version: "0.5.0"}}})};
  assert.deepEqual(await dependencies.verify(input), {
    ok: false, verification: "LG_DRIVER_UNVERIFIED",
  });
  ```

- [ ] **Step 2: Run the focused dependency test and confirm the expected red failure**

  Run: `rtk node --test tests/unit/lg-managed-install-dependencies.test.js`

  Expected: the flat fixture fails `LG_DRIVER_UNVERIFIED`; the nested fixture
  still reflects the old incorrect parser.

- [ ] **Step 3: Make the smallest parser correction**

  ```js
  function installedLgDriverVersion(output) {
    try {
      const drivers = JSON.parse(output);
      return String(drivers?.webos?.version || "").trim();
    } catch {
      return "";
    }
  }
  ```

  Do not loosen the parser to scan arbitrary objects or accept another driver
  name/version.

- [ ] **Step 4: Re-run the focused test and confirm green**

  Run: `rtk node --test tests/unit/lg-managed-install-dependencies.test.js`

  Expected: both the known flat contract and classified unsupported shapes pass
  their assertions without exposing process output.

### Task 2: Emit and transport fixed local installer milestones

**Files:**
- Modify: `tests/unit/lg-managed-install-operations.test.js`
- Modify: `app/lg-managed-install-operations.js`
- Modify: `tests/unit/lg-toolchain-installer.test.js`
- Modify: `app/lg-toolchain-installer.js`
- Modify: `tests/unit/tv-device-ipc.test.js`
- Modify: `app/tv-device-ipc.js`
- Modify: `app/main.js`
- Modify: `app/preload.js`

**Interfaces:**
- Consumes: optional `onProgress(code)` callbacks from the managed operations,
  installer, and IPC registration layers.
- Produces: exact code sequence
  `preparing`, `downloading-node`, `verifying-node`, `extracting-node`,
  `installing-appium`, `verifying-lg-driver`, `activating`, `complete`, or one
  classified `failed` event carrying only `{code: "failed", status}`.

- [ ] **Step 1: Add failing operations tests for ordered allowlisted milestones**

  Inject a recorder callback into `createLgManagedInstallOperations()` and
  assert the success sequence. Add a classified driver failure assertion and
  verify that an attempt to emit a value containing a path is not forwarded.

  ```js
  const progress = [];
  const operations = createLgManagedInstallOperations({..., onProgress: (event) => progress.push(event)});
  await operations.install({bundle, npmClosure});
  assert.deepEqual(progress, [
    {code: "preparing"}, {code: "downloading-node"},
    {code: "verifying-node"}, {code: "extracting-node"},
    {code: "installing-appium"}, {code: "verifying-lg-driver"},
    {code: "activating"}, {code: "complete"},
  ]);
  ```

- [ ] **Step 2: Run the focused operations test and confirm it fails**

  Run: `rtk node --test tests/unit/lg-managed-install-operations.test.js`

  Expected: the recorder remains empty because the operation currently has no
  progress interface.

- [ ] **Step 3: Implement the bounded progress interface**

  Add an internal allowlist and `emit(code, status)` helper in
  `lg-managed-install-operations`. Emit only after entering the corresponding
  stage. `verifying-lg-driver` occurs immediately before the existing
  `verify()` call; `complete` occurs only after atomic activation. Failure
  emits only fixed `{code: "failed", status}` after the existing safe result is
  determined. Never pass exceptions or operation arguments.

- [ ] **Step 4: Add and run failing IPC/preload contracts**

  Extend the IPC harness with `event.sender.send`. Assert that only the caller
  receives `lg-toolchain-install-progress` payloads that match the fixed public
  shape. Assert a preload `onLgToolchainInstallProgress(callback)` method
  subscribes to that one channel and returns an unsubscribe function.

  ```js
  assert.deepEqual(sent, [["lg-toolchain-install-progress", {code: "installing-appium"}]]);
  const stop = bridge.onLgToolchainInstallProgress(listener);
  stop();
  ```

- [ ] **Step 5: Implement installer composition and narrow event forwarding**

  Thread the optional callback from `createLgToolchainInstaller.install()` to
  the managed installer only for a confirmed request. In `tv-device-ipc`, bind
  that callback to the request event sender and filter to fixed public event
  shapes before calling `sender.send`. In `main.js`, compose the installer with
  the injected event callback path; in `preload.js`, use
  `ipcRenderer.on/removeListener` only for the fixed channel. No renderer-sent
  event name is accepted.

- [ ] **Step 6: Run focused operation, installer, IPC, and preload-adjacent tests**

  Run:

  ```bash
  rtk node --test tests/unit/lg-managed-install-operations.test.js
  rtk node --test tests/unit/lg-toolchain-installer.test.js
  rtk node --test tests/unit/tv-device-ipc.test.js
  ```

  Expected: PASS with ordered, redacted events and unchanged final response
  behavior.

### Task 3: Render transient safe progress in SDK Settings

**Files:**
- Modify: `tests/unit/renderer.test.js`
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`

**Interfaces:**
- Consumes: `api.onLgToolchainInstallProgress(listener)` fixed event payloads.
- Produces: `renderSdkInstallProgress(event)` renderer-private helper that maps
  known codes to fixed text/classes; unknown or malformed events are ignored.

- [ ] **Step 1: Add failing renderer behavior tests**

  Give the fake runner an opt-in subscription recorder. Assert that a confirmed
  install displays the indeterminate panel and the active fixed milestone,
  advances on `installing-appium`, marks a classified failure as attention, and
  never renders unsafe strings.

  ```js
  listener({code: "installing-appium"});
  assert.match(fixture.elements["sdk-install-progress"].textContent, /Installing reviewed Appium and the LG driver/i);
  listener({code: "failed", status: "LG_DRIVER_UNVERIFIED", path: "/private"});
  assert.doesNotMatch(fixture.elements["sdk-install-progress"].textContent, /private/);
  ```

- [ ] **Step 2: Run the focused renderer test and confirm red**

  Run: `rtk node --test tests/unit/renderer.test.js`

  Expected: it fails because the panel, subscription, and renderer mapping do
  not yet exist.

- [ ] **Step 3: Implement the smallest progress panel**

  Add a hidden `sdk-install-progress` status section above the reviewed setup
  controls. Use an indeterminate `<progress>` with no `value` and fixed
  milestone list. Subscribe once at controller creation; reset the transient
  state at each confirmed installation. Mark completed milestones ready, the
  active one in progress, and a final classified failure needs attention. The
  existing component cards and final failure sentence remain authoritative.

- [ ] **Step 4: Run focused renderer tests and then the required full validation**

  Run:

  ```bash
  rtk node --test tests/unit/renderer.test.js
  rtk npm run test:unit
  rtk node --check app/main.js
  rtk node --check app/preload.js
  rtk node --check app/renderer/renderer.js
  rtk npx playwright test tests/run-test-case-mytv.spec.js --list
  rtk git diff --check
  ```

  Expected: all pass. No Electron process, network operation, installer run,
  or TV operation occurs.

- [ ] **Step 5: Update Graphify and repeat the required checks**

  Use the project sequential Graphify update workaround, run
  `rtk graphify check-update .`, and re-run the six required validation
  commands. Preserve unrelated dirty changes.

## Plan self-review

- The plan covers the flat-driver root cause, ordered operations events, narrow
  IPC/preload transport, and the approved Settings-only UI.
- All producer and consumer code names use the same fixed milestone codes.
- No task adds a live-device, package-acquisition, or arbitrary-data pathway.
