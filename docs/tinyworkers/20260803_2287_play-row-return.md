# Fix Browser `play_row` case 2287 playback loop

**Plan ID:** 20260803-2287-play-row-return
**Status:** Completed with live-staging limitation
**Approval:** Direct user authorization in the task request; no additional minor-task approval requested
**Created:** 2026-08-03
**Updated:** 2026-08-03
**Owner:** Codex / Tiny-Workers
**Risk:** Medium
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright` on `feature/test-all-trailers`

## Status

- [x] Step 1: Establish the current `play_row` call path, regression cause, and baseline
- [x] Step 2: Restore bounded adaptive return-to-row behavior and add regression coverage
- [x] Step 3: Run focused, repository-wide, and available live validation; review the final diff

## Goal

### Problem

Browser case `2287` logs in and focuses the first poster of Home row 2, but does not complete the expected repeatable poster playback flow. The current row playback cleanup can stop after two Back presses even when the activated content requires an intermediate detail/player boundary before returning to the selected Home row. The resulting cleanup failure can leave the run on the wrong screen or trigger the app-exit confirmation instead of advancing to the next poster.

### Desired outcome

`play_row(rowIndex: 2)` must activate the focused poster with the shared verified `Enter` path, wait for and inspect playback, return adaptively to the original row within a safe bounded number of Back presses, refocus the item if necessary, advance to the next poster, and repeat until the row is exhausted or the existing batch budget is reached.

### Acceptance criteria

- [x] The row playback path still sends `Enter` through `activateVerifiedTarget` for each focused poster.
- [x] A row item that needs more than two Back presses can return to the original row through the bounded adaptive helper; the row boundary also accepts the original poster identity after Home reflow.
- [x] The helper continues to reject unexpected modals and does not turn an exit confirmation into an unbounded close loop.
- [x] Unit coverage proves the expanded row-return bound and preserves the existing default two-Back bound for generic player cleanup.
- [x] `npm run test:unit`, required syntax checks, Playwright test listing, and `git diff --check` pass after the change.
- [x] A live Browser check was attempted with the cached case; the exact staging focus/playback instability is recorded below, and no full staging pass is claimed.

### Non-goals

- Do not change the test-case schema, API/cache contract, login flow, player timeout default, or the meaning of `count`.
- Do not change generic player cleanup's default behavior for named/search playback.
- Do not modify deployment scripts, production systems, credentials, or the local fixture to add the API case.
- Do not redesign row discovery, remote focus, or the report format beyond evidence needed for this regression.

## Current State and Findings

- `tests/lib/test-case-action-runner.js:createDefaultActionHandlers` maps `play_row` to `helpers.playItemsInRow`, passing the configured Browser player-check timeout.
- `tests/lib/workflows.js:playItemsInRow` converts the 1-based server `rowIndex` to the internal zero-based row index and delegates to `playAllItemsInFirstRow`.
- `tests/lib/workflows.js:playAllItemsInFirstRow` focuses a row, calls `openFocusedContentForPlayback` for each item, waits with `inspectPlaybackAfterWait`, then calls `returnToFirstRowContent` before moving right.
- `tests/lib/content-rows.js:openFocusedContentForPlayback` calls `activateVerifiedTarget`; `tests/lib/selector-validation.js:activateVerifiedTarget` sends `page.keyboard.press("Enter")` after validating the focused content item. The current source therefore contains the expected OK/Enter call; the live check must determine whether activation is rejected or the post-activation return path fails.
- `tests/lib/content-rows.js:returnToFirstRowContent` currently delegates to `closePlayerOrDetail` with `maxBackPresses: 2` and a row-focus boundary predicate.
- Live diagnostic for cached case `2287` reached `#homePage2_0_1.cate_content_item.no-title.focused` after row navigation, but the element was at `y≈64` with no text label; `isFocusedContentItem` rejected it because it required `y≥100` and a non-empty label. This explains the observed long wait/no-OK symptom before playback activation.
- The focused Home state can contain multiple stale/hidden `.focused` markers while the carousel rerenders; focus observers now select the first visible marker, and row-start focus retries the same target within a bounded window.
- Remote focus must refresh target geometry after each key because Home scroll changes poster rectangles; the stale geometry diagnostic ended on `homePage2_22_0.item_go_to_top` instead of the requested row poster.
- After returning to Home, no-title posters can have an exact focused ID but an unrelated visible label candidate; selector activation now treats that exact ID as authoritative while retaining unexpected-modal safety.
- `tests/lib/playback.js:closePlayerOrDetail` defaults to two Back presses and currently clamps the option maximum to two, so the row helper cannot request a deeper but still bounded return.
- Live-preview Browser runs previously used a 1920×1080 CSS viewport while non-preview runs used 960×540. The same remote `Enter` reached the document in both modes, but staging only opened `moviePlayerNew` at 960×540; the Browser fixture now uses the app-window viewport for non-interactive runs, including live preview.
- `getPlayerState` now ignores empty Home/promo `<video>` elements and only reports a video when it has visible media state, preventing a false player-positive before the row poster is activated.
- Commit `6e3882c` replaced the previous row-return loop, which allowed `Math.max(backPresses, 1) + 4` attempts, with the shared helper capped at two; this is the relevant behavior regression.
- Baseline: `npm run test:unit` — 602 tests passed, 0 failed.
- Baseline: `node --check app/main.js`, `node --check app/preload.js`, `node --check app/renderer/renderer.js`, `npx playwright test tests/run-test-case-mytv.spec.js --list`, and `git diff --check` — all passed.
- Worktree baseline: clean apart from the branch metadata (`feature/test-all-trailers`); `git status` initially reported a Git fsmonitor IPC warning, so status/history checks use `-c core.fsmonitor=false`.
- After the focus/activation and viewport fixes, the exact GUI Browser run reached item 4 through repeated poster activation, playback checks, adaptive return, and horizontal advance. It then reported the staging poster's unsupported-device dialog; this is an expected safety failure for the target environment, not the original first-poster timeout.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Preserve the shared close helper | Recreate the old Back loop in `content-rows.js`; leave the two-press cap; add a new player-specific helper | Extend `closePlayerOrDetail` to accept a larger explicit bounded maximum, keep its adaptive boundary/popup logic, and have row return request the old six-press ceiling | Keeps popup safety and close-state observation in one implementation while restoring the behavior that case 2287 needs | Generic cleanup remains two presses by default; row cleanup gets a documented, narrowly scoped larger bound |
| Keep activation unchanged unless live evidence disproves it | Add a direct `page.keyboard.press("Enter")` in row playback; bypass selector validation | Retain `openFocusedContentForPlayback` → `activateVerifiedTarget` and add a focused regression assertion if needed | The current call path already presses Enter, and duplicating it could double-activate content | A live failure will be classified from activation diagnostics rather than masked by duplicate input |
| Accept the actual focused Home poster shape | Keep requiring text and `y≥100`; weaken all focus checks to any visible element | Accept a visible, identified `cate_content_item`/Home poster with a poster-sized rectangle even when it has no label or has been scrolled near the top; keep menu/key exclusions and viewport bounds; retry a target while the carousel settles | The staged DOM proves this is a legitimate focused poster, and the existing selector contract already treats identified content IDs as authoritative | Untitled posters can activate and advance; unrelated menu/header focus remains rejected |
| Confirm the row boundary by identity | Require the original row Y only; stop after any non-player route | Accept the original poster ID when it is visibly focused, even if Home reflow changes its Y position; shorten row-boundary polling to three seconds | The row helper knows the item it activated, so identity is stronger than a stale coordinate after player return | The helper avoids sending extra Back presses while Home is reflowing, while retaining the six-press ceiling |
| Use a finite retry ceiling | Unbounded Back presses; fixed one/two presses | Six row-return Back presses, with the existing early row-boundary and unexpected-popup checks | Matches the pre-regression bound (`2 + 4`) and prevents an exit/app loop from running indefinitely | A destination requiring more than six Back presses remains an explicit failure with diagnostics |

## Assumptions, Constraints, and Dependencies

- Assumption: API-loaded case `2287` is available through the user's existing Electron cache or staging environment; the password remains masked and must never be logged or copied into artifacts.
- Constraint: all MyTV interaction remains remote-key/virtual-keyboard based; no direct form filling or mouse-driven TV interaction.
- Constraint: generic Browser player checks keep their two-Back default and exit-popup safety behavior.
- Dependency: live validation requires the local Electron runtime, the managed Chromium installation, the target `APP_URL`, and an available cached case/account session.
- Unresolved material questions: None; the direct task request supplies the required authorization and acceptance behavior.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| A larger row-return bound sends an extra Back after a misdetected player state | Could expose an exit confirmation or leave the app on the wrong page | Observe unexpected dialogs before every press, stop at six attempts, and assert the row boundary after each press | Revert only the close-helper option and row-return call, preserving the regression tests |
| The live app uses a different detail depth than the captured case | Live run could still fail after six attempts | Preserve boundary diagnostics and report the exact observed route/dialog; do not expand beyond the approved bound without a new decision | Record as a blocked live dependency while unit/static evidence remains valid |
| Activation fails before Enter because the focused element violates the content contract | The row would still fail even after cleanup is fixed | Add/retain a test that verifies the activation dependency is called; inspect live activation diagnostics before changing selectors | Limit any selector change to a separate plan amendment |

## File Impact and Detailed Changes

### `tests/lib/playback.js`

**Action:** Modify
**Current role and evidence:** Shared player/detail close behavior at `closePlayerOrDetail`; generic default is two Back presses and the current normalizer caps all callers at two.
**Exact changes:** Permit an explicit caller-supplied row-return maximum up to the approved finite ceiling (six or an equivalent named constant) while preserving the default of two, boundary polling, exit-confirmation dismissal, and unexpected-modal failure behavior. Export the named ceiling for the row-return contract test.
**Invariants and compatibility:** Named/search player cleanup remains unchanged when it omits `maxBackPresses`; no new selectors, direct app calls, or unbounded loops.
**Tests affected:** `tests/unit/playback.test.js` gains a test that a caller can close after more than two Back presses while the default remains two.

### `tests/lib/content-rows.js`

**Action:** Modify
**Current role and evidence:** Row playback cleanup calls `closePlayerOrDetail` with `maxBackPresses: 2` from `returnToFirstRowContent`.
**Exact changes:** Accept the actual visible identified Home poster focus shape in `isFocusedContentItem` (including `.cate_content_item.no-title` near the top of the viewport), select visible focus markers, retry row-start targeting while the carousel settles, pass the approved row-return maximum to the shared helper, accept the original item identity as a return boundary when its Y changes, keep the row-focus predicate, refocus the item if necessary, and preserve `expectFocusedContent` before advancing.
**Invariants and compatibility:** `openFocusedContentForPlayback` continues to use the verified activation dependency; row navigation and Vietnamese matching remain unchanged.
**Tests affected:** `tests/unit/content-rows.test.js` updates the close-option contract and adds coverage that the row helper requests the deeper bound without bypassing activation.

### `tests/fixtures/mytv-session-fixture.js`

**Action:** Modify
**Current role and evidence:** The Browser fixture creates the non-interactive Playwright context and optional live-preview screenshot stream.
**Exact changes:** Use the 960×540 app-window viewport for live and non-live Browser contexts so the staging Home carousel follows the same focus/activation behavior; keep the preview stream best-effort and separate from keyboard interaction.
**Invariants and compatibility:** Interactive CDP runs continue to reuse the existing Electron BrowserView context; no application or API behavior is changed.
**Tests affected:** The exact cached live-preview Browser run reaches `moviePlayerNew` after the row poster activation.

### `tests/lib/navigation.js`

**Action:** Modify
**Current role and evidence:** Remote focus computes a direction from one target rectangle; the live Home carousel can scroll and move that target while navigation is in progress.
**Exact changes:** Refresh target geometry before each direction choice and retain the last known rectangle if a transient rerender hides the target.
**Invariants and compatibility:** Key-only TV navigation remains unchanged; no selectors or direct DOM activation are introduced.
**Tests affected:** `tests/unit/navigation.test.js` proves direction changes when the target moves during a focus sequence.

### `tests/lib/selector-validation.js`

**Action:** Modify
**Current role and evidence:** Verified activation can reject a no-title poster when an unrelated stale label candidate outranks the focused element.
**Exact changes:** Treat an exact caller-supplied focused ID as authoritative for label/candidate ambiguity checks while preserving the existing content/menu contract and modal safety.
**Invariants and compatibility:** Only exact ID matches receive the bypass; fuzzy-only or partial matches retain the current verification thresholds.
**Tests affected:** `tests/unit/selector-validation.test.js` proves a no-title poster still sends Enter when the label candidate is stale.

### `tests/unit/playback.test.js`

**Action:** Modify
**Current role and evidence:** Contract tests cover default one/two-Back close, exit-confirmation dismissal, and unexpected modal rejection.
**Exact changes:** Add explicit-bound coverage and keep existing default/popup assertions.
**Invariants and compatibility:** Tests remain deterministic harness tests; no real credentials or network data.

### `tests/unit/content-rows.test.js`

**Action:** Modify
**Current role and evidence:** Existing row tests cover row discovery/indexing and a two-Back close-helper option contract.
**Exact changes:** Assert the row-return helper requests the deeper bounded close and still supplies the row boundary predicate; retain focused activation coverage and add a focused-poster contract case for the no-title/near-top shape where practical without duplicating workflow integration.
**Invariants and compatibility:** Tests do not claim live player health; they only verify the trusted helper calls and bounded cleanup contract.

### `docs/tinyworkers/20260803_2287_play-row-return.md`

**Action:** Modify during execution
**Current role and evidence:** Canonical Tiny-Workers plan for this fix.
**Exact changes:** Record step status, actual commands/results, deviations, final changed files, and any live-runtime limitation.
**Invariants and compatibility:** This document is the durable status/evidence source; no secrets or credentials are recorded.

## Execution Sequence

### Step 1 — Establish diagnosis and baseline

**Objective:** Confirm the action-to-helper call path, capture the two-Back regression evidence, and record clean baseline checks.
**Files:** Plan only; read-only inspection of `tests/lib/test-case-action-runner.js`, `tests/lib/workflows.js`, `tests/lib/content-rows.js`, `tests/lib/playback.js`, and `tests/lib/selector-validation.js`.
**Implementation details:** No production code changes. Use Graphify for navigation, direct source/history inspection for proof, and the unit/static baseline commands.
**Dependencies:** Current branch and worktree available.
**Verification:** Graphify query/path, source/history inspection, and baseline commands listed above; expected result: call path and regression are evidenced, baseline passes.
**Exit criteria:** Diagnosis is recorded and no unrelated worktree changes are present.
**Approval gate:** Not required; covered by the user's direct task authorization.

### Step 2 — Restore bounded adaptive row return

**Objective:** Let row playback return through the shared adaptive close helper for up to the pre-regression finite bound, without changing generic defaults or popup safety.
**Files:** `tests/lib/playback.js`, `tests/lib/content-rows.js`, `tests/lib/navigation.js`, `tests/lib/selector-validation.js`, `tests/unit/playback.test.js`, `tests/unit/content-rows.test.js`, `tests/unit/navigation.test.js`, `tests/unit/selector-validation.test.js`.
**Implementation details:** Introduce or reuse a named six-press row-return ceiling; remove only the hard two-press clamp for explicit callers; pass the ceiling from `returnToFirstRowContent`; retain early row-boundary detection, safe popup handling, and refocus. Refresh moving target geometry during remote focus and trust exact focused poster IDs when stale labels would otherwise block Enter.
**Dependencies:** Step 1 diagnosis; no new dependency or API.
**Verification:** Focused playback/content-row/navigation/selector unit tests and a targeted Node test run; expected result: explicit 3–6 Back close passes, default generic close stays at two, unexpected popup still fails safely, row cleanup requests the deeper bound and shorter boundary poll, settling focus is retried, moving target geometry is refreshed, and no-title activation sends Enter.
**Exit criteria:** All acceptance criteria related to activation contract and row return have deterministic test evidence.
**Approval gate:** Not required; implementation stays within the approved files, behavior, and risk.

### Step 3 — Full verification and handoff

**Objective:** Verify the final diff and validate the case flow in the available runtime.
**Files:** Plan evidence only unless a within-scope repair is required.
**Implementation details:** Run `npm run test:unit`, syntax checks, Playwright listing, `git diff --check`, inspect the final diff, and run live Electron/Browser case 2287 when runtime/cache prerequisites exist. If GUI launch remains unavailable, record the exact launcher failure and rely on deterministic coverage without claiming live success.
**Dependencies:** Step 2 complete.
**Verification:** Actual command output, live report/preview evidence if available, and clean final diff review.
**Exit criteria:** Every acceptance criterion is evidenced or explicitly marked unavailable with its blocker; no unrelated changes remain.
**Approval gate:** Not required for the scoped fix; any expansion beyond the six-press bounded approach requires Tiny-PM review.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Row playback activates each focused poster with Enter | Unit/contract/live | Focused content-row/action-runner/selector tests; inspect `activateVerifiedTarget` call path; exact cached run | Activation dependency remains authoritative and sends Enter through selector validation; final GUI run reached item 4 before the staging popup |
| Deep row return works | Unit/integration harness | `node --test tests/unit/playback.test.js tests/unit/content-rows.test.js` | Close succeeds after 3–6 Back presses and row boundary is accepted |
| Generic close remains safe | Unit/negative | Existing playback tests plus explicit default-bound test | Default two-Back behavior and unexpected-popup rejection remain passing |
| Repository remains valid | Static/regression | `npm run test:unit`; syntax checks; Playwright list; `git diff --check` | All pass; no new failures |
| Case 2287 user-visible flow | Manual/live | Exact GUI-selected cached Browser run with live preview | Login and Home passed; the row loop reached item 4 (`Ăn Chạy Yêu`) after activating and returning from earlier posters, then failed on the staging `Thiết bị không hỗ trợ` modal. The original first-poster/max-time symptom did not recur. |

## Completed Verification

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 baseline | `npm run test:unit` | Pass | 602 tests passed, 0 failed | 2026-08-03 |
| Step 1 static baseline | Node syntax checks, Playwright list, `git diff --check` | Pass | All commands exited 0; one Playwright test listed | 2026-08-03 |
| Step 1 diagnosis | Graphify query, direct source/history inspection, AgentMemory recall | Pass | Current activation path sends Enter; commit `6e3882c` narrowed row return from adaptive `+4` to two | 2026-08-03 |
| Step 2 focused regression tests | `node --test tests/unit/playback.test.js tests/unit/content-rows.test.js tests/unit/navigation.test.js tests/unit/selector-validation.test.js` | Pass | 18 tests passed, including six-Back close, two-Back default, visible no-title poster identity, settling-focus retry, moving target geometry, and stale-label activation | 2026-08-03 |
| Step 3 repository unit suite | `npm run test:unit` | Pass | 610 tests passed, 0 failed | 2026-08-03 23:32 +07:00 |
| Step 3 syntax/list/diff | Node syntax checks; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check` | Pass | All exited 0; one Playwright test listed | 2026-08-03 |
| Step 3 graph refresh | `graphify update . --no-cluster` | Pass | AST graph updated with 2,684 nodes and 4,946 edges; required elevated filesystem access was needed | 2026-08-03 |
| Step 3 isolated live-preview diagnostic | One-item cached case 2287 run with `MYTV_PREVIEW_PATH` | Pass for activation path | At 960×540, the focused poster sent one `Enter`, reached `moviePlayerNew`, and returned to Home; the same flow at 1920×1080 stayed on `homeNewUI`, which identified the GUI viewport defect | 2026-08-03 23:25–23:33 +07:00 |
| Step 3 exact GUI Browser run | Selected GUI case 2287 with live preview and folder cache key `6` | Partial | Login and Home passed; the row loop reached item 4 (`Ăn Chạy Yêu`) through activation/return/advance, then the target reported `dialog_alert_v2`: `Mã 20301 … Thiết bị không hỗ trợ`. The runner no longer stalled on the first poster or timed out into the app-exit popup. | 2026-08-03 23:34–23:36 +07:00 |

## Deviations and Plan Updates

- 2026-08-03, Step 2: live staging evidence showed the failure occurs before activation because a legitimate `.cate_content_item.no-title.focused` poster at `y≈64` was rejected by `isFocusedContentItem`; broadened the same planned `content-rows.js` focus predicate only for visible identified poster elements, preserving menu/key exclusions and the bounded scope.
- 2026-08-03, Step 2: repeated staging runs exposed a separate carousel re-render race and row Y drift after player return; added bounded row-focus retries, visible-marker selection, original-item identity matching, and a three-second row boundary poll without changing generic player cleanup.
- 2026-08-03, Step 2: final live evidence showed exact poster IDs were focused but stale label candidates blocked no-title activation; exact-ID selector verification, moving target geometry refresh, and the app-window viewport were added, then the loop reached item 4 before the target-specific unsupported-device popup.

## Handoff and Completion

- Changed files: `tests/fixtures/mytv-session-fixture.js`, `tests/lib/content-rows.js`, `tests/lib/navigation.js`, `tests/lib/playback.js`, `tests/lib/selector-validation.js`, the four focused unit files, and the generated `graphify-out/graph.json`/`manifest.json` refresh.
- Checks passed: 610 unit tests; syntax checks; Playwright listing; `git diff --check`; focused 18-test regression run; Graphify AST refresh.
- Known limitations: The exact GUI Browser case now reaches item 4 through playback/return/advance, then staging returns an unsupported-device modal for that poster; the safety policy correctly fails the case, so a full live pass is not claimed because the current staging content is not playable on this target.
- Follow-up work: Rerun case 2287 on a target/device profile supported by all row content; no further row-loop expansion is justified by the current evidence.
- Final acceptance status: Code fix and deterministic validation complete; live end-to-end validation is partial because staging rejects one row poster as unsupported on the Browser target.
