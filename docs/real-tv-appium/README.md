# Real-TV Appium Delivery Plan

## Goal

Extend **MyTV Auto Test** so its existing Electron desktop GUI can select a
target (`Browser`, `Samsung`, or `LG`), connect to a real TV, and run the same
server-shaped test cases against a production-equivalent MyTV TV build.

The GUI remains the control room. Appium is the device-control and
WebDriver/remote-input backend for physical TVs; it does not replace the GUI or
the case browser.

## Current status

**Planning only — no real-TV implementation has started.**

Read in this order when resuming work:

1. [Architecture and contracts](architecture.md)
2. [Phased delivery plan](phases.md)
3. [Physical-device POC runbook](poc-runbook.md)
4. [Handoff ledger](HANDOFF.md)
5. [Non-secret device-profile schema](device-profile.schema.json)

## Decisions already made

- Keep the Electron app as the only operator UI.
- Keep the current `Browser` runner intact as the first target option.
- Add `Samsung` (Tizen TV) and `LG` (webOS TV) as physical-device targets.
- Use Appium 2/3 community drivers: `appium-tizen-tv-driver` and
  `appium-lg-webos-driver`.
- Test the current production-equivalent MyTV package without adding test-only
  application instrumentation. It must still be signed/deployed through each
  vendor's developer workflow.
- Use Appium WebDriver/Chromedriver DOM inspection and screenshots, matching
  the current browser-test approach. A model without reliable DOM access is not
  eligible for semantic automation in the first release.
- Store device secrets outside the renderer and outside the normal device JSON
  profile. The main process owns them.
- Defer the separate internal TV-lab lease service until an always-on internal
  host is available. The first release uses an explicitly acknowledged,
  **manual-only** shared-device warning.
- Discovery is safe and bounded: enumerate configured/connected developer
  devices and allow direct IP entry. Do not sweep arbitrary subnets or ports.

## Explicit non-goals for the first release

- Testing an arbitrary consumer-installed store app outside the vendor developer
  workflow.
- Unattended device power cycling or HDMI/IR hardware automation.
- Parallel execution on one physical TV.
- Guaranteed cross-laptop exclusion for a shared TV. This requires the deferred
  lease service.
- Replacing every existing Playwright helper before the real-TV POC proves
  input, DOM/bridge state, screenshots, and cleanup.
- QA-build-only application instrumentation. The QA bridge is a future feature.

## Definition of success

From the desktop GUI, an operator can choose a registered Samsung or LG TV,
select test cases, press **Run Selected**, watch live screenshots/logs, and
receive the existing compact result report. The pilot proves login through the
TV keyboard, search, playback with a progressing playhead, logout, and
actionable failure artifacts on one supported model per platform.
