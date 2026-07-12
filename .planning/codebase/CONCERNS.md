# Codebase Concerns

**Analysis Date:** 2026-07-13

## Tech Debt

**Monolithic TV-application helper:**
- Issue: `tests/lib/mytv-helpers.js` combines configuration, navigation, DOM discovery, fuzzy matching, popup handling, playback inspection, report rendering, and artifact capture in one 2,825-line module. Text normalization and DOM-candidate filtering are duplicated inside multiple `page.evaluate()` callbacks.
- Files: `tests/lib/mytv-helpers.js`
- Impact: A small selector or timing change can affect unrelated login, search, movie, channel, and AI flows; fixes are difficult to unit test in isolation and duplicate matching rules can diverge.
- Fix approach: Split the module into focused navigation, locator/normalization, content-row, playback, and artifact modules. Export one shared normalization/scoring implementation and add unit tests for each extracted pure helper.

**Heuristic selectors coupled to an unversioned external UI:**
- Issue: Remote navigation depends on `.focused`, hard-coded IDs, text labels, geometry thresholds, and DOM-wide scans such as `Array.from(document.querySelectorAll("[id]"))` and `Array.from(document.querySelectorAll("body *"))`.
- Files: `tests/lib/mytv-helpers.js:1241`, `tests/lib/mytv-helpers.js:1320`, `tests/lib/mytv-helpers.js:1759`, `tests/lib/mytv-helpers.js:2284`, `tests/lib/mytv-helpers.js:2554`
- Impact: A target-app layout, localization, focus, or markup change can silently select the wrong content or produce flaky failures rather than a clear contract failure.
- Fix approach: Centralize selector contracts, retain DOM snapshots on locator failures, prefer stable target-app automation attributes where available, and validate the selected candidate title/ID immediately before activating it.

**Duplicated AI-plan validation:**
- Issue: Plan validation exists separately in `app/main.js` and `tests/lib/ai-plan-runner.js`, but the executor only verifies action names and `open_service.serviceName`; numeric timing and playback fields are not normalized when loading a saved plan.
- Files: `app/main.js:623`, `tests/lib/ai-plan-runner.js:51`
- Impact: Plans generated in the desktop process and plans supplied through `AI_PLAN_PATH` follow different validation rules; malformed values can cause long waits or unexpected behavior during execution.
- Fix approach: Move a strict schema plus normalization into a shared module used by both processes, bound every numeric field, and reject unknown fields/actions before persisting or running a plan.

**Fixed waits dominate flow control:**
- Issue: Navigation and playback use many unconditional waits, including 2.5–10 second sleeps and per-key 250 ms delays.
- Files: `tests/lib/mytv-helpers.js:197`, `tests/lib/mytv-helpers.js:489`, `tests/lib/mytv-helpers.js:710`, `tests/lib/mytv-helpers.js:2118`, `tests/lib/mytv-helpers.js:2488`
- Impact: Runs are slow on healthy environments and still flaky on slow ones because readiness is not consistently tied to observable application state.
- Fix approach: Replace sleeps with bounded waits for focus, page-state, player, or network/UI-ready signals; retain only measured settle delays behind named configuration constants.

## Known Bugs

**Default `npm test` suite includes tests that lack required inputs:**
- Symptoms: The listed suite includes `run-ai-plan-mytv.spec.js`, whose `loadAiPlan()` rejects an empty `AI_PLAN_PATH`; it also includes `search-content-mytv.spec.js`, whose helper requires a non-empty `SEARCH_KEYWORD`.
- Files: `package.json:13`, `tests/run-ai-plan-mytv.spec.js:4`, `tests/lib/ai-plan-runner.js:8`, `tests/search-content-mytv.spec.js:15`, `tests/lib/mytv-helpers.js:336`
- Trigger: Run `npm test` with the repository defaults. `npm test -- --list` shows both specs in the default suite, while `DEFAULT_OPTIONS` supplies empty values for their inputs.
- Workaround: Run explicit compatible spec lists with the required environment variables, as the Electron runner does in `app/main.js:108`.

**Tests rely on cross-file session ordering:**
- Symptoms: Playback, search, and settings specs assume the login spec has already authenticated the worker context, but no `globalSetup`, project dependency, or explicit runtime assertion establishes that prerequisite.
- Files: `playwright.config.js:13`, `tests/fixtures/mytv-session-fixture.js:14`, `tests/login-mytv.spec.js:10`, `tests/play-channel-mytv.spec.js:11`, `tests/play-movie-mytv.spec.js:11`, `tests/search-content-mytv.spec.js:10`, `tests/open-setting-mytv.spec.js:8`
- Trigger: Run a dependent spec alone, change test-file ordering, enable parallel workers, or retry a subset without the login spec.
- Workaround: Invoke login followed by the selected dependent spec, matching the mode arrays in `app/main.js:12` and `scripts/run-headed.js:13`.

**Search can pass without proving a result was found or played:**
- Symptoms: When `searchAndOpenBestContent()` returns `false`, the test callback returns normally and Playwright marks the test passed after only recording artifacts.
- Files: `tests/search-content-mytv.spec.js:15`, `tests/lib/mytv-helpers.js:345`
- Trigger: Execute a search whose result is unavailable after supplying a non-empty `SEARCH_KEYWORD`.
- Workaround: None in the test contract; inspect report attachments manually.

## Security Considerations

**Committed shared account credentials and insecure defaults:**
- Risk: A username/password pair is hard-coded in the test helper, terminal runner, renderer form, and documentation. The project has no `.env` exclusion, so future secret configuration can also be committed accidentally.
- Files: `tests/lib/mytv-helpers.js:3`, `scripts/run-headed.js:6`, `app/renderer/index.html:24`, `README.md:144`, `.gitignore:1`
- Current mitigation: The renderer uses a password input in `app/renderer/index.html:35`; Electron writes run credentials only into the child process environment in `app/main.js:110`.
- Recommendations: Revoke and rotate the committed account, remove all credential literals and examples, require environment/keychain-provided credentials, add `.env*` to `.gitignore`, and provide a `.env.example` with names only.

**AI API key is persistently stored in renderer localStorage:**
- Risk: The API key is saved as plaintext in Electron renderer storage and is loaded into the form on every app start. Any local user/process that can read the Electron profile, or renderer compromise, can recover it.
- Files: `app/renderer/renderer.js:273`, `app/renderer/renderer.js:294`, `app/renderer/renderer.js:338`
- Current mitigation: The UI uses a masked password field in `app/renderer/index.html:179` and context isolation is enabled in `app/main.js:46`.
- Recommendations: Store secrets in the operating-system credential vault (for example, keytar), avoid persisting by default, and provide an explicit clear-secret action.

**User-controlled endpoint and URL have no trust boundary:**
- Risk: The desktop UI forwards an arbitrary `AI_ENDPOINT` with the API key and an arbitrary `APP_URL` to a BrowserView/CDP-controlled browser. A mistyped or malicious custom endpoint can receive the key; an untrusted app URL is loaded with no navigation or popup policy.
- Files: `app/renderer/renderer.js:338`, `app/main.js:194`, `app/main.js:311`, `app/main.js:413`, `app/main.js:466`, `app/renderer/index.html:133`
- Current mitigation: The Electron main window and BrowserView disable Node integration and enable context isolation in `app/main.js:44` and `app/main.js:198`; the CDP URL binds to loopback in `app/main.js:104`.
- Recommendations: Allowlist HTTPS providers or require a prominent confirmation before sending a key to custom hosts; validate `APP_URL` protocol/origin; disable the unused `webviewTag`; use `setWindowOpenHandler` and navigation guards for BrowserView content.

**Sensitive test artifacts and logs persist locally:**
- Risk: Reports, screenshots, page URLs, player metadata, popup text, plans, and potentially user-facing account data are stored under Electron userData. The initial run log also exposes local executable and report paths.
- Files: `app/main.js:73`, `app/main.js:94`, `app/main.js:138`, `tests/lib/mytv-helpers.js:624`, `tests/lib/mytv-helpers.js:2190`, `README.md:251`
- Current mitigation: Packaged-run output is written outside the application bundle as documented in `README.md:80`.
- Recommendations: Define artifact retention and deletion controls, redact credential-adjacent data, restrict file permissions where supported, and avoid embedding full screenshots as base64 in HTML reports.

## Performance Bottlenecks

**Batch playback has a high serial runtime and artifact footprint:**
- Problem: Category/AI playback can process up to 60 items serially, wait at least six seconds per item, add navigation waits, and attach screenshots/base64 data for failures.
- Files: `tests/lib/mytv-helpers.js:197`, `tests/lib/mytv-helpers.js:204`, `tests/lib/mytv-helpers.js:2118`, `tests/lib/mytv-helpers.js:2190`, `tests/lib/mytv-helpers.js:2271`
- Cause: `maxItems` defaults to 60, `workers: 1` serializes the suite, and each item performs playback and return navigation before the next item.
- Improvement path: Make the default item limit conservative, enforce a total run budget, avoid base64 duplication in report HTML, and split independent non-session tests into a separate parallel project.

**Repeated full-DOM scanning in polling paths:**
- Problem: Locator and popup logic repeatedly enumerates every `[id]` or `body *` element, calculates styles/rectangles, and performs nested deduplication/grouping.
- Files: `tests/lib/mytv-helpers.js:1427`, `tests/lib/mytv-helpers.js:1759`, `tests/lib/mytv-helpers.js:1802`, `tests/lib/mytv-helpers.js:2284`, `tests/lib/mytv-helpers.js:2554`
- Cause: Generic fuzzy discovery is rerun during navigation and retry loops rather than constrained to a known container or cached for a stable screen.
- Improvement path: Scope queries to service/content containers, extract only candidate attributes, use `Locator` filtering where stable, and cache a screen snapshot for the duration of a navigation step.

## Fragile Areas

**Interactive Electron/CDP preview lifecycle:**
- Files: `app/main.js:6`, `app/main.js:194`, `app/main.js:311`, `tests/fixtures/mytv-session-fixture.js:17`, `app/renderer/renderer.js:390`
- Why fragile: A random debugging port, BrowserView load event plus an 8-second fallback, delayed zoom, and Playwright CDP polling must all align. No cleanup closes the CDP browser and failed loads resolve identically to successful loads.
- Safe modification: Preserve loopback-only CDP addressing, test live and interactive preview modes separately, await explicit URL/page readiness, and add teardown for BrowserView/CDP resources before changing viewport or load sequencing.
- Test coverage: `tests/ai-row-selection.spec.js` tests helper behavior only; no automated test exercises Electron IPC, BrowserView lifecycle, preview polling, or CDP connectivity.

**Preview polling and process stopping:**
- Files: `app/main.js:140`, `app/main.js:171`, `app/main.js:185`, `app/main.js:358`, `tests/fixtures/mytv-session-fixture.js:69`
- Why fragile: Stop uses a single `runningProcess.kill()` rather than a process-tree shutdown; screenshot capture and file polling run independently; the watcher suppresses all read/stat errors.
- Safe modification: Track an execution ID, terminate the child process group on supported platforms, await exit before clearing state, and log/retry only expected preview-file races.
- Test coverage: No test simulates stop during screenshot writes, child-process errors, or rapid consecutive runs.

## Scaling Limits

**Single shared browser context:**
- Current capacity: `workers: 1` and one worker-scoped context in `playwright.config.js:13` and `tests/fixtures/mytv-session-fixture.js:14`.
- Limit: Tests cannot run concurrently and remain order-dependent because authentication and page state are shared.
- Scaling path: Persist authenticated storage state after a dedicated login setup project, provision isolated accounts/contexts per worker, and separate stateful device flows from pure helper tests.

**Desktop process state supports one run and one preview watcher:**
- Current capacity: One `runningProcess`, one `previewWatcher`, and one `interactiveView` at module scope.
- Limit: Concurrent runs are rejected and stale asynchronous events can target the active renderer after stop/restart sequences.
- Scaling path: Keep the one-run UX if intended, but model each run with an ID, cancellation token, cleanup routine, and isolated report/preview directory.
- Files: `app/main.js:30`, `app/main.js:67`, `app/main.js:358`

## Dependencies at Risk

**Electron/Playwright packaging is platform-coupled:**
- Risk: Browser binaries are bundled externally with `asar: false`; package output depends on the host platform's downloaded Playwright browser and local Electron distribution.
- Impact: A build made with mismatched browser binaries fails to launch tests on the target OS, and artifact sizes are large.
- Migration plan: Build and smoke-test separately per target OS in CI, pin browser installation to the Playwright version, sign/notarize distributable artifacts, and keep the browser bundle out of source control.
- Files: `package.json:27`, `scripts/install-playwright-browsers.js`, `README.md:200`

**Dependency vulnerability status:**
- Risk: No production dependency vulnerabilities are reported by `npm audit --omit=dev` at analysis time; dependency health is not automated because no CI workflow is present.
- Impact: Future lockfile updates can introduce unreviewed vulnerable transitive dependencies.
- Migration plan: Add CI jobs for `npm ci`, `npm audit`, and scheduled dependency updates.
- Files: `package.json`, `package-lock.json`

## Missing Critical Features

**No CI verification pipeline:**
- Problem: The repository contains no detected GitHub Actions or other CI configuration to install browsers, run unit/helper tests, audit dependencies, or build platform artifacts.
- Blocks: Reproducible regression detection and trustworthy packaged releases.
- Files: `package.json`, `playwright.config.js`, `README.md:169`

**No explicit credentials/configuration boundary:**
- Problem: Runtime configuration is passed through form values and process environment with fallback account values, rather than using an example configuration and secure local secret store.
- Blocks: Safe sharing of the repository and reliable multi-environment test execution.
- Files: `tests/lib/mytv-helpers.js:3`, `scripts/run-headed.js:6`, `app/main.js:110`, `.gitignore`

## Test Coverage Gaps

**Electron main-process and IPC behavior:**
- What's not tested: Input validation, child-process spawn/error/stop paths, report opening, preview watcher cleanup, BrowserView navigation, and AI connection error handling.
- Files: `app/main.js`, `app/preload.js`, `app/renderer/renderer.js`
- Risk: Desktop-only failures and security regressions reach users without automated detection.
- Priority: High

**AI plan schema and external-provider behavior:**
- What's not tested: Invalid/malicious plans, saved-plan normalization, provider response variants, endpoint failures/timeouts, and custom provider safeguards.
- Files: `app/main.js:381`, `app/main.js:623`, `tests/lib/ai-plan-runner.js:8`
- Risk: AI mode can fail unpredictably or execute unexpectedly shaped input.
- Priority: High

**Live target flows are environment-dependent without deterministic fixtures:**
- What's not tested: Login, channel, movie, search, settings, and playback are verified only against the mutable remote staging application; the sole isolated test file covers five helper cases.
- Files: `tests/login-mytv.spec.js`, `tests/play-channel-mytv.spec.js`, `tests/play-movie-mytv.spec.js`, `tests/search-content-mytv.spec.js`, `tests/open-setting-mytv.spec.js`, `tests/ai-row-selection.spec.js`
- Risk: Target-app changes cause broad flakiness, while helper behavior lacks sufficient fixture-based regression coverage.
- Priority: High

---

*Concerns audit: 2026-07-13*
