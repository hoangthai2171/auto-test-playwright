# Test Case Table and Sequential Batch Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Electron test-case card browser with a selectable semantic table, modal case details, and sequential execution of the selected test cases.

**Architecture:** Keep the existing single-case Electron IPC contract. The renderer owns selected IDs in table order, creates one promise per active `runTest` invocation, resolves it from the existing `onFinished` event, and continues the queue after either a passed or failed process. Row state is renderer-only and is reset when a new batch begins or cases are reloaded.

**Tech Stack:** CommonJS JavaScript, Electron renderer DOM APIs, Node built-in `node:test`, existing Playwright/Electron IPC bridge, project CSS.

## Global Constraints

- Preserve the single-case `run-test` IPC payload: `{APP_URL, TEST_CASE_ID, PREVIEW_TYPE}`.
- Run checked IDs sequentially in table order; never start a second process before the prior `onFinished` event.
- A failed case must not abort later queued cases.
- Stop must call the existing `stopTest()` once, mark the active case failed/stopped, and prevent future queued cases from starting.
- Detail actions must not alter row selection.
- Render server data with `textContent`; mask login action passwords and redact credential-shaped text.
- Use the virtual-keyboard and existing MyTV helpers only inside the Playwright runner; this UI change must not alter browser interaction code.
- Use `apply_patch` for source edits and run `npm run test:unit`, syntax checks, Playwright listing, and `git diff --check` before completion.

### Task 1: Render a selectable semantic test-case table

**Files:**
- Modify: `app/renderer/index.html` — replace the card list/detail markup with a table container, select-all checkbox, selected-count text, and batch run label.
- Modify: `app/renderer/renderer.js` — render table rows with per-row checkboxes, maintain selection in table order, and expose selection state to validation and submission.
- Modify: `app/renderer/styles.css` — style the table, checkbox cells, status cell, and selected-count toolbar.
- Test: `tests/unit/renderer.test.js` — extend the fake DOM and add table rendering, select-all, per-row selection, and selected-count tests.

**Interfaces:**
- `renderCaseList(nextCases)` renders `<tr data-test-case-id>` rows under `#test-case-list-body` and resets selection/status state.
- `getSelectedCaseIds()` returns selected IDs as strings in `cases` order.
- `validateRunValues({selectedCaseIds})` returns the existing empty-selection error when the list is empty.
- The run button label is `Run Selected (N)` and is disabled when `N === 0` or a batch is active.

- [x] Write a failing test asserting two cases render as table rows with unchecked row checkboxes, IDs, names, detail buttons, and `Run Selected (0)` disabled.
- [x] Run `node --test tests/unit/renderer.test.js`; confirm the failure is caused by the missing table/selection behavior.
- [x] Write a failing test asserting the header checkbox selects all rows and unchecking one row clears the header and changes the selected count.
- [x] Run the focused renderer test again and confirm the expected selection failure.
- [x] Implement table rendering and selection helpers without using `innerHTML`; update `#selected-test-case-count`, `#run-button`, and the header checkbox from the selected IDs.
- [x] Add CSS for a scrollable semantic table and preserve the existing dark renderer layout.
- [x] Run `node --test tests/unit/renderer.test.js`; confirm the new table tests and existing renderer tests pass.
- [ ] Commit with `rtk git add app/renderer/index.html app/renderer/renderer.js app/renderer/styles.css tests/unit/renderer.test.js && rtk git commit -m "feat: render selectable test case table"`.

### Task 2: Move case details into a modal with safe display formatting

**Files:**
- Modify: `app/renderer/index.html` — add a dedicated `#test-case-details-modal` dialog with close controls and move the details article inside it.
- Modify: `app/renderer/renderer.js` — open the modal from a row Detail button, render all execution fields including metadata and normalized actions, and close it without changing selection.
- Modify: `app/renderer/styles.css` — add modal sizing and detail-content styles while reusing existing modal primitives.
- Test: `tests/unit/renderer.test.js` — add modal content, masking, and selection-preservation coverage.

**Interfaces:**
- `renderCaseDetails(testCase)` renders safe text into `#test-case-details` and does not select the case.
- `openCaseDetails(testCaseId)` finds the case by ID, renders it, and removes `hidden` from `#test-case-details-modal`.
- The modal close button and backdrop add `hidden` back to the detail modal.

- [x] Write a failing test that clicks a row Detail button and asserts the modal contains name, ID, pre-condition, QA description, expected result, platform, environment, metadata, normalized actions, and `••••••`, but not the source password.
- [x] Run the focused renderer test and confirm the missing modal behavior fails.
- [x] Write a failing test that selects case A, opens case B details, and verifies the checked selection remains only case A.
- [x] Run the focused renderer test and confirm the selection-preservation assertion fails.
- [x] Implement modal open/close handlers and field rendering using `textContent`, `JSON.stringify` for metadata, and `maskActionForDisplay` for normalized actions.
- [x] Run `node --test tests/unit/renderer.test.js`; confirm modal and existing credential-redaction tests pass.
- [ ] Commit with `rtk git add app/renderer/index.html app/renderer/renderer.js app/renderer/styles.css tests/unit/renderer.test.js && rtk git commit -m "feat: add test case details modal"`.

### Task 3: Execute selected cases sequentially and isolate failures

**Files:**
- Modify: `app/renderer/renderer.js` — add queue state, one-case completion waiting, row statuses, stop handling, final counts, and batch-aware preview/log lifecycle.
- Modify: `app/renderer/index.html` — provide row status markup targets and final batch message support through existing `#form-message`.
- Modify: `app/renderer/styles.css` — style Running/Passed/Failed status text.
- Test: `tests/unit/renderer.test.js` — add sequential IPC order, payload, failure continuation, status, final counts, and stop tests.

**Interfaces:**
- `runSelectedCases()` captures `getSelectedCaseIds()` once, returns a promise resolving to `{completed, failed, skipped, stopped}`.
- Each call to `api.runTest` receives `{APP_URL: trimmedUrl, TEST_CASE_ID: id, PREVIEW_TYPE: activePreviewType}`.
- `api.onFinished` resolves the active case promise; code `0` is Passed and any other code or IPC start failure is Failed.
- `api.stopTest()` prevents the next queued case from starting and leaves queued rows Skipped.

- [x] Write a failing test that selects case A and B, invokes the form submit, resolves the first `onFinished` event, and asserts the second `runTest` call starts only afterward with the unchanged generic payload.
- [x] Run the focused test and confirm it fails because submission currently starts only one case and has no completion queue.
- [x] Write a failing test that makes case A finish with a non-zero code, verifies case A is Failed, case B still runs, and the final message reports completed/failed/skipped counts.
- [x] Run the focused test and confirm the failure continuation behavior is absent.
- [x] Write a failing test that clicks Stop during case A, verifies `stopTest` is called, case B never starts, and the final message reports skipped work.
- [x] Run the focused test and confirm stop does not yet prevent the queue.
- [x] Implement `resolveActiveCompletion`, `runSingleCase`, and `runSelectedCases` around the existing `onStarted`, `onLog`, `onPreview`, and `onFinished` hooks; keep only one active `runTest` call.
- [x] Update row status nodes and `setFormRunning` around the whole batch; reset preview and append a per-case completion line as each process ends.
- [x] Run `node --test tests/unit/renderer.test.js`; confirm all queue tests pass.
- [ ] Commit with `rtk git add app/renderer/index.html app/renderer/renderer.js app/renderer/styles.css tests/unit/renderer.test.js && rtk git commit -m "feat: run selected test cases sequentially"`.

### Task 4: Validate compatibility and finish the change

**Files:**
- Modify: `tests/unit/renderer.test.js` only if a regression contract needs to be made explicit.
- Modify: `README.md` and `AGENTS.md` only if the final UI or execution contract introduces a user-visible entry point not already documented.

- [x] Run `rtk npm run test:unit` and confirm the complete unit suite passes.
- [x] Run `rtk node --check app/main.js`, `rtk node --check app/preload.js`, and `rtk node --check app/renderer/renderer.js`.
- [x] Run `rtk npx playwright test tests/run-test-case-mytv.spec.js --list` and confirm the generic runner remains discoverable.
- [x] Run `rtk git diff --check` and inspect `rtk git diff HEAD~3..HEAD` plus the working tree diff for accidental credentials, API changes, or unrelated edits.
- [ ] Run the finishing-a-development-branch workflow and report the resulting commits and any live staging/Electron smoke validation that was not run.
