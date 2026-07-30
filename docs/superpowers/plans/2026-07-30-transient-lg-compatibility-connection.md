# Transient LG Compatibility Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a maintainer inspect an unsaved LG TV and run one explicitly approved selected MyTV product-gate case against an existing verified compatibility profile.

**Architecture:** A main-process attempt service owns runtime connection values, creates and removes a unique local webOS CLI target for each live operation, and returns only redacted inspection facts plus an opaque attempt ID. A separate one-shot validator consumes that attempt, downloads and verifies the catalog-selected temporary ChromeDriver, then runs exactly one trusted selected LG case without automatic retry.

**Tech Stack:** Electron IPC, CommonJS, Node.js built-ins, existing webOS CLI adapter, existing LG compatibility catalog, existing Appium/TV runner, Node unit tests.

## Global Constraints

- LG/webOS only; Samsung is out of scope.
- Never start a live-TV, vendor-CLI, download, Appium, or product-gate operation before its own explicit confirmation.
- Do not persist or return hosts, passphrases, pairing data, command output, paths, archive data, screenshots, or integrity values.
- The renderer may submit host and passphrase once to main-process IPC; subsequent requests use an opaque attempt ID only.
- A temporary CLI target uses port `9922` and user `prisoner`, is removed only if this flow created it, and never uses modify, default, search, reset, pairing, `appium:rcMode "js"`, or `webos: clearApp`.
- Validation accepts exactly one selected action-capable LG case and performs no automatic retry or recovery loop.
- Unknown model/firmware pairs stop after inspection; never infer a driver or update `DEVICE-COMPATIBILITY.json`.
- Use test-first development, `apply_patch` for edits, and prefix every shell command with `rtk`.
- After every repository edit run `rtk npm run test:unit`, three `rtk node --check` commands for main/preload/renderer, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.
- After code edits, run `rtk graphify update .` and `rtk graphify check-update .`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/lg-temporary-webos-target.js` | Validates a runtime connection and owns one add/remove-only local CLI target lease. |
| `app/lg-compatibility-attempt-service.js` | Holds short-lived main-process attempts, performs read-only model/firmware inspection, selects a catalog profile, and discards runtime values. |
| `app/lg-compatibility-validation.js` | Runs one confirmed candidate download/verification and one selected product-gate case; always removes temporary resources. |
| `app/lg-compatibility-ipc.js` | Narrows inspection, validation, and discard IPC contracts to fixed public statuses. |
| `app/main.js` | Wires shared redaction, toolchain, catalog, target lease, attempt, validation, and trusted case loader dependencies. |
| `app/preload.js` | Exposes only the three compatibility IPC methods. |
| `app/renderer/index.html` | Adds the SDK action and transient compatibility dialog with two explicit confirmation states. |
| `app/renderer/renderer.js` | Owns dialog state, selected-case eligibility, one-time input submission, status copy, and cleanup on close. |
| `app/renderer/styles.css` | Styles the narrow dialog and status panel using the existing settings/dialog tokens. |
| `tests/unit/*compatibility*.test.js` | Covers target cleanup, attempt secrecy, validation gating/cleanup, IPC redaction, preload, and renderer behavior. |

### Task 1: Add an add/remove-only temporary webOS CLI target lease

**Files:**
- Create: `app/lg-temporary-webos-target.js`
- Create: `tests/unit/lg-temporary-webos-target.test.js`

**Interfaces:**
- Produces `createLgTemporaryWebOsTarget({webosSdkHome, spawnSync, createTargetName})`.
- `acquire({host, passphrase})` returns `{ok: true, targetName, release}` only after one successful `--add`; `release()` is idempotent and runs only `--remove <targetName>`.
- Public failures are `INVALID_CONNECTION`, `TOOLCHAIN_UNAVAILABLE`, `TARGET_LIST_FAILED`, `TARGET_NAME_CONFLICT`, or `TARGET_REGISTRATION_FAILED`.

- [ ] **Step 1: Write failing lease tests**

```js
test("adds one unique temporary LG target and removes only that target", async () => {
  const calls = [];
  const target = createLgTemporaryWebOsTarget({
    webosSdkHome: "/sdk",
    createTargetName: () => "lgcompat-a1",
    spawnSync: (_command, args) => {
      calls.push(args);
      return {status: 0, stdout: args[0] === "--listfull" ? "[]" : ""};
    },
  });
  const lease = await target.acquire({host: "192.0.2.10", passphrase: "runtime-only"});
  await lease.release();
  await lease.release();
  assert.deepEqual(calls.map((args) => args[0]), ["--listfull", "--add", "--remove"]);
  assert.equal(calls.at(-1)[1], "lgcompat-a1");
});

test("never adds a target when the input is invalid or the name already exists", async () => {
  // Assert the returned fixed status and that no --add/--remove/default/reset command is invoked.
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk node --test tests/unit/lg-temporary-webos-target.test.js`

Expected: FAIL because `app/lg-temporary-webos-target.js` does not exist.

- [ ] **Step 3: Implement the minimal lease**

```js
async function acquire({host, passphrase} = {}) {
  if (!isHost(host) || !text(passphrase)) return {ok: false, status: "INVALID_CONNECTION"};
  const targetName = createTargetName();
  const names = listTargetNames();
  if (!names) return {ok: false, status: "TARGET_LIST_FAILED"};
  if (names.has(targetName)) return {ok: false, status: "TARGET_NAME_CONFLICT"};
  if (!run(["--add", targetName, "--info", `host=${host}`, "--info", "port=9922", "--info", "username=prisoner", "--info", `passphrase=${passphrase}`])) {
    return {ok: false, status: "TARGET_REGISTRATION_FAILED"};
  }
  let released = false;
  return {ok: true, targetName, async release() {
    if (released) return;
    released = true;
    run(["--remove", targetName]);
  }};
}
```

Do not interpolate a command string, report arguments, call interactive CLI mode, or remove a target that was not created by this lease.

- [ ] **Step 4: Run focused tests and required checks**

Run: `rtk node --test tests/unit/lg-temporary-webos-target.test.js`

Expected: PASS.

Run the Global Constraints validation commands and then `rtk graphify update . && rtk graphify check-update .`.

- [ ] **Step 5: Commit**

```bash
rtk git add app/lg-temporary-webos-target.js tests/unit/lg-temporary-webos-target.test.js
rtk git commit -m "feat: add temporary LG CLI target lease"
```

### Task 2: Add redacted, expiring compatibility inspection attempts

**Files:**
- Create: `app/lg-compatibility-attempt-service.js`
- Create: `tests/unit/lg-compatibility-attempt-service.test.js`

**Interfaces:**
- Produces `createLgCompatibilityAttemptService({temporaryTarget, adapter, compatibilityCatalog, platform, createId, scheduleExpiry, cancelExpiry})`.
- `inspect({confirmed, label, host, passphrase})` requires `confirmed === true`, uses a temporary target only for `adapter.deviceInfo`, and returns `{ok, status, attemptId?, model?, firmware?}`.
- `takeForValidation({attemptId})` returns one private attempt only for a verified profile; `discard({attemptId})` erases the attempt and cancels its expiry timer.

- [ ] **Step 1: Write failing attempt tests**

```js
test("requires explicit confirmation before it creates a temporary target", async () => {
  const service = createHarness();
  assert.deepEqual(await service.inspect({label: "Lab", host: "192.0.2.10", passphrase: "runtime-only"}), {
    ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED",
  });
  assert.equal(service.calls.acquire, 0);
});

test("returns model and firmware but never a connection value, and discards an unknown pair", async () => {
  const result = await createHarness({selection: {status: "COMPATIBILITY_PROFILE_UNVERIFIED"}}).service.inspect({
    confirmed: true, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only",
  });
  assert.deepEqual(result, {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED", model: "model-a", firmware: "firmware-a"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|runtime-only|targetName/i);
});

test("releases the inspection target and makes a verified attempt one-time", async () => {
  // Assert release in finally, one private take succeeds, and the second take is ATTEMPT_NOT_FOUND.
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk node --test tests/unit/lg-compatibility-attempt-service.test.js`

Expected: FAIL because the service is missing.

- [ ] **Step 3: Implement the attempt service**

```js
const lease = await temporaryTarget.acquire({host, passphrase});
try {
  const info = await adapter.deviceInfo({deviceName: lease.targetName});
  const selection = await compatibilityCatalog.select({model: text(info.model), firmware: text(info.firmware), platform});
  if (selection.status !== "verified") return {ok: false, status: "COMPATIBILITY_PROFILE_UNVERIFIED", model, firmware};
  const attemptId = createId();
  attempts.set(attemptId, {label, host, passphrase, model, firmware, artifact: selection.artifact});
  scheduleExpiry(() => discard({attemptId}));
  return {ok: true, status: "COMPATIBILITY_VERIFIED", attemptId, model, firmware};
} finally {
  await lease.release();
}
```

Do not call Appium, `listApps`, download a driver, run a test, save a registry profile, or expose the private attempt.

- [ ] **Step 4: Run focused tests and required checks**

Run: `rtk node --test tests/unit/lg-compatibility-attempt-service.test.js`

Expected: PASS.

Run the Global Constraints validation commands and then `rtk graphify update . && rtk graphify check-update .`.

- [ ] **Step 5: Commit**

```bash
rtk git add app/lg-compatibility-attempt-service.js tests/unit/lg-compatibility-attempt-service.test.js
rtk git commit -m "feat: add transient LG compatibility inspection"
```

### Task 3: Run one selected case with a verified temporary driver

**Files:**
- Create: `app/lg-compatibility-validation.js`
- Create: `tests/unit/lg-compatibility-validation.test.js`
- Modify: `app/lg-managed-install-dependencies.js`
- Modify: `tests/unit/lg-managed-install-dependencies.test.js`

**Interfaces:**
- Produces `createLgCompatibilityValidation({attempts, temporaryTarget, adapter, downloadArtifact, verifyArchive, extractChromeDriver, verifyChromeDriver, runCase, createTempDir, removeTempDir})`.
- `validate({attemptId, confirmed, testCase})` accepts one already schema-validated selected case, consumes a verified attempt, and returns only `{ok: true, status: "VALIDATION_PASSED"}` or a fixed failure code.
- `runCase` receives a private transient runtime and executes exactly once; it must not use desktop batch retry/recovery behavior.

- [ ] **Step 1: Write failing one-shot validation tests**

```js
test("does not consume an attempt or download before validation confirmation", async () => {
  const {validator, calls} = createHarness();
  assert.deepEqual(await validator.validate({attemptId: "attempt-1", testCase: CASE}), {
    ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED",
  });
  assert.deepEqual(calls, []);
});

test("uses one verified temporary driver and one selected case, then removes all temporary resources", async () => {
  const {validator, calls} = createHarness();
  assert.deepEqual(await validator.validate({attemptId: "attempt-1", confirmed: true, testCase: CASE}), {
    ok: true, status: "VALIDATION_PASSED",
  });
  assert.deepEqual(calls, ["temporary-driver-created", "target-created", "identity-rechecked", "case-run-once", "target-removed", "temporary-driver-removed"]);
});

test("returns a fixed failure without retry when model/firmware changes or the case fails", async () => {
  // Assert no second runCase invocation and no runtime value in the result.
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `rtk node --test tests/unit/lg-compatibility-validation.test.js tests/unit/lg-managed-install-dependencies.test.js`

Expected: FAIL because the validator and reusable temporary ChromeDriver operations are missing.

- [ ] **Step 3: Implement temporary driver operations and validator**

Move only the audited archive download, SHA-256 verification, extraction, and executable-version checks into injected reusable operations; do not change the managed installation behavior. In the validator, consume the attempt after confirmation, create a temporary directory, re-create a temporary target, re-read model/firmware, and require an exact match before one `runCase` call.

```js
try {
  const attempt = attempts.takeForValidation({attemptId});
  const root = await createTempDir();
  const executablePath = await prepareVerifiedChromeDriver({artifact: attempt.artifact, root});
  const lease = await temporaryTarget.acquire({host: attempt.host, passphrase: attempt.passphrase});
  try {
    const info = await adapter.deviceInfo({deviceName: lease.targetName});
    if (text(info.model) !== attempt.model || text(info.firmware) !== attempt.firmware) return {ok: false, status: "DEVICE_IDENTITY_MISMATCH"};
    await runCase({testCase, connection: privateConnection(lease.targetName, attempt.host, executablePath), model: attempt.model});
    return {ok: true, status: "VALIDATION_PASSED"};
  } finally { await lease.release(); }
} catch { return {ok: false, status: "VALIDATION_FAILED"}; }
finally { await removeTempDir(root); attempts.discard({attemptId}); }
```

`runCase` must use the existing trusted TV runner/session factory with a transient in-memory profile, the shared device lock, native remote control mode, secure WebSocket, and the selected case. It must not write a user report, emit preview frames, run more than once, or create a saved profile.

- [ ] **Step 4: Run focused tests and required checks**

Run: `rtk node --test tests/unit/lg-compatibility-validation.test.js tests/unit/lg-managed-install-dependencies.test.js`

Expected: PASS.

Run the Global Constraints validation commands and then `rtk graphify update . && rtk graphify check-update .`.

- [ ] **Step 5: Commit**

```bash
rtk git add app/lg-compatibility-validation.js app/lg-managed-install-dependencies.js tests/unit/lg-compatibility-validation.test.js tests/unit/lg-managed-install-dependencies.test.js
rtk git commit -m "feat: validate transient LG compatibility"
```

### Task 4: Add narrow main-process IPC and trusted case loading

**Files:**
- Create: `app/lg-compatibility-ipc.js`
- Create: `tests/unit/lg-compatibility-ipc.test.js`
- Modify: `app/main.js`
- Modify: `app/preload.js`
- Modify: `tests/unit/preload.test.js`

**Interfaces:**
- `inspect-lg-compatibility-device` consumes `{confirmed, label, host, passphrase}` and returns the Task 2 public result.
- `run-lg-compatibility-validation` consumes `{attemptId, selectedCaseId, folderId?, confirmed}`; main-process code resolves and validates exactly one cached/local selected case before Task 3.
- `discard-lg-compatibility-attempt` consumes `{attemptId}` and returns `{ok: true}` only.

- [ ] **Step 1: Write failing IPC and preload tests**

```js
test("inspection refuses unconfirmed input and never publishes connection values", async () => {
  const result = await handlers.get("inspect-lg-compatibility-device")(undefined, {
    confirmed: false, label: "Lab", host: "192.0.2.10", passphrase: "runtime-only",
  });
  assert.deepEqual(result, {ok: false, status: "INSPECTION_CONFIRMATION_REQUIRED"});
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.10|runtime-only/i);
});

test("validation loads one selected case in main and sends only an opaque attempt ID across IPC", async () => {
  // Assert selectedCaseId and folderId reach the trusted loader, but host/passphrase never reach this handler.
});

test("preload exposes only inspect, validate, and discard compatibility methods", () => {
  // Assert the exact ipcRenderer.invoke channel names and payloads.
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `rtk node --test tests/unit/lg-compatibility-ipc.test.js tests/unit/preload.test.js`

Expected: FAIL because the handlers and preload methods are missing.

- [ ] **Step 3: Implement IPC wiring**

Create the temporary target service, attempt service, validator, and one-case `runCase` adapter in `app/main.js`. The adapter constructs a transient in-memory profile and a `createTvRunner` instance with the existing shared lock, Appium server manager, webOS session factory, and redactor. Register the new IPC separately from saved-device IPC so saved profile code remains unchanged.

```js
ipcMain.handle("run-lg-compatibility-validation", async (_event, request) => {
  if (request?.confirmed !== true) return {ok: false, status: "VALIDATION_CONFIRMATION_REQUIRED"};
  const testCase = await loadOneTrustedLgCase(request?.selectedCaseId, request?.folderId);
  if (!testCase) return {ok: false, status: "LG_COMPATIBILITY_CASE_REQUIRED"};
  return publicCompatibilityResult(await validator.validate({attemptId: text(request?.attemptId), confirmed: true, testCase}));
});
```

Every catch path must return a fixed status and must discard the referenced attempt. Never send progress events, runtime objects, redaction secrets, terminal output, or private errors to the renderer.

- [ ] **Step 4: Run focused tests and required checks**

Run: `rtk node --test tests/unit/lg-compatibility-ipc.test.js tests/unit/preload.test.js`

Expected: PASS.

Run the Global Constraints validation commands and then `rtk graphify update . && rtk graphify check-update .`.

- [ ] **Step 5: Commit**

```bash
rtk git add app/lg-compatibility-ipc.js app/main.js app/preload.js tests/unit/lg-compatibility-ipc.test.js tests/unit/preload.test.js
rtk git commit -m "feat: add LG compatibility IPC"
```

### Task 5: Add the SDK compatibility dialog and renderer contracts

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Adds `sdk-compatibility-check-button`, `lg-compatibility-dialog`, the three input fields, explicit inspection/validation confirmation controls, and a redacted status panel.
- Exposes renderer controller methods `openLgCompatibilityDialog`, `confirmLgCompatibilityInspection`, `confirmLgCompatibilityValidation`, and `closeLgCompatibilityDialog` for unit tests.

- [ ] **Step 1: Write failing markup and renderer tests**

```js
test("opens the compatibility dialog without calling any live-TV IPC", () => {
  const fixture = createRendererFixture();
  let inspections = 0;
  fixture.runner.inspectLgCompatibilityDevice = async () => { inspections += 1; };
  const controller = renderer.createRendererController(fixture);
  controller.openLgCompatibilityDialog();
  assert.equal(inspections, 0);
  assert.doesNotMatch(fixture.elements["lg-compatibility-dialog"].className, /hidden/);
});

test("requires an inspection confirmation, enables validation only for one selected case, and clears values on close", async () => {
  // Assert the first confirmation supplies the input once, the second sends only attemptId/case ID, and close discards then blanks every field/status.
});

test("does not render host, passphrase, target name, archive path, or integrity values in compatibility status", async () => {
  // Return hostile test values from a fake API and assert the fixed renderer message remains redacted.
});
```

- [ ] **Step 2: Run focused renderer test and verify RED**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: FAIL because the compatibility dialog and controller methods are absent.

- [ ] **Step 3: Implement the smallest dialog state machine**

Place **Check device compatibility** beside the existing catalog update action. Reuse the modal markup and settings visual language, but use a separate dialog so SDK configuration remains readable. Its state sequence is `editing → inspect-confirmation → inspected → validation-confirmation → result`; a failed/unknown inspection remains in `editing` with a fixed status and no validation action.

```js
async function closeLgCompatibilityDialog() {
  const attemptId = activeCompatibilityAttemptId;
  activeCompatibilityAttemptId = "";
  if (attemptId) await api.discardLgCompatibilityAttempt({attemptId});
  nameInput.value = "";
  hostInput.value = "";
  passphraseInput.value = "";
  renderCompatibilityStatus("");
  closeModal(compatibilityDialog);
}
```

Use the selected-case collection already maintained by the renderer, require exactly one selection, and do not alter the saved LG device list, connection dot, ordinary LG run button, Browser UI, or settings-install progress state.

- [ ] **Step 4: Run focused renderer test and required checks**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: PASS.

Run the Global Constraints validation commands and then `rtk graphify update . && rtk graphify check-update .`.

- [ ] **Step 5: Commit**

```bash
rtk git add app/renderer/index.html app/renderer/renderer.js app/renderer/styles.css tests/unit/renderer.test.js
rtk git commit -m "feat: add LG compatibility check dialog"
```

### Task 6: Update the maintainer workflow and final verification

**Files:**
- Modify: `.codex/skills/device-compatibility-check/SKILL.md`
- Modify: `docs/real-tv-appium/poc-runbook.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`
- Modify: `README.md`
- Test: `tests/unit/package-config.test.js`

**Interfaces:**
- The skill routes maintainers to Settings → SDK configuration → Check device compatibility, requires fresh approval before both dialog confirmations, and retains final record/update confirmation only after a passed candidate result.
- Documentation identifies `DEVICE-COMPATIBILITY.json` as the separately published catalog source and never tells users to paste connection values into chat or the API.

- [ ] **Step 1: Write documentation/skill pressure cases before editing**

Record three baseline prompts in the plan implementation notes: a maintainer asking to inspect without approval, one asking to paste a passphrase into chat, and one asking to record an unknown pair. Each required answer must stop or route to the dialog without a live action, secret echo, guessed driver, or catalog write.

- [ ] **Step 2: Update the skill and docs**

State the two dialog confirmations, temporary target cleanup, one selected trusted case, no automatic retry, the stop-on-unknown rule, final record/update confirmation, and no-publish boundary. Keep all connection values runtime-only and out of responses.

- [ ] **Step 3: Re-run the pressure cases and final checks**

Verify each revised workflow response has the required stop/approval boundary. Then run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
rtk graphify update .
rtk graphify check-update .
```

- [ ] **Step 4: Commit**

```bash
rtk git add .codex/skills/device-compatibility-check/SKILL.md docs/real-tv-appium/poc-runbook.md docs/real-tv-appium/HANDOFF.md README.md docs/superpowers/specs/2026-07-30-transient-lg-compatibility-connection-design.md docs/superpowers/plans/2026-07-30-transient-lg-compatibility-connection.md
rtk git commit -m "docs: document transient LG compatibility flow"
```

## Plan self-review

### Spec coverage

- The SDK entry action and temporary dialog are Task 5.
- Fresh approval before read-only inspection and before product-gate validation is Tasks 2, 4, and 5.
- A unique add/remove-only CLI target is Task 1 and is exercised in Tasks 2 and 3.
- No saved device/profile, no secret output, verified catalog-only selection, unknown-pair stop, one selected trusted case, temporary driver cleanup, and no automatic retry are Tasks 2 through 5.
- Final maintainer skill and documentation behavior is Task 6.

### Placeholder scan

The plan contains no deferred implementation markers. Each production task names its files, public interface, failing tests, focused command, minimal implementation boundary, verification, and commit.

### Type consistency

- Task 1 supplies `targetName` and `release()` to Tasks 2 and 3.
- Task 2 emits `attemptId`, model, firmware, and selected verified artifact only; Task 3 consumes the private attempt by that ID.
- Task 4 exposes exactly the three preload methods Task 5 consumes.
- Task 5 sends host/passphrase only to inspection and sends attempt ID plus selected case identity only to validation.
