# Configurable player-check timeout

**Status:** Complete

- [x] Step 1: Add one shared timeout default/normalizer and thread the configured value through Browser and LG player-check execution.
- [x] Step 2: Add the Settings → Test configuration page, numeric timeout field, persistence, input validation, and hover/focus tooltip.
- [x] Step 3: Update focused unit contracts and project documentation for the setting and runtime behavior.
- [x] Step 4: Run proportionate syntax, unit, formatting, and Graphify verification.

## Goal

Allow desktop users to change the wait before player health checks from Settings, while preserving a 6-second fallback for missing or invalid values.

## Assumptions and constraints

- The setting is a positive integer number of seconds and defaults to `6`.
- It is stored with the existing renderer settings and synchronized to the main process so LG runs can use it without adding sensitive or unrestricted fields to the LG run request.
- Browser server-driven playback actions, expected-result player checks, and LG semantic playback/readiness checks use the configured value. Legacy terminal-only specs retain their existing default because they do not read desktop localStorage.
- The tooltip text is exactly `Thời gian chờ trước khi check trạng thái player` and is shown from the `?` control on hover or keyboard focus.

## Files to edit

### Runtime configuration and execution flow

- `app/test-configuration.js` (new): Define the shared 6-second default and strict positive-integer normalizer so the fallback is maintained in one place.
- `app/preload.js`: Expose a narrow IPC method for synchronizing the saved test configuration with the main process.
- `app/main.js`: Store the sanitized timeout in main-process memory, apply it to Browser child-process environment variables, and inject it into LG batch execution. This keeps LG run requests limited to their existing device/case/confirmation data.
- `app/lg-desktop-batch-runner.js`: Read the current main-process timeout when starting each LG case and pass it to the trusted TV runner.
- `app/tv-runner.js`: Forward the configured timeout into the LG case helpers without exposing unrelated runtime or connection data.
- `tests/run-test-case-mytv.spec.js`: Read the Browser child-process timeout environment variable and pass it into the generic case runner.
- `tests/lib/test-case-action-runner.js`: Use the configured timeout for expected-result player checks and pass it to playback action handlers; retain the shared default when no value is supplied.
- `tests/lib/workflows.js`: Let named-content, search-result, and row playback checks consume the per-run timeout instead of always using the legacy default.
- `tests/lib/playback.js`: Replace the local hardcoded default with the shared configuration constant while preserving the legacy terminal-run API.
- `tests/lib/lg-mytv-case-helpers.js`: Create LG semantic helpers with the configured timeout.
- `tests/lib/tv-session/webos-appium-session.js`: Allow each trusted LG case to create its MyTV automation with the current timeout.
- `tests/lib/tv-session/webos-mytv-automation.js`: Replace the LG playback/readiness hardcoded wait with the configured value and use the same value for player readiness bounds.

### Settings UI and persistence

- `app/renderer/index.html`: Add a `Test configuration` Settings tab containing the `Player check timeout (second)` number input, a `?` help control, the exact Vietnamese tooltip, and a Save action.
- `app/renderer/renderer.js`: Add the defaulted setting to load/current/save handling, restrict the field to positive integers, synchronize saved values to main, and include the value in Browser run payloads.
- `app/renderer/styles.css`: Style the help control and hover/focus tooltip consistently with the existing Settings layout.

### Tests and documentation

- `tests/unit/test-configuration.test.js`: Verify the shared default and positive-integer normalization behavior.
- `tests/unit/preload.test.js`: Verify the new test-configuration IPC bridge is exposed to the renderer.
- `tests/unit/renderer.test.js`: Verify the new tab/field, default and persisted values, numeric normalization, and Browser/LG configuration propagation.
- `tests/unit/test-case-action-runner.test.js`: Verify configured and fallback timeout behavior for expected-result player checks and playback actions.
- `tests/unit/lg-desktop-batch-runner.test.js`: Verify the batch runner forwards the configured timeout to the LG runner.
- `tests/unit/tv-runner.test.js`: Verify the LG runner forwards the timeout to the case executor/helpers.
- `tests/unit/webos-appium-session.test.js`: Verify the per-case automation factory accepts the timeout without exposing trusted session internals.
- `tests/unit/webos-mytv-automation.test.js`: Verify LG playback and player-readiness waits honor a custom timeout and preserve the default.
- `README.md`: Document the new Settings path, default, validation behavior, and which desktop player checks it controls.
- `AGENTS.md`: Record the new test configuration setting and runtime propagation in the project architecture/settings rules.

Graphify refreshed the generated project artifacts under `graphify-out/` after the source changes.

## Verification

- Unit coverage proves settings load/save/validation and payload/configuration propagation.
- Unit coverage proves Browser and LG player waits use a non-default configured value and retain the 6-second fallback.
- Run `npm run test:unit`, the required Node syntax checks, `npx playwright test tests/run-test-case-mytv.spec.js --list`, `git diff --check`, and `graphify update .`.

## Completed verification

- `npm run test:unit`: 560 passed, 0 failed.
- Node syntax checks passed for the shared configuration, Electron main/preload, and renderer files.
- `npx playwright test tests/run-test-case-mytv.spec.js --list`: 1 test listed successfully.
- `git diff --check`: clean.
- `graphify update .`: rebuilt the local graph successfully.
- Live Electron and staging smoke runs were not performed because they are environment-dependent.
