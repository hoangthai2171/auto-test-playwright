# LG Local Toolchain Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator configure the local LG webOS/Appium toolchain and add one webOS vendor target without connecting to or changing the TV.

**Architecture:** Keep local paths in a versioned Electron user-data file behind a main-process configuration store. Build the webOS read-only adapter and vendor-target registrar from that private configuration only; IPC responses expose fixed statuses, component availability, and a target name, never paths, hosts, command arguments, credentials, or pairing material. The renderer adds separate explicit local-only configuration and registration actions while retaining the existing profile save and disabled LG Run state.

**Tech Stack:** Electron main/preload/renderer, CommonJS, Node.js `fs/promises`, `child_process.spawnSync`, Node built-in test runner, webOS CLI.

## Global Constraints

- LG/webOS only; Samsung is excluded entirely.
- This increment makes no TV connection and must not call validation, pairing, key retrieval, remote navigation, reset, deployment, installation, uninstallation, launch, test execution, or any Appium session command.
- Vendor target registration is add-only: list first, add only when the name is absent, and return `TARGET_NAME_CONFLICT` without modifying, removing, resetting, or making a vendor default target.
- Registration invokes only `ares-setup-device --listfull` and, when safe, `ares-setup-device --add <targetName> --info host=<host>,port=9922,username=prisoner` as individual spawn arguments; never use a shell or interactive mode.
- Local configuration is persisted atomically in Electron user data; only the existing explicit Save LG device action may write a MyTV device profile.
- Main-process IPC must not return local tool paths, hosts, credentials, pairing material, screenshots, command strings, or command arguments. Redacted evidence remains only in the ignored evidence directory.
- Preserve `appium:rcMode: "rc"`, native remote keys, the MyTV-only fresh-session reset rule, and the prohibition on `webos: clearApp`; this increment does not invoke any of them.
- Keep LG Run disabled and do not perform manual TV validation. A future validation remains a separately approved live operation with its required preflight.
- Use `apply_patch` for repository edits. Prefix every shell command with `rtk`. Do not stage, commit, reset, checkout, push, or alter unrelated work.
- After every repository edit run `rtk npm run test:unit`, all three required `node --check` commands, `rtk npx playwright test tests/run-test-case-mytv.spec.js --list`, and `rtk git diff --check`.

---

## File Structure

- `app/tv-toolchain-config.js` — versioned, atomic local configuration store; path validation; private configuration resolution; redacted availability summary.
- `app/webos-target-registration.js` — add-only `ares-setup-device` command boundary with conservative input/list parsing and fixed error statuses.
- `app/tv-toolchain.js` — configured local availability inspection that injects `APPIUM_HOME` only into project-local Appium metadata commands.
- `app/webos-read-only-adapter.js` — existing identity/app inventory adapter gains a configuration-backed constructor so every webOS CLI execution uses the saved SDK home.
- `app/tv-device-ipc.js` — private configuration and registration wiring; redacted configuration and target-registration IPC handlers.
- `app/main.js` / `app/preload.js` — Electron user-data path, main-process object composition, and narrow preload methods.
- `app/renderer/index.html`, `app/renderer/renderer.js`, `app/renderer/styles.css` — explicit configuration and registration controls, local-only status copy, host clearing, and focus-compatible layout.
- `tests/unit/*.test.js` — contract tests for the isolated boundaries and renderer behavior.
- `docs/real-tv-appium/phases.md` — Phase 4 checklist/evidence note, with no secrets or runtime paths.

### Task 1: Private, atomic local toolchain configuration

**Files:**
- Create: `app/tv-toolchain-config.js`
- Create: `tests/unit/tv-toolchain-config.test.js`

**Interfaces:**
- Consumes: injected `{filePath, fs}` where `fs` supplies `readFile`, `writeFile`, `rename`, and `stat` from `node:fs/promises`.
- Produces: `createTvToolchainConfig({filePath, fs})` with `save(input)`, `resolve()`, and `status()`.
- `save({webosSdkHome, appiumHome, chromedriverPath})` resolves to `{configured: true, platform: "webos", components: [{id, label, status}]}` only after verifying both homes are directories, the ChromeDriver is a file, and the SDK contains `CLI/bin/ares`, `ares-setup-device`, `ares-device-info`, and `ares-install` files.
- `resolve()` returns the private normalized `{webosSdkHome, appiumHome, chromedriverPath}` only to main-process collaborators, or throws an error with `code === "TOOLCHAIN_NOT_CONFIGURED"` when no valid file exists.
- `status()` returns `{configured, platform: "webos", components}` without a path value. Every component has `{id, label, status: "ready" | "missing"}`.

- [x] **Step 1: Write failing storage and redaction contract tests**

```js
test("atomically saves a valid private toolchain and exposes only availability", async () => {
  const files = new Map();
  const config = createTvToolchainConfig({filePath: "/user-data/tv-toolchain.json", fs: fakeFs(files)});

  const publicStatus = await config.save({
    webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/drivers/chromedriver",
  });

  assert.deepEqual(publicStatus, {
    configured: true,
    platform: "webos",
    components: [
      {id: "webos-sdk", label: "webOS SDK", status: "ready"},
      {id: "appium-home", label: "Appium home", status: "ready"},
      {id: "chromedriver", label: "ChromeDriver", status: "ready"},
    ],
  });
  assert.doesNotMatch(JSON.stringify(publicStatus), /\/sdk|\/appium-home|chromedriver$/);
  assert.deepEqual(await config.resolve(), {
    webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/drivers/chromedriver",
  });
  assert.equal(files.has("/user-data/tv-toolchain.json.tmp"), false);
});

test("rejects an incomplete toolchain before any persistent write", async () => {
  const writes = [];
  const config = createTvToolchainConfig({filePath: "/user-data/tv-toolchain.json", fs: fakeFs(new Map(), writes, {missing: ["/sdk/CLI/bin/ares-install"]})});

  await assert.rejects(
    config.save({webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/drivers/chromedriver"}),
    (error) => error.code === "TOOLCHAIN_INVALID" && !/\/sdk|\/appium-home/.test(error.message),
  );
  assert.deepEqual(writes, []);
});
```

- [x] **Step 2: Run the focused tests and verify they fail because the module is absent**

Run: `rtk node --test tests/unit/tv-toolchain-config.test.js`

Expected: FAIL with `Cannot find module '../../app/tv-toolchain-config'`.

- [x] **Step 3: Implement the minimal private configuration store**

```js
const REQUIRED_SDK_FILES = ["ares", "ares-setup-device", "ares-device-info", "ares-install"];

function createTvToolchainConfig({filePath, fs}) {
  async function checked(input) {
    const value = {
      webosSdkHome: String(input?.webosSdkHome || "").trim(),
      appiumHome: String(input?.appiumHome || "").trim(),
      chromedriverPath: String(input?.chromedriverPath || "").trim(),
    };
    // `stat` verifies directory/file type for the three paths and all four SDK tools.
    return value;
  }
  return {
    async save(input) {
      const value = await checked(input);
      const temporaryPath = `${filePath}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify({version: 1, ...value})}\n`, "utf8");
      await fs.rename(temporaryPath, filePath);
      return publicStatus(value, true);
    },
    async resolve() { return checked(await readStoredValue()); },
    async status() { /* map checked configuration to public component status with no paths */ },
  };
}
```

Implement `checked`, `readStoredValue`, and `publicStatus` completely in this file: a missing configuration file yields `status()` with `configured: false`; malformed, wrong-version, non-string, or unavailable stored values never reach renderer IPC and cause `resolve()` to throw a host/path-free `TOOLCHAIN_NOT_CONFIGURED` or `TOOLCHAIN_INVALID` error. Do not invoke a CLI or network operation in this module.

- [x] **Step 4: Run the focused tests and verify the public/private boundary**

Run: `rtk node --test tests/unit/tv-toolchain-config.test.js`

Expected: PASS, including atomic rename ordering, missing-file status, invalid-path rejection with no write, and no local path in a public result.

- [x] **Step 5: Run the required repository validation set**

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: every command exits 0. Do not stage or commit.

### Task 2: Add-only webOS vendor target command boundary

**Files:**
- Create: `app/webos-target-registration.js`
- Create: `tests/unit/webos-target-registration.test.js`

**Interfaces:**
- Consumes: `createWebOsTargetRegistration({webosSdkHome, spawnSync})`; `webosSdkHome` is private and has already been resolved by Task 1.
- Produces: `await register({targetName, host})` resolving to `{ok: true, status: "TARGET_REGISTERED", targetName}` or `{ok: false, status}` where status is one of `INVALID_TARGET_NAME`, `INVALID_HOST`, `TOOLCHAIN_UNAVAILABLE`, `TARGET_LIST_FAILED`, `TARGET_LIST_UNREADABLE`, `TARGET_NAME_CONFLICT`, or `TARGET_REGISTRATION_FAILED`.
- `targetName` accepts only `/^[A-Za-z][A-Za-z0-9_-]{0,63}$/`; `host` accepts an IPv4/IPv6 literal or DNS host label sequence without whitespace, URL syntax, credentials, ports, or shell characters.
- The only child-process calls are `[aresSetupDevice, ["--listfull"]]` and, after an empty safe parsed name set, `[aresSetupDevice, ["--add", targetName, "--info", `host=${host},port=9922,username=prisoner`]]` with `{encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true}`.

- [x] **Step 1: Write failing add-only command contract tests**

```js
test("adds a previously unused target with fixed local-only connection arguments", async () => {
  const calls = [];
  const registration = createWebOsTargetRegistration({
    webosSdkHome: "/sdk",
    spawnSync(command, args, options) {
      calls.push([command, args, options]);
      return args[0] === "--listfull" ? {status: 0, stdout: "name : another-target\n"} : {status: 0, stdout: ""};
    },
  });

  assert.deepEqual(await registration.register({targetName: "office-lg", host: "192.0.2.1"}), {
    ok: true, status: "TARGET_REGISTERED", targetName: "office-lg",
  });
  assert.deepEqual(calls.map(([command, args]) => [command, args]), [
    ["/sdk/CLI/bin/ares-setup-device", ["--listfull"]],
    ["/sdk/CLI/bin/ares-setup-device", ["--add", "office-lg", "--info", "host=192.0.2.1,port=9922,username=prisoner"]],
  ]);
});

test("refuses a listed target name without an add, modify, remove, or default command", async () => {
  const calls = [];
  const registration = createWebOsTargetRegistration({webosSdkHome: "/sdk", spawnSync(_command, args) {
    calls.push(args); return {status: 0, stdout: "name : office-lg\n"};
  }});

  assert.deepEqual(await registration.register({targetName: "office-lg", host: "192.0.2.1"}), {
    ok: false, status: "TARGET_NAME_CONFLICT",
  });
  assert.deepEqual(calls, [["--listfull"]]);
});
```

Add assertions for invalid names/hosts with zero process calls, an `ENOENT` list result that maps to `TOOLCHAIN_UNAVAILABLE`, unparseable successful list output that maps to `TARGET_LIST_UNREADABLE`, and nonzero add results that expose neither the host nor stderr.

- [x] **Step 2: Run the focused tests and verify they fail because the adapter is absent**

Run: `rtk node --test tests/unit/webos-target-registration.test.js`

Expected: FAIL with `Cannot find module '../../app/webos-target-registration'`.

- [x] **Step 3: Implement strict parsing and add-only registration**

```js
function parseListedTargetNames(output) {
  const names = new Set();
  for (const line of String(output || "").split(/\r?\n/u)) {
    const match = line.match(/^\s*name\s*:\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*$/iu);
    if (match) names.add(match[1]);
  }
  return names.size ? names : null;
}

async function register({targetName, host}) {
  if (!isTargetName(targetName)) return {ok: false, status: "INVALID_TARGET_NAME"};
  if (!isHost(host)) return {ok: false, status: "INVALID_HOST"};
  const listed = run(["--listfull"]);
  const names = parseListedTargetNames(listed.stdout);
  if (!names) return {ok: false, status: "TARGET_LIST_UNREADABLE"};
  if (names.has(targetName)) return {ok: false, status: "TARGET_NAME_CONFLICT"};
  return run(["--add", targetName, "--info", `host=${host},port=9922,username=prisoner`]).ok
    ? {ok: true, status: "TARGET_REGISTERED", targetName}
    : {ok: false, status: "TARGET_REGISTRATION_FAILED"};
}
```

Implement `run` so it maps `ENOENT` to `TOOLCHAIN_UNAVAILABLE`, maps every other list failure to `TARGET_LIST_FAILED`, maps every add failure to `TARGET_REGISTRATION_FAILED`, and never constructs an error string from stdout/stderr/arguments. Do not import or call Appium, the read-only adapter, device discovery, or a profile registry.

- [x] **Step 4: Run the focused tests and verify no unsafe command is reachable**

Run: `rtk node --test tests/unit/webos-target-registration.test.js`

Expected: PASS. The captured process calls contain only the list and add argument arrays asserted in Step 1, and conflict/validation paths contain no add call.

- [x] **Step 5: Run the required repository validation set**

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: every command exits 0. Do not stage or commit.

### Task 3: Configuration-aware inspection, IPC, and Electron composition

**Files:**
- Modify: `app/tv-toolchain.js`
- Modify: `app/webos-read-only-adapter.js`
- Modify: `app/tv-device-ipc.js`
- Modify: `app/main.js:13-123`
- Modify: `app/preload.js:5-12`
- Modify: `tests/unit/tv-toolchain.test.js`
- Modify: `tests/unit/webos-read-only-adapter.test.js`
- Modify: `tests/unit/tv-device-ipc.test.js`

**Interfaces:**
- Consumes: Task 1 `toolchainConfig.resolve()` and `status()`; Task 2 `createWebOsTargetRegistration({webosSdkHome, spawnSync})`.
- Produces: preload methods `getTvToolchainConfiguration()`, `saveTvToolchainConfiguration(input)`, and `registerWebOsTarget(input)`.
- `createTvToolchainInspector({toolchainConfig, spawnSync, appiumBin})` has asynchronous `inspect()` and returns `{ok, platform: "webos", configured, components, tools}` without a path, host, or Appium home value.
- `createConfiguredWebOsReadOnlyAdapter({toolchainConfig, spawnSync})` is exported from `app/webos-read-only-adapter.js`; it resolves the configured SDK home immediately before delegating to the existing `createWebOsReadOnlyAdapter`, so every future approved discovery operation uses configuration rather than an environment/default path.
- `registerTvDeviceIpc({...})` adds exactly `get-tv-toolchain-configuration`, `save-tv-toolchain-configuration`, and `register-webos-target`. The registration handler may invoke the config resolver and Task 2 registrar only; it must not invoke `registry.save`, `discovery.validate`, `toolchain.inspect`, or run-test IPC.

- [x] **Step 1: Write failing boundary tests for private configuration and registration isolation**

```js
test("registers a local target without profile save, validation, inspection, or execution", async () => {
  const calls = [];
  const {handlers} = createHarness({
    toolchainConfig: {async resolve() { calls.push("resolve"); return {webosSdkHome: "/sdk"}; }},
    createTargetRegistration({webosSdkHome}) {
      calls.push(["factory", webosSdkHome]);
      return {async register(input) { calls.push(["register", input]); return {ok: true, status: "TARGET_REGISTERED", targetName: input.targetName}; }};
    },
  });

  const result = await handlers.get("register-webos-target")(undefined, {targetName: "office-lg", host: "192.0.2.1"});

  assert.deepEqual(result, {ok: true, status: "TARGET_REGISTERED", targetName: "office-lg"});
  assert.deepEqual(calls, ["resolve", ["factory", "/sdk"], ["register", {targetName: "office-lg", host: "192.0.2.1"}]]);
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|\/sdk/);
});

test("inspects Appium with the configured home and never publishes it", async () => {
  const calls = [];
  const inspector = createTvToolchainInspector({
    toolchainConfig: {async resolve() { return {webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/driver"}; }},
    spawnSync(command, args, options) { calls.push([command, args, options.env.APPIUM_HOME]); return appiumResult(args); },
  });

  const result = await inspector.inspect();
  assert.equal(calls[0][2], "/appium-home");
  assert.doesNotMatch(JSON.stringify(result), /\/sdk|\/appium-home|\/driver/);
});
```

Add a configured-adapter test that records `ares-device-info --device <registeredName>` only after its fake config resolves, and add IPC tests that saved configuration and status responses contain no raw tool path. Update the existing inspector tests to `await inspect()` and assert required SDK tool checks include `ares` and `ares-setup-device`.

- [x] **Step 2: Run the focused boundary tests and verify they fail against the old interfaces**

Run:

```bash
rtk node --test tests/unit/tv-toolchain.test.js tests/unit/webos-read-only-adapter.test.js tests/unit/tv-device-ipc.test.js
```

Expected: FAIL because the configuration-aware constructor and three IPC handlers do not exist yet.

- [x] **Step 3: Implement configuration-aware main-process wiring**

```js
const toolchainConfig = createTvToolchainConfig({filePath: tvToolchainPath(), fs});
const configuredWebos = createConfiguredWebOsReadOnlyAdapter({toolchainConfig});

registerTvDeviceIpc({
  ipcMain,
  registry: createDeviceRegistry({filePath: tvDevicesPath(), fs}),
  discovery: createDeviceDiscovery({webos: configuredWebos, redact: redactSensitiveText}),
  toolchainConfig,
  toolchain: createTvToolchainInspector({toolchainConfig}),
  createTargetRegistration: (configuration) => createWebOsTargetRegistration({webosSdkHome: configuration.webosSdkHome}),
  redact: redactSensitiveText,
});
```

In `app/main.js`, define `tvToolchainPath()` as an Electron user-data path adjacent to `tvDevicesPath()`, and remove `LG_WEBOS_TV_SDK_HOME`/repository-default resolution from Electron’s webOS CLI path. In `app/preload.js`, expose only the three narrow IPC methods named in this task. Make the inspector’s `commandOutput` pass `env: {...process.env, APPIUM_HOME: configuration.appiumHome}` while using the existing project-local `appiumBin`; it must not expose the ChromeDriver path or execute a session. IPC catches errors into fixed, redacted statuses and strips all host/path-shaped values before returning.

- [x] **Step 4: Run focused tests and verify configuration is the only Electron CLI source**

Run:

```bash
rtk node --test tests/unit/tv-toolchain.test.js tests/unit/webos-read-only-adapter.test.js tests/unit/tv-device-ipc.test.js
rtk node --check app/main.js
rtk node --check app/preload.js
```

Expected: PASS and exit 0. The tests prove no registration handler path calls discovery, profile saving, inspection, or run execution.

- [x] **Step 5: Run the required repository validation set**

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: every command exits 0. Do not stage or commit.

### Task 4: Explicit local-only configuration and registration UI

**Files:**
- Modify: `app/renderer/index.html:80-125`
- Modify: `app/renderer/renderer.js:90-140, 800-870, 1270-1350`
- Modify: `app/renderer/styles.css` near existing `.tv-device-editor` rules
- Modify: `tests/unit/renderer.test.js:270-330, 1170-1270`
- Modify: `docs/real-tv-appium/phases.md` in the Phase 4 checklist

**Interfaces:**
- Consumes: Task 3 preload methods `getTvToolchainConfiguration`, `saveTvToolchainConfiguration`, and `registerWebOsTarget`.
- Produces: renderer controller methods `loadTvToolchainConfiguration()`, `saveTvToolchainConfiguration()`, and `registerWebOsTarget()` for unit testing.
- Configuration input values are `webosSdkHome`, `appiumHome`, and `chromedriverPath`. Their successful renderer result contains only the Task 1 public availability status.
- Target registration uses the existing `tv-device-vendor-name-input` as `targetName` and `tv-device-host-input` as `host`; success yields only `{ok: true, status: "TARGET_REGISTERED", targetName}` and clears `tv-device-host-input`.

- [x] **Step 1: Write failing renderer and markup tests for local-only behavior**

```js
test("saves local toolchain configuration without validation, registration, or a test run", async () => {
  const fixture = createRendererFixture();
  const calls = [];
  fixture.runner.saveTvToolchainConfiguration = async (input) => {
    calls.push(input); return {configured: true, platform: "webos", components: readyComponents};
  };
  fixture.runner.validateTvDevice = async () => { throw new Error("must not validate"); };
  fixture.runner.registerWebOsTarget = async () => { throw new Error("must not register"); };
  fixture.runner.runTest = async () => { throw new Error("must not run"); };
  fillToolchainInputs(fixture, {webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/driver"});

  const result = await renderer.createRendererController(fixture).saveTvToolchainConfiguration();

  assert.equal(result.configured, true);
  assert.deepEqual(calls, [{webosSdkHome: "/sdk", appiumHome: "/appium-home", chromedriverPath: "/driver"}]);
  assert.doesNotMatch(fixture.elements["tv-toolchain-status"].textContent, /\/sdk|\/appium-home|\/driver/);
});

test("registers an unused local target, clears its host, and does not save a profile", async () => {
  const fixture = createRendererFixture();
  let saves = 0;
  fixture.runner.saveTvDevice = async () => { saves += 1; return {ok: true}; };
  fixture.runner.registerWebOsTarget = async () => ({ok: true, status: "TARGET_REGISTERED", targetName: "office-lg"});
  fixture.elements["tv-device-vendor-name-input"].value = "office-lg";
  fixture.elements["tv-device-host-input"].value = "192.0.2.1";

  await renderer.createRendererController(fixture).registerWebOsTarget();

  assert.equal(saves, 0);
  assert.equal(fixture.elements["tv-device-host-input"].value, "");
  assert.match(fixture.elements["tv-device-status"].textContent, /registered locally/i);
});
```

Add tests that `TARGET_NAME_CONFLICT` tells the operator to choose a new target name without suggesting modify/retry; markup contains the three configuration inputs, save button, register button, and redaction-safe explanatory copy; neither the target registration nor configuration save enables LG Run.

- [x] **Step 2: Run the focused renderer tests and verify they fail before the controls exist**

Run: `rtk node --test tests/unit/renderer.test.js`

Expected: FAIL because the controller methods and input/button IDs are absent.

- [x] **Step 3: Implement explicit, separate local-only controls**

```html
<section class="tv-toolchain-editor" aria-labelledby="tv-toolchain-editor-title">
  <h3 id="tv-toolchain-editor-title">Configure local LG toolchain</h3>
  <label>webOS SDK home <input id="tv-toolchain-sdk-home-input" autocomplete="off" /></label>
  <label>Appium home <input id="tv-toolchain-appium-home-input" autocomplete="off" /></label>
  <label>ChromeDriver executable <input id="tv-toolchain-chromedriver-input" autocomplete="off" /></label>
  <button type="button" id="tv-toolchain-save-button" class="secondary-button">Save local toolchain</button>
</section>
<button type="button" id="tv-device-register-button" class="secondary-button">Register local webOS target</button>
```

`saveTvToolchainConfiguration()` reads these values, calls only `api.saveTvToolchainConfiguration(input)`, replaces `tv-toolchain-status` with component labels/statuses, and clears the three local path fields after a successful save. `registerWebOsTarget()` reads only the existing vendor-name/host fields, calls only `api.registerWebOsTarget({targetName, host})`, maps `TARGET_NAME_CONFLICT` to a non-destructive message, clears the host on `TARGET_REGISTERED`, and never calls profile save, validation, inspection, or test execution. Disable only the clicked action while its request is pending; keep the existing LG Run-disabled behavior unchanged. Style the new editor with the existing narrow device-editor visual language; do not alter broader desktop layout or Browser controls.

- [x] **Step 4: Run focused tests and a local non-TV Electron inspection**

Run:

```bash
rtk node --test tests/unit/renderer.test.js
rtk npm run app:dev
```

Expected: renderer unit tests PASS. In the Electron window, inspect that configuration fields and register button are visible and LG Run remains disabled; do not enter a real host, save a configuration, register a target, press Validate, press Run, or accept/dismiss any TV prompt. Stop the local app after inspection.

- [x] **Step 5: Record scope evidence and run the required repository validation set**

Update `docs/real-tv-appium/phases.md` with an add-only Phase 4 note stating that local configuration and vendor target registration are implemented and unit-verified, no live validation was run, and any future validation needs explicit approval/preflight. Do not include paths, hosts, target names, credentials, pairing values, or screenshots.

Run:

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
rtk git diff --check
```

Expected: every command exits 0. Do not stage or commit.

## Plan Self-Review

### Spec coverage

- Local configuration ownership, atomic persistence, three operator-provided paths, and no path disclosure are covered by Task 1.
- Required webOS files, Appium-home injection for project-local metadata, and configured-SDK-only CLI construction are covered by Tasks 1 and 3.
- Add-only list-before-add registration, fixed port/user arguments, conservative validation, conflict behavior, and stable redacted statuses are covered by Task 2 and IPC assertions in Task 3.
- The explicit separate UI, reuse of vendor-name/current-host inputs, host clearing, disabled Run, and no profile auto-save are covered by Task 4.
- No pairing, identity/app validation, TV operation, or unredacted evidence is reinforced by Global Constraints and test assertions in Tasks 2 through 4.

No design requirement lacks a task.

### Placeholder scan

The plan contains no deferred-work markers or unspecified error-handling directive. The only abbreviated implementation comment in Task 1 is expanded in the adjacent required prose and contract signatures.

### Type consistency

- Task 1 consistently provides `toolchainConfig.resolve()`, `save(input)`, and `status()`.
- Task 2 consistently consumes `{targetName, host}` and returns `TARGET_REGISTERED`/fixed failure statuses.
- Task 3 exports the same preload names that Task 4 consumes.
- Task 4 uses `tv-device-vendor-name-input` and `tv-device-host-input`, matching the pre-existing renderer IDs and Task 3 `registerWebOsTarget(input)` contract.
