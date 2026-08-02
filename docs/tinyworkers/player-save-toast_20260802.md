# Player configuration save toast

**Status:** Complete

- [x] Step 1: Replace the persistent inline `Saved` message with a bottom-right global toast that reports save success or failure and hides after three seconds.
- [x] Step 2: Update renderer contracts/tests and document why `activateVerifiedTarget` keeps its separate activation-settle delay.
- [x] Step 3: Run proportionate unit, syntax, formatting, and Graphify verification.

## Goal

Give the Settings save action temporary, unambiguous feedback without leaving stale text in the Settings modal, while preserving the distinction between activation settling and player-health verification.

## Findings and decisions

- `test-configuration-message` remains mounted when the Settings modal is hidden, so its `Saved` text reappears when the modal opens again. The value is not stored in localStorage; the DOM node is reused.
- The renderer currently suppresses `setTestConfiguration` failures by catching them and resolving `undefined`. The save flow must inspect the IPC response/rejection to select a success or error toast.
- `activateVerifiedTarget` in `tests/lib/selector-validation.js` verifies focus, presses `Enter`, then waits for its caller-supplied `delay`. The `delay: 6000` calls in `tests/lib/workflows.js` are post-activation screen-settling delays in legacy channel/movie/search flows. They do not inspect video state, playback progress, player readiness, route changes, or service content.
- The player-check timeout remains dedicated to `inspectPlaybackAfterWait`, expected-result player checks, and LG player readiness. Reusing it for every activation would couple unrelated timing and slow non-player navigation.

## Files to edit

### Toast and save flow

- `app/renderer/index.html`: Remove the inline Test configuration status label and add one global `app-toast` status element positioned independently of the Settings modal.
- `app/renderer/renderer.js`: Add toast state and timer replacement/cleanup, make test-configuration synchronization expose success/failure, and show success/error feedback after Save. Apply the same feedback pattern to the existing GUI settings Save action so no Settings panel retains the old inline `Saved` behavior.
- `app/renderer/styles.css`: Style the fixed bottom-right toast and its success/error states.

### Tests and documentation

- `tests/unit/renderer.test.js`: Update the renderer fixture and assertions for the global toast, success/failure responses, exactly three-second hiding, replacement of an earlier timer, and absence of stale inline save text after reopening Settings.
- `README.md`: Clarify that the configured player timeout is for playback-health checks and that activation-settle waits are separate.
- `AGENTS.md`: Keep the project architecture guidance explicit about the separate legacy activation delay and configurable player-health timeout.

The following files were inspected but are intentionally not changed because their behavior is correct for separate concerns:

- `tests/lib/selector-validation.js`: Owns verified focus activation and its caller-provided settle delay.
- `tests/lib/workflows.js`: Supplies legacy activation delays; it does not perform the player-health check.
- `tests/lib/playback.js`, `tests/lib/test-case-action-runner.js`, and `tests/lib/tv-session/webos-mytv-automation.js`: Own actual player-health checks and already consume the configurable timeout where applicable.

## Verification

- Run the focused renderer unit tests and the complete `npm run test:unit` suite.
- Run Node syntax checks for the changed JavaScript files.
- Run `npx playwright test tests/run-test-case-mytv.spec.js --list`.
- Run `git diff --check`.
- Run `graphify update .` after source changes.

## Completed verification

- Focused renderer suite: 85 passed, 0 failed.
- Full `npm run test:unit`: 562 passed, 0 failed.
- Node syntax checks passed for the shared configuration, Electron main/preload, and renderer files.
- `npx playwright test tests/run-test-case-mytv.spec.js --list`: 1 test listed successfully.
- `git diff --check`: clean.
- `graphify update .`: rebuilt the local graph successfully.
- Live Electron and staging smoke runs were not performed because they are environment-dependent.
