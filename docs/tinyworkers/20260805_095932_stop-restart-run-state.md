# Stop/restart test-case run state

**Plan ID:** 20260805_stop_restart_run_state
**Status:** Complete
**Approval:** Approved by user on 2026-08-05
**Created:** 2026-08-05 09:59:32 +0700
**Updated:** 2026-08-05 10:09:17 +0700
**Owner:** Tiny-Planner / Tiny-PM
**Risk:** Low
**Branch/worktree:** `fix/stop-process` / `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright`

## Status

- [x] Step 1: Make renderer stop handling source-aware so a main-originated stop request is not echoed back through IPC. **Complete**
- [x] Step 2: Add renderer regression coverage for stop-event handling and a subsequent fresh run. **Complete**
- [x] Step 3: Run focused and project verification, review the diff, and refresh Graphify. **Complete**

## Goal

### Problem

In the desktop GUI, stopping a running case can leave later runs showing the
case as `Skipped`. The current stop flow has two directions that can feed back
into each other: the renderer's Stop button invokes `stop-test`, while main
process `stopActiveTest()` sends `request-stop-run`; the renderer handles that
event by invoking `stop-test` again.

### Desired outcome

After a user stops a Browser or LG batch, starting the same or another selected
case creates a fresh run and lets its first selected case enter normal running
state. The current batch's queued cases must retain their existing skipped
behavior after a stop.

### Acceptance criteria

- [ ] A user-initiated Stop sends one stop request to the main process and does not create an IPC feedback loop.
- [ ] A main-originated `request-stop-run` (for example, the close-controller path) stops the renderer-side batch without sending the stop request back to main.
- [ ] After a stopped batch, a later run of the same or a different selected case is not marked skipped solely because of the earlier stop.
- [ ] Queued cases in the batch that was actually stopped remain skipped, and existing result-submission rules remain unchanged.
- [ ] Existing Browser and LG run-state behavior, including close-time stopping and idempotent process/device cleanup, remains intact.

### Non-goals

- Do not change case selection, case-status wording, result-submission payloads, or the definition of a queued case being skipped.
- Do not change Playwright process termination, LG batch recovery, or application close confirmation behavior beyond preventing the stop-event echo.
- Do not add live staging credentials, alter API contracts, or change the test-case action runner.

## Current State and Findings

- `app/renderer/renderer.js` stores the active batch in `batchState`; each `runSelectedCases()` call creates a new `{ids, activeCaseId: null, stopRequested: false}` object, and the loop skips an ID only when that current object's `stopRequested` is true (`runSelectedCases`, around lines 2267–2299).
- The renderer's `requestStop()` sets `batchState.stopRequested`, calls `api.stopTest()`, and resolves the active Browser completion (`app/renderer/renderer.js:2582–2595`).
- The renderer subscribes to main's `request-stop-run` event and calls the same `requestStop()` path (`app/renderer/renderer.js:2764–2766`).
- Main's `stopActiveTest()` kills the Browser child / requests LG stop, then always sends `request-stop-run` (`app/main.js:130–139`). The `stop-test` IPC handler calls that helper (`app/main.js:956–959`). Therefore a renderer Stop request can be echoed back into the renderer, which calls `stop-test` again and can continue emitting stop events while the renderer still has a batch state.
- No persistent skipped flag is stored between `runSelectedCases()` calls; the next-run symptom is therefore consistent with a stale or repeated main-originated stop event being applied after the new batch starts. This is an inference from the code path and must be covered by the regression test.
- The existing renderer tests cover queued cases being skipped and partial result submission after a manual stop (`tests/unit/renderer.test.js` around the tests named `stopping a batch prevents queued cases from starting` and `does not submit partial downloaded results after a batch is stopped`), but do not cover the main-to-renderer stop event boundary or a restart after that event.
- Baseline worktree: `git status --short --branch` reported `## fix/stop-process...origin/fix/stop-process` with no changed files.
- Baseline focused checks: `node --test tests/unit/run-close-guard.test.js` passed all 3 tests. `node --test tests/unit/renderer.test.js` passed 89 tests and failed 1 pre-existing markup assertion because the fixture expects `<label for="campaign-select">Chiến dịch</label>` while the current markup contains `Campaigns`; the same failure causes `npm run test:unit` to exit 1. No stop-flow failure was reported by the baseline tests.
- Live GUI reproduction was not run because it requires the configured target environment and test credentials; static tracing and unit regression coverage are the available baseline evidence.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Separate user-originated and main-originated stop requests at the renderer boundary | Make main suppress its `request-stop-run` echo for renderer IPC; reset batch state more aggressively after stopping | Add an optional source flag to renderer `requestStop()`; the Stop button uses the default main notification, while `onStopRequested` calls it with main notification disabled | Keeps the existing main close-controller notification contract, changes only the feedback boundary, and prevents a main-originated event from invoking the same IPC in reverse | `requestStop()` gains a small internal option and both Browser and LG renderer stop flows share the safe behavior |
| Regression scope | Test only the final skipped count; add an end-to-end GUI test requiring a live target | Extend the lightweight renderer fixture to capture `onStopRequested`, assert the external event does not call `stopTest`, and run a second case after the stopped run | Directly tests the causal IPC boundary and the user-visible restart contract without credentials or a live TV target | The live GUI scenario remains a manual follow-up when a configured environment is available |

## Assumptions, Constraints, and Dependencies

- Assumption: `request-stop-run` is a main-to-renderer notification used by the close-controller path; a renderer-originated Stop already knows it requested the main stop and does not need the notification echoed back.
- Constraint: Preserve the current `batchState.stopRequested` behavior for the active batch and preserve all existing result-submission filtering.
- Constraint: Follow the project rule that TV interaction, if manually validated later, uses the TV app's remote-control and virtual-keyboard helpers.
- Dependency: The existing renderer unit-test fixture and Node test runner remain the verification harness.
- Dependency: A configured Browser/LG target and valid test account are required for optional manual GUI reproduction.
- Unresolved material questions: None.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| A close-controller stop notification no longer reaches the active renderer batch | The app could close while the child/device run continues | Keep the main-originated event path active; only suppress the renderer's reverse IPC call, and test the external event directly | Revert the renderer change and its regression test; the existing main stop helper remains unchanged |
| Browser and LG stop flows need different completion handling | One target could remain marked running or fail to finish | Preserve the existing completion resolution and `batchState` mutation; change only whether `api.stopTest()` is called for a main-originated event | Revert the focused renderer change if target-specific tests expose a mismatch |
| Existing baseline markup failure obscures full-suite status | Full unit verification cannot be reported green | Run focused renderer assertions and record the pre-existing failure separately; do not modify unrelated markup in this plan | Leave the unrelated fixture/markup mismatch for a separate approved task |

## File Impact and Detailed Changes

### `app/renderer/renderer.js`

**Action:** Modify

**Current role and evidence:** Owns renderer batch state, the Stop button, and
the `onStopRequested` main-process event subscription (`requestStop()` and the
event registration around lines 2582 and 2764).

**Exact changes:**

- Change the internal `requestStop()` signature to accept a source/notification
  option that defaults to the current renderer-originated behavior.
- Keep setting `batchState.stopRequested`, resolving the active Browser
  completion, and updating the no-batch status exactly as today.
- Call `api.stopTest()` only for the user-originated path; call
  `requestStop({notifyMain: false})` from `api.onStopRequested` so a main event
  is consumed locally without echoing `stop-test` back to main.

**Invariants and compatibility:** Main's `stopActiveTest()` and its
`request-stop-run` event remain unchanged; queued cases in the current batch
still render `skipped`; the LG batch still uses the existing `requestStop()`
flag and main runner request; no renderer receives connection or credential
data.

**Tests affected:** `tests/unit/renderer.test.js` adds a captured stop-event
callback and restart/feedback-loop regression coverage.

### `tests/unit/renderer.test.js`

**Action:** Modify

**Current role and evidence:** Lightweight renderer contract tests already cover
manual stop behavior and queued-case skipping, but the fixture currently does
not expose `onStopRequested` and therefore cannot model main's stop event.

**Exact changes:**

- Store the callback supplied to `runner.onStopRequested()` in the fixture.
- Add a test that starts a selected case, delivers a main-originated
  `request-stop-run`, and verifies the renderer stops the active batch without
  invoking `runner.stopTest()` again.
- In the same or a focused companion test, start a new run after the stopped
  run, complete its case normally, and assert it is counted as completed rather
  than skipped. Retain the existing test that queued cases from the stopped
  batch are skipped.

**Invariants and compatibility:** Tests must use the existing mock runner and
must not require a real Browser, Electron process, TV, credentials, or API.

### `docs/tinyworkers/20260805_095932_stop-restart-run-state.md`

**Action:** Add

**Current role and evidence:** Durable Tiny-Workers plan and execution source of
truth for this multi-file fix.

**Exact changes:** Track approval, milestone status, actual verification,
deviations, and final handoff evidence as the work proceeds.

## Execution Sequence

### Step 1 — Make stop-event handling source-aware

**Objective:** Break the renderer/main stop IPC feedback loop without changing
the main process stop helper or active-batch skip semantics.

**Files:** `app/renderer/renderer.js`

**Implementation details:** Add the internal notification option described in
the file-impact section; keep the default for the Stop button and disable only
the reverse IPC call when consuming `request-stop-run`.

**Dependencies:** Approved plan; no external dependency.

**Verification:** `node --check app/renderer/renderer.js`; expected result: exit
0. The focused renderer regression in Step 2 must also pass.

**Exit criteria:** A main-originated stop event resolves/stops the renderer
batch without invoking `api.stopTest()`, while the user Stop button still
invokes it once.

**Approval gate:** Required before implementation.

### Step 2 — Add stop/restart regression coverage

**Objective:** Lock the causal fix and the user-visible restart behavior.

**Files:** `tests/unit/renderer.test.js`

**Implementation details:** Extend the fixture's event hooks and add tests for
the externally requested stop, one-way IPC behavior, and a fresh subsequent run.

**Dependencies:** Step 1.

**Verification:** `node --test tests/unit/renderer.test.js`; expected result:
the new stop/restart tests and all currently passing renderer tests pass. The
known campaign-label assertion may remain the pre-existing single failure and
must be recorded separately unless it is independently fixed under an
approved scope.

**Exit criteria:** The regression fails against the old feedback behavior and
passes with the source-aware stop implementation; queued-case skip coverage
continues to pass.

**Approval gate:** Not required within the approved scope.

### Step 3 — Complete verification and handoff

**Objective:** Validate syntax, unit contracts, diff hygiene, and the knowledge
graph, then record evidence.

**Files:** Plan document only for status/evidence updates; Graphify output may
be refreshed by its prescribed update command.

**Implementation details:** Run the project-required checks proportionate to
the change: `npm run test:unit`, `node --check app/main.js`,
`node --check app/preload.js`, `node --check app/renderer/renderer.js`,
`npx playwright test tests/run-test-case-mytv.spec.js --list`, `git diff --check`,
and `graphify update .` after code changes. Classify the known markup failure
as pre-existing if it remains unchanged.

**Dependencies:** Steps 1–2.

**Verification:** Record actual command results in `Completed Verification`;
expected result: changed files pass syntax and focused tests, no diff
whitespace errors, the generic Playwright spec lists successfully, and
Graphify is current.

**Exit criteria:** Every acceptance criterion has evidence, the final diff has
no unrelated changes, and the plan is ready for Tiny-PM handoff.

**Approval gate:** Not required within the approved scope.

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| User Stop does not create an IPC loop | Unit | `node --test tests/unit/renderer.test.js` with the stop-event regression | Renderer-originated Stop calls `stopTest` once; the echoed main event does not call it again |
| Main-originated stop is consumed locally | Unit | Renderer fixture invokes captured `onStopRequested` callback | Active batch stops and the mock `stopTest` call count remains unchanged |
| A later run is not skipped | Unit | Renderer regression starts a second run after the stopped run | Second run reaches `running` and completes; `skipped` is 0 |
| Queued cases remain skipped | Regression | Existing `stopping a batch prevents queued cases from starting` test | Current-batch queued case remains skipped |
| Syntax and test entry points remain valid | Static | `node --check app/renderer/renderer.js`, `node --check app/main.js`, `node --check app/preload.js`, `npx playwright test tests/run-test-case-mytv.spec.js --list` | All commands exit 0 |
| Diff and graph remain healthy | Static/project | `git diff --check`, `graphify update .` | No whitespace errors; graph update completes |
| Optional user-level confirmation | Manual, environment-dependent | Run any GUI case, click Stop, then run the same/different case | The second case runs normally instead of showing Skipped |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Step 1 — source-aware stop handling | `node --check app/renderer/renderer.js` | Pass | Renderer syntax is valid; `requestStop({notifyMain: false})` consumes main-originated stop events without echoing `stop-test`. | 2026-08-05 10:04:00 +0700 |
| Step 2 — stop/restart regression | `node --test --test-name-pattern="does not echo a main stop event" tests/unit/renderer.test.js` | Pass | The new regression passed: one stop IPC call, the echoed main event did not recurse, and the next run completed with zero skipped cases. | 2026-08-05 10:05:45 +0700 |
| Renderer suite | `node --test tests/unit/renderer.test.js` | Fail (pre-existing) | 90 tests passed, including the new regression; the existing `index markup contains the case browser and no API-key or mode controls` assertion still fails because it expects the Vietnamese `Chiến dịch` label while markup says `Campaigns`. | 2026-08-05 10:05:45 +0700 |
| Test syntax and diff hygiene | `node --check tests/unit/renderer.test.js`; `git diff --check` | Pass | Test file parses and no whitespace errors were reported. | 2026-08-05 10:05:45 +0700 |
| Project syntax | `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js`; `node --check tests/unit/renderer.test.js` | Pass | All changed/runtime JavaScript entry points parse successfully. | 2026-08-05 10:07:58 +0700 |
| Generic Playwright entry point | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | One generic server-driven test listed successfully. | 2026-08-05 10:07:58 +0700 |
| Full unit suite | `npm run test:unit`; repeated with `node --test --test-reporter=dot tests/unit/*.test.js` | Fail (pre-existing) | The new stop/restart regression and all other checks pass; the repeatable remaining failure is the unrelated `Campaigns` versus `Chiến dịch` markup assertion. One earlier full run also showed a timing-sensitive `durationMs: 1` versus `0` assertion; its focused file rerun passed and the subsequent full run reproduced only the markup failure. | 2026-08-05 10:07:58 +0700 |
| Graphify refresh | `graphify update .` | Pass with warning | Rebuilt `graphify-out` with 2,770 nodes, 4,351 edges, and 168 communities. Graphify warned that `hooks.json`, `settings.json`, `DEVICE-COMPATIBILITY.json`, `toolchain.json`, and `testcased.json` produced zero nodes and will be retried on a later update. | 2026-08-05 10:07:58 +0700 |
| Final diff review | `git diff --check`; reviewed `app/renderer/renderer.js` and `tests/unit/renderer.test.js` | Pass | The implementation is limited to source-aware stop handling and its renderer regression fixture/test; no unrelated code changes were found. | 2026-08-05 10:07:58 +0700 |

## Deviations and Plan Updates

- 2026-08-05, Step 3: The first sandboxed `graphify update .` attempt returned `Operation not permitted`; the prescribed command succeeded after a narrowly scoped permission escalation. Graphify output was refreshed without changing implementation scope.
- 2026-08-05, Step 3: A timing-sensitive unrelated `durationMs` assertion appeared once during the full suite; the focused `tests/unit/test-case-action-runner.test.js` rerun passed, and the next full run left only the pre-existing campaign-label assertion.

## Handoff and Completion

- Changed files: `app/renderer/renderer.js`, `tests/unit/renderer.test.js`, this plan, and refreshed Graphify outputs under `graphify-out/`.
- Checks passed: Stop/restart regression, renderer syntax, project syntax, Playwright test listing, diff hygiene, and Graphify refresh.
- Known limitations: The full unit suite retains one unrelated campaign-label markup failure; live GUI reproduction needs a configured target and credentials. Graphify reported five zero-node data files for retry on a later update.
- Follow-up work: None identified within scope.
- Final acceptance status: Complete for the approved stop/restart scope.
