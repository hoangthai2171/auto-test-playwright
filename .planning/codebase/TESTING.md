# Testing Patterns

**Analysis Date:** 2026-07-13

## Test Framework

**Runner:**
- Playwright `^1.61.1` is the test runner and browser automation library (`package.json:21`).
- Config: `playwright.config.js`; it sets `testDir: "./tests"`, a 240-second test timeout, one worker, Chromium, HTML/line reporters, failure screenshots, and first-retry traces.

**Assertion Library:**
- Playwright `expect`, imported from `playwright/test` directly in `tests/ai-row-selection.spec.js` or re-exported by `tests/fixtures/mytv-session-fixture.js`.

**Run Commands:**
```bash
npm test                 # Run the configured Playwright suite
npm run test:headed      # Run the interactive terminal selector, then headed Playwright
npx playwright test --ui # Playwright UI/watch-style runner; not wrapped by package.json
npx playwright test --reporter=html # Produce/view HTML report; no coverage command exists
```

## Test File Organization

**Location:**
- Place specs directly in `tests/` with the `*.spec.js` suffix.
- Put shared fixture setup in `tests/fixtures/mytv-session-fixture.js`.
- Put reusable navigation, assertions, report artifacts, and plan execution in `tests/lib/`.

**Naming:**
- Name end-to-end scenarios with the subject and `-mytv`, for example `tests/play-movie-mytv.spec.js` and `tests/search-content-mytv.spec.js`.
- Name focused helper tests by behavior, as in `tests/ai-row-selection.spec.js`.

**Structure:**
```
tests/
├── fixtures/mytv-session-fixture.js  # Extended Playwright test fixture
├── lib/mytv-helpers.js               # Navigation/assertion/artifact helpers
├── lib/ai-plan-runner.js             # AI plan validation and execution
├── login-mytv.spec.js                # Authentication flow
├── play-*-mytv.spec.js               # Live TV application workflows
└── ai-row-selection.spec.js          # Deterministic DOM helper tests
```

## Test Structure

**Suite Organization:**
```javascript
const { test } = require("./fixtures/mytv-session-fixture");
const { runStep, openMovieFromLeftMenu, assertMoviePlayback } = require("./lib/mytv-helpers");

test("play-movie-mytv", async ({ page, options }, testInfo) => {
  await runStep(page, testInfo, "Open left menu and choose Phim truyen", async () => {
    await openMovieFromLeftMenu(page);
  });
  // Continue with helper-driven remote navigation and assertion.
});
```
This is the pattern used in `tests/play-movie-mytv.spec.js`.

**Patterns:**
- Import the extended fixture for live MyTV specs so `page` and worker-scoped `options` are available. Do not import raw `playwright/test` for a test that needs the shared authenticated context.
- Use one top-level `test(...)` per user workflow; no `describe`, `beforeEach`, or `afterEach` suites are used.
- Wrap each visible workflow action in `runStep()` so reports show named substeps and failures gain artifacts.
- Drive the TV UI through keyboard-focused helpers (`remotePress`, `remoteFocusById`, `enterWithVirtualKeyboard`) in `tests/lib/mytv-helpers.js`; do not add mouse-click navigation to application tests.
- Assert actual outcomes through Playwright locators, polling, and helper assertions, e.g. `expect.poll(...)` in `tests/lib/mytv-helpers.js:109` and player-state assertions in `tests/lib/mytv-helpers.js:540`.

## Mocking

**Framework:**
- No Jest/Vitest mocking framework, `page.route`, or API mocking pattern is detected.

**Patterns:**
```javascript
test("chooseDirection moves up from wide spacebar to an overlapping letter key", () => {
  const direction = __internal.chooseDirection(fromRect, toRect);
  expect(direction).toBe("ArrowUp");
});
```
`tests/ai-row-selection.spec.js` uses `page.setContent(...)` to create deterministic in-page DOM fixtures for focus-navigation helpers; it is not network mocking.

**What to Mock:**
- For pure DOM/focus algorithms, construct the minimum rendered HTML and keyboard event behavior with `page.setContent(...)`, following `tests/ai-row-selection.spec.js:4`.
- Expose narrowly scoped internal helper functions through `__internal` only when deterministic testing cannot exercise them through a public workflow.

**What NOT to Mock:**
- Do not mock the TV remote interaction in live workflow specs. Exercise arrow keys, Enter, Backspace, focus state, and actual playback through the shared browser session.
- Do not replace `runStep()` or diagnostic attachment helpers; reports depend on their artifacts.

## Fixtures and Factories

**Test Data:**
```javascript
await __internal.focusFirstRowStart(page, {
  id: "row2-item1",
  rect: { x: 220, y: 420, width: 140, height: 120 },
});
```
Use inline object fixtures for DOM geometry and IDs, as in `tests/ai-row-selection.spec.js:57`. Runtime test options are assembled from environment variables by `getTestOptions()` in `tests/lib/mytv-helpers.js:21`; do not commit credentials or secret values into specs.

**Location:**
- No dedicated fixture-data or factory directory exists. Keep browser/session fixtures in `tests/fixtures/` and focused inline DOM data next to the helper test that uses it.

## Coverage

**Requirements:** No code-coverage threshold, instrumentation, or coverage script is configured in `package.json` or `playwright.config.js`.

**View Coverage:**
```bash
# Not configured. Use the HTML test report rather than coverage output.
npx playwright show-report
```

## Test Types

**Unit Tests:**
- `tests/ai-row-selection.spec.js` tests focus-direction calculation and DOM-query helpers with synthetic browser markup. It asserts exact IDs, classes, popup text, and directions.

**Integration Tests:**
- `tests/login-mytv.spec.js`, `tests/play-channel-mytv.spec.js`, `tests/play-movie-mytv.spec.js`, `tests/search-content-mytv.spec.js`, `tests/open-setting-mytv.spec.js`, and `tests/run-ai-plan-mytv.spec.js` drive the configured MyTV web application.
- The worker-scoped `sharedContext` in `tests/fixtures/mytv-session-fixture.js:14` shares one context. `workers: 1` in `playwright.config.js:13` is required; login-oriented modes explicitly run `tests/login-mytv.spec.js` before the dependent scenario.

**E2E Tests:**
- Playwright Chromium browser tests serve as E2E coverage. Electron has no separate end-to-end test harness; it launches Playwright through IPC in `app/main.js`.

## Common Patterns

**Async Testing:**
```javascript
await expect.poll(() => getSubpage(page.url()), { timeout: 30000 }).toBe("homeNewUI");
await page.waitForFunction(() => document.querySelector(".focused"));
```
Use Playwright waits/polls for asynchronous application state, as in `tests/lib/mytv-helpers.js:104`. Avoid arbitrary waits except the deliberate remote-navigation and playback stabilization delays encapsulated by helpers.

**Error Testing:**
```javascript
await runStep(page, testInfo, "Named action", async () => {
  await action();
});
```
`runStep()` in `tests/lib/mytv-helpers.js:547` captures a screenshot and JSON focused/error context, then rethrows. For playback failures, `assertPlayback()` additionally attaches popup text, a screenshot, and player state (`tests/lib/mytv-helpers.js:488`). Use these helpers instead of manually catching an expected workflow failure.

---

*Testing analysis: 2026-07-13*
