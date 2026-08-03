# Play all Home trailers

**Plan ID:** 20260803_play-home-trailers
**Status:** Complete
**Approval:** Approved by user on 2026-08-03
**Created:** 2026-08-03 00:07:50 +07:00
**Updated:** 2026-08-03 12:26:00 +07:00
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** Medium
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright` on `feature/test-all-trailers`

## Status

- [x] Step 1: Add and document the `play_home_trailers` action contract.
- [x] Step 2: Implement the Browser Home-trailer lifecycle and report artifacts.
- [x] Step 3: Wire the action into the Browser runner and add contract coverage.
- [x] Step 4: Run verification and complete the handoff evidence.
- [x] Step 5: Support Album-detail activation and complete-carousel runtime coverage.
- [x] Step 6: Make player/Album-detail return cleanup adaptive and exit-popup safe.
- [x] Step 7: Make adaptive player closing the shared default for all Browser tests.

## Goal

### Problem

The fallback grammar and Browser action runner can play named content and every
item in a content row, but they have no action for the promotional trailers at
the top of Home. A Home trailer is a separate lifecycle: focus `Xem ngay`, enter
the player, return with Back, and let Home advance to the next trailer. The
carousel's `#promo-video-next` control is the fixed internal marker for trailer
availability/identity; it is not supplied by server data.

### Desired outcome

Add one validated action, `play_home_trailers`, so descriptions such as
`Chạy toàn bộ trailer ở trang chủ`, `Phát tất cả trailer ở trang chủ`, and
`Play các trailer ở trang chủ` compile to a single runtime action. The Browser
helper must play every distinct available Home trailer, verify healthy playback
or a valid Album detail screen for each, return Home between attempts, stop at
the end or when the carousel cycles, and fail with per-trailer evidence if any
trailer cannot open successfully. The selected test's compact user report must
also list every attempted trailer by name and show its post-activation
player/Album-detail check screenshot, including trailers whose check fails.

### Acceptance criteria

- [x] The schema accepts exactly `{ "action": "play_home_trailers" }`, rejects unknown fields, and keeps the server action allowlist closed to executable data.
- [x] The deterministic fallback compiler accepts the requested Vietnamese/English verb and quantity variants, preserves original-line diagnostics, and emits exactly one `play_home_trailers` action.
- [x] The Browser action handler forwards the configured player-check timeout to the Home-trailer helper.
- [x] The helper uses remote focus/Enter/Back navigation only; it does not call DOM `click()` or use a server-provided selector.
- [x] Every distinct available trailer is attempted. Each attempt waits for either a healthy playing player or a valid Album detail screen with a visible content list, returns to Home, waits for the next Home trailer state, and records its result.
- [x] The loop terminates safely when the next control is unavailable/disabled or the carousel returns to a previously tested trailer; it cannot spin past the dedicated full-carousel runtime budget.
- [x] Zero available trailers, an unidentifiable trailer state, a failed player check, or a failed Home return fails the action. Individual failures are retained in the result report while the helper continues only when it can safely return Home and test the remaining trailers.
- [x] Before each activation, the helper reads the visible name from the trusted `#promo-video-title #trailer-name` Home title node (supporting the known root/child DOM variant). After entering the destination, it captures the post-activation player/Album-detail check screenshot using the same player-check flow timing. A trailer result is not finalized without both its name and screenshot.
- [x] The action result carries every attempted trailer as `{name, status, screenshotDataUrl, ...}` in both success and failure paths. A failed player check keeps that trailer's name and player screenshot, and the helper continues when it can safely return Home.
- [x] Return cleanup sends one BACK at a time, stops immediately when safe Home is observed, handles destinations that need one or two BACK presses, and dismisses an exit-confirmation popup without sending a third close BACK.
- [x] The adaptive one/two-BACK close behavior is implemented once in the shared playback helper and is used by generic player cleanup, expected-result cleanup, row playback cleanup, and Home trailers; trailer logic supplies only its Home-boundary predicate.
- [x] The compact user report for the selected test ID renders a Home-trailer table containing every attempted trailer's name, `playable`/`album_opened`/`failed` status, activation type, and corresponding post-activation screenshot; it does not filter the table down to failed trailers. Playwright JSON/HTML evidence remains available, and the final action result passes only when every attempted trailer is playable or opens Album detail.
- [x] LG admission rejects this Browser-only action before creating a TV/Appium session because the requested contract depends on the Browser Home promo DOM and the current LG semantic layer has no equivalent operation.
- [x] Project documentation lists the new action, grammar, Browser-only boundary, and lifecycle.

### Non-goals

- Do not add a credential-bearing local fixture case or a staging-only legacy spec; the generic server-driven case runner is the test entry point.
- Do not change the existing playback result contract, player timeout, logout cleanup, or legacy channel/movie flow assertions; their close navigation may now use the shared adaptive helper.
- Do not implement or resume LG real-TV trailer automation in this change; that requires a separate approved semantic operation and real-TV validation.
- Do not use mouse clicks, arbitrary JavaScript from case data, or a fixed trailer count.

## Current State and Findings

- `tests/lib/test-case-schema.js` owns the closed action allowlist in `ALLOWED_ACTIONS`, field declarations in `ACTION_KEYS`, and action validation in `validateAction`; no Home-trailer action exists.
- `tests/lib/test-case-compiler.js` uses ordered `STEP_COMPILERS` and `compileLine`; the existing `play_row` grammar covers only content rows, while the current trailer grammar only focuses a single `Xem ngay` button (`ACTION-COMPILER.md:268-301`).
- `tests/lib/test-case-action-runner.js:createDefaultActionHandlers` maps Browser actions to the helper facade. `play_content`, `play_search_result`, and `play_row` pass the normalized player timeout; no handler exists for a Home-trailer batch.
- `tests/lib/workflows.js:playAllItemsInFirstRow` already establishes the desired batch behavior: `createBatchBudget`, per-item results, return navigation, failure evidence, and final failure when any item fails. `tests/lib/content-rows.js:openFocusedContentForPlayback` already has an `Xem ngay` fallback, but it is designed for one content item rather than Home's advancing promo carousel.
- `tests/lib/playback.js:inspectPlaybackAfterWait` and `getPlayerState` provide the existing player-health check and default six-second timeout. `tests/lib/artifacts.js` provides the existing per-item playback HTML/JSON rendering primitives.
- `tests/lib/playback.js:closePlayerOrDetail` now owns the shared adaptive player/detail close lifecycle: it observes closure after each Back, allows at most the required second Back, recognizes the fixed exit-confirmation dialogs, and dismisses them without treating the dismissal as another close attempt.
- Generic Browser cleanup in `tests/lib/test-case-action-runner.js`, content-row return in `tests/lib/content-rows.js`, and the retained legacy row copy all delegate to the shared close helper. `tests/lib/home-trailers.js` supplies only the Home boundary predicate and popup observer.
- `tests/run-test-case-mytv.spec.js` writes the complete generic case result to `MYTV_CASE_RESULT_PATH`, and `app/main.js:finishTestProcess` already passes that sidecar into `buildTestReportEntry` before writing the local `test-report.json` and `test-report.html`. `app/test-report.js` currently projects only failed item rows plus one completion screenshot, so Home-trailer results need a separate all-items field and Details-table renderer.
- `tests/lib/target-action-runner.js:ACTION_CAPABILITIES` is the LG admission boundary. `app/lg-desktop-batch-runner.js` passes only `domInspection`, `visualCapture`, `targetSemanticActions`, and `playerInspection`; a new Browser-only capability can reject this action before TV input.
- Unit coverage is split across `tests/unit/test-case-schema.test.js`, `tests/unit/test-case-compiler.test.js`, `tests/unit/test-case-action-runner.test.js`, `tests/unit/target-action-runner.test.js`, and `tests/unit/artifacts.test.js`. There is no existing dedicated Home-trailer workflow test.
- Baseline: `npm run test:unit` — 564 passed, 0 failed, 0 skipped; duration approximately 0.95 seconds.
- Baseline: `git -c core.fsmonitor=false status --short --branch` — only the pre-existing user modification `M AGENTS.md` on `feature/test-all-trailers`.
- Baseline: `git -c core.fsmonitor=false diff --check` — pass.
- Graphify query of the existing `graphify-out/graph.json` identified the action schema/compiler/runner, Home navigation, and playback modules as the relevant dependency neighborhood; raw source inspection above verified the relationships.
- AgentMemory smart-search found no prior high-confidence trailer-specific decision or failed approach; results were current-session observations only and were not treated as design evidence.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Action name | `play_all_trailers`, a primitive action sequence, or reuse `play_row` | `play_home_trailers` | Names the Home-specific behavior without pretending trailers are content-row items; one action can own dynamic loop state. | The schema/compiler/docs gain one new action and the server should emit it explicitly. |
| Runtime location | Put the loop directly in `test-case-action-runner.js`; add it to the large `workflows.js`; add a focused module | Add `tests/lib/home-trailers.js` and expose it through the helper facade | Keeps the carousel state machine isolated and dependency-injectable for unit tests while reusing existing navigation, player, budget, and artifact primitives. | Adds one focused helper module and one focused unit test rather than coupling loop tests to the full workflow module. |
| Trailer advancement | Click `#promo-video-next`; use a fixed count; expand into repeated primitive actions | Honor the described Back-to-Home transition, read the fixed `#promo-video-next` marker, and use remote focus/Enter on that trusted control only when Home fails to advance within the bounded wait; stop on unavailable/disabled or a repeated identity | Preserves the TV remote contract, handles a server-controlled number of trailers without guessing a count, and recovers the observed staging stall. | The helper must fail safely if the promo state cannot expose a stable identity or the fallback cannot advance it. |
| Playback failure policy | Stop at the first failure; silently skip failures; continue like `play_row` | Record the failure, return Home when possible, continue remaining trailers, then fail the action if any item failed | Produces evidence for all available trailers while preserving an authoritative failed result. | A failed trailer can lengthen the run but remains bounded by the existing batch budget. |
| Browser/LG scope | Add a new LG semantic operation; let LG fail later at handler dispatch; reject at admission | Mark the action with a Browser-only capability in `ACTION_CAPABILITIES` | The requested selector is Browser DOM-specific and the current LG automation intentionally exposes only a partial semantic set; early rejection avoids TV/Appium input and misleading case admission. | LG users receive a clear capability error until a separate approved LG design exists. |
| Reports | Reuse the `first-row` filenames; return only a count; show only failed trailers; or change the server result payload | Generalize the artifact report helper with a prefix/title while retaining the old wrapper, return all trailer item results, and project them into a dedicated `homeTrailerItems` field in the local user-report entry | The user needs the name and player-check screenshot for every tested trailer, regardless of player status. Keeping the data in the existing case-result sidecar makes it available to both passing and failing case Details without changing the server result-submission contract. | `artifacts.js` gains a backwards-compatible helper; `app/test-report.js` renders all Home-trailer rows; report tests prove pass/fail retention. |
| Player/detail close ownership | Keep adaptive Back logic inside Home trailers; retain fixed one-Back generic cleanup; or duplicate it in row playback | Put `closePlayerOrDetail` and the fixed exit-dialog observer in `tests/lib/playback.js`; let generic cleanup, row playback, retained legacy playback, and Home trailers call it with destination-specific predicates | The one/two-BACK behavior is a shared player lifecycle rule. Centralizing it prevents a second Back from opening Home's exit confirmation and keeps each caller's destination check explicit. | Existing playback contracts, timeouts, report screenshots, logout cleanup, and explicit `press_back` semantics remain unchanged; close navigation becomes adaptive. |

## Assumptions, Constraints, and Dependencies

- Assumption: The default target for this request is the Browser runner. The exact `#promo-video-next` DOM contract and the lack of an LG equivalent are the basis for the Browser-only boundary.
- Assumption: Returning to Home after a trailer player check advances the promo carousel as described; the helper will verify the state changed before starting the next attempt.
- Assumption: The user-facing screenshot for each trailer is the player-check frame captured after `Xem ngay`, using the existing player-check success/failure timing; the Home title is used only to identify the trailer before activation.
- Assumption: A trailer that does not produce a video but opens an Album detail screen with a visible content list is a successful activation and is reported as `album_opened`; its screenshot is the post-activation Album detail check frame.
- Assumption: A stable trailer identity can be derived from the visible promo root/media attributes near `#promo-video-next` (for example `data-*` identity, image/video source/poster, or visible title). If the live DOM exposes none, the action fails with diagnostics rather than guessing.
- Constraint: All server-provided values remain data-only. The selector and DOM probe are fixed trusted code in the helper.
- Constraint: Remote-control focus, `Enter`, and `Backspace` are the only app interactions; no mouse-driven activation.
- Dependency: Existing player readiness, `createBatchBudget`, Home readiness, and artifact helpers remain the source of truth for timeout, pacing, and evidence behavior.
- Dependency: The user must approve this plan before implementation begins. The previously authorized minor-task approval does not replace approval for this medium-risk contract change.
- Unresolved material questions: None under the Browser-first assumption; expanding to LG would require a plan amendment and approval.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| Promo DOM identity is unstable or unavailable | The loop may stop early or cannot prove that all trailers were tested. | Read multiple fixed identity/media attributes, wait for state transitions, detect repeats, attach the observed state, and fail closed when identity is empty. | Revert the new action/helper/docs/test files; existing actions remain unchanged. |
| Home return or player teardown differs between environments | Later trailers may be skipped or the account may remain in the player. | Use the existing player inspection, bounded Back/Home wait, and per-item cleanup; preserve the original failure as authoritative. | Disable the new action in server data or revert only the helper/handler while retaining schema tests if needed. |
| Carousel loops forever or the full 16-item run is slow | A test can hang or stop before the user's known Home carousel is covered. | Use repeated identity detection, disabled/unavailable next detection, and a dedicated 10-minute Home-trailer runtime budget with no fixed trailer count. | Stop the case at the bounded failure and inspect the attached state/budget evidence. |
| Shared action vocabulary is accepted by LG | An LG batch could admit a Browser-only case and only fail after TV setup. | Add a dedicated capability requirement and test admission failure before session creation. | Remove the capability entry and action support together if the action is withdrawn. |
| Existing user edits in `AGENTS.md` are overwritten | Unrelated instructions could be lost. | Preserve the current diff and append only the new action contract/documentation. | Restore the file from the user’s working copy manually; no destructive git commands will be used. |

## File Impact and Detailed Changes

### `tests/lib/test-case-schema.js`

**Action:** Modify
**Current role and evidence:** Closed action allowlist and per-action field validation in `ALLOWED_ACTIONS`, `ACTION_KEYS`, and `validateAction`.
**Exact changes:** Add `play_home_trailers` to the allowlist and declare it as a parameterless action. Return only the action field after validation; reject selectors, counts, module paths, or other undeclared fields.
**Invariants and compatibility:** Existing action normalization and explicit-action precedence remain unchanged.
**Tests affected:** `tests/unit/test-case-schema.test.js`.

### `tests/lib/test-case-compiler.js`

**Action:** Modify
**Current role and evidence:** Ordered fallback grammar in `STEP_COMPILERS` and `compileLine`.
**Exact changes:** Add an ordered parameterless compiler for `chạy|phát|play` plus `toàn bộ|tất cả|các` and `trailer|trailler` at/on/in Home wording, with punctuation and Vietnamese normalization. Emit `{action: "play_home_trailers"}` and preserve the existing unsupported/ambiguous original-line errors.
**Invariants and compatibility:** Do not broaden generic `play_content` or `play_row`; explicit server actions remain authoritative and are validated through the schema.
**Tests affected:** `tests/unit/test-case-compiler.test.js` with the requested wording matrix and negative near-misses.

### `tests/lib/home-trailers.js`

**Action:** Add
**Current role and evidence:** No dedicated Home promo state machine exists; current row playback lives in `tests/lib/workflows.js:playAllItemsInFirstRow`.
**Exact changes:** Add a dependency-injectable `createHomeTrailersApi` and default `playAllHomeTrailers(page, testInfo, options)` implementation. The helper will:

1. Wait for Home readiness and read a fixed trusted DOM snapshot around visible `#promo-video-next`, including availability/disabled state, a stable trailer signature, and the visible trailer name from `#promo-video-title #trailer-name` (with the known title-root/child variant).
2. Require at least one visible, identifiable trailer and create an unbounded-item, runtime-bounded batch budget using existing defaults.
3. Focus `Xem ngay` through remote navigation and send remote `Enter`. Wait using `inspectPlaybackAfterWait`; when no healthy player is found, inspect the destination for a visible Album detail content list and classify that activation as `album_opened`. Capture and attach the post-activation player/Album-detail check screenshot for every result, matching the existing player-check flow's timing; store the report-ready data URL and attachment name alongside the required trailer name.
4. In a `finally` path, send remote `Backspace`, wait for Home, and wait for the promo state to change. Treat an unavailable/disabled next marker or a previously seen signature as the end of a finite/cycling carousel; fail if the state remains ambiguous or cannot safely return Home. A player screenshot-capture failure is an infrastructure failure, not a playable/not-playable result without evidence.
5. Attach a named Home-trailer JSON/HTML batch report containing every item and its post-activation screenshot, return `{results, budget, stopReason}`, and throw a details-bearing error if zero items or any item failed so the failing step still carries all accumulated results. Use a dedicated full-carousel runtime budget large enough for the known 16-trailer Home carousel while retaining repeat/end protection.

The helper will not call `element.click()` or accept selectors from the action payload.
**Invariants and compatibility:** The helper delegates player/detail return cleanup to the shared `playback.closePlayerOrDetail` implementation, supplying only the Home promo boundary and fixed exit-dialog observer. It ends on Home so the generic runner does not apply a second player cleanup.
**Tests affected:** New `tests/unit/home-trailers.test.js` covers two distinct trailers, automatic advance after Back, cycle/end detection, no-trailer failure, playback failure retention, and remote-only key sequencing.

### `tests/lib/playback.js`

**Action:** Modify
**Current role and evidence:** Shared player-health inspection and playback assertions in `inspectPlaybackAfterWait`, `getPlayerState`, and the legacy playback assertion helpers.
**Exact changes:** Add `observeExitConfirmation`, `observePlayerOrDetailState`, and `closePlayerOrDetail`. The close helper accepts an optional destination predicate, observes the boundary before and after each Back, sends no more than the required one or two close presses by default, and dismisses a recognized exit-confirmation dialog without counting that dismissal as a third close attempt. Unexpected fixed dialogs fail closed.
**Invariants and compatibility:** Existing player readiness, timeout, and failure-artifact behavior remain unchanged. The helper is Browser-side and uses the existing remote `Backspace` primitive; callers may supply a destination-specific predicate for Home or a content row.
**Tests affected:** New `tests/unit/playback.test.js` covers one-Back, two-Back, popup dismissal, and unsafe-modal behavior.

### `tests/lib/content-rows.js` and `tests/lib/mytv-helpers.legacy.js`

**Action:** Modify
**Current role and evidence:** Row playback return paths previously used fixed Back loops and a `backPresses`/`+4` allowance.
**Exact changes:** Delegate row return to `closePlayerOrDetail` with the focused-row predicate and a two-press maximum. The retained legacy copy uses the same shared helper rather than maintaining a separate close algorithm.
**Invariants and compatibility:** Row item focus restoration and batch/report behavior remain unchanged; only player/detail close navigation becomes adaptive.
**Tests affected:** `tests/unit/content-rows.test.js` proves the shared helper receives the row predicate and adaptive two-press default.

### `tests/lib/artifacts.js`

**Action:** Modify
**Current role and evidence:** `attachFirstRowPlaybackReport` and `renderPlaybackResultsHtml` provide row-specific batch evidence.
**Exact changes:** Add a generic playback batch report function accepting a safe filename prefix and heading; keep `attachFirstRowPlaybackReport` as a compatibility wrapper with its current filenames/heading. Use the generic function for Home-trailer reports and render the per-item post-activation screenshot for every trailer status, not only failure cells. Treat `album_opened` as a successful status in report styling.
**Invariants and compatibility:** Existing row report attachments and HTML escaping remain byte/behavior compatible except for shared internal rendering.
**Tests affected:** `tests/unit/artifacts.test.js` and the Home-trailer helper test.

### `app/test-report.js`

**Action:** Modify
**Current role and evidence:** Builds the local per-test report entry and renders the expandable Details rows in `test-report.html`; `collectFailedItems` currently intentionally keeps only failed batch items.
**Exact changes:** Extract the `play_home_trailers` step's full result list from either `step.result` (successful action) or `step.details` (an action that throws with accumulated details) into `homeTrailerItems`. Normalize each item to its trailer name, `playable`/`album_opened`/`failed` status, activation type, and post-activation screenshot data URL/attachment name. Render a Home-trailer table under the matching test ID for both passed and failed entries, preserving the existing failed-item and completion-screenshot sections for other actions.
**Invariants and compatibility:** Do not replace or broaden the existing failed-item projection; existing row/movie reports and report upsert behavior remain unchanged. Keep image sources restricted to the existing safe data-image/HTTPS policy and keep report data local to the user report.
**Tests affected:** `tests/unit/test-report.test.js`.

### `tests/unit/test-report.test.js`

**Action:** Modify
**Current role and evidence:** Unit tests cover compact entry construction, failed-item extraction, completion screenshots, and expandable Details rendering.
**Exact changes:** Add passing and failing `play_home_trailers` cases with two trailer results, assert `homeTrailerItems` preserves both names/statuses/player-check screenshots, and assert rendered Details contains both screenshot data URLs even when one trailer is failed. Cover accumulated results supplied through `step.details` as well as `step.result`.
**Invariants and compatibility:** The existing report shape and tests for failed row items, parser errors, and completion screenshots remain valid.
**Tests affected:** This file.

### `tests/lib/index.js`

**Action:** Modify
**Current role and evidence:** Helper facade re-exports navigation, content rows, playback, artifacts, and workflows for Browser action handlers.
**Exact changes:** Export the new Home-trailer API so `tests/lib/mytv-helpers.js` exposes `playAllHomeTrailers` without adding a second facade.
**Invariants and compatibility:** Preserve existing export names and internal helpers.
**Tests affected:** `tests/unit/test-case-action-runner.test.js` through the default helper injection.

### `tests/lib/test-case-action-runner.js`

**Action:** Modify
**Current role and evidence:** `createDefaultActionHandlers` dispatches validated Browser actions and forwards `playerCheckTimeoutSeconds` to playback handlers.
**Exact changes:** Add `play_home_trailers` dispatch to `helpers.playAllHomeTrailers`, passing `{waitSeconds: playerCheckTimeoutSeconds}` when configured. Delegate generic player and expected-result cleanup through `helpers.closePlayerOrDetail` when available, retaining the one-Back fallback only for injected compatibility doubles. Keep Home trailers out of the generic post-action player cleanup list because the helper owns each trailer's Back/Home lifecycle and returns Home.
**Invariants and compatibility:** Existing action ordering, step reporting, expected-result handling, cleanup delay, and failure attachment behavior remain unchanged; only the close navigation is adaptive.
**Tests affected:** `tests/unit/test-case-action-runner.test.js` for delegation, timeout forwarding, result propagation, and shared close cleanup.

### `tests/lib/target-action-runner.js`

**Action:** Modify
**Current role and evidence:** `ACTION_CAPABILITIES` and `validateTargetCaseCapabilities` gate actions before an LG session is created.
**Exact changes:** Add `play_home_trailers: ["browserHomeTrailers"]` so the current LG capability set rejects this Browser-only action before TV input. Include case/action context in the existing capability error path.
**Invariants and compatibility:** Do not add a fake LG semantic handler or allow fallback execution on a TV session.
**Tests affected:** `tests/unit/target-action-runner.test.js`.

### `tests/unit/test-case-schema.test.js`

**Action:** Modify
**Current role and evidence:** Schema contract tests cover allowlist, unknown fields, and parameter validation.
**Exact changes:** Add acceptance for the parameterless action and rejection of a count/selector field.
**Invariants and compatibility:** Existing negative security tests remain intact.
**Tests affected:** This file.

### `tests/unit/test-case-compiler.test.js`

**Action:** Modify
**Current role and evidence:** Fallback grammar tests cover playback forms, punctuation, and parser failures.
**Exact changes:** Add a table-driven test for `Chạy`, `phát`, and `Play` with `toàn bộ`, `tất cả`, and `các`, both `trailer` and common `trailler`, Home prepositions, and terminal punctuation. Add a near-miss that still fails with the original line.
**Invariants and compatibility:** No credentials or private fixture data are added.
**Tests affected:** This file.

### `tests/unit/test-case-action-runner.test.js`

**Action:** Modify
**Current role and evidence:** Browser default-handler and generic action-runner contract tests.
**Exact changes:** Add the helper stub to `createHandlerHelpers`, assert the new handler passes the configured player timeout and preserves the helper result, and cover the action in the default-handler availability path.
**Invariants and compatibility:** Existing helper stubs and ordered action tests remain valid.
**Tests affected:** This file.

### `tests/unit/home-trailers.test.js`

**Action:** Add
**Current role and evidence:** No direct Home-trailer state-machine unit coverage exists.
**Exact changes:** Use injected fake Home states and playback/navigation operations to prove the helper tests A then B, sends `Enter` and `Backspace` remotely, waits for the changed state, stops on end/cycle, attaches results, continues after a single playback failure, and fails when no trailer is available or identity cannot be established.
**Invariants and compatibility:** No browser, staging account, or real TV is used in the unit test.
**Tests affected:** New focused unit test.

### `tests/unit/artifacts.test.js`

**Action:** Modify
**Current role and evidence:** Artifact unit tests cover report HTML, screenshots, and failure rows.
**Exact changes:** Add the generic report prefix/title contract while asserting the existing first-row wrapper remains compatible.
**Invariants and compatibility:** HTML remains escaped and failure screenshots remain embedded as data URLs.
**Tests affected:** This file.

### `tests/unit/target-action-runner.test.js`

**Action:** Modify
**Current role and evidence:** Target admission tests prove capability failures happen before session input.
**Exact changes:** Add a Browser-only Home-trailer case and assert `ACTION_CAPABILITY_UNSUPPORTED` includes the case ID, action index, and `browserHomeTrailers` before any session call.
**Invariants and compatibility:** Existing supported/unsupported action coverage remains unchanged.
**Tests affected:** This file.

### `ACTION-COMPILER.md`

**Action:** Modify
**Current role and evidence:** Server-side grammar and action vocabulary guide.
**Exact changes:** Document the new Home-trailer grammar, output, remote lifecycle, termination/evidence rules, Browser-only boundary, and updated allowlist/field table.
**Invariants and compatibility:** Explicit `actions` remain authoritative; server-generated selectors/code are still forbidden.
**Tests affected:** Documentation reviewed during `git diff --check` and syntax/unit verification.

### `README.md`

**Action:** Modify
**Current role and evidence:** Project architecture and action vocabulary overview.
**Exact changes:** Add `play_home_trailers` to the action list and explain that it verifies every distinct Home promotional trailer and returns Home between player checks.
**Invariants and compatibility:** Keep the existing Browser/LG and fixture/cache boundaries accurate.
**Tests affected:** Documentation review.

### `AGENTS.md`

**Action:** Modify
**Current role and evidence:** Project operating instructions; currently has an unrelated user change adding AgentMemory/Graphify guidance.
**Exact changes:** Preserve the current user additions and append the new action to the test-case contract, including the Browser-only/LG admission boundary and remote-only trailer lifecycle.
**Invariants and compatibility:** Do not remove or reformat unrelated user instructions.
**Tests affected:** Documentation review; current diff must remain intact.

## Execution Sequence

### Step 1 — Add and document the action contract

**Objective:** Make `play_home_trailers` a validated, deterministic, documented Browser-only action.
**Files:** `tests/lib/test-case-schema.js`, `tests/lib/test-case-compiler.js`, `tests/lib/target-action-runner.js`, `tests/unit/test-case-schema.test.js`, `tests/unit/test-case-compiler.test.js`, `tests/unit/target-action-runner.test.js`, `ACTION-COMPILER.md`, `README.md`, `AGENTS.md`.
**Implementation details:** Add the parameterless allowlist entry, compiler grammar, LG capability gate, tests, and documentation described above.
**Dependencies:** None beyond the approved plan; preserve the existing `AGENTS.md` working-tree diff.
**Verification:** `node --test tests/unit/test-case-schema.test.js tests/unit/test-case-compiler.test.js tests/unit/target-action-runner.test.js`; expected result: all focused contracts pass and no unsupported action is accepted.
**Exit criteria:** The new action compiles/validates, Browser/LG scope is explicit, and focused contract tests pass.
**Approval gate:** Not required after plan approval; any scope expansion to LG requires a plan amendment.

### Step 2 — Implement the Home-trailer state machine and reports

**Objective:** Test every distinct Home trailer with bounded remote navigation and per-item evidence.
**Files:** `tests/lib/home-trailers.js`, `tests/lib/artifacts.js`, `tests/lib/index.js`, `app/test-report.js`, `tests/unit/home-trailers.test.js`, `tests/unit/artifacts.test.js`, `tests/unit/test-report.test.js`.
**Implementation details:** Add the fixed DOM state probe around `#promo-video-next` and the trusted trailer-title node, capture the player-check screenshot after every `Xem ngay` activation using the existing healthy/unhealthy player-check timing, preserve all item results through both the success and thrown-error paths, add the bounded remote-only play/back loop, update the backwards-compatible attachment report, and render all Home-trailer rows in the local user report.
**Dependencies:** Step 1 action name and existing player/budget/navigation primitives.
**Verification:** `node --test tests/unit/home-trailers.test.js tests/unit/artifacts.test.js tests/unit/test-report.test.js`; expected result: simulated A→B→cycle/end and failure paths produce the documented results without mouse calls, and the compact report renders every trailer name/status/screenshot.
**Exit criteria:** The helper has deterministic unit evidence for all lifecycle branches, returns Home after each attempted trailer, and preserves report-ready name/player-check-screenshot evidence for every finalized item.
**Approval gate:** Not required unless the live DOM requires a different selector or a manual next-button activation not covered by this plan.

### Step 3 — Wire Browser execution and result handling

**Objective:** Make the generic Browser case runner execute the new action with the configured timeout and result attachments.
**Files:** `tests/lib/test-case-action-runner.js`, `tests/unit/test-case-action-runner.test.js`.
**Implementation details:** Register the handler, pass the player timeout, preserve returned batch results, and keep generic post-action cleanup from issuing a duplicate Back.
**Dependencies:** Step 2 helper export.
**Verification:** `node --test tests/unit/test-case-action-runner.test.js tests/unit/test-report.test.js`; expected result: handler dispatch/timeout forwarding and the sidecar-to-report projection pass.
**Exit criteria:** A validated action reaches the helper through the normal `runStep` path and failed helper results retain case/action context.
**Approval gate:** Not required after the approved scope.

### Step 4 — Full verification and handoff

**Objective:** Verify the change against project checks and review the final diff for scope safety.
**Files:** All files from Steps 1–3; no additional files expected.
**Implementation details:** Run unit, syntax, action-list, and whitespace checks; inspect the final diff and confirm only the pre-existing `AGENTS.md` edit plus planned changes are present. A live staging Browser case is optional and remains a separate environment-dependent check because it uses credentials and external app state. Review the generated report contract specifically for a failed trailer: its Home-derived name and player-check screenshot must remain visible under the selected test ID.
**Dependencies:** Steps 1–3 complete.
**Verification:** `npm run test:unit`; `node --check tests/lib/home-trailers.js`; `node --check tests/lib/test-case-action-runner.js`; `node --check tests/lib/test-case-compiler.js`; `node --check app/test-report.js`; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git -c core.fsmonitor=false diff --check`; expected result: all pass, the generic spec lists successfully, and report unit coverage proves pass/fail trailer screenshots are retained.
**Exit criteria:** Every acceptance criterion has evidence, no unplanned file changes remain, and the plan's Completed Verification/Handoff sections are updated.
**Approval gate:** Required only for any failed check that needs an out-of-scope repair or for live staging execution requiring new external authority.

### Step 5 — Album-detail success and full-carousel coverage

**Objective:** Recognize a non-video Album detail destination as a successful
trailer activation and give the action enough bounded runtime to attempt all
trailers in the reported 16-item Home carousel without imposing a fixed count.
**Files:** `tests/lib/home-trailers.js`, `tests/lib/artifacts.js`, `app/test-report.js`, `tests/run-test-case-mytv.spec.js`, `tests/unit/home-trailers.test.js`, `tests/unit/artifacts.test.js`, `tests/unit/test-report.test.js`, `README.md`, `ACTION-COMPILER.md`, `AGENTS.md`.
**Implementation details:** Reuse the trusted visible-content-row observation
for ordinary Album-like lists and recognize the observed fixed `albumDetail`
route when it exposes a positive `Tổng số phim, VOD` count plus visible poster
images. Require the promo marker to be absent from the active destination, emit
`album_opened` with `activationType: "album_detail"`, and retain the
post-activation screenshot. Use a dedicated 10-minute
Home-trailer batch budget and matching generic-test timeout so the finite
16-item carousel is not cut off by the ordinary case timeout. Keep all
identity/end/cycle protections and make the report style both `playable` and
`album_opened` successful.
**Dependencies:** The approved current behavior that Album detail contains a
visible content list, and the user's reported count of 16 distinct Home
trailers; the live staging probe remains authoritative for the currently
available carousel identities.
**Verification:** Run focused and full unit tests, syntax/list/diff checks, then
repeat the authorized in-memory Browser probe with the extended budget. Expected
evidence is a result for every distinct trailer reached by the live carousel,
with a name and post-activation screenshot for each; a staging timeout or
environment failure remains a bounded failure with accumulated evidence.
**Exit criteria:** Album-detail activation is covered by unit/report tests,
the full-carousel timeout is explicit and bounded, documentation describes the
new success status, and live evidence states whether all 16 were reached.
**Approval gate:** Already authorized by the user's approval for the real test;
no additional scope is added beyond Album-detail classification and full
carousel coverage.

### Step 6 — Adaptive Home return and exit-popup safety correction

**Objective:** Prevent the Home-trailer helper from issuing an extra BACK after
the player or Album detail has already returned to Home, and safely handle the
exit-confirmation popup that can appear when Home is not treated as a stable
boundary.
**Files:** `tests/lib/home-trailers.js`, `tests/unit/home-trailers.test.js`,
this plan.
**Implementation details:** Add trusted Home-readiness and exit-confirmation
observers to the helper boundary. Send BACK one press at a time; after each
press, poll without pressing again until either safe Home is visible, an exit
confirmation is visible, or the bounded boundary wait expires. If an exit
confirmation is visible, send exactly one BACK to dismiss that popup, verify it
is gone while Home remains ready, and return without a third close press. Permit
the second BACK only when the first press did not reach Home. Preserve the
existing per-trailer screenshot/report flow and fail closed on an unexpected
popup or an unsafe return.
**Dependencies:** Existing trusted Home observer, fixed dialog roots, remote
`Backspace`, and the approved Browser-only Home-trailer helper.
**Verification:** Add unit coverage for one-BACK return, two-BACK return, and
exit-popup dismissal with no extra BACK; run the focused and full unit/syntax/
list/diff checks, then run an authorized bounded headed Browser probe.
**Exit criteria:** A player/Album-detail attempt cannot trigger a third BACK
after Home is ready; exit confirmation is explicitly dismissed and verified;
existing trailer result and screenshot coverage remains green.
**Approval gate:** Covered by the user's standing approval and the explicit
correction request; no new action or external result submission is added.

### Step 7 — Shared adaptive player/detail close helper

**Objective:** Make the one/two-BACK close lifecycle the default shared Browser
helper for every test flow that closes a player or detail destination, rather
than keeping it in Home-trailer code.
**Files:** `tests/lib/playback.js`, `tests/lib/home-trailers.js`,
`tests/lib/test-case-action-runner.js`, `tests/lib/content-rows.js`,
`tests/lib/mytv-helpers.legacy.js`, `tests/unit/playback.test.js`,
`tests/unit/content-rows.test.js`, `README.md`, `ACTION-COMPILER.md`,
`AGENTS.md`, and this plan.
**Implementation details:** Move the fixed-dialog exit observer and adaptive
close state machine into `playback.js`. The helper checks the destination
before pressing Back, polls after each close press, stops at the first safe
boundary, permits only a second close press when needed, and sends one separate
Back only to dismiss a recognized exit confirmation. Generic player cleanup,
expected-result cleanup, row playback, and the retained legacy row copy call
this helper. Home trailers pass their Home-promo readiness predicate and no
longer own the Back loop.
**Dependencies:** Existing remote navigation, Browser player state, fixed
dialog roots, Home readiness, and content-row focus predicates.
**Verification:** Run the focused playback/Home/action/content-row tests,
`npm run test:unit`, all changed-module syntax checks, the generic Playwright
test listing, `git -c core.fsmonitor=false diff --check`, and `graphify update .`.
The authorized Browser evidence from Step 6 remains the live evidence for
one-Back/two-Back Home behavior; this amendment adds shared-helper unit
coverage without changing the server result-submission path.
**Exit criteria:** All Browser close call sites use the shared helper or an
explicit compatibility fallback, the Home helper supplies only its boundary
predicate, no extra Back can be sent after a safe destination is observed, and
the full suite remains green.
**Approval gate:** Covered by the user's correction request and existing
approval; no new action or external result submission is added.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Parameterless action is accepted and unknown fields are rejected | Unit | `node --test tests/unit/test-case-schema.test.js` | New action passes; selector/count payload fails with the existing unknown-field error. |
| Wording variants compile to one action | Unit | `node --test tests/unit/test-case-compiler.test.js` | Vietnamese/English matrix returns `{action: "play_home_trailers"}`; near-miss retains original line in failure. |
| Browser-only boundary is enforced | Unit | `node --test tests/unit/target-action-runner.test.js` | LG capability admission fails before session input with `browserHomeTrailers`. |
| Carousel lifecycle tests all distinct trailers | Unit | `node --test tests/unit/home-trailers.test.js` | Fake state trace proves `Xem ngay` focus → Enter → playback → Back → changed Home state for each item. |
| Album detail counts as successful activation | Unit | `node --test tests/unit/home-trailers.test.js` | A no-video activation with visible Album content produces `album_opened` and retains its post-activation screenshot. |
| Failure evidence/reporting is preserved | Unit | `node --test tests/unit/home-trailers.test.js tests/unit/artifacts.test.js tests/unit/test-report.test.js` | Per-trailer JSON/HTML attachments and the local `test-report.html` Details row include every trailer's name, status, and player-check screenshot, including a failed player check, plus a budget/stop reason. |
| Full known Home carousel can be attempted | Static/live | Full generic timeout and dedicated Home-trailer budget checks; authorized staging probe | The helper is not cut off by the ordinary 120-second batch budget; the final live run reached 18 current distinct identities, covering the reported 16 without a fixed-count cap. |
| Browser handler dispatches and forwards timeout | Unit | `node --test tests/unit/test-case-action-runner.test.js` | `playAllHomeTrailers` receives the configured timeout and its result is retained in the action step. |
| Existing suite remains green | Regression/static | `npm run test:unit`; syntax checks; Playwright list; `git -c core.fsmonitor=false diff --check` | All unit tests pass, syntax/list checks pass, and no whitespace errors appear. |
| Real Home DOM behavior | Manual/live | Authorized Browser run against staging plus an in-memory new-action probe | The real Home DOM exposed the fixed next marker and hidden `#trailer-name` text; the corrected helper captured a player-check screenshot for every attempted trailer, and bounded failures remained authoritative. The selected case `2132` itself is unrelated to trailers and failed before playback because its requested row item 19 was unavailable. |
| Adaptive return does not over-press BACK | Unit/live | `node --test tests/unit/home-trailers.test.js`; authorized bounded Browser probe with Back/popup trace | One-BACK destinations return immediately, two-BACK destinations receive only the required second press, and an exit-confirmation popup is dismissed with one BACK without a third close press. |
| Shared close helper is the default Browser player/detail cleanup | Unit/static | `node --test tests/unit/playback.test.js tests/unit/content-rows.test.js tests/unit/test-case-action-runner.test.js`; source review of Browser close call sites | Generic player cleanup, expected-result cleanup, row playback, retained legacy row playback, and Home trailers all delegate to `playback.closePlayerOrDetail`; Home supplies only its boundary predicate. |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 focused contract checks | `node --test tests/unit/test-case-schema.test.js tests/unit/test-case-compiler.test.js tests/unit/target-action-runner.test.js` | Pass | 51 tests passed, 0 failed; action validation, wording matrix, original-line failure, and Browser-only capability admission covered. | 2026-08-03 09:39 +07:00 |
| Step 1 syntax/whitespace checks | `node --check tests/lib/test-case-schema.js`; `node --check tests/lib/test-case-compiler.js`; `node --check tests/lib/target-action-runner.js`; `git -c core.fsmonitor=false diff --check` | Pass | All syntax checks and whitespace validation passed. | 2026-08-03 09:39 +07:00 |
| Step 2 focused workflow/report checks | `node --test tests/unit/home-trailers.test.js tests/unit/artifacts.test.js tests/unit/test-report.test.js` | Pass | 18 tests passed, 0 failed; end/cycle detection, remote Enter/Back sequencing, trusted next-control fallback, Album-detail success, failed-player continuation, screenshots, and both result/report paths covered. | 2026-08-03 12:18 +07:00 |
| Step 2 syntax checks | `node --check tests/lib/home-trailers.js`; `node --check tests/lib/artifacts.js`; `node --check app/test-report.js` | Pass | All three files parsed successfully. | 2026-08-03 09:44 +07:00 |
| Step 3 Browser handler checks | `node --test tests/unit/test-case-action-runner.test.js`; `node --check tests/lib/test-case-action-runner.js`; `node --check tests/unit/test-case-action-runner.test.js` | Pass | 45 tests passed, 0 failed; handler registration, timeout forwarding, and result preservation covered. | 2026-08-03 09:49 +07:00 |
| Hidden promo-title live diagnostic | Authorized real Browser diagnostic on `https://html5stage.mytv.vn/` | Pass after repair | `#promo-video-next` was visible; `#promo-video-title` was visible; the required nested `#trailer-name` contained the current trailer name while `display:none`. The observer now reads that trusted text when its visible title container is present. | 2026-08-03 10:07 +07:00 |
| Corrected all-trailer live probe | Authorized in-memory `play_home_trailers` run against staging using the cached trailer account; no server result submission | Bounded failure with evidence | Six real trailers were attempted: five `playable`, one `failed`; all six had a player-check screenshot data URL and attachment name. The action failed with `runtime-budget` instead of claiming that the carousel was complete. A second extended-budget probe attempted four trailers before a transient `home-return-failed` timeout; all four retained screenshots. | 2026-08-03 10:11–10:27 +07:00 |
| Album-detail DOM diagnostic | Authorized bounded staging diagnostic on the real non-player trailer | Pass after repair | `Chùm hành động mãn nhãn` opened `#albumDetail`; the screen exposed `Tổng số phim, VOD: 10` and 10 visible poster images. The generic row collector returned zero for that layout, so the trusted route/count/image observer was added. | 2026-08-03 11:35 +07:00 |
| Album-detail classification confirmation | Authorized bounded six-trailer staging run with injected observer | Pass after repair | The live observer returned `ok: true`, `kind: album_detail`, `routeValue: albumDetail`, `albumCount: 10`, and `visibleImageCount: 10`; the final full run then emitted `album_opened` with an `album-detail-check` screenshot. | 2026-08-03 11:49 +07:00 |
| Final full Home-trailer live run | Authorized headed in-memory Browser run using the cached trailer-test account; no server result submission | Pass | 18 distinct trailer identities were reached and all 18 had a name, status, and screenshot. 17 were `playable`; `Chùm hành động mãn nhãn` was `album_opened`. This covers the user's reported 16 and indicates the current staging carousel exposed 18. | 2026-08-03 12:15 +07:00 |
| Authorized case `2132` | Electron runner UI, fresh folder-6 API load, Browser target | Failed in the case under test | Current server case `2132` is `tét item cuoi`, an unrelated Thịnh hành poster-19 case. The real row exposed only 18 reachable items, so it failed before playback. Final flow-case result submission returned HTTP 403; local case sidecar and user report were written. | 2026-08-03 09:58 +07:00 |
| Adaptive return unit checks | `node --test tests/unit/home-trailers.test.js` | Pass | 10 tests passed, 0 failed; fixed dialog-root detection, one-BACK return, conditional two-BACK return, exit-popup dismissal, and no-extra-close-press sequencing are covered. | 2026-08-03 11:51 +07:00 |
| Authorized adaptive return Browser probe | In-memory `play_home_trailers` runs against the authenticated staging Home; no server result submission | Pass | One real player destination required two BACK presses and returned to `homeNewUI`; a second real player destination required one BACK and returned to `homeNewUI` with the next trailer visible. Both attempts were `playable` and each retained its player-check screenshot. No exit popup appeared during either helper-controlled return. | 2026-08-03 11:52–11:54 +07:00 |
| Shared close-helper focused checks | `node --test tests/unit/playback.test.js tests/unit/content-rows.test.js tests/unit/test-case-action-runner.test.js` | Pass | Shared helper tests prove one Back, conditional two Back, exit-popup dismissal, unsafe-modal failure, row predicate delegation, and generic cleanup delegation; all focused tests passed. | 2026-08-03 12:23 +07:00 |
| Full regression/static checks | `npm run test:unit`; all requested `node --check` commands; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git -c core.fsmonitor=false diff --check` | Pass | 586 unit tests passed, 0 failed, 0 skipped; changed runtime/test modules parsed successfully; one generic Playwright test listed; diff check passed. | 2026-08-03 12:24 +07:00 |

## Deviations and Plan Updates

- The first live observer attempt treated the real page's hidden `#trailer-name`
  anchor as unavailable even though its visible `#promo-video-title` container
  held the current name. The helper was repaired in scope and a regression unit
  test now covers that DOM variant.
- Case `2132` is not the new Home-trailer case in the current API folder. It
  failed on its own row-index precondition, and the runner's API result PATCH
  returned HTTP 403. No server case data was rewritten or fabricated.
- The default existing 120-second batch budget stopped the corrected live
  trailer probe after six attempts; this is an intentional authoritative
  failure, not a false pass. The extended probe also encountered a transient
  Home-return timeout. Unit coverage proves end/cycle termination and all
  player-check evidence paths.
- The live staging carousel exposed 18 distinct identities rather than the
  user's reported 16. The helper intentionally has no fixed count; it tested
  all 18 until the carousel's end/cycle condition, so the run covers at least
  the reported 16 without truncating two currently available trailers.
- The staging carousel sometimes remained on the same Home trailer after
  Back. The helper now waits 30 seconds, then uses remote focus/Enter on the
  trusted `promo-video-next` control as a bounded fallback; the final run
  passed with all 18 identities.
- `graphify update .` was attempted after the code changes but the local
  Graphify watcher failed with `Operation not permitted`; no source changes
  were made to work around that environment limitation.
- The requested scope amendment moved adaptive player/detail closing into the
  shared playback module. Home trailers now provide only their Home boundary;
  generic player cleanup, expected-result cleanup, row playback, and the
  retained legacy row copy use the same helper. The explicit `press_back` action
  remains a literal requested remote action and was not silently reinterpreted.
- The cleanup correction was implemented after the user observed that a fixed
  second Back could open Home's exit confirmation. The helper now proves the
  actual Home promo boundary after each Back and only sends the second close
  press when the first destination is not Home. The fixed dialog observer and
  popup-dismissal branch are covered by unit tests; the authorized live probes
  exercised both one-Back and two-Back player destinations without triggering
  an exit popup.

## Handoff and Completion

- Changed files: The planned schema/compiler/action-runner/helper/report/
  documentation/test files, the shared adaptive player/detail close helper and
  its Browser call sites, plus this plan; the pre-existing user edit in
  `AGENTS.md` was preserved.
- Checks passed: 586 unit tests; focused shared-close tests; syntax checks for
  all changed runtime/test modules; generic Playwright test listing;
  `git diff --check`.
- Live evidence: The final corrected helper recognized the staging Home promo
  DOM, classified the real Album detail trailer as `album_opened`, and retained
  name plus post-activation screenshot evidence for all 18 attempted trailers.
  The safety correction also returned from one real player with two Back
  presses and another with one Back press, stopping at the first safe Home
  boundary in each case. The shared helper now carries that same behavior for
  generic Browser player cleanup and row playback.
  The requested case `2132` was run exactly as loaded earlier; it remains an
  unrelated row-index case whose result submission returned HTTP 403.
- Known limitations: The new action is Browser-only. It stops only at the
  carousel's end/cycle or a bounded navigation/runtime failure, and reports all
  accumulated trailer evidence in those failure paths. The current staging
  carousel exposed 18 identities, so the server/user-reported count should be
  reconciled if exactly 16 is an external acceptance number.
- Follow-up work: A separate approved plan would be required for LG semantic
  trailer support or a server-side case update that assigns the new action to a
  current test ID.
- Final acceptance status: Complete.
