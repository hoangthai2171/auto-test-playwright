# Configurable test-case maximum time

**Status:** Complete

## Goal

Allow the desktop runner to configure the maximum duration of one Browser test
case from Settings → Test configuration.

## Decisions

- The setting is expressed in whole minutes so it matches the existing
  per-case timeout values shown to maintainers.
- The default is 30 minutes, preserving the current longest GUI case budget.
- The value is validated in the shared configuration module, persisted with the
  renderer's existing settings, synchronized through main-process IPC, and
  applied to the generic Playwright case runner.
- Existing terminal runs without the desktop setting retain their dedicated
  ordinary/Home-trailer/exhaustive-row timeout behavior.

## Scope

- Add the numeric Test configuration input and the requested Vietnamese tooltip.
- Thread the setting through Browser run payloads and the child Playwright
  environment.
- Add unit coverage for normalization, renderer persistence/payloads, and the
  configuration synchronization contract.
- Update project guidance and run the required static/unit/Graphify checks.

## Verification

| Check | Result |
| --- | --- |
| Focused unit tests | Pass — 103 tests passed across configuration, preload, and renderer contracts. |
| Full unit suite | Pass — `npm run test:unit`: 619 tests passed, 0 failed. |
| Syntax, Playwright list, diff check | Pass — changed JavaScript files parsed, one generic Playwright test listed, and `git diff --check` reported no whitespace errors. |
| Graphify update | Pass — local graph rebuilt with 2,714 nodes and 4,298 edges. |
