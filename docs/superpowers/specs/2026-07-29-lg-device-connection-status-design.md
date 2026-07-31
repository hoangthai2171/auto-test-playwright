# LG Device Connection Status Design

## Purpose

Make the LG-device controls compact and make it clear that a saved device has
not yet been proven reachable. This increment adds local presentation only;
it must not contact a TV or change a saved device.

## User experience

When the LG target is selected, the device-list controls use compact
underlined text-style buttons: **+ Add device** and **Edit device**. They
remain semantic buttons so they preserve keyboard activation and disabled
behavior; they are not navigation links.

Below the controls, the selected device has a connection-status row:

- A neutral gray dot with **Connection not checked**.
- A disabled **Check connection** button.
- A short explanation that connection checking becomes available only when
  live LG validation has been approved.

The initial status is always neutral. Selecting a different device, creating a
device, or editing a device resets the presentation to neutral. A saved profile
must never be rendered as connected merely because it exists.

## Deferred live behavior

After a suitable LG TV is available and the user provides fresh explicit
approval, the same button may perform an explicit, read-only connection check.
It will show a pending state while the main process works, then one of:

- Green dot and **Connected** after a successful read-only check.
- Red dot and **Unavailable** after a safely classified failure.

The check will be a separate, future live-TV increment. It must use saved
connection material only in the main process, return redacted status only, and
must not register a target, pair, deploy, install, uninstall, reset, launch,
navigate, or operate the TV app. A successful connection check alone does not
enable LG test execution.

## Boundaries

No new renderer IPC or production validator is added in this increment. The
disabled control must not call a CLI, start Appium, read a saved secret, access
the network, or contact a TV. Existing add/edit flows remain unchanged except
for resetting the local visual state.

## Tests and verification

Test-first coverage must assert:

- Add/Edit retain their existing semantics while using compact underlined
  presentation.
- The status row is neutral and the check button is disabled by default.
- Selecting, adding, or editing a profile leaves or returns the status to
  neutral.
- The renderer has no callable connection-check IPC and no local operation can
  contact a TV.

After every repository edit, run the required unit, syntax, Playwright-list,
and whitespace checks, followed by the project Graphify update/check. Real-TV
verification remains out of scope without a TV, fresh approval, and the
required preflight.

## Non-goals

- Samsung support
- Pretending that a saved device is connected
- Any network or TV operation
- Enabling a test run based on a status indicator
- Changing the existing device-dialog data and secret boundaries
