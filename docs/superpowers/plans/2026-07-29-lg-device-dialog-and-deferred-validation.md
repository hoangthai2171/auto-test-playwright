# LG Device Dialog and Deferred Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exposed LG device form with a dialog that collects only normal-user connection inputs while enforcing a main-process-only, explicitly deferred validation-and-save boundary.

**Architecture:** The renderer owns only dialog state and sends a short-lived candidate through preload IPC. A new main-process device-profile service owns IDs, encrypted connection values, validation sequencing, and redacted profile summaries; production receives a deferred validator, while unit tests inject a fake validator. The existing read-only discovery and target-registration paths are removed from this increment's UI and candidate-save path so the work cannot contact a TV.

**Tech Stack:** Electron main/preload/renderer, CommonJS, Node built-in test runner, Electron `safeStorage`, JSON file persistence, existing device registry.

## Global Constraints

- LG/webOS only; Samsung is entirely out of scope.
- Do not invoke a TV, LG CLI, target registration, pairing, Appium, or Electron live run in this increment.
- Never deploy, uninstall, reset, launch, navigate, or otherwise alter the LG TV app.
- New persisted connection host and passphrase values must be encrypted in an app-owned per-user file, never placed in `devices.json`, renderer state, logs, reports, or IPC responses.
- Existing saved host values may be consumed only inside the main process to migrate a successfully validated edit; they must never cross back to the renderer.
- The renderer must not expose editable device ID, model, vendor target, port, username, firmware, app, or ChromeDriver fields in the device dialog.
- Port `9922` and user `prisoner` are fixed future validation defaults; they are not editable renderer inputs.
- The legacy LG CLI remains an operator-selected archive from the official LG page. Node/Appium/LG driver are host-side prerequisites, not TV-derived facts.
- Unknown ChromeDriver compatibility remains `COMPATIBILITY_PROFILE_UNVERIFIED`; no current or future candidate validation may guess or download a latest driver.
- Use test-first development, `apply_patch` for every repository edit, and prefix each shell command with `rtk`.
- After every repository edit, run `rtk npm run test:unit`, the three required `rtk node --check` commands, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.
- Keep this shared dirty worktree intact: do not stage, commit, reset, clean, or alter unrelated files.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/device-secret-file-store.js` | Atomically persists encrypted buffers in a versioned app-owned secret envelope; it never encrypts/decrypts or returns data to IPC. |
| `app/device-secret-store.js` | Uses Electron safe storage to encrypt/decrypt only inside the main process, with asynchronous vault access. |
| `app/device-profile-service.js` | Normalizes add/edit candidates, invokes an injected validator, preserves prior state on failure, saves verified metadata and secrets on success, and returns redacted profiles. |
| `app/main.js` | Creates the registry, encrypted secret store, and production deferred validator; does not create discovery or target-registration dependencies for device saving. |
| `app/tv-device-ipc.js` | Exposes narrow list and `validate-and-save-tv-device` handlers; it redacts all results and contains no live fallback. |
| `app/preload.js` | Exposes only list and candidate validation/save bridge methods required by the dialog. |
| `app/renderer/index.html` | Replaces inline device fields with selector actions and a hidden accessible dialog. |
| `app/renderer/renderer.js` | Owns dialog state, current-input show/hide, redacted status text, and success refresh/scrub behavior. |
| `app/renderer/styles.css` | Adds generous dialog field spacing and the horizontal action/footer layouts. |
| `tests/unit/*.test.js` | Covers file store, secret store, profile service, IPC redaction/deferment, renderer dialog behavior, and the absence of TV side effects. |
| `AGENTS.md`, `README.md`, `docs/real-tv-appium/architecture.md`, `docs/real-tv-appium/HANDOFF.md` | Describe the deferred live boundary and no-secret renderer contract. |

### Task 1: Create an encrypted device-secret persistence boundary

**Files:**
- Create: `app/device-secret-file-store.js`
- Modify: `app/device-secret-store.js`
- Create: `tests/unit/device-secret-file-store.test.js`
- Modify: `tests/unit/device-secret-store.test.js`

**Interfaces:**
- Consumes: `{filePath, fs}` where `fs` implements async `readFile`, `writeFile`, and `rename`.
- Produces: `createDeviceSecretFileStore({filePath, fs})` with async `get(key)`, `set(key, buffer)`, and `delete(key)`.
- Produces: `createDeviceSecretStore({safeStorage, store})` with async `hasSecret(deviceId, name)`, `getSecret(deviceId, name)`, `setSecret(deviceId, name, value)`, and `removeSecret(deviceId, name)`.
- Invariant: `getSecret` is main-process-only and must never be passed through an IPC handler or a renderer return object.

- [ ] **Step 1: Write the failing atomic file-store tests**

```js
test("persists encrypted buffers in a versioned envelope and restores the exact buffer", async () => {
  const store = createDeviceSecretFileStore({filePath: "/secrets.json", fs});
  await store.set("device-a:host", Buffer.from("ciphertext"));

  assert.deepEqual(await store.get("device-a:host"), Buffer.from("ciphertext"));
  assert.deepEqual(JSON.parse(files.get("/secrets.json")), {
    version: 1,
    secrets: {"device-a:host": Buffer.from("ciphertext").toString("base64")},
  });
  assert.deepEqual(calls.slice(-2), [["writeFile", "/secrets.json.tmp"], ["rename", "/secrets.json.tmp", "/secrets.json"]]);
});

test("returns undefined for a missing key and removes only its own encrypted entry", async () => {
  // Seed two base64 entries, remove one, and assert the other remains.
});
```

- [ ] **Step 2: Run the new file-store test to verify it fails**

Run: `rtk node --test tests/unit/device-secret-file-store.test.js`

Expected: FAIL because `../../app/device-secret-file-store` does not exist.

- [ ] **Step 3: Implement the minimal versioned atomic file store**

```js
function createDeviceSecretFileStore({filePath, fs}) {
  async function readEnvelope() { /* ENOENT => {version: 1, secrets: {}}; reject malformed base64 envelopes */ }
  async function writeEnvelope(envelope) {
    await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(envelope)}\n`, "utf8");
    await fs.rename(`${filePath}.tmp`, filePath);
  }
  return {
    async get(key) { const {secrets} = await readEnvelope(); return secrets[key] ? Buffer.from(secrets[key], "base64") : undefined; },
    async set(key, value) { /* require Buffer; replace only key; writeEnvelope */ },
    async delete(key) { /* delete only key, write only if it existed, return boolean */ },
  };
}
```

Do not store plaintext, host names, passphrases, JSON request objects, or file paths inside test assertions that could reach renderer diagnostics.

- [ ] **Step 4: Extend secret-store tests for internal decryption and unavailable encryption**

```js
test("decrypts an existing secret only for the main-process caller", async () => {
  const secrets = createDeviceSecretStore({safeStorage: fakeSafeStorage, store});
  await secrets.setSecret("device-a", "passphrase", "current-input");
  assert.equal(await secrets.getSecret("device-a", "passphrase"), "current-input");
});

test("does not return a secret when encrypted storage or decryption is unavailable", async () => {
  await assert.rejects(() => unavailable.getSecret("device-a", "passphrase"), /encryption|decrypt/i);
});
```

- [ ] **Step 5: Convert `device-secret-store` to the asynchronous vault contract**

Require `safeStorage.decryptString` in the constructor, await every store operation, and reject absent or malformed encrypted payloads. Keep `secretKey(deviceId, secretName)` private. Retain `hasSecret` as a boolean-only method; it must not decrypt.

- [ ] **Step 6: Run the focused secret-boundary tests**

Run: `rtk node --test tests/unit/device-secret-file-store.test.js tests/unit/device-secret-store.test.js`

Expected: PASS with no plaintext in the persisted envelope assertion.

### Task 2: Add a candidate-only, fake-testable device-profile service

**Files:**
- Create: `app/device-profile-service.js`
- Create: `tests/unit/device-profile-service.test.js`
- Modify: `app/device-registry.js`
- Modify: `tests/unit/device-registry.test.js`

**Interfaces:**
- Consumes: `{registry, secrets, validator, createId, now}`.
- `validator` has one async method: `validate({id, label, host, passphrase, port: 9922, username: "prisoner"})` and returns `{ok: true, facts: {model, vendorDeviceName?, firmwareVersion?, osVersion?}}` or `{ok: false, status}`.
- Produces: `validateAndSave({deviceId?, label, host?, passphrase?})` returning `{ok, status?, device?}` where `device` is redacted and never has connection values.
- Produces: `listPublicProfiles()` returning only registry metadata plus safe booleans `hasConnection` and `hasPassphrase`.

- [ ] **Step 1: Write failing service tests for rejected candidates and successful add**

```js
test("does not write a new profile or any secret when the injected validator rejects a candidate", async () => {
  const result = await service.validateAndSave({label: "Living room", host: "candidate-host", passphrase: "candidate-pass"});
  assert.deepEqual(result, {ok: false, status: "VALIDATION_UNAVAILABLE"});
  assert.deepEqual(await registry.list(), []);
  assert.equal(await secrets.hasSecret("generated-id", "host"), false);
});

test("saves a redacted verified profile and encrypted connection values after fake validation succeeds", async () => {
  const result = await service.validateAndSave({label: "Living room", host: "candidate-host", passphrase: "candidate-pass"});
  assert.deepEqual(result.device, {
    id: "generated-id", label: "Living room", platform: "webos",
    appId: "com.mytvb2c.app", backendEnvironment: "production", model: "OLED55C4",
    hasConnection: true, hasPassphrase: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /candidate-host|candidate-pass/);
});
```

- [ ] **Step 2: Add failing edit-preservation and legacy-migration tests**

```js
test("preserves the existing profile and secrets when an edit fails validation", async () => {
  await assert.rejectsOrEqual(/* fake rejection */);
  assert.deepEqual(await registry.list(), [existingProfile]);
  assert.equal(await secrets.getSecret(existingProfile.id, "host"), "existing-host");
});

test("uses blank edit connection fields only inside the service and migrates a legacy host after success", async () => {
  const result = await service.validateAndSave({deviceId: "legacy-lg", label: "Renamed LG", host: "", passphrase: "replacement-pass"});
  assert.equal(validator.calls[0].host, "legacy-host");
  assert.equal(Object.hasOwn((await registry.list())[0], "lastKnownHost"), false);
  assert.doesNotMatch(JSON.stringify(result), /legacy-host|replacement-pass/);
});
```

Do not include a real network adapter in these tests. The fake validator records candidate arguments only in the unit test process.

- [ ] **Step 3: Run the service test to verify it fails**

Run: `rtk node --test tests/unit/device-profile-service.test.js`

Expected: FAIL because `../../app/device-profile-service` does not exist.

- [ ] **Step 4: Implement the minimal candidate service**

```js
function createDeviceProfileService({registry, secrets, validator, createId, now}) {
  return {
    async listPublicProfiles() { /* map persisted profiles through publicProfile; never host/passphrase */ },
    async validateAndSave({deviceId, label, host, passphrase}) {
      // Resolve edit-only blank fields internally from encrypted secrets or a legacy lastKnownHost.
      // Require a non-empty label and complete candidate connection.
      // Await validator.validate({id, label, host, passphrase, port: 9922, username: "prisoner"}).
      // On !ok: return {ok: false, status}; do not write registry or secrets.
      // On ok: save allowed verified facts, store host/passphrase encrypted, remove legacy lastKnownHost,
      // and return publicProfile(savedProfile, availability).
    },
  };
}
```

Use `crypto.randomUUID` through an injected `createId` default, a stable `lg-` prefix, the existing `LG_APP_ID`, and the production backend environment. Accept only the fact keys already allowed by `device-registry`; reject a success response without a non-empty verified `model`. Do not persist validation diagnostics, raw command output, or an unrecognized fact key.

- [ ] **Step 5: Update registry expectations without weakening secret protection**

Keep legacy `lastKnownHost` readable for the one-time service migration, but make all new service writes omit it. Add a registry test proving a profile saved by the service envelope does not contain `host`, `passphrase`, or any secret-named field. Keep the existing LG-only, app-ID, and backend-environment guards.

- [ ] **Step 6: Run the focused profile tests**

Run: `rtk node --test tests/unit/device-registry.test.js tests/unit/device-profile-service.test.js tests/unit/device-secret-file-store.test.js tests/unit/device-secret-store.test.js`

Expected: PASS. This is entirely fake-driven; it must not invoke `child_process`, a CLI, or a network client.

### Task 3: Replace device IPC with a deferred, redacted candidate boundary

**Files:**
- Modify: `app/main.js`
- Modify: `app/tv-device-ipc.js`
- Modify: `app/preload.js`
- Modify: `tests/unit/tv-device-ipc.test.js`

**Interfaces:**
- Renderer-to-main candidate: `{deviceId?: string, label: string, host?: string, passphrase?: string}`.
- Main-to-renderer result: `{ok: boolean, status?: "VALIDATION_UNAVAILABLE" | "CANDIDATE_INVALID" | "VALIDATION_FAILED", device?: PublicDevice}`.
- `PublicDevice` contains identity/verified metadata and `hasConnection`/`hasPassphrase` booleans only; it must never include host, passphrase, path, raw output, or diagnostic request/response fields.

- [ ] **Step 1: Write failing IPC tests for the new candidate channel**

```js
test("returns a redacted candidate result and never invokes discovery, target registration, or a TV adapter", async () => {
  const result = await handlers.get("validate-and-save-tv-device")(undefined, {
    label: "Living room", host: "candidate-host", passphrase: "candidate-pass",
  });
  assert.deepEqual(calls, [["validateAndSave", {label: "Living room", host: "candidate-host", passphrase: "candidate-pass"}]]);
  assert.doesNotMatch(JSON.stringify(result), /candidate-host|candidate-pass/);
  assert.equal(discovery.calls.length, 0);
});

test("production deferred validation leaves registry and encrypted secrets unchanged", async () => {
  assert.deepEqual(await handlers.get("validate-and-save-tv-device")(undefined, candidate), {
    ok: false, status: "VALIDATION_UNAVAILABLE",
  });
});
```

- [ ] **Step 2: Run the IPC test to verify it fails**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js`

Expected: FAIL because the channel and `deviceProfiles` dependency do not exist.

- [ ] **Step 3: Implement narrow IPC and preload contracts**

In `tv-device-ipc.js`, replace the raw `save-tv-device` route with `validate-and-save-tv-device`, delegate only to `deviceProfiles.validateAndSave`, and return a fixed safe status for missing dependencies or caught errors. Change list handling to `deviceProfiles.listPublicProfiles`.

In `preload.js`, replace `saveTvDevice` and `validateTvDevice` with:

```js
listTvDevices: () => ipcRenderer.invoke("list-tv-devices"),
validateAndSaveTvDevice: (candidate) => ipcRenderer.invoke("validate-and-save-tv-device", candidate),
```

Remove the now-unreachable `validate-tv-device` renderer bridge. Do not add an event bridge, shell action, file picker, process spawn, or live command.

- [ ] **Step 4: Wire an explicitly unavailable production validator in `main.js`**

Create the device registry and a JSON secret store at app-owned user-data paths. Build `createDeviceSecretStore` with Electron `safeStorage`, then construct `createDeviceProfileService` with:

```js
validator: {
  async validate() {
    return {ok: false, status: "VALIDATION_UNAVAILABLE"};
  },
},
```

Pass that service to `registerTvDeviceIpc`. Remove `createDeviceDiscovery`, `createConfiguredWebOsReadOnlyAdapter`, and their direct validation wiring from this path. Keep any other existing toolchain code unchanged unless it is directly exposed by the removed device form.

- [ ] **Step 5: Run the focused IPC test**

Run: `rtk node --test tests/unit/tv-device-ipc.test.js`

Expected: PASS, including redaction and explicit proof that no discovery/registration dependency was called.

### Task 4: Implement the compact LG selector and dialog editor

**Files:**
- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`
- Modify: `tests/unit/renderer.test.js`

**Interfaces:**
- Adds button IDs `tv-device-add-button`, `tv-device-edit-button`, `tv-device-dialog-submit-button`, `tv-device-dialog-cancel-button`, and `tv-device-passphrase-toggle`.
- Adds inputs `tv-device-name-input`, `tv-device-host-input`, and `tv-device-passphrase-input`; these are the only editable device inputs.
- Consumes `api.validateAndSaveTvDevice(candidate)` and `api.listTvDevices()`.
- Produces no persistent renderer candidate state after closing the dialog.

- [ ] **Step 1: Write failing renderer tests for the closed-by-default dialog and simplified fields**

```js
test("keeps LG device editing closed by default and exposes only name, host, and passphrase when Add device is clicked", async () => {
  await controller.selectRunTarget("webos");
  assert.match(elements["tv-device-dialog"].className, /hidden/);
  elements["tv-device-add-button"].dispatchEvent("click");
  assert.doesNotMatch(elements["tv-device-dialog"].className, /hidden/);
  assert.equal(elements["tv-device-name-input"].disabled, false);
  assert.equal(elements["tv-device-host-input"].disabled, false);
  assert.equal(elements["tv-device-passphrase-input"].disabled, false);
  assert.equal(elements["tv-device-model-input"], undefined);
  assert.equal(elements["tv-device-id-input"], undefined);
});

test("shows only the current typed passphrase and clears every candidate field when the dialog closes", () => {
  // Toggle changes the current input type only; close restores password type and blanks all three values.
});
```

- [ ] **Step 2: Write failing renderer tests for edit and deferred save results**

```js
test("opens Edit with only the display name and never repopulates saved host or passphrase", async () => {
  await controller.selectRunTarget("webos");
  elements["tv-device-edit-button"].dispatchEvent("click");
  assert.equal(elements["tv-device-name-input"].value, "Lab LG");
  assert.equal(elements["tv-device-host-input"].value, "");
  assert.equal(elements["tv-device-passphrase-input"].value, "");
});

test("keeps the dialog open on deferred validation without saving or contacting a TV", async () => {
  runner.validateAndSaveTvDevice = async () => ({ok: false, status: "VALIDATION_UNAVAILABLE"});
  await controller.submitTvDeviceDialog();
  assert.match(elements["tv-device-dialog-status"].textContent, /not available/i);
  assert.equal(listCalls, 0);
  assert.equal(legacyValidationCalls, 0);
});
```

- [ ] **Step 3: Run the renderer test to verify it fails**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: FAIL because the dialog elements and controller methods do not exist.

- [ ] **Step 4: Replace the inline markup with accessible action and dialog markup**

Replace **Saved LG device** with **LG device list**. Place a two-sided action row directly below the selector: `+ Add device` aligned left, `Edit device` aligned right. Remove the always-visible `Save LG device` fields and standalone validation button.

Add a hidden modal dialog with a mode-aware title, the three named fields, a temporary Show/Hide button, safe fixed-default helper copy, a `role="status"` area, and horizontal Cancel / **Validate and save** footer. Add `autocomplete="new-password"` only to the current passphrase input. Do not include or conceal the old model/device-ID/vendor/host form controls; remove them from the DOM.

- [ ] **Step 5: Implement minimal renderer state and safe status presentation**

Add controller-local `deviceDialogMode` and `editingDeviceId`. Implement `openTvDeviceDialog(mode)`, `closeTvDeviceDialog()`, `submitTvDeviceDialog()`, and a `deferredValidationText(status)` mapper. On Add, clear fields. On Edit, populate only selected public label, leave host and passphrase empty, and mark the two empty values as optional replacements. On submit, send only `{deviceId, label, host, passphrase}` to the new preload API.

On success, reload redacted devices, select the returned profile, show a safe saved status, close the dialog, restore `type="password"`, and blank every candidate field. On failure, keep the dialog open, preserve only the typed current input, and show `Connection validation is not available in this build.` for `VALIDATION_UNAVAILABLE`. Never call the old validation API, toolchain inspection, target registration, Appium, or test runner.

- [ ] **Step 6: Add responsive dialog and action-row CSS**

```css
.tv-device-actions { display: flex; justify-content: space-between; gap: 12px; }
.tv-device-dialog-fields { display: grid; gap: 16px; }
.tv-device-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
```

Use the existing modal colors, borders, and focus styles. At narrow sidebar widths, permit the footer to wrap while preserving its horizontal order. Do not redesign the rest of the workspace or Settings UI.

- [ ] **Step 7: Run the focused renderer test**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: PASS, including Browser-target hiding, dialog-only editing, redaction, and no live-operation calls.

### Task 5: Document the explicit boundary and perform the required checks

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/real-tv-appium/architecture.md`
- Modify: `docs/real-tv-appium/HANDOFF.md`

**Interfaces:**
- Documents the UI-to-main candidate boundary, encrypted secret persistence, and explicit deferred validation state.
- Does not describe the current build as capable of pairing, target registration, or live validation.

- [ ] **Step 1: Add concise operational documentation**

State that the LG sidebar shows a list plus Add/Edit dialog; the dialog accepts only device name, host, and passphrase; saved connection values remain encrypted and unreadable in renderer UI; and current **Validate and save** returns an explicit unavailable status until future live preflight and fresh approval. State that verified model/firmware/app facts will select only an existing central ChromeDriver profile.

- [ ] **Step 2: Run focused safety regression tests**

Run: `rtk node --test tests/unit/device-registry.test.js tests/unit/device-secret-file-store.test.js tests/unit/device-secret-store.test.js tests/unit/device-profile-service.test.js tests/unit/tv-device-ipc.test.js tests/unit/renderer.test.js`

Expected: PASS. Confirm no test body constructs a production CLI, executes a process, or opens a network connection.

- [ ] **Step 3: Run mandatory repository validation after the final edit**

Run each command separately:

```sh
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: all unit tests pass; all syntax checks return exit code 0; Playwright lists the generic test without running a TV; and whitespace validation reports no errors.

- [ ] **Step 4: Refresh and verify the local knowledge graph**

Run the approved sequential graph update workaround, then:

```sh
rtk graphify check-update .
```

Expected: the graph is current. Treat pre-existing zero-node warnings for data fixtures as non-blocking only when no code parse error is reported.

- [ ] **Step 5: Leave the shared worktree unstaged**

Run: `rtk git status --short`

Expected: only the intended files are additionally changed; preserve all pre-existing unrelated changes, generated Graphify artifacts, and `.superpowers` visual artifacts. Do not stage or commit in this shared dirty worktree.

## Self-review

- **Spec coverage:** Tasks 1–3 implement encrypted main-process ownership, fake-only validation, failed-add/edit preservation, deferred production validation, and redacted IPC. Task 4 implements the renamed selector, Add/Edit dialog, reduced fields, fixed-default copy, passphrase reveal semantics, layout, and safe feedback. Task 5 documents the boundary and performs the mandatory validation/graph checks. ChromeDriver’s central-profile constraint is stated in Global Constraints and documentation.
- **Placeholder scan:** No task uses TBD/TODO, an unspecified test, or an undefined interface. The only intentionally unavailable behavior is represented by the concrete `VALIDATION_UNAVAILABLE` response.
- **Type consistency:** The renderer sends `deviceId`, `label`, `host`, and `passphrase`; preload forwards exactly that candidate; IPC delegates it to `deviceProfiles.validateAndSave`; the service returns a `PublicDevice` only after success. `listPublicProfiles` is the list endpoint source in both IPC and renderer.
