# LG Device Dialog and Validation Design

## Purpose

Replace the always-visible, internal-field LG device form with a compact
dialog-based experience that asks a normal user only for connection information
they know. The resulting profile is saved only after an explicit live,
read-only validation succeeds. Until a suitable LG TV and a fresh validation
approval are available, this document defines the contract and permits only
fake-driven local tests and non-live UI work.

## User experience

When the LG run target is selected, the sidebar shows **LG device list** and
the selected-device dropdown. Under the dropdown, an action row places **+ Add
device** on the left and **Edit device** on the right. No edit form appears by
default.

Both actions open one dialog. It has generous field spacing and a horizontal
footer. The Add dialog contains only:

1. Device name
2. Device host
3. Passphrase

Port `9922` and user `prisoner` are fixed TV Developer Mode defaults and are
not editable. Device ID, model, vendor target name, firmware, and similar
facts are not requested from the user.

The Edit dialog preloads the device name and verified non-connection state. It
does not reveal a saved host or passphrase. Entering a host or passphrase
replaces the stored value; leaving either connection field empty preserves the
existing main-process-only value. The passphrase input supports temporary
Show/Hide while the user is typing, but the app never reads an encrypted saved
passphrase back into the renderer.

The primary dialog action is **Validate and save**. It creates no saved profile
when validation fails. During an edit, it preserves the prior profile until
the replacement connection has passed validation. The dialog displays only
safe phase and failure statuses.

## Live validation boundary

Validation is an explicit live operation, not a side effect of opening a
dialog, selecting a device, or saving local text. It requires the managed or
advanced LG CLI to be ready and may need an operator to enable Developer Mode
Key Server and approve any required on-TV prompt. The live operation is not
implemented or exercised in this increment.

When separately authorized, the future operation will:

1. Use the candidate connection details only in the main process.
2. Establish the required local CLI target/key material through the approved
   LG flow.
3. Perform read-only identity, system-information, and installed-MyTV-app
   checks.
4. Obtain model, firmware, and app facts and persist only validated profile
   metadata.
5. Atomically save the new or replacement local profile after all required
   checks pass.

It must never deploy, install, uninstall, reset, launch, navigate, or operate
the MyTV app. Pairing or Key Server readiness is an operator pause, never a
silent retry. No host, passphrase, key material, raw device output, or local
path crosses into renderer state, logs, or reports.

## Toolchain and compatibility behavior

TV facts cannot bootstrap the local host tools required to collect them.
Node, Appium, and the LG Appium driver remain the pinned managed host bundle.
The legacy LG CLI stays an operator-selected archive imported after the user
downloads it from LG. Those preconditions are independent of a device profile.

Validated model, firmware, and app facts are inputs to the centrally maintained
ChromeDriver compatibility catalog. They may select an exact existing profile;
they do not create or prove a profile. An unmatched device remains
`COMPATIBILITY_PROFILE_UNVERIFIED`, and the app must not guess or download a
latest ChromeDriver.

## Data and IPC boundaries

The renderer sends only the current dialog input over narrow preload IPC. The
main process generates or retains internal profile identity, stores connection
values and passphrases using the existing encrypted secret boundary, and
returns a redacted profile summary. Existing profiles never return a host or
passphrase to populate the dialog.

The dialog supports an injected fake validator in unit tests. The production
validator remains unavailable until separately authorized. UI code cannot call
a CLI, read local files, start Appium, or contact a TV.

## Tests and verification

Test-first contracts cover:

- LG-only dialog visibility, renamed list, horizontal Add/Edit actions, and
  improved form spacing.
- A closed-by-default dialog with only name, host, and passphrase inputs.
- Fixed port/user defaults absent from renderer-editable fields.
- Temporary passphrase reveal only for current input; no persisted secret or
  host is returned to the renderer.
- Candidate validation fails without saving and edit validation preserves the
  old profile until success.
- Safe status and compatibility-profile-unverified presentation without raw
  runtime data.
- No live command, target registration, Appium operation, or TV contact during
  local unit, syntax, and UI-list verification.

After every repository edit, run the required unit, syntax, Playwright-list,
and whitespace checks. Any real-device test remains out of scope without a TV,
fresh explicit approval, and the required read-only preflight.

## Non-goals

- Samsung support
- Saved-secret or saved-host disclosure
- Automatic legacy LG CLI download
- Automatic creation of ChromeDriver compatibility profiles
- TV pairing, target registration, live validation, deployment, installation,
  uninstall, reset, navigation, or test execution in this increment
