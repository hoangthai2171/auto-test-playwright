# Desktop LG product-gate flow design

## Status

Design only. Implementation and all live execution remain blocked until this
document and its implementation plan are approved.

## Goal

Make the normal desktop **Run Selected** flow execute the selected server/API
test cases on a saved LG device. Browser and LG keep one case-selection,
batch-control, reporting, and result-submission workflow; only the execution
adapter changes.

The existing terminal LG product gate remains an internal Phase 3 proof
harness. It is not a permanent user-facing workflow and must not become a
second, competing run button.

## Scope

- LG only. Samsung remains out of scope.
- Reuse the existing folder picker, selected-case list, **Run Selected**,
  **Stop**, logs, reports, result submission, and retry-sync UI.
- Use the selected saved LG profile and only the explicit Advanced or verified
  app-managed toolchain source.
- Run existing target-neutral cases when every selected action is supported by
  the LG adapter.
- Preserve the current Browser execution path unchanged.

## Non-goals

- No app deployment, installation, update, uninstall, rollback, or reset of
  anything except MyTV local storage as part of an approved case run.
- No Samsung support, direct-IP one-off run, target creation, pairing, package
  picker, global CLI fallback, NVM, PATH change, or shell-profile change.
- No separate persisted LG test-account credential, device-account form, or
  "Run LG product gate" button.
- No ChromeDriver guessing or latest-version selection. An LG run remains
  blocked until the centrally maintained compatibility profile is verified.

## User flow

1. The operator chooses **LG**, selects a saved device, and may use **Check
   connection** for an immediate redacted status update.
2. The existing workspace stays in place. The right-hand surface replaces the
   Browser preview with LG connection/run status and the latest genuine TV
   frame when visual capture is available.
3. If any execution prerequisite is missing, **Run Selected** is disabled and
   explains the reason with a **Configure SDK** shortcut. A green historic
   connection dot is useful feedback but is never live-run authority.
4. When the operator presses **Run Selected**, the app shows one confirmation
   for the complete selected batch. It names the case count and explains that
   the run may foreground MyTV, reset only MyTV local storage, send native
   remote input, enter the selected case's login through MyTV's virtual
   keyboard, and perform trusted logout cleanup.
5. After confirmation, the main process performs a fresh read-only target
   identity and installed-MyTV-app preflight. A failed preflight sends no
   remote input, does not start Appium, and does not alter MyTV.
6. Passing preflight starts the normal selected-case batch. The right-side
   workspace reports fixed, redacted run status and the latest local frame
   when the genuine visual-capture capability is available. Browser interactive
   preview controls remain unavailable for LG.

## Main-process execution boundary

The renderer may submit only the target, selected saved-device ID, case IDs,
folder context, and the confirmed batch intent. It must never receive a host,
passphrase, pairing material, local tool path, raw vendor output, raw Appium
output, or login password.

The main process resolves the encrypted saved device and the selected
managed-or-Advanced toolchain internally. It creates only a loopback Appium
child and a trusted webOS `TvSession`. LG runs use native remote-control mode
(`rc`), never `appium:rcMode: "js"`; no flow may invoke `webos: clearApp`.
The session-start MyTV-only reset is accepted only after foreground MyTV
identity verification.

Each selected case is compiled and run through the existing target-neutral
action path. Login credentials come only from that case's existing `login`
action and remain main-process/runtime-only data. Trusted LG semantic
operations retain virtual-keyboard character-by-character entry and trusted
logout cleanup.

## Prerequisites and preflight

LG **Run Selected** is enabled only when all of the following are true:

- A saved LG device is selected.
- The local selected source has the required webOS CLI, managed Node/Appium,
  LG driver, and a compatible ChromeDriver profile.
- A connection check has not identified an unavailable target; after operator
  confirmation, a fresh main-process read-only preflight independently proves
  target identity and installed MyTV app identity.
- Each selected case validates for the LG capabilities before a TV session or
  remote input begins.

Compatibility facts gathered from a real device may match an existing central
ChromeDriver profile only. They never create, guess, download, or select a
new profile automatically.

## Reporting and recovery

TV frames and redacted diagnostics remain in local host-app report storage.
The existing API result-submission payload remains credential-free and does
not upload artifacts.

Business case failures are recorded normally and the batch proceeds to the
next selected case. Connection, Appium, reset, or unknown technical failures
retry the whole current case from a fresh MyTV-only reset up to three times.
After the third technical failure, the app pauses for **Keep retrying** or
**Stop**; it never resumes mid-case or advances automatically. Pairing-required
states always pause for manual operator action and never retry automatically.

## Test and acceptance criteria

Before live use, tests must prove:

- The Browser path is unchanged.
- Renderer IPC payloads contain no connection values, paths, or credentials.
- LG preflight blocks before Appium, reset, launch, or input on missing
  prerequisites, unsupported actions, app mismatch, or connection failure.
- Confirmation is required once per selected batch.
- Native LG execution receives only trusted actions and uses neither forbidden
  command.
- Business and technical failure policies match the existing target-neutral
  contracts.
- TV report/result handling uses local artifacts and the existing submission
  shape.

The first live GUI pilot requires separate fresh operator approval after local
tests pass. It must retain only redacted evidence and must not deploy,
uninstall, pair automatically, or expose connection data.
