# Server-Driven Test Case Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the Electron app's fixed test-mode selector with a local `testcased.json` runner that validates structured actions, supports a limited `qaDescription` fallback, and removes the AI-key/manual-planning feature from the product flow.

**Architecture:** The Electron main process loads a selected case ID from the local fixture and starts one generic Playwright spec. Pure Node modules validate and compile cases; an injected action runner dispatches validated actions to existing MyTV helpers. The UI displays sanitized case metadata and sends only the selected case ID, app URL, and preview settings to the main process.

**Tech Stack:** Node.js 20+, CommonJS, Electron 31, Playwright 1.61, built-in `node:test`, HTML/CSS/vanilla browser JavaScript.

## Global Constraints

- Preserve the existing `workers: 1` shared-session behavior.
- Preserve TV remote navigation with arrow keys, Enter, Backspace, and Escape; do not introduce mouse-driven app interaction.
- Use the app virtual keyboard character-by-character for text input.
- Reuse `tests/lib` MyTV helpers, Vietnamese normalization, focus checks, waits, and artifact capture.
- Keep legacy Playwright specs runnable from the terminal but remove them from Electron test-case selection.
- Use explicit structured action objects; never evaluate server-provided JavaScript, selectors, module paths, or function names.
- Treat literal credentials in fixtures/cases as sensitive; mask passwords in renderer data, logs, and report labels.
- `testcased.json` is a development fixture and is read-only at runtime.
- API retrieval and the Electron user-data cache are excluded from this plan and require a follow-up plan after the local runner is proven.
- Use `apply_patch` for file edits and prefix shell commands with `rtk` in this repository.

## File map

### Create

- `testcased.json` — two-case local fixture matching the server list shape, with explicit actions.
- `tests/lib/test-case-schema.js` — pure validation and normalization for test cases/actions.
- `tests/lib/test-case-source.js` — read-only local JSON loader and case lookup.
- `tests/lib/test-case-compiler.js` — deterministic `qaDescription` to action compiler.
- `tests/lib/test-case-action-runner.js` — action registry, default helper-backed handlers, and step result orchestration.
- `tests/run-test-case-mytv.spec.js` — generic Playwright entry spec for one selected case.
- `tests/unit/test-case-schema.test.js` — schema/action validation tests.
- `tests/unit/test-case-source.test.js` — local loader and lookup tests.
- `tests/unit/test-case-compiler.test.js` — supported Vietnamese description compilation tests.
- `tests/unit/test-case-action-runner.test.js` — action dispatch, ordering, parameter, and failure-result tests.

### Modify

- `app/main.js` — replace fixed mode/AI branching with local case loading and generic spec execution; remove AI planner and connection handlers.
- `app/preload.js` — expose local case loading and the generic run call; remove AI connection IPC.
- `app/renderer/index.html` — replace mode-specific form and AI settings with case list/details and app/preview controls.
- `app/renderer/renderer.js` — load/select cases, mask action credentials, and run the selected case.
- `app/renderer/styles.css` — style case list, case details, selected state, and action preview.
- `tests/lib/index.js` — expose existing workflow readiness helpers to the action registry.
- `tests/lib/workflows.js` — remove the obsolete `AI_PLAN_PATH` option.
- `tests/lib/mytv-helpers.legacy.js` — remove the obsolete `AI_PLAN_PATH` option from the retained legacy helper copy.
- `package.json` — add the built-in unit-test script.
- `README.md` — document local case-driven Electron usage and legacy terminal specs; remove AI instructions.
- `AGENTS.md` — update the architecture, entry points, environment variables, and AI references.

### Delete

- `tests/lib/ai-plan-runner.js` — no longer needed after removing AI plan execution.
- `tests/run-ai-plan-mytv.spec.js` — no longer needed after removing the AI test mode.

## Task 1: Establish the pure test-case contract and unit-test command

**Files:**

- Create: `tests/unit/test-case-schema.test.js`
- Create: `tests/unit/test-case-source.test.js`
- Create: `tests/unit/test-case-compiler.test.js`
- Create: `tests/unit/test-case-action-runner.test.js`
- Modify: `package.json`

**Interfaces:**

- The tests define the interfaces implemented in Tasks 2–4:
  - `validateTestCaseList(value, sourceLabel) -> TestCase[]`
  - `validateTestCase(testCase, index) -> TestCase`
  - `validateAction(action, path) -> Action`
  - `loadLocalTestCases(filePath) -> Promise<TestCase[]>`
  - `findTestCaseById(testCases, id) -> TestCase`
  - `compileTestCase(testCase) -> TestCase`
  - `createActionRunner({handlers, stepRunner}) -> runTestCase`

- Add this script to `package.json`:

```json
"test:unit": "node --test tests/unit/*.test.js"
```

- [ ] **Step 1: Write the initial failing contract tests**

Use Node's built-in test API and CommonJS assertions. The first schema test must establish the expected normalized output and rejected action:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {validateTestCaseList, validateAction} = require("../lib/test-case-schema");

test("validates a server-shaped list and preserves explicit actions", () => {
  const cases = validateTestCaseList([
    {
      id: "12066",
      name: "Vào phim truyện",
      qaDescription: "B1. Vào dịch vụ phim truyện",
      actions: [{action: "open_service", service: "Phim truyện"}],
    },
  ], "fixture");

  assert.equal(cases[0].id, "12066");
  assert.deepEqual(cases[0].actions, [{action: "open_service", service: "Phim truyện"}]);
});

test("rejects an unknown action", () => {
  assert.throws(
    () => validateAction({action: "execute_javascript"}, "testCases[0].actions[0]"),
    /unsupported action.*execute_javascript/i,
  );
});
```

Add source, compiler, and runner tests in the same style so the required behavior is executable before implementation exists. Use temporary files only inside the operating-system temp directory for source-loader tests.

- [ ] **Step 2: Run the tests and verify they fail for missing modules**

Run:

```bash
rtk npm run test:unit
```

Expected: FAIL with module-not-found errors for `test-case-schema`, `test-case-source`, `test-case-compiler`, and `test-case-action-runner`.

- [ ] **Step 3: Add the test script and commit the test contract**

Apply the `package.json` script change, then run:

```bash
rtk npm run test:unit
```

Expected: the command runs and reports the intended missing-module failures. Commit:

```bash
rtk git add package.json tests/unit
rtk git commit -m "test: define server test case runner contract"
```

## Task 2: Implement schema validation and the local source adapter

**Files:**

- Create: `tests/lib/test-case-schema.js`
- Create: `tests/lib/test-case-source.js`
- Test: `tests/unit/test-case-schema.test.js`
- Test: `tests/unit/test-case-source.test.js`

**Interfaces:**

```js
// tests/lib/test-case-schema.js
function validateTestCaseList(value, sourceLabel = "test cases") {}
function validateTestCase(testCase, index = 0) {}
function validateAction(action, path = "action") {}
function normalizeTestCase(testCase) {}
module.exports = {validateTestCaseList, validateTestCase, validateAction, normalizeTestCase};

// tests/lib/test-case-source.js
async function loadLocalTestCases(filePath) {}
function findTestCaseById(testCases, id) {}
module.exports = {loadLocalTestCases, findTestCaseById};
```

- [ ] **Step 1: Expand failing tests for the exact contract**

Cover:

```js
test("requires id and name", () => {
  assert.throws(() => validateTestCaseList([{name: "missing id"}]), /id/i);
});

test("requires actions or qaDescription", () => {
  assert.throws(() => validateTestCaseList([{id: "1", name: "empty"}]), /actions|qaDescription/i);
});

test("normalizes numeric ids to strings and leaves optional server fields intact", () => {
  const [item] = validateTestCaseList([{id: 12066, name: "Case", actions: [{action: "open_home"}]}]);
  assert.equal(item.id, "12066");
  assert.equal(item.platform, undefined);
});

test("loads an array from a local JSON file and finds a case by id", async () => {
  const file = await writeTempJson([{id: "1", name: "Case", actions: [{action: "open_home"}]}]);
  const cases = await loadLocalTestCases(file);
  assert.equal(findTestCaseById(cases, "1").name, "Case");
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```bash
rtk node --test tests/unit/test-case-schema.test.js tests/unit/test-case-source.test.js
```

Expected: FAIL until the two modules exist.

- [ ] **Step 3: Implement validation without mutating caller data**

Use an allowlist for these actions:

```js
const ALLOWED_ACTIONS = new Set([
  "login",
  "open_home",
  "open_service",
  "assert_screen",
  "press_back",
  "wait_for_ready",
]);
```

Validate required fields:

- Case: `id`, `name`, and `actions` or `qaDescription`.
- `login`: non-empty string `username` and `password`.
- `open_service`: non-empty string `service`.
- `assert_screen`: non-empty string `text`.
- `press_back`: optional non-negative integer `count`.
- `wait_for_ready`: `name` in `app`, `home`, `content`, or `player`.
- `open_home`: no required parameters.

Return shallow-cloned cases and action objects so normalization cannot modify the parsed source object.

- [ ] **Step 4: Implement the read-only local adapter**

Read UTF-8, parse JSON, pass it through `validateTestCaseList`, and wrap errors with the file path:

```js
async function loadLocalTestCases(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return validateTestCaseList(JSON.parse(raw), filePath);
  } catch (error) {
    throw new Error(`Could not load test cases from ${filePath}: ${error.message}`);
  }
}
```

`findTestCaseById` must compare `String(testCase.id)` and throw an error listing the requested ID when no case exists. The adapter must never write to the fixture.

- [ ] **Step 5: Run focused and full unit tests**

Run:

```bash
rtk node --test tests/unit/test-case-schema.test.js tests/unit/test-case-source.test.js
rtk npm run test:unit
```

Expected: schema/source tests pass; compiler/runner tests still fail only because their implementation tasks are incomplete.

- [ ] **Step 6: Commit the source contract implementation**

```bash
rtk git add tests/lib/test-case-schema.js tests/lib/test-case-source.js tests/unit/test-case-schema.test.js tests/unit/test-case-source.test.js
rtk git commit -m "feat: validate and load local test cases"
```

## Task 3: Implement deterministic `qaDescription` compilation

**Files:**

- Create: `tests/lib/test-case-compiler.js`
- Test: `tests/unit/test-case-compiler.test.js`

**Interfaces:**

```js
function compileTestCase(testCase) {}
function compileQaDescription(qaDescription, context = {}) {}
module.exports = {compileTestCase, compileQaDescription};
```

`compileTestCase` returns a cloned test case with validated `actions`. If explicit actions exist, preserve them and do not parse the description. If actions are absent, compile the description and validate the resulting actions.

- [ ] **Step 1: Write the exact compiler tests**

```js
test("compiles login, home, and service Vietnamese steps", () => {
  const result = compileQaDescription(
    "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ app\nB3. Vào dịch vụ phim truyện",
  );

  assert.deepEqual(result, [
    {action: "login", username: "ts1", password: "111222"},
    {action: "open_home"},
    {action: "open_service", service: "Phim truyện"},
  ]);
});

test("does not parse a description when explicit actions are present", () => {
  const result = compileTestCase({
    id: "1",
    name: "Explicit",
    qaDescription: "B1. unsupported text",
    actions: [{action: "open_home"}],
  });

  assert.deepEqual(result.actions, [{action: "open_home"}]);
});

test("reports the original unsupported line and case id", () => {
  assert.throws(
    () => compileTestCase({id: "12066", name: "Unsupported", qaDescription: "B1. Xóa toàn bộ dữ liệu"}),
    /12066.*Xóa toàn bộ dữ liệu/i,
  );
});
```

- [ ] **Step 2: Run the compiler tests and verify failure**

```bash
rtk node --test tests/unit/test-case-compiler.test.js
```

Expected: FAIL because `test-case-compiler.js` does not exist.

- [ ] **Step 3: Implement only the supported patterns**

Normalize matching text with the existing `normalizeVietnameseText` helper, but preserve original service labels and credentials in emitted action values. Parse these forms:

```text
đăng nhập ... tài khoản <username>/<password>  -> login
vào trang chủ | vào home                       -> open_home
vào dịch vụ <service>                          -> open_service
quay lại | quay về | nhấn back                 -> press_back
chờ app | chờ home | chờ content | chờ player  -> wait_for_ready
```

Strip `B<number>.` prefixes and surrounding punctuation. A line that matches multiple patterns must throw an ambiguity error rather than choose a handler. A line that matches none must throw an unsupported-step error containing the case ID and original line.

- [ ] **Step 4: Run the compiler and full unit tests**

```bash
rtk node --test tests/unit/test-case-compiler.test.js
rtk npm run test:unit
```

Expected: compiler tests pass; action-runner tests remain the only planned failures.

- [ ] **Step 5: Commit the compiler**

```bash
rtk git add tests/lib/test-case-compiler.js tests/unit/test-case-compiler.test.js
rtk git commit -m "feat: compile supported test case descriptions"
```

## Task 4: Implement the action registry and generic runner

**Files:**

- Create: `tests/lib/test-case-action-runner.js`
- Test: `tests/unit/test-case-action-runner.test.js`

**Interfaces:**

```js
function createActionRunner({handlers, stepRunner}) {}
function createDefaultActionHandlers({helpers}) {}
async function runTestCase(page, testInfo, testCase, options = {}) {}
module.exports = {createActionRunner, createDefaultActionHandlers, runTestCase};
```

The injected handler signature is:

```js
async function handler({page, testInfo, action, testCase, options}) {}
```

The injected step runner signature is:

```js
async function stepRunner(page, testInfo, label, callback) {}
```

- [ ] **Step 1: Write dispatch and failure tests with fake handlers**

```js
test("dispatches actions in order and returns step results", async () => {
  const calls = [];
  const runner = createActionRunner({
    handlers: {
      open_home: async ({action}) => calls.push(action.action),
      open_service: async ({action}) => calls.push(action.service),
    },
    stepRunner: async (_page, _info, _label, callback) => callback(),
  });

  const result = await runner({}, {}, {
    id: "1",
    name: "Case",
    actions: [{action: "open_home"}, {action: "open_service", service: "Phim truyện"}],
  });

  assert.deepEqual(calls, ["open_home", "Phim truyện"]);
  assert.equal(result.status, "passed");
  assert.deepEqual(result.steps.map((step) => step.status), ["passed", "passed"]);
});

test("fails before execution when an action handler is missing", async () => {
  const runner = createActionRunner({handlers: {}, stepRunner: async () => {}});
  await assert.rejects(
    () => runner({}, {}, {id: "1", name: "Case", actions: [{action: "open_home"}]}),
    /no handler.*open_home/i,
  );
});
```

- [ ] **Step 2: Run the runner tests and verify failure**

```bash
rtk node --test tests/unit/test-case-action-runner.test.js
```

Expected: FAIL because the runner module does not exist.

- [ ] **Step 3: Implement the generic orchestrator**

The orchestrator must compile/validate the case before browser actions, attach the original case and normalized actions, execute in order, and return:

```js
{
  testCaseId: String(testCase.id),
  name: testCase.name,
  status: "passed" | "failed",
  source: options.source || "local",
  steps: [{index, action, status, durationMs, message}],
  expectedResult: testCase.expectedResult || "",
}
```

Use `Date.now()` around each handler. Let `runStep` preserve the existing failure artifacts; do not swallow handler errors. Attach the result JSON with `testInfo.attach` before rethrowing a failure.

- [ ] **Step 4: Implement default helper-backed handlers**

Build the helper map from `tests/lib/mytv-helpers.js`:

```js
const helpers = require("./mytv-helpers");
const workflows = require("./workflows");
```

Handler behavior:

```js
login: async ({page, testInfo, action, options}) => {
  const account = {
    ...options,
    USERNAME: action.username,
    PASSWORD: action.password,
  };
  await helpers.openAppAndEnterLoginPage(page, account, testInfo);
  await helpers.loginWithAccount(page, account, testInfo);
  await helpers.chooseFirstProfileAndEnterHome(page, testInfo);
  await helpers.closeHomePopupsAndVerifyHome(page, testInfo);
},
open_home: ({page, testInfo}) => workflows.__internal.waitForHomeReady(page, testInfo),
open_service: ({page, testInfo, action}) =>
  helpers.openServiceFromLeftMenuOrAllServices(page, action.service, testInfo),
press_back: async ({page, action}) => {
  const count = action.count || 1;
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press("Backspace");
  }
},
wait_for_ready: ({page, testInfo, action}) => resolveReadyWait(helpers, page, testInfo, action.name),
assert_screen: ({page, action}) => page.locator("body").toContainText(action.text),
```

Implement `resolveReadyWait` with the existing helper signatures:

```js
function resolveReadyWait(helpers, page, testInfo, name) {
  if (name === "app") return workflows.__internal.waitForAppReady(page, testInfo);
  if (name === "home") return workflows.__internal.waitForHomeReady(page, testInfo);
  if (name === "content") {
    return helpers.waitForContentVisible(page, {
      name: "action-content-ready",
      testInfo,
      getContentState: workflows.__internal.observeVisibleContentRows,
      getFocusedState: helpers.getFocusedState,
    });
  }
  if (name === "player") {
    return helpers.waitForPlayerReady(page, {
      name: "action-player-ready",
      testInfo,
      getVisiblePopup: helpers.__internal.getVisiblePopup,
      getPlayerState: helpers.getPlayerState,
    });
  }
  throw new Error(`Unsupported readiness target: ${name}`);
}
```

Add `...workflows.__internal` to the `__internal` export in `tests/lib/index.js` so the action registry can use the existing app/home readiness functions. Do not introduce fixed credential or service defaults into handlers.

- [ ] **Step 5: Run all unit tests**

```bash
rtk npm run test:unit
```

Expected: PASS for schema, source, compiler, and runner tests.

- [ ] **Step 6: Commit the action runtime**

```bash
rtk git add tests/lib/test-case-action-runner.js tests/unit/test-case-action-runner.test.js
rtk git commit -m "feat: execute validated test case actions"
```

## Task 5: Add the local fixture and generic Playwright entry point

**Files:**

- Create: `testcased.json`
- Create: `tests/run-test-case-mytv.spec.js`
- Modify: `tests/lib/workflows.js` only if the generic spec needs a public options helper; keep existing legacy option behavior intact.

**Interfaces:**

The generic spec consumes:

```text
TEST_CASE_PATH — absolute or project-relative path to testcased.json
TEST_CASE_ID   — selected case id
APP_URL        — target MyTV URL
```

- [ ] **Step 1: Add the two provided cases with explicit actions**

Create `testcased.json` as an array containing IDs `12066` and `12065`, preserving the user-provided metadata. Add these action lists:

```json
{
  "id": "12066",
  "actions": [
    {"action": "login", "username": "ts1", "password": "111222"},
    {"action": "open_home"},
    {"action": "open_service", "service": "Phim truyện"},
    {"action": "assert_screen", "text": "Phim truyện"}
  ]
}
```

```json
{
  "id": "12065",
  "actions": [
    {"action": "login", "username": "ts1", "password": "111222"},
    {"action": "open_home"},
    {"action": "assert_screen", "text": "Xem ngay"}
  ]
}
```

The fixture remains read-only. Do not add API cache fields to it.

- [ ] **Step 2: Write the generic Playwright spec**

Use the existing shared fixture:

```js
const path = require("node:path");
const {test} = require("./fixtures/mytv-session-fixture");
const {loadLocalTestCases, findTestCaseById} = require("./lib/test-case-source");
const {runTestCase} = require("./lib/test-case-action-runner");

test("run server-driven MyTV test case", async ({page, options}, testInfo) => {
  const fixturePath = process.env.TEST_CASE_PATH || path.resolve(__dirname, "../testcased.json");
  const cases = await loadLocalTestCases(fixturePath);
  const testCase = findTestCaseById(cases, process.env.TEST_CASE_ID);
  await runTestCase(page, testInfo, testCase, {source: "local", APP_URL: options.APP_URL});
});
```

The essential behavior is one generic spec, one selected ID, and no predefined mode branching.

- [ ] **Step 3: Validate the fixture without opening a browser**

Run:

```bash
rtk node -e "const {loadLocalTestCases}=require('./tests/lib/test-case-source'); loadLocalTestCases('./testcased.json').then(cases=>console.log(cases.map(item=>item.id).join(',')))"
```

Expected: `12066,12065`.

- [ ] **Step 4: Run the generic test in list mode**

```bash
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
```

Expected: one generic test is listed and no legacy mode spec is selected.

- [ ] **Step 5: Run the fixture against the staging app when credentials/network are available**

```bash
rtk TEST_CASE_PATH="$PWD/testcased.json" TEST_CASE_ID=12066 APP_URL="https://html5stage.mytv.vn/" npx playwright test tests/run-test-case-mytv.spec.js --project=chromium
```

Expected: the case executes `login`, `open_home`, `open_service`, and `assert_screen` in order and produces the normal Playwright report. If the staging app is unavailable, record the environment failure separately from unit-test results.

- [ ] **Step 6: Commit the local runnable slice**

```bash
rtk git add testcased.json tests/run-test-case-mytv.spec.js
rtk git commit -m "feat: run local server-shaped test cases"
```

## Task 6: Replace Electron main-process mode branching with generic case execution

**Files:**

- Modify: `app/main.js`
- Modify: `app/preload.js`

**Interfaces:**

Preload API:

```js
loadTestCases: () => ipcRenderer.invoke("load-test-cases"),
runTest: (values) => ipcRenderer.invoke("run-test", values),
```

Renderer-to-main run values:

```js
{
  APP_URL: string,
  TEST_CASE_ID: string,
  PREVIEW_TYPE: "none" | "live" | "interactive"
}
```

- [ ] **Step 1: Add a main-process loader handler**

Require the source adapter and expose only sanitized case data to the renderer. Keep passwords out of IPC responses:

```js
ipcMain.handle("load-test-cases", async () => {
  const fixturePath = path.join(app.getAppPath(), "testcased.json");
  const cases = await loadLocalTestCases(fixturePath);
  return {ok: true, source: "local", cases: cases.map(sanitizeCaseForUi)};
});
```

`sanitizeCaseForUi` must recursively clone actions and replace only `login.password` with `"••••••"`. It must not alter the in-memory case used by the runner.

- [ ] **Step 2: Replace `testModes` and AI branches in `run-test`**

Remove the `testModes` map, `PLAYBACK_MODE` lookup, AI plan generation, AI plan file writing, and mode-specific environment variables. Validate `TEST_CASE_ID` by loading the fixture and calling `findTestCaseById` before spawning Playwright.

Spawn only:

```js
const args = [
  playwrightCli,
  "test",
  "tests/run-test-case-mytv.spec.js",
  "--project=chromium",
  "--output",
  testResultsDir,
];
```

Pass only `TEST_CASE_PATH`, `TEST_CASE_ID`, `APP_URL`, preview variables, report path, and browser path to the child environment. Preserve the existing preview, interactive CDP, logging, stop, and report behavior.

- [ ] **Step 3: Remove the AI connection IPC and expose case loading**

Delete `ipcMain.handle("test-ai-connection", ...)` and the associated AI request functions from `app/main.js`. In `app/preload.js`, remove `testAiConnection` and add `loadTestCases`.

- [ ] **Step 4: Run static and unit verification**

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
```

Expected: all unit tests pass and both Node syntax checks exit successfully.

- [ ] **Step 5: Commit the main-process migration**

```bash
rtk git add app/main.js app/preload.js
rtk git commit -m "feat: run selected test cases from Electron"
```

## Task 7: Replace the Electron renderer with test-case selection

**Files:**

- Modify: `app/renderer/index.html`
- Modify: `app/renderer/renderer.js`
- Modify: `app/renderer/styles.css`

**Interfaces:**

DOM IDs required by the renderer:

```text
#test-case-list
#test-case-details
#selected-test-case-id
#app-url-input
#run-button
#stop-button
#form-message
#status-text
#log-output
```

- [ ] **Step 1: Replace the mode-specific markup**

Keep the existing preview, logs, stop, report, and GUI preview controls. Replace the old form fields with:

```html
<label>
  APP_URL
  <input id="app-url-input" name="APP_URL" value="https://html5stage.mytv.vn/" />
</label>
<section class="test-case-browser">
  <h2>Test cases</h2>
  <div id="test-case-list" role="listbox"></div>
  <article id="test-case-details"></article>
</section>
<input id="selected-test-case-id" name="TEST_CASE_ID" type="hidden" />
```

Remove the username/password fields, channel/movie/search fields, manual AI textarea, and API-key settings panel. Retain the GUI preview settings panel.

- [ ] **Step 2: Write renderer functions around the IPC contract**

Implement these functions in `renderer.js`:

```js
async function loadCases() {}
function renderCaseList(cases) {}
function selectCase(testCaseId) {}
function renderCaseDetails(testCase) {}
function maskActionForDisplay(action) {}
function validateRunValues(values) {}
```

`loadCases` calls `window.mytvRunner.loadTestCases()`, handles `{ok:false}`, and renders the returned sanitized cases. `renderCaseDetails` displays `name`, `id`, `platform`, `environment`, `preCondition`, `qaDescription`, `expectedResult`, and action names. `maskActionForDisplay` must leave `username` visible but replace a password with `"••••••"`.

The submit handler sends:

```js
await window.mytvRunner.runTest({
  APP_URL: appUrlInput.value.trim(),
  TEST_CASE_ID: selectedTestCaseId.value,
  PREVIEW_TYPE: activePreviewType,
});
```

- [ ] **Step 3: Add UI tests that do not need Electron**

Extract the pure display helpers into a small module only if needed for testing; otherwise test the DOM behavior with a lightweight document fixture. Cover selecting a case, masking passwords, and refusing to run without a selected ID.

Run:

```bash
rtk npm run test:unit
rtk node --check app/renderer/renderer.js
```

Expected: all tests pass and renderer syntax check succeeds.

- [ ] **Step 4: Add case-browser styles**

Add styles for `.test-case-browser`, `.test-case-list`, `.test-case-card`, `.test-case-card.selected`, `.test-case-details`, `.action-preview`, and responsive overflow. Preserve the existing preview layout and modal styles.

- [ ] **Step 5: Manually verify the renderer through Electron**

Run:

```bash
rtk npm run app:dev
```

Expected: the app opens with the two local cases, selecting either case updates details, no AI controls are visible, and clicking Run starts the generic test process.

- [ ] **Step 6: Commit the case-browser UI**

```bash
rtk git add app/renderer/index.html app/renderer/renderer.js app/renderer/styles.css
rtk git commit -m "feat: add Electron test case browser"
```

## Task 8: Remove the AI product feature and update documentation

**Files:**

- Modify: `app/main.js` — remove remaining AI planner helpers, endpoint/model defaults, and scope-error handling.
- Modify: `app/renderer/index.html` — remove any remaining AI settings markup.
- Modify: `app/renderer/renderer.js` — remove AI settings storage, provider options, model selection, and connection calls.
- Modify: `tests/lib/workflows.js` — remove the obsolete `AI_PLAN_PATH` option.
- Modify: `tests/lib/mytv-helpers.legacy.js` — remove the obsolete `AI_PLAN_PATH` option.
- Modify: `README.md` — document the local case browser and legacy terminal specs.
- Modify: `AGENTS.md` — update architecture and file references.
- Delete: `tests/lib/ai-plan-runner.js`
- Delete: `tests/run-ai-plan-mytv.spec.js`

- [ ] **Step 1: Prove no product-facing AI references remain**

Run:

```bash
rtk rg -n "AI_API_KEY|AI_PROVIDER|AI_MODEL|AI_ENDPOINT|AI_TEST_DESCRIPTION|test-ai-connection|createAiPlan|runAiPlan|ai-manual|ai-plan" app tests README.md package.json
```

Expected before edits: matches identify the remaining removal sites. After edits, only historical design documentation may mention AI; runtime app, active specs, README, and helper option parsers must have no matches.

- [ ] **Step 2: Remove the AI implementation and files**

Delete the AI planner functions from `app/main.js`, remove its imports/branches, delete the AI runner/spec, and remove all AI settings event handlers and local-storage keys from `renderer.js`.

- [ ] **Step 3: Rewrite the user-facing README sections**

Document:

```text
1. Put server-shaped cases in testcased.json for local development.
2. Start npm run app:dev.
3. Select a case and run it.
4. Use the terminal legacy specs for helper regression coverage.
5. Explicit actions are preferred; supported qaDescription patterns are fallback only.
```

Remove the old mode-selection instructions, environment-variable examples for channel/movie/search execution, and all AI-key/planner instructions from the Electron workflow. Retain legacy terminal commands in a clearly labeled regression section.

- [ ] **Step 4: Update AGENTS.md**

Update the architecture and file-reference sections to describe:

- `testcased.json` as the local fixture.
- `tests/lib/test-case-schema.js`, `test-case-source.js`, `test-case-compiler.js`, and `test-case-action-runner.js`.
- `tests/run-test-case-mytv.spec.js` as the generic entry point.
- `app/main.js` generic `TEST_CASE_ID` execution.
- The absence of AI-key/manual-planning behavior.
- Literal credentials being accepted in cases and masked in UI/logs.

- [ ] **Step 5: Run cleanup verification**

```bash
rtk npm run test:unit
rtk node --check app/main.js
rtk node --check app/preload.js
rtk node --check app/renderer/renderer.js
rtk rg -n "AI_API_KEY|AI_PROVIDER|AI_MODEL|AI_ENDPOINT|AI_TEST_DESCRIPTION|test-ai-connection|createAiPlan|runAiPlan|ai-manual|ai-plan" app tests README.md package.json
```

Expected: tests and syntax checks pass; the final search returns no runtime/product matches.

- [ ] **Step 6: Commit AI removal and documentation**

```bash
rtk git add app README.md AGENTS.md tests package.json
rtk git commit -m "remove: retire AI test planning feature"
```

## Task 9: Full verification and handoff

**Files:**

- Verify: all files from Tasks 1–8.
- Modify: none unless a verification failure requires a focused correction.

- [ ] **Step 1: Run the complete unit suite**

```bash
rtk npm run test:unit
```

Expected: all test-case schema, source, compiler, action-runner, and renderer-pure tests pass.

- [ ] **Step 2: Run existing regression tests that do not require external app access**

```bash
rtk npx playwright test tests/selector-contracts.spec.js tests/locator-contracts.spec.js tests/readiness-pacing.spec.js tests/smart-waits.spec.js --project=chromium
```

Expected: existing helper/contract tests pass. Do not interpret an external MyTV network failure as a local runner failure.

- [ ] **Step 3: Verify generic test discovery**

```bash
rtk npx playwright test tests/run-test-case-mytv.spec.js --list
```

Expected: one generic server-driven test is listed.

- [ ] **Step 4: Run the Electron smoke test**

```bash
rtk npm run app:dev
```

Verify manually:

- Two local cases appear.
- The selected case details and masked password render correctly.
- Run starts the generic spec using the selected ID.
- Logs, preview, stop, and report behavior remain functional.
- No AI settings or manual AI mode exist.

- [ ] **Step 5: Check the working tree and summarize evidence**

```bash
rtk git diff --check
rtk git status --short
rtk git log -5 --oneline
```

Expected: no whitespace errors; only intentional implementation commits are present; no generated reports, credentials, or runtime cache files are staged.

## Follow-up plan boundary: API retrieval and runtime cache

Do not mix API work into this local-runner implementation. After the acceptance criteria pass, create a separate plan for:

- `ApiTestCaseSource` and response authentication.
- Validation of the server list and optional `actions` field.
- Atomic writes to `<userData>/testcases-cache.json`.
- API refresh IPC and cached/offline source indicators.
- Cache schema versioning and migration.
- Tests for failed refresh preserving the previous valid cache.
