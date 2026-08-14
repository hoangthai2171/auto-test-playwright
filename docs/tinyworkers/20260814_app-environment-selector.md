# Browser App Environment Selector

**Plan ID:** 20260814_app-environment-selector
**Status:** Completed
**Approval:** Approved
**Created:** 2026-08-14 10:02 +07:00
**Updated:** 2026-08-14 11:34 +07:00
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** Medium
**Branch/worktree:** `feature/app-environment` — `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Add the status-bar environment selector and persisted setting — Completed
- [x] Step 2: Carry the validated environment through the Browser launch boundary — Completed
- [x] Step 3: Apply the selected app mode before generic Browser actions — Completed
- [x] Step 4: Add regression coverage, documentation, and final verification — Completed

## Planning deliverables

- Standalone GUI preview: [`20260814_app-environment-selector-preview.html`](./20260814_app-environment-selector-preview.html)
- Production implementation is complete under the approved plan; the
  standalone preview remains available for comparison.

## Goal

### Problem

The Electron workspace always launches the source-controlled MyTV URL in its
normal ONLINE behavior. Testers need to choose ONLINE, PILOT, or STAGE before a
Browser test starts. The supplied screenshot identifies the intended UI
location: the blank red-marked area in the top workspace status bar between
`Ready` and the run controls.

### Desired outcome

The workspace exposes one compact, accessible radio group in that status-bar
area. ONLINE is selected by default. A Browser run snapshots the selected mode,
loads the fixed app URL, applies the requested trusted mode bootstrap, waits for
the reloaded app to become ready, and only then begins the selected case's first
action.

### Acceptance criteria

- [ ] The top workspace status bar contains an accessible radio group labelled
      `App environment` with exactly `ONLINE`, `PILOT`, and `STAGE`; a new or
      invalid persisted setting resolves to `ONLINE`.
- [ ] The selected option is visibly retained in the workspace, persisted with
      the existing renderer settings, and disabled while a run is active so a
      running batch cannot change modes halfway through.
- [ ] Browser single-case, Browser batch, and the legacy single-case fallback
      all send the selected environment through their existing run boundary;
      the main process revalidates it and snapshots one canonical value for
      every child in a batch.
- [ ] ONLINE leaves the current Browser launch behavior unchanged.
- [ ] PILOT runs the trusted page-context bootstrap after the app URL is loaded:
      `gServerAAALink.setDomainAuthenUpdate("https://aaapilot1.mytv.vn/authen-ctl-v3", "https://aaapilot2.mytv.vn/authen-ctl-v3")`,
      `gServerAAALink.setDevMode(APP_MODE.UPDATE)`, then
      `window.location = 'index.html'`.
- [ ] STAGE runs the trusted page-context bootstrap after the app URL is
      loaded: `gServerAAALink.setDevMode(APP_MODE.ONLINE56)`, then
      `window.location = 'index.html'`.
- [ ] The runner waits for the post-bootstrap document/app-ready state before
      dispatching any case action. Missing globals, failed evaluation, or failed
      reloads fail the case before app interaction with a clear, non-secret
      diagnostic; no server-provided JavaScript or selector is evaluated.
- [ ] LG runs leave the existing installed-app flow unchanged. The selector is
      disabled or clearly marked Browser-only for LG, and no browser mode script
      is sent to the LG/Appium path.
- [ ] Existing APP_URL ownership, API `ENVIRONMENT` setting, case selection,
      preview behavior, report paths, and logout cleanup remain unchanged.

### Non-goals

- Do not change the source-controlled `APP_URL` or add an editable URL field.
- Do not change the API `ENVIRONMENT` selector (`API`/`UI`); this feature is the
  MyTV web-app runtime mode, not the Flow-case API environment.
- Do not add PILOT/STAGE support to the installed LG webOS app path; the
  requested globals and reload are Browser-page behavior.
- Do not accept arbitrary code, URLs, mode names, selectors, or module paths
  from the renderer or downloaded test cases.
- Do not change legacy terminal workflow defaults; an omitted environment keeps
  the existing ONLINE behavior.
- Do not add a confirmation dialog, deployment operation, or environment health
  probe beyond the requested mode setup and readiness wait.
- Remove the empty `.browser-preview-toolbar` and its unused renderer mute
  toggle as an approved UI cleanup. Interactive BrowserView audio remains muted
  by the existing main-process default; no new audio control is added.

## Current State and Findings

- The supplied screenshot shows the target insertion point in the empty middle
  of the `.status-bar`, between `#status-text` and `.workspace-actions`;
  `app/renderer/index.html` currently renders only the status dot/text and run
  action buttons there.
- `app/renderer/index.html` already owns the Browser/LG target controls in the
  left sidebar; the new control should therefore be a sibling of the status
  text in the workspace header, not a Settings-panel field.
- `app/renderer/renderer.js:DEFAULT_SETTINGS`, `loadSettings()`,
  `currentSettings()`, `runBrowserBatch()`, `runSingleCase()`, and
  `handleSubmit()` define the current renderer setting/payload flow. The
  existing `mytv-auto-test-settings` localStorage record already strips old
  restricted APP_URL/DNS values, so the new canonical setting can be added
  without a new persistence mechanism.
- `app/test-configuration.js` is the dependency-free shared contract used by
  the renderer, Electron main process, and Playwright fixture. It already owns
  allowlists, defaults, and fail-closed normalizers for Browser settings.
- `app/main.js` handlers `run-test` and `run-browser-batch` own the actual child
  process environment. They currently pass the fixed `APP_URL` and Browser
  settings into each generic case; renderer values are not authoritative at
  this boundary.
- `tests/run-test-case-mytv.spec.js` passes `APP_URL` into `runTestCase()`.
  The generic action runner dispatches actions in order, while
  `tests/lib/workflows.js:openAppAndEnterLoginPage()` performs the initial
  `gotoApp()` before login interaction. This is the correct execution boundary
  for a pre-action Browser bootstrap, provided the runner owns the initial load
  and the login workflow does not navigate a second time.
- `tests/fixtures/mytv-session-fixture.js` supports both managed Chromium and
  the Interactive CDP page. The same page-context bootstrap can be used for
  both because it runs through the Playwright `page` abstraction after the
  target page is connected.
- `app/renderer/index.html` currently contains an empty
  `.browser-preview-toolbar` wrapper around the hidden `#browser-mute-button`.
  It only creates a blank 42px Browser preview row; the approved implementation
  removes that wrapper/control while preserving the existing default muted
  Interactive BrowserView behavior.
- Baseline worktree: clean on `feature/app-environment`; Git emitted only the
  existing local fsmonitor IPC warning while checking status.
- Baseline: `npm run test:unit` — 693 passed, 0 failed.
- Baseline: `node --check app/main.js`, `node --check app/preload.js`, and
  `node --check app/renderer/renderer.js` — passed.
- Baseline: `npx playwright test tests/run-test-case-mytv.spec.js --list` — one
  generic test listed.
- Baseline: `git diff --check` — passed.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Selector placement | Settings modal; left Run target card; top status-bar gap | Add a compact fieldset between `#status-text` and `.workspace-actions` | Matches the supplied red-circle location and keeps a per-run execution choice visible | Status-bar controls need their own renderer references because they sit outside `#test-form` |
| Setting name and transport | Reuse API `ENVIRONMENT`; use `APP_MODE`; add a generic `ENV` key | Renderer setting `APP_ENVIRONMENT` with canonical values `online`, `pilot`, `stage`; child variable `MYTV_APP_ENVIRONMENT` | Avoids collision with the existing API `ENVIRONMENT` and makes the execution boundary explicit | Main and generic runner each need one additional validated field |
| Default and persistence | Always reset to ONLINE; add a new settings store; persist alongside existing GUI settings | Add the setting to `mytv-auto-test-settings`, sanitize through the shared normalizer, default invalid/missing values to ONLINE | Preserves user preference without adding storage/API surface; fail-closed default is safe | Existing users see ONLINE once, then their choice is retained |
| Execution ownership | Let renderer run `eval`; let main execute browser code; test runner applies trusted code in the page | Main validates/snapshots the enum; the trusted Playwright runner performs the fixed page-context bootstrap | Keeps IPC narrow and places `window`, `gServerAAALink`, and `APP_MODE` access where those globals exist | The child receives a mode enum, never a code string |
| Pre-action timing | Inject only inside the login handler; hook every arbitrary action; pre-run bootstrap before the action loop | Generic runner performs an explicit pre-run app load/mode bootstrap, then the login workflow skips its duplicate initial navigation | Guarantees no case action runs before the selected mode is ready, including cases whose first action is not login | `runTestCase()` and `openAppAndEnterLoginPage()` need a small coordination flag |
| Browser versus LG | Apply mode to every target; silently ignore mode for LG; disable/annotate for LG | Browser-only behavior; keep the selection visible but disabled with Browser-only guidance when LG is selected | The requested console API is unavailable on the installed TV app path, and silent ignoring would be misleading | LG payload/runner behavior remains unchanged |
| Mode failure policy | Continue in ONLINE; retry with guessed globals; fail after action starts | Fail before the first action with a clear diagnostic | Prevents an accidental production run when PILOT/STAGE setup was requested but not applied | Live staging verification remains environment-dependent |
| Empty Browser preview toolbar | Keep the blank wrapper and hidden mute toggle; move the toggle elsewhere; remove both | Remove the unused wrapper/control and retain main-owned default muting | Matches the approved preview and removes a blank 42px layout row without changing the requested test behavior | Interactive preview no longer exposes a renderer mute button |

## Assumptions, Constraints, and Dependencies

- Assumption: the red circle in the supplied screenshot is the intended
  placement, and the selector is a Browser workspace choice rather than an API
  configuration choice.
- Assumption: `gServerAAALink` and `APP_MODE` are available after the current
  app URL reaches its DOM-loaded state; the implementation will still verify
  both in page context and fail closed if they are absent.
- Constraint: the exact two PILOT auth URLs and the exact `APP_MODE` constants in
  the request are trusted source code, not renderer input.
- Constraint: all selected cases in one Browser batch use the same mode snapshot;
  a later radio change applies only to a later run.
- Constraint: existing virtual-keyboard and remote-control interaction remains
  unchanged after the bootstrap.
- Dependency: the Browser runner must be configured with managed Chromium as it
  is today; this feature does not install or select a different browser.
- Dependency: live PILOT/STAGE verification requires access to the target app
  and a valid test account; it is not part of the local unit baseline.
- Unresolved material questions: None after the supplied screenshot.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| Renderer sends an invalid or stale mode | Child may run with an unintended environment | Shared renderer normalization plus main-process normalization and a fixed ONLINE fallback | Remove the setting from localStorage or revert only the focused setting/payload changes; current ONLINE behavior remains the fallback |
| PILOT/STAGE globals are unavailable or their reload timing changes | Test could interact with the wrong environment or fail during setup | Verify globals before invoking the fixed script; await `domcontentloaded` and app readiness after `index.html` reload; fail before action dispatch | Select ONLINE for a normal run, or revert the bootstrap helper while keeping the UI/payload code isolated |
| Mode changes while a batch is active | Different cases in one batch could target different environments | Snapshot mode in `run-browser-batch`, disable the status-bar inputs during the run, and assert every child gets the same env value | Stop the batch and start a new batch after selecting the intended mode |
| LG path receives Browser-only mode logic | Installed TV run could be blocked or receive unsupported calls | Gate the control and payload on Browser target; leave LG IPC/runner contracts unchanged | Revert the target-gating change; no TV state is changed by this feature |
| A second navigation resets the selected mode | Browser returns to ONLINE before login | Pre-run bootstrap owns the initial navigation; login workflow accepts a prepared-page flag and skips its duplicate `gotoApp()` | Re-run with ONLINE and inspect the pre-action navigation test; revert the runner coordination only |
| Test reports/logs expose implementation details or credentials | Sensitive information could enter user-facing output | Log only the enum label and fixed lifecycle text; reuse existing redaction; never log credentials or raw page code | Clear local reports and revert only new diagnostic lines; no secrets are introduced by the mode enum |

## File Impact and Detailed Changes

### `app/test-configuration.js`

**Action:** Modify
**Current role and evidence:** Shared Browser-safe constants and normalizers for
timeouts, resolution, and concurrency.
**Exact changes:** Add immutable `APP_ENVIRONMENT_OPTIONS`,
`DEFAULT_APP_ENVIRONMENT = "online"`, and `normalizeAppEnvironment(value,
fallback)`. Accept only `online`, `pilot`, or `stage` and fall back to a valid
fallback or ONLINE. Export the values through the existing CommonJS/global
contract.
**Invariants and compatibility:** Existing configuration values and terminal
`APP_URL` behavior remain unchanged.
**Tests affected:** Extend `tests/unit/test-configuration.test.js` with valid,
missing, invalid, and fallback cases.

### `app/renderer/index.html`

**Action:** Modify
**Current role and evidence:** Renders the workspace status bar and top-level
run controls.
**Exact changes:** Insert an accessible `fieldset`/`legend` or equivalent
`radiogroup` between `#status-text` and `.workspace-actions` with three radio
inputs using one stable name, values `online`, `pilot`, and `stage`, and
`online` checked by default. Include a concise Browser-only status hook that
the renderer can show when LG is selected. Remove the empty
`.browser-preview-toolbar` wrapper and hidden renderer mute button from the
preview markup.
**Invariants and compatibility:** Preserve existing status IDs, action-button
IDs, tooltips, form submission wiring, the preview grid, Interactive
BrowserView, and main-process default muting. The group is not placed in the
Settings modal or the left case-selection form.
**Tests affected:** Update the renderer HTML contract assertions in
`tests/unit/renderer.test.js`.

### `app/renderer/styles.css`

**Action:** Modify
**Current role and evidence:** Owns `.status-bar`, workspace action layout,
dark theme, focus rings, and responsive sizing.
**Exact changes:** Add compact fieldset/legend, option, selected, disabled, and
focus-visible styles for the status-bar picker. Give the picker a bounded
flexible width and preserve the existing action group's right alignment. Remove
the `.browser-preview-toolbar` style and change `.browser-preview` to allocate
only the preview grid and fixed 240px log panel. At smaller widths, allow the
label/options to compress or wrap without moving the six preview holders or
fixed log panel.
**Invariants and compatibility:** Keep the current workspace grid, six 16:9
slot layout, fixed log panel, and maximized-window row-bound protections.
**Tests affected:** Extend CSS source-contract assertions if needed; manually
inspect the standalone preview at the supplied wide viewport and a narrower
supported viewport.

### `app/renderer/renderer.js`

**Action:** Modify
**Current role and evidence:** Owns renderer settings, localStorage, target
selection, run payloads, and run-state UI.
**Exact changes:**

- Add `APP_ENVIRONMENT` to `DEFAULT_SETTINGS`, `loadSettings()`,
  `currentSettings()`, and the existing settings serialization using the shared
  normalizer.
- Read the status-bar radio group and persist its canonical value on change or
  at run submission; never reuse the API `ENVIRONMENT` field.
- Include the value in Browser batch and legacy single-case payloads, while
  keeping LG calls unchanged.
- Disable the radio inputs during an active run and when LG is selected; show a
  short Browser-only status in the latter state.
- Keep the selected option visible after a run completes and ensure an invalid
  stored value is corrected to ONLINE.

**Invariants and compatibility:** The renderer remains a narrow IPC client. It
does not receive APP_URL, execute JavaScript in the MyTV page, or decide the
actual child environment.
**Tests affected:** Update renderer fixture elements and add persisted-setting,
payload, LG-gating, run-state, and HTML contract coverage in
`tests/unit/renderer.test.js`.

### `app/main.js`

**Action:** Modify
**Current role and evidence:** Owns `run-test`, `run-browser-batch`, child
environment construction, and safe run logging.
**Exact changes:** Import `normalizeAppEnvironment`. Normalize the renderer
value at both Browser run handlers, add the canonical
`MYTV_APP_ENVIRONMENT` child variable, include the mode in the frozen batch
settings snapshot, and log only the selected enum label in the initial run
diagnostic. Do not execute page code or accept a renderer-provided URL/script.

**Invariants and compatibility:** Keep source-controlled `APP_URL`, managed
Chromium, cache paths, report paths, concurrency, stop behavior, and all LG IPC
contracts unchanged. Invalid/missing values use ONLINE.
**Tests affected:** Add main-source contract assertions to
`tests/unit/renderer.test.js` or the nearest existing main/startup contract
suite; exercise the normalized value through the Browser batch launch tests if
the existing dependency-injection seam exposes it.

### `tests/lib/app-environment.js`

**Action:** Add
**Current role and evidence:** No dedicated module currently owns the trusted
Browser-page environment bootstrap.
**Exact changes:** Add a small trusted helper that accepts only the normalized
enum. ONLINE returns without changing the page. PILOT calls the exact requested
auth-domain and `APP_MODE.UPDATE` operations, then assigns `window.location` to
`index.html`. STAGE calls `APP_MODE.ONLINE56`, then assigns the same reload.
Await the navigation/readiness boundary and surface a stable setup error when
the globals or reload are unavailable. Keep the fixed code in source; do not
construct it from IPC strings or testcase data.
**Invariants and compatibility:** The helper uses Playwright page evaluation
only for this trusted, fixed operation; it does not replace remote-focus or
virtual-keyboard helpers.
**Tests affected:** Add `tests/unit/app-environment.test.js` for normalization
handoff, exact PILOT/STAGE script contracts, ONLINE no-op behavior, navigation
wait, and fail-closed errors.

### `tests/lib/workflows.js`

**Action:** Modify
**Current role and evidence:** `openAppAndEnterLoginPage()` calls `gotoApp()`
and waits for the ready app before login; its helpers are exported through
`tests/lib/index.js`.
**Exact changes:** Add an exported `prepareAppEnvironment(page, options,
testInfo)` that owns the initial `gotoApp`, invokes the new trusted helper, and
waits for the app-ready state after any mode reload. Add an explicit
`skipNavigation`/prepared-page option to `openAppAndEnterLoginPage()` so the
login workflow verifies readiness without navigating back to the production
entry point.
**Invariants and compatibility:** Existing direct callers without the prepared
flag continue to perform their current navigation. All post-bootstrap app
interaction remains the existing helper flow.
**Tests affected:** Cover the call order through the action-runner/environment
tests and keep existing workflow helper contracts unchanged.

### `tests/lib/test-case-action-runner.js`

**Action:** Modify
**Current role and evidence:** Validates/dispatches generic actions in order and
passes runner options to every handler.
**Exact changes:** When the Electron generic runner supplies
`APP_ENVIRONMENT`, call `prepareAppEnvironment()` once before the action loop,
mark the page as prepared in the internal execution options, and pass that flag
to the login handler. The login handler forwards the flag to
`openAppAndEnterLoginPage()` so it does not perform a second initial
navigation. If no environment option is supplied, preserve existing unit/test
callers and ONLINE-compatible behavior.
**Invariants and compatibility:** No action registry, schema, server-supplied
action, or cleanup behavior changes. Setup failure occurs before any action
handler is invoked.
**Tests affected:** Extend `tests/unit/test-case-action-runner.test.js` with
pre-action ordering, prepared-login, omitted-option compatibility, and setup
failure cases.

### `tests/run-test-case-mytv.spec.js`

**Action:** Modify
**Current role and evidence:** Generic Electron entry point loads the selected
case and passes `APP_URL`/timeout options to `runTestCase()`.
**Exact changes:** Read `MYTV_APP_ENVIRONMENT`, normalize it through the shared
contract, and pass `APP_ENVIRONMENT` to `runTestCase()`. Omitted terminal values
resolve to ONLINE.
**Invariants and compatibility:** Case source/cache selection, result sidecars,
timeouts, screenshots, and trusted logout cleanup remain unchanged.
**Tests affected:** Generic spec list check plus action-runner/environment unit
coverage; no live account run is required locally.

### `tests/unit/test-configuration.test.js`

**Action:** Modify
**Current role and evidence:** Covers shared timeout, resolution, and concurrency
normalizers.
**Exact changes:** Assert the three-value app-environment allowlist, ONLINE
default, accepted canonical values, invalid input fallback, and valid fallback
handling.
**Invariants and compatibility:** Existing configuration assertions remain
unchanged.
**Tests affected:** `npm run test:unit`.

### `tests/unit/renderer.test.js`

**Action:** Modify
**Current role and evidence:** Provides fake DOM/storage/runner fixtures and
source contracts for renderer settings, payloads, and workspace layout.
**Exact changes:** Add the three radio elements to the fixture, assert default
and persisted mode behavior, verify Browser payload propagation and LG
exclusion, verify disabled state during a run, assert the status-bar placement,
and assert the main-source child environment contract.
**Invariants and compatibility:** Keep existing restricted APP_URL/DNS and
credential-redaction assertions.
**Tests affected:** Renderer unit suite.

### `tests/unit/test-case-action-runner.test.js`

**Action:** Modify
**Current role and evidence:** Tests generic action dispatch and trusted helper
delegation with fake pages/helpers.
**Exact changes:** Add setup-order tests that prove no action handler runs
before the environment bootstrap, that the login helper skips duplicate
navigation for a prepared page, and that setup failure remains authoritative.

**Invariants and compatibility:** Existing handler behavior and action results
remain unchanged when the environment option is absent.
**Tests affected:** Generic runner unit suite.

### `tests/unit/app-environment.test.js`

**Action:** Add
**Current role and evidence:** No dedicated unit contract exists for the new
mode bootstrap.
**Exact changes:** Test ONLINE no-op; exact PILOT domain/mode/reload source;
exact STAGE mode/reload source; one navigation wait; normalization and clear
errors for missing page globals/evaluation failures.
**Invariants and compatibility:** Tests do not contact real MyTV, pilot, or
stage hosts and do not contain credentials.
**Tests affected:** Included by `npm run test:unit`.

### `docs/tinyworkers/20260814_app-environment-selector-preview.html`

**Action:** Add
**Current role and evidence:** No standalone preview for this request exists.
**Exact changes:** Provide a self-contained, dependency-free rendering of the
supplied workspace composition with the new radio group in the exact top-bar
location. The mockup should let the reviewer switch ONLINE/PILOT/STAGE and
show the selected value/Browser-only behavior without invoking any real app or
IPC.
**Invariants and compatibility:** This is a review artifact only; it is not
loaded by Electron and must not be treated as production UI code.
**Tests affected:** Open locally; run an HTML/JavaScript syntax or browser
smoke check if available.

## Execution Sequence

### Step 1 — Add the status-bar selector and shared setting contract

**Objective:** Render the three radio options in the supplied red-circle
location, add ONLINE defaults/persistence, and keep the control stable across
target/run state changes.
**Files:** `app/test-configuration.js`, `app/renderer/index.html`,
`app/renderer/styles.css`, `app/renderer/renderer.js`,
`tests/unit/test-configuration.test.js`, `tests/unit/renderer.test.js`
**Implementation details:** Use the existing settings store and shared
normalizer. Keep the group outside the case form but include it explicitly in
run-state synchronization. Disable it for active runs and LG.
**Dependencies:** The current status-bar DOM and renderer fixture conventions.

**Verification:** Targeted configuration/renderer unit tests plus a source
inspection; expected result: ONLINE is selected by default, invalid storage is
sanitized, and the radio group is present between status text and actions.
**Exit criteria:** The UI can produce one canonical `APP_ENVIRONMENT` value for
each Browser submission and never changes the existing API `ENVIRONMENT` field.

**Approval gate:** Required

### Step 2 — Carry one validated mode through Browser launch

**Objective:** Make the selected mode authoritative at the main-process child
boundary for both Browser start paths.
**Files:** `app/main.js`, `app/renderer/renderer.js`,
`tests/run-test-case-mytv.spec.js`, `tests/unit/renderer.test.js`
**Implementation details:** Normalize at the renderer for UI correctness and
again in main for execution safety. Snapshot the mode once per batch, expose it
to the child only as `MYTV_APP_ENVIRONMENT`, and keep LG IPC untouched.
**Dependencies:** Step 1's shared enum and payload field.
**Verification:** Unit/source contract tests; expected result: valid modes reach
the generic child, invalid/missing values become ONLINE, and every child in a
batch receives the same value.
**Exit criteria:** No renderer-supplied code or URL crosses the boundary.
**Approval gate:** Required

### Step 3 — Bootstrap the app page before actions

**Objective:** Apply PILOT/STAGE mode in the loaded Browser page and block case
actions until the resulting app is ready.
**Files:** `tests/lib/app-environment.js`, `tests/lib/workflows.js`,
`tests/lib/test-case-action-runner.js`, `tests/run-test-case-mytv.spec.js`,
`tests/unit/app-environment.test.js`, `tests/unit/test-case-action-runner.test.js`

**Implementation details:** The generic runner performs one initial `gotoApp`,
executes only the fixed trusted operation for the selected enum, awaits the
reload/readiness boundary, and marks the page prepared. The login workflow uses
that prepared-page marker to avoid a second navigation. ONLINE performs the
existing load/readiness path without mode mutation.
**Dependencies:** Step 2's validated child variable; current `waitForAppReady`
and `gotoApp` helpers.
**Verification:** Unit ordering/source-contract tests and a non-live Playwright
list check; expected result: no handler runs before bootstrap, and exact PILOT/
STAGE calls are present only in trusted source.
**Exit criteria:** A bootstrap failure stops the case before any action and
reports no secret data.
**Approval gate:** Required

### Step 4 — Regression verification and handoff

**Objective:** Verify the complete local contract, update project documentation,
and hand the plan back for approval or execution.
**Files:** `README.md`, `AGENTS.md` only if the final implementation changes
project behavior documentation; all files above as needed for tests/docs.
**Implementation details:** Document the new selector, exact mode semantics,
Browser-only scope, environment variable, and fallback. Update Graphify after
source changes.
**Dependencies:** Steps 1–3 complete.
**Verification:** `npm run test:unit`; syntax checks; generic Playwright list;
`git diff --check`; `graphify update .`; manual preview and, when credentials/
hosts are available, one controlled Browser smoke per mode.
**Exit criteria:** All local checks pass with any live-environment limitations
recorded separately; no unrelated diff remains.
**Approval gate:** Required

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Status-bar radio group is in the requested location and defaults ONLINE | Unit/manual | `node --test tests/unit/renderer.test.js`; open the standalone preview | HTML/source and rendered layout show the group between status text and run controls; ONLINE is checked |
| Invalid persisted values fail closed | Unit | `node --test tests/unit/test-configuration.test.js tests/unit/renderer.test.js` | Missing, malformed, and unsupported values resolve to `online` |
| Browser payload/main boundary carries one enum | Unit/static | Renderer payload tests; inspect `app/main.js`; run relevant unit contracts | Batch/single payload includes the selected enum; main child env is `MYTV_APP_ENVIRONMENT`; no code string is accepted |
| ONLINE is unchanged | Unit/manual | Runner tests with `online` and existing Browser flow contracts | No page mode evaluate/reload is requested beyond the existing app load/readiness |
| PILOT exact bootstrap | Unit/static/live when available | `node --test tests/unit/app-environment.test.js`; optional controlled Browser smoke | Exact two auth URLs, `APP_MODE.UPDATE`, and `index.html` reload occur before the first action |
| STAGE exact bootstrap | Unit/static/live when available | Same as PILOT with `stage` | `APP_MODE.ONLINE56` and `index.html` reload occur before the first action; no auth-domain mutation |
| Setup failures block actions | Unit/negative | `node --test tests/unit/app-environment.test.js tests/unit/test-case-action-runner.test.js` | Action handler call list is empty when bootstrap/evaluation/readiness fails |
| LG remains unchanged | Unit/static/manual | Renderer target tests; inspect LG run payload and run a non-live readiness check | Control is disabled/annotated for LG; no `MYTV_APP_ENVIRONMENT` use in LG path |
| Existing regression suite remains green | Regression/static | `npm run test:unit`; syntax checks; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check`; `graphify update .` | No new failures; only environment-dependent live checks remain separately documented |

## Completed Verification

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Worktree baseline | `git -c core.fsmonitor=false status --short --branch` | Pass | Clean `feature/app-environment` worktree; existing fsmonitor warning only | 2026-08-14 10:02 +07:00 |
| Unit baseline | `npm run test:unit` | Pass | 693 passed, 0 failed | 2026-08-14 10:02 +07:00 |
| Syntax baseline | `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js` | Pass | All three commands exited 0 | 2026-08-14 10:02 +07:00 |
| Generic spec listing baseline | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | One test listed | 2026-08-14 10:02 +07:00 |
| Whitespace baseline | `git diff --check` | Pass | Command exited 0 | 2026-08-14 10:02 +07:00 |
| Preview inline-script syntax | Node `new Function()` check against the standalone HTML script | Pass | Exactly one inline script parsed successfully | 2026-08-14 10:08 +07:00 |
| Preview browser smoke | Elevated local Playwright Chromium check at 1919×927 | Pass | ONLINE/PILOT/STAGE switching, LG disablement, case selection, run-state transition, and screenshot all succeeded; final status was `Running · STAGE` | 2026-08-14 10:09 +07:00 |
| Step 1 shared configuration and renderer UI | renderer syntax check and focused configuration/renderer unit tests | Pass | 118 passed, 0 failed; selector persistence, Browser payload enum, LG disablement, and toolbar removal contracts pass | 2026-08-14 10:16 +07:00 |
| Step 2 Browser launch boundary | main/spec syntax checks and `node --test tests/unit/preload.test.js tests/unit/renderer.test.js` | Pass | 122 passed, 0 failed; both Browser payload paths and child environment contract are covered | 2026-08-14 10:18 +07:00 |
| Step 3 trusted page bootstrap | `node --test tests/unit/app-environment.test.js tests/unit/test-case-action-runner.test.js` plus syntax checks | Pass | 58 passed, 0 failed; exact PILOT/STAGE scripts, ONLINE no-op, ordering, and failure blocking are covered | 2026-08-14 10:21 +07:00 |
| Full unit regression | npm run test:unit | Pass | 702 passed, 0 failed | 2026-08-14 10:32 +07:00 |
| Final syntax checks | node --check for main, preload, renderer, environment helper, workflows, action runner, and generic spec | Pass | All commands exited 0 | 2026-08-14 10:33 +07:00 |
| Generic spec listing | npx playwright test tests/run-test-case-mytv.spec.js --list | Pass | One generic test listed | 2026-08-14 10:33 +07:00 |
| Final whitespace check | git -c core.fsmonitor=false diff --check plus trailing-whitespace scan of new files | Pass | No whitespace errors | 2026-08-14 10:33 +07:00 |
| Production workspace UI smoke | Elevated local Chromium at 1600x900 against app/renderer/index.html | Pass | One app-environment picker, zero browser-preview-toolbar elements, and screenshot visually reviewed | 2026-08-14 10:35 +07:00 |
| Startup regression follow-up | Electron smoke with cached startup cases and six-slot readiness assertion | Pass | The first usable workspace appeared in 484 ms with 6 slots and 102 cases; saved GUI settings restore was deferred until after the initial paint so synchronous localStorage startup work no longer blocks the first frame | 2026-08-14 11:34 +07:00 |
| Graphify refresh | `graphify update .` | Pass | AST refresh completed; graphify rebuilt 3,117 nodes, 4,804 edges, and 184 communities | 2026-08-14 11:35 +07:00 |

## Deviations and Plan Updates

- 2026-08-14: Initial placement assumption was the left Run target card. The
  supplied screenshot corrected the target to the empty top status-bar region;
  the plan and preview use the screenshot-confirmed placement. No production
  implementation was started before this correction.
- 2026-08-14: User approved removing the empty `.browser-preview-toolbar`
  wrapper and its unused renderer mute button from the production workspace.
  The implementation keeps the existing main-process default muting for
  Interactive BrowserView and does not add a replacement audio control.
- 2026-08-14: Follow-up startup regression analysis found that the first
  synchronous `localStorage.getItem()` during renderer construction could
  block Electron's first usable frame for several seconds. The renderer now
  creates the six slots and restores the cached/local test cases first,
  signals the main process only after that bootstrap, and restores persisted
  GUI settings on the first animation frame afterward. A guarded startup
  fallback still reveals the window if the renderer cannot signal readiness.

## Handoff and Completion

- Changed files in this implementation: the approved plan, standalone HTML
  preview, renderer UI, shared configuration, Browser launch boundary, trusted
  app-environment helper, tests, README, and AGENTS.md.
- Checks passed: full unit regression, syntax/listing checks, whitespace checks,
  and production UI smoke listed above.
- Known limitations: PILOT/STAGE live verification requires the target app,
  network access, and valid test credentials; it was intentionally not claimed.
- Follow-up work: optional controlled live verification for ONLINE, PILOT, and
  STAGE when the target environment and credentials are available.
- Final acceptance status: Implementation complete under the user's approved
  plan on 2026-08-14. No commit or push was requested.
