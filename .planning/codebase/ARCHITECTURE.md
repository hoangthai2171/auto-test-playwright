<!-- refreshed: 2026-07-13 -->
# Architecture

**Analysis Date:** 2026-07-13

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Execution interfaces                      │
├──────────────────┬──────────────────┬───────────────────────┤
│ Electron desktop │ Interactive CLI  │ Playwright CLI         │
│ `app/renderer/`  │ `scripts/`       │ `package.json`         │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ IPC              │ child process      │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Electron orchestration / Playwright configuration            │
│ `app/main.js` · `playwright.config.js`                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Shared test session, scenario specs, and plan runner         │
│ `tests/fixtures/` · `tests/*.spec.js` · `tests/lib/`         │
└──────────────────────────┬──────────────────────────────────┘
                           │ keyboard + DOM inspection
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ MyTV HTML5 application / browser / report and preview output │
│ external app · Playwright report · Electron user-data        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Electron main process | Creates the desktop window, exposes IPC handlers, builds test environment, starts/kills Playwright, manages preview and BrowserView state. | `app/main.js` |
| Secure IPC bridge | Exposes the explicit `window.mytvRunner` command/event surface to unprivileged renderer code. | `app/preload.js` |
| Desktop renderer | Collects run settings, persists AI settings in `localStorage`, invokes bridge methods, and renders logs/status/preview. | `app/renderer/renderer.js` |
| Playwright configuration | Defines single-worker Chromium execution, timeouts, reports, and scaled desktop viewport defaults. | `playwright.config.js` |
| Shared worker fixture | Supplies a worker-scoped context/options fixture and a page fixture that supports normal, live-preview, and CDP interactive sessions. | `tests/fixtures/mytv-session-fixture.js` |
| Scenario specs | Express login, channel, movie, search, settings, and AI-plan workflows as named test steps. | `tests/*.spec.js` |
| TV automation library | Implements remote-key navigation, fuzzy Vietnamese matching, row discovery, playback assertions, and failure artifacts. | `tests/lib/mytv-helpers.js` |
| AI plan executor | Loads and validates persisted plans, then maps allowed actions to helper calls. | `tests/lib/ai-plan-runner.js` |
| Terminal launchers | Prompt for variables or launch Electron/install local Chromium. | `scripts/run-headed.js`, `scripts/run-electron-app.js`, `scripts/install-playwright-browsers.js` |

## Pattern Overview

**Overall:** layered test-automation application with three adapters (Playwright CLI, guided terminal, and Electron desktop) converging on the same ordered Playwright specs and shared helper library.

**Key Characteristics:**
- Keep scenario files declarative: each `tests/*.spec.js` composes exported helpers inside `runStep()` rather than querying the page directly.
- Drive the target TV UI through keyboard focus and `Enter`; helper logic derives targets from focused state, visible geometry, IDs, and normalized Vietnamese labels in `tests/lib/mytv-helpers.js`.
- Preserve login/session ordering by running `workers: 1` in `playwright.config.js` and passing login plus one selected scenario to Playwright from `app/main.js` or `scripts/run-headed.js`.
- Treat Electron renderer as a presentation layer only: it reaches Node/Electron capabilities exclusively through the context-isolated bridge in `app/preload.js`.
- Persist ephemeral run artifacts outside the bundle under Electron `userData`; packaged browser binaries are resolved separately by `app/main.js`.

## Layers

**Execution interfaces:**
- Purpose: accept test choices from CLI commands, an interactive terminal, or desktop controls.
- Location: `package.json`, `scripts/`, `app/renderer/`.
- Contains: npm scripts, readline prompts, HTML/CSS UI, browser-side form validation, and local UI settings.
- Depends on: Playwright CLI or the `window.mytvRunner` preload contract.
- Used by: a developer or desktop user.

**Desktop process boundary:**
- Purpose: safely broker renderer intent to privileged filesystem, process, network, and Electron APIs.
- Location: `app/main.js` and `app/preload.js`.
- Contains: `ipcMain.handle` commands, event forwarding, child-process lifecycle, report opening, AI planning, BrowserView lifecycle, and `contextBridge` methods.
- Depends on: Electron, Node APIs, and the installed Playwright CLI.
- Used by: `app/renderer/renderer.js`.

**Test orchestration:**
- Purpose: configure an ordered, reusable browser session and select the correct test flow.
- Location: `playwright.config.js`, `tests/fixtures/mytv-session-fixture.js`, `tests/*.spec.js`.
- Contains: project configuration, worker fixtures, test names, and high-level scenario sequencing.
- Depends on: Playwright and `tests/lib/`.
- Used by: `playwright test` spawned by `app/main.js`, `scripts/run-headed.js`, or the direct npm command.

**Domain automation:**
- Purpose: encapsulate MyTV-specific navigation and assertions resilient to dynamic TV UI markup.
- Location: `tests/lib/mytv-helpers.js` and `tests/lib/ai-plan-runner.js`.
- Contains: environment option parsing, virtual-keyboard entry, remote focus movement, DOM/geometry collectors, fuzzy scoring, player health checks, and report attachments.
- Depends on: Playwright `page`, `expect`, `testInfo`, and plan files supplied by the runner.
- Used by: every functional spec and the AI-plan executor.

**Artifacts and preview transport:**
- Purpose: make Playwright evidence accessible to the desktop UI and reports.
- Location: `tests/fixtures/mytv-session-fixture.js`, `app/main.js`, plus runtime `userData` directories.
- Contains: periodic screenshot capture with temporary-file rename, polling/file-to-base64 conversion, Playwright attachments, result directories, and HTML report paths.
- Depends on: filesystem, Electron IPC, and Playwright screenshots.
- Used by: the renderer preview/log/report controls in `app/renderer/renderer.js`.

## Data Flow

### Desktop Test Request Path

1. The form collects mode, target, credentials, preview, and AI settings; renderer validates mode-specific fields and invokes `window.mytvRunner.runTest(values)` (`app/renderer/renderer.js:85`).
2. The preload maps that call to `ipcRenderer.invoke("run-test")` (`app/preload.js:4`), with no direct renderer Node access.
3. The main process chooses the ordered spec pair, optionally creates and writes an AI plan in `userData`, builds run environment variables, then spawns the Playwright CLI (`app/main.js:67`).
4. Playwright config creates a single Chromium worker and the shared fixture creates/reuses its browser context (`playwright.config.js:10`, `tests/fixtures/mytv-session-fixture.js:14`).
5. `tests/login-mytv.spec.js` establishes the authenticated home state; the selected scenario calls `tests/lib/mytv-helpers.js` to navigate with remote keys and assert outcomes.
6. Stdout/stderr and completion events flow from `app/main.js` to the renderer as `test-log` and `test-finished` IPC events (`app/main.js:152`, `app/preload.js:15`, `app/renderer/renderer.js:147`).

### AI Plan Flow

1. AI-mode form input arrives as `AI_TEST_DESCRIPTION` at the `run-test` handler (`app/main.js:79`).
2. `createAiPlan()` chooses the local parser when no API key exists, otherwise dispatches to an OpenAI-compatible or Gemini request (`app/main.js:381`).
3. `validateAiPlan()` normalizes and restricts steps to `open_service` and `play_all_items_in_first_row`, then main writes the JSON path to the child environment (`app/main.js:623`, `app/main.js:94`).
4. `tests/run-ai-plan-mytv.spec.js` loads the file and delegates each validated action to `runAiPlan()` (`tests/run-ai-plan-mytv.spec.js:4`, `tests/lib/ai-plan-runner.js:17`).
5. The executor invokes the same service navigation and row playback helpers used by ordinary specs (`tests/lib/ai-plan-runner.js:24`).

### Live and Interactive Preview Flow

1. For live preview, main passes `MYTV_PREVIEW_PATH` to Playwright and polls that runtime PNG path (`app/main.js:102`, `app/main.js:358`).
2. The page fixture captures a screenshot every second, writes a temporary file, and renames it atomically (`tests/fixtures/mytv-session-fixture.js:69`).
3. Main emits a base64 image data URL on `browser-preview`; preload forwards it and the renderer updates its image element (`app/main.js:368`, `app/preload.js:16`, `app/renderer/renderer.js:151`).
4. For interactive preview, Electron creates a `BrowserView`, exposes its DevTools port, and the fixture connects to that page through CDP before applying device metrics (`app/main.js:194`, `tests/fixtures/mytv-session-fixture.js:17`).

**State Management:**
- The Electron main process keeps mutable singleton state for the window, active child process, preview timer, BrowserView, scale, and mute state in `app/main.js:30`.
- Renderer-only persisted settings are stored in browser `localStorage` by `app/renderer/renderer.js:273`; form/status/preview state remains module-local DOM state.
- Test run options are derived from process environment once per Playwright worker by `getTestOptions()` and the `options` fixture (`tests/lib/mytv-helpers.js:21`, `tests/fixtures/mytv-session-fixture.js:44`).
- Browser context is worker-scoped; scenario state follows the same page/context after login (`tests/fixtures/mytv-session-fixture.js:15`).

## Key Abstractions

**Shared MyTV session fixture:**
- Purpose: expose `{ page, options }` to specs while choosing an ordinary context or a CDP-connected interactive page.
- Examples: `tests/fixtures/mytv-session-fixture.js`, `tests/login-mytv.spec.js`.
- Pattern: Playwright `base.test.extend()` with worker-scoped context/options fixtures and a page fixture.

**Remote navigation helpers:**
- Purpose: express target-TV operations without mouse interactions and tolerate unstable markup.
- Examples: `remoteFocusById()`, `remoteFocusByText()`, `remoteFocus()` in `tests/lib/mytv-helpers.js`; service functions at `tests/lib/mytv-helpers.js:143`.
- Pattern: page-side geometry inspection plus iterative `Arrow*`, `Enter`, and back-key presses; use `.focused` state as the navigation invariant.

**Content-row model:**
- Purpose: turn visible DOM cards and nearby headings into `{ rowY, title, normalizedTitle, items }` records before row matching/playback.
- Examples: `collectVisibleContentRows()` and `focusRequestedContentRow()` in `tests/lib/mytv-helpers.js:1635` and `tests/lib/mytv-helpers.js:1759`.
- Pattern: evaluate visible candidate geometry, bucket items by vertical tolerance, associate headings, then score normalized token matches.

**Failure-artifact boundary:**
- Purpose: ensure each business step produces useful evidence on errors and playback failures.
- Examples: `runStep()` and `assertPlayback()` in `tests/lib/mytv-helpers.js:488` and `tests/lib/mytv-helpers.js:547`.
- Pattern: wrap workflow actions in `test.step`; attach screenshots, player state, popup text, candidate data, and HTML reports through `testInfo`.

**AI plan contract:**
- Purpose: constrain free-form Vietnamese input to a small executable JSON action set.
- Examples: `createAiPlan()`/`validateAiPlan()` in `app/main.js` and `validatePlan()` in `tests/lib/ai-plan-runner.js`.
- Pattern: normalize before persistence and independently validate again before execution.

## Entry Points

**Playwright CLI:**
- Location: `package.json` (`npm test`) and `playwright.config.js`.
- Triggers: direct terminal test execution.
- Responsibilities: discovers `tests/`, creates Chromium project/session, and emits line plus HTML reports.

**Guided headed runner:**
- Location: `scripts/run-headed.js`.
- Triggers: `npm run test:headed`.
- Responsibilities: prompts for run values, picks login + scenario specs, and spawns headed Playwright.

**Electron desktop runner:**
- Location: `scripts/run-electron-app.js` and `app/main.js`.
- Triggers: `npm run app:dev`, packaged Electron app, or Electron's `main` field in `package.json`.
- Responsibilities: launches Electron with a usable Node binary in development, creates the desktop UI, and orchestrates Playwright test processes.

**Test specs:**
- Location: `tests/login-mytv.spec.js`, `tests/play-channel-mytv.spec.js`, `tests/play-movie-mytv.spec.js`, `tests/search-content-mytv.spec.js`, `tests/open-setting-mytv.spec.js`, and `tests/run-ai-plan-mytv.spec.js`.
- Triggers: selected explicitly by the desktop/terminal mode maps or discovered by Playwright CLI.
- Responsibilities: arrange named high-level steps; feature specs assume the preceding selected login spec established the application session.

## Architectural Constraints

- **Threading:** Electron main and renderer run as separate event-loop processes; Playwright is spawned as a child process. Playwright must use one worker (`playwright.config.js:13`) because feature specs rely on ordered shared session state.
- **Global state:** `mainWindow`, `runningProcess`, `previewWatcher`, `interactiveView`, scale, and mute state are module-level variables in `app/main.js:30`; do not introduce concurrent runs without redesigning this ownership.
- **Renderer privilege boundary:** Preserve `contextIsolation: true` and `nodeIntegration: false` in `app/main.js:44`; add renderer capabilities through the narrow bridge in `app/preload.js`.
- **Remote-only UI control:** Target app actions must use `page.keyboard` navigation and helpers from `tests/lib/mytv-helpers.js`; do not add mouse-click flows for MyTV controls.
- **Viewport model:** Automation reasons about a 1920×1080 logical TV viewport while ordinary windows/BrowserViews display scaled dimensions (`playwright.config.js:3`, `tests/fixtures/mytv-session-fixture.js:7`).
- **Circular imports:** Not detected among application and test CommonJS modules.

## Anti-Patterns

### Bypassing Shared Automation Helpers

**What happens:** A spec directly creates selectors, clicks, or writes its own focus loop instead of composing `tests/lib/mytv-helpers.js`.
**Why it's wrong:** It bypasses Vietnamese normalization, visible-geometry filtering, remote-key semantics, and automatic evidence attachment that make this TV app testable.
**Do this instead:** Add a domain helper to `tests/lib/mytv-helpers.js`, export it at `tests/lib/mytv-helpers.js:2797`, and call it within `runStep()` from the scenario spec.

### Running a Dependent Feature Spec Alone

**What happens:** A caller runs a feature spec without the login spec or raises worker parallelism.
**Why it's wrong:** Feature flows expect the authenticated home state established by `tests/login-mytv.spec.js`; separate sessions or parallel workers invalidate that assumption.
**Do this instead:** Extend the appropriate mode map in both `app/main.js:12` and `scripts/run-headed.js:13` with login first, and retain `workers: 1` in `playwright.config.js`.

### Giving the Renderer Node Access

**What happens:** Desktop UI code attempts filesystem/process access rather than using the preload API.
**Why it's wrong:** It breaks the explicit process boundary and weakens Electron isolation.
**Do this instead:** Add an `ipcMain.handle`/event in `app/main.js` and a narrowly named bridge method in `app/preload.js`, then consume it from `app/renderer/renderer.js`.

## Error Handling

**Strategy:** Fail test assertions with contextual artifacts; return structured `{ ok, message }` values for renderer-invoked commands; log child-process output continuously and complete runs through IPC events.

**Patterns:**
- Wrap scenario actions with `runStep()` so thrown errors cause screenshot and state attachments before rethrowing (`tests/lib/mytv-helpers.js:547`).
- Validate AI plans at generation and execution boundaries (`app/main.js:623`, `tests/lib/ai-plan-runner.js:51`).
- Treat preview capture/polling as best effort so an unavailable image does not fail a test (`tests/fixtures/mytv-session-fixture.js:91`, `app/main.js:369`).
- Use `catch(() => false)` only for optional/dynamic UI observations, while required state relies on Playwright `expect` or explicit errors (`tests/lib/mytv-helpers.js:51`).

## Cross-Cutting Concerns

**Logging:** Child stdout/stderr is forwarded as `test-log` events and displayed in the renderer (`app/main.js:152`, `app/renderer/renderer.js:147`).

**Validation:** Renderer validates numeric/mode-specific inputs; main validates and normalizes AI plans; test helpers assert UI/player state (`app/renderer/renderer.js:188`, `app/main.js:623`, `tests/lib/mytv-helpers.js:488`).

**Authentication:** Login is automated through TV virtual-keyboard helpers in `tests/login-mytv.spec.js` and `tests/lib/mytv-helpers.js:81`; API-key use is confined to main-process AI calls in `app/main.js:394`.

---

*Architecture analysis: 2026-07-13*
