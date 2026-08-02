# Focus Row Off-Viewport Item Index

**Plan ID:** TW-20260802-focus-row-offscreen-index
**Status:** Complete
**Approval:** Approved by user on 2026-08-02
**Created:** 2026-08-02 22:46:14 +0700
**Updated:** 2026-08-02 22:59:00 +0700
**Owner:** Tiny-Planner
**Risk:** Medium
**Branch/worktree:** `/Users/thainguyen/Documents/Works/MyTV/auto-test-playwright` on `fix/find-item-index`

## Status

- [x] Step 1: Replace visible-array indexing with bounded remote carousel navigation.
- [x] Step 2: Add regression coverage for an item index beyond the viewport and an exhausted row.
- [x] Step 3: Update the action contract documentation and run verification.

## Goal

### Problem

`focus_row` currently treats the viewport-visible poster list as the complete
row. On a horizontally virtualized carousel, only about five posters are in
the DOM even when the row contains many more. A request such as case `2132`
(`rowName: "Thịnh hành"`, poster `itemIndex: 19`) therefore fails before any
remote navigation with a misleading visible-item-count error.

### Desired outcome

`focus_row` interprets `itemIndex` as a positive 1-based position in the whole
reachable row. It uses TV remote navigation to expose and focus an off-viewport
poster, while still failing clearly when the row ends before the requested
position.

### Acceptance criteria

- [ ] A named `focus_row` with `itemIndex` greater than the number of currently
      visible posters sends horizontal remote navigation and can focus the
      requested reachable item.
- [ ] The index remains 1-based and absolute from the row's left/start position;
      omitted `itemIndex` keeps the existing first-item behavior.
- [ ] A row that stops before the requested index fails with the row name,
      requested index, and the furthest reachable position, rather than claiming
      that the viewport count is the complete row.
- [ ] The special Home `Thể loại` focus path continues to support service-row
      scanning and does not depend on stale pre-scroll poster IDs.
- [ ] Existing action validation, compiler behavior, and action-handler
      forwarding remain unchanged.

### Non-goals

- Do not change the server-side action grammar, schema allowlist, or case
  selection/cache behavior.
- Do not add selectors, DOM scrolling, mouse interaction, JavaScript evaluation
  of server data, or a new playback workflow.
- Do not modify the legacy helper implementation unless verification proves the
  generic `focus_row` path still calls it.
- Do not alter the row playback batch-budget behavior.

## Current State and Findings

- `focusRequestedContentRow()` normalizes `itemIndex` but immediately indexes
  `row.items[requestedItemIndex - 1]` in its local `focusRowItem()` helper —
  evidence: `tests/lib/content-rows.js:38-107`.
- `collectVisibleContentRows()` obtains candidates from visible geometry and
  returns only the current viewport window, then caps the deduplicated list at
  30 — evidence: `tests/lib/content-rows.js:418-515` and
  `tests/lib/dom-scan.js:82-128`.
- `focusFirstRowStart()` can focus a visible anchor through existing remote
  navigation, while `remotePress()` invalidates the DOM snapshot cache after
  each key — evidence: `tests/lib/content-rows.js:535-555` and
  `tests/lib/navigation.js:14-18`.
- The remote-navigation primitive already supports repeated directional key
  presses and bounded attempts — evidence: `tests/lib/navigation.js:251-334`.
- The action runner already passes `itemIndex` to the helper — evidence:
  `tests/lib/test-case-action-runner.js:486-492`; schema and compiler coverage
  already validate/emit the positive 1-based field — evidence:
  `tests/lib/test-case-schema.js:80-89` and `tests/lib/test-case-compiler.js:120-153`.
- The current documentation promises direct focusing only when the requested
  poster is visible — evidence: `AGENTS.md:172`, `README.md:189-191`, and
  `ACTION-COMPILER.md:229-232`; this will become stale after the fix.
- Baseline: `npm run test:unit` — 562 tests passed, 0 failed, 0 skipped;
  no pre-existing test failures observed.
- Worktree: `git -c core.fsmonitor=false status --short --branch` — clean on
  `fix/find-item-index`.

## Findings and Decisions

| Decision | Alternatives considered | Chosen approach | Reason | Consequence |
| --- | --- | --- | --- | --- |
| Reach an off-viewport item through the TV focus model | Treat the visible DOM list as complete; use DOM `scrollIntoView`; use mouse/locator interaction | Focus a visible row anchor, move to the row start with remote Left navigation as needed, then issue one remote Right press per 1-based index step | Preserves the TV app's real focus/virtualized-carousel behavior and satisfies the project keyboard-only rule | The helper must observe focus progress and bound navigation so a short row fails safely |
| Verify after horizontal virtualization | Compare only the original `row.items` IDs; re-scan after each key; rely only on a fixed delay | Invalidate the snapshot through `remotePress`, observe the focused content signature/row geometry after each move, and refresh the visible row for final verification | Original IDs can leave the DOM when the carousel window advances; current focus is the authoritative target | Test doubles need to model changing focused items and a stuck row |
| Preserve existing default focus behavior | Route every call through new indexed navigation; add a separate action | Use the new navigation only when `itemIndex` is supplied or greater than one; retain the first visible anchor path for the default case | Minimizes regression risk for existing `focus_row` and `play_row` callers | Documentation must distinguish default first-item focus from indexed navigation |

## Assumptions, Constraints, and Dependencies

- Assumption: `itemIndex` is an absolute 1-based poster position from the
  left/start of the selected row, matching the compiler guide examples.
- Constraint: all TV movement must use `ArrowLeft`/`ArrowRight` through the
  existing `remotePress` dependency; no standard form input, mouse control, or
  DOM-driven scrolling.
- Constraint: the shared Browser/LG helper facade must remain target-neutral;
  the same action logic must work with browser and Appium-backed remote keys.
- Dependency: the MyTV carousel must expose focus progress through the existing
  focused element/state after each remote key.
- Unresolved material questions: None.

## Risks and Rollback

| Risk | Impact | Mitigation | Rollback or recovery |
| --- | --- | --- | --- |
| A horizontal key leaves the content row at its boundary | Focus can move to the side menu or another row | Check focused content/row geometry after each move, stop at the boundary, and restore/verify the row anchor before continuing | Revert the helper and test/doc changes from this plan; existing visible-item behavior remains available |
| The carousel reuses poster DOM nodes while changing metadata | ID-only progress checks can falsely report no movement or success | Compare the existing content signature (ID, title, poster) and refresh visible rows after navigation | Revert to the prior helper if live staging shows a renderer-specific focus contract that needs a separate adapter |
| Large requested indexes make a run slow | Case execution may spend time on many remote presses | Use one bounded key press per requested index step, retain existing pacing, and fail on no-progress rather than looping indefinitely | Stop the selected run; no persistent app or account state is changed by focus-only navigation |

## File Impact and Detailed Changes

### `tests/lib/content-rows.js`

**Action:** Modify
**Current role and evidence:** Shared content-row discovery and focus helper;
`focusRequestedContentRow()` currently indexes only `row.items` from the
viewport (`:38-107`).
**Exact changes:** Replace the local visible-array lookup for an indexed focus
with a helper that focuses a visible row anchor, reaches the row's left/start
boundary using remote Left keys where necessary, then advances with remote Right
keys until the requested 1-based position is reached. After each move, observe
focused content progress and verify the focus remains on the target row. If a
key makes no progress or leaves the row before the requested position, throw a
descriptive error containing the row label, requested index, and furthest
reachable position. Refresh the visible row before returning so downstream
service-row checks do not use stale pre-scroll IDs. Keep the no-index path and
existing `Thể loại` service focus semantics intact.
**Invariants and compatibility:** Use only existing `remotePress`, focus
observers, and snapshot-cache invalidation. Keep row-name matching, lazy-loaded
vertical row scanning, row return shape, and default first-item focus unchanged.
**Tests affected:** Add focused unit coverage in
`tests/unit/content-rows.test.js`.

### `tests/unit/content-rows.test.js`

**Action:** Modify
**Current role and evidence:** Pure Node contracts for content-row navigation;
current tests cover the reachable Home `Thể loại` service carousel but no
generic off-viewport indexed row (`:6-139`).
**Exact changes:** Add a regression test with a named row exposing five visible
items at a time and a requested index beyond that window (at least index 7 or
19). Model remote Right presses as revealing the next focused item and assert
that the helper sends the required key count and completes without using a
visible-array index. Add a negative test where the mocked row stops advancing
and assert the descriptive row/index/reached-position failure. Preserve the
existing category-service tests.
**Invariants and compatibility:** Tests remain deterministic and do not connect
to staging or a real TV.
**Tests affected:** `node --test tests/unit/content-rows.test.js` and the full
  `npm run test:unit` suite.

### `AGENTS.md`

**Action:** Modify
**Current role and evidence:** Project contract and maintenance instructions;
the action list currently says `itemIndex` focuses only a visible item
(`:172`).
**Exact changes:** State that a positive `itemIndex` is an absolute 1-based
position and the helper uses remote carousel navigation to reach off-viewport
items, failing only when the row cannot expose that position.
**Invariants and compatibility:** Keep the keyboard-only, target-neutral,
  no-server-code constraints.
**Tests affected:** Documentation consistency checked during review.

### `README.md`

**Action:** Modify
**Current role and evidence:** User-facing action contract; the numbered poster
description currently documents only the field shape (`:189-191`).
**Exact changes:** Clarify that indexed focus can scroll a reachable carousel
through remote navigation and is not limited to posters currently visible in the
viewport.
**Invariants and compatibility:** Preserve the examples and all other action
descriptions.
**Tests affected:** Documentation consistency checked during review.

### `ACTION-COMPILER.md`

**Action:** Modify
**Current role and evidence:** Server-side action compilation contract; it says
  `itemIndex` must be visible and fails using the visible count (`:229-232`).
**Exact changes:** Update the runtime semantics to describe absolute 1-based
  row indexing, remote horizontal navigation, and failure only after the row's
  reachable items are exhausted. Keep the emitted action and validation rules
  unchanged.
**Invariants and compatibility:** The server still emits only structured
  actions and no selectors or executable code.
**Tests affected:** Existing compiler/schema tests continue to verify the
  unchanged action shape and field validation.

### `graphify-out/*` generated artifacts

**Action:** Modify (generated)
**Current role and evidence:** Persistent project knowledge graph and report;
the repository instructions require `graphify update .` after code changes.
**Exact changes:** Refresh the graph, report, HTML export, labels, and manifest
  from the modified source. These are derived artifacts, not hand-authored
  runtime behavior.
**Invariants and compatibility:** No source or action contract is inferred from
  the generated files; Graphify's non-blocking warning for five JSON fixtures
  producing zero AST nodes is recorded as a known limitation.
**Tests affected:** `graphify update .` completes successfully.

## Execution Sequence

### Step 1 — Implement off-viewport indexed focus

**Objective:** Make the shared helper navigate a horizontally virtualized row
to an absolute `itemIndex` through TV remote keys.
**Files:** `tests/lib/content-rows.js`
**Implementation details:** Add the bounded horizontal focus routine described
above; preserve the default and `Thể loại` paths; use refreshed focus/row state
for final verification and error reporting.
**Dependencies:** Existing `remotePress`, `getFocusedContentMetadata`,
`isFocusedContentItem`, `isFocusedNearRow`, and snapshot cache.
**Verification:** `node --check tests/lib/content-rows.js`; targeted unit test
  from Step 2 after it is added; expected result: off-viewport target is
  reachable and a stuck row reports a bounded failure.
**Exit criteria:** The helper no longer rejects an indexed target solely because
  it is absent from the current visible poster array.
**Approval gate:** Required

### Step 2 — Add regression contracts

**Objective:** Lock in success and exhaustion behavior without a live TV.
**Files:** `tests/unit/content-rows.test.js`
**Implementation details:** Add deterministic mocks for a five-item visible
  window, changing focus signatures, repeated Right presses, and a no-progress
  boundary.
**Dependencies:** Step 1 helper API.
**Verification:** `node --test tests/unit/content-rows.test.js`; expected result:
  all content-row tests pass, including an index larger than the visible window.
**Exit criteria:** The regression fails against the old visible-array indexing
  implementation and passes with the new remote-navigation implementation.
**Approval gate:** Not required after Step 1 approval

### Step 3 — Synchronize contract docs and verify the repository

**Objective:** Make the documented semantics match runtime behavior and update
  the project graph.
**Files:** `AGENTS.md`, `README.md`, `ACTION-COMPILER.md`
**Implementation details:** Replace visible-only wording with off-viewport
  remote-navigation wording; leave action shape/validation unchanged.
**Dependencies:** Steps 1-2.
**Verification:** `npm run test:unit`; `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js`; `npx playwright test tests/run-test-case-mytv.spec.js --list`; `git diff --check`; `graphify update .`. Expected result: all local checks pass, Playwright lists the generic case spec, and Graphify reflects the modified helper/docs.
**Exit criteria:** Acceptance criteria are evidenced, final diff contains only
  scoped source, test, documentation, generated-graph, and plan files, and the
  plan's verification table is updated with actual results.
**Approval gate:** Not required after Step 1 approval

## Verification Plan

| Acceptance criterion | Check type | Command or action | Expected evidence |
| --- | --- | --- | --- |
| Off-viewport indexed target is reachable | Unit regression | `node --test tests/unit/content-rows.test.js` | Mock row exposes only five visible items but requested index beyond five completes after Right presses |
| Index is absolute and default behavior remains | Unit/regression | Targeted content-row tests plus existing action-runner tests | `itemIndex: 1` emits no extra Right presses; omitted index still focuses the first row anchor; existing 562-test contracts remain green |
| Exhausted row fails clearly | Negative unit regression | `node --test tests/unit/content-rows.test.js` | Error includes row name, requested index, and furthest reached index |
| `Thể loại` remains compatible | Existing unit regression | `npm run test:unit` | Existing four service-carousel tests pass |
| Docs match behavior and graph stays current | Static/repository checks | `git diff --check`; `graphify update .` | No whitespace errors; graph update completes |

## Completed Verification

> Update this section during execution with actual results. Do not prefill claims.

| Step or check | Command or action | Result | Evidence | Timestamp |
| --- | --- | --- | --- | --- |
| Baseline | `npm run test:unit` | Pass | 562 passed, 0 failed, 0 skipped | 2026-08-02 22:47 +0700 |
| Worktree baseline | `git -c core.fsmonitor=false status --short --branch` | Pass | Clean `fix/find-item-index` worktree | 2026-08-02 22:47 +0700 |
| Step 1 syntax | `node --check tests/lib/content-rows.js` | Pass | No syntax errors | 2026-08-02 22:53 +0700 |
| Step 1 focused regression baseline | `node --test tests/unit/content-rows.test.js` | Pass | 4 passed, 0 failed | 2026-08-02 22:53 +0700 |
| Step 2 syntax | `node --check tests/unit/content-rows.test.js` | Pass | No syntax errors | 2026-08-02 22:56 +0700 |
| Step 2 regression | `node --test tests/unit/content-rows.test.js` | Pass | 6 passed, 0 failed, including off-viewport and exhausted-row cases | 2026-08-02 22:56 +0700 |
| Full unit suite | `node --test --test-reporter=tap tests/unit/*.test.js` | Pass | 564 passed, 0 failed, 0 skipped | 2026-08-02 22:58 +0700 |
| Syntax checks | `node --check app/main.js`; `node --check app/preload.js`; `node --check app/renderer/renderer.js` | Pass | All three exit 0 | 2026-08-02 22:58 +0700 |
| Generic Playwright listing | `npx playwright test tests/run-test-case-mytv.spec.js --list` | Pass | Listed 1 test in 1 file | 2026-08-02 22:58 +0700 |
| Diff whitespace | `git diff --check` | Pass | Exit 0 | 2026-08-02 22:58 +0700 |
| Graph refresh | `graphify update .` | Pass with warning | 2,468 nodes, 3,969 edges, 153 communities; five JSON fixtures produced zero AST nodes | 2026-08-02 22:57 +0700 |

## Deviations and Plan Updates

- 2026-08-02, Step 3: `graphify update .` modified tracked `graphify-out/*`
  artifacts as required by the repository graph-maintenance rule; the refresh
  completed successfully with the documented five-fixture zero-node warning.

## Handoff and Completion

- Changed files: `tests/lib/content-rows.js`,
  `tests/unit/content-rows.test.js`, `AGENTS.md`, `README.md`,
  `ACTION-COMPILER.md`, generated `graphify-out/*`, and this plan.
- Checks passed: 564 unit tests; focused content-row tests; three app syntax
  checks; generic Playwright test listing; `git diff --check`; Graphify refresh.
- Known limitations: A real Browser/LG staging run is environment-dependent and
  was not run. Graphify reported five JSON fixtures with zero AST nodes while
  successfully rebuilding the graph.
- Follow-up work: None identified.
- Final acceptance status: Complete; all planned local acceptance checks pass.
