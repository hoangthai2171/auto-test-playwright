# Transient LG compatibility connection design

## Goal

Let a maintainer inspect and validate an LG TV compatibility mapping without
first saving or connecting a device in the workspace.

## Entry point

Settings → SDK configuration gains a maintainer-only **Check device
compatibility** action. It opens a modal dialog; it is not a new persistent
workspace setting and does not change the LG device list.

## Dialog flow

1. The dialog accepts a device label, host, and passphrase for this attempt.
   The values are runtime-only: they are not persisted, returned to the
   renderer after use, logged, or included in result text.
2. **Inspect TV** explains that it will make one read-only LG connection to
   retrieve the exact model and firmware. The maintainer must explicitly
   approve this live-TV contact before it starts.
3. The result panel shows redacted, non-secret compatibility status:
   existing catalog pair found, or new compatibility required. No driver is
   downloaded during inspection.
4. When an existing verified pair is found, **Run compatibility validation**
   becomes available. It requires a separate explicit confirmation before a
   temporary verified ChromeDriver download and the approved MyTV-only product
   gate. It removes temporary files afterwards.
5. A successful validation still requires the existing final **Record this
   compatibility?** or **Update this compatibility?** confirmation before the
   local catalog can change. Publishing remains separate.

## Safety boundaries

- LG only.
- Inspection is the first live-TV operation and always requires fresh approval.
- Never use `appium:rcMode "js"` or `webos: clearApp`.
- Never deploy, install, uninstall, reset, pair, or otherwise change a TV app
  outside the separately approved MyTV-only product gate.
- Never use a guessed or latest ChromeDriver. An unknown pair stops after
  inspection until a maintainer supplies an audited candidate.
- Do not expose or persist hosts, credentials, pairing data, screenshots,
  evidence locations, archive paths, or integrity values.

## Implementation boundary

The existing compatibility command requires an already registered LG CLI
device. The implementation will add a transient runtime connection path behind
main-process IPC, with renderer contracts and unit tests. It will not reuse or
modify saved-device registration.

## Verification

Unit tests will prove that runtime connection values do not persist or cross
the renderer IPC boundary, inspection cannot download or run a product gate,
and validation remains disabled until an inspected verified profile and fresh
confirmation are present.
