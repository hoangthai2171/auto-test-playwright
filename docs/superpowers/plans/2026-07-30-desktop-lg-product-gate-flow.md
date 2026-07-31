# Desktop LG Product-Gate Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the existing desktop **Run Selected** batch run eligible server/API cases against a selected saved LG device through the approved Appium/webOS path, while keeping Browser execution unchanged and keeping all connection data out of the renderer.

**Architecture:** Add a main-process-only LG admission service that resolves the selected saved device, verified local toolchain, and centrally maintained ChromeDriver compatibility profile; it performs a fresh read-only device/app preflight only after batch confirmation. A main-process batch controller reuses `createTvRunner()` and the target-neutral action runner, applies the approved retry policy, writes the existing local report format, and publishes only fixed status/frame events. The renderer keeps the current case selection, reporting, and API-result submission flow, branching only at the execution adapter and presenting a single batch-confirmation/recovery UI for LG.

**Tech Stack:** Electron main/preload/renderer, CommonJS, Node built-in test runner, Appium HTTP over loopback, existing webOS CLI read-only adapter, existing target-neutral TV action runner, Playwright list-only validation.

## Global Constraints

- LG/webOS only. Samsung remains entirely out of scope.
- The permanent user-facing control is the existing **Run Selected** button; do not add a competing product-gate run button.
- Browser selection, Chromium configuration, browser preview, BrowserView behavior, and Browser `run-test` IPC behavior must remain unchanged.
- Renderer inputs for an LG batch are limited to `{deviceId, selectedCaseIds, folderId, confirmed}` and explicit recovery choice. Never accept host, passphrase, pairing material, tool paths, Appium options, browser paths, raw CLI output, raw Appium output, screenshots paths, or login credentials from renderer IPC.
- Resolve the encrypted saved host/passphrase, registered vendor target name, local toolchain paths, and selected-case login credentials in the main process only. Never persist a separate LG test account.
- A saved LG device must already have a registered vendor device name. This work must not create a target, pair, run a package picker, use a global CLI, alter PATH/shell files, use NVM, or fall back to a system Node installation.
- Use only explicit Advanced or verified managed LG toolchain configuration. Missing Node, webOS CLI, Appium, LG driver, ChromeDriver, or compatibility profile blocks execution before Appium, reset, launch, or remote input.
- ChromeDriver selection uses only the centrally maintained compatibility catalog. Unknown device facts return `COMPATIBILITY_PROFILE_UNVERIFIED`; never infer, guess, create, download, or select a latest profile.
- The catalog starts with no newly inferred profile. Adding a real device profile remains a separate reviewed catalog change, not an outcome of this feature or of device discovery.
- Fresh post-confirmation preflight is read-only (`ares-device-info` and installed-app listing) and must prove the selected registered LG identity, expected model, installed MyTV app ID, and matching known compatibility profile before Appium starts.
- Runtime Appium is loopback-only. LG sessions must use `remoteOnly: false`, `rcMode: "rc"`, explicit secure WebSocket settings, and no `appium:rcMode: "js"`.
- Never invoke `webos: clearApp`. The existing MyTV-only session reset remains permitted only after Appium has verified the foreground MyTV app identity.
- Continue after a business case failure. Retry a connection, Appium, reset, pairing-unrelated, or unknown technical failure from a fresh MyTV-only reset up to three total attempts for that current case; after the third failure pause for **Keep retrying** or **Stop**. A pairing-required state pauses immediately and never retries automatically.
- TV run frames and diagnostics remain in local app report storage; API result submission remains credential-free and uploads no artifacts. The renderer may receive only a locally generated `data:image/png;base64,...` frame with no path or metadata.
- The first actual GUI LG batch is a separate live-TV action and requires fresh operator approval after this implementation, local tests, and documented preflight pass. Do not perform it while executing this plan.
- Use `apply_patch` for repository edits; prefix every shell command with `rtk`; preserve unrelated dirty work; do not stage, commit, push, reset, checkout, clean, deploy, uninstall, or alter a TV application.
- After every repository edit run `rtk npm run test:unit`, `rtk node --check app/main.js`, `rtk node --check app/preload.js`, `rtk node --check app/renderer/renderer.js`, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.
- After each code edit run `rtk graphify update .`, `rtk graphify check-update .`, then rerun the required repository validation commands. Documentation-only edits do not require a graph rebuild.

---

## File and interface map

| File | Responsibility after this plan |
| --- | --- |
| `app/lg-toolchain-manifest.js` | Exposes the reviewed bundle together with the reviewed compatibility catalog; it never derives a profile from device output. |
| `app/lg-desktop-run-preflight.js` | Main-process-only availability and post-confirmation resolution/preflight boundary. It returns fixed public statuses or a private ephemeral runtime object. |
| `app/loopback-appium-client.js` | Small HTTP client for the locally managed Appium server. It accepts only a validated loopback base URL and exposes session operations. |
| `app/tv-runner.js` | Runs one trusted case with a prepared runtime, produces redacted lifecycle/frame callbacks, and cleans session/server/lock resources. |
| `app/lg-desktop-batch-runner.js` | Runs the selected cases serially, classifies failures, manages the approved retry/pause/stop policy, and returns renderer-safe per-case results. |
| `app/main.js` | Constructs all private dependencies, owns case lookup/report writing/stop state, and registers the LG batch IPC controller. |
| `app/lg-run-ipc.js` | Validates the narrow LG batch and recovery IPC payloads, forwards fixed event shapes, and never forwards runtime configuration. |
| `app/preload.js` | Exposes `getLgRunAvailability`, `runLgBatch`, `resolveLgRunRecovery`, and removable safe-event subscriptions. |
| `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css` | Adds a compact LG availability/Configure SDK state, one confirmation dialog, the same right-hand workspace surface for TV state/frames, and a recovery dialog. |
| `tests/lib/target-action-runner.js` | Exports a no-TV `validateTargetCaseCapabilities()` admission helper using the existing action/capability map. |
| `tests/unit/*` | Locks each pure boundary, IPC redaction contract, renderer workflow, retry behavior, and Browser non-regression. |

## Task 1: Lock zero-contact LG batch admission and compatibility contracts

**Files:**

- Modify: `app/lg-toolchain-manifest.js`
- Modify: `tests/lib/target-action-runner.js`
- Create: `app/lg-desktop-run-preflight.js`
- Test: `tests/unit/lg-toolchain-manifest.test.js`
- Test: `tests/unit/target-action-runner.test.js`
- Test: `tests/unit/lg-desktop-run-preflight.test.js`

**Interfaces:**

- Produces `trustedLgToolchainManifest(platform)` from `app/lg-toolchain-manifest.js`. It returns the existing pinned host bundle plus only `TRUSTED_LG_COMPATIBILITY_PROFILES`; initially that catalog is an immutable empty array.
- Produces `validateTargetCaseCapabilities(testCase, capabilities)` from `tests/lib/target-action-runner.js`. It compiles the existing case and throws `TargetActionError("ACTION_CAPABILITY_UNSUPPORTED", ...)` before any session exists if an action needs a false capability.
- Produces `createLgDesktopRunPreflight({registry, secrets, toolchainConfig, adapter, manifest, redact})` with:

  ```js
  {
    availability({deviceId}) // -> Promise<{ok: boolean, status: SAFE_STATUS}>
    prepare({deviceId})      // -> Promise<{runtime, redactionSecrets}>; private main-process value
  }
  ```

  `runtime` is frozen and contains only main-process values required by `createTvRunner.run()`: saved profile, resolved runtime host, registered vendor device name, resolved full toolchain, fixed transport options, and the verified ChromeDriver selection. It must never be returned by `availability()` or an IPC handler.

- Consumes the existing `createTvToolchainConfig.resolve()`, existing read-only adapter methods `deviceInfo({deviceName})` / `listApps({deviceName})`, existing encrypted `secrets.getSecret(deviceId, "host")`, and manifest `selectCompatibilityProfile({model, firmware, appId})`.

- Public safe statuses are exactly: `DEVICE_NOT_FOUND`, `REGISTERED_TARGET_REQUIRED`, `SAVED_CONNECTION_REQUIRED`, `TOOLCHAIN_UNAVAILABLE`, `COMPATIBILITY_PROFILE_UNVERIFIED`, `ACTION_CAPABILITY_UNSUPPORTED`, `DEVICE_MISMATCH`, `APP_NOT_INSTALLED`, `CONNECTION_UNAVAILABLE`, and `READY`. Do not include raw error text, model, firmware, host, path, or vendor output.

- [ ] **Step 1: Add failing catalog tests that prevent automatic ChromeDriver selection**

  In `tests/unit/lg-toolchain-manifest.test.js`, add a trusted-manifest test proving the bundled catalog is cloned and empty, and a local synthetic-catalog test proving only exact `{model, firmware, appId, chromedriver}` records verify.

  ```js
  const trusted = trustedLgToolchainManifest("darwin");
  assert.deepEqual(trusted.selectCompatibilityProfile({
    model: "observed", firmware: "observed", appId: "com.mytvb2c.app",
  }), {status: "COMPATIBILITY_PROFILE_UNVERIFIED"});

  const synthetic = createLgToolchainManifest({platform: "darwin", manifest: fixedManifest()});
  assert.deepEqual(synthetic.selectCompatibilityProfile({
    model: "verified-model", firmware: "verified-firmware", appId: "com.mytvb2c.app",
  }), {status: "verified", chromedriver: "2.36.540469"});
  ```

- [ ] **Step 2: Add failing no-TV target-action admission tests**

  In `tests/unit/target-action-runner.test.js`, call the new helper with the exact TV capability set and an unsupported capability set. Assert the helper does not call a handler/session and preserves the existing compiler error for malformed or unsupported actions.

  ```js
  assert.doesNotThrow(() => validateTargetCaseCapabilities(validCase, {
    domInspection: true, visualCapture: true,
    targetSemanticActions: true, playerInspection: true,
  }));

  assert.throws(
    () => validateTargetCaseCapabilities(playCase, {
      domInspection: true, visualCapture: true,
      targetSemanticActions: true, playerInspection: false,
    }),
    (error) => error.code === "ACTION_CAPABILITY_UNSUPPORTED",
  );
  ```

- [ ] **Step 3: Add failing preflight unit tests using only fakes**

  Create `tests/unit/lg-desktop-run-preflight.test.js`. Build a fake registry, encrypted-secret facade, full toolchain resolver, manifest, and read-only adapter that records calls. Test the following separately:

  ```js
  const availability = await preflight.availability({deviceId: "lg-1"});
  assert.deepEqual(availability, {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED"});
  assert.deepEqual(calls.adapter, []); // availability is local-only

  await assert.rejects(
    preflight.prepare({deviceId: "lg-1"}),
    (error) => error.code === "APP_NOT_INSTALLED",
  );
  assert.equal(calls.appiumStarts, 0);
  assert.doesNotMatch(JSON.stringify(error), /host-value|passphrase-value|tool-path/i);
  ```

  Cover missing saved profile/name/host, toolchain failure, unknown compatibility, model mismatch, missing MyTV app, adapter error, and success. On success assert the returned runtime is frozen, has `remoteOnly: false`, `rcMode: "rc"`, and uses the resolved ChromeDriver path internally; assert its public status is only `{ok: true, status: "READY"}`. Do not print or snapshot private values.

- [ ] **Step 4: Run focused tests and confirm the intended red state**

  Run:

  ```bash
  rtk node --test tests/unit/lg-toolchain-manifest.test.js
  rtk node --test tests/unit/target-action-runner.test.js
  rtk node --test tests/unit/lg-desktop-run-preflight.test.js
  ```

  Expected: the new imports/functions do not exist and the tests fail before any implementation is added.

- [ ] **Step 5: Implement the immutable catalog and no-TV capability helper**

  In `app/lg-toolchain-manifest.js`, add one immutable source constant and a trusted factory; do not alter the reviewed artifact records or add a user/device-derived profile.

  ```js
  const TRUSTED_LG_COMPATIBILITY_PROFILES = Object.freeze([]);

  function trustedLgToolchainManifest(platform) {
    return createLgToolchainManifest({
      platform,
      manifest: {bundles: TRUSTED_LG_TOOLCHAIN_BUNDLES, profiles: TRUSTED_LG_COMPATIBILITY_PROFILES},
    });
  }
  ```

  In `tests/lib/target-action-runner.js`, compile once and run the existing `ACTION_CAPABILITIES` checks against a frozen capability object without creating handlers or touching `context.session`.

  ```js
  function validateTargetCaseCapabilities(testCase, capabilities = {}) {
    const compiled = compileTestCase(testCase);
    const context = {capabilities: Object.freeze({...capabilities})};
    compiled.actions.forEach((action, actionIndex) => requireActionCapabilities(context, action, {
      caseId: String(compiled.id), actionIndex,
      required: ACTION_CAPABILITIES[action.action] || ["targetSemanticActions"],
    }));
    return compiled;
  }
  ```

- [ ] **Step 6: Implement the main-only preflight boundary**

  Add `app/lg-desktop-run-preflight.js`. `availability()` reads the selected profile and local toolchain only; it must never call `adapter`, `secrets.getSecret`, Appium, or a TV operation. `prepare()` repeats all local eligibility checks, obtains the saved host/passphrase only for in-memory redaction, performs `Promise.all([adapter.deviceInfo({deviceName}), adapter.listApps({deviceName})])`, and compares raw values only inside the module. It selects the compatibility profile from the freshly observed `{model, firmware, appId}` and returns only an internal runtime value.

  ```js
  const connection = Object.freeze({
    deviceName: profile.vendorDeviceName,
    deviceHost: host,
    chromedriverPath: toolchain.chromedriverPath,
    remoteOnly: false,
    rcMode: "rc",
  });
  const appium = Object.freeze({
    appiumHome: toolchain.appiumHome,
    appiumBin: toolchain.appiumBin,
  });
  ```

  On any failure, throw a classified error containing only fixed safe copy and a status code. Keep host, passphrase, paths, and raw adapter exceptions only in `redactionSecrets`; do not attach them to the error or return object.

- [ ] **Step 7: Rerun focused tests and confirm green**

  Run the three commands from Step 4. Expected: PASS, with tests proving no contact occurs during availability and no private runtime field crosses the public boundary.

- [ ] **Step 8: Run the required repository validation after this code edit**

  Run:

  ```bash
  rtk npm run test:unit
  rtk node --check app/main.js
  rtk node --check app/preload.js
  rtk node --check app/renderer/renderer.js
  rtk npx playwright test tests/run-test-case-mytv.spec.js --list
  rtk git diff --check
  rtk graphify update .
  rtk graphify check-update .
  rtk npm run test:unit
  rtk node --check app/main.js
  rtk node --check app/preload.js
  rtk node --check app/renderer/renderer.js
  rtk npx playwright test tests/run-test-case-mytv.spec.js --list
  rtk git diff --check
  ```

  Expected: all checks pass; none launches Electron, Appium, or contacts a TV.

## Task 2: Extract the local Appium transport and add safe TV-run lifecycle hooks

**Files:**

- Create: `app/loopback-appium-client.js`
- Modify: `app/tv-runner.js`
- Modify: `tests/lib/tv-case-runner.js`
- Test: `tests/unit/loopback-appium-client.test.js`
- Test: `tests/unit/tv-runner.test.js`
- Test: `tests/unit/tv-case-runner.test.js`

**Interfaces:**

- Produces `createLoopbackAppiumClient({baseUrl, fetchImpl})` with `{createSession(capabilities), execute(script, args), screenshot(), deleteSession()}`. It accepts only `http://127.0.0.1:<port>/`, retains the opaque session ID internally, and emits fixed `APPIUM_CLIENT_UNAVAILABLE` errors instead of response content.
- Extends `createTvRunner().run()` with optional main-only callbacks:

  ```js
  runner.run({..., testCase, onEvent, onFrame})
  // onEvent({code: SAFE_LIFECYCLE_CODE, caseId?})
  // onFrame("data:image/png;base64,...")
  ```

  Neither callback receives a profile, host, path, command, raw error, or session object.
- Extends `runTvTestCase()` with optional `onProgress({code, actionIndex})` and `onFrame(dataUrl)` callbacks. It captures frames only from the existing genuine `tvSession.screenshot()` interface, after reset and after each completed/failed action; it does not create screenshots synthetically.

- [ ] **Step 1: Add failing loopback client tests**

  Create `tests/unit/loopback-appium-client.test.js` with a fetch fake. Assert a valid local URL yields the existing Appium request shapes and that a session ID never appears in returned diagnostics. Assert non-loopback URLs, credentials, paths other than `/`, malformed responses, and thrown fetch errors produce only the fixed client error.

  ```js
  assert.throws(
    () => createLoopbackAppiumClient({baseUrl: "http://remote.example:4723/", fetchImpl}),
    /loopback Appium/i,
  );

  await assert.rejects(client.createSession({capabilities: {alwaysMatch: {}}}),
    (error) => error.code === "APPIUM_CLIENT_UNAVAILABLE" && !/session-raw|remote.example/.test(error.message));
  ```

- [ ] **Step 2: Add failing runner/frame contracts**

  Extend `tests/unit/tv-runner.test.js` with fakes for `onEvent` and `onFrame`. Assert lifecycle codes are allowlisted, the only frame begins with `data:image/png;base64,`, and a frame callback failure cannot replace the authoritative test/cleanup outcome. Assert the runner never sends a raw screenshot buffer or injected runtime connection to callbacks.

  Extend `tests/unit/tv-case-runner.test.js` to assert this sequence for a one-action case:

  ```js
  assert.deepEqual(progress, [
    {code: "case-reset"},
    {code: "action-complete", actionIndex: 0},
    {code: "case-cleanup"},
  ]);
  assert.equal(frames.every((frame) => frame.startsWith("data:image/png;base64,")), true);
  ```

  Add a failed-action test that emits a final `action-failed` lifecycle code but preserves the original `TargetActionError` and trusted logout behavior.

- [ ] **Step 3: Run focused tests and confirm red**

  Run:

  ```bash
  rtk node --test tests/unit/loopback-appium-client.test.js
  rtk node --test tests/unit/tv-runner.test.js
  rtk node --test tests/unit/tv-case-runner.test.js
  ```

  Expected: failures identify the missing transport module and callback contracts.

- [ ] **Step 4: Extract the terminal-only Appium HTTP client into the application module**

  Move the request/session-ID mechanics from `scripts/real-tv-appium/lg-webos-case-runner.js` into `app/loopback-appium-client.js`; keep the terminal script using the new module so it does not maintain a duplicate implementation. Validate the URL before issuing any request and use one private request helper.

  ```js
  function createLoopbackAppiumClient({baseUrl, fetchImpl = fetch} = {}) {
    const origin = normalizeLoopbackBaseUrl(baseUrl);
    let sessionId = "";
    return Object.freeze({
      createSession: async (capabilities) => { /* POST /session; retain sessionId privately */ },
      execute: (script, args = []) => request(sessionPath("/execute/sync"), "POST", {script, args}),
      screenshot: () => request(sessionPath("/screenshot")),
      deleteSession: () => request(sessionPath(""), "DELETE"),
    });
  }
  ```

  Do not expose this client through preload or renderer code. Do not change the terminal harness behavior other than importing the extracted client.

- [ ] **Step 5: Implement bounded lifecycle/frame emission**

  In `tests/lib/tv-case-runner.js`, add local `emitProgress` and `emitFrame` helpers that validate exact code names and a `data:image/png;base64,` prefix before invoking optional callbacks. Capture using `await tvSession.screenshot()` only after reset, after every action completion/failure, and never during logout input. Callback exceptions are caught and ignored.

  In `app/tv-runner.js`, relay only runner-level codes `preflight-ready`, `appium-started`, `session-started`, `case-started`, `case-finished`, `cleanup-complete`; call `onFrame` only through the validated case callback. Do not add a direct `webos:` command, reset call, or any `clearApp` behavior.

- [ ] **Step 6: Rerun focused tests and confirm green**

  Run the three commands from Step 3. Expected: PASS with a genuine-session contract and no sensitive values in callback payloads.

- [ ] **Step 7: Run full validation and graph refresh**

  Run the same required validation and Graphify sequence in Task 1 Step 8. Expected: PASS without Electron/Appium/TV execution.

## Task 3: Build the main-process serial LG batch, retry/recovery, report, and IPC boundary

**Files:**

- Create: `app/lg-desktop-batch-runner.js`
- Create: `app/lg-run-ipc.js`
- Modify: `app/main.js`
- Modify: `app/tv-runner.js`
- Modify: `app/preload.js`
- Modify: `tests/unit/tv-runner.test.js`
- Test: `tests/unit/lg-desktop-batch-runner.test.js`
- Test: `tests/unit/lg-run-ipc.test.js`
- Test: `tests/unit/preload.test.js`

**Interfaces:**

- Produces `createLgDesktopBatchRunner({preflight, tvRunner, loadCase, writeReportEntry, classifyFailure})` with:

  ```js
  {
    availability({deviceId, selectedCaseIds}),
    start({deviceId, selectedCaseIds, folderId, confirmed, onEvent, onFrame}),
    requestStop(),
    resolveRecovery({action: "retry" | "stop"}),
  }
  ```

  `start()` resolves to:

  ```js
  {ok: true, caseRuns: [{id, result: {passed, started, stopped, executionResult}}], stopped: boolean}
  ```

  All embedded `executionResult` values are redacted fixed-status/case-result values. Only main uses `preflight.prepare()` and its private runtime.

- Produces `registerLgRunIpc({ipcMain, batchRunner, redact})`. It registers `get-lg-run-availability`, `run-lg-batch`, and `resolve-lg-run-recovery`; it sends only `lg-run-status` and `lg-run-preview` events to the requesting sender.
- Preload exposes:

  ```js
  getLgRunAvailability(request)
  runLgBatch(request)
  resolveLgRunRecovery(request)
  onLgRunStatus(callback) // removable listener
  onLgRunPreview(callback) // removable listener
  ```

- [ ] **Step 1: Add failing serial-batch and retry-policy tests**

  Create `tests/unit/lg-desktop-batch-runner.test.js` with fakes for `preflight`, `loadCase`, `tvRunner`, report writing, and deferred recovery. Cover these exact contracts:

  ```js
  await assert.rejects(
    batch.start({deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: false}),
    (error) => error.code === "LG_CONFIRMATION_REQUIRED",
  );
  assert.equal(calls.preflightPrepare, 0);

  const result = await batch.start({deviceId: "lg-1", selectedCaseIds: ["business", "next"], confirmed: true});
  assert.deepEqual(result.caseRuns.map(({id}) => id), ["business", "next"]);
  assert.equal(calls.runByCase.get("business"), 1);
  assert.equal(calls.runByCase.get("next"), 1);
  ```

  Add technical failure fixtures that fail twice then pass (three total attempts), fail three times then emit `{code: "recovery-required", reason: "technical"}`, pairing-required fixtures that emit `{code: "recovery-required", reason: "pairing"}` after one attempt, and recovery `retry` / `stop` assertions. Assert every retry starts from a new `tvRunner.run()` call; no mid-case resume exists. Assert `requestStop()` stops the next boundary and returns a stopped case result without running later selected cases.

- [ ] **Step 2: Add failing IPC redaction tests**

  Create `tests/unit/lg-run-ipc.test.js` with a local handler map and a fake `sender.send`. Assert `run-lg-batch` drops forged host/passphrase/path/Appium/credential keys and forwards exactly:

  ```js
  {deviceId: "lg-1", selectedCaseIds: ["1", "2"], folderId: "folder-1", confirmed: true}
  ```

  Assert invalid confirmation, empty IDs, an unknown recovery action, and a second concurrent `run-lg-batch` return fixed statuses. Assert all status events match a strict allowlist such as:

  ```js
  {code: "preflight" | "case-started" | "case-retry" | "case-finished" |
         "recovery-required" | "batch-finished" | "stopped", caseId?: string,
   attempt?: 1 | 2 | 3, reason?: "technical" | "pairing"}
  ```

  Assert preview events accept only a valid PNG data URL and never include a file path or raw runtime data.

- [ ] **Step 3: Add failing preload contracts**

  Extend `tests/unit/preload.test.js` to verify the new invocations and unsubscribe behavior.

  ```js
  bridge.runLgBatch({deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: true});
  assert.deepEqual(invokes.at(-1), ["run-lg-batch", {
    deviceId: "lg-1", selectedCaseIds: ["1"], confirmed: true,
  }]);

  const unsubscribe = bridge.onLgRunStatus(listener);
  listeners.get("lg-run-status")(undefined, {code: "preflight"});
  unsubscribe();
  ```

- [ ] **Step 4: Run focused tests and confirm red**

  Run:

  ```bash
  rtk node --test tests/unit/lg-desktop-batch-runner.test.js
  rtk node --test tests/unit/lg-run-ipc.test.js
  rtk node --test tests/unit/preload.test.js
  ```

  Expected: the new modules and bridge methods are missing.

- [ ] **Step 5: Implement the batch controller without a renderer-owned runtime**

  In `app/lg-desktop-batch-runner.js`, validate all case IDs and compile/capability-check every selected case before calling `preflight.prepare()`, Appium, reset, or remote input. Call `preflight.prepare()` once only after `{confirmed: true}` and only if all selected cases pass local admission. Serially invoke `tvRunner.run()` for each case with the private runtime and safe callbacks.

  ```js
  for (const testCase of admittedCases) {
    const result = await runCurrentCaseWithPolicy(testCase);
    caseRuns.push({id: String(testCase.id), result});
    if (result.stopped) break;
  }
  ```

  Use `classifyTvFailure(error)` to choose business versus technical handling. Preserve the authoritative `error.testCaseResult` if supplied. Technical attempts are numbered 1–3; only after the third technical failure wait on an internal deferred recovery promise. Pairing uses the same deferred mechanism with `reason: "pairing"` but has no automatic retry. `requestStop()` resolves any deferred recovery with `stop` and causes the current/next boundary to return `stopped: true`. Do not let raw error text enter events or result payloads.

- [ ] **Step 6: Add the narrow IPC registrar and preload bridge**

  `app/lg-run-ipc.js` must parse each field with exact primitive checks, deduplicate selected IDs while preserving order, reject unknown keys by ignoring them, and call `batchRunner` with only the allowlisted payload. It must redact returned data and filter lifecycle events before `event.sender.send`.

  In `app/preload.js`, add only the fixed wrapper methods and removable listeners. Do not expose `ipcRenderer`, a generic event subscription, or a capability to send arbitrary channels.

- [ ] **Step 7: Wire private dependencies and report entries in `app/main.js`**

  Construct one `createLgDesktopRunPreflight()` with the existing registry, secret store, full toolchain config, configured read-only adapter, trusted compatibility manifest, and `redactSensitiveText`. Construct `createTvRunner()` with existing `createDeviceLock()`, `createAppiumServerManager({spawn, fetch, kill: process.kill.bind(process), redact, wait})`, and `createWebOsSessionFactory({clientFactory: createLoopbackAppiumClient, secrets})`; all runtime values remain inside the factory/batch invocation.

  Reuse `findTestCaseById`, cache/fixture lookup, `buildTestReportEntry`, `upsertTestReport`, and `renderUserReport` for each completed LG case. Store only the existing report JSON/HTML and optional rendered data URL; do not return report filesystem paths in LG IPC. Extend `stopActiveTest()` so it asks the active LG batch runner to stop, while leaving Browser process killing and Browser preview cleanup unchanged.

- [ ] **Step 8: Rerun focused tests and confirm green**

  Run the commands from Step 4 plus:

  ```bash
  rtk node --test tests/unit/tv-runner.test.js
  ```

  Expected: PASS. Tests prove confirmation/local admission occur before TV work, business failures advance, technical retry pauses correctly, and no private runtime value reaches IPC/preload.

- [ ] **Step 9: Run full validation and graph refresh**

  Run the required validation and Graphify sequence from Task 1 Step 8. Expected: PASS with no live device interaction.

## Task 4: Integrate the existing workspace UI with LG readiness, confirmation, run state, previews, and recovery

**Files:**

- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Test: `tests/unit/renderer.test.js`

**Interfaces:**

- Consumes only preload-safe `getLgRunAvailability`, `runLgBatch`, `resolveLgRunRecovery`, `onLgRunStatus`, and `onLgRunPreview`.
- Produces renderer-private helpers:

  ```js
  refreshLgRunAvailability()
  openLgBatchConfirmation({selectedCaseCount})
  runLgSelectedCases(values)
  renderLgRunStatus(event)
  renderLgPreview(dataUrl)
  openLgRecoveryDialog(event)
  ```

- The existing `runSelectedCases(values)` calls `runLgSelectedCases(values)` only when `values.target === "webos"`; its Browser path and per-case `runSingleCase()` behavior stay byte-for-byte equivalent except for shared button enablement logic.

- [ ] **Step 1: Add failing renderer fixture/markup tests**

  Extend `tests/unit/renderer.test.js` fixtures with these IDs and assert they are semantic dialog/status elements:

  ```js
  "lg-run-availability", "configure-lg-sdk-button", "lg-run-confirmation-dialog",
  "lg-run-confirm-button", "lg-run-cancel-button", "lg-run-state",
  "lg-preview-image", "lg-preview-empty", "lg-recovery-dialog",
  "lg-recovery-retry-button", "lg-recovery-stop-button",
  ```

  Assert there is no `Run LG product gate` text/button. Assert the dialog copy contains exactly the approved scope: selected-case count, may foreground MyTV, reset only MyTV local storage, native remote input, virtual-keyboard login from the selected case, and trusted logout cleanup. Assert it does not promise deployment, installation, pairing, a package picker, or a device credential form.

- [ ] **Step 2: Add failing readiness and Browser non-regression tests**

  Provide fake runner methods that record calls. Test the following exact behavior:

  ```js
  await controller.selectRunTarget("webos");
  assert.equal(fixture.elements["run-button"].disabled, true);
  assert.match(fixture.elements["lg-run-availability"].textContent, /Configure SDK/i);

  fixture.runner.getLgRunAvailability = async () => ({ok: true, status: "READY"});
  await controller.refreshLgRunAvailability();
  assert.equal(fixture.elements["run-button"].disabled, false);

  await controller.selectRunTarget("browser");
  assert.equal(fixture.runner.runLgBatchCalls.length, 0);
  ```

  Also prove a green historic connection check does not enable Run Selected by itself; only `READY` availability does. Clicking **Configure SDK** must open the existing Settings modal and select the SDK panel, not open a new window.

- [ ] **Step 3: Add failing confirmation, event, preview, and recovery tests**

  Assert clicking Run Selected with LG opens the confirmation dialog without calling `runLgBatch`. On confirmation, verify the exact safe payload and that the renderer never includes `APP_URL`, API authorization, host, passphrase, path, or selected-case action payload.

  ```js
  fixture.elements["lg-run-confirm-button"].dispatch("click");
  assert.deepEqual(fixture.runner.runLgBatchCalls[0], {
    deviceId: "lg-1", selectedCaseIds: ["42"], folderId: "folder-1", confirmed: true,
  });
  ```

  Feed status/preview callbacks. Assert fixed status text, current case status cell, and only `data:image/png;base64,` image sources render. Feed `recovery-required`, assert the recovery dialog opens, then test **Keep retrying** / **Stop** invoke only `{action: "retry"}` or `{action: "stop"}`. Unknown/malformed events and non-image previews must be ignored.

- [ ] **Step 4: Run the focused renderer test and confirm red**

  Run:

  ```bash
  rtk node --test tests/unit/renderer.test.js
  ```

  Expected: FAIL because the new UI, branch, and safe callbacks do not yet exist.

- [ ] **Step 5: Add the minimal shared-surface markup and CSS**

  In `app/renderer/index.html`, retain the existing right-side preview container. Add an LG state area and image inside that existing container, hidden while Browser is selected. Add two modal dialogs using the project’s existing backdrop/close patterns:

  ```html
  <div id="lg-run-confirmation-dialog" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="lg-run-confirmation-title">...</div>
  <div id="lg-recovery-dialog" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="lg-recovery-title">...</div>
  ```

  Add only localized styles for an availability row, fixed-status badge, responsive TV frame (`object-fit: contain`), and dialog actions. Do not alter the app shell layout, Browser preview controls, global typography, or existing Settings component cards.

- [ ] **Step 6: Implement availability and one-confirmation branch**

  Add `lgRunAvailability` to renderer state. On entering LG target, after device list loads and whenever selected device/toolchain state changes, call `getLgRunAvailability({deviceId, selectedCaseIds})`; render only fixed strings. Update `updateSelectionUi()` and `setFormRunning()` so:

  ```js
  const canRunLg = runTarget === "webos" && lgRunAvailability?.ok === true && lgRunAvailability.status === "READY";
  runButton.disabled = isRunning || selectedIds.length === 0 ||
    (runTarget === "browser" ? !browserToolchainReady : !canRunLg);
  ```

  When LG Run Selected is pressed, open confirmation first. Only the confirm button calls `runLgBatch()` with the exact allowlisted fields. Do not call `preparePreview`, BrowserView APIs, or browser `api.runTest` for an LG batch.

- [ ] **Step 7: Render safe batch events and preserve result submission semantics**

  Subscribe once to `onLgRunStatus` and `onLgRunPreview`. Map the allowlisted event codes to fixed copy (for example, `Checking LG prerequisites`, `Starting selected case`, `Retrying current case`, `Waiting for your decision`, `LG batch finished`). Never append `event.message` because no event carries one.

  When `runLgBatch()` resolves, map its `caseRuns` into the existing `buildFlowCaseResultSubmission()` shape and retain the same behavior for failed submission/retry sync. Mark individual case table rows from each status/result. Business case failures must leave later selected cases runnable; a stopped batch marks remaining selected rows skipped. Browser result-submission tests must remain unchanged.

- [ ] **Step 8: Implement recovery and Stop controls**

  On `recovery-required`, open only the recovery dialog and disable normal run selection. The recovery buttons call `resolveLgRunRecovery({action})`; they do not create a new batch or navigate away. The existing Stop button calls `api.stopTest()` and closes the recovery dialog when appropriate. Do not offer a hidden retry count, raw details, or any direct-TV inputs.

- [ ] **Step 9: Run focused renderer tests and inspect accessibility contracts**

  Run:

  ```bash
  rtk node --test tests/unit/renderer.test.js
  ```

  Expected: PASS. Tests prove confirmation is required, payloads are narrow, a historic connection does not authorize execution, the same workspace shows only valid TV frames, and Browser logic remains unaffected.

- [ ] **Step 10: Run full validation and graph refresh**

  Run the required validation and Graphify sequence from Task 1 Step 8. Expected: PASS without Electron/Appium/TV execution.

## Task 5: Document the operational boundary and perform local-only release checks

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`
- Test: existing unit/syntax/list/diff validation only

**Interfaces:**

- Documents the single desktop **Run Selected** LG workflow, its explicit confirmation, local readiness state, safe preflight, recovery choices, and the separate fresh-approval requirement for the first live GUI pilot.
- Does not document a host, credential, pairing value, screenshot, archive path, raw command, or compatibility-profile facts for a specific TV.

- [ ] **Step 1: Add a failing documentation consistency check**

  Use a focused `rtk rg` inspection before editing. It must show where the old `LG execution is not wired` text and terminal-only product-gate wording remain, so each affected statement has an explicit replacement target.

  ```bash
  rtk rg -n "LG execution is not wired|Run LG product gate|terminal.*product gate|product gate" README.md AGENTS.md docs/real-tv-appium app/renderer
  ```

  Expected: current wording is found; do not run a live command as part of this inspection.

- [ ] **Step 2: Update project and operator documentation**

  Update `README.md` and `AGENTS.md` to say Browser and LG use the same case-selection/batch/report/result-submission workflow, with distinct execution adapters. In the LG sections, explicitly record: selection of a saved device; local SDK readiness; one batch confirmation; fresh read-only preflight; native remote/Appium constraints; MyTV-only reset condition; business versus technical retry policy; recovery choices; and that the first GUI pilot is separately approved.

  Update architecture and handoff docs with the new main/preload/renderer boundary, safe IPC payloads/event codes, local artifacts, and no renderer access to connection/toolchain/credential values. Update `poc-runbook.md` to state the terminal product gate is an internal proof harness; the desktop flow replaces it for normal operators after a separately approved live pilot. Do not add a compatibility profile or claim that a device is eligible.

- [ ] **Step 3: Run the required documentation validation**

  Run:

  ```bash
  rtk npm run test:unit
  rtk node --check app/main.js
  rtk node --check app/preload.js
  rtk node --check app/renderer/renderer.js
  rtk npx playwright test tests/run-test-case-mytv.spec.js --list
  rtk git diff --check
  ```

  Expected: PASS. Do not run Electron, Appium, CLI preflight, or any TV command.

- [ ] **Step 4: Record the live-pilot gate without executing it**

  In `docs/real-tv-appium/HANDOFF.md`, add a short pending gate entry: local implementation/validation complete; first GUI LG batch needs fresh operator approval; operator must select an eligible saved device, review the one-batch confirmation, and retain only redacted evidence. Do not add any target-specific value or mark the pilot passed.

## Plan self-review

- **Spec coverage:** Task 1 implements saved-device/toolchain/compatibility/local case admission and fresh read-only preflight. Task 2 provides the reusable loopback Appium transport and genuine-frame lifecycle only. Task 3 implements serial same-batch execution, case report reuse, fixed IPC, stop, technical retry, and manual recovery. Task 4 implements the one shared workspace, disabled/Configure SDK state, one confirmation, safe status/frame UI, recovery controls, and unchanged Browser branch. Task 5 updates the operator-facing boundary and explicitly preserves the separate live-pilot approval gate.
- **Safety coverage:** Every task prohibits Samsung, target creation/pairing/package selection/global fallback, raw renderer diagnostics, forbidden `rcMode`/`clearApp`, deployment/app alteration, guessed ChromeDriver, and unapproved live execution. Preflight and all renderer contracts prove no contact before confirmation.
- **No placeholders:** Each task names exact files, interfaces, test commands, event/status values, and code shapes. No unresolved task, broad "error handling" instruction, or profile-creation step remains.
- **Type consistency:** `trustedLgToolchainManifest`, `validateTargetCaseCapabilities`, `createLgDesktopRunPreflight`, `createLoopbackAppiumClient`, `createLgDesktopBatchRunner`, `registerLgRunIpc`, and the preload/renderer method names are defined before later tasks consume them. Renderer batch results retain the existing `{id, result}` shape used by result submission.
- **Worktree policy:** The implementation steps intentionally omit staging/commits because this shared dirty worktree must not be staged, committed, or pushed without a separate request.
