# Tizen No-Screenshot POC Design

## Goal

Allow the Samsung command-line POC to continue the remaining safe Phase 1
checks when this TV cannot provide a genuine Appium screenshot, without
pretending that screenshot evidence, a full POC, or model support exists.

## Scope

Add one explicit command-line opt-in: `--skip-screenshot-gate`.

When the flag is absent, the existing screenshot requirement remains unchanged:
each evidence point requires a successful Appium `GET /screenshot` response and
the POC stops on failure.

When the flag is present, the harness records redacted DOM evidence only and
continues through the existing reset/restart, real remote-key, DOM-inspection,
and session/Appium/SDB-forward cleanup checks. It does not create a PNG, does
not invoke a synthetic capture path, and does not issue any additional Appium
command after a screenshot timeout because it does not request a screenshot.

The current no-credential invocation can run the reset and remote-key checks.
Dedicated-account login and logout remain separately opt-in through the
existing runtime-only environment variables and flags; they are not enabled by
this change.

## Safety and Result Semantics

- The Samsung store ID `PP2MTMRMs9.MyTV` remains unconditionally rejected.
- Only the distinct test app `PP2MTMRMs8.MyTV` is eligible for the POC.
- No Electron GUI, LG workflow, deployment behavior, pairing state, or account
  handling changes.
- Evidence stays local, mode-restricted, and redacted.
- A run using `--skip-screenshot-gate` must have a distinct partial-success
  status such as `passed_without_screenshot_gate`; it must never print the
  current `Samsung Tizen POC passed` success message.
- The manifest must state `appiumScreenshot: { passed: false, skipped: ... }`
  and retain `supportStatus` as unsupported/pending the full screenshot gate.
- A successful normal WebDriver delete-session in this mode may prove cleanup,
  but does not repair the missing screenshot gate.

## Test Design

Pure tests will establish that default evidence capture calls `GET /screenshot`
and throws on its failure, while skip mode writes redacted DOM state without
calling that endpoint. A run-result test will establish that skip mode cannot
produce the full-pass console message or a supported-model claim.

## Documentation

`HANDOFF.md`, `phases.md`, and `poc-runbook.md` will distinguish partial
no-screenshot checks from the full POC. They will continue to state that no
Samsung model is supported until genuine Appium screenshot evidence is obtained.
