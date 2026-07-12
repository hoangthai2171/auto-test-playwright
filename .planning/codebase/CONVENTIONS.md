# Coding Conventions

**Analysis Date:** 2026-07-13

## Naming Patterns

**Files:**
- Use lowercase kebab-case for Playwright specifications: `tests/login-mytv.spec.js`, `tests/play-channel-mytv.spec.js`, and `tests/ai-row-selection.spec.js`.
- Use lowercase kebab-case for reusable test libraries and fixtures: `tests/lib/mytv-helpers.js`, `tests/lib/ai-plan-runner.js`, and `tests/fixtures/mytv-session-fixture.js`.
- Use concise lowercase names for runnable scripts: `scripts/run-headed.js` and `scripts/install-playwright-browsers.js`.
- Use conventional Electron entry names: `app/main.js`, `app/preload.js`, and `app/renderer/renderer.js`.

**Functions:**
- Use camelCase verbs that state the UI action or result, such as `openMovieFromLeftMenu`, `findChannelIdByName`, `attachFailureArtifacts`, and `validatePlan` in `tests/lib/mytv-helpers.js` and `tests/lib/ai-plan-runner.js`.
- Name async UI helpers as `async function` declarations and pass Playwright objects explicitly (`page`, `testInfo`, `options`), as in `runStep(page, testInfo, title, action)` in `tests/lib/mytv-helpers.js:547`.
- Use `is...`, `has...`, `get...`, `find...`, and `collect...` prefixes for predicates, DOM state, lookup, and collection helpers respectively.

**Variables:**
- Use camelCase for local values (`targetRow`, `safeTitle`, `interactiveCdpUrl`) and `const` by default; use `let` only for reassignment, such as `lastError` in `tests/lib/mytv-helpers.js:659`.
- Use UPPER_SNAKE_CASE for module constants (`DEFAULT_OPTIONS`, `CLOSE_POPUP_TEXT`, `VIEWPORT`, `INTERACTIVE_BROWSER_DEBUG_PORT`).
- Preserve environment-variable keys in UPPER_SNAKE_CASE when reading `process.env`, as in `getTestOptions()` in `tests/lib/mytv-helpers.js:21`.

**Types:**
- JavaScript/CommonJS is used throughout; no TypeScript types or JSDoc type declarations are present.
- Represent structured transient state with object literals, for example playback result objects in `tests/lib/mytv-helpers.js:233` and AI-plan steps in `tests/lib/ai-plan-runner.js:23`.

## Code Style

**Formatting:**
- No Prettier, Biome, or EditorConfig configuration is detected. No formatter script is declared in `package.json`.
- The repository uses double quotes and semicolons in JavaScript.
- Match the local file indentation rather than reformatting unrelated code: test specs and `tests/lib/mytv-helpers.js` use two spaces, while `app/main.js`, `scripts/run-headed.js`, and `tests/fixtures/mytv-session-fixture.js` use four spaces.
- Keep multiline calls and object literals trailing-comma friendly, following `tests/login-mytv.spec.js` and `playwright.config.js`.

**Linting:**
- No ESLint/Biome configuration or lint command is detected in `package.json`.
- Use optional chaining and nullish-safe fallbacks for unstable DOM data (`error?.message || String(error)`, `img?.currentSrc`) as established in `tests/lib/mytv-helpers.js`.

## Import Organization

**Order:**
1. Import the required framework/runtime modules with `require(...)`.
2. Import Node built-ins using the `node:` prefix where applicable, such as `node:fs/promises` and `node:path`.
3. Import local fixture and helper modules using relative paths.

`tests/lib/ai-plan-runner.js` follows Node built-ins before local helpers; Electron entry files use the same module-level CommonJS pattern. `tests/lib/mytv-helpers.js` imports Playwright first because it owns test helpers. Follow the nearest file's established grouping.

**Path Aliases:**
- No path aliases are configured. Use relative paths such as `./fixtures/mytv-session-fixture` and `../lib/mytv-helpers`.

## Error Handling

**Patterns:**
- Throw `new Error(...)` for invalid required configuration and unsupported states, with an actionable message, as in `tests/lib/ai-plan-runner.js:8` and `tests/play-channel-mytv.spec.js:19`.
- Wrap test actions in `runStep()` so failed operations attach a screenshot and focused-element/error context before rethrowing (`tests/lib/mytv-helpers.js:547`). Use this wrapper for meaningful integration-test steps.
- Treat explicitly non-critical work as best effort with a narrow catch, such as preview capture in `tests/fixtures/mytv-session-fixture.js:83`; do not swallow failures for assertions or navigation.
- Retry bounded transient operations with a final throw, as `gotoApp()` does with three attempts in `tests/lib/mytv-helpers.js:658`.
- Return simple sentinel values only where absence is expected (`false`, `""`, or `null`); assert required values immediately after lookup, as in `openServiceFromLeftMenuOrAllServices()`.

## Logging

**Framework:** Electron IPC plus `console` for CLI failures.

**Patterns:**
- Send test process output to the Electron renderer through main-process IPC handlers in `app/main.js`; expose only narrow renderer methods through `app/preload.js`.
- Attach diagnostics to Playwright reports instead of logging DOM state: screenshots, text, and JSON use `testInfo.attach()` in `tests/lib/mytv-helpers.js:488` and `tests/lib/ai-plan-runner.js:18`.
- Use `console.error(error)` only at a process boundary, as in `scripts/run-headed.js:345`.

## Comments

**When to Comment:**
- Comment non-obvious platform behavior, DOM workarounds, and intentional failure suppression. Examples include best-effort preview streaming in `tests/fixtures/mytv-session-fixture.js:92` and focus containment behavior in `tests/lib/mytv-helpers.js:2647`.
- Do not add comments that restate direct helper names or simple control flow.

**JSDoc/TSDoc:**
- Not used. Keep APIs discoverable through precise function names and colocated implementations.

## Function Design

**Size:**
- Keep specs thin orchestration layers; `tests/login-mytv.spec.js` delegates each user-visible step to a helper.
- Extract repeated Playwright navigation, lookup, normalization, and artifact behavior into `tests/lib/mytv-helpers.js`. Complex DOM algorithms may be large but should retain narrow helper names and explicit inputs.

**Parameters:**
- Pass `page` first for browser helpers, then `testInfo` when report artifacts are required, then an `options` object for optional behavior. See `playAllItemsInFirstRow(page, testInfo, options = {})` in `tests/lib/mytv-helpers.js:197`.
- Use destructured objects for related named settings (`assertPlayback(page, testInfo, { label, artifactPrefix })`).

**Return Values:**
- Return meaningful booleans for expected alternatives (`searchAndOpenBestContent()` returns whether a result was found) and throw for invalid or failed required actions.
- Await assertions instead of returning assertion promises from async helpers.

## Module Design

**Exports:**
- Use one CommonJS `module.exports = { ... }` object at the end of a reusable module, as in `tests/lib/ai-plan-runner.js:70` and `tests/lib/mytv-helpers.js:2797`.
- Keep test-only seams in a nested `__internal` export; `tests/ai-row-selection.spec.js` uses this for deterministic helper tests.
- Keep Electron renderer access behind the constrained `contextBridge.exposeInMainWorld("mytvRunner", ...)` API in `app/preload.js:3`.

**Barrel Files:**
- Not used. Import directly from the fixture or library file that owns the behavior.

---

*Convention analysis: 2026-07-13*
