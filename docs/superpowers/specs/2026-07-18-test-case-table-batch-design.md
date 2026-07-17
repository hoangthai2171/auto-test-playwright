# Test Case Table and Sequential Batch Execution

Date: 2026-07-18  
Status: Design approved in conversation

## Goal

Replace the Electron test-case card browser with a table that supports selecting multiple test cases, inspecting each case in a modal, and running the selected cases sequentially.

## UI structure

The test-case browser will render a semantic table with:

- A header select-all checkbox.
- Per-row selection checkbox.
- Test-case ID.
- Test-case name.
- Detail button.
- Visible execution status for the current batch when applicable.

The existing detail panel will become a modal opened by a row's Detail button. It will show the server fields relevant to execution: name, ID, pre-condition, QA description, expected result, platform, environment, metadata, and normalized actions. Credential values remain masked in the renderer.

The primary run control will run the checked cases and display the selected count. It is disabled when no cases are selected. Detail actions do not change selection.

## Batch execution

The renderer owns the queue because the existing IPC contract already runs one test case by ID. Checked IDs are captured in table order when the batch starts. The renderer invokes the existing `run-test` IPC call once per ID, waits for completion, updates that row's status, and continues after either success or failure.

Only one case runs at a time. The active row is marked `Running`; completed rows are marked `Passed` or `Failed`. The final message reports completed, failed, and skipped counts. The existing stop control stops the active process and prevents future queued cases from starting.

## Compatibility and error handling

- The single-case `run-test` IPC payload remains unchanged.
- Existing preview, logs, report, and stop controls remain available.
- A failure from one case is isolated to that row and does not abort the remaining queue.
- An empty selection is rejected in the renderer before IPC is called.
- Loading failures continue to show the existing form error state.

## Verification

Renderer tests will cover table rendering, select-all and per-row selection, detail-modal contents and credential masking, selected-count validation, sequential IPC calls, status updates, and continuation after a failed case. Existing unit and Playwright regression suites must remain green.
